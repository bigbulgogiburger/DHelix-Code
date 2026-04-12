# dbcode Deep Upgrade Master Prompt for Claude

You are acting as a **Codex Master Developer**, principal engineer, product architect, terminal UX designer, and systems reliability lead for this repository.

The repository I am giving you is **dbcode**, a terminal-based AI coding agent that I built. Its ambition is not to be a toy or a partial assistant. Its ambition is to become a **serious, top-tier terminal AI coding agent** that can compete with or surpass tools like **Claude Code** and **Codex CLI** in real-world developer usage.

I do **not** want shallow refactoring, cosmetic cleanup, or small tactical patches.
I want a **deep, product-grade upgrade** of the entire system.

Your job is to audit, redesign where necessary, implement major improvements, and validate them rigorously.

---

## 1. Primary Objective

Upgrade **dbcode** until it reaches **Claude Code-level quality or better** in the areas that matter most to actual developers using a terminal AI coding agent every day.

This includes:

- stronger core agent quality
- better terminal UX / TUI quality
- more coherent architecture
- more reliable feature integration
- stronger command / skill / subagent model
- safer and more confidence-inspiring behavior
- better failure handling and recovery
- better testing, benchmarking, and validation
- better extensibility for future development

Do not optimize for minimal diff size.
Optimize for **real product quality**, **maintainability**, **operational trust**, and **competitive strength**.

---

## 2. Product Standard

Treat this repository as a serious competitor to Claude Code-class terminal agents.

The quality bar is:

- **product-grade**
- **architecturally coherent**
- **maintainable**
- **testable**
- **discoverable**
- **robust under failure**
- **comfortable for real developers**
- **safe enough to trust during real coding work**
- **competitive with the best terminal AI coding agents**

If needed, make structural changes instead of staying conservative.
Prefer deep correctness over superficial polish.

---

## 3. Areas You Must Improve

### A. TUI / CLI UX Quality

This system runs in the terminal, but that does **not** mean the interface should feel primitive, confusing, or purely technical.
Treat the terminal UI as a serious product surface.

Deeply evaluate and improve:

- input flow
- output structure
- information hierarchy
- progress visibility
- execution phase visibility
- tool execution feedback
- status indicators
- interruption / cancellation behavior
- retry messaging
- approval / permission UX
- navigation and command discoverability
- skill discoverability
- subagent visibility and traceability
- mode switching clarity
- session continuity and resumability
- error explanation quality
- trust and emotional stability of the UX
- cognitive load reduction
- consistency of wording and interaction patterns

I want the terminal experience to feel:

- clear
- intentional
- polished
- confidence-inspiring
- professional
- low-friction
- safe
- understandable during long multi-step workflows

The user should never feel lost, unsure what the agent is doing, or afraid that the tool is acting unpredictably.

---

### B. Core Agent Quality

One of my concerns is that the **core quality** of dbcode may be weaker than Claude Code-like systems.

You must deeply improve the core engine, especially around:

- planning quality
- step decomposition
- multi-step reasoning reliability
- tool selection quality
- tool-call correctness
- context handling
- context compression / summarization
- memory usage strategy
- model routing
- fallback strategy
- retry logic
- error classification
- recovery behavior
- structured outputs
- safe code editing behavior
- long task continuity
- consistency under noisy or incomplete information

I want you to identify where the design is promising but the implementation is still immature, brittle, or inconsistent.
Then improve it until it behaves more like a top-tier coding agent.

---

### C. Broken, Incomplete, or Weakly Connected Features

Another concern is that some features may already exist in code but are not truly operational or are only partially integrated.

You must search the entire repository for:

- dead paths
- stale abstractions
- incomplete integrations
- duplicated concepts
- misleadingly “finished-looking” features
- weak feature wiring
- systems that exist in isolation but do not work cleanly end-to-end
- architectural intent that is not matched by runtime behavior

Pay special attention to connections between:

