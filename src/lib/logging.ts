export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  userId?: string;
  workspaceId?: string;
  requestId?: string;
  [key: string]: unknown;
}

/**
 * Structured logger for application events
 */
export class Logger {
  private context: LogContext;

  constructor(context: LogContext = {}) {
    this.context = context;
  }

  /**
   * Creates a child logger with additional context
   * @param childContext Additional context to merge
   * @returns New logger instance
   */
  child(childContext: LogContext): Logger {
    return new Logger({ ...this.context, ...childContext });
  }

  /**
   * Logs a debug message
   * @param message The message to log
   * @param meta Additional metadata
   */
  debug(message: string, meta?: Record<string, unknown>): void {
    this.log('debug', message, meta);
  }

  /**
   * Logs an info message
   * @param message The message to log
   * @param meta Additional metadata
   */
  info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta);
  }

  /**
   * Logs a warning message
   * @param message The message to log
   * @param meta Additional metadata
   */
  warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta);
  }

  /**
   * Logs an error message
   * @param message The message to log
   * @param error Optional error object
   * @param meta Additional metadata
   */
  error(message: string, error?: Error, meta?: Record<string, unknown>): void {
    const logMeta = { ...meta };

    if (error !== undefined) {
      logMeta['error'] = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    this.log('error', message, logMeta);
  }

  /**
   * Internal log method
   * @param level Log level
   * @param message Message to log
   * @param meta Additional metadata
   */
  private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    const logEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...this.context,
      ...meta,
    };

    // In development, use console methods
    if (process.env.NODE_ENV === 'development') {
      switch (level) {
        case 'debug':
          // eslint-disable-next-line no-console
          console.debug(message, logEntry);
          break;
        case 'info':
          // eslint-disable-next-line no-console
          console.log(message, logEntry);
          break;
        case 'warn':
          console.warn(message, logEntry);
          break;
        case 'error':
          console.error(message, logEntry);
          break;
      }
    } else {
      // In production, use structured logging (JSON)
      // This can be piped to log aggregation services
      console.error(JSON.stringify(logEntry));
    }
  }
}

/**
 * Creates a logger instance
 * @param context Optional context to include in all logs
 * @returns Logger instance
 */
export function createLogger(context?: LogContext): Logger {
  return new Logger(context);
}

/**
 * Default logger instance
 */
export const logger = createLogger();
