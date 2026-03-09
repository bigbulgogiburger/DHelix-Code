import { describe, it, expect, beforeEach } from "vitest";
import {
  todoWriteTool,
  getTodos,
  resetTodos,
} from "../../../../src/tools/definitions/todo-write.js";

const context = {
  workingDirectory: process.cwd(),
  abortSignal: new AbortController().signal,
  timeoutMs: 5_000,
  platform: "darwin" as const,
};

describe("todo_write tool", () => {
  beforeEach(() => {
    resetTodos();
  });

  describe("metadata", () => {
    it("should have correct name, permission level, and timeout", () => {
      expect(todoWriteTool.name).toBe("todo_write");
      expect(todoWriteTool.permissionLevel).toBe("safe");
      expect(todoWriteTool.timeoutMs).toBe(5_000);
    });
  });

  describe("parameter validation", () => {
    it("should reject empty todos array", () => {
      const result = todoWriteTool.parameterSchema.safeParse({ todos: [] });
      expect(result.success).toBe(false);
    });

    it("should reject invalid status enum", () => {
      const result = todoWriteTool.parameterSchema.safeParse({
        todos: [{ content: "task", status: "invalid" }],
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing content", () => {
      const result = todoWriteTool.parameterSchema.safeParse({
        todos: [{ status: "in_progress" }],
      });
      expect(result.success).toBe(false);
    });

    it("should accept valid input", () => {
      const result = todoWriteTool.parameterSchema.safeParse({
        todos: [{ content: "Do something", status: "in_progress" }],
      });
      expect(result.success).toBe(true);
    });
  });

  describe("in_progress constraint", () => {
    it("should succeed with exactly one in_progress item", async () => {
      const result = await todoWriteTool.execute(
        {
          todos: [
            { content: "Done task", status: "completed" },
            { content: "Current task", status: "in_progress" },
            { content: "Future task", status: "pending" },
          ],
        },
        context,
      );
      expect(result.isError).toBe(false);
      expect(result.output).toContain("Todo List Updated:");
    });

    it("should fail with zero in_progress items", async () => {
      const result = await todoWriteTool.execute(
        {
          todos: [
            { content: "Task A", status: "completed" },
            { content: "Task B", status: "pending" },
          ],
        },
        context,
      );
      expect(result.isError).toBe(true);
      expect(result.output).toContain("found 0");
    });

    it("should fail with two in_progress items", async () => {
      const result = await todoWriteTool.execute(
        {
          todos: [
            { content: "Task A", status: "in_progress" },
            { content: "Task B", status: "in_progress" },
          ],
        },
        context,
      );
      expect(result.isError).toBe(true);
      expect(result.output).toContain("found 2");
    });

    it("should not update state on validation failure", async () => {
      // First, set valid state
      await todoWriteTool.execute(
        { todos: [{ content: "Valid", status: "in_progress" }] },
        context,
      );
      expect(getTodos()).toHaveLength(1);

      // Now attempt invalid update
      await todoWriteTool.execute(
        {
          todos: [
            { content: "A", status: "pending" },
            { content: "B", status: "pending" },
          ],
        },
        context,
      );

      // State should remain unchanged
      expect(getTodos()).toHaveLength(1);
      expect(getTodos()[0].content).toBe("Valid");
    });
  });

  describe("state persistence", () => {
    it("should persist state across calls", async () => {
      await todoWriteTool.execute(
        {
          todos: [
            { content: "Step 1", status: "in_progress" },
            { content: "Step 2", status: "pending" },
          ],
        },
        context,
      );
      expect(getTodos()).toHaveLength(2);

      await todoWriteTool.execute(
        {
          todos: [
            { content: "Step 1", status: "completed" },
            { content: "Step 2", status: "in_progress" },
          ],
        },
        context,
      );
      expect(getTodos()).toHaveLength(2);
      expect(getTodos()[0].status).toBe("completed");
      expect(getTodos()[1].status).toBe("in_progress");
    });

    it("should replace the full list on each call", async () => {
      await todoWriteTool.execute(
        {
          todos: [
            { content: "A", status: "in_progress" },
            { content: "B", status: "pending" },
            { content: "C", status: "pending" },
          ],
        },
        context,
      );
      expect(getTodos()).toHaveLength(3);

      await todoWriteTool.execute(
        { todos: [{ content: "Only one", status: "in_progress" }] },
        context,
      );
      expect(getTodos()).toHaveLength(1);
      expect(getTodos()[0].content).toBe("Only one");
    });
  });

  describe("getTodos / resetTodos", () => {
    it("should return empty array initially", () => {
      expect(getTodos()).toEqual([]);
    });

    it("should return current state after execute", async () => {
      await todoWriteTool.execute({ todos: [{ content: "Task", status: "in_progress" }] }, context);
      const todos = getTodos();
      expect(todos).toHaveLength(1);
      expect(todos[0]).toEqual({ content: "Task", status: "in_progress" });
    });

    it("should clear state on resetTodos", async () => {
      await todoWriteTool.execute({ todos: [{ content: "Task", status: "in_progress" }] }, context);
      expect(getTodos()).toHaveLength(1);
      resetTodos();
      expect(getTodos()).toEqual([]);
    });
  });

  describe("output formatting", () => {
    it("should format completed items with checkmark", async () => {
      const result = await todoWriteTool.execute(
        {
          todos: [
            { content: "Done", status: "completed" },
            { content: "Now", status: "in_progress" },
          ],
        },
        context,
      );
      expect(result.output).toContain("1. [\u2713] Done");
    });

    it("should format in_progress items with arrow", async () => {
      const result = await todoWriteTool.execute(
        { todos: [{ content: "Working", status: "in_progress" }] },
        context,
      );
      expect(result.output).toContain("1. [\u2192] Working");
    });

    it("should format pending items with space", async () => {
      const result = await todoWriteTool.execute(
        {
          todos: [
            { content: "Current", status: "in_progress" },
            { content: "Later", status: "pending" },
          ],
        },
        context,
      );
      expect(result.output).toContain("2. [ ] Later");
    });

    it("should number items sequentially", async () => {
      const result = await todoWriteTool.execute(
        {
          todos: [
            { content: "First", status: "completed" },
            { content: "Second", status: "in_progress" },
            { content: "Third", status: "pending" },
          ],
        },
        context,
      );
      expect(result.output).toContain("1. [\u2713] First");
      expect(result.output).toContain("2. [\u2192] Second");
      expect(result.output).toContain("3. [ ] Third");
    });

    it("should include metadata counts", async () => {
      const result = await todoWriteTool.execute(
        {
          todos: [
            { content: "A", status: "completed" },
            { content: "B", status: "completed" },
            { content: "C", status: "in_progress" },
            { content: "D", status: "pending" },
          ],
        },
        context,
      );
      expect(result.metadata).toEqual({
        total: 4,
        completed: 2,
        inProgress: 1,
        pending: 1,
      });
    });
  });
});
