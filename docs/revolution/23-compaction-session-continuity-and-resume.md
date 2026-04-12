# Compaction, Session Continuity, and Resume

## Why This Is a Core Problem

DHelix already compacts and already persists sessions. The weakness is that these two systems are still too loosely connected.

The 벤치마킹 대상 treats compaction and resume as one product capability. DHelix still treats them as adjacent features.

## Current DHelix Fault Lines

### 1. Compaction returns messages, not continuity state

`src/core/context-manager.ts` produces a compacted message set, but not a richer envelope describing:

- compact boundary
- preserved tail anchors
- restored attachments or state
- compaction reason

### 2. Resume is transcript-centric

`src/core/session-manager.ts` is solid for JSONL durability, but resume quality for long compacted sessions will lag unless compact boundaries and preserved-tail metadata are persisted too.

### 3. Session auto-save is a signal of missing ownership

`src/core/session-auto-save.ts` currently updates metadata by renaming the session to the same name. That is pragmatic, but it shows the persistence model still lacks a proper `touch` or heartbeat ownership path.

## Benchmark Signals from the External Target

Strong ideas worth copying:

- append-first continuity
- compact-boundary metadata
- post-compact state reinjection
- repeated compaction failure suppression
- resume that restores execution context, not just text

Official references also matter here:

- official overview
- official IDE integrations guide

## Development Plan

### Phase 1

Introduce a `CompactionEnvelope` returned by context compaction and persisted by session storage.

### Phase 2

Extend session metadata to include:

- last compacted at
- compaction count
- preserved-tail anchor ids
- transition summary for the latest turn

### Phase 3

Add real append-first transcript updates plus explicit metadata `touch()` support in `SessionManager`.

### Phase 4

Upgrade `/resume` so it can restore:

- runtime stage hints
- last active tools or tasks
- compact-boundary awareness
- richer operator summary

## Recommendation

This is not polish work. Long-session continuity is part of core reliability. If DHelix gets this right, it will feel dramatically more mature even before the next wave of feature expansion lands.
