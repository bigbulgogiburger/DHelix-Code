import { execSync } from "node:child_process";
import { type SlashCommand } from "./registry.js";

/**
 * /doctor — Diagnostic checks for installation, config, and connectivity.
 */
export const doctorCommand: SlashCommand = {
  name: "doctor",
  description: "Run diagnostic checks",
  usage: "/doctor",
  execute: async (_args, context) => {
    const checks: Array<{ name: string; status: "ok" | "warn" | "fail"; detail: string }> = [];

    // Check Node.js version
    const nodeVersion = process.version;
    const major = parseInt(nodeVersion.slice(1).split(".")[0], 10);
    checks.push({
      name: "Node.js",
      status: major >= 20 ? "ok" : "fail",
      detail: `${nodeVersion} ${major >= 20 ? "(>=20 required)" : "(UPGRADE NEEDED: >=20)"}`,
    });

    // Check git availability
    try {
      const gitVersion = execSync("git --version", { encoding: "utf-8" }).trim();
      checks.push({ name: "Git", status: "ok", detail: gitVersion });
    } catch {
      checks.push({ name: "Git", status: "fail", detail: "Not found in PATH" });
    }

    // Check working directory is a git repo
    try {
      execSync("git rev-parse --is-inside-work-tree", {
        encoding: "utf-8",
        cwd: context.workingDirectory,
      });
      checks.push({ name: "Git repo", status: "ok", detail: context.workingDirectory });
    } catch {
      checks.push({ name: "Git repo", status: "warn", detail: "Not a git repository" });
    }

    // Check model configuration
    checks.push({
      name: "Model",
      status: context.model ? "ok" : "fail",
      detail: context.model || "No model configured",
    });

    // Format output
    const statusSymbol = { ok: "[OK]", warn: "[!!]", fail: "[FAIL]" };
    const lines = [
      "dbcode Doctor",
      "=============",
      "",
      ...checks.map((c) => `  ${statusSymbol[c.status]} ${c.name}: ${c.detail}`),
      "",
      `${checks.filter((c) => c.status === "fail").length === 0 ? "All checks passed." : "Some checks failed. See above."}`,
    ];

    return {
      output: lines.join("\n"),
      success: checks.every((c) => c.status !== "fail"),
    };
  },
};
