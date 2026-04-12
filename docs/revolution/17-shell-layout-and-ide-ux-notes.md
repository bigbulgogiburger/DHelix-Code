# Shell Layout and IDE UX Notes

## Core Observation

The 벤치마킹 대상’s CLI feels more mature largely because it has a stronger shell-layout model, not just more components.

## 벤치마킹 대상 Patterns Worth Copying

### 1. Layout primitive above the prompt

`FullscreenLayout` acts like a reusable terminal shell:

- scrollable transcript
- sticky prompt region
- bottom status surfaces
- overlay channel
- modal channel
- unseen-message indicator

This keeps layout concerns out of the prompt component itself.

### 2. Footer items are controls, not labels

Footer pills participate in keyboard navigation through shared selection state.

That allows:

- arrow navigation
- Enter-to-open
- dynamic item appearance/disappearance
- predictable focus rules

### 3. Prompt overlay portal

Suggestion lists and dialogs are rendered in a separate overlay context rather than fighting fullscreen clipping behavior.

### 4. Ambient IDE integration

IDE detection and connection happen as a sidecar:

- opportunistic auto-detect
- non-blocking startup
- lightweight status hints
- live selection and diagnostics

## Current DHelix Gaps

### Gap A. App shell is still too transcript-local

The current UI is functional, but it needs a stronger separation between:

- shell layout
- prompt-local state
- cross-component interaction state

### Gap B. Footer semantics are too passive

Status bars should evolve into operator controls.

### Gap C. Overlay and modal semantics need their own abstraction

This is especially important before task panels and richer review flows are added.

### Gap D. IDE integration is present but not ambient enough

The extension and LSP bridge have more capability than the day-to-day UX exposes.

## Development Plan

### Phase 1. Introduce `ShellLayout`

Responsibilities:

- scrollable transcript frame
- sticky prompt frame
- bottom slot
- bottom float slot
- overlay slot
- modal slot

### Phase 2. Formalize footer navigation

Add shared app-state entries for:

- footer selection
- panel visibility
- active viewed task/agent
- prompt suggestion state
- IDE connectivity state

### Phase 3. Overlay and modal portals

Lift prompt suggestions and dialogs into dedicated contexts.

### Phase 4. Ambient IDE sidecar

Add:

- background IDE detection
- selection sharing
- diagnostics awareness
- light status hints

## Recommendation

If DHelix wants a more serious CLI, it should first become a better shell before becoming a busier screen.
