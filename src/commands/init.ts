/**
 * /init 명령어 핸들러 — 프로젝트 초기화 및 DHELIX.md 생성
 *
 * 모듈 구조:
 *   - config-setup.ts: .dhelix/ 디렉토리 및 .gitignore 관리
 *   - analysis-prompt.ts: LLM 분석 프롬프트 (12단계)
 *   - template-generator.ts: 정적 템플릿 생성 (15+ 감지)
 *   - interactive-flow.ts: 인터랙티브 모드 (4단계 플로우)
 *
 * 두 가지 실행 모드:
 *   - CLI 모드 (dhelix init): LLM 없이 정적 템플릿 생성
 *   - 세션 내 모드 (/init): LLM이 코드베이스를 분석하여 풍부한 내용 생성
 *   - 세션 내 인터랙티브 모드 (/init -i): 사용자와 대화하며 생성
 */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { PROJECT_CONFIG_FILE, PROJECT_CONFIG_DIR } from "../constants.js";
import { type SlashCommand } from "./registry.js";
import { fileExists, ensureConfigDir, ensureGitignoreEntry } from "./init/config-setup.js";
import { buildAnalysisPrompt } from "./init/analysis-prompt.js";
import { generateTemplate } from "./init/template-generator.js";
import { buildInteractivePrompt, parseInteractiveArgs } from "./init/interactive-flow.js";

/** 프로젝트 초기화 결과 */
export interface InitResult {
  readonly created: boolean;
  readonly path: string;
  readonly detail?: {
    readonly dhelixMdCreated: boolean;
    readonly configDirCreated: boolean;
  };
}

/**
 * CLI 폴백용 프로젝트 초기화 함수
 *
 * 프로젝트 루트에 DHELIX.md와 .dhelix/ 디렉토리를 생성합니다.
 * CLI에서 `dhelix init` 명령으로 호출됩니다 (에이전트 루프 외부).
 * 세션 내 LLM 기반 초기화는 /init 슬래시 명령어를 사용하세요.
 *
 * 두 산출물(DHELIX.md와 .dhelix/)은 독립적입니다:
 * - git clone으로 .dhelix/만 있고 DHELIX.md가 없을 수 있음
 * - DHELIX.md만 있고 .dhelix/가 없을 수도 있음
 * 각각 없는 경우에만 생성하고, 이미 있으면 건드리지 않습니다.
 *
 * @param cwd - 프로젝트 루트 디렉토리
 * @returns 초기화 결과 (생성 여부, 경로, 세부 정보)
 */
export async function initProject(cwd: string): Promise<InitResult> {
  const projectPath = join(cwd, PROJECT_CONFIG_DIR);
  const rootDhelixMd = join(cwd, PROJECT_CONFIG_FILE);

  const configDirExists = await fileExists(projectPath);
  const dhelixMdExists = await fileExists(rootDhelixMd);

  // 둘 다 이미 존재하면 아무 작업도 수행하지 않음
  if (configDirExists && dhelixMdExists) {
    return { created: false, path: projectPath };
  }

  const detail = {
    dhelixMdCreated: !dhelixMdExists,
    configDirCreated: !configDirExists,
  };

  // .dhelix/ 디렉토리가 없으면 생성
  if (!configDirExists) {
    await ensureConfigDir(cwd);
  }

  // DHELIX.md가 없으면 정적 템플릿으로 생성
  if (!dhelixMdExists) {
    const template = await generateTemplate(cwd);
    await writeFile(rootDhelixMd, template, "utf-8");
  }

  // DHELIX.local.md를 .gitignore에 추가
  await ensureGitignoreEntry(cwd);

  return { created: true, path: projectPath, detail };
}

/**
 * /init 슬래시 명령어 정의
 *
 * 일반 모드: LLM이 12단계 분석으로 DHELIX.md 자동 생성
 * 인터랙티브 모드 (/init -i): 사용자와 4단계 대화를 통해 생성
 *
 * shouldInjectAsUserMessage: true → 프롬프트가 사용자 메시지로 주입됨
 * refreshInstructions: true → 생성 후 프로젝트 설정을 다시 로드
 */
export const initCommand: SlashCommand = {
  name: "init",
  description: "Initialize project — auto mode or interactive (-i) with 12-step analysis",
  usage: "/init [-i | --interactive]",
  execute: async (args, context) => {
    const cwd = context.workingDirectory;
    const { interactive } = parseInteractiveArgs(args);

    // Phase 1: .dhelix/ 디렉토리 구조 생성
    const configDirCreated = await ensureConfigDir(cwd);
    await ensureGitignoreEntry(cwd);

    // Phase 2: DHELIX.md 존재 여부 확인
    const dhelixMdExists = await fileExists(join(cwd, PROJECT_CONFIG_FILE));

    // Phase 3: 모드에 따라 적절한 프롬프트 구성
    const prompt = interactive
      ? buildInteractivePrompt(configDirCreated, dhelixMdExists)
      : buildAnalysisPrompt(dhelixMdExists, configDirCreated);

    return {
      output: prompt,
      success: true,
      shouldInjectAsUserMessage: true,
      refreshInstructions: true,
    };
  },
};
