# Mind Space: ADHD Cognitive Companion — Design Document

**Date:** 2026-03-03
**Status:** Approved
**Hackathon:** Google Live Agents Track (Deadline: March 16, 2026)

## North Star

"An AI that understands your ADHD brain — not just your to-do list."

**North star metric:** 30 seconds from anxious voice to feeling relief — with a Calendar event as proof.

## Core Concept

The product repositions from productivity tool to cognitive companion. The differentiator: every other AI assistant waits for you to organize your thoughts before helping. This one listens while you're disorganized and intervenes in real-time — because that's when ADHD brains need help most.

The primary output is relief. Google Calendar events and Tasks are created as side effects — evidence that your brain has been heard and acted on.

## Smart Gemini Live Usage

### 1. Real-time ADHD State Detection

The model analyzes voice signals in real-time:
- **Speech rate** (accelerating = spiral/anxiety)
- **Fragmentation** (half-sentences, trailing off = overwhelm)
- **Repetition** (looping back to the same topic = stuck/paralysis)
- **Sudden topic jumps** (tangent = scatter)

The system classifies the session into one of four states: **Spiral**, **Overwhelm**, **Paralysis**, or **Hyperfocus-drift**.

### 2. Real-Time Function Calling (Concurrent Reasoning)

The Witness doesn't passively listen — it calls tools while the user is still talking:
- Hears "dentist tomorrow" → immediately queries Google Calendar to check conflicts
- Hears "email Sarah" → looks up Google Contacts to resolve which Sarah
- Hears "that project deadline" → checks Google Tasks for existing items

When it reflects back at a pause, it brings real context: "I've got three things, and your calendar tomorrow is full after 2pm — the dentist might need to go in the morning."

This is what distinguishes a real agent from a transcription wrapper: **concurrent reasoning + tool use + conversation**.

### 3. Interruption Handling (Conversation Stack)

Barge-in at the API level is table stakes. The agent maintains a **conversation stack** with interrupt classification:

- **Tangent** ("oh wait, the dentist!") → Push current topic to stack, follow the user. Later: "We were also talking about the project deadline — want to come back to that?"
- **Correction** ("no wait, I meant Tuesday not tomorrow") → Update the existing thread in-place, don't create a new one
- **State shift** (user suddenly speeds up, voice tightens) → Switch response strategy mid-conversation, acknowledge the shift

The stack is visible to The Handler. Interrupted-but-unresolved threads get distinct visual treatment in the sticky-note UI.

Core promise: **the agent never loses a thread**. The AI holds what the ADHD brain can't.

### 4. State-Aware Response Generation

Response strategy changes based on detected state:
- **Spiral / anxiety** — ground first ("I hear you — let's slow down"), then organize
- **Paralysis** — shrink the task ("What's the one smallest thing?"), offer a micro-action
- **Overwhelm** — go silent, capture everything, triage afterward
- **Hyperfocus drift** — gentle redirect ("You mentioned the deadline was urgent — want to start there?")

### 5. Vision Input

Users can show the camera a messy whiteboard, sticky notes, or a calendar screenshot. The Witness agent "sees" it alongside hearing the voice dump. Checks the Audio/Vision hackathon requirement and fits ADHD users who think visually.

## Agent Persona

### Tone
Warm, grounded, slightly informal. Like a calm friend who's genuinely good at listening — not a therapist, not a productivity coach, not Siri.

### Core Speech Principles
- Uses "we" not "you should" — collaborative, never prescriptive
- Mirrors the user's energy — if they're fast, it stays brief; if they're slow, it gives space
- Never uses productivity jargon ("optimize," "workflow," "action items")
- Never says "I understand how you feel"

### State-Adaptive Voice

| State | Voice Style | Example |
|-------|-------------|---------|
| **Overwhelm** | Short. Spacious. Holding. | "I'm here. I've got all of this. You don't need to hold it right now." |
| **Spiral** | Grounding. Naming. Slowing down. | "Let's pause. I heard three things. Want me to name them?" |
| **Paralysis** | Gentle momentum. Shrinking. | "What's the tiniest version of this? Like, the 2-minute version?" |
| **Calm** | Collaborative. Slightly playful. | "Okay, you've got a solid plan forming here. Want to lock it in?" |

### Anti-Patterns (Never Do)
- Don't be cheerful when the user is anxious
- Don't list five things when the user is overwhelmed — offer one
- Don't use exclamation marks during spiral states
- Don't explain what ADHD is — the user knows

## Two-Agent Architecture

### Agent 1: The Witness

Lives inside the Gemini Live session. A true agent — simultaneously holds the conversation, reasons about ADHD state, and calls tools in real-time.

**Capabilities:**
- Transcribes and tracks multiple thought threads via a conversation stack
- Classifies interrupts in real-time (tangent, correction, state shift)
- Calls Google Calendar, Tasks, and Contacts APIs concurrently with conversation
- Maintains a continuously-updated session state:

