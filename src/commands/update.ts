import { type SlashCommand } from "./registry.js";
import { APP_NAME, VERSION } from "../constants.js";

/**
 * /update — Self-update dbcode to the latest version.
 * Uses npm to check for and install the latest version.
 */
export const updateCommand: SlashCommand = {
  name: "update",
  description: "Update dbcode to the latest version",
  usage: "/update",
  execute: async () => {
    const lines: string[] = [];
    lines.push(`Current version: ${VERSION}`);
    lines.push("");

    try {
      // Check latest version from npm registry
      const checkResult = await runCommand(`npm view ${APP_NAME} version 2>&1`);
      const latestVersion = checkResult.trim();

      if (!latestVersion || latestVersion.includes("ERR")) {
        lines.push("Could not check latest version from npm registry.");
        lines.push("You may be in an air-gapped environment.");
        lines.push("");
        lines.push("Manual update:");
        lines.push(`  npm install -g ${APP_NAME}@latest`);
        return { output: lines.join("\n"), success: false };
      }

      if (latestVersion === VERSION) {
        lines.push(`Already running the latest version (${VERSION}).`);
        return { output: lines.join("\n"), success: true };
      }

      lines.push(`Latest version: ${latestVersion}`);
      lines.push("");
      lines.push(`Updating ${APP_NAME}...`);

      // Perform update
      const updateResult = await runCommand(`npm install -g ${APP_NAME}@${latestVersion} 2>&1`);

      if (updateResult.includes("ERR")) {
        lines.push("Update failed:");
        lines.push(updateResult);
        lines.push("");
        lines.push("Try manually:");
        lines.push(`  npm install -g ${APP_NAME}@latest`);
        return { output: lines.join("\n"), success: false };
      }

      lines.push(`Updated to ${latestVersion} successfully.`);
      lines.push("Restart dbcode to use the new version.");
    } catch (error) {
      lines.push(`Update check failed: ${error instanceof Error ? error.message : String(error)}`);
      lines.push("");
      lines.push("Manual update:");
      lines.push(`  npm install -g ${APP_NAME}@latest`);
      return { output: lines.join("\n"), success: false };
    }

    return { output: lines.join("\n"), success: true };
  },
};

/** Run a shell command and return stdout */
async function runCommand(command: string): Promise<string> {
  const { exec } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execAsync = promisify(exec);

  const { stdout } = await execAsync(command, { timeout: 30_000 });
  return stdout;
}
