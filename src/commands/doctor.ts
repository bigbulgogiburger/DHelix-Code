/**
 * /doctor 명령어 핸들러 — 시스템 진단 및 환경 점검
 *
 * 사용자가 /doctor를 입력하면 dbcode 실행 환경의 12가지 항목을 자동 점검합니다:
 *   1. Node.js 버전 (20+ 필요)
 *   2. Git 설치 여부
 *   3. Git 저장소 여부
 *   4. 모델 설정 상태
 *   5. API 키 설정 여부
 *   6. 디스크 여유 공간
 *   7. 설정 디렉토리(~/.dbcode) 접근 권한
 *   8. 구문 하이라이터(Shiki) 가용성
 *   9. LLM API 연결 상태
 *  10. 메모리 사용량
 *  11. 토큰 캐시 상태
 *  12. 세션 잠금(lock) 상태
 *
 * 각 항목은 ok(정상)/warn(경고)/fail(실패)로 표시되며,
 * 문제가 있는 항목에는 해결 방법(Fix)을 안내합니다.
 *
 * 사용 시점: dbcode가 제대로 동작하지 않을 때 원인을 진단하고 싶을 때
 */
import { execSync } from "node:child_process";
import { existsSync, accessSync, constants, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { type SlashCommand } from "./registry.js";
import { getTokenCacheStats } from "../llm/token-counter.js";

/**
 * 진단 점검 결과를 담는 인터페이스
 *
 * @property name - 점검 항목 이름 (예: "Node.js", "Git")
 * @property status - 점검 결과 ("ok"=정상, "warn"=경고, "fail"=실패)
 * @property detail - 상세 설명 (예: "v20.11.0 (>=20 required)")
 * @property fix - 문제 해결 방법 (선택적, 문제가 있을 때만 표시)
 */
interface DiagnosticCheck {
  readonly name: string;
  readonly status: "ok" | "warn" | "fail";
  readonly detail: string;
  readonly fix?: string;
}

/**
 * 바이트 수를 사람이 읽기 쉬운 형식으로 변환하는 함수
 *
 * @param bytes - 바이트 수
 * @returns 포맷된 문자열 (예: "512 B", "1.5 KB", "256.3 MB")
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * /doctor 슬래시 명령어 정의 — 설치, 설정, 연결 상태 진단
 *
 * 12가지 점검 항목을 순차적으로 실행하고 결과를 표시합니다.
 * 모든 점검이 "fail"이 아니면 success: true를 반환합니다.
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

    // 9. LLM connectivity test
    try {
      const apiKey =
        process.env["OPENAI_API_KEY"] ||
        process.env["DBCODE_API_KEY"] ||
        process.env["ANTHROPIC_API_KEY"];
      const baseUrl = process.env["OPENAI_BASE_URL"] || "https://api.openai.com/v1";

      if (apiKey) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5_000);
        const response = await fetch(`${baseUrl}/models`, {
          method: "GET",
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (response.ok) {
          checks.push({
            name: "LLM connectivity",
            status: "ok",
            detail: `${baseUrl} reachable`,
          });
        } else {
          checks.push({
            name: "LLM connectivity",
            status: "warn",
            detail: `${baseUrl} responded with ${response.status}`,
            fix: "Check your API key and endpoint configuration",
          });
        }
      } else {
        checks.push({
          name: "LLM connectivity",
          status: "warn",
          detail: "Skipped (no API key)",
          fix: "Set an API key to enable connectivity check",
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isAbort = message.includes("abort");
      checks.push({
        name: "LLM connectivity",
        status: "warn",
        detail: isAbort ? "Connection timed out (5s)" : `Connection failed: ${message}`,
        fix: "Check your network connection and API endpoint",
      });
    }

    // 10. Memory usage
    try {
      const mem = process.memoryUsage();
      const rss = mem.rss;
      const heapUsed = mem.heapUsed;
      const heapTotal = mem.heapTotal;
      const heapPct = heapTotal > 0 ? (heapUsed / heapTotal) * 100 : 0;

      // Warn if RSS > 512MB or heap usage > 90%
      const isHighMemory = rss > 512 * 1024 * 1024 || heapPct > 90;
      checks.push({
        name: "Memory usage",
        status: isHighMemory ? "warn" : "ok",
        detail: `RSS: ${formatBytes(rss)}, Heap: ${formatBytes(heapUsed)}/${formatBytes(heapTotal)} (${heapPct.toFixed(0)}%)`,
        fix: isHighMemory ? "Consider restarting dbcode to free memory" : undefined,
      });
    } catch {
      checks.push({
        name: "Memory usage",
        status: "warn",
        detail: "Could not read memory usage",
      });
    }

    // 11. Token cache status
    try {
      const cacheStats = getTokenCacheStats();
      const hitRate =
        cacheStats.hits + cacheStats.misses > 0
          ? ((cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100).toFixed(1)
          : "0.0";
      checks.push({
        name: "Token cache",
        status: "ok",
        detail: `${cacheStats.size} entries, ${hitRate}% hit rate (${cacheStats.hits} hits, ${cacheStats.misses} misses)`,
      });
    } catch {
      checks.push({
        name: "Token cache",
        status: "warn",
        detail: "Could not read token cache stats",
      });
    }

    // 12. Session lock freshness
    if (context.sessionId) {
      try {
        const sessionsDir = join(homedir(), ".dbcode", "sessions");
        const lockDir = join(sessionsDir, context.sessionId, ".lock");
        if (existsSync(lockDir)) {
          const lockStat = statSync(lockDir);
          const ageMs = Date.now() - lockStat.mtimeMs;
          const ageMinutes = Math.floor(ageMs / 60000);

          // Lock older than 30 minutes might be stale
          const isStale = ageMinutes > 30;
          checks.push({
            name: "Session lock",
            status: isStale ? "warn" : "ok",
            detail: isStale
              ? `Lock is ${ageMinutes}m old (may be stale)`
              : `Active (${ageMinutes < 1 ? "< 1" : ageMinutes}m old)`,
            fix: isStale ? "Restart dbcode if session feels stuck" : undefined,
          });
        } else {
          checks.push({
            name: "Session lock",
            status: "ok",
            detail: "No lock file (session not locked)",
          });
        }
      } catch {
        checks.push({
          name: "Session lock",
          status: "warn",
          detail: "Could not check session lock",
        });
      }
    } else {
      checks.push({
        name: "Session lock",
        status: "ok",
        detail: "No active session",
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
