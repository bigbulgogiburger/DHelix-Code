import { describe, it, expect, beforeEach } from "vitest";
import { Stack } from "../../../src/utils/stack.js";

describe("Stack", () => {
  let stack: Stack<number>;

  beforeEach(() => {
    stack = new Stack<number>();
  });

  describe("push", () => {
    it("should add an item to the stack", () => {
      stack.push(1);
      expect(stack.size()).toBe(1);
    });

    it("should add multiple items in order", () => {
      stack.push(1);
      stack.push(2);
      stack.push(3);
      expect(stack.size()).toBe(3);
      expect(stack.peek()).toBe(3);
    });
  });

  describe("pop", () => {
    it("should remove and return the top item", () => {
      stack.push(1);
      stack.push(2);
      const result = stack.pop();
      expect(result).toBe(2);
      expect(stack.size()).toBe(1);
    });

    it("should return undefined when popping from empty stack", () => {
      const result = stack.pop();
      expect(result).toBeUndefined();
    });

    it("should return items in LIFO order", () => {
      stack.push(1);
      stack.push(2);
      stack.push(3);
      expect(stack.pop()).toBe(3);
      expect(stack.pop()).toBe(2);
      expect(stack.pop()).toBe(1);
    });
  });

  describe("peek", () => {
    it("should return the top item without removing it", () => {
      stack.push(1);
      stack.push(2);
      expect(stack.peek()).toBe(2);
      expect(stack.size()).toBe(2);
    });

    it("should return undefined when peeking at empty stack", () => {
      expect(stack.peek()).toBeUndefined();
    });
  });

  describe("isEmpty", () => {
    it("should return true for a new stack", () => {
      expect(stack.isEmpty()).toBe(true);
    });

    it("should return false after pushing an item", () => {
      stack.push(1);
      expect(stack.isEmpty()).toBe(false);
    });

    it("should return true after pushing and popping all items", () => {
      stack.push(1);
      stack.pop();
      expect(stack.isEmpty()).toBe(true);
    });
  });

  describe("size", () => {
    it("should return 0 for a new stack", () => {
      expect(stack.size()).toBe(0);
    });

    it("should return correct size after push operations", () => {
      stack.push(1);
      stack.push(2);
      expect(stack.size()).toBe(2);
    });

    it("should return correct size after push and pop", () => {
      stack.push(1);
      stack.push(2);
      stack.pop();
      expect(stack.size()).toBe(1);
    });
  });

  describe("clear", () => {
    it("should remove all items from the stack", () => {
      stack.push(1);
      stack.push(2);
      stack.push(3);
      stack.clear();
      expect(stack.isEmpty()).toBe(true);
      expect(stack.size()).toBe(0);
    });

    it("should work on an already empty stack", () => {
      stack.clear();
      expect(stack.isEmpty()).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle push after clear", () => {
      stack.push(1);
      stack.clear();
      stack.push(2);
      expect(stack.peek()).toBe(2);
      expect(stack.size()).toBe(1);
    });

    it("should handle multiple pops on empty stack", () => {
      expect(stack.pop()).toBeUndefined();
      expect(stack.pop()).toBeUndefined();
      expect(stack.size()).toBe(0);
    });

    it("should work with string type", () => {
      const strStack = new Stack<string>();
      strStack.push("hello");
      strStack.push("world");
      expect(strStack.pop()).toBe("world");
      expect(strStack.peek()).toBe("hello");
    });

    it("should handle large number of items", () => {
      for (let i = 0; i < 1000; i++) {
        stack.push(i);
      }
      expect(stack.size()).toBe(1000);
      expect(stack.peek()).toBe(999);
    });
  });
});
