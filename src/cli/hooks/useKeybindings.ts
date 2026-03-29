/**
 * useKeybindings.ts — 키보드 단축키 시스템
 *
 * 커스터마이징 가능한 키바인딩 시스템을 구현합니다.
 * 기본 단축키가 정의되어 있고, 사용자가 ~/.dhelix/keybindings.json으로
 * 키 매핑을 변경할 수 있습니다.
 *
 * 기본 단축키:
 * - Escape → 현재 작업 취소
 * - Ctrl+J → 줄바꿈 삽입
 * - Shift+Tab → 권한 모드 순환
 * - Ctrl+O → 상세 모드 토글
 * - Ctrl+D → 종료
 * - Alt+T → 확장 사고 토글
 * - Alt+V → 음성 녹음 토글
 *
 * 이 파일에 포함된 기능:
 * - parseKeyCombo/formatKeyCombo: 키 조합 문자열 파싱/포맷
 * - loadKeybindingConfig: 사용자 설정 파일 로드
 * - getEffectiveBindings: 기본값과 사용자 설정 병합
 * - buildKeybindings: 키-액션 매핑을 Keybinding 배열로 변환
 * - useKeybindings: 실제 키 입력을 감지하는 React 훅
 */
import { useInput } from "ink";
import { useCallback, useMemo } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

/** 키바인딩 정의 — 키 조합, 수식키(ctrl/meta/shift), 액션명, 핸들러 함수를 포함 */
export interface Keybinding {
  readonly key: string;
  readonly ctrl?: boolean;
  readonly meta?: boolean;
  readonly shift?: boolean;
  readonly action?: string;
  readonly handler: () => void;
}

/** JSON 파일에서 읽어온 직렬화 가능한 키바인딩 설정 */
export interface KeybindingConfig {
  readonly key: string;
  readonly ctrl?: boolean;
  readonly meta?: boolean;
  readonly shift?: boolean;
  /** Action name to map to a handler */
  readonly action: string;
}

/** ~/.dhelix/keybindings.json 파일의 형식 */
export interface KeybindingsFile {
  readonly bindings: Record<string, string>;
}

/** 기본 키→액션 매핑 — 사용자 설정이 없을 때 사용되는 기본값 */
export const DEFAULT_BINDINGS: Readonly<Record<string, string>> = {
  escape: "cancel",
  "ctrl+j": "newline",
  "shift+tab": "cycle-mode",
  "ctrl+o": "toggle-verbose",
  "ctrl+d": "exit",
  "alt+t": "toggle-thinking",
  "alt+v": "toggle-voice",
} as const;

/** 각 액션에 대한 사람이 읽을 수 있는 설명 */
export const ACTION_DESCRIPTIONS: Readonly<Record<string, string>> = {
  cancel: "Cancel current operation / dismiss completion",
  newline: "Insert newline in multi-line input",
  "cycle-mode": "Cycle through permission modes",
  "toggle-verbose": "Toggle verbose mode (show/hide full tool outputs)",
  exit: "Exit the application",
  "toggle-thinking": "Toggle extended thinking on/off",
  "toggle-voice": "Start/stop voice recording (push-to-talk)",
} as const;

/**
 * "ctrl+o", "alt+t", "escape", "shift+tab" 같은 키 조합 문자열을
 * 구조화된 객체로 파싱합니다. "+"로 분리하여 수식키와 키를 구분합니다.
 */
export function parseKeyCombo(combo: string): {
  readonly key: string;
  readonly ctrl: boolean;
  readonly meta: boolean;
  readonly shift: boolean;
} {
  const parts = combo.toLowerCase().split("+");
  let ctrl = false;
  let meta = false;
  let shift = false;
  let key = "";

  for (const part of parts) {
    switch (part) {
      case "ctrl":
        ctrl = true;
        break;
      case "alt":
      case "meta":
      case "option":
        meta = true;
        break;
      case "shift":
        shift = true;
        break;
      default:
        key = part;
        break;
    }
  }

  return { key, ctrl, meta, shift };
}

/**
 * 키 조합 객체를 표시용 문자열로 다시 변환합니다.
 * 예: { key: "o", ctrl: true } → "Ctrl+O"
 */
export function formatKeyCombo(combo: {
  readonly key: string;
  readonly ctrl?: boolean;
  readonly meta?: boolean;
  readonly shift?: boolean;
}): string {
  const parts: string[] = [];
  if (combo.ctrl) parts.push("Ctrl");
  if (combo.meta) parts.push("Alt");
  if (combo.shift) parts.push("Shift");
  // Capitalize single-char keys, keep multi-char keys as-is
  const displayKey =
    combo.key.length === 1
      ? combo.key.toUpperCase()
      : combo.key.charAt(0).toUpperCase() + combo.key.slice(1);
  parts.push(displayKey);
  return parts.join("+");
}

/**
 * ~/.dhelix/keybindings.json에서 키바인딩 설정을 로드합니다.
 *
 * 두 가지 형식을 지원합니다:
 * - 새 형식: { "bindings": { "escape": "cancel", ... } }
 * - 레거시 형식: [ { "key": "escape", "action": "cancel" }, ... ]
 *
 * 파일이 없거나 파싱에 실패하면 빈 객체를 반환합니다.
 *
 * @returns 키 조합 → 액션 이름의 레코드
 */
