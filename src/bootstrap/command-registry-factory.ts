/**
 * CommandRegistry 팩토리 — 빌트인 명령 + 스킬 기반 명령을 자동 등록
 *
 * @module bootstrap/command-registry-factory
 */

import { type SkillManager } from "../skills/manager.js";

export interface CommandRegistryFactoryOptions {
  readonly skillManager: SkillManager;
}

/**
 * CommandRegistry를 생성하고 모든 빌트인 + 스킬 명령을 등록합니다.
 *
 * - builtinCommands 배럴에서 전체 슬래시 명령을 일괄 등록
 * - SkillManager에서 스킬을 /명령어로 변환하여 추가 등록
 * - /help 명령에서 전체 목록을 볼 수 있도록 setHelpCommands 호출
 */
export async function createCommandRegistry(
  opts: CommandRegistryFactoryOptions,
): Promise<import("../commands/registry.js").CommandRegistry> {
  const [{ CommandRegistry }, { builtinCommands, setHelpCommands }, { createSkillCommands }] =
    await Promise.all([
      import("../commands/registry.js"),
      import("../commands/builtin-commands.js"),
      import("../skills/command-bridge.js"),
    ]);

  const commandRegistry = new CommandRegistry();

  const commands: import("../commands/registry.js").SlashCommand[] = [...builtinCommands];
  const skillCommands = createSkillCommands(opts.skillManager);
  commands.push(...skillCommands);

  for (const cmd of commands) {
    commandRegistry.register(cmd);
  }
  setHelpCommands(commands);

  return commandRegistry;
}
