/**
 * 프로젝트 언어 감지 + LSP 서버 설치 확인
 * 프로젝트 루트의 설정 파일을 기반으로 언어를 감지하고,
 * 해당 LSP 서버가 시스템에 설치되어 있는지 확인합니다.
 */

import { access } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { type LSPLanguageId, type LSPServerConfig } from "./types.js";

const execFileAsync = promisify(execFile);

/** 프로젝트 파일 → 언어 매핑 */
const PROJECT_INDICATORS: Record<string, LSPLanguageId> = {
  "tsconfig.json": "typescript",
  "jsconfig.json": "typescript",
  "package.json": "typescript", // JS도 TS 서버가 처리
  "pyproject.toml": "python",
  "setup.py": "python",
  "requirements.txt": "python",
  "Pipfile": "python",
  "go.mod": "go",
  "Cargo.toml": "rust",
  "pom.xml": "java",
  "build.gradle": "java",
  "build.gradle.kts": "java",
};

/** 언어별 LSP 서버 설정 */
const SERVER_CONFIGS: Record<LSPLanguageId, LSPServerConfig> = {
  typescript: {
    language: "typescript",
    command: "typescript-language-server",
    args: ["--stdio"],
  },
  python: {
    language: "python",
    command: "pyright-langserver",
    args: ["--stdio"],
  },
  go: {
    language: "go",
    command: "gopls",
    args: ["serve"],
  },
  rust: {
    language: "rust",
    command: "rust-analyzer",
    args: [],
  },
  java: {
    language: "java",
    command: "jdtls",
    args: [],
  },
};

/** 파일이 존재하는지 비동기로 확인 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** 프로젝트에서 사용 중인 언어 감지 */
export async function detectProjectLanguages(
  projectDir: string,
): Promise<readonly LSPLanguageId[]> {
  const detected = new Set<LSPLanguageId>();

  const checks = Object.entries(PROJECT_INDICATORS).map(
    async ([fileName, language]) => {
      const exists = await fileExists(join(projectDir, fileName));
      if (exists) {
        detected.add(language);
      }
    },
  );

  await Promise.all(checks);

  return [...detected];
}

/** 시스템에 LSP 서버가 설치되어 있는지 확인 */
export async function isServerInstalled(
  language: LSPLanguageId,
): Promise<boolean> {
  const config = SERVER_CONFIGS[language];
  try {
    await execFileAsync("which", [config.command]);
    return true;
  } catch {
    return false;
  }
}

/** LSP 서버 설정 가져오기 */
export function getServerConfig(language: LSPLanguageId): LSPServerConfig {
  return SERVER_CONFIGS[language];
}

/** 사용 가능한 LSP 서버 목록 (감지 + 설치 확인) */
export async function detectAvailableServers(
  projectDir: string,
): Promise<readonly LSPLanguageId[]> {
  const languages = await detectProjectLanguages(projectDir);

  const results = await Promise.all(
    languages.map(async (language) => {
      const installed = await isServerInstalled(language);
      return installed ? language : undefined;
    }),
  );

  return results.filter(
    (lang): lang is LSPLanguageId => lang !== undefined,
  );
}
