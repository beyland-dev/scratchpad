import { z } from "zod";
import { CoreError } from "./errors.ts";
import type { Core } from "./core.ts";

export type CommandKind = "query" | "mutation";

export interface CommandDefinition<I extends z.ZodType = z.ZodType, O = unknown> {
  /** Dotted name, e.g. `prototype.create`. */
  name: string;
  title: string;
  description: string;
  /** Queries are read-only; mutations change workspace files. */
  kind: CommandKind;
  input: I;
  handler(input: z.output<I>, core: Core): Promise<O> | O;
  /** Optional human-readable formatter for CLI output. */
  format?(output: O): string;
  /** Input keys that the CLI accepts as positional arguments, in order. */
  positional?: string[];
}

// oxlint-disable-next-line typescript/no-explicit-any
export type AnyCommand = CommandDefinition<z.ZodType, any>;

export function defineCommand<I extends z.ZodType, O>(
  definition: CommandDefinition<I, O>,
): CommandDefinition<I, O> {
  return definition;
}

export interface CommandDescriptor {
  name: string;
  title: string;
  description: string;
  kind: CommandKind;
  positional: string[];
  inputSchema: Record<string, unknown>;
}

export class CommandRegistry {
  #commands = new Map<string, AnyCommand>();

  register(...commands: AnyCommand[]): this {
    for (const command of commands) {
      if (this.#commands.has(command.name)) throw new Error(`Duplicate command: ${command.name}`);
      this.#commands.set(command.name, command);
    }
    return this;
  }

  get(name: string): AnyCommand | undefined {
    return this.#commands.get(name);
  }

  list(): AnyCommand[] {
    return [...this.#commands.values()];
  }

  describe(): CommandDescriptor[] {
    return this.list().map((c) => ({
      name: c.name,
      title: c.title,
      description: c.description,
      kind: c.kind,
      positional: c.positional ?? [],
      inputSchema: z.toJSONSchema(c.input, { io: "input", unrepresentable: "any" }) as Record<
        string,
        unknown
      >,
    }));
  }

  async run(core: Core, name: string, rawInput: unknown): Promise<unknown> {
    const command = this.#commands.get(name);
    if (!command) throw new CoreError("NOT_FOUND", `Unknown command ${JSON.stringify(name)}`);
    const parsed = command.input.safeParse(rawInput ?? {});
    if (!parsed.success) {
      throw new CoreError(
        "INVALID_INPUT",
        `Invalid input for ${name}: ${z.prettifyError(parsed.error)}`,
        parsed.error.issues,
      );
    }
    return command.handler(parsed.data, core);
  }
}