- CLI / TUI ↔ core agent loop
- core loop ↔ tools
- core loop ↔ permissions
- commands ↔ runtime behavior
- skills ↔ invocation flow
- subagents ↔ orchestration and visibility
- memory ↔ reasoning flow
- model/provider abstractions ↔ actual runtime decisions
- MCP / LSP / plugin-style integrations ↔ user-facing usability
- status reporting ↔ actual execution state
- interrupted flows ↔ resumption / checkpointing

Classify issues clearly, for example:

- dead code
- incomplete integration
- inconsistent behavior
- missing UI exposure
- incorrect lifecycle wiring
- hidden reliability bug
- unsafe failure mode
- misleading abstraction
- maintainability hazard

Then fix the highest-impact issues first.

---

### D. Commands, Skills, Subagents, and Extensibility Model

I want dbcode’s extensibility model to feel powerful, coherent, and elegant.

You must deeply review and improve the architecture and UX of:

- commands
- skills
- subagents
- plugins
- tool exposure
- invocation patterns
- creation flow
- discovery flow
- execution flow
- composition and chaining
- argument handling
- developer ergonomics for extension authors
- runtime consistency
- permission and safety handling in these layers

Please identify:

- conceptual overlap between command / skill / subagent / plugin / tool layers
- leaky abstractions
- duplicated responsibilities
- inconsistent naming
- weak discoverability
- hard-to-use extension points
- end-to-end reliability issues
- places where power exists in theory but not in practical usage

Then redesign and implement improvements so these systems become:

- coherent
- composable
- discoverable
- predictable
- scalable
- contributor-friendly
- actually pleasant to use

The mental model should be easy for both users and developers to understand.

---

### E. User Trust, Comfort, and Operational Stability

A great coding agent is not just smart. It also makes users feel safe and in control.

You must improve:

- permission UX
- approval flows
- safe defaults
- rollback behavior
- checkpointing
- resumability
- failure transparency
- recovery guidance
- explainability of agent actions
- visible status during risky operations
- consistency of behavior under uncertainty

I want users to feel that dbcode is:

- reliable
- understandable
- stable
- safe to trust for meaningful coding tasks
- not likely to surprise them in dangerous ways

---

### F. Additional Improvements You Judge Necessary

Do not limit yourself only to the categories above.
If there are other changes required to make dbcode a genuinely competitive terminal AI coding agent, you must identify them and implement them.

Think like all of the following at once:

- principal engineer
- staff-level architect
- terminal UX designer
- reliability engineer
- AI systems engineer
- product owner for serious developer tooling

---

## 4. Required Work Sequence

Do **not** jump into random patching.
Work in this order.

### Phase 1 — Deep Repository Audit

Perform a deep audit of the entire repository and produce a structured diagnosis of:

- current architecture
- major subsystems
- strengths
- weaknesses
- design inconsistencies
- weak or missing connections
- UX flaws
- reliability risks
- maintainability concerns
- extensibility problems
- hidden complexity
- where the implementation falls short of the intended product

Be explicit, candid, and opinionated.

---

### Phase 2 — Competitive Gap Analysis

Compare dbcode conceptually against top-tier terminal coding agents such as Claude Code and Codex CLI style tools.

I want you to identify:

- what dbcode already has
- what dbcode partially has but immaturely
- what dbcode lacks
- what feels weaker than top-tier tools
- what prevents serious adoption by real developers
- what parts currently feel unfinished, fragmented, or not competitive enough

This comparison should guide your priorities.

---

### Phase 3 — Prioritized Upgrade Roadmap

Create a roadmap with clear prioritization:

- highest-impact quick wins
- medium-sized architectural improvements
- large structural improvements
- risky but high-value changes
- foundational changes that unlock other improvements

Explain:

- why each item matters
- what problem it solves
- what order it should happen in
- what trade-offs it introduces

---

### Phase 4 — Implementation

Then actually implement the improvements.
Do not stop at recommendations.

I want real, meaningful upgrades to the repository, not just analysis.

---

### Phase 5 — Validation and Proof

You must design and implement a real validation strategy.
I do not want vague claims like “this should be better.”
I want evidence, test coverage, workflow validation, and benchmark-style checks wherever possible.

---

## 5. Non-Negotiable Validation Requirements

