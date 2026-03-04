# Mind Space — ADHD Cognitive Companion

**Keywords**: ADHD, cognitive companion, prefrontal cortex relief, non-linear thinking, real-time voice AI, Gemini Live, ADK, brain dump

## Project Vision

An AI companion that understands ADHD brains — not just to-do lists. It listens while you're disorganized, detects your cognitive state in real-time, and responds with the right intervention before organizing your thoughts into Google actions.

**North Star**: "An AI that understands your ADHD brain — not just your to-do list."

**North Star Metric**: 30 seconds from anxious voice to feeling relief — with a Calendar event as proof.

**Core Emotion**: Relief. "Someone finally gets it."

## Already Implemented

### Frontend (Complete)
- Calming UI with sage/sand color palette
- Quick dump text interface
- Auto-categorization (Worries, Tasks, Ideas, Feelings)
- Local storage with auto-save
- Responsive design with accessibility
- Sensory controls (animation, color, font size)
- Breathing guide overlay

### Current Tech Stack
- Frontend: HTML/CSS/JavaScript (Vanilla)
- Styling: Organic minimalism design system
- Storage: LocalStorage for privacy-first approach

## What Makes This Different

Every productivity AI waits for structured input. This one works with the mess:

1. **ADHD state detection** — Analyzes voice in real-time to detect spiral, overwhelm, paralysis, or hyperfocus-drift
2. **State-aware responses** — Different cognitive states get different interventions, not one-size-fits-all
3. **Real-time reasoning** — The agent queries Google Calendar, resolves contacts, and checks context *while the user is still talking*, not after
4. **Interruption-native** — A conversation stack that classifies interrupts (tangent, correction, state shift) and never loses a thread
5. **Distinct persona** — A warm, grounded voice that adapts tone to the user's ADHD state — not a generic assistant
6. **Relief first, actions second** — Google Calendar events are evidence the brain was heard, not the product itself

## Smart Gemini Live Usage

### Real-Time ADHD State Detection
The model analyzes voice signals continuously:
- **Speech rate** (accelerating = spiral/anxiety)
- **Fragmentation** (half-sentences, trailing off = overwhelm)
- **Repetition** (looping back to the same topic = stuck/paralysis)
- **Sudden topic jumps** (tangent = scatter)

Classifies the session into: **Spiral**, **Overwhelm**, **Paralysis**, or **Hyperfocus-drift**.

### Real-Time Function Calling (Concurrent Reasoning)
The Witness doesn't just listen — it acts while the user is talking:
- Hears "dentist tomorrow" → immediately queries Google Calendar to check what's on tomorrow, surfaces conflicts before the user asks
- Hears "email Sarah" → looks up contacts in the background to resolve which Sarah
- Hears "that project deadline" → checks Google Tasks for existing items, links the thought to what's already tracked
- Builds the session state incrementally with each utterance, not batched at the end

When The Witness reflects at a pause, it brings context: "I've got three things, and your calendar tomorrow is already full at 2pm — the dentist might need to go at 4."

This is the technical depth that distinguishes a real agent from a transcription wrapper: **concurrent reasoning + tool use + conversation**.

### Interruption Handling (Conversation Stack)
Barge-in at the API level is table stakes. What matters is what the agent does with it. The system maintains a **conversation stack** with interrupt classification:

- **Tangent** ("oh wait, the dentist!") → Push current topic to stack, follow the user. Later: "We were also talking about the project deadline — want to come back to that?"
- **Correction** ("no wait, I meant Tuesday not tomorrow") → Update the existing thread in-place, don't create a new one
- **State shift** (user suddenly speeds up, voice tightens) → Switch response strategy mid-conversation, acknowledge the shift

The stack is visible to The Handler. When it generates the sticky-note UI, interrupted-but-unresolved threads get a distinct visual treatment — "you mentioned this but we didn't finish."

The core promise: **the agent never loses a thread**. Even if the user interrupts themselves five times, every thread is tracked and can be surfaced. The AI holds what the ADHD brain can't.

### State-Aware Response Strategies
- **Spiral / anxiety** — Ground first ("I hear you — let's slow down"), then organize
- **Paralysis** — Shrink the task ("What's the one smallest thing?"), offer a micro-action
- **Overwhelm** — Go silent, capture everything, triage afterward
- **Hyperfocus drift** — Gentle redirect ("You mentioned the deadline was urgent — want to start there?")

### Vision Input
Users can show the camera a messy whiteboard, sticky notes, or a calendar screenshot. The Witness agent "sees" it alongside hearing the voice dump. Satisfies the Audio/Vision hackathon requirement and fits ADHD visual thinkers.

## Agent Persona

The agent needs a voice that makes ADHD users feel relief, not managed.

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

## Two-Agent Architecture (ADK)

### Agent 1: The Witness
Lives inside the Gemini Live session. A true agent — not just a listener. It simultaneously holds the conversation, reasons about ADHD state, and calls tools in real-time.

**Capabilities:**
- Transcribes and tracks multiple thought threads via a conversation stack
- Classifies interrupts in real-time (tangent, correction, state shift)
- Calls Google Calendar, Tasks, and Contacts APIs while the user is still speaking
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
- User goes silent for 3+ seconds — reflects back with context it has already gathered: "I've got three things. Your calendar tomorrow is packed after 2, so the dentist might need morning. Want me to keep going or start sorting?"
- Detects a state shift (calm → spiraling) — switches persona voice and intervenes with state-appropriate technique
- Surfaces unresolved threads from the conversation stack: "We were also talking about Sarah — want to come back to that?"
- User explicitly asks

