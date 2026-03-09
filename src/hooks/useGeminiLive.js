import { useRef, useState, useCallback } from 'react'

/*
 * ==========================================================================
 *  useGeminiLive — a React hook for real-time, bidirectional audio chat
 *  with Google's Gemini Live API over a single WebSocket connection.
 *
 *  HIGH-LEVEL FLOW:
 *  ┌──────────┐  mic PCM chunks (base64)    ┌──────────────┐
 *  │ Browser  │ ──────────────────────────► │ Gemini Live  │
 *  │ (client) │ ◄────────────────────────── │ (server)     │
 *  └──────────┘  AI audio + transcriptions  └──────────────┘
 *
 *  1. User clicks "start" → mic permission → open WebSocket → send setup msg
 *  2. Server replies with `setupComplete` → session is ready
 *  3. Mic audio is captured via AudioWorklet, chunked into PCM buffers,
 *     base64-encoded, and streamed to the server as `realtimeInput` messages
 *  4. Server streams back `serverContent` messages containing:
 *     - AI audio chunks (base64-encoded PCM) → decoded & played through speakers
 *     - Input transcription  (what the *user* said)
 *     - Output transcription (what the *AI* said)
 *     - Turn-complete / interrupted signals
 *  5. User clicks "stop" → WebSocket closed, audio resources cleaned up
 * ==========================================================================
 */

const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY

