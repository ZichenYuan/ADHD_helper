# Brain Dump — ADK Backend Design

## Context for Future Sessions

This document contains everything needed to implement the ADK backend for Brain Dump. Read this BEFORE touching any code.

### What Brain Dump Is
An ADHD-friendly voice companion app. Users speak their thoughts aloud ("brain dump"), the AI listens, categorizes thoughts into sticky notes, suggests energy-appropriate tasks, and detects stress to trigger calming exercises.

### Current State (What Works)
- React + Vite frontend with full voice chat via direct browser → Gemini Live WebSocket
- Audio capture: 16kHz AudioContext, inline PCM worklet (512-sample buffer = 1024 bytes/chunk)
- Audio playback: 24kHz Web Audio API with pre-scheduled gapless playback
- Transcription: Browser SpeechRecognition for user text, Gemini outputTranscription for AI text
- Post-session categorization via Gemini Flash REST API (sends transcript, gets JSON back)
- UI: PulseButton, FuelGauge (1-5 energy), ChatLog, BrainBoard (4 sticky notes), LanguageSelector, BackgroundBlobs

### Why ADK
The direct WebSocket connection cannot do real-time tool calling during audio sessions. ADK enables:
- AI calls `categorize_thought()` DURING conversation → sticky notes update live
- AI calls `activate_stress_reset()` when it hears stress → breathe animation triggers
- AI calls `break_down_task()` → interactive micro-steps appear
- Server-side persistence (Firebase) for login, history, cross-session context

---

## Architecture

```
┌─────────────────┐         ┌──────────────────────┐         ┌─────────────┐
│  React Frontend  │ ◄─────► │   Python Backend      │ ◄─────► │ Gemini Live  │
│  (unchanged UI)  │   WS    │   (FastAPI + ADK)     │   ADK   │ (audio+tools)│
└─────────────────┘         └──────────────────────┘         └─────────────┘
```

- **Frontend → Backend**: WebSocket — raw binary audio frames (up), JSON events + binary audio (down)
- **Backend → Gemini**: ADK manages the connection, audio streaming, tool execution, turn-taking
- **Reference implementation**: `/Users/zichenyuan/Desktop/sideproj/mental-dump/.worktrees/implement-plan/backend/main.py`

---

## Agent Design: Single Agent with State-Aware Persona

One agent ("Companion"). NOT multi-agent. Brain dump's states (listening → organizing → coaching → calming) are phases of ONE conversation, not parallel workstreams. Multi-agent adds routing complexity for no benefit.

### System Prompt

The current system prompt (in `useGeminiLive.js` lines 490-515) should be carried over. Key elements:
- Brain dump companion persona — calm, supportive, brief
- Fuel level context injection (`fuelLevel` passed at session start)
- Language instruction (`langConfig.promptLang`)
- **New**: Tool usage instructions telling the AI when to call each tool
- **Key rule**: "Do NOT respond to every pause or fragment. Let the user keep going."

### Agent States (inferred by AI, not hard-coded)
- **Listening** — User is dumping. AI mostly silent, calls `categorize_thought` as it identifies items.
- **Organizing** — User paused or asked for summary. AI reflects back captured items.
- **Coaching** — User picked a task. AI calls `break_down_task`, walks through steps.
- **Calming** — Stress detected. AI calls `activate_stress_reset`, shifts to slow/warm tone.

---

## Tools

```python
# ── Real-time categorization (replaces post-session REST call) ──
@tool
def categorize_thought(category: str, text: str) -> str:
    """Sort a user's thought into a bucket during conversation.
    category: "task" | "idea" | "thought" | "emotion"
    text: concise one-sentence summary of what the user said
    → Sends {"type": "categorize", "category": "...", "text": "..."} to frontend"""

# ── Energy-matched suggestions ──
@tool
def suggest_tasks(fuel_level: int) -> str:
    """Suggest tasks based on energy level.
    1=survival (1 tiny task), 3=cruising (2-3 medium), 5=hyperfocus (big boss).
    Uses in-memory session data (Phase 1) or Firebase query (Phase 2).
    → Sends {"type": "suggestions", "tasks": [...]} to frontend"""

# ── Micro-deconstruction ──
@tool
def break_down_task(task: str) -> str:
    """Break a task into stupidly small micro-steps.
    First 3 steps must take <60 seconds each.
    → Sends {"type": "task_steps", "task": "...", "steps": [...]} to frontend"""

# ── Stress detection trigger ──
@tool
def activate_stress_reset() -> str:
    """Called when AI detects stress markers in voice (pitch, speed, volume).
    → Sends {"type": "stress_reset"} to frontend
    → Frontend shows breathe animation, dims other UI"""

# ── Phase 2 only (persistence) ──
@tool
def save_thought(category: str, text: str) -> str:
    """Persist categorized thought to Firebase Firestore."""

@tool
def get_user_context() -> str:
    """Retrieve recent sessions, pending tasks, patterns from Firebase.
    Called at session start for cross-session continuity."""
```

