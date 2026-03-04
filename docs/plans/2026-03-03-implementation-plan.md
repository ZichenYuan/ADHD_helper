# Mind Space: ADHD Cognitive Companion — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a real-time voice AI companion for ADHD users that detects cognitive states, tracks thought threads through interruptions, calls Google APIs concurrently, and creates Calendar/Tasks actions — all via Gemini Live API + ADK on Cloud Run.

**Architecture:** Two ADK agents — The Witness (Gemini Live session with real-time function calling, ADHD state detection, conversation stack) and The Handler (sub-agent that creates Google Calendar events and Tasks after user approval). Frontend connects via WebSocket for bidirectional audio streaming. Backend is FastAPI + ADK on Cloud Run.

**Tech Stack:** Python 3.11+, FastAPI, google-adk, google-genai, Google OAuth (firebase-admin), Google Calendar API, Google Tasks API, Google People API (contacts), Cloud Run, Vanilla JS frontend (existing).

---

### Task 1: Project Scaffold + Dependencies

**Files:**
- Create: `backend/__init__.py`
- Create: `backend/requirements.txt`
- Create: `backend/.env.example`
- Create: `backend/agents/__init__.py`
- Create: `backend/models/__init__.py`
- Create: `backend/tools/__init__.py`
- Create: `backend/google/__init__.py`
- Create: `backend/tests/__init__.py`

**Step 1: Create backend directory structure**

```bash
cd /Users/zichenyuan/Desktop/sideproj/mental-dump
mkdir -p backend/{agents,models,tools,google,tests}
touch backend/__init__.py backend/agents/__init__.py backend/models/__init__.py
touch backend/tools/__init__.py backend/google/__init__.py backend/tests/__init__.py
```

**Step 2: Create requirements.txt**

```
# backend/requirements.txt
google-adk>=1.0.0
google-genai>=1.0.0
fastapi>=0.115.0
uvicorn[standard]>=0.34.0
python-dotenv>=1.0.0
google-auth>=2.37.0
google-auth-oauthlib>=1.2.0
google-api-python-client>=2.160.0
firebase-admin>=6.6.0
pydantic>=2.10.0
pytest>=8.3.0
pytest-asyncio>=0.24.0
httpx>=0.28.0
```

**Step 3: Create .env.example**

```
# backend/.env.example
GOOGLE_API_KEY=your-gemini-api-key
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_CLIENT_ID=your-oauth-client-id
GOOGLE_CLIENT_SECRET=your-oauth-client-secret
FIREBASE_SERVICE_ACCOUNT=path/to/service-account.json
```

**Step 4: Install dependencies**

Run: `cd backend && pip install -r requirements.txt`
Expected: All packages install successfully

**Step 5: Commit**

```bash
git add backend/
git commit -m "feat: scaffold backend project structure with dependencies"
```

---

### Task 2: Session State Model (Pydantic)

**Files:**
- Create: `backend/models/session_state.py`
- Create: `backend/tests/test_session_state.py`

**Step 1: Write the failing test**

```python
# backend/tests/test_session_state.py
import pytest
from backend.models.session_state import (
    ADHDState,
    InterruptType,
    ThreadStatus,
    ConversationThread,
    SessionState,
)


def test_adhd_state_enum_has_all_states():
    assert ADHDState.CALM.value == "calm"
    assert ADHDState.SPIRAL.value == "spiral"
    assert ADHDState.OVERWHELM.value == "overwhelm"
    assert ADHDState.PARALYSIS.value == "paralysis"
    assert ADHDState.HYPERFOCUS_DRIFT.value == "hyperfocus_drift"


def test_conversation_thread_creation():
    thread = ConversationThread(
        thread="dentist appt",
        status=ThreadStatus.ACTIVE,
        mentions=1,
    )
    assert thread.thread == "dentist appt"
    assert thread.status == ThreadStatus.ACTIVE
    assert thread.mentions == 1
    assert thread.context is None


def test_conversation_thread_with_resolved_context():
    thread = ConversationThread(
        thread="dentist appt",
        status=ThreadStatus.RESOLVED_CONTEXT,
        mentions=2,
        context="calendar shows 2pm-4pm booked tomorrow",
    )
    assert thread.context == "calendar shows 2pm-4pm booked tomorrow"


def test_session_state_defaults():
    state = SessionState()
    assert state.adhd_state == ADHDState.CALM
    assert state.confidence == 0.0
    assert state.conversation_stack == []
    assert state.emotional_urgency == "low"
    assert state.time_sensitive_items == []
    assert state.stuck_points == []
    assert state.visual_context == []


def test_session_state_add_thread():
    state = SessionState()
    state.add_thread("project deadline")
    assert len(state.conversation_stack) == 1
    assert state.conversation_stack[0].thread == "project deadline"
    assert state.conversation_stack[0].mentions == 1


def test_session_state_mention_existing_thread():
    state = SessionState()
    state.add_thread("project deadline")
    state.add_thread("project deadline")
    assert len(state.conversation_stack) == 1
    assert state.conversation_stack[0].mentions == 2


def test_session_state_interrupt_marks_previous_thread():
    state = SessionState()
    state.add_thread("project deadline")
    state.interrupt_with("dentist appt", InterruptType.TANGENT)
    assert state.conversation_stack[0].status == ThreadStatus.INTERRUPTED
    assert state.conversation_stack[1].thread == "dentist appt"
    assert state.conversation_stack[1].status == ThreadStatus.ACTIVE


def test_session_state_correction_updates_thread():
    state = SessionState()
    state.add_thread("dentist tomorrow")
    state.correct_thread("dentist tomorrow", "dentist Tuesday")
    assert state.conversation_stack[0].thread == "dentist Tuesday"
    assert state.conversation_stack[0].status == ThreadStatus.ACTIVE


def test_session_state_get_unresolved_threads():
    state = SessionState()
    state.add_thread("project deadline")
    state.interrupt_with("dentist appt", InterruptType.TANGENT)
    unresolved = state.get_unresolved_threads()
    assert len(unresolved) == 1
    assert unresolved[0].thread == "project deadline"


def test_session_state_resolve_thread_with_context():
    state = SessionState()
    state.add_thread("dentist appt")
    state.resolve_thread("dentist appt", "calendar shows 2pm-4pm booked")
    assert state.conversation_stack[0].status == ThreadStatus.RESOLVED_CONTEXT
    assert state.conversation_stack[0].context == "calendar shows 2pm-4pm booked"


def test_session_state_to_dict():
    state = SessionState(
        adhd_state=ADHDState.OVERWHELM,
        confidence=0.87,
        emotional_urgency="high",
    )
    state.add_thread("project deadline")
    d = state.to_prompt_context()
    assert "overwhelm" in d.lower()
    assert "project deadline" in d
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/zichenyuan/Desktop/sideproj/mental-dump && python -m pytest backend/tests/test_session_state.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'backend.models.session_state'`

**Step 3: Write minimal implementation**