// The WebSocket endpoint for Gemini's bidirectional streaming RPC.
// It uses the BidiGenerateContent method, which keeps the connection open
// for continuous send/receive of audio data.
const WS_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${API_KEY}`

const MODEL = 'models/gemini-2.5-flash-native-audio-preview-12-2025'

/**
 * Convert a raw ArrayBuffer (PCM bytes from the AudioWorklet) to a
 * base64-encoded string so it can be embedded in a JSON message and
 * sent over the WebSocket. The Gemini API expects audio data as base64
 * inside a JSON envelope — not as raw binary frames.
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary) // btoa() does the actual base64 encoding
}

/**
 * Parse a WebSocket message event into a JS object.
 *
 * WebSocket messages can arrive in different formats depending on the browser:
 *   - string  → already text, just parse it
 *   - Blob    → binary blob, call .text() to get the string
 *   - ArrayBuffer → raw bytes, decode with TextDecoder
 *
 * All Gemini Live messages are JSON, so after extracting the text we
 * JSON.parse it into a plain object.
 */
async function parseWsMessage(event) {
  let text
  if (typeof event.data === 'string') {
    text = event.data
  } else if (event.data instanceof Blob) {
    text = await event.data.text()
  } else if (event.data instanceof ArrayBuffer) {
    text = new TextDecoder().decode(event.data)
  } else {
    text = String(event.data)
  }
  return JSON.parse(text)
}

/**
 * Decode AI audio from the server: base64 string → Float32Array of samples.
 *
 * The Gemini API sends audio as base64-encoded **16-bit signed PCM** at 24 kHz.
 * The Web Audio API's AudioBuffer expects **Float32** samples in the range [-1, 1].
 *
 * Conversion pipeline:
 *   base64 string
 *     → atob() → raw binary string
 *     → Uint8Array (raw bytes)
 *     → Int16Array (reinterpret every 2 bytes as a 16-bit signed integer)
 *     → Float32Array (divide each sample by 0x8000 = 32768 to normalise to [-1, 1])
 */
function decodeBase64PCM(base64) {
  // 1. base64 → binary string
  const binary = atob(base64)

  // 2. binary string → byte array
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }

  // 3. Reinterpret bytes as 16-bit signed integers (little-endian PCM)
  //    e.g. bytes [0x00, 0x40] → int16 value 16384
  const int16 = new Int16Array(bytes.buffer)

  // 4. Normalise to Float32 in [-1.0, 1.0] for the Web Audio API
  //    0x8000 (32768) is the max absolute value of a 16-bit signed int
  const float32 = new Float32Array(int16.length)
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 0x8000
  }
  return float32
}

/**
 * Language configuration map.
 * Each entry has:
 *   - label:        Display name in the dropdown
 *   - speechLang:   BCP-47 tag for the browser SpeechRecognition API
 *   - promptLang:   How to instruct the AI about which language to use
 *   - allowedRange: Regex character class for valid transcript characters;
 *                   used by cleanTranscript to strip text in wrong scripts
 */
export const LANGUAGES = {
  en: {
    label: 'English',
    speechLang: 'en-US',
    promptLang: 'English',
    allowedRange: /[^\x20-\x7E\u00C0-\u024F]/g,  // ASCII + Latin Extended
  },
  zh: {
    label: '中文',
    speechLang: 'zh-CN',
    promptLang: 'Simplified Chinese (Mandarin)',
    allowedRange: /[^\x20-\x7E\u00C0-\u024F\u4E00-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/g,
  },
  es: {
    label: 'Español',
    speechLang: 'es-ES',
    promptLang: 'Spanish',
    allowedRange: /[^\x20-\x7E\u00C0-\u024F]/g,  // Latin-based
  },
  ja: {
    label: '日本語',
    speechLang: 'ja-JP',
    promptLang: 'Japanese',
    allowedRange: /[^\x20-\x7E\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF]/g,
  },
  fr: {
    label: 'Français',
    speechLang: 'fr-FR',
    promptLang: 'French',
    allowedRange: /[^\x20-\x7E\u00C0-\u024F]/g,  // Latin-based
  },
}

/**
 * Strip transcription artifacts and text in the wrong script.
 *
 * The Gemini native audio models sometimes produce transcription text in
 * unexpected scripts. The audio comprehension is correct — it's only the
 * transcription metadata that's unreliable. We filter based on the
 * selected language's allowed character range.
 *
 * @param {string} text     — raw transcript fragment
 * @param {RegExp} [filter] — regex for characters to REMOVE (from LANGUAGES[x].allowedRange)
 * Returns the cleaned string, or empty string if nothing meaningful remains.
 */
function cleanTranscript(text, filter) {
  if (!text) return ''
  let cleaned = text.replace(/<[^>]+>/g, '')  // Remove <noise>, <unintelligible>, etc.
  if (filter) {
    cleaned = cleaned.replace(filter, '')
  }
  return cleaned
    .replace(/\s+/g, ' ')              // Collapse multiple spaces
    .trim()
}

/**
 * React hook that manages the full lifecycle of a Gemini Live audio session.
 *
 * Returns:
 *   - isConnected  — true once the WebSocket setup handshake is done
 *   - isListening  — true once the mic is wired up and streaming to Gemini
 *   - messages     — array of { role: 'user'|'ai', text } transcript entries
 *   - error        — error string if something went wrong
 *   - start(fuel)  — begin a session (requests mic, opens WS, starts streaming)
 *   - stop()       — tear down everything gracefully
 *   - clearMessages() — reset the transcript log
 */
export default function useGeminiLive(language = 'en') {
  // ---- React state exposed to the UI ----
  const [isConnected, setIsConnected] = useState(false)   // WebSocket handshake done?
  const [isListening, setIsListening] = useState(false)   // Mic is actively streaming?
  const [messages, setMessages] = useState([])             // Chat transcript log
  const [error, setError] = useState(null)                 // Last error message

  // ---- Refs (mutable values that persist across renders without triggering re-render) ----
  const wsRef = useRef(null)              // The WebSocket instance
  const audioContextRef = useRef(null)    // AudioContext for PLAYBACK (24 kHz — matches Gemini output)
  const captureContextRef = useRef(null)  // AudioContext for CAPTURE  (16 kHz — matches Gemini input)
  const workletNodeRef = useRef(null)     // AudioWorkletNode that grabs raw PCM from the mic
  const streamRef = useRef(null)          // MediaStream from getUserMedia (the mic)
  const recognitionRef = useRef(null)     // Browser SpeechRecognition for user transcription

  // ---- Playback scheduling state ----
  // AI audio arrives in small chunks. We pre-schedule them on the Web Audio
  // timeline so they play back-to-back with zero gaps.
  const playbackQueueRef = useRef([])     // Queue of Float32Array audio chunks waiting to play
  const nextPlayTimeRef = useRef(0)       // AudioContext.currentTime when the last scheduled chunk ends
  const scheduledSourcesRef = useRef([])  // Active AudioBufferSourceNodes (for cancellation on barge-in)

  // ---- Transcript accumulators ----
  const currentAiTranscript = useRef('')     // Full accumulated AI text for this turn
  const hasAiMessage = useRef(false)         // Have we pushed an AI message for this turn?
  const aiSpeakingRef = useRef(false)        // Is the AI currently speaking?

  /**
   * Immediately discard all queued audio and stop any playing/scheduled chunks.
   * Called on barge-in (user starts talking over the AI) or cleanup.
   */
  const flushPlayback = useCallback(() => {
    // Stop all pre-scheduled source nodes so they don't keep playing
    scheduledSourcesRef.current.forEach(src => {
      try { src.stop() } catch (e) { /* already stopped */ }
    })
    scheduledSourcesRef.current = []
    playbackQueueRef.current = []
    nextPlayTimeRef.current = 0
  }, [])

  /**
   * Eagerly schedule ALL queued audio chunks onto the Web Audio timeline.
   *
   * Why eager pre-scheduling instead of an onended chain?
   *   The old approach waited for each chunk to finish (via `onended`)
   *   before scheduling the next. But `onended` fires on the main thread
   *   with unpredictable latency — if React is re-rendering or JS is busy,
   *   the callback is delayed, creating audible micro-gaps ("shaky" voice).
   *
   *   By pre-scheduling every chunk immediately when it arrives, the Web Audio
   *   scheduler (which runs on a separate high-priority thread) handles the
   *   precise timing — guaranteeing truly gapless playback.
   *
   * For barge-in, we call `.stop()` on all tracked source nodes in flushPlayback().
   */
  const schedulePlayback = useCallback(() => {
    const ctx = audioContextRef.current
    if (!ctx) return

    // Schedule every chunk in the queue right now
    while (playbackQueueRef.current.length > 0) {
      const float32 = playbackQueueRef.current.shift()

      // Create a 1-channel (mono) AudioBuffer at 24 kHz (Gemini's output sample rate)
      const buffer = ctx.createBuffer(1, float32.length, 24000)
      buffer.getChannelData(0).set(float32)

      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)  // → speakers

      // Schedule precisely: start where the previous chunk ends.
      // If nextPlayTimeRef is in the past (first chunk or after a gap),
      // start from "now" instead.
      const now = ctx.currentTime
      const startTime = Math.max(now, nextPlayTimeRef.current)
      source.start(startTime)
      nextPlayTimeRef.current = startTime + buffer.duration

      // Track the source so flushPlayback() can cancel it on barge-in.
      // When the LAST scheduled source finishes, resume speech recognition
      // (the AI is done talking through the speakers).
      scheduledSourcesRef.current.push(source)
      source.onended = () => {
        const idx = scheduledSourcesRef.current.indexOf(source)
        if (idx !== -1) scheduledSourcesRef.current.splice(idx, 1)

        // When all scheduled audio has finished playing, restart recognition
        if (scheduledSourcesRef.current.length === 0 && aiSpeakingRef.current) {
          aiSpeakingRef.current = false
          if (recognitionRef.current && wsRef.current) {
            try { recognitionRef.current.start() } catch (e) { /* already started */ }
          }
        }
      }
    }
  }, [])

  /**
   * Release all audio resources — mic stream, worklet, both AudioContexts,
   * and any queued playback. Called on stop() and on error.
   */
  const cleanup = useCallback(() => {
    // Stop the mic hardware
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    // Stop browser speech recognition
    if (recognitionRef.current) {
      recognitionRef.current.abort()
      recognitionRef.current = null
    }
    // Disconnect the AudioWorklet that was capturing mic data
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect()
      workletNodeRef.current = null
    }
    // Close the capture AudioContext (mic side)
    if (captureContextRef.current) {
      captureContextRef.current.close().catch(() => {})
      captureContextRef.current = null
    }
    // Close the playback AudioContext (speaker side)
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
    flushPlayback()
  }, [flushPlayback])

  // Resolve the language config once so it's available in stop() and start()
  const langConfig = LANGUAGES[language] || LANGUAGES.en

  /**
   * Gracefully end the session:
   *   1. Close the WebSocket
   *   2. Release mic & audio resources
   *   3. Commit any partially-accumulated transcripts so they aren't lost
   */
  const stop = useCallback(() => {
    const ws = wsRef.current
    wsRef.current = null
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close()
    }

    cleanup()
    setIsConnected(false)
    setIsListening(false)

    // Finalize any in-progress live messages
    // (mark them as complete, clean up noise artifacts)
    setMessages(prev => {
      const updated = [...prev]
      for (let i = updated.length - 1; i >= 0; i--) {
        if (updated[i].live) {
          const clean = cleanTranscript(updated[i].text, langConfig.allowedRange)
          if (clean) {
            updated[i] = { ...updated[i], text: clean, live: false }
          } else {
            updated.splice(i, 1) // Remove empty messages
          }
        }
      }
      return updated
    })
    currentAiTranscript.current = ''
    hasAiMessage.current = false
  }, [cleanup, langConfig])

  /**
   * Start a Gemini Live session. This is the main entry point.
   *
   * Sequence:
   *   1. Request mic permission  (user sees browser dialog)
   *   2. Create two AudioContexts (one for playback, one for capture)
   *   3. Load the AudioWorklet processor that will chunk mic data
   *   4. Open the WebSocket and perform the Gemini setup handshake
   *   5. Wire the mic → AudioWorklet → WebSocket pipeline
   *
   * @param {number} fuelLevel — user's energy level (1-5), injected into the system prompt
   */
  const start = useCallback(async (fuelLevel) => {
    try {
      setError(null)

      if (!API_KEY) {
        setError('Missing VITE_GOOGLE_API_KEY in .env')
        return
      }

      console.log('[GeminiLive] Requesting mic permission...')

      // ── Step 1: Get mic access ────────────────────────────────────────
      // Request mono audio with echo cancellation so the AI's own playback
      // doesn't feed back into the mic.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      })
      streamRef.current = stream
      console.log('[GeminiLive] Mic granted!')

      // ── Step 2: Create AudioContexts ──────────────────────────────────
      // We need TWO separate AudioContexts because they run at different
      // sample rates:
      //   • playbackCtx @ 24 kHz — matches Gemini's output audio format
      //   • captureCtx  @ browser default (usually 44.1 or 48 kHz)
      //     The AudioWorklet inside captureCtx downsamples to 16 kHz PCM
      //     before sending to the server.
      const playbackCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 })
      audioContextRef.current = playbackCtx

      // Capture at 16 kHz directly — matches Gemini's expected input rate.
      // This eliminates manual resampling and sends a continuous stream
      // (no buffering gaps that confuse Gemini's voice activity detection).
      const captureCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 })
      captureContextRef.current = captureCtx

      // ── Step 3: Load AudioWorklet ─────────────────────────────────────
      // Inline worklet: Float32 → Int16 PCM, buffered to 512 samples (~32ms).
      // At 16kHz this sends ~31 messages/sec — avoids flooding the WebSocket
      // (125 msgs/sec with no buffering was likely causing dropped audio).
      const workletCode = `
        class PCMProcessor extends AudioWorkletProcessor {
          constructor() {
            super();
            this._buffer = [];
          }
          process(inputs) {
            const input = inputs[0];
            if (input.length > 0) {
              const float32 = input[0];
              for (let i = 0; i < float32.length; i++) {
                this._buffer.push(
                  Math.max(-32768, Math.min(32767, Math.floor(float32[i] * 32768)))
                );
              }
              while (this._buffer.length >= 512) {
                const chunk = this._buffer.splice(0, 512);
                const int16 = new Int16Array(chunk);
                this.port.postMessage(int16.buffer, [int16.buffer]);
              }
            }
            return true;
          }
        }
        registerProcessor('pcm-processor', PCMProcessor);
      `
      const blob = new Blob([workletCode], { type: 'application/javascript' })
      const workletUrl = URL.createObjectURL(blob)
      await captureCtx.audioWorklet.addModule(workletUrl)
      URL.revokeObjectURL(workletUrl)
      console.log('[GeminiLive] AudioWorklet loaded')

      // ── Step 4: WebSocket setup handshake ───────────────────────────
      // The Gemini Live protocol works in two phases:
      //   Phase A — Setup: client sends a `setup` message, server replies
      //             with `setupComplete`. Only then can audio flow. (handshake)
      //   Phase B — Streaming: both sides exchange audio chunks and
      //             transcription updates continuously.
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      // We wrap the handshake in a Promise so `start()` only continues
      // to step 5 (wiring the mic) after `setupComplete` is received.
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timed out (10s). Check your API key.'))
        }, 10000)

        ws.onopen = () => {
          console.log('[GeminiLive] WebSocket open, sending setup...')

          // ── The Setup Message ──
          // This is the FIRST and ONLY message we send before streaming.
          // It configures the model, voice, system prompt, and behaviour.
          ws.send(JSON.stringify({
            setup: {
              model: MODEL,

              generationConfig: {
                // We only want audio responses (not text)
                responseModalities: ['AUDIO'],
                speechConfig: {
                  voiceConfig: {
                    // TODO: experiment with different voices
                    prebuiltVoiceConfig: { voiceName: 'Kore' } // Gemini voice selection
                  }
                }
              },

              // System prompt — sets the AI's personality and context
              systemInstruction: {
                parts: [{
                  text: `You are a calm, supportive AI companion for someone doing a "brain dump" — speaking their thoughts aloud to clear mental clutter.