---

## WebSocket Protocol (Frontend ↔ Backend)

### Frontend → Backend

| Type | Format | Description |
|------|--------|-------------|
| Audio | Binary frame | Raw 16-bit PCM at 16kHz (1024 bytes/chunk, ~31 chunks/sec) |
| Start | `{"type": "start", "fuel_level": 3, "language": "en"}` | Begin session |
| Stop | `{"type": "stop"}` | End session |

Phase 2 adds `"token": "..."` to the start message for Firebase auth.

### Backend → Frontend

| Type | Format | Description |
|------|--------|-------------|
| Audio | Binary frame | AI voice — raw 24kHz 16-bit PCM |
| Transcription | `{"type": "transcription", "role": "user"\|"ai", "text": "...", "finished": bool}` | Live transcript updates |
| Categorize | `{"type": "categorize", "category": "task", "text": "Email the boss"}` | Real-time sticky note update |
| Stress Reset | `{"type": "stress_reset"}` | Trigger breathe animation |
| Task Steps | `{"type": "task_steps", "task": "...", "steps": ["...", "..."]}` | Micro-deconstruction |
| Suggestions | `{"type": "suggestions", "tasks": [...]}` | Energy-matched suggestions |
| Turn Complete | `{"type": "turn_complete"}` | AI finished speaking |
| Interrupted | `{"type": "interrupted"}` | Barge-in detected |

---

## Critical Config (Hard-Won Through Debugging)

These settings MUST be preserved. Each was discovered through painful debugging:

```python
# ADK RunConfig equivalent
RunConfig(
    response_modalities=["AUDIO"],
    speech_config=SpeechConfig(
        voice_config=VoiceConfig(
            prebuilt_voice_config=PrebuiltVoiceConfig(voice_name="Kore")
        )
    ),
    realtime_input_config=RealtimeInputConfig(
        automatic_activity_detection=AutomaticActivityDetection(
            disabled=False,
            # CRITICAL: Without this, Gemini cuts off after ~300ms of silence,
            # fragmenting user speech into tiny phrases like "I need" / "to book".
            # 1000ms lets users pause naturally mid-sentence.
            # 2000ms works but feels sluggish.
            silence_duration_ms=1000,
        ),
        # Allows user to interrupt (barge-in) the AI mid-speech.
        activity_handling="START_OF_ACTIVITY_INTERRUPTS",
    ),
    input_audio_transcription=AudioTranscriptionConfig(),
    output_audio_transcription=AudioTranscriptionConfig(),
)
```

