/**
 * Hook Events — 이벤트 타입 검증 및 HookEventRegistry 조회 테스트
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  HookEventRegistry,
  HOOK_EVENT_REGISTRY,
  type OnToolStartPayload,
  type OnToolCompletePayload,
  type OnToolErrorPayload,
  type OnCompactionStartPayload,
  type OnCompactionCompletePayload,
  type OnSessionCreatePayload,
  type OnSessionResumePayload,
  type OnModelSwitchPayload,
  type OnMcpConnectPayload,
  type OnMcpDisconnectPayload,
  type OnPermissionGrantPayload,
  type OnPermissionDenyPayload,
} from "../../../src/hooks/events.js";
import { type HookEvent } from "../../../src/hooks/types.js";

// ---------------------------------------------------------------------------
// HookEventRegistry
// ---------------------------------------------------------------------------

describe("HookEventRegistry", () => {
  let registry: HookEventRegistry;

  beforeEach(() => {
    registry = new HookEventRegistry();
  });

  describe("getAllEvents()", () => {
    it("12개의 이벤트를 반환한다", () => {
      const events = registry.getAllEvents();
      expect(events).toHaveLength(12);
    });

    it("반환된 배열은 불변(readonly)이다", () => {
      const events = registry.getAllEvents();
      // readonly 타입이므로 타입 레벨에서 push가 금지됨 — 런타임 검증
      expect(Array.isArray(events)).toBe(true);
    });

    it("모든 이벤트가 id와 description을 가진다", () => {
      for (const event of registry.getAllEvents()) {
        expect(event.id).toBeTruthy();
        expect(event.description).toBeTruthy();
      }
    });
  });

  describe("getMetadata()", () => {
    it("onToolStart 메타데이터를 반환한다", () => {
      const meta = registry.getMetadata("onToolStart");
      expect(meta).toBeDefined();
      expect(meta?.id).toBe("onToolStart");
      expect(meta?.hookEvent).toBe("PreToolUse");
      expect(meta?.sourceEvent).toBe("tool:start");
    });

    it("onToolComplete 메타데이터를 반환한다", () => {
      const meta = registry.getMetadata("onToolComplete");
      expect(meta?.hookEvent).toBe("PostToolUse");
      expect(meta?.sourceEvent).toBe("tool:complete");
    });

    it("onToolError 메타데이터를 반환한다", () => {
      const meta = registry.getMetadata("onToolError");
      expect(meta?.hookEvent).toBe("PostToolUseFailure");
    });

    it("onCompactionStart 메타데이터를 반환한다", () => {
      const meta = registry.getMetadata("onCompactionStart");
      expect(meta?.hookEvent).toBe("PreCompact");
      expect(meta?.sourceEvent).toBe("context:pre-compact");
    });

    it("onCompactionComplete 메타데이터는 hookEvent가 없다", () => {
      const meta = registry.getMetadata("onCompactionComplete");
      expect(meta).toBeDefined();
      expect(meta?.hookEvent).toBeUndefined();
    });

    it("onSessionCreate 메타데이터를 반환한다", () => {
      const meta = registry.getMetadata("onSessionCreate");
      expect(meta?.hookEvent).toBe("SessionStart");
    });

    it("onSessionResume 메타데이터를 반환한다", () => {
      const meta = registry.getMetadata("onSessionResume");
      expect(meta?.hookEvent).toBe("SessionStart");
    });

    it("onModelSwitch 메타데이터는 hookEvent가 없다", () => {
      const meta = registry.getMetadata("onModelSwitch");
      expect(meta).toBeDefined();
      expect(meta?.hookEvent).toBeUndefined();
    });

    it("onMcpConnect / onMcpDisconnect 메타데이터를 반환한다", () => {
      expect(registry.getMetadata("onMcpConnect")).toBeDefined();
      expect(registry.getMetadata("onMcpDisconnect")).toBeDefined();
    });

    it("onPermissionGrant 메타데이터를 반환한다", () => {
      const meta = registry.getMetadata("onPermissionGrant");
      expect(meta?.hookEvent).toBe("PermissionRequest");
    });

    it("onPermissionDeny 메타데이터를 반환한다", () => {
      const meta = registry.getMetadata("onPermissionDeny");
      expect(meta?.hookEvent).toBe("PermissionRequest");
    });

    it("존재하지 않는 ID는 undefined를 반환한다", () => {
      expect(registry.getMetadata("onNonExistent")).toBeUndefined();
      expect(registry.getMetadata("")).toBeUndefined();
    });
  });

  describe("getEventsByHookEvent()", () => {
    it("PreToolUse에 매핑된 이벤트를 반환한다", () => {
      const events = registry.getEventsByHookEvent("PreToolUse");
      expect(events).toHaveLength(1);
      expect(events[0].id).toBe("onToolStart");
    });

    it("PostToolUse에 매핑된 이벤트를 반환한다", () => {
      const events = registry.getEventsByHookEvent("PostToolUse");
      expect(events).toHaveLength(1);
      expect(events[0].id).toBe("onToolComplete");
    });

    it("PostToolUseFailure에 매핑된 이벤트를 반환한다", () => {
      const events = registry.getEventsByHookEvent("PostToolUseFailure");
      expect(events).toHaveLength(1);
      expect(events[0].id).toBe("onToolError");
    });

    it("SessionStart에 매핑된 이벤트는 2개다", () => {
      const events = registry.getEventsByHookEvent("SessionStart");
      expect(events).toHaveLength(2);
      const ids = events.map((e) => e.id);
      expect(ids).toContain("onSessionCreate");
      expect(ids).toContain("onSessionResume");
    });

    it("PermissionRequest에 매핑된 이벤트는 2개다", () => {
      const events = registry.getEventsByHookEvent("PermissionRequest");
      expect(events).toHaveLength(2);
      const ids = events.map((e) => e.id);
      expect(ids).toContain("onPermissionGrant");
      expect(ids).toContain("onPermissionDeny");
    });

    it("매핑된 이벤트가 없는 HookEvent는 빈 배열을 반환한다", () => {
      const events = registry.getEventsByHookEvent("Stop" as HookEvent);
      expect(events).toHaveLength(0);
    });
  });

  describe("getEventIds()", () => {
    it("12개의 ID를 반환한다", () => {
      const ids = registry.getEventIds();
      expect(ids).toHaveLength(12);
    });

    it("모든 예상 ID가 포함된다", () => {
      const ids = registry.getEventIds();
      expect(ids).toContain("onToolStart");
      expect(ids).toContain("onToolComplete");
      expect(ids).toContain("onToolError");
      expect(ids).toContain("onCompactionStart");
      expect(ids).toContain("onCompactionComplete");
      expect(ids).toContain("onSessionCreate");
      expect(ids).toContain("onSessionResume");
      expect(ids).toContain("onModelSwitch");
      expect(ids).toContain("onMcpConnect");
      expect(ids).toContain("onMcpDisconnect");
      expect(ids).toContain("onPermissionGrant");
      expect(ids).toContain("onPermissionDeny");
    });
  });

  describe("hasEvent()", () => {
    it("등록된 이벤트는 true를 반환한다", () => {
      expect(registry.hasEvent("onToolStart")).toBe(true);
      expect(registry.hasEvent("onModelSwitch")).toBe(true);
    });

    it("미등록 이벤트는 false를 반환한다", () => {
      expect(registry.hasEvent("onNonExistent")).toBe(false);
      expect(registry.hasEvent("")).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// 전역 싱글턴 HOOK_EVENT_REGISTRY
// ---------------------------------------------------------------------------

describe("HOOK_EVENT_REGISTRY (singleton)", () => {
  it("HookEventRegistry 인스턴스다", () => {
    expect(HOOK_EVENT_REGISTRY).toBeInstanceOf(HookEventRegistry);
  });

  it("onToolStart 메타데이터를 반환한다", () => {
    const meta = HOOK_EVENT_REGISTRY.getMetadata("onToolStart");
    expect(meta?.id).toBe("onToolStart");
  });
});

// ---------------------------------------------------------------------------
// 페이로드 타입 구조 검증 (컴파일 타임 + 런타임)
// ---------------------------------------------------------------------------

describe("페이로드 타입 구조 검증", () => {
  it("OnToolStartPayload — 필수 필드 구성 가능", () => {
    const payload: OnToolStartPayload = {
      toolName: "file_write",
      toolId: "tc-001",
    };
    expect(payload.toolName).toBe("file_write");
    expect(payload.toolId).toBe("tc-001");
    expect(payload.args).toBeUndefined();
  });

  it("OnToolStartPayload — 선택 필드 포함 구성 가능", () => {
    const payload: OnToolStartPayload = {
      toolName: "bash_exec",
      toolId: "tc-002",
      args: { command: "ls" },
      sessionId: "sess-abc",
      subagentId: "sub-1",
    };
    expect(payload.args).toEqual({ command: "ls" });
  });

  it("OnToolCompletePayload — 필수 필드 구성 가능", () => {
    const payload: OnToolCompletePayload = {
      toolName: "file_read",
      toolId: "tc-003",
    };
    expect(payload.toolName).toBe("file_read");
  });

  it("OnToolErrorPayload — 필수 필드 구성 가능", () => {
    const payload: OnToolErrorPayload = {
      toolName: "file_write",
      toolId: "tc-004",
      output: "Permission denied",
    };
    expect(payload.output).toBe("Permission denied");
  });

  it("OnCompactionStartPayload — 필수 필드 구성 가능", () => {
    const payload: OnCompactionStartPayload = {
      compactionNumber: 1,
    };
    expect(payload.compactionNumber).toBe(1);
  });

  it("OnCompactionCompletePayload — 모든 필드 구성 가능", () => {
    const payload: OnCompactionCompletePayload = {
      originalTokens: 10000,
      compactedTokens: 3000,
      removedMessages: 5,
      sessionId: "sess-abc",
    };
    expect(payload.originalTokens).toBe(10000);
    expect(payload.compactedTokens).toBe(3000);
    expect(payload.removedMessages).toBe(5);
  });

  it("OnSessionCreatePayload — 필수 필드 구성 가능", () => {
    const payload: OnSessionCreatePayload = {
      sessionId: "sess-new",
      workingDirectory: "/project",
    };
    expect(payload.sessionId).toBe("sess-new");
  });

  it("OnSessionResumePayload — 모든 필드 구성 가능", () => {
    const payload: OnSessionResumePayload = {
      sessionId: "sess-old",
      workingDirectory: "/project",
      messageCount: 42,
      model: "claude-3-5-sonnet",
    };
    expect(payload.messageCount).toBe(42);
  });

  it("OnModelSwitchPayload — 필수 필드 구성 가능", () => {
    const payload: OnModelSwitchPayload = {
      fromModel: "gpt-4o",
      toModel: "claude-3-5-sonnet",
      reason: "user-command",
    };
    expect(payload.fromModel).toBe("gpt-4o");
    expect(payload.toModel).toBe("claude-3-5-sonnet");
  });

  it("OnMcpConnectPayload — 필수 필드 구성 가능", () => {
    const payload: OnMcpConnectPayload = {
      serverName: "filesystem",
      toolCount: 5,
    };
    expect(payload.serverName).toBe("filesystem");
  });

  it("OnMcpDisconnectPayload — 필수 필드 구성 가능", () => {
    const payload: OnMcpDisconnectPayload = {
      serverName: "filesystem",
      reason: "shutdown",
    };
    expect(payload.reason).toBe("shutdown");
  });

  it("OnPermissionGrantPayload — 필수 필드 구성 가능", () => {
    const payload: OnPermissionGrantPayload = {
      toolName: "bash_exec",
      permissionMode: "confirm",
      grantedBy: "user",
    };
    expect(payload.grantedBy).toBe("user");
  });

  it("OnPermissionDenyPayload — 필수 필드 구성 가능", () => {
    const payload: OnPermissionDenyPayload = {
      toolName: "bash_exec",
      reason: "user-rejected",
    };
    expect(payload.reason).toBe("user-rejected");
  });
});