```json
{
  "adhd_state": "overwhelm",
  "confidence": 0.87,
  "conversation_stack": [
    {"thread": "project deadline", "status": "active", "mentions": 3},
    {"thread": "email Sarah", "status": "interrupted", "mentions": 1},
    {"thread": "dentist appt", "status": "resolved_context", "mentions": 1,
     "context": "calendar shows 2pm-4pm booked tomorrow"}
  ],
  "emotional_urgency": "high",
  "time_sensitive_items": ["dentist appt - mentions 'tomorrow'"],
  "stuck_points": ["project deadline - mentioned 3x, no action formed"],
  "visual_context": ["photo of whiteboard with 5 items"]
}
```

**When The Witness speaks:**
- User goes silent for 3+ seconds — reflects back with gathered context: "I've got three things. Your calendar tomorrow is packed after 2, so the dentist might need morning. Want me to keep going or start sorting?"
- Detects a state shift (calm → spiraling) — switches persona voice, intervenes with state-appropriate technique
- Surfaces unresolved threads from the conversation stack: "We were also talking about Sarah — want to come back to that?"
- User explicitly asks

### Agent 2: The Handler

Triggered when user says "okay sort this" or accepts the pause prompt. Receives the session state from The Witness and:
1. Applies the state-appropriate response strategy using the persona voice
2. Generates a sticky-note visualization in the UI (each thread = a card; unresolved threads marked distinctly)
3. Waits for one-click user approval
4. Creates Google Calendar events and Google Tasks

### Data Flow

```
                    ┌─── Google Calendar API (check conflicts)
                    ├─── Google Tasks API (check existing)
                    ├─── Google Contacts (resolve names)
                    │
User Voice/Vision ──┤
                    │
                    └─── Gemini Live (The Witness)
                              │
                              ├── Conversation Stack (threads + interrupt classification)
                              ├── ADHD State Detection (spiral/overwhelm/paralysis/drift)
                              ├── Real-time tool calls (concurrent with conversation)
                              │
                              └── Session State Object
                                       │
                              State-Aware Persona Response
                                       │
                              Sticky Note Review UI
                              (unresolved threads marked distinctly)
                                       │
                              User One-Click Approval
                                       │
                              The Handler -> Google Calendar + Tasks
```

### Agent Framework: ADK

Google's Agent Development Kit, not LangChain. ADK is Google-native, designed for multi-agent orchestration on Cloud Run, and aligns with hackathon requirements.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | HTML/CSS/JS (existing) + WebSocket client for Gemini Live |
| Backend | Python + FastAPI |
| AI/Agents | Gemini Live API via ADK |
| Cloud | Google Cloud Run |
| Auth | Firebase Auth + Google OAuth |
| APIs | Google Calendar API, Google Tasks API, Google Contacts API |

## What Was Cut (YAGNI)

- ~~LangChain~~ — replaced by ADK
- ~~Gmail drafts~~ — low demo value, adds scope
- ~~Firestore~~ — not needed for session-based processing
- ~~Terraform~~ — manual Cloud Run deploy for hackathon
- ~~Google Keep / Phase 2+ features~~ — post-hackathon

## 13-Day Timeline

| Days | Milestone |
|------|-----------|
| 1-2 | ADK setup, Gemini Live WebSocket, Cloud Run scaffold |
| 3-5 | The Witness: conversation stack, interrupt classification, real-time function calling, ADHD state detection |
| 6-8 | The Handler: state-aware strategy, persona voice, Google Calendar + Tasks creation |
| 9-10 | Vision input, frontend WebSocket integration, sticky note UI with thread visualization |
| 11-12 | One-click approval flow, OAuth flow, end-to-end polish |
| 13 | Demo video, final deploy, submission |

## Demo Strategy

Show three things:
1. Same brain dump in two emotional states — AI responds completely differently (state detection + persona)
2. User interrupts themselves mid-thought — AI tracks all threads, loses nothing (conversation stack)
3. User mentions "meeting tomorrow" — AI already checked their calendar before they finished the sentence (real-time tool use)

## Success Metrics

- Voice interruption handling works 95% of the time
- ADHD state detection accuracy > 80%
- Thought-to-action conversion < 30 seconds
- Google action creation success rate > 90%
- Zero user data stored beyond session

## Design Principles

1. **Relief first** — The AI's job is to reduce cognitive load, not add to it
2. **Interruptions are features** — ADHD brains don't speak linearly, and that's okay
3. **Concurrent reasoning** — The agent thinks and acts while listening, not after
4. **Distinct persona** — Warm, grounded, state-adaptive — never a generic assistant
5. **AI suggests, human decides** — One-click approval, never auto-create
6. **Google-native** — ADK + Cloud Run + Workspace APIs, seamless integration
7. **Process, don't store** — Privacy-first, session-based
8. **Two agents, not ten** — Simplicity over orchestration complexity
