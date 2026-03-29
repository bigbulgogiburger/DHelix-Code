/**
 * /permissions 명령어 핸들러 — 영구 권한 규칙 관리
 *
 * dhelix의 도구(tool) 사용 권한을 세밀하게 제어합니다.
 *
 * 권한 시스템이란? LLM이 파일 쓰기, 명령 실행 등의 도구를 호출할 때
 * 사용자의 허가가 필요한지 여부를 결정하는 보안 메커니즘입니다.
 *
 * 규칙 형식:
 *   - "tool_name" — 도구 이름으로 매칭 (예: "bash_exec")
 *   - "ToolName(arg_pattern)" — 도구+인자 패턴으로 매칭 (예: "Bash(npm *)")
 *
 * 주요 서브커맨드:
 *   /permissions                  — 현재 권한 상태 표시
 *   /permissions allow <패턴>     — 영구 허용 규칙 추가
 *   /permissions deny <패턴>      — 영구 거부 규칙 추가
 *   /permissions remove <패턴>    — 규칙 제거
 *   /permissions reset            — 모든 규칙 초기화
 *
 * 규칙은 ~/.dhelix/settings.json의 permissions 섹션에 영구 저장됩니다.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { CONFIG_DIR } from "../constants.js";
import { type PermissionMode } from "../permissions/types.js";
import { getModeDescription } from "../permissions/modes.js";
import { type SlashCommand, type CommandResult, type CommandContext } from "./registry.js";

/** 전역 설정 파일 경로 (~/.dhelix/settings.json) */
const SETTINGS_PATH = join(CONFIG_DIR, "settings.json");

/**
 * settings.json의 permissions 섹션 구조 인터페이스
 *
 * @property allow - 허용 규칙 배열 (이 패턴에 매칭되는 도구는 자동 허용)
 * @property deny - 거부 규칙 배열 (이 패턴에 매칭되는 도구는 자동 거부)
 */
interface PermissionsSettings {
  readonly allow: readonly string[];
  readonly deny: readonly string[];
}

/**
 * settings.json 전체를 읽어 변경 가능한 객체로 반환하는 함수
 *
 * 파일이 없으면(ENOENT) 빈 객체를 반환합니다.
 *
 * @returns settings.json의 내용 객체
 * @throws 파일 읽기/파싱 실패 시 (ENOENT 제외)
 */
