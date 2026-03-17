/**
 * 에이전트 스킬 로더 — 서브에이전트의 시스템 프롬프트에 스킬 내용을 주입하는 모듈
 *
 * 스킬(Skill)이란 에이전트에게 특정 분야의 전문 지식을 제공하는 마크다운 파일입니다.
 * 예를 들어 "python-testing" 스킬은 pytest 패턴과 모범 사례에 대한 지침을 담고 있습니다.
 *
 * 에이전트 정의 파일의 프론트매터에 `skills: [python-testing, security]`와 같이
 * 스킬 이름을 지정하면, 이 모듈이 해당 스킬 파일을 찾아서 내용을 로드하고,
 * 시스템 프롬프트에 삽입할 수 있는 형태로 가공합니다.
 *
 * 스킬 검색 경로 (우선순위 순):
 * 1. {프로젝트}/.dbcode/commands/ — 프로젝트 명령 (최우선)
 * 2. {프로젝트}/.dbcode/skills/  — 프로젝트 스킬
 * 3. ~/.dbcode/commands/          — 사용자 전역 명령
 * 4. ~/.dbcode/skills/            — 사용자 전역 스킬 (최하위)
 */
import { join } from "node:path";
import { homedir } from "node:os";
import { APP_NAME } from "../constants.js";
import { loadSkill } from "../skills/loader.js";

/**
 * 에이전트에 주입하기 위해 로드된 스킬 정보
 *
 * name: 스킬의 표시 이름 (프론트매터에서 가져옴)
 * content: 스킬 본문 내용 (마크다운 텍스트)
 */
export interface LoadedSkill {
  readonly name: string;
  readonly content: string;
}

/**
 * 스킬을 검색할 디렉토리 목록을 우선순위 순으로 반환합니다.
 *
 * 프로젝트 수준 디렉토리가 먼저 검색되므로,
 * 같은 이름의 스킬이 있을 경우 프로젝트 스킬이 전역 스킬보다 우선합니다.
 *
 * @param workingDirectory - 현재 프로젝트의 작업 디렉토리
 * @returns 스킬 디렉토리 경로 배열 (우선순위 높은 순)
 */
function getSkillDirectories(workingDirectory: string): readonly string[] {
  return [
    join(workingDirectory, `.${APP_NAME}`, "commands"), // 프로젝트 명령 (최우선)
    join(workingDirectory, `.${APP_NAME}`, "skills"), // 프로젝트 스킬
    join(homedir(), `.${APP_NAME}`, "commands"), // 사용자 전역 명령
    join(homedir(), `.${APP_NAME}`, "skills"), // 사용자 전역 스킬
  ];
}

/**
 * 이름으로 스킬을 검색하여 로드합니다.
 *
 * 여러 디렉토리를 순서대로 탐색하며, 첫 번째로 발견된 스킬을 반환합니다.
 * 프로젝트 수준 스킬이 전역 스킬보다 우선합니다.
 *
 * @param name - 스킬 이름 (확장자 제외, 예: "python-testing")
 * @param directories - 검색할 디렉토리 목록
 * @returns 로드된 스킬 정보, 또는 어디에서도 찾지 못한 경우 undefined
 */
async function findAndLoadSkill(
  name: string,
  directories: readonly string[],
): Promise<LoadedSkill | undefined> {
  for (const dir of directories) {
    try {
      // {디렉토리}/{스킬이름}.md 파일을 시도
      const skill = await loadSkill(join(dir, `${name}.md`));
      return {
        name: skill.frontmatter.name,
        content: skill.body,
      };
    } catch {
      // 이 디렉토리에 스킬이 없음 — 다음 디렉토리에서 검색 계속
    }
  }
  return undefined;
}

/**
 * 여러 스킬을 이름으로 로드하여 시스템 프롬프트에 주입할 수 있는 형태로 반환합니다.
 *
 * 4개의 스킬 디렉토리를 순서대로 검색합니다:
 * - .dbcode/commands/ (프로젝트)
 * - .dbcode/skills/ (프로젝트)
 * - ~/.dbcode/commands/ (사용자 전역)
 * - ~/.dbcode/skills/ (사용자 전역)
 *
 * 어떤 디렉토리에서도 찾지 못한 스킬은 조용히 건너뜁니다 (에러 발생 안 함).
 *
 * @param skillNames - 로드할 스킬 이름 배열 (예: ["python-testing", "security"])
 * @param workingDirectory - 프로젝트 작업 디렉토리
 * @returns 성공적으로 로드된 스킬 배열
 */
export async function loadSkillsForAgent(
  skillNames: readonly string[],
  workingDirectory: string,
): Promise<readonly LoadedSkill[]> {
  // 빈 배열이면 즉시 반환 (불필요한 디렉토리 탐색 방지)
  if (skillNames.length === 0) {
    return [];
  }

  const directories = getSkillDirectories(workingDirectory);
  const results: LoadedSkill[] = [];

  // 각 스킬 이름에 대해 순차적으로 로드 시도
  for (const name of skillNames) {
    const loaded = await findAndLoadSkill(name, directories);
    if (loaded) {
      results.push(loaded);
    }
  }

  return results;
}

/**
 * 로드된 스킬 목록을 시스템 프롬프트에 삽입할 수 있는 마크다운 텍스트로 변환합니다.
 *
 * 각 스킬은 "## {스킬이름}" 헤더 아래에 내용이 배치됩니다.
 * 스킬이 없으면 빈 문자열을 반환합니다.
 *
 * @param skills - 로드된 스킬 배열
 * @returns 시스템 프롬프트에 삽입할 마크다운 텍스트 (스킬이 없으면 빈 문자열)
 */
export function buildSkillPromptSection(skills: readonly LoadedSkill[]): string {
  if (skills.length === 0) {
    return "";
  }

  const lines = ["# Preloaded Skills", ""];

  for (const skill of skills) {
    lines.push(`## ${skill.name}`, "");
    lines.push(skill.content);
    lines.push("");
  }

  return lines.join("\n");
}
