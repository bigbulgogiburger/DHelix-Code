import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  AutoMemoryCollector,
  type TurnContext,
  type AutoMemoryEntry,
} from "../../../src/core/auto-memory.js";
import type { MemoryConfig } from "../../../src/core/memory-storage.js";

// Mock the memory-storage module
vi.mock("../../../src/core/memory-storage.js", () => ({
  readMainMemory: vi.fn().mockResolvedValue(""),
  writeMainMemory: vi.fn().mockResolvedValue(undefined),
  readTopicMemory: vi.fn().mockResolvedValue(null),
  writeTopicMemory: vi.fn().mockResolvedValue(undefined),
  readGlobalMemory: vi.fn().mockResolvedValue(""),
  writeGlobalMemory: vi.fn().mockResolvedValue(undefined),
  listMemoryFiles: vi.fn().mockResolvedValue([]),
  deleteMemoryFile: vi.fn().mockResolvedValue(undefined),
  getMemoryPaths: vi.fn().mockReturnValue({
    projectDir: "/test/project",
    globalDir: "/home/user/.dhelix/memory",
    maxMainLines: 200,
    maxTopicLines: 500,
  }),
}));

// Mock the logger to suppress output
vi.mock("../../../src/utils/logger.js", () => ({
  getLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Reimport mocked modules to get typed references
import {
  readMainMemory,
  writeMainMemory,
  readTopicMemory,
  writeTopicMemory,
  readGlobalMemory,
} from "../../../src/core/memory-storage.js";

const mockedReadMainMemory = vi.mocked(readMainMemory);
const mockedWriteMainMemory = vi.mocked(writeMainMemory);
const mockedReadTopicMemory = vi.mocked(readTopicMemory);
const mockedWriteTopicMemory = vi.mocked(writeTopicMemory);
const mockedReadGlobalMemory = vi.mocked(readGlobalMemory);

/** Create a default MemoryConfig for testing */
function makeStorage(): MemoryConfig {
  return {
    projectDir: "/test/project",
    globalDir: "/home/user/.dhelix/memory",
    maxMainLines: 200,
    maxTopicLines: 500,
  };
}

/** Create a minimal TurnContext for testing */
function makeTurn(overrides?: Partial<TurnContext>): TurnContext {
  return {
    userMessage: overrides?.userMessage ?? "How do I fix this?",
    assistantResponse: overrides?.assistantResponse ?? "Here is the solution.",
    toolCalls: overrides?.toolCalls ?? [],
    filesAccessed: overrides?.filesAccessed ?? [],
    errorsEncountered: overrides?.errorsEncountered ?? [],
  };
}

describe("AutoMemoryCollector", () => {
  let collector: AutoMemoryCollector;
  let storage: MemoryConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = makeStorage();
    collector = new AutoMemoryCollector(storage);
  });

  // -----------------------------------------------------------------------
  // Constructor
  // -----------------------------------------------------------------------

  describe("constructor", () => {
    it("creates collector with default config", () => {
      const c = new AutoMemoryCollector(storage);
      expect(c.getPending()).toEqual([]);
    });

    it("accepts partial config overrides", () => {
      const c = new AutoMemoryCollector(storage, {
        minConfidence: 0.9,
        maxEntriesPerSession: 5,
      });
      expect(c.getPending()).toEqual([]);
    });

    it("can be disabled via config", () => {
      const c = new AutoMemoryCollector(storage, { enabled: false });
      const turn = makeTurn({
        assistantResponse: "The root cause was a missing import. Fixed by adding the import.",
      });
      const entries = c.analyzeForMemories(turn);
      expect(entries).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // analyzeForMemories — architecture
  // -----------------------------------------------------------------------

  describe("analyzeForMemories() — architecture detection", () => {
    it("detects architecture decisions", () => {
      const turn = makeTurn({
        assistantResponse:
          "The architecture decision was to use a layered approach with separation of concerns.",
      });
      const entries = collector.analyzeForMemories(turn);

      expect(entries.length).toBeGreaterThan(0);
      const archEntry = entries.find((e) => e.category === "architecture");
      expect(archEntry).toBeDefined();
      expect(archEntry!.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it("detects design decisions", () => {
      const turn = makeTurn({
        assistantResponse:
          "This is a design decision to use the repository pattern for data access.",
      });
      const entries = collector.analyzeForMemories(turn);

      const archEntries = entries.filter((e) => e.category === "architecture");
      expect(archEntries.length).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // analyzeForMemories — debugging
  // -----------------------------------------------------------------------

  describe("analyzeForMemories() — debugging detection", () => {
    it("detects debugging insights with 'fixed by'", () => {
      const turn = makeTurn({
        assistantResponse: "The bug was fixed by updating the dependency version from 2.0 to 3.0.",
      });
      const entries = collector.analyzeForMemories(turn);

      const debugEntries = entries.filter((e) => e.category === "debugging");
      expect(debugEntries.length).toBeGreaterThan(0);
    });

    it("detects 'root cause' keywords", () => {
      const turn = makeTurn({
        assistantResponse:
          "The root cause was a race condition in the event handler that caused stale state.",
      });
      const entries = collector.analyzeForMemories(turn);

      const debugEntries = entries.filter((e) => e.category === "debugging");
      expect(debugEntries.length).toBeGreaterThan(0);
      expect(debugEntries[0]!.content).toContain("root cause");
    });

    it("detects 'workaround' keywords", () => {
      const turn = makeTurn({
        assistantResponse:
          "A workaround for this issue is to clear the cache before running the build.",
      });
      const entries = collector.analyzeForMemories(turn);

      const debugEntries = entries.filter((e) => e.category === "debugging");
      expect(debugEntries.length).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // analyzeForMemories — preferences
  // -----------------------------------------------------------------------

  describe("analyzeForMemories() — preference detection", () => {
    it("detects 'always use' preferences", () => {
      const turn = makeTurn({
        userMessage: "Remember, always use named exports instead of default exports.",
        assistantResponse: "Got it, I will always use named exports in this project.",
      });
      const entries = collector.analyzeForMemories(turn);

      const prefEntries = entries.filter((e) => e.category === "preferences");
      expect(prefEntries.length).toBeGreaterThan(0);
    });

    it("detects 'prefer' preferences", () => {
      const turn = makeTurn({
        assistantResponse: "I prefer to use functional components with hooks rather than classes.",
      });
      const entries = collector.analyzeForMemories(turn);

      // Could match preferences or patterns depending on regex
      expect(entries.length).toBeGreaterThan(0);
    });

    it("detects 'don't use' preferences", () => {
      const turn = makeTurn({
        userMessage: "Don't use any type in this project.",
        assistantResponse:
          "Understood, I won't use the any type. I'll use unknown with type guards.",
      });
      const entries = collector.analyzeForMemories(turn);

      const prefEntries = entries.filter((e) => e.category === "preferences");
      expect(prefEntries.length).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // analyzeForMemories — infrastructure
  // -----------------------------------------------------------------------

  describe("analyzeForMemories() — infrastructure detection", () => {
    it("detects build commands", () => {
      const turn = makeTurn({
        assistantResponse:
          "The build command is `npm run build` which compiles TypeScript via tsup.",
      });
      const entries = collector.analyzeForMemories(turn);

      const infraEntries = entries.filter((e) => e.category === "infrastructure");
      expect(infraEntries.length).toBeGreaterThan(0);
    });

    it("detects deployment info", () => {
      const turn = makeTurn({
        assistantResponse:
          "The deploy script runs `npm run deploy` which pushes the container to the registry.",
      });
      const entries = collector.analyzeForMemories(turn);

      const infraEntries = entries.filter((e) => e.category === "infrastructure");
      expect(infraEntries.length).toBeGreaterThan(0);
    });

    it("detects environment variable mentions", () => {
      const turn = makeTurn({
        assistantResponse:
          "You need to set the environment variable OPENAI_API_KEY before running the app.",
      });
      const entries = collector.analyzeForMemories(turn);

      const infraEntries = entries.filter((e) => e.category === "infrastructure");
      expect(infraEntries.length).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // analyzeForMemories — generic/empty
  // -----------------------------------------------------------------------

  describe("analyzeForMemories() — no matches", () => {
    it("returns empty for generic conversation", () => {
      const turn = makeTurn({
        userMessage: "Hello, how are you?",
        assistantResponse: "I'm doing well, thank you for asking!",
      });
      const entries = collector.analyzeForMemories(turn);
      expect(entries).toEqual([]);
    });

    it("returns empty for empty messages", () => {
      const turn = makeTurn({
        userMessage: "",
        assistantResponse: "",
      });
      const entries = collector.analyzeForMemories(turn);
      expect(entries).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // analyzeForMemories — confidence threshold
  // -----------------------------------------------------------------------

  describe("analyzeForMemories() — confidence threshold", () => {
    it("respects minConfidence threshold", () => {
      const highThresholdCollector = new AutoMemoryCollector(storage, {
        minConfidence: 0.99,
      });

      const turn = makeTurn({
        assistantResponse: "The root cause was a simple typo.",
      });
      const entries = highThresholdCollector.analyzeForMemories(turn);

      // With 0.99 threshold, most things should be filtered
      // Very short content gets confidence penalized below base
      for (const entry of entries) {
        expect(entry.confidence).toBeGreaterThanOrEqual(0.99);
      }
    });
  });

  // -----------------------------------------------------------------------
  // analyzeForMemories — file tracking
  // -----------------------------------------------------------------------

  describe("analyzeForMemories() — file access tracking", () => {
    it("tracks frequently accessed files (3+ times)", () => {
      // Access the same file 3 times across turns
      const turn1 = makeTurn({ filesAccessed: ["/src/index.ts"] });
      const turn2 = makeTurn({ filesAccessed: ["/src/index.ts"] });
      const turn3 = makeTurn({ filesAccessed: ["/src/index.ts"] });

      collector.analyzeForMemories(turn1);
      collector.analyzeForMemories(turn2);
      const entries3 = collector.analyzeForMemories(turn3);

      const fileEntries = entries3.filter((e) => e.category === "files");
      expect(fileEntries.length).toBe(1);
      expect(fileEntries[0]!.content).toContain("/src/index.ts");
    });

    it("does not trigger for fewer than 3 accesses", () => {
      const turn1 = makeTurn({ filesAccessed: ["/src/utils.ts"] });
      const turn2 = makeTurn({ filesAccessed: ["/src/utils.ts"] });

      const entries1 = collector.analyzeForMemories(turn1);
      const entries2 = collector.analyzeForMemories(turn2);

      const fileEntries = [
        ...entries1.filter((e) => e.category === "files"),
        ...entries2.filter((e) => e.category === "files"),
      ];
      expect(fileEntries.length).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // analyzeForMemories — error resolution
  // -----------------------------------------------------------------------

  describe("analyzeForMemories() — error resolution", () => {
    it("detects resolved errors", () => {
      const turn = makeTurn({
        errorsEncountered: ["Cannot find module 'foo'"],
        assistantResponse: "The issue was a missing dependency. I fixed it by running npm install.",
      });
      const entries = collector.analyzeForMemories(turn);

      const debugEntries = entries.filter((e) => e.category === "debugging");
      expect(debugEntries.length).toBeGreaterThan(0);
    });

    it("does not generate entry if error not resolved", () => {
      const turn = makeTurn({
        errorsEncountered: ["TypeError: x is not a function"],
        assistantResponse: "Let me look into this further. I need more context.",
      });
      const entries = collector.analyzeForMemories(turn);

      // No resolution indicators in the response
      const errorEntries = entries.filter((e) => e.source === "error-resolution");
      expect(errorEntries.length).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // isDuplicate
  // -----------------------------------------------------------------------

  describe("isDuplicate()", () => {
    it("detects exact duplicate content in main memory", async () => {
      mockedReadMainMemory.mockResolvedValueOnce("The root cause was a missing import.");

      const entry: AutoMemoryEntry = {
        category: "debugging",
        content: "The root cause was a missing import.",
        confidence: 0.85,
        source: "test",
      };

      const result = await collector.isDuplicate(entry);
      expect(result).toBe(true);
    });

    it("detects near-duplicate with whitespace differences", async () => {
      mockedReadMainMemory.mockResolvedValueOnce("The   root  cause   was  a  missing   import.");

      const entry: AutoMemoryEntry = {
        category: "debugging",
        content: "The root cause was a missing import.",
        confidence: 0.85,
        source: "test",
      };

      const result = await collector.isDuplicate(entry);
      expect(result).toBe(true);
    });

    it("returns false for unique content", async () => {
      mockedReadMainMemory.mockResolvedValueOnce("Some completely different content.");
      mockedReadTopicMemory.mockResolvedValueOnce(null);

      const entry: AutoMemoryEntry = {
        category: "architecture",
        content: "Use layered architecture with strict dependency direction.",
        confidence: 0.8,
        source: "test",
      };

      const result = await collector.isDuplicate(entry);
      expect(result).toBe(false);
    });

    it("checks topic files for duplicates", async () => {
      mockedReadMainMemory.mockResolvedValueOnce("");
      mockedReadTopicMemory.mockResolvedValueOnce(
        "Use layered architecture with strict boundaries.",
      );

      const entry: AutoMemoryEntry = {
        category: "architecture",
        content: "Use layered architecture with strict boundaries.",
        confidence: 0.8,
        source: "test",
      };

      const result = await collector.isDuplicate(entry);
      expect(result).toBe(true);
    });

    it("returns false when deduplication is disabled", async () => {
      const noDedupCollector = new AutoMemoryCollector(storage, {
        deduplication: false,
      });

      const entry: AutoMemoryEntry = {
        category: "debugging",
        content: "anything",
        confidence: 0.85,
        source: "test",
      };

      const result = await noDedupCollector.isDuplicate(entry);
      expect(result).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // getPending + clearPending
  // -----------------------------------------------------------------------

  describe("getPending()", () => {
    it("returns entries not yet flushed", () => {
      const turn = makeTurn({
        assistantResponse:
          "The root cause was a circular dependency between the core and CLI layers.",
      });
      collector.analyzeForMemories(turn);

      const pending = collector.getPending();
      expect(pending.length).toBeGreaterThan(0);
    });

    it("returns a copy (not the internal array)", () => {
      const turn = makeTurn({
        assistantResponse:
          "The architecture decision was to separate concerns into distinct layers.",
      });
      collector.analyzeForMemories(turn);

      const pending1 = collector.getPending();
      const pending2 = collector.getPending();
      expect(pending1).not.toBe(pending2);
      expect(pending1).toEqual(pending2);
    });
  });

  describe("clearPending()", () => {
    it("empties the pending list", () => {
      const turn = makeTurn({
        assistantResponse: "The root cause was that the module was loaded synchronously.",
      });
      collector.analyzeForMemories(turn);
      expect(collector.getPending().length).toBeGreaterThan(0);

      collector.clearPending();
      expect(collector.getPending()).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // flush
  // -----------------------------------------------------------------------

  describe("flush()", () => {
    it("returns 0 when nothing is pending", async () => {
      const count = await collector.flush();
      expect(count).toBe(0);
    });

    it("writes entries to disk and returns count", async () => {
      mockedReadMainMemory.mockResolvedValue("");
      mockedReadTopicMemory.mockResolvedValue(null);

      const turn = makeTurn({
        assistantResponse:
          "The root cause was a stale cache. The workaround for this is to clear the build artifacts first.",
      });
      collector.analyzeForMemories(turn);

      const pendingBefore = collector.getPending().length;
      expect(pendingBefore).toBeGreaterThan(0);

      const count = await collector.flush();
      expect(count).toBeGreaterThan(0);
      expect(collector.getPending()).toEqual([]);
    });

    it("appends to MEMORY.md for short entries", async () => {
      mockedReadMainMemory.mockResolvedValue("# Existing content\n\nSome notes.");
      mockedReadTopicMemory.mockResolvedValue(null);

      const turn = makeTurn({
        assistantResponse:
          "The architecture decision was to keep all LLM providers behind a common interface.",
      });
      collector.analyzeForMemories(turn);

      await collector.flush();

      expect(mockedWriteMainMemory).toHaveBeenCalled();
      const writtenContent = mockedWriteMainMemory.mock.calls[0]?.[1] as string;
      expect(writtenContent).toContain("# Existing content");
    });

    it("creates topic files for entries exceeding main file limit", async () => {
      // Simulate a nearly-full MEMORY.md
      const longContent = Array.from({ length: 199 }, (_, i) => `Line ${i}`).join("\n");
      mockedReadMainMemory.mockResolvedValue(longContent);
      mockedReadTopicMemory.mockResolvedValue(null);

      const turn = makeTurn({
        assistantResponse:
          "The architecture decision was to use dependency injection throughout the application.",
      });
      collector.analyzeForMemories(turn);

      await collector.flush();

      // With 199 lines already, new entries should overflow to topic files
      expect(mockedWriteTopicMemory).toHaveBeenCalled();
    });

    it("clears pending after flush", async () => {
      mockedReadMainMemory.mockResolvedValue("");
      mockedReadTopicMemory.mockResolvedValue(null);

      const turn = makeTurn({
        assistantResponse: "The root cause was incorrect error handling in the stream parser.",
      });
      collector.analyzeForMemories(turn);

      await collector.flush();
      expect(collector.getPending()).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // buildMemoryPrompt
  // -----------------------------------------------------------------------

  describe("buildMemoryPrompt()", () => {
    it("returns empty string when no memory exists", async () => {
      mockedReadMainMemory.mockResolvedValue("");
      mockedReadGlobalMemory.mockResolvedValue("");
      mockedReadTopicMemory.mockResolvedValue(null);

      const prompt = await collector.buildMemoryPrompt();
      expect(prompt).toBe("");
    });

    it("loads and formats MEMORY.md content", async () => {
      mockedReadMainMemory.mockResolvedValue("# Project Notes\n\nESM only project.");
      mockedReadGlobalMemory.mockResolvedValue("");
      mockedReadTopicMemory.mockResolvedValue(null);

      const prompt = await collector.buildMemoryPrompt();
      expect(prompt).toContain("MEMORY.md");
      expect(prompt).toContain("ESM only project");
    });

    it("includes global memory", async () => {
      mockedReadMainMemory.mockResolvedValue("");
      mockedReadGlobalMemory.mockResolvedValue("# Global patterns\n\nAlways use ESM.");
      mockedReadTopicMemory.mockResolvedValue(null);

      const prompt = await collector.buildMemoryPrompt();
      expect(prompt).toContain("Global Memory");
      expect(prompt).toContain("Always use ESM");
    });

    it("includes topic files", async () => {
      mockedReadMainMemory.mockResolvedValue("Main content.");
      mockedReadGlobalMemory.mockResolvedValue("");
      // Return content for one specific topic
      mockedReadTopicMemory.mockImplementation(async (_config, topic) => {
        if (topic === "debugging") {
          return "Root cause was X. Fixed by Y.";
        }
        return null;
      });

      const prompt = await collector.buildMemoryPrompt();
      expect(prompt).toContain("Debugging");
      expect(prompt).toContain("Root cause was X");
    });
  });

  // -----------------------------------------------------------------------
  // maxEntriesPerSession limit
  // -----------------------------------------------------------------------

  describe("maxEntriesPerSession", () => {
    it("respects the session limit", () => {
      const limitedCollector = new AutoMemoryCollector(storage, {
        maxEntriesPerSession: 2,
      });

      // Generate many entries
      for (let i = 0; i < 10; i++) {
        limitedCollector.analyzeForMemories(
          makeTurn({
            assistantResponse: `Turn ${i}: The root cause was issue ${i}. The workaround for this is approach ${i}.`,
          }),
        );
      }

      const pending = limitedCollector.getPending();
      expect(pending.length).toBeLessThanOrEqual(2);
    });
  });

  // -----------------------------------------------------------------------
  // Deduplication across turns
  // -----------------------------------------------------------------------

  describe("deduplication across multiple turns", () => {
    it("detects duplicate entries across turns via isDuplicate", async () => {
      const content = "The architecture decision was to use event-driven patterns.";

      // First turn adds an entry
      mockedReadMainMemory.mockResolvedValue("");
      mockedReadTopicMemory.mockResolvedValue(null);

      const turn1 = makeTurn({ assistantResponse: content });
      const entries1 = collector.analyzeForMemories(turn1);

      // Simulate that the entry has been flushed to main memory
      if (entries1.length > 0) {
        mockedReadMainMemory.mockResolvedValue(entries1[0]!.content);
      }

      // Second turn with same content should be detected as duplicate
      const entry: AutoMemoryEntry = {
        category: "architecture",
        content,
        confidence: 0.8,
        source: "test",
      };
      const isDup = await collector.isDuplicate(entry);
      expect(isDup).toBe(true);
    });
  });
});