async function readSettings(): Promise<Record<string, unknown>> {
  try {
    const content = await readFile(SETTINGS_PATH, "utf-8");
    return JSON.parse(content) as Record<string, unknown>;
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return {};
    }
    throw new Error(
      `Failed to read settings: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * 설정을 디스크에 기록하는 함수 (디렉토리 자동 생성)
 *
 * @param settings - 기록할 설정 객체
 */
async function writeSettings(settings: Record<string, unknown>): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n", "utf-8");
}

/**
 * 설정에서 permissions 섹션을 기본값과 함께 추출하는 함수
 *
 * allow/deny 배열이 없으면 빈 배열을 기본값으로 사용합니다.
 *
 * @param settings - 전체 설정 객체
 * @returns 권한 설정 (allow, deny 배열)
 */
function getPermissionsFromSettings(settings: Record<string, unknown>): PermissionsSettings {
  const perms = settings.permissions as Record<string, unknown> | undefined;
  return {
    allow: Array.isArray(perms?.allow) ? (perms.allow as string[]) : [],
    deny: Array.isArray(perms?.deny) ? (perms.deny as string[]) : [],
  };
}

/**
 * 권한 패턴의 유효성을 검증하는 함수
 *
 * 유효한 형식:
 *   - `tool_name` — 도구 이름으로 매칭 (예: file_read, bash_exec)
 *   - `ToolName(arg_pattern)` — 도구 + 인자 글로브 패턴 (예: Bash(npm *))
 *
 * @param pattern - 검증할 패턴 문자열
 * @returns 유효하면 null, 무효하면 에러 메시지 문자열
 */
export function validatePattern(pattern: string): string | null {
  const trimmed = pattern.trim();
  if (trimmed.length === 0) {
    return "Pattern cannot be empty";
  }

  // Check for balanced parentheses
  const parenMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\((.+)\)$/);
  if (parenMatch) {
    const [, toolName, argPattern] = parenMatch;
    if (!toolName || toolName.length === 0) {
      return "Tool name cannot be empty in pattern";
    }
    if (!argPattern || argPattern.length === 0) {
      return "Argument pattern cannot be empty inside parentheses";
    }
    return null;
  }

  // Simple tool name pattern (may include glob chars)
  if (/^[A-Za-z_*?][A-Za-z0-9_*?]*$/.test(trimmed)) {
    return null;
  }

  // Has unbalanced or misplaced parentheses
  if (trimmed.includes("(") || trimmed.includes(")")) {
    return `Invalid pattern: unbalanced parentheses in "${trimmed}"`;
  }

  return `Invalid pattern: "${trimmed}". Use "tool_name" or "ToolName(arg_pattern)"`;
}

/**
 * /permissions (인자 없음) 화면 포맷 — 현재 권한 상태 표시
 *
 * 현재 권한 모드, 허용 규칙, 거부 규칙을 포맷하여 보여줍니다.
 *
 * @param mode - 현재 권한 모드 ("default", "plan" 등)
 * @param perms - 현재 허용/거부 규칙
 * @returns 포맷된 상태 문자열
 */
function formatPermissionStatus(mode: PermissionMode, perms: PermissionsSettings): string {
  const lines: string[] = [];

  lines.push("Permission Status");
  lines.push("─".repeat(40));
  lines.push("");
  lines.push(`  Mode: ${mode}`);
  lines.push(`  ${getModeDescription(mode)}`);
  lines.push("");

  // Allow rules
  lines.push("  Persistent Allow Rules:");
  if (perms.allow.length === 0) {
    lines.push("    (none)");
  } else {
    for (const rule of perms.allow) {
      lines.push(`    + ${rule}`);
    }
  }
  lines.push("");

  // Deny rules
  lines.push("  Persistent Deny Rules:");
  if (perms.deny.length === 0) {
    lines.push("    (none)");
  } else {
    for (const rule of perms.deny) {
      lines.push(`    - ${rule}`);
    }
  }
  lines.push("");

  lines.push("Usage:");
  lines.push("  /permissions allow <pattern>   — Add an allow rule");
  lines.push("  /permissions deny <pattern>    — Add a deny rule");
  lines.push("  /permissions remove <pattern>  — Remove a rule");
  lines.push("  /permissions reset             — Clear all rules");

  return lines.join("\n");
}

/**
 * /permissions allow <pattern> 핸들러 — 영구 허용 규칙 추가
 *
 * 패턴을 검증한 후 중복 여부를 확인하고 settings.json에 저장합니다.
 *
 * @param pattern - 추가할 허용 패턴
 * @returns 작업 결과
 */
async function handleAllow(pattern: string): Promise<CommandResult> {
  const validationError = validatePattern(pattern);
  if (validationError) {
    return { output: `Invalid pattern: ${validationError}`, success: false };
  }

  const settings = await readSettings();
  const perms = getPermissionsFromSettings(settings);

  // Check for duplicates
  if (perms.allow.includes(pattern)) {
    return { output: `Allow rule already exists: ${pattern}`, success: true };
  }

  const updatedAllow = [...perms.allow, pattern];
  settings.permissions = {
    ...(settings.permissions as Record<string, unknown> | undefined),
    allow: updatedAllow,
    deny: [...perms.deny],
  };

  await writeSettings(settings);
  return { output: `Added allow rule: ${pattern}`, success: true };
}

/**
 * /permissions deny <pattern> 핸들러 — 영구 거부 규칙 추가
 *
 * 패턴을 검증한 후 중복 여부를 확인하고 settings.json에 저장합니다.
 *
 * @param pattern - 추가할 거부 패턴
 * @returns 작업 결과
 */
async function handleDeny(pattern: string): Promise<CommandResult> {
  const validationError = validatePattern(pattern);
  if (validationError) {
    return { output: `Invalid pattern: ${validationError}`, success: false };
  }

  const settings = await readSettings();
  const perms = getPermissionsFromSettings(settings);

  // Check for duplicates
  if (perms.deny.includes(pattern)) {
    return { output: `Deny rule already exists: ${pattern}`, success: true };
  }

  const updatedDeny = [...perms.deny, pattern];
  settings.permissions = {
    ...(settings.permissions as Record<string, unknown> | undefined),
    allow: [...perms.allow],
    deny: updatedDeny,
  };

  await writeSettings(settings);
  return { output: `Added deny rule: ${pattern}`, success: true };
}

/**
 * /permissions remove <pattern> 핸들러 — 허용 또는 거부 규칙 제거
 *
 * allow와 deny 양쪽에서 패턴을 찾아 제거합니다.
 *
 * @param pattern - 제거할 패턴
 * @returns 작업 결과
 */
async function handleRemove(pattern: string): Promise<CommandResult> {
  const trimmed = pattern.trim();
  if (trimmed.length === 0) {
    return { output: "Please specify a pattern to remove.", success: false };
  }

  const settings = await readSettings();
  const perms = getPermissionsFromSettings(settings);

  const inAllow = perms.allow.includes(trimmed);
  const inDeny = perms.deny.includes(trimmed);

  if (!inAllow && !inDeny) {
    return { output: `Rule not found: ${trimmed}`, success: false };
  }

  const updatedAllow = perms.allow.filter((r) => r !== trimmed);
  const updatedDeny = perms.deny.filter((r) => r !== trimmed);

  settings.permissions = {
    ...(settings.permissions as Record<string, unknown> | undefined),
    allow: updatedAllow,
    deny: updatedDeny,
  };

  await writeSettings(settings);

  const source = inAllow && inDeny ? "allow and deny" : inAllow ? "allow" : "deny";
  return { output: `Removed rule from ${source}: ${trimmed}`, success: true };
}

/**
 * /permissions reset 핸들러 — 모든 영구 규칙 초기화
 *
 * allow와 deny 배열을 모두 비우고 settings.json에 저장합니다.
 *
 * @returns 초기화 결과
 */
async function handleReset(): Promise<CommandResult> {
  const settings = await readSettings();
  const perms = getPermissionsFromSettings(settings);

  const totalRules = perms.allow.length + perms.deny.length;
  if (totalRules === 0) {
    return { output: "No persistent rules to clear.", success: true };
  }

  settings.permissions = {
    ...(settings.permissions as Record<string, unknown> | undefined),
    allow: [],
    deny: [],
  };

  await writeSettings(settings);
  return {
    output: `Cleared ${totalRules} persistent permission rule${totalRules !== 1 ? "s" : ""}.`,
    success: true,
  };
}

/**
 * /permissions 슬래시 명령어 정의 — 영구 권한 규칙 관리
 *
 * 서브커맨드를 파싱하여 해당 핸들러로 라우팅합니다.
 * 인자 없이 호출하면 현재 권한 상태를 표시합니다.
 */
export const permissionsCommand: SlashCommand = {
  name: "permissions",
  description: "View and manage persistent permission rules",
  usage: "/permissions [allow|deny|remove|reset] [pattern]",

  async execute(args: string, _context: CommandContext): Promise<CommandResult> {
    const trimmed = args.trim();
    const spaceIdx = trimmed.indexOf(" ");
    const subcommand = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
    const subArgs = spaceIdx === -1 ? "" : trimmed.slice(spaceIdx + 1).trim();

    // No args: show current status
    if (!subcommand) {
      const settings = await readSettings();
      const perms = getPermissionsFromSettings(settings);
      const mode = (settings.permissionMode as PermissionMode | undefined) ?? "default";
      return {
        output: formatPermissionStatus(mode, perms),
        success: true,
      };
    }

    switch (subcommand) {
      case "allow":
        if (!subArgs) {
          return { output: "Usage: /permissions allow <pattern>", success: false };
        }
        return handleAllow(subArgs);

      case "deny":
        if (!subArgs) {
          return { output: "Usage: /permissions deny <pattern>", success: false };
        }
        return handleDeny(subArgs);

      case "remove":
        if (!subArgs) {
          return { output: "Usage: /permissions remove <pattern>", success: false };
        }
        return handleRemove(subArgs);

      case "reset":
        return handleReset();

      default:
        return {
          output: `Unknown subcommand: ${subcommand}\n\nUsage: /permissions [allow|deny|remove|reset] [pattern]`,
          success: false,
        };
    }
  },
};
