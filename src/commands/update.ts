/**
 * /update 명령어 핸들러 — dbcode를 최신 버전으로 업데이트
 *
 * 사용자가 /update를 입력하면:
 *   1. npm 레지스트리에서 최신 버전 확인
 *   2. 현재 버전과 비교
 *   3. 차이가 있으면 npm install -g로 자동 업데이트
 *
 * 에어갭(air-gapped, 인터넷 차단) 환경에서는 수동 업데이트 방법을 안내합니다.
 *
 * 사용 시점: 새 기능이나 버그 수정이 릴리스되었을 때
 */
import { type SlashCommand } from "./registry.js";
import { APP_NAME, VERSION } from "../constants.js";

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

/**
 * 셸 명령어를 실행하고 stdout을 반환하는 헬퍼 함수
 *
 * 30초 타임아웃이 설정되어 있어 네트워크 지연 시 자동 중단됩니다.
 * child_process.exec를 promisify하여 async/await로 사용합니다.
 *
 * @param command - 실행할 셸 명령어
 * @returns stdout 출력 문자열
 */
async function runCommand(command: string): Promise<string> {
  const { exec } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execAsync = promisify(exec);

  const { stdout } = await execAsync(command, { timeout: 30_000 });
  return stdout;
}