The user's current energy level is ${fuelLevel || 'not set'} out of 5.

IMPORTANT: Always respond in ${langConfig.promptLang} only.

## How to Listen
This is a brain dump. The user will ramble, trail off, speak in fragments, jump between topics mid-sentence, and go quiet. This is NORMAL and EXPECTED.

YOUR #1 RULE: Do NOT respond to every pause or fragment. Silence is okay. Let the user keep going.
- If the user says something incomplete like "I need to..." — stay SILENT. They're still thinking.
- If the user pauses for a few seconds — stay SILENT. They're gathering thoughts.
- Only respond when the user has clearly finished a complete thought or group of thoughts.
- When in doubt, wait longer. Extended silence with presence is better than interrupting their flow.

## When You Do Speak
- Be BRIEF. One or two short sentences max.
- Acknowledge what they said, then let them continue.
- Good responses: "Got it.", "I'm tracking all of that.", "Mmhm, keep going."
- If they've dumped several things, briefly reflect back: "So far I've got three things — the email, the groceries, and the guilt about Tuesday. Keep going?"
- Do NOT ask multiple questions. Offer one thought at most.

## If the User Seems Overwhelmed
- Be extra brief. Short sentences. Spacious.
- "I'm here. I've got all of this."
- Do NOT list everything back at them — offer ONE thing at most.
- Let silence be okay.`
                }]
              },

              realtimeInputConfig: {
                automaticActivityDetection: {
                  disabled: false,
                  // Require 1s of silence before ending the user's turn.
                  // Default (~300ms) cuts off mid-sentence. 2000ms is too sluggish.
                  // 1000ms balances natural pauses vs responsiveness.
                  silenceDurationMs: 1000,
                },
                activityHandling: 'START_OF_ACTIVITY_INTERRUPTS'
              },

              // Ask the server to also return text transcriptions alongside audio.
              inputAudioTranscription: {},
              outputAudioTranscription: {}
            }
          }))
        }

        // ── Phase A handler: wait for setupComplete ──
        ws.onmessage = async (event) => {
          const data = await parseWsMessage(event)
          console.log('[GeminiLive] Recv:', Object.keys(data))

          if (data.setupComplete) {
            clearTimeout(timeout)
            console.log('[GeminiLive] Setup complete!')
            setIsConnected(true)

            // ── Phase B handler: streaming audio & transcriptions ──
            // Now that setup is done, replace the onmessage handler with
            // the streaming handler that processes audio and transcriptions.
            //
            // Every incoming message has a `serverContent` wrapper containing
            // one or more of:
            //   • modelTurn.parts[]  — audio chunks (base64 PCM)
            //   • inputTranscription — incremental user speech-to-text
            //   • outputTranscription — incremental AI speech-to-text
            //   • turnComplete       — signals the AI finished its turn
            //   • interrupted        — signals the user interrupted (barge-in)
            ws.onmessage = async (evt) => {
              try {
              const msg = await parseWsMessage(evt)

              if (msg.serverContent) {
                const sc = msg.serverContent

                // ── DEBUG: Log all server content keys ──
                const keys = Object.keys(sc)
                const summary = keys.map(k => {
                  if (k === 'modelTurn') return `modelTurn(${sc.modelTurn?.parts?.length || 0} parts)`
                  if (k === 'inputTranscription') return `inputTranscription("${sc.inputTranscription?.text?.slice(0, 50)}")`
                  if (k === 'outputTranscription') return `outputTranscription("${sc.outputTranscription?.text?.slice(0, 50)}")`
                  return k
                }).join(', ')
                console.log(`[GeminiLive] serverContent: ${summary}`)

                if (sc.interrupted) {
                  console.log('[GeminiLive] ⚡ BARGE-IN detected')
                  flushPlayback()
                  // Mark the current AI message as interrupted and finalize it
                  if (hasAiMessage.current) {
                    setMessages(prev => {
                      const updated = [...prev]
                      for (let i = updated.length - 1; i >= 0; i--) {
                        if (updated[i].role === 'ai' && updated[i].live) {
                          const clean = cleanTranscript(updated[i].text, langConfig.allowedRange)
                          if (clean) {
                            updated[i] = { ...updated[i], text: clean, live: false, interrupted: true }
                          } else {
                            updated.splice(i, 1)
                          }
                          break
                        }
                      }
                      return updated
                    })
                  }
                  aiSpeakingRef.current = false
                  if (recognitionRef.current) {
                    try { recognitionRef.current.start() } catch (e) { /* already started */ }
                  }
                  currentAiTranscript.current = ''
                  hasAiMessage.current = false
                  return
                }

                // ── AI audio chunks ──
                // The server streams the AI's voice as a series of small
                // base64-encoded PCM chunks inside `modelTurn.parts`.
                // We decode each chunk and push it onto the playback queue.
                // Also pause SpeechRecognition so it doesn't pick up speaker output.
                if (sc.modelTurn?.parts) {
                  if (!aiSpeakingRef.current) {
                    console.log('[GeminiLive] 🔊 AI started speaking (first modelTurn)')
                    aiSpeakingRef.current = true
                    if (recognitionRef.current) {
                      try { recognitionRef.current.abort() } catch (e) { /* ignore */ }
                    }
                  }
                  for (const part of sc.modelTurn.parts) {
                    if (part.inlineData?.data) {
                      playbackQueueRef.current.push(decodeBase64PCM(part.inlineData.data))
                      schedulePlayback() // Start playing if not already
                    }
                  }
                }

                // ── AI transcription (from Gemini outputTranscription) ──
                if (sc.outputTranscription?.text) {
                  currentAiTranscript.current += sc.outputTranscription.text
                  const clean = cleanTranscript(currentAiTranscript.current, langConfig.allowedRange)
                  if (clean) {
                    if (!hasAiMessage.current) {
                      hasAiMessage.current = true
                      setMessages(prev => [...prev, { role: 'ai', text: clean, live: true }])
                    } else {
                      setMessages(prev => {
                        const updated = [...prev]
                        for (let i = updated.length - 1; i >= 0; i--) {
                          if (updated[i].role === 'ai' && updated[i].live) {
                            updated[i] = { ...updated[i], text: clean }
                            break
                          }
                        }
                        return updated
                      })
                    }
                  }
                }

                // ── Turn complete ──
                // Finalize the live messages: remove the `live` flag,
                // clean up any remaining noise, and reset accumulators.
                if (sc.turnComplete) {
                  console.log('[GeminiLive] ✅ Turn complete')
                  setMessages(prev => {
                    const updated = [...prev]
                    for (let i = updated.length - 1; i >= 0; i--) {
                      if (updated[i].live) {
                        const clean = cleanTranscript(updated[i].text, langConfig.allowedRange)
                        if (clean) {
                          updated[i] = { ...updated[i], text: clean, live: false }
                        } else {
                          updated.splice(i, 1) // Remove empty/noise-only messages
                        }
                      }
                    }
                    return updated
                  })
                  currentAiTranscript.current = ''
                  hasAiMessage.current = false
                }
              }
              } catch (err) {
                console.error('[GeminiLive] Error processing message:', err)
              }
            }

            resolve()
          }
        }

        ws.onerror = (e) => {
          console.error('[GeminiLive] WebSocket error:', e)
          clearTimeout(timeout)
          reject(new Error('WebSocket connection failed. Check console for details.'))
        }

        ws.onclose = (e) => {
          console.log('[GeminiLive] WebSocket closed:', e.code, e.reason)
          clearTimeout(timeout)
          if (e.code !== 1000) {
            reject(new Error(`WebSocket closed unexpectedly (code ${e.code}): ${e.reason || 'no reason'}`))
          }
          setIsConnected(false)
          setIsListening(false)
        }
      })

      // ── Step 5: Wire mic → AudioWorklet → WebSocket ───────────────
      // This is the "upload" pipeline:
      //   Mic (MediaStream)
      //     → MediaStreamSource (Web Audio node)
      //       → AudioWorkletNode ("audio-capture-processor")
      //         → port.onmessage fires with PCM ArrayBuffer chunks
      //           → base64-encode → wrap in JSON → send over WebSocket
      console.log('[GeminiLive] Wiring mic to WebSocket...')
      const source = captureCtx.createMediaStreamSource(stream)
      const workletNode = new AudioWorkletNode(captureCtx, 'pcm-processor')
      workletNodeRef.current = workletNode

      // The AudioWorklet posts PCM ArrayBuffers on its port.
      // Each message is a small chunk of raw 16 kHz mono PCM audio.
      let audioChunkCount = 0
      workletNode.port.onmessage = (e) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          audioChunkCount++
          // Log every 100th chunk to avoid flooding console (~every 800ms)
          if (audioChunkCount % 100 === 1) {
            console.log(`[GeminiLive] 🎤 Sending audio chunk #${audioChunkCount}, size=${e.data.byteLength} bytes`)
          }
          // Use snake_case field names to match the official Google API format.
          // The API may not reliably parse camelCase for streaming audio input.
          wsRef.current.send(JSON.stringify({
            realtime_input: {
              media_chunks: [{
                data: arrayBufferToBase64(e.data),
                mime_type: 'audio/pcm;rate=16000'
              }]
            }
          }))
        }
      }

      // Connect the audio graph: mic → worklet → (destination is required
      // for the graph to process, even though we don't actually output to speakers)
      source.connect(workletNode)
      workletNode.connect(captureCtx.destination)

      setIsListening(true)
      console.log('[GeminiLive] Live! Listening for speech.')

      // ── Step 6: Start browser SpeechRecognition for user transcription ──
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition()
        recognition.continuous = true         // Keep listening across pauses
        recognition.interimResults = true
        recognition.lang = langConfig.speechLang
        recognitionRef.current = recognition

        let hasLiveUserMsg = false

        recognition.onresult = (event) => {
          // Build full transcript from all results
          let fullText = ''
          for (let i = 0; i < event.results.length; i++) {
            fullText += event.results[i][0].transcript
          }
          fullText = fullText.trim()
          if (!fullText) return

          if (!hasLiveUserMsg) {
            hasLiveUserMsg = true
            setMessages(prev => [...prev, { role: 'user', text: fullText, live: true }])
          } else {
            setMessages(prev => {
              const updated = [...prev]
              for (let i = updated.length - 1; i >= 0; i--) {
                if (updated[i].role === 'user' && updated[i].live) {
                  updated[i] = { ...updated[i], text: fullText }
                  break
                }
              }
              return updated
            })
          }
        }

        recognition.onend = () => {
          // Finalize current user bubble
          if (hasLiveUserMsg) {
            setMessages(prev => {
              const updated = [...prev]
              for (let i = updated.length - 1; i >= 0; i--) {
                if (updated[i].role === 'user' && updated[i].live) {
                  const text = updated[i].text?.trim()
                  if (text) {
                    updated[i] = { ...updated[i], live: false }
                  } else {
                    updated.splice(i, 1)
                  }
                  break
                }
              }
              return updated
            })
            hasLiveUserMsg = false
          }
          // Restart if session is still active and AI is not speaking
          if (recognitionRef.current === recognition && wsRef.current && !aiSpeakingRef.current) {
            try { recognition.start() } catch (e) { /* already started */ }
          }
        }

        recognition.onerror = (e) => {
          if (e.error !== 'no-speech' && e.error !== 'aborted') {
            console.warn('[SpeechRecognition] Error:', e.error)
          }
        }

        try { recognition.start() } catch (e) { /* ignore */ }
        console.log('[GeminiLive] Browser SpeechRecognition started')
      }

    } catch (err) {
      console.error('[GeminiLive] Error:', err)
      setError(err.message || 'Failed to start session')
      cleanup()
      setIsConnected(false)
      setIsListening(false)
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [cleanup, flushPlayback, schedulePlayback, langConfig])

  const clearMessages = useCallback(() => setMessages([]), [])

  return { isConnected, isListening, messages, error, start, stop, clearMessages }
}
