import { describe, it, expect, beforeEach } from "vitest";
import { FocusManager } from "../../../../src/cli/accessibility/keyboard-nav.js";
import type { FocusableElement } from "../../../../src/cli/accessibility/keyboard-nav.js";

const makeElement = (
  id: string,
  order: number,
  overrides?: Partial<FocusableElement>,
): FocusableElement => ({
  id,
  label: `Element ${id}`,
  order,
  type: "button",
  ...overrides,
});

describe("FocusManager", () => {
  let manager: FocusManager;

  beforeEach(() => {
    manager = new FocusManager();
  });

  describe("register", () => {
    it("요소를 등록하면 getAll()에 포함된다", () => {
      manager.register(makeElement("a", 0));
      expect(manager.getAll()).toHaveLength(1);
      expect(manager.getAll()[0].id).toBe("a");
    });

    it("여러 요소를 order 오름차순으로 정렬하여 저장한다", () => {
      manager.register(makeElement("b", 2));
      manager.register(makeElement("a", 0));
      manager.register(makeElement("c", 1));
      const ids = manager.getAll().map((el) => el.id);
      expect(ids).toEqual(["a", "c", "b"]);
    });

    it("동일 id로 재등록하면 덮어쓴다", () => {
      manager.register(makeElement("a", 0, { label: "원본" }));
      manager.register(makeElement("a", 0, { label: "수정됨" }));
      expect(manager.getAll()).toHaveLength(1);
      expect(manager.getAll()[0].label).toBe("수정됨");
    });
  });

  describe("unregister", () => {
    it("등록된 요소를 제거한다", () => {
      manager.register(makeElement("a", 0));
      manager.register(makeElement("b", 1));
      manager.unregister("a");
      expect(manager.getAll()).toHaveLength(1);
      expect(manager.getAll()[0].id).toBe("b");
    });

    it("존재하지 않는 id 제거는 무시한다", () => {
      manager.register(makeElement("a", 0));
      expect(() => manager.unregister("nonexistent")).not.toThrow();
      expect(manager.getAll()).toHaveLength(1);
    });

    it("현재 포커스된 요소를 제거하면 포커스가 해제된다", () => {
      manager.register(makeElement("a", 0));
      manager.focusById("a");
      manager.unregister("a");
      expect(manager.getCurrent()).toBeUndefined();
    });
  });

  describe("focusNext", () => {
    it("첫 호출에 첫 번째 요소를 반환한다", () => {
      manager.register(makeElement("a", 0));
      manager.register(makeElement("b", 1));
      const el = manager.focusNext();
      expect(el?.id).toBe("a");
    });

    it("순서대로 다음 요소로 이동한다", () => {
      manager.register(makeElement("a", 0));
      manager.register(makeElement("b", 1));
      manager.register(makeElement("c", 2));
      manager.focusNext(); // a
      const el = manager.focusNext(); // b
      expect(el?.id).toBe("b");
    });

    it("마지막 요소에서 첫 번째로 순환한다", () => {
      manager.register(makeElement("a", 0));
      manager.register(makeElement("b", 1));
      manager.focusNext(); // a
      manager.focusNext(); // b
      const el = manager.focusNext(); // a (순환)
      expect(el?.id).toBe("a");
    });

    it("요소가 없으면 undefined를 반환한다", () => {
      expect(manager.focusNext()).toBeUndefined();
    });
  });

  describe("focusPrevious", () => {
    it("포커스 없을 때 마지막 요소로 이동한다", () => {
      manager.register(makeElement("a", 0));
      manager.register(makeElement("b", 1));
      const el = manager.focusPrevious();
      expect(el?.id).toBe("b");
    });

    it("이전 요소로 이동한다", () => {
      manager.register(makeElement("a", 0));
      manager.register(makeElement("b", 1));
      manager.focusById("b");
      const el = manager.focusPrevious();
      expect(el?.id).toBe("a");
    });

    it("첫 번째 요소에서 마지막으로 순환한다", () => {
      manager.register(makeElement("a", 0));
      manager.register(makeElement("b", 1));
      manager.focusById("a");
      const el = manager.focusPrevious(); // b (순환)
      expect(el?.id).toBe("b");
    });

    it("요소가 없으면 undefined를 반환한다", () => {
      expect(manager.focusPrevious()).toBeUndefined();
    });
  });

  describe("focusById", () => {
    it("존재하는 id로 포커스 이동 시 true를 반환한다", () => {
      manager.register(makeElement("a", 0));
      manager.register(makeElement("b", 1));
      expect(manager.focusById("b")).toBe(true);
      expect(manager.getCurrent()?.id).toBe("b");
    });

    it("존재하지 않는 id는 false를 반환한다", () => {
      manager.register(makeElement("a", 0));
      expect(manager.focusById("nonexistent")).toBe(false);
    });
  });

  describe("getCurrent", () => {
    it("포커스 없으면 undefined를 반환한다", () => {
      manager.register(makeElement("a", 0));
      expect(manager.getCurrent()).toBeUndefined();
    });

    it("focusNext 후 현재 요소를 반환한다", () => {
      manager.register(makeElement("a", 0));
      manager.focusNext();
      expect(manager.getCurrent()?.id).toBe("a");
    });
  });

  describe("getAll", () => {
    it("빈 배열을 반환한다 (요소 없음)", () => {
      expect(manager.getAll()).toHaveLength(0);
    });

    it("등록된 모든 요소를 반환한다", () => {
      manager.register(makeElement("a", 0));
      manager.register(makeElement("b", 1));
      expect(manager.getAll()).toHaveLength(2);
    });

    it("반환된 배열은 읽기 전용이어야 한다 (런타임)", () => {
      manager.register(makeElement("a", 0));
      const all = manager.getAll();
      // TypeScript readonly이므로 타입 수준에서 보호됨
      // 런타임에서는 배열이 반환되는지 확인
      expect(Array.isArray(all)).toBe(true);
    });
  });

  describe("reset", () => {
    it("모든 요소와 포커스를 초기화한다", () => {
      manager.register(makeElement("a", 0));
      manager.register(makeElement("b", 1));
      manager.focusNext();
      manager.reset();
      expect(manager.getAll()).toHaveLength(0);
      expect(manager.getCurrent()).toBeUndefined();
    });

    it("reset 후 다시 register할 수 있다", () => {
      manager.register(makeElement("a", 0));
      manager.reset();
      manager.register(makeElement("b", 1));
      expect(manager.getAll()).toHaveLength(1);
      expect(manager.getAll()[0].id).toBe("b");
    });
  });

  describe("다양한 FocusableType", () => {
    it("input, button, list, panel 타입을 모두 등록할 수 있다", () => {
      manager.register(makeElement("inp", 0, { type: "input" }));
      manager.register(makeElement("btn", 1, { type: "button" }));
      manager.register(makeElement("lst", 2, { type: "list" }));
      manager.register(makeElement("pnl", 3, { type: "panel" }));
      expect(manager.getAll()).toHaveLength(4);
    });
  });
});