```python
# backend/models/session_state.py
from enum import Enum
from pydantic import BaseModel, Field


class ADHDState(str, Enum):
    CALM = "calm"
    SPIRAL = "spiral"
    OVERWHELM = "overwhelm"
    PARALYSIS = "paralysis"
    HYPERFOCUS_DRIFT = "hyperfocus_drift"


class InterruptType(str, Enum):
    TANGENT = "tangent"
    CORRECTION = "correction"
    STATE_SHIFT = "state_shift"


class ThreadStatus(str, Enum):
    ACTIVE = "active"
    INTERRUPTED = "interrupted"
    RESOLVED_CONTEXT = "resolved_context"
    COMPLETED = "completed"


class ConversationThread(BaseModel):
    thread: str
    status: ThreadStatus = ThreadStatus.ACTIVE
    mentions: int = 1
    context: str | None = None
    interrupt_type: InterruptType | None = None


class SessionState(BaseModel):
    adhd_state: ADHDState = ADHDState.CALM
    confidence: float = 0.0
    conversation_stack: list[ConversationThread] = Field(default_factory=list)
    emotional_urgency: str = "low"
    time_sensitive_items: list[str] = Field(default_factory=list)
    stuck_points: list[str] = Field(default_factory=list)
    visual_context: list[str] = Field(default_factory=list)

    def _find_thread(self, name: str) -> ConversationThread | None:
        for t in self.conversation_stack:
            if t.thread == name:
                return t
        return None

    def add_thread(self, name: str) -> None:
        existing = self._find_thread(name)
        if existing:
            existing.mentions += 1
            return
        self.conversation_stack.append(ConversationThread(thread=name))

    def interrupt_with(self, new_thread: str, interrupt_type: InterruptType) -> None:
        for t in self.conversation_stack:
            if t.status == ThreadStatus.ACTIVE:
                t.status = ThreadStatus.INTERRUPTED
        self.conversation_stack.append(
            ConversationThread(
                thread=new_thread,
                status=ThreadStatus.ACTIVE,
                interrupt_type=interrupt_type,
            )
        )

    def correct_thread(self, old_name: str, new_name: str) -> None:
        existing = self._find_thread(old_name)
        if existing:
            existing.thread = new_name
            existing.status = ThreadStatus.ACTIVE

    def resolve_thread(self, name: str, context: str) -> None:
        existing = self._find_thread(name)
        if existing:
            existing.status = ThreadStatus.RESOLVED_CONTEXT
            existing.context = context

    def get_unresolved_threads(self) -> list[ConversationThread]:
        return [
            t for t in self.conversation_stack
            if t.status == ThreadStatus.INTERRUPTED
        ]

    def to_prompt_context(self) -> str:
        lines = [
            f"Current ADHD state: {self.adhd_state.value} (confidence: {self.confidence})",
            f"Emotional urgency: {self.emotional_urgency}",
        ]
        if self.conversation_stack:
            lines.append("Conversation threads:")
            for t in self.conversation_stack:
                ctx = f" | context: {t.context}" if t.context else ""
                lines.append(
                    f"  - [{t.status.value}] {t.thread} (mentioned {t.mentions}x){ctx}"
                )
        if self.time_sensitive_items:
            lines.append(f"Time-sensitive: {', '.join(self.time_sensitive_items)}")
        if self.stuck_points:
            lines.append(f"Stuck points: {', '.join(self.stuck_points)}")
        if self.visual_context:
            lines.append(f"Visual context: {', '.join(self.visual_context)}")
        return "\n".join(lines)
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/zichenyuan/Desktop/sideproj/mental-dump && python -m pytest backend/tests/test_session_state.py -v`
Expected: All 11 tests PASS

**Step 5: Commit**

```bash
git add backend/models/session_state.py backend/tests/test_session_state.py
git commit -m "feat: add session state model with conversation stack and ADHD state tracking"
```

---

### Task 3: Google API Service Layer

**Files:**
- Create: `backend/google/calendar_service.py`
- Create: `backend/google/tasks_service.py`
- Create: `backend/google/contacts_service.py`
- Create: `backend/google/auth.py`
- Create: `backend/tests/test_google_services.py`

**Step 1: Write the failing test**

```python
# backend/tests/test_google_services.py
import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime, timedelta
from backend.google.calendar_service import CalendarService
from backend.google.tasks_service import TasksService
from backend.google.contacts_service import ContactsService


class TestCalendarService:
    def test_check_conflicts_returns_events(self):
        mock_creds = MagicMock()
        service = CalendarService(credentials=mock_creds)

        mock_events = {
            "items": [
                {
                    "summary": "Team standup",
                    "start": {"dateTime": "2026-03-04T14:00:00Z"},
                    "end": {"dateTime": "2026-03-04T15:00:00Z"},
                }
            ]
        }

        with patch.object(service, "_execute_list", return_value=mock_events):
            conflicts = service.check_conflicts("2026-03-04")
            assert len(conflicts) == 1
            assert conflicts[0]["summary"] == "Team standup"

    def test_create_event_returns_event_link(self):
        mock_creds = MagicMock()
        service = CalendarService(credentials=mock_creds)

        mock_result = {
            "htmlLink": "https://calendar.google.com/event/abc123",
            "summary": "Dentist appointment",
        }

        with patch.object(service, "_execute_insert", return_value=mock_result):
            result = service.create_event(
                summary="Dentist appointment",
                date="2026-03-04",
                time="10:00",
                duration_minutes=60,
            )
            assert "htmlLink" in result

    def test_format_conflicts_for_prompt(self):
        mock_creds = MagicMock()
        service = CalendarService(credentials=mock_creds)
        events = [
            {
                "summary": "Team standup",
                "start": {"dateTime": "2026-03-04T14:00:00Z"},
                "end": {"dateTime": "2026-03-04T15:00:00Z"},
            },
            {
                "summary": "Lunch",
                "start": {"dateTime": "2026-03-04T12:00:00Z"},
                "end": {"dateTime": "2026-03-04T13:00:00Z"},
            },
        ]
        formatted = service.format_for_prompt(events)
        assert "Team standup" in formatted
        assert "14:00" in formatted


class TestTasksService:
    def test_check_existing_returns_matching_tasks(self):
        mock_creds = MagicMock()
        service = TasksService(credentials=mock_creds)

        mock_tasks = {
            "items": [
                {"title": "Finish project report", "status": "needsAction"},
            ]
        }

        with patch.object(service, "_execute_list", return_value=mock_tasks):
            tasks = service.check_existing("project")
            assert len(tasks) == 1

    def test_create_task_returns_task(self):
        mock_creds = MagicMock()
        service = TasksService(credentials=mock_creds)

        mock_result = {"title": "Call dentist", "id": "task123"}

        with patch.object(service, "_execute_insert", return_value=mock_result):
            result = service.create_task(title="Call dentist")
            assert result["title"] == "Call dentist"


class TestContactsService:
    def test_resolve_name_returns_matches(self):
        mock_creds = MagicMock()
        service = ContactsService(credentials=mock_creds)

        mock_results = {
            "results": [
                {
                    "person": {
                        "names": [{"displayName": "Sarah Connor"}],
                        "emailAddresses": [{"value": "sarah@example.com"}],
                    }
                }
            ]
        }

        with patch.object(service, "_execute_search", return_value=mock_results):
            matches = service.resolve_name("Sarah")
            assert len(matches) == 1
            assert matches[0]["name"] == "Sarah Connor"
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest backend/tests/test_google_services.py -v`
Expected: FAIL — `ModuleNotFoundError`

