### **Milestone 1: The Visual Foundation**

- **Goal:** Build a "home" for the AI that doesn't overwhelm the user.
- **Key Features:** * A clean, "low-sensory" UI (minimalist colors).
    - The **"Fuel Gauge"**: A simple 1–5 selector for the user to report their energy level.
    - A central **"Pulse"** button to start/stop the voice session.
- **Test:** Can you click the buttons and see the UI update? Does it look clean and "calm"?

### **Milestone 2: The "Live Mirror" (Real-time Voice)**

- **Goal:** Establish a near-instant voice connection with visual feedback.
- **Key Features:**
    - **Native Live Stream:** Integration with Gemini Live API for sub-1-second latency.
    - **Real-time Transcription:** A scrolling "Chat Log" (similar to the Gemini app) so users can see their words and the AI’s words as they happen.
    - **Barge-In:** The ability for the user to interrupt the AI mid-sentence.
- Test: Transcribes

### **Milestone 3: The Brain-First Engine**

Part A: The Linearizer (The Categorizer)
When the user "dumps" their brain, the AI doesn't just make a list; it sorts the audio into psychological buckets. This clears mental space (Working Memory) without requiring the user to take action yet.
Recommended Categories for ADHD:
• Tasks (Actionable): Anything that requires a physical or digital action (e.g., "Email the boss").
• Ideas (Spark Lab): Creative thoughts or "someday" projects that shouldn't clutter today's view (e.g., "I should start a podcast about frogs").
• Thoughts & Context (The Archive): Useful info that isn't a task but needs to be remembered (e.g., "The landlord said the rent is due on the 5th now").
• Emotions (The Vent): Feelings that need to be acknowledged but not "fixed" (e.g., "I feel really guilty about missing that deadline"). *AI response: "I've noted that you're feeling stressed about the deadline. We'll keep that in mind."*
Part B: The "Energy Matcher" (Smart Suggestion)
Before showing any tasks, the app looks at the "Fuel Level" the user set in Milestone 1.

| **User Fuel Level** | **AI Strategy** | **Suggested Task Type** |
| --- | --- | --- |
| **1 (Fried)** | "Survival Mode" | Only 1 "Spark Step" (e.g., "Throw away one piece of trash"). |
| **3 (Stable)** | "Cruising" | 2–3 medium tasks or one "Main Quest." |
| **5 (On Fire)** | "Hyperfocus Mode" | The "Big Boss" tasks (Complex projects they've been avoiding). |

Part C: The Micro-Deconstructor (Task Initiation)
This only runs on Tasks. Once a task is chosen based on the user's energy, the AI breaks it down into "Stupidly Small" units.
The "Spark Step" Logic:
The first three checkboxes in the UI must be tasks that take **less than 60 seconds**.
• *Task:* "Write a difficult email."
• *Micro-Deconstruction:*
    1. [ ] Open your laptop.
    2. [ ] Open the browser.
    3. [ ] Type the recipient's name in the "To" field.

### **Milestone 4: The "Emotional Safety Net"**

**1. Real-Time Stress Detection (The Sensor)**

Instead of the user having to say "I'm stressed," the Gemini Live agent monitors the audio stream for "Stress Markers."

- **The Tech:** Gemini Live processes native audio. It can detect:
    - **Pitch Shifts:** A sharp rise in vocal frequency.
    - **Speech Rate:** Rapid-fire talking (cluttering).
    - **Volume Spikes:** Signs of frustration.
- **The Trigger:** When a threshold is hit, the AI triggers a **Function Call** called `activate_stress_reset()`.

**2. The "Breathe Animation" (The Reset)**

The moment `activate_stress_reset()` is called, the website UI changes to prioritize de-escalation over productivity.

- **The Visual:** A soft, expanding and contracting circle (or your Sidekick avatar "breathing").
- **The Interaction:** The AI's voice automatically shifts to a slower, warmer tone.
- **The Prompt:** *"I can hear things are getting a bit intense. Let's pause the quest for just a second. Follow the circle on your screen: In for four... hold... and out."*
