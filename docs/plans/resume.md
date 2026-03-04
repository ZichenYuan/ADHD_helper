# Mind Space — Session Resume

**Last updated:** 2026-03-03
**Hackathon deadline:** March 16, 2026 (13 days remaining)

## What This Project Is

Mind Space is an ADHD cognitive companion for the **Google Live Agents Track** hackathon. It uses **Gemini Live API + ADK** to create a real-time voice AI that:

1. **Detects ADHD cognitive states** (spiral, overwhelm, paralysis, hyperfocus-drift) from voice signals in real-time
2. **Tracks thought threads through interruptions** via a conversation stack with interrupt classification (tangent, correction, state shift)
3. **Calls Google APIs concurrently** during the live conversation (Calendar conflict checking, Tasks lookup, Contacts resolution)
4. **Responds with a state-adaptive persona** — different voice/tone for each ADHD state
5. **Creates Google Calendar events and Tasks** after one-click user approval

## Key Design Decisions

- **Two agents:** The Witness (Gemini Live session, real-time) + The Handler (creates Google actions after approval)
- **ADK, not LangChain** — Google-native, judges will recognize it
- **Vision input** — camera capture for whiteboard/sticky notes (Audio/Vision hackathon requirement)
- **Relief is the output** — Calendar events are evidence the brain was heard, not the product itself
- **Persona:** warm, grounded, never clinical — state-adaptive voice (see `backend/agents/persona.py` in plan)

## Key Files

| File | Purpose |
|------|---------|
| `plan.md` | Full project plan with architecture, roadmap, design principles |
| `docs/plans/2026-03-03-adhd-cognitive-companion-design.md` | Approved design document |
| `docs/plans/2026-03-03-implementation-plan.md` | **THE IMPLEMENTATION PLAN** — 18 tasks with exact code, file paths, test commands |
| `index.html`, `styles.css`, `script.js` | Existing frontend (calming UI, breathing guide, sensory controls) |
| `backend/` | Backend scaffold (created, Task 1 complete) |

## What Has Been Done

### Brainstorming & Design (Complete)
- Explored project context, clarified direction through collaborative Q&A
- Chose "ADHD-First, Google as Output" approach (Approach A)
- Designed the two-agent architecture (Witness + Handler)
- Defined smart Gemini Live usage: state detection, real-time function calling, conversation stack, vision
- Defined agent persona with state-adaptive voice
- Aligned with hackathon requirements (Live Agents track)
- Wrote and committed design document

### Implementation (In Progress)
- **Task 1: Project scaffold** — DONE (commit `53ee750`)
  - Created `backend/` directory structure with all subdirectories
  - `requirements.txt` with 13 dependencies (google-adk, google-genai, fastapi, etc.)
  - `.env.example` template
  - All `__init__.py` files

## What Needs To Be Done Next

**The implementation plan is at `docs/plans/2026-03-03-implementation-plan.md`.** It has 18 tasks with exact code, file paths, and test commands. Continue from Task 2.

### Remaining Tasks (in order)

| # | Task | Key Files |
|---|------|-----------|
| 2 | Session state model (Pydantic) | `backend/models/session_state.py`, tests |
| 3 | Google API service layer | `backend/google/calendar_service.py`, `tasks_service.py`, `contacts_service.py` |
| 4 | Agent tool functions | `backend/tools/calendar_tools.py`, `tasks_tools.py`, `contacts_tools.py` |
| 5 | Agent persona instructions | `backend/agents/persona.py` |
| 6 | The Witness agent (ADK) | `backend/agents/witness.py` |
| 7 | The Handler agent (ADK) | `backend/agents/handler.py` |
| 8 | Root agent + ADK App | `backend/agents/app.py` |
| 9 | FastAPI server + WebSocket | `backend/main.py` |
| 10 | Tool runtime integration | Update tool files with service injection |
| 11 | Frontend WebSocket client | `script.js` (add LiveSession class) |
| 12 | Sticky note approval UI | `index.html`, `styles.css`, `script.js` |
| 13 | Vision input (camera) | `index.html`, `script.js` |
| 14 | OAuth flow | `backend/google/oauth_routes.py`, `backend/main.py` |
| 15 | Deployment | `Dockerfile`, `deployment/cloudbuild.yaml` |
| 16 | Integration tests | `backend/tests/test_integration.py` |
| 17 | State indicator UI | `index.html`, `styles.css`, `script.js` |
| 18 | Demo prep + polish | End-to-end testing, demo video, deploy |

## How To Continue

### Method: Subagent-Driven Development
The approach is: **dispatch a fresh subagent per task, then run spec review + code quality review after each.**

To resume:
1. Read `docs/plans/2026-03-03-implementation-plan.md` for the full task details (exact code, file paths, commands)
2. Pick up from **Task 2: Session state model**
3. For each task: implement → test → commit → spec review → code quality review → next task

### Tech Notes
- **Gemini Live model:** `gemini-live-2.5-flash-native-audio` (for ADK) or `gemini-2.5-flash-native-audio-preview-12-2025` (for direct API)
- **Audio format:** Input 16kHz PCM mono, Output 24kHz PCM
- **ADK agents:** Define with `Agent()`, tools are plain Python functions passed to `tools=[]`, multi-agent via `sub_agents=[]`
- **ADK live streaming:** Use `runner.run_live()` with `LiveRequestQueue` for bidirectional audio
- **Session limit:** 10 minutes per Gemini Live session — need reconnection logic for longer conversations
- **Voice:** `Kore` (warm, grounded preset voice in Gemini)

### Environment Setup
```bash
cd /Users/zichenyuan/Desktop/sideproj/mental-dump
cd backend && pip install -r requirements.txt
cp .env.example .env  # Fill in real values
```

## Git State
- Branch: `master`
- Last commit: `53ee750` — "feat: scaffold backend project structure with dependencies"
- All files tracked, working tree clean