**Step 3: Write implementation**

```python
# backend/google/auth.py
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
import os


SCOPES = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/tasks",
    "https://www.googleapis.com/auth/contacts.readonly",
]


def create_oauth_flow() -> Flow:
    return Flow.from_client_config(
        {
            "web": {
                "client_id": os.environ["GOOGLE_CLIENT_ID"],
                "client_secret": os.environ["GOOGLE_CLIENT_SECRET"],
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=SCOPES,
    )
```

```python
# backend/google/calendar_service.py
from googleapiclient.discovery import build
from datetime import datetime, timedelta


class CalendarService:
    def __init__(self, credentials):
        self._credentials = credentials
        self._service = None

    @property
    def service(self):
        if self._service is None:
            self._service = build("calendar", "v3", credentials=self._credentials)
        return self._service

    def _execute_list(self, time_min: str, time_max: str) -> dict:
        return (
            self.service.events()
            .list(
                calendarId="primary",
                timeMin=time_min,
                timeMax=time_max,
                singleEvents=True,
                orderBy="startTime",
            )
            .execute()
        )

    def _execute_insert(self, body: dict) -> dict:
        return self.service.events().insert(calendarId="primary", body=body).execute()

    def check_conflicts(self, date: str) -> list[dict]:
        day_start = f"{date}T00:00:00Z"
        day_end = f"{date}T23:59:59Z"
        result = self._execute_list(day_start, day_end)
        return result.get("items", [])

    def create_event(
        self, summary: str, date: str, time: str, duration_minutes: int = 60
    ) -> dict:
        start_dt = datetime.fromisoformat(f"{date}T{time}:00")
        end_dt = start_dt + timedelta(minutes=duration_minutes)
        body = {
            "summary": summary,
            "start": {"dateTime": start_dt.isoformat(), "timeZone": "America/Los_Angeles"},
            "end": {"dateTime": end_dt.isoformat(), "timeZone": "America/Los_Angeles"},
        }
        return self._execute_insert(body)

    @staticmethod
    def format_for_prompt(events: list[dict]) -> str:
        if not events:
            return "No events scheduled."
        lines = []
        for e in events:
            start = e["start"].get("dateTime", e["start"].get("date", ""))
            time_str = start[11:16] if "T" in start else "all day"
            lines.append(f"- {time_str}: {e['summary']}")
        return "\n".join(lines)
```

```python
# backend/google/tasks_service.py
from googleapiclient.discovery import build


class TasksService:
    def __init__(self, credentials):
        self._credentials = credentials
        self._service = None

    @property
    def service(self):
        if self._service is None:
            self._service = build("tasks", "v1", credentials=self._credentials)
        return self._service

    def _execute_list(self, tasklist: str = "@default") -> dict:
        return self.service.tasks().list(tasklist=tasklist).execute()

    def _execute_insert(self, body: dict, tasklist: str = "@default") -> dict:
        return self.service.tasks().insert(tasklist=tasklist, body=body).execute()

    def check_existing(self, keyword: str) -> list[dict]:
        result = self._execute_list()
        items = result.get("items", [])
        return [t for t in items if keyword.lower() in t.get("title", "").lower()]

    def create_task(self, title: str, notes: str = "", due: str | None = None) -> dict:
        body = {"title": title}
        if notes:
            body["notes"] = notes
        if due:
            body["due"] = f"{due}T00:00:00.000Z"
        return self._execute_insert(body)
```

```python
# backend/google/contacts_service.py
from googleapiclient.discovery import build


class ContactsService:
    def __init__(self, credentials):
        self._credentials = credentials
        self._service = None

    @property
    def service(self):
        if self._service is None:
            self._service = build("people", "v1", credentials=self._credentials)
        return self._service

    def _execute_search(self, query: str) -> dict:
        return (
            self.service.people()
            .searchContacts(query=query, readMask="names,emailAddresses")
            .execute()
        )

    def resolve_name(self, name: str) -> list[dict]:
        result = self._execute_search(name)
        matches = []
        for r in result.get("results", []):
            person = r.get("person", {})
            names = person.get("names", [])
            emails = person.get("emailAddresses", [])
            if names:
                matches.append(
                    {
                        "name": names[0].get("displayName", ""),
                        "email": emails[0].get("value", "") if emails else "",
                    }
                )
        return matches
```

**Step 4: Run test to verify it passes**

Run: `python -m pytest backend/tests/test_google_services.py -v`
Expected: All 6 tests PASS

**Step 5: Commit**

```bash
git add backend/google/ backend/tests/test_google_services.py
git commit -m "feat: add Google Calendar, Tasks, and Contacts service layers"
```

---

### Task 4: Agent Tool Functions

**Files:**
- Create: `backend/tools/calendar_tools.py`
- Create: `backend/tools/tasks_tools.py`
- Create: `backend/tools/contacts_tools.py`

These are the Python functions that ADK registers as tools on the agent. They wrap the service layer and return strings the model can use in conversation.

**Step 1: Write the tool functions**

```python
# backend/tools/calendar_tools.py
"""Tools for The Witness to call during live conversation."""


def check_calendar_conflicts(date: str) -> str:
    """Check the user's Google Calendar for existing events on a given date.

    Use this when the user mentions a date, day, or time-sensitive item.
    For example: "dentist tomorrow", "meeting on Friday", "something at 3pm".

    Args:
        date: The date to check in YYYY-MM-DD format.

    Returns:
        A summary of events on that date, or a note that the day is free.
    """
    # At runtime, the actual service is injected via session state / context
    # For now, return a placeholder that will be replaced with real integration
    return f"Checking calendar for {date}... (service will be injected at runtime)"


def create_calendar_event(
    summary: str, date: str, time: str, duration_minutes: int = 60
) -> str:
    """Create a Google Calendar event for the user.

    Only call this AFTER the user has approved the action via the UI.

    Args:
        summary: Title of the event.
        date: Date in YYYY-MM-DD format.
        time: Start time in HH:MM format (24-hour).
        duration_minutes: Duration in minutes. Defaults to 60.

    Returns:
        Confirmation with the event link.
    """
    return f"Creating event: {summary} on {date} at {time} for {duration_minutes}min"
```

