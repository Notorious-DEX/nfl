/**
 * NFLv2 - Structured Logger
 * Provides consistent logging with levels and context
 */

class Logger {
  constructor() {
    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    this.currentLevel = process.env.LOG_LEVEL || 'info';
  }

  setLevel(level) {
    if (this.levels[level] !== undefined) {
      this.currentLevel = level;
    }
  }

  shouldLog(level) {
    return this.levels[level] >= this.levels[this.currentLevel];
  }

  format(level, message, context = {}) {
    const timestamp = new Date().toISOString();
    const levelStr = level.toUpperCase().padEnd(5);

    let output = `[${timestamp}] ${levelStr} ${message}`;

    if (Object.keys(context).length > 0) {
      output += ` ${JSON.stringify(context)}`;
    }

    return output;
  }

  debug(message, context = {}) {
    if (this.shouldLog('debug')) {
      console.log(this.format('debug', message, context));
    }
  }

  info(message, context = {}) {
    if (this.shouldLog('info')) {
      console.log(this.format('info', message, context));
    }
  }

  warn(message, context = {}) {
    if (this.shouldLog('warn')) {
      console.warn(this.format('warn', message, context));
    }
  }

  error(message, context = {}) {
    if (this.shouldLog('error')) {
      console.error(this.format('error', message, context));
    }
  }

  /**
   * Log performance timing
   */
  time(label) {
    console.time(label);
  }

  timeEnd(label) {
    console.timeEnd(label);
  }

  /**
   * Log operation start
   */
  start(operation, context = {}) {
    this.info(`Starting ${operation}`, context);
    return Date.now();
  }

  /**
   * Log operation end with duration
   */
  end(operation, startTime, context = {}) {
    const duration = Date.now() - startTime;
    this.info(`Completed ${operation}`, { ...context, duration: `${duration}ms` });
  }
}

// Singleton instance
export const logger = new Logger();
export default logger;
