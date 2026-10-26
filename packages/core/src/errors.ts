export type CoreErrorCode =
  | "NOT_FOUND"
  | "INVALID_INPUT"
  | "CONFLICT"
  | "NO_WORKSPACE"
  | "INTERNAL";

export class CoreError extends Error {
  readonly code: CoreErrorCode;
  readonly details?: unknown;

  constructor(code: CoreErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "CoreError";
    this.code = code;
    this.details = details;
  }
}

export function isCoreError(error: unknown): error is CoreError {
  return error instanceof CoreError;
}
