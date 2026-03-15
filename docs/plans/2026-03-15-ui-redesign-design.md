# UI Redesign: Blob Buddy + Declutter

## Goals
1. Declutter main layout — voice interaction is the hero
2. Add character with a blob buddy mascot (corner companion)
3. Brain board moves to collapsible sidebar

## Layout Changes

### Main Area (center)
- Remove header title/subtitle/accent from main view (keep on login only)
- Compact fuel gauge — horizontal strip above pulse button
- Pulse button + chat log = primary focus, centered

### Collapsible Sidebar (right)
- Brain board lives here, collapsed by default
- Edge toggle button with item count badge
- Slides in/out with spring animation

### Blob Buddy (fixed, bottom-right corner)
- ~60-80px, inline SVG, CSS animated
- States: idle, low-energy, calm, energized, listening, thinking, breathing
- Reacts to fuel level, session state, breathe overlay

## Blob Buddy States

| State | Trigger | Visual |
|-------|---------|--------|
| Idle/sleepy | No session, fuel null | Half-closed eyes, gentle float |
| Low energy | Fuel 1-2 | Droopy, small zzz bubble |
| Calm | Fuel 3 | Soft smile, gentle bob |
| Energized | Fuel 4-5 | Wide eyes, bouncy wiggle |
| Listening | Voice session active + listening | Eyes wide, leaning forward, pulse |
| Thinking | AI responding | Eyes look up, thought dots |
| Breathing | Breathe overlay active | Expands/contracts with circle |

## Visual Polish
- Hand-drawn wiggly dividers
- Paper-curl shadows on sticky notes
- Spring easing on all transitions
- Login screen: large blob buddy waving as hero illustration

## Implementation Steps
1. Create BlobBuddy component (SVG + CSS animations)
2. Create CollapsibleSidebar component
3. Refactor App.jsx layout (remove header, restructure)
4. Compact FuelGauge variant
5. Update LoginScreen with blob hero
6. Visual polish pass (transitions, shadows, dividers)
7. Responsive adjustments
