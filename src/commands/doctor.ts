import { execSync } from "node:child_process";
import { existsSync, accessSync, constants } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { type SlashCommand } from "./registry.js";

interface DiagnosticCheck {
  readonly name: string;
  readonly status: "ok" | "warn" | "fail";
  readonly detail: string;
  readonly fix?: string;
}

/**
 * /doctor — Diagnostic checks for installation, config, and connectivity.
 * Runs 8 checks: Node.js, Git, Git repo, Model, API key, Disk space, Config dir, Syntax highlighter.
 */
export const doctorCommand: SlashCommand = {
  name: "doctor",
  description: "Run diagnostic checks",
  usage: "/doctor",
  execute: async (_args, context) => {
    const checks: DiagnosticCheck[] = [];

    // 1. Check Node.js version
    const nodeVersion = process.version;
    const major = parseInt(nodeVersion.slice(1).split(".")[0], 10);
    checks.push({
      name: "Node.js",
      status: major >= 20 ? "ok" : "fail",
      detail: `${nodeVersion} ${major >= 20 ? "(>=20 required)" : "(UPGRADE NEEDED: >=20)"}`,
      fix: major < 20 ? "Install Node.js 20+ from https://nodejs.org" : undefined,
    });

    // 2. Check git availability
    try {
      const gitVersionOutput = execSync("git --version", { encoding: "utf-8" }).trim();
      const versionMatch = gitVersionOutput.match(/[\d.]+/);
      const gitVer = versionMatch ? versionMatch[0] : gitVersionOutput;
      checks.push({ name: "Git", status: "ok", detail: gitVer });
    } catch {
      checks.push({
        name: "Git",
        status: "fail",
        detail: "Not found in PATH",
        fix: "Install Git from https://git-scm.com",
      });
    }

    // 3. Check working directory is a git repo
    try {
      execSync("git rev-parse --is-inside-work-tree", {
        encoding: "utf-8",
        cwd: context.workingDirectory,
      });
      checks.push({ name: "Git repo", status: "ok", detail: context.workingDirectory });
    } catch {
      checks.push({
        name: "Git repo",
        status: "warn",
        detail: "Not a git repository",
        fix: "Run `git init` to initialize a repository",
      });
    }

    // 4. Check model configuration
    checks.push({
      name: "Model",
      status: context.model ? "ok" : "fail",
      detail: context.model || "No model configured",
      fix: context.model ? undefined : "Set a model in your config or pass --model flag",
    });

    // 5. Check API key validation
    const hasApiKey = Boolean(
      process.env["OPENAI_API_KEY"] ||
        process.env["DBCODE_API_KEY"] ||
        process.env["ANTHROPIC_API_KEY"],
    );
    checks.push({
      name: "API key",
      status: hasApiKey ? "ok" : "warn",
      detail: hasApiKey ? "configured" : "No API key found",
      fix: hasApiKey
        ? undefined
        : "Set OPENAI_API_KEY, DBCODE_API_KEY, or ANTHROPIC_API_KEY environment variable",
    });

    // 6. Check disk space
    try {
      const dfOutput = execSync("df -h .", {
        encoding: "utf-8",
        cwd: context.workingDirectory,
      }).trim();
      const lines = dfOutput.split("\n");
      if (lines.length >= 2) {
        // df -h output: Filesystem Size Used Avail Use% Mounted
        const parts = lines[1].split(/\s+/);
        const available = parts[3] || "unknown";
        checks.push({
          name: "Disk space",
          status: "ok",
          detail: `${available} free`,
        });
      } else {
        checks.push({
          name: "Disk space",
          status: "warn",
          detail: "Could not parse disk space",
          fix: "Check disk usage manually with `df -h .`",
        });
      }
    } catch {
      checks.push({
        name: "Disk space",
        status: "warn",
        detail: "Could not check disk space",
        fix: "Check disk usage manually with `df -h .`",
      });
    }

    // 7. Check config directory
    const configDir = join(homedir(), ".dbcode");
    try {
      if (existsSync(configDir)) {
        accessSync(configDir, constants.R_OK | constants.W_OK);
        checks.push({
          name: "Config directory",
          status: "ok",
          detail: `~/.dbcode (writable)`,
        });
      } else {
        checks.push({
          name: "Config directory",
          status: "warn",
          detail: "~/.dbcode does not exist",
          fix: "Run dbcode once to create the config directory",
        });
      }
    } catch {
      checks.push({
        name: "Config directory",
        status: "fail",
        detail: "~/.dbcode is not writable",
        fix: "Fix permissions: chmod u+rw ~/.dbcode",
      });
    }

    // 8. Check syntax highlighter (Shiki)
    try {
      await import("shiki");
      checks.push({
        name: "Syntax highlighter",
        status: "ok",
        detail: "Shiki available",
      });
    } catch {
      checks.push({
        name: "Syntax highlighter",
        status: "warn",
        detail: "not initialized",
        fix: "Run dbcode once to initialize Shiki",
      });
    }

    // Format output
    const statusSymbol: Record<DiagnosticCheck["status"], string> = {
      ok: "\u2713",
      warn: "\u26A0",
      fail: "\u2717",
    };

    const outputLines: string[] = ["dbcode Doctor", "=============", ""];

    for (const check of checks) {
      outputLines.push(`  ${statusSymbol[check.status]} ${check.name}: ${check.detail}`);
      if (check.fix) {
        outputLines.push(`    Fix: ${check.fix}`);
      }
    }

    const passed = checks.filter((c) => c.status === "ok").length;
    const warnings = checks.filter((c) => c.status === "warn").length;
    const failures = checks.filter((c) => c.status === "fail").length;

    outputLines.push("");

    const parts: string[] = [`${passed}/${checks.length} checks passed`];
    if (warnings > 0) parts.push(`${warnings} warning${warnings > 1 ? "s" : ""}`);
    if (failures > 0) parts.push(`${failures} failure${failures > 1 ? "s" : ""}`);

    outputLines.push(parts.join(", "));

    return {
      output: outputLines.join("\n"),
      success: checks.every((c) => c.status !== "fail"),
    };
  },
};
