/**
 * 스킬-커맨드 브릿지 — 스킬을 슬래시 명령어(/command)로 변환하는 모듈
 *
 * 사용자가 호출 가능한(userInvocable: true) 스킬을 자동으로
 * /명령어 형태의 SlashCommand로 변환합니다.
 *
 * 예시: name: "commit"인 스킬 → /commit 명령어로 등록
 *
 * 실행 흐름:
 * 1. 사용자가 /commit "fix auth" 입력
 * 2. SkillManager가 "commit" 스킬을 찾아 실행
 * 3. 변수 치환 + 동적 컨텍스트 주입 → 최종 프롬프트 생성
 * 4. inline 스킬: 프롬프트를 사용자 메시지로 주입 → LLM이 처리
 *    fork 스킬: 서브에이전트를 생성하여 별도 컨텍스트에서 실행
 */

import { type SlashCommand, type CommandResult } from "../commands/registry.js";
import { type SkillManager } from "./manager.js";

/**
 * 사용자 호출 가능한 스킬들을 슬래시 명령어로 변환하는 팩토리 함수
 *
 * SkillManager에서 userInvocable=true인 스킬을 가져와
 * 각각을 SlashCommand 인터페이스에 맞게 래핑합니다.
 *
 * @param skillManager - 로드된 스킬들을 관리하는 매니저 인스턴스
 * @returns 슬래시 명령어 배열 (CommandRegistry에 등록됨)
 */
export function createSkillCommands(skillManager: SkillManager): readonly SlashCommand[] {
  // 사용자가 직접 호출 가능한 스킬만 필터링
  const invocable = skillManager.getUserInvocable();
  const commands: SlashCommand[] = [];

  for (const skill of invocable) {
    const { name, description, argumentHint } = skill.frontmatter;

    commands.push({
      name,
      description: `[skill] ${description}`, // [skill] 접두사로 스킬 기반 명령어임을 표시
      usage: `/${name}${argumentHint ? ` ${argumentHint}` : ""}`,

      /**
       * 스킬 실행 핸들러 — /명령어 입력 시 호출됨
       *
       * @param args - 명령어 뒤에 전달된 인자 문자열
       * @param commandContext - 명령 실행 컨텍스트 (세션 ID, 작업 디렉토리 등)
       * @returns 실행 결과 (output, success, 주입 옵션 등)
       */
      async execute(args: string, commandContext): Promise<CommandResult> {
        const result = await skillManager.execute(name, args, {
          sessionId: commandContext.sessionId,
          workingDirectory: commandContext.workingDirectory,
        });

        // 스킬을 찾을 수 없거나 실행 실패
        if (!result) {
          return {
            output: `Skill '${name}' failed to execute.`,
            success: false,
          };
        }

        // fork 스킬: 서브에이전트로 분리 실행
        if (result.fork) {
          // "skill:fork" 이벤트를 발행하여 에이전트 루프가 서브에이전트를 생성하도록 함
          commandContext.emit("skill:fork", {
            prompt: result.prompt,
            model: result.model,
            agentType: result.agentType,
            allowedTools: result.allowedTools,
          });
          return {
            output: `Skill '${name}' launched as ${result.agentType ?? "general"} subagent.`,
            success: true,
          };
        }

        // inline 스킬: 프롬프트를 사용자 메시지로 주입
        // shouldInjectAsUserMessage=true이면, 에이전트 루프의 handleSubmit이
        // 이 출력을 화면에 표시하지 않고 LLM에 사용자 메시지로 전달합니다.
        return {
          output: result.prompt,
          success: true,
          shouldInjectAsUserMessage: true,
          modelOverride: result.model,
        };
      },
    });
  }

  return commands;
}