### Agent 2: The Handler
Triggered when the user says "okay sort this" or accepts the pause prompt. Receives the session state and:
1. Applies state-appropriate response strategy
2. Generates sticky-note visualization in the UI (each thread = a card)
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

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | HTML/CSS/JS (existing) + WebSocket client for Gemini Live |
| Backend | Python + FastAPI |
| AI/Agents | Gemini Live API via ADK |
| Cloud | Google Cloud Run |
| Auth | Firebase Auth + Google OAuth |
| APIs | Google Calendar API, Google Tasks API |

## File Structure
```
mental-dump/
├── index.html              # Existing frontend
├── styles.css
├── script.js
├── backend/
│   ├── main.py             # FastAPI app + WebSocket
│   ├── agents/
│   │   ├── witness.py      # The Witness (Gemini Live session)
│   │   └── handler.py      # The Handler (Google actions)
│   ├── google/
│   │   ├── auth.py
│   │   ├── calendar_service.py
│   │   └── tasks_service.py
│   └── requirements.txt
├── deployment/
│   ├── Dockerfile
│   └── cloudbuild.yaml
├── docs/
│   └── plans/
└── plan.md
```

## MVP Roadmap (13 Days — Deadline March 16)

### Days 1-2: Foundation
- [ ] Set up Google Cloud project + ADK
- [ ] Gemini Live WebSocket connection
- [ ] Cloud Run scaffold with FastAPI
- [ ] Basic audio streaming proof of concept

### Days 3-5: The Witness Agent (Core)
- [ ] ADHD state detection from voice signals
- [ ] Conversation stack with interrupt classification (tangent/correction/state shift)
- [ ] Real-time function calling: Google Calendar conflict checking during conversation
- [ ] Real-time function calling: Google Contacts resolution during conversation
- [ ] 3-second pause reflection with gathered context
- [ ] State shift detection and persona voice switching
- [ ] Session state object generation (with stack and resolved context)

### Days 6-8: The Handler Agent + Persona
- [ ] State-aware response strategy engine
- [ ] Persona voice implementation (overwhelm/spiral/paralysis/calm styles)
- [ ] Google Calendar event creation
- [ ] Google Tasks creation
- [ ] Firebase Auth + Google OAuth flow

### Days 9-10: Vision + Frontend Integration
- [ ] Vision input via camera (whiteboard/notes capture)
- [ ] WebSocket integration in frontend
- [ ] Sticky note UI for thought visualization (unresolved threads marked distinctly)
- [ ] Real-time state indicator in UI
- [ ] Conversation stack visualization (interrupted threads surfaced)

### Days 11-12: Approval Flow + Polish
- [ ] One-click approval interface
- [ ] End-to-end flow testing (multiple ADHD states, interruption scenarios)
- [ ] Error handling and edge cases
- [ ] UI polish and accessibility

### Day 13: Ship
- [ ] Demo video (show same dump in two emotional states)
- [ ] Final deploy to Cloud Run
- [ ] Submission materials

## Success Metrics

- Voice interruption handling works 95% of the time
- ADHD state detection accuracy > 80%
- Thought-to-action conversion < 30 seconds
- Google action creation success rate > 90%
- Zero user data stored beyond session

## Hackathon Alignment (Live Agent Track)

| Requirement | How We Meet It |
|-------------|----------------|
| Real-time interaction (Audio/Vision) | Gemini Live for voice + camera vision input |
| Natural conversation with interruptions | Conversation stack with interrupt classification, barge-in handling, thread preservation |
| Distinct persona/voice | State-adaptive persona that shifts tone based on detected ADHD state |
| Technical depth | Real-time concurrent function calling (Calendar, Tasks, Contacts) during live conversation |
| Gemini Live API or ADK | Both — Gemini Live API orchestrated via ADK |
| Hosted on Google Cloud | Cloud Run |

**Demo hook**: Show three things:
1. Same brain dump in two emotional states — AI responds completely differently (state detection)
2. User interrupts themselves mid-thought — AI tracks all threads, loses nothing (conversation stack)
3. User mentions "meeting tomorrow" — AI already checked their calendar before they finished the sentence (real-time tool use)

## Design Principles

1. **Relief first** — Reduce cognitive load, don't add to it
2. **Interruptions are features** — ADHD brains don't speak linearly, and that's okay
3. **AI suggests, human decides** — One-click approval, never auto-create
4. **Two agents, not ten** — Simplicity over orchestration complexity
5. **Process, don't store** — Privacy-first, session-based
6. **Google-native** — ADK + Cloud Run + Workspace APIs

## Go/No-Go Criteria

Ask before adding any feature:
1. Can it be done with the existing 2 agents? Don't add a third.
2. Does it respond to an ADHD cognitive state? Priority high.
3. Does it create a Google artifact as a side effect? Good.
4. Does it add complexity without clear relief value? Skip it.
5. Can users understand it in 5 seconds? Build it.

## Future Roadmap (Post-Hackathon)

### Phase 2: Pattern Recognition
- Identify recurring thought patterns over time
- Predict stress triggers
- Weekly cognitive load insights

### Phase 3: Enhanced Google Integration
- Gmail drafts from mentions
- Google Keep for visual sticky notes
- Google Docs for long-form journaling

### Phase 4: Advanced ADHD Features
- Medication reminder detection
- Time blindness assistant
- Body-doubling timer
- Hyperfocus session management

---

*Last Updated: March 3, 2026*
*Project Status: Pre-MVP Development*
*Hackathon Deadline: March 16, 2026*
