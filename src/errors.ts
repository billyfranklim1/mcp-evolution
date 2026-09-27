/** Thrown for invalid configuration. Messages never include secret values. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

/** Thrown when a tool call is rejected by a guard (instance or recipient allowlist). */
export class GuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GuardError";
  }
}
