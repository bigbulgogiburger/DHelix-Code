/**
 * /skill-install — install a `.dskill` archive into `<cwd>/.dhelix/skills`.
 *
 * Parses: `<path-to-.dskill> [--trust community|untrusted|project] [--force]`.
 *
 * Delegates security-critical work (tar-slip prevention, symlink rejection,
 * integrity verification, trust-level policy) to {@link installSkill}. This
 * command focuses on argument parsing, destination resolution, and user-
 * facing output. Fatal security failures are surfaced with a `[SECURITY]`
 * prefix so the CLI layer can highlight them.
 *
 * Dependency injection: `createSkillInstallCommand({ install, fs })` allows
 * tests to stub out the installer. The production instance is exported as
 * {@link skillInstallCommand} for registry wiring.
 *
 * @see src/skills/creator/packaging/install.ts
 */

import * as defaultFs from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

import { APP_NAME } from "../constants.js";
import {
  type CommandContext,
  type CommandResult,
  type SlashCommand,
} from "./registry.js";
import {
  InstallError,
  type InstallOptions,
  type InstallResult,
  type InstallTrustLevel,
  installSkill as defaultInstallSkill,
} from "../skills/creator/packaging/install.js";

/** Dependencies injected into {@link createSkillInstallCommand}. */
export interface SkillInstallDeps {
  readonly install: (opts: InstallOptions) => Promise<InstallResult>;
  readonly fs: {
    readonly stat: (path: string) => Promise<unknown>;
  };
}

/** Production defaults. */
const productionDeps: SkillInstallDeps = {
  install: defaultInstallSkill,
  fs: {
    stat: (p) => defaultFs.stat(p),
  },
};

/** Parsed CLI arguments. */
interface ParsedArgs {
  readonly archivePath: string | undefined;
  readonly trustLevel: InstallTrustLevel;
  readonly force: boolean;
  readonly parseError: string | undefined;
}

/**
 * Tokenize args and extract archive path, `--trust LEVEL`, `--force`.
 *
 * The first positional token is the archive path. Unknown flags produce a
 * fast-fail parse error rather than being silently ignored.
 */
function parseArgs(raw: string): ParsedArgs {
  const tokens = raw.trim().split(/\s+/).filter((t) => t.length > 0);

  let archivePath: string | undefined;
  let trustLevel: InstallTrustLevel = "community";
  let force = false;
  let parseError: string | undefined;

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (!token) continue;

    if (token === "--force") {
      force = true;
      continue;
    }

    if (token === "--trust") {
      const next = tokens[i + 1];
      if (!next) {
        parseError = "--trust requires a value: project | community | untrusted";
        break;
      }
      if (next !== "project" && next !== "community" && next !== "untrusted") {
        parseError = `--trust value '${next}' must be one of: project, community, untrusted`;
        break;
      }
      trustLevel = next;
      i += 1;
      continue;
    }

    if (token.startsWith("--")) {
      parseError = `Unknown flag: ${token}`;
      break;
    }

    if (archivePath === undefined) {
      archivePath = token;
      continue;
    }
    // Extra positional arg — tolerate silently (flags-only after first arg).
  }

  return { archivePath, trustLevel, force, parseError };
}

/** Security-sensitive error codes — prefix CLI output with `[SECURITY]`. */
const SECURITY_CODES = new Set<InstallError["code"]>([
  "TAR_SLIP_REJECTED",
  "SYMLINK_REJECTED",
  "INTEGRITY_MISMATCH",
  "POLICY_VIOLATION",
]);

/**
 * Factory for the `/skill-install` command.
 *
 * @param overrides - optional deps (tests pass a stubbed installer)
 * @returns a ready-to-register {@link SlashCommand}
 */
export function createSkillInstallCommand(
  overrides: Partial<SkillInstallDeps> = {},
): SlashCommand {
  const deps: SkillInstallDeps = { ...productionDeps, ...overrides };

  return {
    name: "skill-install",
    description:
      "Install a .dskill archive into .dhelix/skills. Verifies integrity, rejects tar-slip/symlinks, enforces trust-level policy. Use when the user says 'install skill', '스킬 설치', 'import .dskill', 'add skill from file'.",
    usage: "/skill-install <path-to-.dskill> [--trust community|untrusted|project] [--force]",
    execute: async (args: string, ctx: CommandContext): Promise<CommandResult> => {
      try {
        const parsed = parseArgs(args);

        if (parsed.parseError) {
          return { output: parsed.parseError, success: false };
        }

        if (!parsed.archivePath || parsed.archivePath.length === 0) {
          return {
            output:
              "archive path is required. Usage: /skill-install <path-to-.dskill> [--trust LEVEL] [--force]",
            success: false,
          };
        }

        const archiveAbs = isAbsolute(parsed.archivePath)
          ? parsed.archivePath
          : resolve(ctx.workingDirectory, parsed.archivePath);

        // Pre-flight: surface a clear message before tar parsing kicks in.
        try {
          await deps.fs.stat(archiveAbs);
        } catch {
          return {
            output: `archive not found at ${archiveAbs}`,
            success: false,
          };
        }

        const destDir = join(ctx.workingDirectory, `.${APP_NAME}`, "skills");

        const result = await deps.install({
          archivePath: archiveAbs,
          destDir,
          trustLevel: parsed.trustLevel,
          force: parsed.force,
          verify: true,
        });

        const lines: string[] = [];
        lines.push(`installed skill: ${result.skillDir}`);
        lines.push(`trust level: ${parsed.trustLevel}`);
        lines.push(`files extracted: ${String(result.filesExtracted.length)}`);
        lines.push(`integrity: ${result.verified ? "verified (sha256 match)" : "skipped"}`);
        lines.push("");
        lines.push(`next: /skill-eval ${String(result.manifest.name)}`);

        return { output: lines.join("\n"), success: true };
      } catch (err) {
        if (err instanceof InstallError) {
          const prefix = SECURITY_CODES.has(err.code) ? "[SECURITY] " : "";
          return {
            output: `${prefix}${err.code}: ${err.message}`,
            success: false,
          };
        }
        const msg = err instanceof Error ? err.message : String(err);
        return { output: `/skill-install failed: ${msg}`, success: false };
      }
    },
  };
}

/** Production instance for builtin registration. */
export const skillInstallCommand: SlashCommand = createSkillInstallCommand();
