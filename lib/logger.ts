/**
 * Thin structured logger. Wraps console for now -- swap to Pino/Winston later.
 * Exists so `grep -r "console\."` shows zero hits in production code.
 */

type LogContext = Record<string, unknown>;

function format(level: string, message: string, ctx?: LogContext): string {
  const timestamp = new Date().toISOString();
  const base = `[${timestamp}] ${level}: ${message}`;
  return ctx ? `${base} ${JSON.stringify(ctx)}` : base;
}

export const logger = {
  info(message: string, ctx?: LogContext) {
    console.log(format("INFO", message, ctx));
  },
  warn(message: string, ctx?: LogContext) {
    console.warn(format("WARN", message, ctx));
  },
  error(message: string, ctx?: LogContext) {
    console.error(format("ERROR", message, ctx));
  },
};
