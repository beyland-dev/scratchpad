import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { CoreError, type CommandDescriptor } from "@beyland/sprue-core";

interface JsonSchema {
  type?: string | string[];
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  anyOf?: JsonSchema[];
  default?: unknown;
}

export interface FlagSpec {
  key: string;
  flag: string;
  type: "string" | "number" | "boolean" | "array" | "json";
  required: boolean;
  description?: string;
  choices?: unknown[];
}

export function kebab(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

function primaryType(schema: JsonSchema): string | undefined {
  if (schema.anyOf) {
    const nonNull = schema.anyOf.find((s) => s.type !== "null");
    return nonNull ? primaryType(nonNull) : undefined;
  }
  return Array.isArray(schema.type) ? schema.type.find((t) => t !== "null") : schema.type;
}

function enumOf(schema: JsonSchema): unknown[] | undefined {
  return schema.enum ?? schema.anyOf?.find((s) => s.enum)?.enum;
}

/** Derive CLI flags from a command's JSON schema (top-level properties only). */
export function flagsFor(command: CommandDescriptor): FlagSpec[] {
  const schema = command.inputSchema as JsonSchema;
  const required = new Set(schema.required ?? []);
  return Object.entries(schema.properties ?? {}).map(([key, prop]) => {
    const t = primaryType(prop);
    const type: FlagSpec["type"] =
      t === "boolean"
        ? "boolean"
        : t === "number" || t === "integer"
          ? "number"
          : t === "array"
            ? primaryType(prop.items ?? {}) === "object"
              ? "json"
              : "array"
            : t === "object"
              ? "json"
              : "string";
    return {
      key,
      flag: kebab(key),
      type,
      required: required.has(key),
      description: prop.description,
      choices: enumOf(prop),
    };
  });
}

/** `@path` reads a file's contents; `\@text` escapes a literal leading `@`. */
async function resolveValue(raw: string, cwd: string): Promise<string> {
  if (raw.startsWith("\\@")) return raw.slice(1);
  if (raw.startsWith("@") && raw.length > 1) {
    const file = path.resolve(cwd, raw.slice(1));
    try {
      return await readFile(file, "utf8");
    } catch {
      throw new CoreError("INVALID_INPUT", `Could not read file ${file}`);
    }
  }
  return raw;
}

function parseJson(flag: string, text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new CoreError("INVALID_INPUT", `--${flag} expects JSON`);
  }
}

/** Turn argv for a registry command into its input object. */
export async function parseCommandInput(
  command: CommandDescriptor,
  args: string[],
  cwd: string,
): Promise<Record<string, unknown>> {
  const flags = flagsFor(command);
  const options: Record<string, { type: "string" | "boolean"; multiple?: boolean }> = {
    input: { type: "string" },
  };
  for (const f of flags) {
    const spec = {
      type: f.type === "boolean" ? ("boolean" as const) : ("string" as const),
      multiple: f.type === "array",
    };
    options[f.flag] = spec;
    if (f.flag !== f.key) options[f.key] = spec;
  }
  let parsed;
  try {
    parsed = parseArgs({ args, options, allowPositionals: true, strict: true });
  } catch (error) {
    throw new CoreError(
      "INVALID_INPUT",
      `${(error as Error).message}. Run \`sp ${command.name} --help\` for usage.`,
    );
  }
  const { values, positionals } = parsed;

  let input: Record<string, unknown> = {};
  if (typeof values.input === "string") {
    const json = parseJson("input", await resolveValue(values.input, cwd));
    if (!json || typeof json !== "object" || Array.isArray(json))
      throw new CoreError("INVALID_INPUT", "--input must be a JSON object");
    input = { ...(json as Record<string, unknown>) };
  }

  if (positionals.length > command.positional.length) {
    throw new CoreError(
      "INVALID_INPUT",
      `Too many arguments for ${command.name}: ${positionals.slice(command.positional.length).join(" ")}`,
    );
  }
  for (const [i, value] of positionals.entries()) {
    const key = command.positional[i]!;
    const flag = flags.find((f) => f.key === key);
    input[key] = flag?.type === "number" ? Number(value) : await resolveValue(value, cwd);
  }

  for (const f of flags) {
    const raw = values[f.flag] ?? values[f.key];
    if (raw === undefined) continue;
    if (f.type === "boolean") input[f.key] = raw;
    else if (f.type === "array")
      input[f.key] = await Promise.all((raw as string[]).map((v) => resolveValue(v, cwd)));
    else if (f.type === "number") input[f.key] = Number(raw);
    else if (f.type === "json")
      input[f.key] = parseJson(f.flag, await resolveValue(raw as string, cwd));
    else {
      const value = await resolveValue(raw as string, cwd);
      // Nullable string fields accept "null" to clear them.
      input[f.key] = value === "null" && !f.required ? null : value;
    }
  }
  return input;
}

export function commandHelp(command: CommandDescriptor): string {
  const flags = flagsFor(command);
  const positional = command.positional.map((p) => `<${p}>`).join(" ");
  const lines = [
    `sp ${command.name}${positional ? ` ${positional}` : ""} [options]`,
    "",
    command.description,
    "",
    "Options:",
  ];
  for (const f of flags) {
    if (command.positional.includes(f.key)) continue;
    const value =
      f.type === "boolean"
        ? ""
        : f.type === "array"
          ? " <value> (repeatable)"
          : f.type === "json"
            ? " <json>"
            : " <value>";
    const choices = f.choices ? ` [${f.choices.join("|")}]` : "";
    lines.push(`  --${f.flag}${value}${f.required ? " (required)" : ""}${choices}`);
    if (f.description) lines.push(`      ${f.description}`);
  }
  lines.push("  --input <json>", "      Full input as JSON (merged with other flags)");
  lines.push(
    "",
    "Values starting with @ are read from files, e.g. --html @./index.html (use \\@ for a literal @).",
  );
  return lines.join("\n");
}