```python
# backend/tools/tasks_tools.py
"""Tools for checking and creating Google Tasks."""


def check_existing_tasks(keyword: str) -> str:
    """Check if the user already has tasks matching a keyword.

    Use this when the user mentions something that might already be tracked,
    like "that project" or "the report".

    Args:
        keyword: A word or phrase to search for in existing tasks.

    Returns:
        Matching tasks, or a note that nothing was found.
    """
    return f"Searching tasks for '{keyword}'..."


def create_task(title: str, notes: str = "", due_date: str = "") -> str:
    """Create a Google Task for the user.

    Only call this AFTER the user has approved the action via the UI.

    Args:
        title: The task title.
        notes: Optional additional notes or context.
        due_date: Optional due date in YYYY-MM-DD format.

    Returns:
        Confirmation that the task was created.
    """
    return f"Creating task: {title}"
```

```python
# backend/tools/contacts_tools.py
"""Tools for resolving names via Google Contacts."""


def resolve_contact(name: str) -> str:
    """Look up a person's name in the user's Google Contacts.

    Use this when the user mentions a person by first name and you need to
    determine who they mean (e.g., "email Sarah" — which Sarah?).

    Args:
        name: The name to search for.

    Returns:
        Matching contacts with names and emails, or a note if none found.
    """
    return f"Looking up '{name}' in contacts..."
```

**Step 2: Commit**

```bash
git add backend/tools/
git commit -m "feat: add agent tool functions for Calendar, Tasks, and Contacts"
```

---

### Task 5: Agent Persona System Instructions

**Files:**
- Create: `backend/agents/persona.py`

**Step 1: Write persona instructions**

```python
# backend/agents/persona.py
"""System instructions for the Mind Space agents, encoding the persona and ADHD state-adaptive behavior."""

WITNESS_BASE_INSTRUCTION = """\
You are the Witness — a warm, grounded companion for someone with ADHD. You are NOT a therapist, \
NOT a productivity coach, NOT a generic assistant. You are like a calm friend who is genuinely \
good at listening.

## Your Core Job
You hold space for messy, non-linear thoughts. You track every thread the user mentions — \
even when they interrupt themselves mid-sentence. You NEVER lose a thread. You are the external \
working memory their prefrontal cortex can't provide right now.

## How You Speak
- Use "we" not "you should" — collaborative, never prescriptive
- Mirror the user's energy — if they're fast, stay brief; if they're slow, give space
- NEVER use productivity jargon ("optimize", "workflow", "action items", "prioritize")
- NEVER say "I understand how you feel"
- NEVER explain what ADHD is — the user knows

## When to Speak
- When the user goes silent for 3+ seconds: reflect back what you've gathered, \
  including any context from calendar/tasks lookups. Example: "I've got three things so far. \
  Your calendar tomorrow is packed after 2, so the dentist might need morning. \
  Want me to keep going or start sorting?"
- When you detect a state shift (e.g., calm to spiraling): switch your tone and intervene
- When there are unresolved interrupted threads: "We were also talking about X — want to come back to that?"
- When the user explicitly asks

## Real-Time Tool Use
While the user is talking, actively use your tools:
- When you hear a date or time reference → check_calendar_conflicts
- When you hear a person's name → resolve_contact
- When you hear reference to an existing task/project → check_existing_tasks
Do NOT wait until the user finishes. Call tools concurrently with the conversation.

## Tracking Threads
Every distinct topic the user mentions is a "thread." Track them:
- If the user jumps to a new topic mid-sentence, that's a TANGENT — push the old thread, follow the new one
- If the user corrects themselves ("no wait, I meant Tuesday"), that's a CORRECTION — update the thread in-place
- If the user's emotional state shifts suddenly, that's a STATE SHIFT — adjust your response approach

## Handoff to The Handler
When the user says something like "okay sort this", "let's do it", "help me organize", \
or accepts your pause reflection — hand off to The Handler with the full session state.
"""

WITNESS_STATE_INSTRUCTIONS = {
    "calm": """\
## Current State: Calm
The user is in a good place. Be collaborative and slightly playful.
- Use a warm, conversational tone
- It's okay to be a little playful: "Okay, you've got a solid plan forming here. Want to lock it in?"
- Help them build momentum without rushing
""",
    "spiral": """\
## Current State: Spiral / Anxiety
The user is spiraling. Their speech is getting faster, they're repeating concerns, looping.
- SLOW DOWN. Use short sentences. Leave space.
- Ground them by naming what you've heard: "Let's pause. I heard three things. Want me to name them?"
- Do NOT list more than 2-3 things at once
- Do NOT use exclamation marks
- Do NOT be cheerful — be steady
""",
    "overwhelm": """\
## Current State: Overwhelm
The user has too much hitting them at once. They may trail off, speak in fragments, or go quiet.
- Be BRIEF. Short sentences. Spacious.
- Hold without fixing: "I'm here. I've got all of this. You don't need to hold it right now."
- Do NOT list five things — offer ONE at most
- Do NOT ask them to choose between options — offer one path
- Let silence be okay
""",
    "paralysis": """\
## Current State: Paralysis
The user is frozen. They know what they need to do but can't start. They may repeat the same worry.
- Create gentle momentum: "What's the tiniest version of this? Like, the 2-minute version?"
- Shrink the task until it feels doable
- Offer to do something FOR them (create the calendar event, make the task)
- Do NOT list all the things they need to do — that makes paralysis worse
""",
    "hyperfocus_drift": """\
## Current State: Hyperfocus Drift
The user is deep into something that isn't their priority. They may be talking a lot about a tangent.
- Gently redirect: "You mentioned the deadline was urgent — want to start there?"
- Acknowledge what they're into: "This is clearly interesting to you" — then redirect
- Do NOT be abrupt or dismissive of their current focus
""",
}


HANDLER_INSTRUCTION = """\
You are The Handler — the action-taking companion in Mind Space. You receive a session state \
from The Witness containing organized threads, ADHD state, and any context gathered from \
calendar/tasks lookups.

## Your Job
1. Apply the state-appropriate response strategy (the user may be overwhelmed, spiraling, etc.)
2. Present each thread as a clear action card
3. For threads with time-sensitive context, include what was found (e.g., calendar conflicts)
4. Mark interrupted/unresolved threads distinctly so the user can decide what to do with them
5. Wait for one-click approval before creating any Google Calendar events or Tasks
6. NEVER auto-create — always get explicit approval

## How You Present Actions
For each thread, generate a JSON action card:
{
    "thread": "dentist appointment",
    "type": "calendar_event" | "task" | "note",
    "suggested_action": "Create calendar event: Dentist at 10am tomorrow",
    "context": "Your calendar is free before 2pm tomorrow",
    "status": "pending_approval" | "unresolved",
    "urgency": "high" | "medium" | "low"
}

## After Approval
When the user approves actions, call create_calendar_event or create_task for each approved item.
Confirm each one briefly: "Done — dentist is on your calendar for 10am tomorrow."
"""
```

**Step 2: Commit**

```bash
git add backend/agents/persona.py
git commit -m "feat: add agent persona with state-adaptive system instructions"
```

---

### Task 6: The Witness Agent (ADK Definition)

