# Brain Dump

> A real-time voice AI companion that turns mental chaos into organized clarity — built for people with ADHD.

**Category:** Live Agents · **Hackathon:** Gemini Live Agent Challenge

---

## The Problem

People with ADHD carry a neurologically distinct kind of mental load. Their working memory is limited and unreliable — thoughts arrive faster than they can be written down, context-switching is constant, and the cognitive friction of opening a task app, typing, and categorizing is often enough to make the whole attempt fail.

The "brain dump" is a well-known ADHD self-management technique: get everything out of your head and into the world. But doing it by typing defeats the purpose. **You need to just speak.**

Traditional voice assistants don't help — they're transactional ("set a timer"), not therapeutic. Typing-based AI chat keeps the friction alive. What's needed is something that listens the way a good ADHD coach would: patiently, without interrupting, without demanding structure, and without making you repeat yourself.

## Why Gemini Live API Is a Perfect Fit

ADHD brains don't communicate in neat turn-based exchanges. They ramble, trail off, restart mid-sentence, and jump between topics. The Gemini Live API is uniquely suited to this because:

- **Truly continuous audio** — no push-to-talk, no waiting for a text box to appear
- **Barge-in support** — the user can interrupt the AI mid-response naturally (a key judging criterion we explicitly engineered using `START_OF_ACTIVITY_INTERRUPTS` + `START_SENSITIVITY_HIGH` VAD)
- **Real-time bidirectional audio** — sub-second latency makes it feel like a real conversation, not a query
- **Streaming transcription** — the user sees their own words appearing as they speak, which helps ADHD users stay on track

The agent is tuned to stay silent during pauses (ADHD users trail off and resume — the agent waits), only speaking when a complete thought has landed, using `END_SENSITIVITY_LOW` so it doesn't prematurely end a turn.

## What It Does

1. **Voice session** — speak freely, the AI listens and categorizes every thought in real time
2. **Brain Board** — thoughts are sorted into Tasks, Ideas, Thoughts, and Emotions as you speak; persisted in Firestore
3. **Stress Reset** — the agent detects overwhelm in the user's speech and triggers a breathing overlay with a calming voice shift
4. **Task Breakdown** — pick any task and the agent breaks it into micro-steps (first 3 must take under 60 seconds each)
5. **Fuel-aware suggestions** — the user sets an energy level (1–5); the agent tailors suggestions to what's actually doable right now
6. **Brain Dispatch** — a scheduled Firebase Cloud Function emails a digest of the board (daily or weekly) so nothing stays lost in an app
7. **Multilingual** — English, Chinese, Spanish, Japanese, French

## Architecture

```
Browser (React + Web Audio API)
        │  16kHz PCM binary frames (WebSocket)
        │  JSON control events
        ▼
FastAPI Backend (Python · ADK)          ──► Firebase Auth (token verification)
        │  google-adk Runner + LiveRequestQueue
        ▼
Gemini Live API (gemini-2.5-flash-native-audio-preview)
        │  event stream: audio · transcription · interrupted · turn_complete
        ▼
ADK Tools (server-side)
  ├─ categorize_thought  ──► Firestore  (items collection)
  ├─ suggest_tasks
  ├─ break_down_task
  └─ activate_stress_reset

Firebase Cloud Functions (Node.js · Scheduled)
  └─ sendBrainDispatch  ──► Firestore → Resend email API  (hourly cron)
```

## Google Cloud Services

| Service | Role |
|---|---|
| **Gemini Live API** (via ADK) | Real-time bidirectional audio + transcription |
| **Firebase Authentication** | Google OAuth; ID token verified server-side on every WebSocket connect |
| **Firestore** | Brain board item persistence; user preferences |
| **Firebase Cloud Functions** | Scheduled hourly digest email (`sendBrainDispatch`) + unsubscribe HTTP endpoint |

## Technical Highlights

- **Barge-in** — explicitly configured with `RealtimeInputConfig(activity_handling=START_OF_ACTIVITY_INTERRUPTS, start_of_speech_sensitivity=START_SENSITIVITY_HIGH)`. The frontend sends continuous PCM even during AI playback so the ADK VAD can detect interruptions in real time.
- **Audio pipeline** — two AudioContexts (16kHz capture via AudioWorklet → WebSocket; 24kHz playback with gapless buffer scheduling). A silent GainNode (gain=0) replaced the direct destination connection to eliminate echo cancellation feedback loops.
- **Streaming transcription** — incremental deltas accumulated client-side; final `finished=true` event replaces (not appends to) the accumulator to prevent doubling.
- **ADK tool events** — tool results are intercepted via `after_tool_callback` and forwarded to the frontend as typed JSON events (`categorize`, `stress_reset`, `task_steps`, `suggestions`).

## Local Setup

### Prerequisites

- Node.js 18+
- Python 3.11+
- A Google Cloud project with Gemini API enabled
- Firebase project (Auth + Firestore enabled)

### 1. Clone and install

```bash
git clone <repo-url>
cd mental-dump
npm install
pip install -r backend/requirements.txt
```

### 2. Environment variables

Create `.env` in the project root:

```env
VITE_GOOGLE_API_KEY=your_gemini_api_key
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

For Firebase Admin (backend token verification), either place `service-account-key.json` in the project root or set `FIREBASE_PROJECT_ID` and configure Application Default Credentials.

### 3. Run locally

```bash
npm start
# Starts FastAPI backend on :8000 and Vite dev server on :5173 concurrently
```

Open `http://localhost:5173`. Sign in with Google, set your energy level, and press the mic button.

### 4. Deploy backend to Cloud Run

```bash
gcloud run deploy brain-dump-backend \
  --source ./backend \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GOOGLE_API_KEY=...,FIREBASE_PROJECT_ID=...
```

### 5. Deploy Cloud Functions

```bash
cd functions
npm install
firebase deploy --only functions
```

## Third-Party Integrations

- **Google ADK** (`google-adk`) — agent runtime and Gemini Live proxy
- **Firebase** (Auth, Firestore, Cloud Functions) — Google Cloud platform services
- **Resend** — transactional email delivery for Brain Dispatch digests
- **`@react-email/render`** — HTML email template rendering
- **`concurrently`** — local dev only
