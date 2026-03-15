/**
 * /fast 명령어 핸들러 — 빠른 출력 모드 토글
 *
 * 사용자가 /fast를 입력할 때마다 빠른 모드를 켜고 끕니다 (토글).
 *
 * 빠른 모드란? 더 작고 빠른 모델을 사용하거나 응답 품질을
 * 약간 낮추는 대신 더 빠른 응답을 제공하는 모드입니다.
 *
 * 사용 시점: 간단한 질문이나 빠른 확인이 필요할 때,
 * 비용을 절약하고 싶을 때
 */
import { type SlashCommand, type CommandResult, type CommandContext } from "./registry.js";

/** 빠른 모드 상태 (모듈 레벨 변수 — 세션 동안 유지) */
let fastModeEnabled = false;

/**
 * 현재 빠른 모드 활성화 상태를 반환하는 getter 함수
 *
 * @returns true면 빠른 모드 활성화, false면 일반 모드
 */
export function isFastMode(): boolean {
  return fastModeEnabled;
}

/**
 * /fast 슬래시 명령어 정의 — 빠른 출력 모드 토글
 *
 * 호출할 때마다 fastModeEnabled를 반전시켜 ON/OFF를 전환합니다.
 * 더 빠르고 작은 모델 변형을 사용하거나 응답 품질을 줄여
 * 빠른 응답을 제공합니다.
 */
export const fastCommand: SlashCommand = {
  name: "fast",
  description: "Toggle fast output mode",
  usage: "/fast",

  async execute(_args: string, _context: CommandContext): Promise<CommandResult> {
    fastModeEnabled = !fastModeEnabled;

    return {
      output: `Fast mode: ${fastModeEnabled ? "ON" : "OFF"}`,
      success: true,
    };
  },
};