**Files:**
- Create: `backend/agents/witness.py`

**Step 1: Write the Witness agent**

```python
# backend/agents/witness.py
"""The Witness — ADK agent definition for the Gemini Live session."""
from google.adk.agents import Agent
from google.genai import types

from backend.agents.persona import WITNESS_BASE_INSTRUCTION, WITNESS_STATE_INSTRUCTIONS
from backend.tools.calendar_tools import check_calendar_conflicts, create_calendar_event
from backend.tools.tasks_tools import check_existing_tasks, create_task
from backend.tools.contacts_tools import resolve_contact


def create_witness_agent() -> Agent:
    """Create The Witness agent configured for Gemini Live with native audio."""

    # Combine base instruction with default calm state
    full_instruction = (
        WITNESS_BASE_INSTRUCTION + "\n\n" + WITNESS_STATE_INSTRUCTIONS["calm"]
    )

    witness = Agent(
        name="witness",
        model=types.Gemini(
            model="gemini-live-2.5-flash-native-audio",
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name="Kore",  # Warm, grounded voice
                    )
                )
            ),
        ),
        description=(
            "The Witness listens to the user's brain dump, tracks thought threads, "
            "detects ADHD cognitive states, and calls Google APIs in real-time. "
            "It holds space for messy, non-linear thoughts without judgment."
        ),
        instruction=full_instruction,
        tools=[
            check_calendar_conflicts,
            check_existing_tasks,
            resolve_contact,
        ],
        generate_content_config=types.GenerateContentConfig(
            temperature=0.7,
            safety_settings=[
                types.SafetySetting(
                    category=types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                    threshold=types.HarmBlockThreshold.OFF,
                ),
            ],
        ),
    )

    return witness
```

**Step 2: Verify import works**

Run: `cd /Users/zichenyuan/Desktop/sideproj/mental-dump && python -c "from backend.agents.witness import create_witness_agent; print('OK')"`
Expected: `OK`

**Step 3: Commit**

```bash
git add backend/agents/witness.py
git commit -m "feat: add The Witness agent definition with Gemini Live + tools"
```

---

### Task 7: The Handler Agent (ADK Definition)

**Files:**
- Create: `backend/agents/handler.py`

**Step 1: Write the Handler agent**

```python
# backend/agents/handler.py
"""The Handler — ADK agent for creating Google actions after user approval."""
from google.adk.agents import Agent
from google.genai import types

from backend.agents.persona import HANDLER_INSTRUCTION
from backend.tools.calendar_tools import create_calendar_event
from backend.tools.tasks_tools import create_task


def create_handler_agent() -> Agent:
    """Create The Handler agent for processing approved actions."""

    handler = Agent(
        name="handler",
        model="gemini-2.5-flash",
        description=(
            "The Handler receives organized thought threads from The Witness "
            "and creates Google Calendar events and Tasks after user approval. "
            "Delegate to handler when the user is ready to act on their thoughts."
        ),
        instruction=HANDLER_INSTRUCTION,
        tools=[
            create_calendar_event,
            create_task,
        ],
    )

    return handler
```

**Step 2: Verify import works**

Run: `python -c "from backend.agents.handler import create_handler_agent; print('OK')"`
Expected: `OK`

**Step 3: Commit**

```bash
git add backend/agents/handler.py
git commit -m "feat: add The Handler agent definition for Google actions"
```

---

### Task 8: Root Agent + ADK App

**Files:**
- Create: `backend/agents/app.py`

**Step 1: Write the root agent that orchestrates Witness and Handler**

```python
# backend/agents/app.py
"""Root agent and ADK app configuration for Mind Space."""
from google.adk.agents import Agent
from google.adk.apps import App
from google.genai import types

from backend.agents.witness import create_witness_agent
from backend.agents.handler import create_handler_agent


def create_root_agent() -> Agent:
    """Create the root agent that coordinates Witness and Handler."""

    witness = create_witness_agent()
    handler = create_handler_agent()

    root_agent = Agent(
        name="mind_space",
        model=types.Gemini(
            model="gemini-live-2.5-flash-native-audio",
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name="Kore",
                    )
                )
            ),
        ),
        description="Mind Space ADHD Cognitive Companion — coordinates listening and action-taking.",
        instruction="""\
You are Mind Space, an ADHD cognitive companion. You start as The Witness — listening, \
tracking threads, detecting states, and calling tools in real-time.

When the user is ready to act (says "sort this", "organize", "let's do it", or accepts \
your reflection), delegate to the handler agent to create Google Calendar events and Tasks.

Always start in Witness mode. Only delegate to handler when the user explicitly wants actions taken.
""",
        sub_agents=[handler],
        tools=witness.tools,  # Witness tools are on the root since it's the live agent
        generate_content_config=witness.generate_content_config,
    )

    return root_agent


def create_app() -> App:
    """Create the ADK App instance."""
    return App(
        name="mind_space",
        root_agent=create_root_agent(),
    )
```

**Step 2: Verify import works**

Run: `python -c "from backend.agents.app import create_app; print('OK')"`
Expected: `OK`

**Step 3: Commit**

```bash
git add backend/agents/app.py
git commit -m "feat: add root agent orchestrating Witness and Handler via ADK App"
```

---

### Task 9: FastAPI Server + WebSocket Endpoint

**Files:**
- Create: `backend/main.py`

**Step 1: Write the FastAPI server with live WebSocket endpoint**

