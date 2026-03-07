import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock react
vi.mock("react", () => {
  return {
    default: {
      memo: (fn: unknown) => fn,
      createElement: () => null,
    },
    memo: (fn: unknown) => fn,
  };
});

// Mock ink
vi.mock("ink", () => ({
  Box: () => null,
  Text: () => null,
  Static: ({ items, children }: { items: unknown[]; children: (item: unknown) => unknown }) => {
    return items.map((item) => children(item));
  },
}));

// Mock TurnBlock
vi.mock("../../../../src/cli/components/TurnBlock.js", () => ({
  TurnBlock: () => null,
}));

async function getComponent() {
  const mod = await import("../../../../src/cli/components/ActivityFeed.js");
  return mod.ActivityFeed;
}

describe("ActivityFeed", () => {
  let ActivityFeed: Awaited<ReturnType<typeof getComponent>>;

  beforeEach(async () => {
    ActivityFeed = await getComponent();
  });

  describe("exports", () => {
    it("should export ActivityFeed function", async () => {
      const mod = await import("../../../../src/cli/components/ActivityFeed.js");
      expect(typeof mod.ActivityFeed).toBe("function");
    });

    it("should be a named export", async () => {
      const mod = await import("../../../../src/cli/components/ActivityFeed.js");
      expect(mod).not.toHaveProperty("default");
    });
  });

  describe("rendering", () => {
    it("should render without crashing with empty turns", () => {
      const result = ActivityFeed({
        completedTurns: [],
      });
      expect(result).toBeDefined();
    });

    it("should render with completed turns", () => {
      const result = ActivityFeed({
        completedTurns: [
          {
            id: "turn-1",
            entries: [
              {
                type: "user-message",
                timestamp: new Date(),
                data: { content: "Hello" },
              },
              {
                type: "assistant-text",
                timestamp: new Date(),
                data: { content: "Hi", isComplete: true },
              },
            ],
            isComplete: true,
          },
        ],
      });
      expect(result).toBeDefined();
    });

    it("should render with a current turn", () => {
      const result = ActivityFeed({
        completedTurns: [],
        currentTurn: {
          id: "current-turn",
          entries: [
            {
              type: "user-message",
              timestamp: new Date(),
              data: { content: "What is this?" },
            },
          ],
          isComplete: false,
        },
      });
      expect(result).toBeDefined();
    });

    it("should render with both completed and current turns", () => {
      const result = ActivityFeed({
        completedTurns: [
          {
            id: "turn-1",
            entries: [
              {
                type: "user-message",
                timestamp: new Date(),
                data: { content: "First message" },
              },
            ],
            isComplete: true,
          },
        ],
        currentTurn: {
          id: "turn-2",
          entries: [
            {
              type: "user-message",
              timestamp: new Date(),
              data: { content: "Second message" },
            },
          ],
          isComplete: false,
        },
      });
      expect(result).toBeDefined();
    });

    it("should handle null currentTurn", () => {
      const result = ActivityFeed({
        completedTurns: [],
        currentTurn: null,
      });
      expect(result).toBeDefined();
    });
  });
});
