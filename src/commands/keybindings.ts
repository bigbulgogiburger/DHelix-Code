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

/**
 * /keybindings — Show current keyboard shortcuts and config file path.
 */
export const keybindingsCommand: SlashCommand = {
  name: "keybindings",
  description: "Show keyboard shortcuts and config path",
  usage: "/keybindings",

  async execute(_args: string, _context: CommandContext): Promise<CommandResult> {
    const userConfig = loadKeybindingConfig();
    const effective = getEffectiveBindings(userConfig);
    const hasUserConfig = Object.keys(userConfig).length > 0;

    const lines: string[] = [
      "Keyboard Shortcuts:",
      "",
    ];

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