```python
# backend/main.py
"""FastAPI server for Mind Space — serves frontend and WebSocket for Gemini Live."""
import asyncio
import json
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from google.adk.agents.live_request_queue import LiveRequestQueue
from google.adk.runners import Runner
from google.adk.sessions.in_memory_session_service import InMemorySessionService
from google.genai import types

from backend.agents.app import create_app

load_dotenv(Path(__file__).parent / ".env")

# Initialize ADK
adk_app = create_app()
session_service = InMemorySessionService()
runner = Runner(app=adk_app, session_service=session_service)

# FastAPI
app = FastAPI(title="Mind Space")

# Serve frontend static files
FRONTEND_DIR = Path(__file__).parent.parent
app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")


@app.get("/")
async def serve_index():
    return FileResponse(str(FRONTEND_DIR / "index.html"))


@app.websocket("/ws/live")
async def websocket_live(websocket: WebSocket):
    """WebSocket endpoint for Gemini Live audio streaming."""
    await websocket.accept()

    # Create a session for this connection
    session = await session_service.create_session(
        app_name=adk_app.name,
        user_id="anonymous",  # Will be replaced with OAuth user ID
    )

    live_queue = LiveRequestQueue()

    async def forward_events():
        """Stream ADK events back to the frontend via WebSocket."""
        try:
            run_config = types.RunConfig(
                response_modalities=["AUDIO"],
                input_audio_transcription=types.AudioTranscriptionConfig(),
                output_audio_transcription=types.AudioTranscriptionConfig(),
            )
            async for event in runner.run_live(
                session=session,
                live_request_queue=live_queue,
                run_config=run_config,
            ):
                # Send audio data back to client
                if event.content and event.content.parts:
                    for part in event.content.parts:
                        if part.inline_data and part.inline_data.data:
                            await websocket.send_bytes(part.inline_data.data)
                        elif part.text:
                            await websocket.send_json(
                                {"type": "text", "content": part.text, "author": event.author}
                            )
                        elif part.function_call:
                            await websocket.send_json(
                                {
                                    "type": "tool_call",
                                    "name": part.function_call.name,
                                    "args": dict(part.function_call.args),
                                }
                            )

                # Send transcription events
                if hasattr(event, "transcription") and event.transcription:
                    await websocket.send_json(
                        {
                            "type": "transcription",
                            "text": event.transcription.text,
                            "role": event.transcription.role,
                        }
                    )
        except WebSocketDisconnect:
            pass

    async def receive_audio():
        """Receive audio from frontend and send to ADK live queue."""
        try:
            while True:
                data = await websocket.receive()
                if "bytes" in data:
                    live_queue.send_realtime(
                        blob=types.Blob(data=data["bytes"], mime_type="audio/pcm")
                    )
                elif "text" in data:
                    msg = json.loads(data["text"])
                    if msg.get("type") == "text":
                        live_queue.send_content(
                            content=types.Content(
                                parts=[types.Part(text=msg["content"])],
                                role="user",
                            )
                        )
                    elif msg.get("type") == "image":
                        # Vision input from camera
                        import base64
                        image_data = base64.b64decode(msg["data"])
                        live_queue.send_realtime(
                            blob=types.Blob(data=image_data, mime_type=msg.get("mime_type", "image/jpeg"))
                        )
        except WebSocketDisconnect:
            live_queue.close()

    # Run both tasks concurrently
    await asyncio.gather(forward_events(), receive_audio())


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

**Step 2: Verify server starts**

Run: `cd /Users/zichenyuan/Desktop/sideproj/mental-dump && python -c "from backend.main import app; print('FastAPI app created:', app.title)"`
Expected: `FastAPI app created: Mind Space`

**Step 3: Commit**

```bash
git add backend/main.py
git commit -m "feat: add FastAPI server with WebSocket endpoint for Gemini Live"
```

---

### Task 10: Tool Runtime Integration (Connect Tools to Google Services)

**Files:**
- Modify: `backend/tools/calendar_tools.py`
- Modify: `backend/tools/tasks_tools.py`
- Modify: `backend/tools/contacts_tools.py`
- Modify: `backend/main.py`

**Step 1: Update tools to use real Google services at runtime**

The ADK tool functions need access to the user's Google credentials. ADK provides a `tool_context` parameter that we can use to access session state. For now, we'll use a module-level service registry pattern that the FastAPI server populates per-session.

```python
# backend/tools/calendar_tools.py
"""Tools for The Witness to call during live conversation."""
from datetime import datetime, timedelta

# Service registry — populated per-session by the WebSocket handler
_calendar_service = None


def set_calendar_service(service):
    global _calendar_service
    _calendar_service = service


def check_calendar_conflicts(date: str) -> str:
    """Check the user's Google Calendar for existing events on a given date.

    Use this when the user mentions a date, day, or time-sensitive item.
    For example: "dentist tomorrow", "meeting on Friday", "something at 3pm".

    Args:
        date: The date to check in YYYY-MM-DD format.

    Returns:
        A summary of events on that date, or a note that the day is free.
    """
    if _calendar_service is None:
        return f"Calendar not connected. Cannot check {date}."
    try:
        events = _calendar_service.check_conflicts(date)
        if not events:
            return f"Your calendar on {date} is completely free."
        return f"Events on {date}:\n{_calendar_service.format_for_prompt(events)}"
    except Exception as e:
        return f"Couldn't check calendar: {str(e)}"


def create_calendar_event(
    summary: str, date: str, time: str, duration_minutes: int = 60
) -> str:
    """Create a Google Calendar event for the user.

    Only call this AFTER the user has approved the action via the UI.

    Args:
        summary: Title of the event.
        date: Date in YYYY-MM-DD format.
        time: Start time in HH:MM format (24-hour).
        duration_minutes: Duration in minutes. Defaults to 60.

    Returns:
        Confirmation with the event link.
    """
    if _calendar_service is None:
        return "Calendar not connected. Cannot create event."
    try:
        result = _calendar_service.create_event(summary, date, time, duration_minutes)
        link = result.get("htmlLink", "")
        return f"Done — '{summary}' is on your calendar for {time} on {date}. {link}"
    except Exception as e:
        return f"Couldn't create event: {str(e)}"
```

```python
# backend/tools/tasks_tools.py
"""Tools for checking and creating Google Tasks."""

_tasks_service = None


def set_tasks_service(service):
    global _tasks_service
    _tasks_service = service


def check_existing_tasks(keyword: str) -> str:
    """Check if the user already has tasks matching a keyword.

    Use this when the user mentions something that might already be tracked,
    like "that project" or "the report".

    Args:
        keyword: A word or phrase to search for in existing tasks.

    Returns:
        Matching tasks, or a note that nothing was found.
    """
    if _tasks_service is None:
        return f"Tasks not connected. Cannot search for '{keyword}'."
    try:
        tasks = _tasks_service.check_existing(keyword)
        if not tasks:
            return f"No existing tasks matching '{keyword}'."
        titles = [t["title"] for t in tasks]
        return f"Found existing tasks: {', '.join(titles)}"
    except Exception as e:
        return f"Couldn't check tasks: {str(e)}"


def create_task(title: str, notes: str = "", due_date: str = "") -> str:
    """Create a Google Task for the user.

    Only call this AFTER the user has approved the action via the UI.

    Args:
        title: The task title.
        notes: Optional additional notes or context.
        due_date: Optional due date in YYYY-MM-DD format.

    Returns:
        Confirmation that the task was created.
    """
    if _tasks_service is None:
        return "Tasks not connected. Cannot create task."
    try:
        result = _tasks_service.create_task(title, notes, due_date or None)
        return f"Done — task '{title}' created."
    except Exception as e:
        return f"Couldn't create task: {str(e)}"
```

```python
# backend/tools/contacts_tools.py
"""Tools for resolving names via Google Contacts."""

_contacts_service = None


def set_contacts_service(service):
    global _contacts_service
    _contacts_service = service


def resolve_contact(name: str) -> str:
    """Look up a person's name in the user's Google Contacts.

    Use this when the user mentions a person by first name and you need to
    determine who they mean (e.g., "email Sarah" — which Sarah?).

    Args:
        name: The name to search for.

    Returns:
        Matching contacts with names and emails, or a note if none found.
    """
    if _contacts_service is None:
        return f"Contacts not connected. Cannot look up '{name}'."
    try:
        matches = _contacts_service.resolve_name(name)
        if not matches:
            return f"No contacts found matching '{name}'."
        lines = [f"- {m['name']} ({m['email']})" for m in matches]
        return f"Contacts matching '{name}':\n" + "\n".join(lines)
    except Exception as e:
        return f"Couldn't search contacts: {str(e)}"
