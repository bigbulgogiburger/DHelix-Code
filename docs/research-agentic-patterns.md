# Agentic Coding Patterns & Frameworks Research

> Research for dhelix architecture decisions
> Date: 2026-03-05

---

## Table of Contents

1. [Agentic Loop Patterns](#1-agentic-loop-patterns)
2. [Open-Source AI Coding Agents Analysis](#2-open-source-ai-coding-agents-analysis)
3. [Tool Use Implementation](#3-tool-use-implementation)
4. [Multi-Turn Conversation Management](#4-multi-turn-conversation-management)
5. [Context Window Optimization](#5-context-window-optimization)
6. [Error Recovery Patterns](#6-error-recovery-patterns)
7. [Agent Frameworks Comparison](#7-agent-frameworks-comparison)
8. [Parallel Tool Execution](#8-parallel-tool-execution)
9. [Code Editing Algorithms](#9-code-editing-algorithms)
10. [Prompt Engineering for Coding Agents](#10-prompt-engineering-for-coding-agents)
11. [Recommendations for dhelix](#11-recommendations-for-dhelix)

---

## 1. Agentic Loop Patterns

### 1.1 ReAct (Reason + Act)

The dominant pattern for AI coding agents. The agent alternates between reasoning about the next step and executing an action, rather than planning everything upfront.

```
┌─────────────────────────────────────┐
│           ReAct Loop                │
│                                     │
│  Observation ──> Thought ──> Action │
│       ^                      │      │
│       └──────────────────────┘      │
└─────────────────────────────────────┘
```

**How it works:**

1. Agent receives a task
2. **Thought**: Reasons about current state and what to do next
3. **Action**: Executes a tool (read file, edit code, run command)
4. **Observation**: Processes tool result
5. Repeat until task complete or stop condition met

**Pros:**

- Natural fit for coding tasks (read code, reason, edit, verify)
- Each step is observable and debuggable
- Handles unexpected situations gracefully (adapts to tool failures)
- Well-supported by all major LLM providers

**Cons:**

- Can be slow for tasks that could be parallelized
- Risk of "wandering" without clear direction
- Token-expensive due to interleaved reasoning

**Relevance to dhelix:** HIGH - This should be the primary loop pattern. Claude Code uses this exact pattern and it's proven at scale.

### 1.2 Plan-and-Execute

The agent first creates a structured plan, then executes steps sequentially, tracking progress along the way.

```
┌──────────────────────────────────────────┐
│         Plan-and-Execute                 │
│                                          │
│  Task ──> [Plan]                         │
│            ├── Step 1 ──> Execute ──> ✓  │
│            ├── Step 2 ──> Execute ──> ✓  │
│            ├── Step 3 ──> Execute ──> ?  │
│            │   └── Replan if needed      │
│            └── Step N ──> Execute ──> ✓  │
└──────────────────────────────────────────┘
```

**How it works:**

1. Analyze requirements and identify dependencies
2. Generate ordered step list
3. Execute each step, tracking status
4. Optionally replan if conditions change

**Pros:**

- Great for complex, multi-step tasks (large refactors, new features)
- User can review plan before execution
- Progress tracking is natural
- Enables parallel execution of independent steps

**Cons:**

- Planning overhead for simple tasks
- Plans may become stale as codebase changes during execution
- Requires replanning capability when steps fail

**Relevance to dhelix:** MEDIUM-HIGH - Useful as a "mode" for complex tasks. Should be available but not the default for simple questions.

### 1.3 Reflection / Self-Critique

The agent generates an output, then evaluates its own work before presenting it.

```
┌─────────────────────────────────────┐
│        Reflection Loop              │
│                                     │
│  Generate ──> Critique ──> Revise   │
│                  │                  │
│              Accept if OK           │
└─────────────────────────────────────┘
```

**How it works:**

1. Agent generates initial response/code
2. Switches to "critic mode" - evaluates for correctness, edge cases, style
3. If issues found, revises and re-evaluates
4. Presents final refined output

**Pros:**

- Catches errors before presenting to user
- Improves code quality through self-review
- Can enforce coding standards and security checks

**Cons:**

- Doubles (or more) token usage
- Latency increases with each reflection round
- Risk of over-optimization or infinite loops

**Relevance to dhelix:** MEDIUM - Valuable for code generation but expensive. Best used selectively (e.g., when generating new files or complex logic, not for simple edits).

### 1.4 Tree of Thoughts (ToT)

Explores multiple reasoning paths in parallel before selecting the best one.

```
┌─────────────────────────────────────────┐
│        Tree of Thoughts                 │
│                                         │
│  Problem ──┬── Path A ──> Evaluate      │
│            ├── Path B ──> Evaluate ──✓  │
│            └── Path C ──> Evaluate      │
│                                         │
│  Select best path, continue exploring   │
└─────────────────────────────────────────┘
```

**Pros:** Better for problems with multiple viable approaches
**Cons:** Very expensive, high latency

**Relevance to dhelix:** LOW - Overkill for most coding tasks. May be useful for architectural decisions but not practical for a CLI tool's primary loop.

### 1.5 Pattern Recommendation for dhelix

```
┌─────────────────────────────────────────────────┐
│  dhelix Recommended Hybrid Pattern              │
│                                                 │
│  User Input                                     │
│      │                                          │
│      ├── Simple query? ──> ReAct (default)      │
│      │                                          │
│      ├── Complex task? ──> Plan-and-Execute      │
│      │                     with ReAct per step  │
│      │                                          │
│      └── Code generation? ──> ReAct + Reflection│
│                                                 │
│  All loops: while(tool_call) { execute; feed }  │
└─────────────────────────────────────────────────┘
```

---

## 2. Open-Source AI Coding Agents Analysis

### 2.1 Claude Code

**Architecture:** Single-threaded master loop ("nO" pattern)

```
┌──────────────────────────────────────────────┐
│  Claude Code Master Loop                     │
│                                              │
│  while (response.has_tool_calls) {           │
│    results = execute_tools(response)         │
│    response = llm.call(messages + results)   │
│  }                                           │
│  return response.text                        │
│                                              │
│  Key Components:                             │
│  - CLAUDE.md for project memory              │
│  - Compressor for context management         │
│  - Sub-agents for parallel exploration       │
│  - Real-time steering (async dual-buffer)    │
│  - Hooks for lifecycle events                │
│  - MCP for extensible tool integration       │
└──────────────────────────────────────────────┘
```

**Key Design Decisions:**

- Simple while-loop over complex orchestration
- Single-threaded for debuggability and transparency
- Sub-agents with strict depth limits (no recursive spawning)
- File-based memory (CLAUDE.md) over databases
- Tool results feed directly back into conversation
- User can inject instructions mid-execution ("real-time steering")

**Lessons for dhelix:**

- Simplicity wins: a single loop with good tools beats complex orchestration
- Project-level memory files are intuitive and version-controllable
- Sub-agents should be depth-limited to prevent runaway costs
- Streaming output with interruptibility is essential for UX

### 2.2 Aider

**Architecture:** Terminal-based, architect/editor dual-model pattern

```
┌──────────────────────────────────────────────┐
│  Aider Architecture                          │
│                                              │
│  Repository Map (tree-sitter AST)            │
│      │                                       │
│      ├── Graph ranking algorithm             │
│      │   (files as nodes, deps as edges)     │
│      │                                       │
│  Architect Model ──> Proposes changes        │
│      │                                       │
│  Editor Model ──> Applies as search/replace  │
│      │                                       │
│  Git integration (auto-commit)               │
└──────────────────────────────────────────────┘
```

**Key Design Decisions:**

- Repository map: Uses tree-sitter to build AST, ranks files by relevance using graph algorithm
- Architect/Editor split: One model reasons about changes, another applies them (85% on editing benchmark)
- Search/Replace blocks as the primary edit format
- Unified diff as alternative format (3x less lazy than whole-file)
- Git-native: Every change is a commit, enabling easy rollback
- User manually adds files to chat context

**Lessons for dhelix:**

- Repository mapping is essential for large codebases
- The architect/editor split is proven effective
- Git integration should be first-class
- Multiple edit format options allow optimization per model

### 2.3 OpenHands (formerly OpenDevin)

**Architecture:** Event-sourced, stateless, composable SDK

```
┌──────────────────────────────────────────────────┐
│  OpenHands SDK Architecture                      │
│                                                  │
│  ┌───────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  SDK      │  │  Tools   │  │  Workspace   │  │
│  │  (core)   │  │  (actions│  │  (local/     │  │
│  │           │  │   & obs) │  │   remote)    │  │
│  └─────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│        │             │               │           │
│        └─────────────┼───────────────┘           │
│                      │                           │
│         ┌────────────┴────────────┐              │
│         │  ConversationState      │              │
│         │  (event log, single     │              │
│         │   source of truth)      │              │
│         └─────────────────────────┘              │
│                                                  │
│  Server package for production deployment        │
└──────────────────────────────────────────────────┘
```

**Key Design Decisions:**

- Stateless by default: All components are immutable, validated at construction
- Event-sourced: All interactions are immutable events in an append-only log
- Single ConversationState object holds all mutable context
- Sandboxed execution (Docker containers)
- Modular: Agent, Tools, Workspace, Server are separate packages
- 72% resolution rate on SWE-Bench Verified (Claude Sonnet 4.5)

**Lessons for dhelix:**

- Event sourcing enables replay, debugging, and recovery
- Stateless agents are easier to test and reason about
- Separation of workspace concerns (local vs remote) matters
- Sandbox execution is important for security

### 2.4 SWE-Agent

**Architecture:** Specialized for GitHub issue resolution

**Key Features:**

- Custom "ACI" (Agent-Computer Interface) designed for LLMs
- Simplified file navigation commands
- Structured search and edit operations
- Focused on decomposing issues into actionable steps

**Lessons for dhelix:**

- Specialized tools designed for LLMs outperform generic CLI wrappers
- The interface the agent uses matters as much as the model

### 2.5 Architecture Comparison Table

| Feature          | Claude Code            | Aider                     | OpenHands                | SWE-Agent         |
| ---------------- | ---------------------- | ------------------------- | ------------------------ | ----------------- |
| Loop Pattern     | ReAct (single loop)    | Architect/Editor          | Event-sourced ReAct      | Plan-Execute      |
| Edit Format      | Search/Replace         | Search/Replace + Diff     | Line-based + Draft       | Custom ACI        |
| Context Strategy | Compaction + CLAUDE.md | Repo map + manual files   | Event log + condensation | Focused context   |
| Multi-model      | Sub-agents             | Architect + Editor        | Configurable             | Single model      |
| Sandbox          | No (runs locally)      | No (runs locally)         | Docker containers        | Docker containers |
| Git Integration  | Via tools              | First-class (auto-commit) | Via tools                | GitHub-native     |
| MCP Support      | Yes                    | No                        | No                       | No                |
| Memory           | CLAUDE.md files        | Git history               | Event log                | Session-based     |

---

## 3. Tool Use Implementation

### 3.1 Native Function Calling (Recommended)

Modern LLMs support native function/tool calling where the model outputs structured tool invocations that the runtime executes.

```
┌────────────────────────────────────────────────┐
│  Native Function Calling Flow                  │
│                                                │
│  Developer defines tool schemas (JSON Schema)  │
│       │                                        │
│  LLM receives schemas in system/tools block    │
│       │                                        │
│  LLM decides to call tool ──> tool_use block   │
│       │                                        │
│  Runtime executes tool, returns result          │
│       │                                        │
│  LLM processes result, continues or responds   │
└────────────────────────────────────────────────┘
```

**Implementation approaches:**

| Approach         | Provider         | Pros                                 | Cons                            |
| ---------------- | ---------------- | ------------------------------------ | ------------------------------- |
| Native tool_use  | Anthropic/Claude | Reliable, structured output          | Vendor-specific format          |
| Function calling | OpenAI           | Wide adoption, strict mode available | Vendor-specific format          |
| XML-based        | Custom           | Model-agnostic, works with any LLM   | Requires parsing, less reliable |
| JSON mode        | Various          | Structured output guarantee          | Less flexible than native tools |

### 3.2 Tool Schema Design Principles

1. **Minimal, non-overlapping tools**: Each tool should have a clear, unique purpose
2. **Descriptive names and descriptions**: The model selects tools based on descriptions
3. **Strict typing**: Use JSON Schema with required fields, enums, and constraints
4. **Token-efficient results**: Return only what the model needs, not raw dumps
5. **Error as information**: Tool failures should return informative error messages

### 3.3 Model Context Protocol (MCP)

MCP is an open standard for connecting LLMs to external tools and data sources.

```
┌────────────────────────────────────────────────┐
│  MCP Architecture                              │
│                                                │
│  Agent ──> MCP Client ──> MCP Server ──> Tool  │
│                                                │
│  Benefits:                                     │
│  - Standardized tool interface                 │
│  - Community ecosystem of tools                │
│  - Tool discovery and capability negotiation   │
│  - Transport-agnostic (stdio, HTTP, SSE)       │
└────────────────────────────────────────────────┘
```

**Relevance to dhelix:** HIGH - MCP support should be a core feature, enabling users to extend dhelix with custom tools without modifying dhelix itself.

---

## 4. Multi-Turn Conversation Management

### 4.1 Memory Architecture

```
┌──────────────────────────────────────────────────┐
│  Memory Hierarchy for Coding Agents              │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │  Working Memory (Context Window)            │ │
│  │  - Current conversation turns               │ │
│  │  - Active file contents                     │ │
│  │  - Recent tool results                      │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │  Session Memory (Within conversation)       │ │
│  │  - Compacted/summarized earlier turns        │ │
│  │  - Scratchpad notes                         │ │
│  │  - Task progress state                      │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │  Persistent Memory (Across sessions)        │ │
│  │  - Project rules (CLAUDE.md equivalent)     │ │
│  │  - User preferences                         │ │
│  │  - Learned patterns / corrections           │ │
│  │  - Repository index / map                   │ │
│  └─────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

### 4.2 State Management Strategies

| Strategy       | Description                               | When to Use                                |
| -------------- | ----------------------------------------- | ------------------------------------------ |
| Full history   | Keep all messages                         | Short conversations (<50 turns)            |
| Sliding window | Keep last N turns                         | Medium conversations                       |
| Compaction     | Summarize old turns                       | Long conversations (Claude Code uses this) |
| Event sourcing | Append-only event log                     | Production systems needing replay          |
| Hierarchical   | Progressive summarization as messages age | Very long sessions                         |

### 4.3 Conversation Persistence

For a CLI tool like dhelix:

- **Session state**: Serialize conversation to disk (JSON/SQLite)
- **Resume capability**: Allow users to continue previous sessions
- **Project context**: Auto-load project rules and memory on start
- **Cross-session learning**: Store user preferences and project patterns

---

## 5. Context Window Optimization

### 5.1 The Four Strategies (Context Engineering)

Based on Anthropic's research and Lance Martin's context engineering framework:

```
┌──────────────────────────────────────────────────┐
│  Context Engineering: 4 Strategies               │
│                                                  │
│  1. WRITE  ──> Save info outside context window  │
│     - Scratchpads, notes files                   │
│     - Long-term memory stores                    │
│     - Repository maps and indexes                │
│                                                  │
│  2. SELECT ──> Pull relevant info into window    │
│     - RAG for code (semantic search)             │
│     - Repository map ranking                     │
│     - Grep/file search tool results              │
│     - Knowledge graph retrieval                  │
│                                                  │
│  3. COMPRESS ──> Reduce tokens, keep signal      │
│     - Conversation compaction/summarization       │
│     - Tool result trimming                       │
│     - Hierarchical summarization                 │
│                                                  │
│  4. ISOLATE ──> Split context across systems     │
│     - Sub-agent architectures                    │
│     - Sandboxed environments                     │
│     - Selective state exposure                   │
└──────────────────────────────────────────────────┘
```

### 5.2 Key Principles

1. **Treat context as finite**: Every token depletes the attention budget. "Context rot" degrades accuracy as token count increases.

2. **High-signal minimalism**: Find the smallest set of high-signal tokens that maximize outcome quality. Not brevity for its own sake, but precision.

3. **Right-altitude system prompts**: Balance specificity with flexibility. Avoid hardcoded brittle logic or vague guidance.

4. **Curate tools and examples**: Minimal, non-overlapping tool sets with clear purposes. Examples are "pictures worth a thousand words."

### 5.3 Code-Specific Context Strategies

| Technique              | Description                                          | Used By            |
| ---------------------- | ---------------------------------------------------- | ------------------ |
| Repo map               | AST-based file dependency graph, ranked by relevance | Aider              |
| Semantic search        | Embedding-based code search with re-ranking          | Windsurf, Cursor   |
| Grep + file search     | Traditional text search as tools                     | Claude Code        |
| AST chunking           | Parse code into semantic chunks (functions, classes) | OpenHands          |
| Auto-compaction        | Summarize at 95% context utilization                 | Claude Code        |
| Selective file loading | Only load files the agent requests                   | Aider, Claude Code |
| Knowledge graph        | Index code relationships for retrieval               | Windsurf           |

### 5.4 Recommendation for dhelix

Implement a **layered context strategy**:

1. **Always present**: System prompt, project rules, repository map summary
2. **On-demand**: File contents loaded via tools, search results
3. **Auto-managed**: Compaction triggers at 80-90% context usage
4. **Persistent**: Project memory file, user preferences

---

## 6. Error Recovery Patterns

### 6.1 Self-Correction Loop

```
┌──────────────────────────────────────────────────┐
│  Self-Correction Pattern                         │
│                                                  │
│  Execute action                                  │
│      │                                           │
│      ├── Success ──> Continue                    │
│      │                                           │
│      └── Failure ──> Read error message          │
│              │                                   │
│              ├── Transient? ──> Retry (backoff)  │
│              │                                   │
│              ├── Fixable? ──> Fix and retry       │
│              │   (e.g., syntax error, missing     │
│              │    import, wrong path)             │
│              │                                   │
│              └── Permanent? ──> Fallback/Report  │
│                  (e.g., missing dependency,       │
│                   permission denied)             │
└──────────────────────────────────────────────────┘
```

### 6.2 Error Classification

| Error Type                     | Strategy                           | Max Retries |
| ------------------------------ | ---------------------------------- | ----------- |
| Network timeout                | Retry with exponential backoff     | 3           |
| LLM rate limit                 | Retry with backoff, fallback model | 3           |
| Syntax error in generated code | Feed error back to LLM, ask to fix | 2           |
| Build/test failure             | Feed error output to LLM           | 3           |
| File not found                 | Ask LLM to search for correct path | 1           |
| Permission denied              | Report to user, ask for guidance   | 0           |
| Context overflow               | Compact/summarize and retry        | 1           |

### 6.3 Graceful Degradation Stack

```
Primary model (e.g., Claude Opus)
    │ fails
    ├──> Retry with same model (1-2 attempts)
    │ still fails
    ├──> Fallback to secondary model (e.g., Claude Sonnet)
    │ still fails
    ├──> Fallback to local model (if available)
    │ still fails
    └──> Report failure, suggest manual action
```

### 6.4 Key Principles

1. **Feed errors back as context**: The error message itself is the best debugging information for the LLM
2. **Classify before retrying**: Don't retry permanent failures
3. **Limit retry depth**: Max 3 retries per action to prevent loops
4. **Preserve user trust**: Always inform the user about failures and recovery attempts
5. **Self-healing code**: Agent runs tests/lint after edits, fixes issues automatically

---

## 7. Agent Frameworks Comparison

### 7.1 Framework Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Agent Framework Spectrum                                   │
│                                                             │
│  Lightweight ◄────────────────────────────► Full Framework  │
│                                                             │
│  OpenAI SDK    Claude SDK    LangGraph    CrewAI   AutoGen  │
│  (minimal     (tools +      (stateful    (role-   (async    │
│   primitives)  sub-agents)   graphs)      based)   convo)   │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Detailed Comparison

| Feature                  | Claude Agent SDK         | OpenAI Agents SDK                                    | LangGraph                        | CrewAI                     | AutoGen                      |
| ------------------------ | ------------------------ | ---------------------------------------------------- | -------------------------------- | -------------------------- | ---------------------------- |
| **Architecture**         | Single loop + sub-agents | 4 primitives (agents, handoffs, guardrails, tracing) | Stateful graph with checkpoints  | Role-based crews           | Async conversation           |
| **State Management**     | Conversation + CLAUDE.md | Minimal (handoff-based)                              | First-class (serializable state) | Shared crew memory         | Message passing              |
| **Model Support**        | Anthropic Claude         | OpenAI models                                        | Any LLM                          | Any LLM                    | Any LLM                      |
| **Complexity**           | Low                      | Low                                                  | Medium-High                      | Medium                     | Medium-High                  |
| **Best For**             | Coding agents, file ops  | Simple tool-using agents                             | Complex stateful workflows       | Team-based task delegation | Multi-agent debate/consensus |
| **MCP Support**          | Native                   | Via tools                                            | Via integration                  | Via tools                  | Via tools                    |
| **Production Readiness** | High                     | Medium                                               | High                             | Medium                     | Medium                       |

### 7.3 Anthropic's Recommendation

From "Building Effective Agents":

> "The most successful implementations weren't using complex frameworks or specialized libraries but instead were building with simple, composable patterns."

### 7.4 Anthropic's 6 Composable Patterns

1. **Augmented LLM**: LLM + retrieval + tools + memory (foundation)
2. **Prompt Chaining**: Sequential LLM calls with validation gates
3. **Routing**: Classify input, direct to specialized handler
4. **Parallelization**: Independent subtasks or voting for confidence
5. **Orchestrator-Workers**: Dynamic task decomposition and delegation
6. **Evaluator-Optimizer**: Generate-evaluate-refine loop

### 7.5 Recommendation for dhelix

**Build custom, not framework-dependent.** Use a simple agentic loop inspired by Claude Code's architecture:

```typescript
// Core loop pseudocode
async function agenticLoop(userMessage: string, context: ConversationContext) {
  context.addUserMessage(userMessage);

  while (true) {
    const response = await llm.call(context.getMessages(), tools);

    if (response.hasToolCalls()) {
      const results = await executeTools(response.toolCalls);
      context.addAssistantMessage(response);
      context.addToolResults(results);

      if (context.isNearLimit()) {
        await context.compact(); // Summarize old messages
      }
    } else {
      context.addAssistantMessage(response);
      return response.text;
    }
  }
}
```

Rationale: Frameworks add dependency risk and abstraction overhead. For a CLI tool, a custom loop gives full control over UX, streaming, and tool execution.

---

## 8. Parallel Tool Execution

### 8.1 When Parallel Execution is Safe

```
┌──────────────────────────────────────────────────┐
│  Safe for Parallel Execution                     │
│                                                  │
│  ✓ Multiple file reads (no writes)               │
│  ✓ Multiple independent searches (grep, glob)    │
│  ✓ Web searches for different topics             │
│  ✓ Running independent tests                     │
│  ✓ Reading multiple API responses                │
│                                                  │
│  NOT Safe for Parallel Execution                 │
│                                                  │
│  ✗ Read then write to same file                  │
│  ✗ Write to same file from multiple tools        │
│  ✗ Operations with ordering dependencies          │
│  ✗ Tools that modify shared state                │
│  ✗ Commands that depend on prior command output   │
└──────────────────────────────────────────────────┘
```

### 8.2 Implementation Pattern

```typescript
async function executeTools(toolCalls: ToolCall[]): Promise<ToolResult[]> {
  // Classify tools
  const readOnly = toolCalls.filter((t) => isReadOnly(t));
  const stateful = toolCalls.filter((t) => !isReadOnly(t));

  // Execute read-only tools in parallel
  const readResults = await Promise.all(readOnly.map((tool) => executeTool(tool)));

  // Execute stateful tools sequentially
  const writeResults = [];
  for (const tool of stateful) {
    writeResults.push(await executeTool(tool));
  }

  return [...readResults, ...writeResults];
}
```

### 8.3 Detection Strategies

| Strategy              | Description                                       | Complexity |
| --------------------- | ------------------------------------------------- | ---------- |
| Static classification | Mark tools as read-only or stateful in schema     | Low        |
| Dependency analysis   | Check if tool outputs feed into other tool inputs | Medium     |
| Resource locking      | Lock files/resources, detect conflicts            | High       |
| LLM-guided            | Ask the model to declare dependencies             | Low        |

### 8.4 Concurrency Controls

- **Max concurrent**: Configurable limit (default 10)
- **Timeout per tool**: Prevent hanging tools from blocking
- **Cancellation**: AbortSignal propagation for clean termination
- **Order preservation**: Results tagged with origin for correct sequencing
- **Resource limits**: Prevent system overload from too many concurrent operations

---

## 9. Code Editing Algorithms

### 9.1 Approach Comparison

```
┌──────────────────────────────────────────────────────────┐
│  Code Editing Approaches                                 │
│                                                          │
│  Precision ◄──────────────────────────────► Simplicity   │
│                                                          │
│  AST-based    Search/Replace    Unified Diff   Whole File│
│  (tree-sitter  (Claude Code,    (Aider,        (small    │
│   transforms)   Aider, Cline)   OpenHands)      files)   │
└──────────────────────────────────────────────────────────┘
```

### 9.2 Search/Replace (Recommended Primary)

```
<<<<<<< SEARCH
function oldName(x) {
  return x * 2
}
=======
function newName(x: number): number {
  return x * 2
}
>>>>>>> REPLACE
```

**Matching Strategy (layered fallback):**

1. Exact match
2. Whitespace-normalized match
3. Trimmed match (leading/trailing whitespace ignored)
4. Fuzzy match (Levenshtein distance / difflib)
5. Middle-out search from expected location

**Pros:**

- Intuitive for both LLMs and humans
- Precise: only changes what needs changing
- Works well with any file size
- Easy to validate (search block must exist in file)

**Cons:**

- Requires the LLM to reproduce exact existing code
- Can fail on formatting variations
- Multiple edits to same region need ordering

### 9.3 Unified Diff

```diff
--- a/file.ts
+++ b/file.ts
@@ -10,3 +10,3 @@
-function oldName(x) {
+function newName(x: number): number {
   return x * 2
 }
```

**Pros:** Standard format, familiar to developers
**Cons:** Line numbers can be fragile, context accuracy critical

### 9.4 Whole File Rewrite

**When to use:** Files under 300-400 lines, creating new files
**Pros:** Simplest, no matching needed
**Cons:** Expensive for large files, loses surrounding context

### 9.5 AST-Based Transformation

Using tree-sitter to parse code into ASTs and apply structural transformations.

**Pros:** Semantically aware, handles formatting variations
**Cons:** Complex to implement, language-specific parsers needed

### 9.6 Cursor's Apply Model Approach

Two-step process:

1. Primary LLM generates a "change sketch" (what to change)
2. Specialized trained model applies the sketch to actual code

**Pros:** Separates reasoning from application, handles complex merges
**Cons:** Requires training a specialized model

### 9.7 Recommendation for dhelix

Implement **Search/Replace as primary** with fallbacks:

```
Primary: Search/Replace with layered matching
    │ match fails
    ├──> Fuzzy matching (Levenshtein)
    │ still fails
    ├──> Ask LLM to regenerate with correct context
    │ still fails
    └──> Fall back to whole-file rewrite (if file small enough)

For new files: Always use whole-file write
For small files (<300 lines): Allow whole-file rewrite
For large files: Require search/replace
```

---

## 10. Prompt Engineering for Coding Agents

### 10.1 System Prompt Architecture

```
┌──────────────────────────────────────────────────────────┐
│  System Prompt Structure                                 │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │  1. Identity & Capabilities                      │    │
│  │     "You are a coding assistant that can..."     │    │
│  └──────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────┐    │
│  │  2. Behavioral Guidelines                        │    │
│  │     Tool usage rules, safety constraints,        │    │
│  │     output format preferences                    │    │
│  └──────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────┐    │
│  │  3. Tool Definitions                             │    │
│  │     JSON Schema for each available tool          │    │
│  └──────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────┐    │
│  │  4. Project Context (Dynamic)                    │    │
│  │     Project rules, conventions, file structure   │    │
│  └──────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────┐    │
│  │  5. Examples (Few-shot)                          │    │
│  │     Canonical examples of tool usage patterns    │    │
│  └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

### 10.2 Key Techniques for Coding Agents

| Technique            | Description                                | When to Use                     |
| -------------------- | ------------------------------------------ | ------------------------------- |
| Chain-of-Thought     | "Think step-by-step"                       | Complex debugging, architecture |
| Few-shot examples    | Show tool usage patterns                   | Tool selection accuracy         |
| Role assignment      | "You are a senior engineer..."             | Consistent quality              |
| Constraint injection | "Never modify files without reading first" | Safety guardrails               |
| Format specification | XML tags, markdown headers                 | Structured outputs              |
| Temperature control  | Lower for code, higher for brainstorming   | Per-task optimization           |

### 10.3 Prompt Composition for dhelix

```
System prompt layers:
1. Base identity (static) ~500 tokens
2. Tool descriptions (static per session) ~2000 tokens
3. Project rules (loaded from config) ~500-2000 tokens
4. Repository context (dynamic, from repo map) ~500-1000 tokens
5. User preferences (from memory) ~200-500 tokens

Total baseline: ~4000-6000 tokens
Remaining for conversation: Model-dependent
```

### 10.4 Anti-Patterns to Avoid

1. **Over-prompting**: Too many instructions cause "lost in the middle" problems
2. **Conflicting rules**: Contradictory instructions confuse the model
3. **Hardcoded paths/values**: Brittle, break across projects
4. **Excessive examples**: Consume tokens without proportional benefit
5. **Vague instructions**: "Write good code" vs "Follow project ESLint config"

---

## 11. Recommendations for dhelix

### 11.1 Core Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  dhelix Recommended Architecture                             │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    CLI Layer                             │ │
│  │  Terminal UI, Streaming, User Input, Permission Prompts │ │
│  └──────────────────────┬──────────────────────────────────┘ │
│                         │                                    │
│  ┌──────────────────────┴──────────────────────────────────┐ │
│  │                  Agent Core                             │ │
│  │  ┌────────────────────────────────────────────────────┐ │ │
│  │  │  Agentic Loop (ReAct)                              │ │ │
│  │  │  while (tool_calls) { execute -> feed_back }       │ │ │
│  │  └────────────────────────────────────────────────────┘ │ │
│  │  ┌────────────┐ ┌────────────┐ ┌──────────────────┐    │ │
│  │  │ Context    │ │ Tool       │ │ Error Recovery   │    │ │
│  │  │ Manager    │ │ Executor   │ │ Handler          │    │ │
│  │  │ - compact  │ │ - parallel │ │ - classify       │    │ │
│  │  │ - select   │ │ - serial   │ │ - retry/fallback │    │ │
│  │  │ - persist  │ │ - timeout  │ │ - self-correct   │    │ │
│  │  └────────────┘ └────────────┘ └──────────────────┘    │ │
│  └──────────────────────┬──────────────────────────────────┘ │
│                         │                                    │
│  ┌──────────────────────┴──────────────────────────────────┐ │
│  │                  LLM Adapter Layer                      │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │ │
│  │  │ Anthropic│ │ OpenAI   │ │ Local    │ │ Other    │  │ │
│  │  │ (Claude) │ │ (GPT)    │ │ (Ollama) │ │ Providers│  │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │ │
│  └──────────────────────┬──────────────────────────────────┘ │
│                         │                                    │
│  ┌──────────────────────┴──────────────────────────────────┐ │
│  │                  Tool System                            │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │ │
│  │  │ Built-in │ │ MCP      │ │ Code     │ │ Git      │  │ │
│  │  │ Tools    │ │ Servers  │ │ Analysis │ │ Ops      │  │ │
│  │  │ (read,   │ │ (user    │ │ (tree-   │ │ (commit, │  │ │
│  │  │  write,  │ │  custom  │ │  sitter, │ │  diff,   │  │ │
│  │  │  search, │ │  tools)  │ │  repo    │ │  branch) │  │ │
│  │  │  exec)   │ │          │ │  map)    │ │          │  │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                  Storage Layer                          │ │
│  │  Project Memory | Session State | User Prefs | Repo Map│ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 11.2 Key Design Decisions

| Decision               | Recommendation                               | Rationale                                                   |
| ---------------------- | -------------------------------------------- | ----------------------------------------------------------- |
| **Primary loop**       | ReAct (single while-loop)                    | Proven by Claude Code, simple, debuggable                   |
| **Framework**          | Custom (no external framework)               | Full control, fewer dependencies, Anthropic recommends this |
| **Edit format**        | Search/Replace primary + whole-file fallback | Best accuracy, works across file sizes                      |
| **Context management** | Compaction + repo map + selective loading    | Proven combination across multiple agents                   |
| **Tool execution**     | Parallel for reads, sequential for writes    | Safe parallelism without race conditions                    |
| **Error recovery**     | Classify + retry + self-correct + fallback   | Resilient without infinite loops                            |
| **Memory**             | File-based (project.md) + SQLite (sessions)  | Version-controllable + queryable                            |
| **LLM support**        | Adapter pattern, Claude primary              | Flexibility without framework lock-in                       |
| **MCP support**        | First-class integration                      | Ecosystem extensibility                                     |
| **Sandboxing**         | Optional Docker for untrusted operations     | Security without always-on overhead                         |
| **Code analysis**      | tree-sitter for repo map + AST               | Language-agnostic, proven approach                          |

### 11.3 Implementation Priority

**Phase 1 - Core Loop:**

1. ReAct agentic loop with basic tools (read, write, search, exec)
2. Single LLM provider (Anthropic Claude)
3. Search/Replace code editing with fuzzy matching
4. Basic conversation management (full history)

**Phase 2 - Intelligence:** 5. Repository map using tree-sitter 6. Context window compaction 7. Session persistence and resume 8. Error recovery and self-correction 9. Parallel tool execution

**Phase 3 - Extensibility:** 10. Multi-provider LLM support (OpenAI, local models) 11. MCP server integration 12. Project memory system 13. Sub-agent support for complex tasks 14. Plugin/hook system for lifecycle events

**Phase 4 - Advanced:** 15. Plan-and-Execute mode for complex tasks 16. Code review and security analysis agents 17. Git workflow integration 18. IDE integration (LSP or extension)

### 11.4 Critical Success Factors

1. **Simplicity first**: Start with the simplest loop that works. Add complexity only when evaluation shows it's needed.

2. **Tool quality over quantity**: A few well-designed tools outperform many mediocre ones. Invest in robust file editing and code search.

3. **Context engineering**: The quality of what goes into the context window determines output quality. Invest heavily in repo mapping and selective context loading.

4. **Streaming UX**: Users must see progress in real-time. Every tool execution and reasoning step should be visible.

5. **Interruptibility**: Users must be able to stop, redirect, or cancel at any point. Never leave the user waiting without recourse.

6. **Error transparency**: When things go wrong, show the user what happened and what the agent is trying to do about it. Trust is built through transparency.

---

## Sources

### Agentic Patterns

- [7 Must-Know Agentic AI Design Patterns](https://machinelearningmastery.com/7-must-know-agentic-ai-design-patterns/)
- [Top AI Agentic Workflow Patterns - ByteByteGo](https://blog.bytebytego.com/p/top-ai-agentic-workflow-patterns)
- [Google Cloud: Choose a Design Pattern for Agentic AI](https://docs.cloud.google.com/architecture/choose-design-pattern-agentic-ai-system)
- [Agentic Design Patterns: The 2026 Guide](https://www.sitepoint.com/the-definitive-guide-to-agentic-design-patterns-in-2026/)

### Open-Source Agents

- [OpenHands Platform](https://openhands.dev/)
- [OpenHands Software Agent SDK Paper](https://arxiv.org/html/2511.03690v1)
- [Aider Repository Map](https://aider.chat/docs/repomap.html)
- [Aider Architect/Editor Approach](https://aider.chat/2024/09/26/architect.html)
- [Open-Source AI Agents Overview - Modal](https://modal.com/blog/open-ai-agents)
- [LangChain Open SWE](https://blog.langchain.com/introducing-open-swe-an-open-source-asynchronous-coding-agent/)

### Claude Code & Anthropic

- [How Claude Code Works](https://code.claude.com/docs/en/how-claude-code-works)
- [Claude Code Agent Architecture - ZenML](https://www.zenml.io/llmops-database/claude-code-agent-architecture-single-threaded-master-loop-for-autonomous-coding)
- [Claude Code: Behind the Master Agent Loop - PromptLayer](https://blog.promptlayer.com/claude-code-behind-the-scenes-of-the-master-agent-loop/)
- [Building Effective Agents - Anthropic](https://www.anthropic.com/research/building-effective-agents)
- [Building Agents with Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)
- [Claude Agent SDK Best Practices](https://skywork.ai/blog/claude-agent-sdk-best-practices-ai-agents-2025/)

### Context Engineering

- [Effective Context Engineering for AI Agents - Anthropic](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Context Engineering for Agents - Lance Martin](https://rlancemartin.github.io/2025/06/23/context_engineering/)
- [Context Window Management Strategies - GetMaxim](https://www.getmaxim.ai/articles/context-window-management-strategies-for-long-context-ai-agents-and-chatbots/)
- [AI Context Window Optimization - Airbyte](https://airbyte.com/agentic-data/ai-context-window-optimization-techniques)

### Framework Comparisons

- [Comparing AI Agent Frameworks - Langfuse](https://langfuse.com/blog/2025-03-19-ai-agent-comparison)
- [OpenAI Agents SDK vs LangGraph vs AutoGen vs CrewAI - Composio](https://composio.dev/blog/openai-agents-sdk-vs-langgraph-vs-autogen-vs-crewai)
- [AI Agent Frameworks Comparison - Turing](https://www.turing.com/resources/ai-agent-frameworks)
- [Best AI Agent Frameworks 2025 - GetMaxim](https://www.getmaxim.ai/articles/top-5-ai-agent-frameworks-in-2025-a-practical-guide-for-ai-builders/)

### Code Editing

- [Code Surgery: How AI Assistants Make Precise Edits](https://fabianhertwig.com/blog/coding-assistants-file-edits/)
- [Unified Diffs Make GPT-4 Turbo 3X Less Lazy - Aider](https://aider.chat/docs/unified-diffs.html)
- [Diff Format Explained - Morph](https://www.morphllm.com/edit-formats/diff-format-explained)

### Tool Use & Function Calling

- [Function Calling - OpenAI](https://platform.openai.com/docs/guides/function-calling)
- [Function Calling in AI Agents - Prompt Engineering Guide](https://www.promptingguide.ai/agents/function-calling)
- [Parallel Tool Calling for AI Coding Agents](https://skywork.ai/blog/kat-models-parallel-tool-calling-ai-coding-agents/)
- [Why Parallel Tool Calling Matters](https://www.codeant.ai/blogs/parallel-tool-calling)

### Error Recovery

- [Error Recovery and Fallback Strategies in AI Agent Development](https://www.gocodeo.com/post/error-recovery-and-fallback-strategies-in-ai-agent-development)
- [Self-Correcting AI Agents - DEV Community](https://dev.to/louis-sanna/self-correcting-ai-agents-how-to-build-ai-that-learns-from-its-mistakes-39f1)
- [Error Recovery & Graceful Degradation - AI Design Patterns](https://www.aiuxdesign.guide/patterns/error-recovery)

### Memory & State Management

- [AI Agent Memory - Redis](https://redis.io/blog/ai-agent-memory-stateful-systems/)
- [Multi-Turn Conversation State Management - Uplatz](https://uplatz.com/blog/multi-turn-conversation-state-management-and-memory-architectures-an-analytical-report/)
- [AI Agent Memory Management Architecture - DEV Community](https://dev.to/sopaco/ai-agent-memory-management-system-architecture-design-evolution-from-stateless-to-intelligent-2c4h)
