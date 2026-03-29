/**
 * /keybindings 명령어 핸들러 — 키보드 단축키 목록 및 설정 경로 표시
 *
 * 사용자가 /keybindings를 입력하면 현재 활성화된 키보드 단축키와
 * 커스텀 설정 파일 경로를 보여줍니다.
 *
 * 기본 단축키:
 *   Esc       → 에이전트 루프 취소
 *   Ctrl+O    → 상세 출력 토글
 *   Shift+Tab → 권한 모드 순환
 *   Ctrl+D    → 종료
 *   Alt+T     → 씽킹 모드 토글
 *   Ctrl+J    → 여러 줄 입력에서 줄 바꿈
 *
 * 커스텀 설정: ~/.dhelix/keybindings.json 파일에서 단축키를 변경할 수 있습니다.
 */
import { type SlashCommand, type CommandResult, type CommandContext } from "./registry.js";
import {
  DEFAULT_BINDINGS,
  ACTION_DESCRIPTIONS,
  loadKeybindingConfig,
  getEffectiveBindings,
  formatKeyCombo,
  parseKeyCombo,
  KEYBINDINGS_CONFIG_PATH,
} from "../cli/hooks/useKeybindings.js";

export const keybindingsCommand: SlashCommand = {
  name: "keybindings",
  description: "Show keyboard shortcuts and config path",
  usage: "/keybindings",

  async execute(_args: string, _context: CommandContext): Promise<CommandResult> {
    const userConfig = loadKeybindingConfig();
    const effective = getEffectiveBindings(userConfig);
    const hasUserConfig = Object.keys(userConfig).length > 0;

    const lines: string[] = ["Keyboard Shortcuts:", ""];

    // Display effective bindings grouped by action
    for (const [combo, action] of Object.entries(effective)) {
      const parsed = parseKeyCombo(combo);
      const displayCombo = formatKeyCombo(parsed);
      const description = ACTION_DESCRIPTIONS[action] ?? action;
      const isDefault = DEFAULT_BINDINGS[combo] === action;
      const marker = !isDefault ? " (custom)" : "";
      lines.push(`  ${displayCombo.padEnd(20)} ${description}${marker}`);
    }

    // Always show Ctrl+J for newline
    lines.push(`  ${"Ctrl+J".padEnd(20)} Insert newline in multi-line input`);

    lines.push("");
    lines.push(`Config: ${KEYBINDINGS_CONFIG_PATH}`);

    if (!hasUserConfig) {
      lines.push("");
      lines.push("No custom keybindings configured.");
      lines.push("Create the file above to customize. Example:");
      lines.push("");
      lines.push("  {");
      lines.push('    "bindings": {');
      lines.push('      "escape": "cancel",');
      lines.push('      "ctrl+o": "toggle-verbose",');
      lines.push('      "shift+tab": "cycle-mode",');
      lines.push('      "ctrl+d": "exit",');
      lines.push('      "alt+t": "toggle-thinking"');
      lines.push("    }");
      lines.push("  }");
    }

    return {
      output: lines.join("\n"),
      success: true,
    };
  },
};