```

**Step 2: Run existing tests to make sure nothing broke**

Run: `python -m pytest backend/tests/ -v`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add backend/tools/
git commit -m "feat: connect tool functions to Google service layer with runtime injection"
```

---

### Task 11: Frontend WebSocket Client

**Files:**
- Modify: `script.js`
- Modify: `index.html`

**Step 1: Add WebSocket audio streaming to the frontend**

Add a new class `LiveSession` to `script.js` that handles:
- WebSocket connection to `/ws/live`
- Microphone capture via Web Audio API (16kHz PCM mono)
- Speaker playback of received audio (24kHz PCM)
- Sending/receiving JSON messages (transcription, tool calls, text)
- Camera capture for vision input

```javascript
// Add to the end of script.js, before the DOMContentLoaded listener

class LiveSession {
    constructor() {
        this.ws = null;
        this.audioContext = null;
        this.mediaStream = null;
        this.isConnected = false;
        this.onTranscription = null;
        this.onToolCall = null;
        this.onText = null;
        this.playbackQueue = [];
        this.isPlaying = false;
    }

    async connect() {
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        this.ws = new WebSocket(`${protocol}//${location.host}/ws/live`);
        this.ws.binaryType = 'arraybuffer';

        return new Promise((resolve, reject) => {
            this.ws.onopen = () => {
                this.isConnected = true;
                resolve();
            };
            this.ws.onerror = (e) => reject(e);
            this.ws.onclose = () => {
                this.isConnected = false;
                this.stopMicrophone();
            };
            this.ws.onmessage = (event) => this.handleMessage(event);
        });
    }

    handleMessage(event) {
        if (event.data instanceof ArrayBuffer) {
            // Audio data — queue for playback
            this.playbackQueue.push(event.data);
            if (!this.isPlaying) this.playAudioQueue();
        } else {
            const msg = JSON.parse(event.data);
            switch (msg.type) {
                case 'transcription':
                    if (this.onTranscription) this.onTranscription(msg.text, msg.role);
                    break;
                case 'tool_call':
                    if (this.onToolCall) this.onToolCall(msg.name, msg.args);
                    break;
                case 'text':
                    if (this.onText) this.onText(msg.content, msg.author);
                    break;
            }
        }
    }

    async startMicrophone() {
        this.audioContext = new AudioContext({ sampleRate: 16000 });
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true }
        });

        const source = this.audioContext.createMediaStreamSource(this.mediaStream);
        const processor = this.audioContext.createScriptProcessor(4096, 1, 1);

        processor.onaudioprocess = (e) => {
            if (!this.isConnected) return;
            const float32 = e.inputBuffer.getChannelData(0);
            const int16 = new Int16Array(float32.length);
            for (let i = 0; i < float32.length; i++) {
                int16[i] = Math.max(-32768, Math.min(32767, Math.floor(float32[i] * 32768)));
            }
            this.ws.send(int16.buffer);
        };

        source.connect(processor);
        processor.connect(this.audioContext.destination);
    }

    stopMicrophone() {
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(t => t.stop());
            this.mediaStream = null;
        }
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }

    async playAudioQueue() {
        this.isPlaying = true;
        const playCtx = new AudioContext({ sampleRate: 24000 });

        while (this.playbackQueue.length > 0) {
            const data = this.playbackQueue.shift();
            const int16 = new Int16Array(data);
            const float32 = new Float32Array(int16.length);
            for (let i = 0; i < int16.length; i++) {
                float32[i] = int16[i] / 32768;
            }

            const buffer = playCtx.createBuffer(1, float32.length, 24000);
            buffer.getChannelData(0).set(float32);
            const source = playCtx.createBufferSource();
            source.buffer = buffer;
            source.connect(playCtx.destination);
            source.start();

            await new Promise(resolve => { source.onended = resolve; });
        }

        await playCtx.close();
        this.isPlaying = false;
    }

    async sendImage(imageDataUrl) {
        if (!this.isConnected) return;
        // Strip data URL prefix to get base64
        const base64 = imageDataUrl.split(',')[1];
        const mimeType = imageDataUrl.split(';')[0].split(':')[1];
        this.ws.send(JSON.stringify({
            type: 'image',
            data: base64,
            mime_type: mimeType,
        }));
    }

    sendText(text) {
        if (!this.isConnected) return;
        this.ws.send(JSON.stringify({ type: 'text', content: text }));
    }

    disconnect() {
        this.stopMicrophone();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}
```

**Step 2: Update MindSpace class to use LiveSession**

Add a "Start Voice Session" button and wire it up to LiveSession. Update the voice button handler to use the live session instead of the browser's SpeechRecognition API.

This involves modifying the `startVoiceInput` method and adding session management to the MindSpace class. The exact UI changes will depend on the existing layout — the voice button becomes the session toggle.

**Step 3: Commit**

```bash
git add script.js index.html
git commit -m "feat: add WebSocket client for Gemini Live audio streaming"
```

---

### Task 12: Sticky Note Approval UI

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `script.js`

**Step 1: Add sticky note section to HTML**

Add a new section after `thoughts-organized` for the action approval UI. Each thread from the session state becomes a card with approve/dismiss buttons.

```html
<!-- Add after the thoughts-organized section in index.html -->
<section class="action-cards" id="actionCards" style="display: none;">
    <h2>Here's what I heard</h2>
    <p class="subtitle">Tap to approve — I'll handle the rest.</p>
    <div class="cards-grid" id="cardsGrid"></div>
    <div class="action-buttons">
        <button class="release-btn" id="approveAllBtn">
            <span class="btn-text">Approve Selected</span>
            <span class="btn-icon">→</span>
        </button>
    </div>
</section>
```

**Step 2: Add styles for action cards**

Style the cards with the existing sage/sand palette. Unresolved threads get a dashed border. Each card shows: thread name, suggested action, context (if any), urgency indicator, and a checkbox.

**Step 3: Add JavaScript for card rendering and approval**

Wire up the `onText` callback from LiveSession to render action cards when The Handler sends its JSON response. On approval, send the approved actions back via WebSocket.

**Step 4: Commit**

```bash
git add index.html styles.css script.js
git commit -m "feat: add sticky note approval UI for action cards"
```

---

### Task 13: Vision Input (Camera Capture)

**Files:**
- Modify: `index.html`
- Modify: `script.js`

**Step 1: Add camera button and video preview**

Add a camera button next to the voice button. When clicked, it opens the device camera, captures a frame, and sends it to the live session via `sendImage()`.

```html
<!-- Add next to the voice-btn in index.html -->
<button class="helper-btn camera-btn" id="cameraInput" aria-label="Camera input">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/>
        <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5"/>
    </svg>