### Other Lessons Learned
- **Model**: `models/gemini-2.5-flash-native-audio-preview-12-2025` — discovered via API listing, other model names fail
- **Audio input format**: `audio/pcm;rate=16000` — 16kHz 16-bit PCM, little-endian
- **Audio output format**: 24kHz 16-bit PCM from Gemini
- **WebSocket messages from Gemini arrive as Blob in browser** — must use `.text()` then `JSON.parse()`, not direct `JSON.parse(event.data)`
- **snake_case for audio input messages**: `realtime_input` / `media_chunks` / `mime_type` (matching official Google examples)
- **camelCase for server responses**: `serverContent` / `modelTurn` / `turnComplete` (that's how Gemini sends them)
- **Barge-in**: Server sends `interrupted: true` in `serverContent` — must flush playback queue immediately
- **Playback**: Pre-schedule all audio chunks on Web Audio timeline for gapless playback. Using `onended` chains causes micro-gaps.

---

## Implementation Plan

### Phase 1: Backend + All Tools (No Database)

Everything works in-memory for the session. No login, no persistence.

**Step 1: Backend skeleton**
```
backend/
  main.py          # FastAPI app + WebSocket endpoint
  agents/
    companion.py   # Single agent definition + system prompt
  tools/
    categorize.py  # categorize_thought
    tasks.py       # suggest_tasks, break_down_task
    stress.py      # activate_stress_reset
  requirements.txt # fastapi, uvicorn, google-genai, google-adk
```

Reference mental-dump backend at:
`/Users/zichenyuan/Desktop/sideproj/mental-dump/.worktrees/implement-plan/backend/main.py`

Key pattern from mental-dump:
```python
async with agent_module.create_session(agent, run_config) as session:
    live_queue = session.create_live_request_queue()

    async for event in session.live(live_queue):
        # event.server_content.model_turn.parts → audio
        # event.server_content.input_transcription → user text
        # event.server_content.output_transcription → AI text
        # event.interrupted → barge-in
        # event.turn_complete → AI done
        # event.actions → tool calls (THIS IS NEW vs direct WebSocket)
```

**Step 2: Frontend migration**
- Replace `useGeminiLive.js` with `useVoiceSession.js` that connects to `ws://localhost:8000/ws`
- Send raw binary audio frames (NOT base64 JSON) — backend receives as bytes
- Receive JSON events for transcription, categorize, etc.
- Remove `src/utils/categorize.js` (post-session API call) — replaced by real-time tool
- Update `App.jsx`:
  - Remove post-session categorization logic from `handleToggle`
  - Listen for `categorize` events from WebSocket to update BrainBoard in real-time
  - Listen for `stress_reset` events to trigger breathe animation (Milestone 4)
  - Listen for `task_steps` events to show micro-steps UI

**Step 3: New frontend features**
- Breathe animation component (for `activate_stress_reset`)
- Task micro-steps checklist component (for `break_down_task`)

### Phase 2: Firebase Auth + Persistence

**Step 4: Firebase setup**
- Firebase project + Firestore + Auth (Google OAuth)
- Frontend: `firebase` npm package, login UI, auth token passed in `start` message
- Backend: `firebase-admin` for token verification + Firestore access

**Step 5: Persistence tools**
- `save_thought` writes to Firestore on each `categorize_thought` call
- `get_user_context` reads history at session start
- `suggest_tasks` queries Firestore for uncompleted tasks

**Firestore schema:**
```
users/{uid}
  email, name, createdAt

sessions/{sessionId}
  userId, fuelLevel, language, startedAt, endedAt

//TODO
```

---

## What Stays the Same

- All React components (PulseButton, FuelGauge, ChatLog, BrainBoard, BackgroundBlobs, LanguageSelector)
- All CSS (App.css, index.css)
- Audio playback logic (24kHz Web Audio scheduling, gapless pre-scheduling)
- Audio capture logic (16kHz AudioContext, inline PCM worklet, 512-sample buffer)
- UI layout and aesthetic ("soft watercolor garden" — Fraunces + DM Sans, earth/pastel palette)
- The only change: WebSocket URL points to backend instead of Gemini directly, and messages switch from base64 JSON to binary audio + JSON events

---

## Current File Map

```
brain-dump/
  .env                          # VITE_GOOGLE_API_KEY (Gemini API key)
  package.json                  # React 18 + Vite 5
  plan.md                       # Product milestones (1-4)
  ADK.md                        # This file
  public/
    audio-processor.js          # OLD AudioWorklet (48kHz, unused — kept for reference)
  src/
    App.jsx                     # Main app — layout, state, session toggle, categorization
    App.css                     # All styles (layout, blobs, fuel, pulse, chat, brain board, responsive)
    index.css                   # CSS variables (palette, fonts, spacing)
    components/
      BackgroundBlobs.jsx       # SVG blobs + floating decorations
      BrainBoard.jsx            # 4 sticky notes (tasks, ideas, thoughts, emotions)
      ChatLog.jsx               # Scrolling chat bubbles (user lavender, AI sage)
      FuelGauge.jsx             # 5 pebble energy selector
      LanguageSelector.jsx      # Corner globe icon + popover dropdown
      PulseButton.jsx           # Central mic button (3 states: idle, connecting, listening)
    hooks/
      useGeminiLive.js          # Core voice hook — WebSocket, mic, playback, transcription
    utils/
      categorize.js             # Post-session categorization via Gemini Flash REST API
```

## Languages Supported

Defined in `useGeminiLive.js` LANGUAGES export:
- English (en-US), 中文 (zh-CN), Español (es-ES), 日本語 (ja-JP), Français (fr-FR)
- Each has: label, speechLang (for SpeechRecognition), promptLang (for system prompt), allowedRange (regex filter)
