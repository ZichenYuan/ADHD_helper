### **Milestone 1: The Visual Foundation** ✅

- **Goal:** Build a "home" for the AI that doesn't overwhelm the user.
- **Key Features:** * A clean, "low-sensory" UI (minimalist colors).
    - The **"Fuel Gauge"**: A simple 1–5 selector for the user to report their energy level.
    - A central **"Pulse"** button to start/stop the voice session.
- **Test:** Can you click the buttons and see the UI update? Does it look clean and "calm"?

### **Milestone 2: The "Live Mirror" (Real-time Voice)** ✅

- **Goal:** Establish a near-instant voice connection with visual feedback.
- **Key Features:**
    - **Native Live Stream:** Integration with Gemini Live API for sub-1-second latency.
    - **Real-time Transcription:** A scrolling "Chat Log" (similar to the Gemini app) so users can see their words and the AI’s words as they happen.
    - **Barge-In:** The ability for the user to interrupt the AI mid-sentence.
- Test: Transcribes

### **Milestone 3: The Brain-First Engine** ✅

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

### **Milestone 4: The "Emotional Safety Net"** ✅

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

---

## Phase 2: Persistence & Identity

---

### **Milestone 5: Authentication (Simple Login)**

- **Goal:** Let users sign in so their brain dump data persists across sessions.
- **Design principle:** Absolute minimum friction. ADHD users will bounce off a long signup form.

**Evaluation of Options:**

| Option | Pros | Cons | Verdict |
| --- | --- | --- | --- |
| **Firebase Auth + Google Sign-In** | One click, zero forms, free (unlimited Google/email MAUs), same ecosystem as M6 database | Requires Google account | **✅ Primary method** |
| **Firebase Auth + Email/Password** | No external account needed, familiar | Password friction, forgot-password flow | **✅ Secondary method** |
| Auth0 | Polished, feature-rich | Overkill, adds a separate service, free tier limited to 25k MAUs | ❌ |
| Supabase Auth | Good DX | Introduces a second backend service since DB is Firebase | ❌ |
| Magic links (email-only) | Passwordless, low friction | Slow (check email), custom implementation | ❌ |
| Passkeys/WebAuthn | Cutting edge, passwordless | Browser support gaps, complex | ❌ Future option |

**Decision: Firebase Auth** — Google Sign-In as primary (one button, zero typing), email/password as fallback.

**Implementation Plan:**

1. **Firebase project setup**
   - Create Firebase project in console (shared with M6 Firestore)
   - Enable Google and Email/Password providers in Firebase Auth
   - Add `firebase` SDK to frontend (`npm install firebase`)
   - Create `src/firebase.js` config file (API keys from Firebase console → env vars)

2. **Auth context** (`src/contexts/AuthContext.jsx`)
   - `AuthProvider` wraps the app, manages `onAuthStateChanged` listener
   - Exposes `user`, `signInWithGoogle()`, `signInWithEmail()`, `signUp()`, `signOut()`
   - Persists auth state via Firebase's built-in `browserLocalPersistence`