</button>
```

**Step 2: Add camera capture logic**

```javascript
// Add to MindSpace class
async captureImage() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    const video = document.createElement('video');
    video.srcObject = stream;
    await video.play();

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    stream.getTracks().forEach(t => t.stop());

    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    if (this.liveSession && this.liveSession.isConnected) {
        this.liveSession.sendImage(dataUrl);
        this.gentleNotification('Image sent to your companion.');
    }
}
```

**Step 3: Commit**

```bash
git add index.html script.js
git commit -m "feat: add camera capture for vision input"
```

---

### Task 14: OAuth Flow (Google Sign-In)

**Files:**
- Create: `backend/google/oauth_routes.py`
- Modify: `backend/main.py`
- Modify: `index.html`

**Step 1: Add OAuth routes to FastAPI**

```python
# backend/google/oauth_routes.py
"""Google OAuth routes for Mind Space."""
import os
from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow

router = APIRouter(prefix="/auth")

SCOPES = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/tasks",
    "https://www.googleapis.com/auth/contacts.readonly",
]

# In-memory credential store (replace with proper session management for production)
_user_credentials: dict[str, Credentials] = {}


@router.get("/login")
async def login(request: Request):
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": os.environ["GOOGLE_CLIENT_ID"],
                "client_secret": os.environ["GOOGLE_CLIENT_SECRET"],
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [str(request.url_for("oauth_callback"))],
            }
        },
        scopes=SCOPES,
        redirect_uri=str(request.url_for("oauth_callback")),
    )
    auth_url, _ = flow.authorization_url(prompt="consent")
    return RedirectResponse(auth_url)


@router.get("/callback")
async def oauth_callback(request: Request, code: str):
    flow = Flow.from_client_config(
        {
            "web": {
                "client_id": os.environ["GOOGLE_CLIENT_ID"],
                "client_secret": os.environ["GOOGLE_CLIENT_SECRET"],
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [str(request.url_for("oauth_callback"))],
            }
        },
        scopes=SCOPES,
        redirect_uri=str(request.url_for("oauth_callback")),
    )
    flow.fetch_token(code=code)
    creds = flow.credentials
    # Store credentials (use session ID in production)
    _user_credentials["current"] = creds
    return RedirectResponse("/")


def get_current_credentials() -> Credentials | None:
    return _user_credentials.get("current")
```

**Step 2: Register routes in main.py**

Add `from backend.google.oauth_routes import router as auth_router` and `app.include_router(auth_router)` to `main.py`.

**Step 3: Add sign-in button to frontend**

Add a "Connect Google" button in the header that links to `/auth/login`.

**Step 4: Commit**

```bash
git add backend/google/oauth_routes.py backend/main.py index.html
git commit -m "feat: add Google OAuth flow for Calendar/Tasks/Contacts access"
```

---

### Task 15: Deployment (Dockerfile + Cloud Run)

**Files:**
- Create: `Dockerfile`
- Create: `deployment/cloudbuild.yaml`

**Step 1: Write Dockerfile**

```dockerfile
# Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/
COPY index.html styles.css script.js ./

ENV PORT=8080

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

**Step 2: Write cloudbuild.yaml**

```yaml
# deployment/cloudbuild.yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/mind-space', '.']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/mind-space']
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    args:
      - 'run'
      - 'deploy'
      - 'mind-space'
      - '--image=gcr.io/$PROJECT_ID/mind-space'
      - '--region=us-central1'
      - '--platform=managed'
      - '--allow-unauthenticated'
    entrypoint: gcloud
```

**Step 3: Test Docker build locally**

Run: `docker build -t mind-space .`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add Dockerfile deployment/
git commit -m "feat: add Dockerfile and Cloud Build config for Cloud Run deployment"
```

---

### Task 16: End-to-End Integration Test

**Files:**
- Create: `backend/tests/test_integration.py`

**Step 1: Write integration test**

Test the full flow: FastAPI starts → WebSocket connects → send text message → receive response.

```python
# backend/tests/test_integration.py
import pytest
from httpx import AsyncClient, ASGITransport
from backend.main import app


@pytest.mark.asyncio
async def test_index_serves_html():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/")
        assert response.status_code == 200
        assert "Mind Space" in response.text


@pytest.mark.asyncio
async def test_auth_login_redirects():
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://test", follow_redirects=False
    ) as client:
        response = await client.get("/auth/login")
        # Should redirect to Google OAuth
        assert response.status_code in (302, 307)
```

**Step 2: Run integration tests**

Run: `python -m pytest backend/tests/test_integration.py -v`
Expected: Tests PASS (may need env vars set)

**Step 3: Commit**

```bash
git add backend/tests/test_integration.py
git commit -m "test: add integration tests for FastAPI endpoints"
```

---

### Task 17: Real-Time State Indicator UI

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `script.js`

**Step 1: Add state indicator to the header**

Show the current ADHD state detected by The Witness as a subtle pill in the header. Changes color based on state: sage for calm, sky-blue for spiral, lavender for overwhelm, peach for paralysis.

Also show active thread count and a live transcription feed below the main input area.

**Step 2: Wire up WebSocket events to update the indicator**

When the backend sends a `tool_call` or `text` event that includes state information, update the UI indicator.

**Step 3: Commit**

```bash
git add index.html styles.css script.js
git commit -m "feat: add real-time ADHD state indicator and transcription feed"
```

---

### Task 18: Demo Prep + Final Polish

**Files:**
- Various UI polish across `styles.css` and `script.js`

**Step 1: Test the three demo scenarios**

1. Calm brain dump → verify collaborative, playful responses
2. Anxious/spiral brain dump → verify grounding, slowing responses
3. Interrupt mid-thought → verify thread tracking and surfacing

**Step 2: Record demo video showing all three scenarios**

**Step 3: Final deploy to Cloud Run**

Run: `gcloud builds submit --config deployment/cloudbuild.yaml`

**Step 4: Commit and tag**

```bash
git add -A
git commit -m "feat: final polish for hackathon submission"
git tag v1.0.0-hackathon
```

---

## Summary

| Task | What It Builds | Estimated Effort |
|------|---------------|-----------------|
| 1 | Project scaffold + deps | 15 min |
| 2 | Session state model (Pydantic) | 30 min |
| 3 | Google API services (Calendar, Tasks, Contacts) | 45 min |
| 4 | Agent tool functions | 20 min |
| 5 | Agent persona system instructions | 30 min |
| 6 | The Witness agent (ADK) | 20 min |
| 7 | The Handler agent (ADK) | 15 min |
| 8 | Root agent + ADK App | 15 min |
| 9 | FastAPI server + WebSocket | 45 min |
| 10 | Tool runtime integration | 30 min |
| 11 | Frontend WebSocket client | 60 min |
| 12 | Sticky note approval UI | 60 min |
| 13 | Vision input (camera) | 30 min |
| 14 | OAuth flow | 45 min |
| 15 | Dockerfile + Cloud Run | 30 min |
| 16 | Integration tests | 30 min |
| 17 | State indicator UI | 45 min |
| 18 | Demo prep + polish | 120 min |