export function loadKeybindingConfig(): Readonly<Record<string, string>> {
  const configPath = join(homedir(), ".dhelix", "keybindings.json");
  try {
    const content = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(content) as unknown;

    // New format: { bindings: { ... } }
    if (parsed && typeof parsed === "object" && "bindings" in parsed) {
      const file = parsed as KeybindingsFile;
      if (typeof file.bindings === "object" && file.bindings !== null) {
        return file.bindings;
      }
    }

    // Legacy format: array of KeybindingConfig
    if (Array.isArray(parsed)) {
      const result: Record<string, string> = {};
      for (const item of parsed as KeybindingConfig[]) {
        const combo = [
          item.ctrl ? "ctrl" : "",
          item.meta ? "alt" : "",
          item.shift ? "shift" : "",
          item.key,
        ]
          .filter(Boolean)
          .join("+");
        result[combo] = item.action;
      }
      return result;
    }

    return {};
  } catch {
    return {};
  }
}

/**
 * 기본 키바인딩과 사용자 설정을 병합하여 실효 바인딩을 반환합니다.
 * 사용자가 동일한 액션을 다른 키에 매핑하면 기본 키를 제거합니다.
 */
export function getEffectiveBindings(
  userConfig: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  // Start with defaults
  const effective: Record<string, string> = { ...DEFAULT_BINDINGS };

  // If user remaps an action to a different key, remove the default key
  const userActions = new Set(Object.values(userConfig));
  for (const [key, action] of Object.entries(effective)) {
    if (userActions.has(action)) {
      delete effective[key];
    }
  }

  // Apply user overrides
  for (const [key, action] of Object.entries(userConfig)) {
    effective[key] = action;
  }

  return effective;
}

/**
 * 키→액션 맵과 액션→핸들러 맵으로부터 Keybinding 배열을 생성합니다.
 * 핸들러가 없는 액션은 건너뜁니다.
 */
export function buildKeybindings(
  bindings: Readonly<Record<string, string>>,
  actionHandlers: Readonly<Record<string, () => void>>,
): readonly Keybinding[] {
  const result: Keybinding[] = [];
  for (const [combo, action] of Object.entries(bindings)) {
    const handler = actionHandlers[action];
    if (!handler) continue;

    const parsed = parseKeyCombo(combo);
    result.push({
      key: parsed.key,
      ctrl: parsed.ctrl || undefined,
      meta: parsed.meta || undefined,
      shift: parsed.shift || undefined,
      action,
      handler,
    });
  }
  return result;
}

/**
 * Merge user-configured keybindings with default bindings.
 * User configs override defaults for the same action.
 * @deprecated Use buildKeybindings + getEffectiveBindings instead.
 */
export function mergeKeybindings(
  defaults: readonly Keybinding[],
  configs: readonly KeybindingConfig[],
  actionHandlers: Readonly<Record<string, () => void>>,
): readonly Keybinding[] {
  // Start with defaults
  const merged = new Map<string, Keybinding>();
  for (const binding of defaults) {
    const id = `${binding.ctrl ? "ctrl+" : ""}${binding.meta ? "meta+" : ""}${binding.key}`;
    merged.set(id, binding);
  }

  // Apply user overrides
  for (const config of configs) {
    const handler = actionHandlers[config.action];
    if (!handler) continue;

    const id = `${config.ctrl ? "ctrl+" : ""}${config.meta ? "meta+" : ""}${config.key}`;
    merged.set(id, {
      key: config.key,
      ctrl: config.ctrl,
      meta: config.meta,
      shift: config.shift,
      handler,
    });
  }

  return [...merged.values()];
}

/**
 * 설정 가능한 키 매핑으로 커스텀 키바인딩을 등록하는 React 훅
 *
 * Ink의 useInput을 사용하여 키 입력을 감지하고,
 * 등록된 바인딩과 매칭하여 핸들러를 호출합니다.
 * escape, tab 같은 특수 키와 ctrl/meta 수식키를 모두 지원합니다.
 */
export function useKeybindings(bindings: readonly Keybinding[], isActive = true) {
  const stableBindings = useMemo(() => [...bindings], [bindings]);

  const handleInput = useCallback(
    (
      input: string,
      key: { ctrl: boolean; meta: boolean; shift: boolean; escape: boolean; tab: boolean },
    ) => {
      for (const binding of stableBindings) {
        const ctrlMatch = binding.ctrl ? key.ctrl : !key.ctrl;
        const metaMatch = binding.meta ? key.meta : !key.meta;

        // Handle special keys
        if (binding.key === "escape" && key.escape && ctrlMatch && metaMatch) {
          binding.handler();
          return;
        }
        if (binding.key === "tab" && key.tab) {
          // For shift+tab, check shift modifier
          const shiftMatch = binding.shift ? key.shift : !key.shift;
          if (ctrlMatch && metaMatch && shiftMatch) {
            binding.handler();
            return;
          }
          continue;
        }

        if (input === binding.key && ctrlMatch && metaMatch) {
          binding.handler();
          return;
        }
      }
    },
    [stableBindings],
  );

  useInput(handleInput, { isActive });
}

/** 키바인딩 설정 파일 경로 — ~/.dhelix/keybindings.json */
export const KEYBINDINGS_CONFIG_PATH = join(homedir(), ".dhelix", "keybindings.json");