3. **Login UI**
   - Minimal screen — shown when `user === null`
   - Big "Sign in with Google" button (matches the app's soft, calming aesthetic)
   - Collapsible "or use email" section below (text input + password + sign-up toggle)
   - No separate `/login` route — the login screen IS the app when logged out
   - After sign-in → seamless transition to the main app (the same calm visual)

4. **Backend auth** (for WebSocket)
   - Frontend sends Firebase ID token in the WebSocket `start` message: `{"type": "start", "token": "...", ...}`
   - Backend verifies token via `firebase-admin` SDK → extracts `uid`
   - Add `firebase-admin` + service account key to backend
   - Unauthenticated WebSocket connections rejected with `{"type": "error", "message": "auth_required"}`

5. **Sign-out**
   - Small user avatar/icon in the settings corner (top-right, next to language selector)
   - Click → popover with "Sign out" option

- **Test:** Can you sign in with Google in one click? Does refreshing the page keep you logged in? Does signing out show the login screen?

---

### **Milestone 6: Firebase Database (Firestore Persistence)**

- **Goal:** Board items survive page refresh. When a user logs in, their sticky notes are already there.

**Why Firestore (not Realtime Database):**
- Structured documents & collections (better for querying by category, completion status)
- Offline persistence built-in (items load even when offline)
- Security rules tied directly to Firebase Auth UIDs
- Free tier: 50k reads, 20k writes, 20k deletes per day — more than enough

**Data Model:**

```
users/{uid}/
  ├── profile (document)
  │     ├── displayName: string
  │     ├── email: string
  │     ├── createdAt: timestamp
  │     └── preferences: {
  │           language: "en" | "zh" | "es" | "ja" | "fr",
  │           lastFuelLevel: number | null,
  │           digestFrequency: "daily" | "weekly" | "none",
  │           digestDay: "monday" (only if weekly),
  │           digestHour: 9 (0-23, local time)
  │         }
  │
  └── items (subcollection)
        └── {itemId} (document)
              ├── text: string
              ├── category: "task" | "idea" | "thought" | "emotion"
              ├── completed: boolean (default: false)
              ├── createdAt: timestamp (serverTimestamp)
              ├── completedAt: timestamp | null
              └── sessionId: string (optional, for future session grouping)
```

**Why one `items` subcollection (not four separate collections):**
- Simpler code — one Firestore listener powers the entire BrainBoard
- Easy filtering: `where("completed", "==", false)` for active items
- Easy per-category queries: `where("category", "==", "task")`
- One place to add indexes, security rules, and future fields

**Sync Architecture (frontend-driven writes):**

```
During voice session:
  Backend tool categorize_thought() → sends WS event → Frontend receives →
    1. Updates React state (instant UI feedback)
    2. Writes to Firestore (persistence)

On page load (logged in):
  Firestore real-time listener on items where completed == false →
    Hydrates BrainBoard categories state
```

Frontend handles Firestore reads/writes directly via the Firebase JS SDK — no need to add `firebase-admin` to the Python backend for item storage. Auth verification on the backend is still via `firebase-admin` (from M5), but item persistence is frontend-only. This keeps the backend focused on what it's good at: WebSocket proxy + ADK.

**Implementation Plan:**

1. **Firestore setup**
   - Enable Firestore in the Firebase console (same project as Auth)
   - Deploy security rules:
     ```
     match /users/{uid}/items/{itemId} {
       allow read, write: if request.auth != null && request.auth.uid == uid;
     }
     match /users/{uid}/profile {
       allow read, write: if request.auth != null && request.auth.uid == uid;
     }
     ```

2. **Firestore hook** (`src/hooks/useFirestoreItems.js`)
   - Takes `uid` from AuthContext
   - Sets up `onSnapshot` real-time listener on `users/{uid}/items` where `completed == false`
   - Returns `{ items, addItem(category, text), completeItem(id), deleteItem(id) }`
   - Transforms Firestore docs into the `{ tasks: [], ideas: [], thoughts: [], emotions: [] }` shape BrainBoard expects

3. **Wire into App.jsx**
   - On `categorize` WS event → call `addItem(category, text)` (writes to Firestore, real-time listener updates state)
   - Pass Firestore-backed categories to `<BrainBoard />` instead of the ephemeral `useState`
   - On first load → Firestore listener hydrates the board automatically

4. **User profile doc**
   - Created on first sign-in (check if exists, create if not)
   - Stores preferences (language, fuel level, digest settings for M8)

**Future-proofing — Chat History (NOT implementing now):**
```
users/{uid}/sessions/{sessionId}/
  ├── startedAt: timestamp
  ├── endedAt: timestamp
  ├── fuelLevel: number
  ├── language: string
  └── messages (subcollection)
        └── {msgId}
              ├── role: "user" | "ai"
              ├── text: string
              └── timestamp: timestamp
```
Schema documented here for when we want to add session history. No code until then.

- **Test:** Add items via voice session → refresh the page → all sticky notes still there. Log in on a different device → same board.

---

### **Milestone 7: Complete & Delete Items**

- **Goal:** Users can mark items as done or remove them. The board is a living workspace, not a static capture.

**UX Design Decisions:**

| Decision | Choice | Why |
| --- | --- | --- |
| Complete gesture | Tap/click the item | Simple, discoverable. Tasks get a checkbox; other categories get a subtle ✓ on hover. |
| Delete gesture | Small × button on hover/focus | Always available but visually quiet — won't trigger accidentally. |
| After complete | Fade-out animation → item disappears | ADHD-friendly: less visual clutter. Completed items don't linger. |
| Undo | Toast notification for 5 seconds: "Marked done · Undo" | Safety net for accidental taps without adding UI complexity. |
| Show completed? | "Show completed" toggle per sticky note (collapsed by default) | Let users see progress when they want a dopamine hit, but hidden by default. |

**Frontend Changes:**

1. **BrainBoard item interactions**
   - Each `sticky-note__item` becomes interactive:
     - **Tasks:** Visible checkbox. Click → check animation → strike-through → fade out after 600ms.
     - **Ideas/Thoughts/Emotions:** Subtle × button appears on hover (or always visible on mobile). Click → fade out.
   - Both actions show an undo toast at the bottom of the screen.
   - Items store their Firestore doc ID (from M6) so we can target updates/deletes.

2. **Undo Toast component** (`src/components/UndoToast.jsx`)
   - Fixed at bottom-center, slides up when triggered.
   - Text: "Marked as done · Undo" or "Removed · Undo"
   - Auto-dismisses after 5 seconds.
   - On undo click → revert the Firestore write (re-add or un-complete).

3. **Completed items toggle**
   - Small text link at the bottom of each sticky note: "3 completed" (only shown if there are any).
   - Click → expands a muted, strike-through list of completed items (last 7 days).
   - Each completed item has a "restore" action.

**Firestore Operations:**

- **Complete:** `updateDoc(itemRef, { completed: true, completedAt: serverTimestamp() })`
  - Real-time listener (which filters `completed == false`) auto-removes it from the active list.
- **Delete:** `deleteDoc(itemRef)` — hard delete. The undo toast holds the item data in memory for 5s and re-creates the doc if undo is clicked.
- **Restore:** `updateDoc(itemRef, { completed: false, completedAt: null })`

**Stretch: Voice-driven completion**
- New tool: `complete_item(text)` — AI calls this when user says "I did the groceries"
- Fuzzy-matches against existing items, marks the best match as complete
- Not required for this milestone, but the schema supports it.

- **Test:** Check off a task → it fades out → "Undo" toast appears → click undo → item returns. Refresh → completed items stay completed. Toggle "show completed" → see your wins.

---

### **Milestone 8: The "Brain Dispatch" (Board Summary Email)**

- **Goal:** Users receive a periodic email showing their board state — what they captured, what they completed, what's pending. A warm check-in, not a productivity guilt-trip.

**Design Principles:**
- **Tone:** Warm, encouraging, brief. This is a friendly letter, not a task manager notification.
- **ADHD-friendly:** Scannable layout with color-coded categories (matching the app's palette). No walls of text.
- **Celebrate wins:** Lead with completions. "You knocked out 3 tasks! 🌿"
- **Gentle nudges:** "You have 2 ideas in the Spark Lab. Maybe one will call to you today?"
- **Never guilt:** No "overdue" language. No red badges. No "you haven't opened the app in 5 days."

**Frequency Options (user-configurable):**

| Setting | Schedule | Default? |
| --- | --- | --- |
| Daily | Every morning (user's chosen hour, default 9 AM) | ✅ Yes |
| Weekly | Every Monday morning | No |
| Never | Opted out | No |

Configured in user preferences (M6 `profile.preferences.digestFrequency`).

**Email Template — "The Brain Dispatch":**

```
Subject: Your Brain Dispatch — March 10

Hey [first name] 👋

Here's your board right now:

━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔲 Tasks (3 active)
  · Email the boss
  · Buy groceries
  · Schedule dentist

💡 Ideas (2 sparks)
  · Podcast about frogs
  · Redesign the living room

💭 Thoughts (1 noted)
  · Rent is due on the 5th now

💚 Emotions (1 logged)
  · Feeling anxious about the interview

━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Completed recently
  · Called the landlord (yesterday)
  · Submitted the report (2 days ago)

━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your last fuel level: ⚡ 3/5

[Open Brain Dump →]

━━━━━━━━━━━━━━━━━━━━━━━━━━━
To change how often you get this: [Settings]
```

**Tech Stack Decision:**

| Option | Pros | Cons | Verdict |
| --- | --- | --- | --- |
| **Firebase Cloud Functions (2nd gen) + Resend** | Same ecosystem, scheduled triggers built-in, Resend has clean API + React Email templates | Requires Blaze plan (pay-as-you-go, but basically free at low volume) | **✅ Chosen** |
| Cloud Functions + SendGrid | SendGrid is well-known | Clunky API, vendor lock-in | ❌ |
| Cloud Functions + Trigger Email extension | Firebase-native email extension | Less control over template, limited customization | ❌ |
| External cron (GitHub Actions) | No Cloud Functions needed | Separate infra, secrets management, cold starts | ❌ |

**Architecture:**

```
Cloud Scheduler (daily at each configured hour)
  └── Cloud Function: sendBrainDispatch()
        ├── Query all users where digestFrequency != "none"
        │   and digestHour matches current UTC hour
        ├── For each matching user:
        │     1. Query items where completed == false → active items
        │     2. Query items where completed == true
        │        and completedAt > 7 days ago → recent wins
        │     3. Read profile for name, preferences
        │     4. Render email (React Email template)
        │     5. Send via Resend API
        └── Log results
```

**Implementation Plan:**

1. **Firebase setup**
   - Upgrade to Blaze plan (required for Cloud Functions 2nd gen — free until usage exceeds generous limits)
   - Initialize `firebase-functions` in a `/functions` directory
   - Set up Resend account → get API key → store as Cloud Function secret

2. **Email template** (`functions/src/templates/BrainDispatch.jsx`)
   - Built with React Email (`@react-email/components`)
   - Uses the app's color palette (coral tasks, marigold ideas, lavender thoughts, sage emotions)
   - Responsive, works in all major email clients
   - Preheader text: "3 tasks · 2 ideas · 1 recently completed"

3. **Cloud Function** (`functions/src/index.ts`)
   - `onSchedule("every 1 hours")` — runs every hour, sends to users whose `digestHour` matches
   - Alternative: `onSchedule("every day 09:00")` for MVP (send everyone at 9 AM UTC, ignore time zones)
   - Uses `firebase-admin` to query Firestore
   - Uses Resend SDK to send

4. **User settings UI**
   - Add to the settings popover (top-right corner, next to language):
     - "Email me my board" toggle
     - Frequency: Daily / Weekly / Never
   - Writes to `users/{uid}/profile.preferences.digestFrequency`
   - Default: Daily at 9 AM (set on first login in M6 profile creation)

5. **Unsubscribe**
   - One-click unsubscribe link in every email footer (required by email regulations)
   - Links to a simple Cloud Function endpoint that sets `digestFrequency: "none"`

- **Test:** Set digest to daily → wait for scheduled run (or manually trigger the function) → receive email with your current board items. Click "Open Brain Dump" → lands on the app logged in. Click unsubscribe → no more emails.

---

## Implementation Order

M5 (Auth) → M6 (Firestore) → M7 (Complete/Delete) → M8 (Email)

Each milestone builds on the previous. M5 provides the `uid` that M6 needs. M6 provides the persistence that M7 modifies. M8 reads from M6's data and uses M5's user profiles.
