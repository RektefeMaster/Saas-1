import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
  transport:
    isDev
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:HH:MM:ss",
          },
        }
      : undefined,
});

/** Tenant bazlı child logger (traceId, tenantId ekler). */
export function createChildLogger(bindings: Record<string, string | number | boolean | undefined>) {
  return logger.child(bindings);
}