You must build a meaningful validation framework using as many of the following as applicable:

- architecture-level validation
- integration tests
- regression tests
- realistic end-to-end terminal workflow tests
- command execution tests
- skill discovery / loading / execution tests
- subagent orchestration tests
- mixed workflow tests combining command + skill + subagent usage
- tool invocation correctness tests
- malformed tool output tests
- retry / recovery tests
- permission and approval flow tests
- interruption / cancellation / resume tests
- checkpoint and rollback tests
- context window stress tests
- noisy large-repository tests
- failure injection tests
- TUI interaction or snapshot-style tests where practical
- benchmark-style scenario evaluation

Do not avoid testing because it is hard.
This validation requirement is part of the core mission.

---

## 6. Required Realistic Scenarios

Create meaningful scenarios that reflect how serious developers actually use tools like Claude Code and Codex CLI.

At minimum, include scenarios like:

1. **Repository exploration and planning**
   - ask the agent to inspect a repo
   - summarize architecture
   - propose a plan before editing

2. **Safe code modification**
   - ask the agent to make a targeted code change
   - verify it edits the correct place
   - verify it does not make reckless changes

3. **Multi-step tool use**
   - agent must gather information through several steps
   - choose tools correctly
   - recover if a tool fails or returns malformed output

4. **Command and skill workflows**
   - use commands and skills individually and together
   - verify discovery, invocation, argument handling, output, and runtime consistency

5. **Subagent delegation**
   - spawn or delegate work to subagents
   - verify orchestration, visibility, result integration, and failure handling

6. **Interrupted session recovery**
   - simulate interrupted work
   - verify checkpointing and safe continuation or restart

7. **Permission-sensitive workflows**
   - validate approval prompts
   - validate safe behavior under restricted permissions
   - verify dangerous operations are clearly handled

8. **Large repository / noisy context**
   - test behavior in a medium or large repo
   - ensure the agent does not become brittle, confused, or low-quality too easily

9. **Ambiguous user requests**
   - verify the system handles ambiguity gracefully without collapsing into poor decisions

10. **Failure and recovery behavior**
   - invalid tool output
   - model failure
   - partial execution state
   - retry behavior
   - error explanation to the user

These scenarios should not be superficial.
They should resemble actual terminal coding-agent usage.

---

## 7. Output Style While Working

As you work, keep the output structured and useful.

For each major change, explain:

- what was wrong
- why it mattered
- what you changed
- how it improves competitiveness with Claude Code-level agents
- what trade-offs were involved
- how you validated it

When useful, group findings into:

- architecture
- UX
- reliability
- extensibility
- agent quality
- testing / benchmarking

Be concise where possible, but do not hide important reasoning.

---

## 8. Important Behavioral Instructions

- Do not be shallow.
- Do not settle for cosmetic cleanup.
- Do not optimize for small diffs.
- Do not leave major architectural contradictions unresolved.
- Do not assume existing abstractions are correct just because they already exist.
- Do not merely list problems—fix them.
- Do not stop at unit tests if integration or end-to-end validation is needed.
- Do not preserve weak UX because “it already works.”

Instead:

- be rigorous
- be product-minded
- be willing to restructure
- be explicit about trade-offs
- prefer long-term coherence over short-term patching
- optimize for real-world developer trust and success rate

---

## 9. Final Success Criteria

The work is successful only if dbcode becomes noticeably stronger in the following ways:

- it feels more like a world-class terminal coding agent
- it is easier and safer to use
- it behaves more coherently
- its features are more fully connected
- its command / skill / subagent story is more elegant and usable
- its core reasoning / execution loop is stronger and more reliable
- its failure handling is more mature
- its UX gives users more confidence
- its architecture is more maintainable
- its validation story is dramatically better
- it is realistically closer to or beyond Claude Code-level quality

---

## 10. Start Instruction

Start by auditing the repository deeply and identifying the **highest-leverage upgrade opportunities**.
Then produce a prioritized roadmap.
Then begin implementing the most important improvements with validation.

Treat this repository as a serious product that should compete with the best terminal AI coding agents available.

