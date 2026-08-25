export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug(message: string, extra?: Record<string, unknown>): void;
  info(message: string, extra?: Record<string, unknown>): void;
  warn(message: string, extra?: Record<string, unknown>): void;
  error(message: string, extra?: Record<string, unknown>): void;
}

export class DefaultLogger implements Logger {
  constructor(private readonly debugEnabled = false) {}

  private emit(level: LogLevel, message: string, extra?: Record<string, unknown>): void {
    const line = extra
      ? `[hindsight:${level}] ${message} ${JSON.stringify(extra)}`
      : `[hindsight:${level}] ${message}`;

    if (level === "error") {
      console.error(line);
    } else if (level === "debug" && this.debugEnabled) {
      console.debug(line);
    } else if (level !== "debug") {
      console.log(line);
    }
  }

  debug(message: string, extra?: Record<string, unknown>): void {
    this.emit("debug", message, extra);
  }

  info(message: string, extra?: Record<string, unknown>): void {
    this.emit("info", message, extra);
  }

  warn(message: string, extra?: Record<string, unknown>): void {
    this.emit("warn", message, extra);
  }

  error(message: string, extra?: Record<string, unknown>): void {
    this.emit("error", message, extra);
  }
}
