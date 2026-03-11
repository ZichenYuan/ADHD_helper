"""Brain Dump tools — real-time categorization, task breakdown, suggestions, stress reset.

These tools are called BY the AI during live audio conversation. Each tool returns
a JSON string that the backend's WebSocket handler detects and forwards to the
frontend as a typed event. The AI also receives the return value so it can
reference the result in its spoken response.
"""

import json


def categorize_thought(category: str, text: str) -> str:
    """Sort a user's thought into a bucket during conversation.

    Call this whenever the user expresses a distinct thought, task, idea, or emotion.
    Do NOT wait until they are done talking — categorize incrementally as you hear things.

    Args:
        category: One of "task", "idea", "thought", or "emotion".
                  - task: Actionable items (e.g. "Email the boss", "Buy groceries")
                  - idea: Creative thoughts, "someday" projects (e.g. "Start a podcast")
                  - thought: Context or facts worth remembering (e.g. "Rent is due on the 5th")
                  - emotion: Feelings or vents (e.g. "I feel guilty about missing that deadline")
        text: A concise one-sentence summary of what the user said. Rephrase for clarity
              but preserve the user's intent.

    Returns:
        Confirmation message.
    """
    return json.dumps({
        "_tool_event": "categorize",
        "category": category,
        "text": text,
    })


def suggest_tasks(fuel_level: int) -> str:
    """Suggest energy-appropriate tasks from what the user has dumped so far.

    Call this when the user asks "what should I do?" or when you sense they want
    direction. Match the suggestion intensity to their fuel level.

    Args:
        fuel_level: The user's current energy level (1-5).
                    1 = survival mode (suggest 1 tiny task)
                    2 = low energy (1-2 small tasks)
                    3 = cruising (2-3 medium tasks)
                    4 = good energy (3-4 tasks)
                    5 = hyperfocus mode (tackle the big boss task)

    Returns:
        Instruction for the AI to formulate energy-matched suggestions.
    """
    guidance = {
        1: "Survival mode. Suggest only ONE tiny, 2-minute task. Be extra gentle.",
        2: "Low energy. Suggest 1-2 small, easy-win tasks. Keep it light.",
        3: "Cruising. Suggest 2-3 medium tasks. Balanced and doable.",
        4: "Good energy. Suggest 3-4 tasks including one bigger one.",
        5: "Hyperfocus mode. Go for the big boss task. Channel that energy.",
    }
    return json.dumps({
        "_tool_event": "suggestions",
        "fuel_level": fuel_level,
        "guidance": guidance.get(fuel_level, guidance[3]),
    })


def break_down_task(task: str) -> str:
    """Break a task into stupidly small micro-steps for ADHD-friendly execution.

    Call this when the user picks a task to work on, or when a task feels
    overwhelming to them. The first 3 steps MUST each take less than 60 seconds.

    Args:
        task: The task to break down (e.g. "Email the boss about the project update").

    Returns:
        Instruction for the AI to generate micro-steps.
    """
    return json.dumps({
        "_tool_event": "task_steps",
        "task": task,
    })


def activate_stress_reset(reason: str) -> str:
    """Trigger a calming breathe animation on the user's screen.

    Call this when you detect stress markers: the user sounds rushed, overwhelmed,
    anxious, or explicitly says they're stressed/panicking. Also call it if their
    voice pitch or speed increases significantly.

    After calling this, shift to an extra-calm, slow, spacious speaking style.
    Use short sentences. Give them room to breathe.

    Args:
        reason: Brief description of why the stress reset was triggered
                (e.g. "user sounds overwhelmed", "rapid speech detected",
                "user said they're panicking").

    Returns:
        Confirmation that the stress reset was activated.
    """
    return json.dumps({
        "_tool_event": "stress_reset",
        "reason": reason,
    })
