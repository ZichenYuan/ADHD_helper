import { useRef, useState, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'

/*
 * ==========================================================================
 *  useVoiceSession — React hook for audio chat via the ADK backend.
 *
 *  Unlike useGeminiLive (direct browser → Gemini WebSocket), this connects
 *  to our FastAPI backend which proxies through ADK. The backend handles
 *  tool execution, so we receive typed JSON events for categorization,
 *  stress resets, task steps, etc.
 *
 *  HIGH-LEVEL FLOW:
 *  ┌──────────┐  raw PCM audio (binary)  ┌──────────┐  ADK   ┌─────────┐
 *  │ Browser  │ ──────────────────────►  │ Backend  │ ─────► │ Gemini  │
 *  │ (client) │ ◄────────────────────── │ (FastAPI) │ ◄───── │  Live   │
 *  └──────────┘  audio + JSON events     └──────────┘        └─────────┘
 * ==========================================================================
 */

// When using Vite's proxy, connect to the same host as the page.
// In production, this would be the actual backend URL.
const WS_URL = import.meta.env.VITE_BACKEND_WS ||
  `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`

/**
 * Language configuration — must match backend LANGUAGES.
 * speechLang is for browser SpeechRecognition (user transcription).
 * allowedRange regex filters out wrong-script characters from transcription.
 */
export const LANGUAGES = {
  en: {
    label: 'English',
    speechLang: 'en-US',
    allowedRange: /[^\x20-\x7E\u00C0-\u024F]/g,
  },
  zh: {
    label: '中文',
    speechLang: 'zh-CN',
    allowedRange: /[^\x20-\x7E\u00C0-\u024F\u4E00-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/g,
  },
  es: {
    label: 'Español',
    speechLang: 'es-ES',
    allowedRange: /[^\x20-\x7E\u00C0-\u024F]/g,
  },
  ja: {
    label: '日本語',
    speechLang: 'ja-JP',
    allowedRange: /[^\x20-\x7E\u3000-\u303F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uFF00-\uFFEF]/g,
  },
  fr: {
    label: 'Français',
    speechLang: 'fr-FR',
    allowedRange: /[^\x20-\x7E\u00C0-\u024F]/g,
  },
}

/**
 * Strip transcription artifacts and wrong-script text.
 */
function cleanTranscript(text, filter) {
  if (!text) return ''
  let cleaned = text.replace(/<[^>]+>/g, '')
  if (filter) cleaned = cleaned.replace(filter, '')
  return cleaned.replace(/\s+/g, ' ').trim()
}

/**
 * React hook for a voice session via the ADK backend.
 *
 * Returns:
 *   - isConnected  — backend WebSocket open and session started
 *   - isListening  — mic is actively streaming audio
 *   - messages     — chat transcript [{role, text, live?, interrupted?}]
 *   - error        — last error message
 *   - start(fuel)  — begin session
 *   - stop()       — end session
 *   - clearMessages()
 *   - onToolEvent  — register callback for tool events (categorize, stress_reset, etc.)
 */
export default function useVoiceSession(language = 'en') {
  const { getIdToken } = useAuth()
  const [isConnected, setIsConnected] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [messages, setMessages] = useState([])
  const [error, setError] = useState(null)

  // Refs
  const wsRef = useRef(null)
  const audioContextRef = useRef(null)          // Playback @ 24kHz
  const captureContextRef = useRef(null)        // Capture @ 16kHz
  const workletNodeRef = useRef(null)
  const streamRef = useRef(null)                // MediaStream (mic)
  const recognitionRef = useRef(null)           // Browser SpeechRecognition

  // Playback scheduling (same gapless approach as useGeminiLive)
  const playbackQueueRef = useRef([])
  const nextPlayTimeRef = useRef(0)
  const scheduledSourcesRef = useRef([])

  // Transcript accumulators
  const currentAiTranscript = useRef('')
  const hasAiMessage = useRef(false)
  const aiSpeakingRef = useRef(false)

  // Tool event callback
  const toolEventCallbackRef = useRef(null)

  const langConfig = LANGUAGES[language] || LANGUAGES.en

  // ── Playback helpers (identical to useGeminiLive) ──

  const flushPlayback = useCallback(() => {
    scheduledSourcesRef.current.forEach(src => {
      try { src.stop() } catch (e) { /* already stopped */ }
    })
    scheduledSourcesRef.current = []
    playbackQueueRef.current = []
    nextPlayTimeRef.current = 0
  }, [])

  const schedulePlayback = useCallback(() => {
    const ctx = audioContextRef.current
    if (!ctx) return
    while (playbackQueueRef.current.length > 0) {
      const float32 = playbackQueueRef.current.shift()
      const buffer = ctx.createBuffer(1, float32.length, 24000)
      buffer.getChannelData(0).set(float32)
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)
      const now = ctx.currentTime
      const startTime = Math.max(now, nextPlayTimeRef.current)
      source.start(startTime)
      nextPlayTimeRef.current = startTime + buffer.duration
      scheduledSourcesRef.current.push(source)
      source.onended = () => {
        const idx = scheduledSourcesRef.current.indexOf(source)
        if (idx !== -1) scheduledSourcesRef.current.splice(idx, 1)
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
   * Decode raw PCM bytes (16-bit signed, 24kHz) from the backend
   * into a Float32Array for Web Audio playback.
   */
  function decodePCMBytes(arrayBuffer) {
    const int16 = new Int16Array(arrayBuffer)
    const float32 = new Float32Array(int16.length)
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 0x8000
    }
    return float32
  }

  // ── Cleanup ──

  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (recognitionRef.current) {
      recognitionRef.current.abort()
      recognitionRef.current = null
    }
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect()
      workletNodeRef.current = null
    }
    if (captureContextRef.current) {
      captureContextRef.current.close().catch(() => {})
      captureContextRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
    flushPlayback()
  }, [flushPlayback])

  // ── Stop ──

  const stop = useCallback(() => {
    // Tell backend to end the session
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'stop' }))
      ws.close()
    }
    wsRef.current = null

    cleanup()
    setIsConnected(false)
    setIsListening(false)

    // Finalize live messages
    setMessages(prev => {
      const updated = [...prev]
      for (let i = updated.length - 1; i >= 0; i--) {
        if (updated[i].live) {
          const clean = cleanTranscript(updated[i].text, langConfig.allowedRange)
          if (clean) {
            updated[i] = { ...updated[i], text: clean, live: false }
          } else {
            updated.splice(i, 1)
          }
        }
      }
      return updated
    })
    currentAiTranscript.current = ''
    hasAiMessage.current = false
  }, [cleanup, langConfig])

  // ── Start ──

  const start = useCallback(async (fuelLevel) => {
    try {
      setError(null)

      // Step 1: Mic access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      streamRef.current = stream

      // Step 2: AudioContexts
      const playbackCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 })
      audioContextRef.current = playbackCtx

      const captureCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 })
      captureContextRef.current = captureCtx

      // Step 3: AudioWorklet (inline, 512-sample buffer)
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

      // Step 4: Connect to backend WebSocket
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Backend connection timed out (10s).'))
        }, 10000)

        ws.onopen = async () => {
          // Send start message with session config + auth token
          let token = null
          try {
            token = await getIdToken()
          } catch (_) { /* anonymous fallback */ }
          ws.send(JSON.stringify({
            type: 'start',
            fuel_level: fuelLevel,
            language: language,
            token,
          }))
        }

        ws.onmessage = (event) => {
          // Wait for the "connected" ack from backend
          if (typeof event.data === 'string') {
            try {
              const msg = JSON.parse(event.data)
              if (msg.type === 'connected') {
                clearTimeout(timeout)
                setIsConnected(true)

                // Now install the streaming message handler
                ws.onmessage = handleMessage
                resolve()
                return
              }
              if (msg.type === 'error') {
                clearTimeout(timeout)
                reject(new Error(msg.message))
                return
              }
            } catch (e) { /* not JSON, ignore */ }
          }
        }

        ws.onerror = () => {
          clearTimeout(timeout)
          reject(new Error('WebSocket connection to backend failed.'))
        }

        ws.onclose = (e) => {
          clearTimeout(timeout)
          if (e.code !== 1000) {
            reject(new Error(`Backend WebSocket closed (code ${e.code}): ${e.reason || 'unknown'}`))
          }
        }
      })

      // Step 5: Wire mic → worklet → WebSocket (binary frames)
      const source = captureCtx.createMediaStreamSource(stream)
      const workletNode = new AudioWorkletNode(captureCtx, 'pcm-processor')
      workletNodeRef.current = workletNode

      workletNode.port.onmessage = (e) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          // Send raw binary PCM — NOT base64 JSON
          wsRef.current.send(e.data)
        }
      }

      source.connect(workletNode)
      workletNode.connect(captureCtx.destination)

      setIsListening(true)

      // Step 6: Browser SpeechRecognition for user transcription
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = langConfig.speechLang
        recognitionRef.current = recognition

        let hasLiveUserMsg = false

        recognition.onresult = (event) => {
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
      }

    } catch (err) {
      console.error('[VoiceSession] Error:', err)
      setError(err.message || 'Failed to start session')
      cleanup()
      setIsConnected(false)
      setIsListening(false)
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [cleanup, flushPlayback, schedulePlayback, langConfig, language])

  // ── Streaming message handler (installed after "connected" ack) ──

  function handleMessage(event) {
    // Binary frame = AI audio
    if (event.data instanceof Blob) {
      event.data.arrayBuffer().then(buffer => {
        if (!aiSpeakingRef.current) {
          aiSpeakingRef.current = true
          if (recognitionRef.current) {
            try { recognitionRef.current.abort() } catch (e) { /* ignore */ }
          }
        }
        playbackQueueRef.current.push(decodePCMBytes(buffer))
        schedulePlayback()
      })
      return
    }

    // ArrayBuffer = AI audio (some browsers)
    if (event.data instanceof ArrayBuffer) {
      if (!aiSpeakingRef.current) {
        aiSpeakingRef.current = true
        if (recognitionRef.current) {
          try { recognitionRef.current.abort() } catch (e) { /* ignore */ }
        }
      }
      playbackQueueRef.current.push(decodePCMBytes(event.data))
      schedulePlayback()
      return
    }

    // Text frame = JSON event
    try {
      const msg = JSON.parse(event.data)

      switch (msg.type) {
        case 'transcription':
          if (msg.role === 'ai') {
            if (msg.finished) {
              currentAiTranscript.current = msg.text
            } else {
              currentAiTranscript.current += msg.text
            }
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
          // User transcription from backend (we prefer browser SpeechRecognition
          // but this is a fallback)
          break

        case 'interrupted':
          flushPlayback()
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
          break

        case 'turn_complete':
          setMessages(prev => {
            const updated = [...prev]
            for (let i = updated.length - 1; i >= 0; i--) {
              if (updated[i].live) {
                const clean = cleanTranscript(updated[i].text, langConfig.allowedRange)
                if (clean) {
                  updated[i] = { ...updated[i], text: clean, live: false }
                } else {
                  updated.splice(i, 1)
                }
              }
            }
            return updated
          })
          currentAiTranscript.current = ''
          hasAiMessage.current = false
          break

        // Tool events — forward to the callback
        case 'categorize':
        case 'stress_reset':
        case 'task_steps':
        case 'suggestions':
          if (toolEventCallbackRef.current) {
            toolEventCallbackRef.current(msg)
          }
          break

        case 'error':
          setError(msg.message)
          break
      }
    } catch (e) {
      console.warn('[VoiceSession] Failed to parse message:', e)
    }
  }

  const clearMessages = useCallback(() => setMessages([]), [])

  /**
   * Register a callback for tool events from the backend.
   * The callback receives the full event object, e.g.:
   *   { type: "categorize", category: "task", text: "Email the boss" }
   *   { type: "stress_reset" }
   *   { type: "task_steps", task: "...", steps: [...] }
   *   { type: "suggestions", fuel_level: 3, guidance: "..." }
   */
  const onToolEvent = useCallback((callback) => {
    toolEventCallbackRef.current = callback
  }, [])

  return {
    isConnected,
    isListening,
    messages,
    error,
    start,
    stop,
    clearMessages,
    onToolEvent,
  }
}
