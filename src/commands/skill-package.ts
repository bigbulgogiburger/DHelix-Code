/**
 * /skill-package 명령어 — dhelix 스킬을 portable .dskill 아카이브로 번들링
 *
 * 동작:
 *   1. args 파싱: <name> [--version v] [--output dir] [--trust-level level]
 *   2. skillDir = `<ctx.workingDirectory>/.dhelix/skills/<name>/` 존재 확인
 *   3. `packageSkill()` 호출 → 결과로 outputPath / size / sha256 요약 생성
 *
 * DI: `createSkillPackageCommand({ packageSkill })` 로 테스트 주입 가능.
 */

import { join } from "node:path";
import { APP_NAME } from "../constants.js";
import { type CommandContext, type CommandResult, type SlashCommand } from "./registry.js";
import {
  packageSkill as defaultPackageSkill,
  PackageError,
  type PackageOptions,
  type PackageResult,
} from "../skills/creator/packaging/package.js";

/** kebab-case 스킬 이름 패턴 — scaffold/eval 와 동일 규약 */
const KEBAB_CASE_REGEX = /^[a-z][a-z0-9-]*$/;

/** 유효 trust level 집합 */
const VALID_TRUST_LEVELS: ReadonlySet<string> = new Set([
  "built-in",
  "project",
  "community",
  "untrusted",
]);

/** 주입 가능한 의존성 */
export interface SkillPackageDeps {
  readonly packageSkill: (opts: PackageOptions) => Promise<PackageResult>;
}

/** 프로덕션 기본 의존성 */
const productionDeps: SkillPackageDeps = {
  packageSkill: defaultPackageSkill,
};

/** 파싱된 args */
interface ParsedArgs {
  readonly name: string | undefined;
  readonly version: string | undefined;
  readonly output: string | undefined;
  readonly trustLevel: string | undefined;
  readonly error: string | undefined;
}

/** args 문자열을 토큰화하여 flag/value 를 추출 */
function parseArgs(raw: string): ParsedArgs {
  const tokens = raw
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);

  let name: string | undefined;
  let version: string | undefined;
  let output: string | undefined;
  let trustLevel: string | undefined;
  let error: string | undefined;

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (!token) continue;

    if (token === "--version") {
      const next = tokens[i + 1];
      if (!next) {
        error = "--version requires a value.";
        break;
      }
      version = next;
      i += 1;
      continue;
    }
    if (token === "--output") {
      const next = tokens[i + 1];
      if (!next) {
        error = "--output requires a directory path.";
        break;
      }
      output = next;
      i += 1;
      continue;
    }
    if (token === "--trust-level") {
      const next = tokens[i + 1];
      if (!next) {
        error = "--trust-level requires a value.";
        break;
      }
      trustLevel = next;
      i += 1;
      continue;
    }
    if (token.startsWith("--")) {
      error = `Unknown flag: ${token}`;
      break;
    }
    if (name === undefined) {
      name = token;
    }
  }

  return { name, version, output, trustLevel, error };
}

/**
 * 바이트 수를 사람이 읽기 좋은 단위로 포맷
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * /skill-package 커맨드를 DI 주입 팩토리로 생성
 *
 * @param overrides - 선택적으로 교체할 의존성 (테스트용)
 */
export function createSkillPackageCommand(
  overrides: Partial<SkillPackageDeps> = {},
): SlashCommand {
  const deps: SkillPackageDeps = { ...productionDeps, ...overrides };

  return {
    name: "skill-package",
    description:
      "Bundle a dhelix skill into a portable .dskill archive for sharing or installing elsewhere. Use when the user says 'package skill X', '스킬 패키징', 'export skill', 'create .dskill', 'share my skill'.",
    usage:
      "/skill-package <skill-name> [--version v] [--output dir] [--trust-level level]",
    execute: async (args: string, ctx: CommandContext): Promise<CommandResult> => {
      try {
        const parsed = parseArgs(args);

        if (parsed.error) {
          return { output: parsed.error, success: false };
        }

        if (!parsed.name || parsed.name.length === 0) {
          return {
            output:
              "skill name is required. Usage: /skill-package <skill-name> [--version v] [--output dir] [--trust-level level]",
            success: false,
          };
        }

        if (!KEBAB_CASE_REGEX.test(parsed.name)) {
          return {
            output: `INVALID_NAME: '${parsed.name}' is not a valid kebab-case skill name. Use lowercase letters, digits, and hyphens (must start with a letter).`,
            success: false,
          };
        }

        if (parsed.trustLevel && !VALID_TRUST_LEVELS.has(parsed.trustLevel)) {
          return {
            output: `INVALID_TRUST_LEVEL: '${parsed.trustLevel}' — must be one of: built-in, project, community, untrusted.`,
            success: false,
          };
        }

        const skillDir = join(
          ctx.workingDirectory,
          `.${APP_NAME}`,
          "skills",
          parsed.name,
        );
        const outputDir =
          parsed.output ?? join(ctx.workingDirectory, `.${APP_NAME}`, "dist");

        const packageOpts: PackageOptions = {
          skillDir,
          outputDir,
          ...(parsed.version ? { version: parsed.version } : {}),
          ...(parsed.trustLevel
            ? {
                trustLevel: parsed.trustLevel as PackageOptions["trustLevel"],
              }
            : {}),
        };

        let result: PackageResult;
        try {
          result = await deps.packageSkill(packageOpts);
        } catch (err) {
          if (err instanceof PackageError) {
            if (err.code === "SKILL_NOT_FOUND") {
              return {
                output: `Skill '${parsed.name}' not found at ${skillDir}. Create it first with /create-skill <name>.`,
                success: false,
              };
            }
            return {
              output: `/skill-package failed [${err.code}]: ${err.message}`,
              success: false,
            };
          }
          throw err;
        }

        const lines: string[] = [];
        lines.push(`packaged skill '${result.manifest.name}' v${result.manifest.version}`);
        lines.push(`  output: ${result.outputPath}`);
        lines.push(`  size:   ${formatBytes(result.bytes)}`);
        lines.push(`  files:  ${String(result.fileCount)}`);
        lines.push(`  sha256: ${result.sha256.slice(0, 16)}…  (full: ${result.sha256})`);
        lines.push(`  trust:  ${result.manifest.trustLevel}`);

        return { output: lines.join("\n"), success: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { output: `/skill-package failed: ${msg}`, success: false };
      }
    },
  };
}

/** 빌트인 레지스트리 등록용 인스턴스 */
export const skillPackageCommand: SlashCommand = createSkillPackageCommand();
