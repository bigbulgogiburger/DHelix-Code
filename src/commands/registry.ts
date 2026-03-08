import { BaseError } from "../utils/error.js";

/** Command execution error */
export class CommandError extends BaseError {
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message, "COMMAND_ERROR", context);
  }
}

/** Context provided to command execution */
export interface CommandContext {
  /** Current working directory */
  readonly workingDirectory: string;
  /** Current session ID (if any) */
  readonly sessionId?: string;
  /** Current model name */
  readonly model: string;
  /** Emit an event */
  readonly emit: (event: string, data?: unknown) => void;
  /** Current conversation messages (for export, etc.) */
  readonly messages?: readonly { readonly role: string; readonly content: string }[];
}

/** Result from executing a slash command */
export interface CommandResult {
  /** Text output to display to the user */
  readonly output: string;
  /** Whether the command was successful */
  readonly success: boolean;
  /** If true, should clear the conversation */
  readonly shouldClear?: boolean;
  /** If true, should exit the application */
  readonly shouldExit?: boolean;
  /** Updated model name (if changed) */
  readonly newModel?: string;
  /** If true, should reload project instructions from disk */
  readonly refreshInstructions?: boolean;
  /** If true, output is a skill prompt that should be injected as a user message for the LLM */
  readonly shouldInjectAsUserMessage?: boolean;
  /** Override the model for processing the injected message */
  readonly modelOverride?: string;
}

/** Definition of a slash command */
export interface SlashCommand {
  /** Command name (without the `/` prefix) */
  readonly name: string;
  /** Short description shown in help and autocomplete */
  readonly description: string;
  /** Usage syntax (e.g., "/compact [focus]") */
  readonly usage: string;
  /** Execute the command */
  readonly execute: (args: string, context: CommandContext) => Promise<CommandResult>;
}

/**
 * Slash command registry — manages registration and lookup of slash commands.
 */
export class CommandRegistry {
  private readonly commands = new Map<string, SlashCommand>();

  /** Register a slash command */
  register(command: SlashCommand): void {
    if (this.commands.has(command.name)) {
      throw new CommandError(`Command already registered: /${command.name}`, {
        name: command.name,
      });
    }
    this.commands.set(command.name, command);
  }

  /** Get a command by name */
  get(name: string): SlashCommand | undefined {
    return this.commands.get(name);
  }

  /** Check if a command exists */
  has(name: string): boolean {
    return this.commands.has(name);
  }

  /** Get all registered commands */
  getAll(): readonly SlashCommand[] {
    return [...this.commands.values()];
  }

  /** Get command names matching a prefix (for autocomplete) */
  getCompletions(prefix: string): readonly SlashCommand[] {
    const lower = prefix.toLowerCase();
    return [...this.commands.values()].filter((cmd) => cmd.name.startsWith(lower));
  }

  /**
   * Parse and execute a slash command from user input.
   * Input should start with `/`.
   * Returns null if input is not a slash command.
   */
  async execute(input: string, context: CommandContext): Promise<CommandResult | null> {
    const trimmed = input.trim();
    if (!trimmed.startsWith("/")) return null;

    const [commandName, ...argParts] = trimmed.slice(1).split(/\s+/);
    const args = argParts.join(" ");

    const command = this.commands.get(commandName);
    if (!command) {
      return {
        output: `Unknown command: /${commandName}. Type /help for available commands.`,
        success: false,
      };
    }

    try {
      return await command.execute(args, context);
    } catch (error) {
      return {
        output: `Command error: ${error instanceof Error ? error.message : String(error)}`,
        success: false,
      };
    }
  }

  /**
   * Check if an input string is a slash command.
   */
  isCommand(input: string): boolean {
    return input.trim().startsWith("/");
  }
}
