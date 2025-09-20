// Logger utility for structured logging

// Log levels
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

// Log entry interface
interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  metadata?: Record<string, any>;
  requestId?: string;
  userId?: string;
  error?: Error;
}

class Logger {
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private formatLogEntry(level: LogLevel, message: string, metadata?: Record<string, any>): LogEntry {
    return {
      level,
      message,
      timestamp: this.formatTimestamp(),
      ...(metadata && { metadata }),
    };
  }

  private writeLog(entry: LogEntry): void {
    if (this.isDevelopment) {
      // Development: Pretty formatted output
      const color = this.getColorCode(entry.level);
      const reset = '\x1b[0m';
      
      console.log(
        `${color}[${entry.timestamp}] ${entry.level.toUpperCase()}${reset} - ${entry.message}`,
        entry.metadata ? entry.metadata : ''
      );
      
      if (entry.error) {
        console.error(entry.error);
      }
    } else {
      // Production: JSON formatted output with error serialization
      const jsonEntry = entry.error ? {
        ...entry,
        error: {
          name: entry.error.name,
          message: entry.error.message,
          stack: entry.error.stack
        }
      } : entry;
      
      console.log(JSON.stringify(jsonEntry));
    }
  }

  private getColorCode(level: LogLevel): string {
    const colors = {
      [LogLevel.ERROR]: '\x1b[31m', // Red
      [LogLevel.WARN]: '\x1b[33m',  // Yellow
      [LogLevel.INFO]: '\x1b[36m',  // Cyan
      [LogLevel.DEBUG]: '\x1b[35m', // Magenta
    };
    
    return colors[level] || '\x1b[0m';
  }

  // Public logging methods
  error(message: string, errorOrMetadata?: Error | Record<string, any>, metadata?: Record<string, any>): void {
    let logEntry: LogEntry;
    
    if (errorOrMetadata instanceof Error) {
      logEntry = {
        ...this.formatLogEntry(LogLevel.ERROR, message, metadata),
        error: errorOrMetadata,
      };
    } else {
      logEntry = this.formatLogEntry(LogLevel.ERROR, message, errorOrMetadata);
    }
    
    this.writeLog(logEntry);
  }

  warn(message: string, metadata?: Record<string, any>): void {
    const entry = this.formatLogEntry(LogLevel.WARN, message, metadata);
    this.writeLog(entry);
  }

  info(message: string, metadata?: Record<string, any>): void {
    const entry = this.formatLogEntry(LogLevel.INFO, message, metadata);
    this.writeLog(entry);
  }

  debug(message: string, metadata?: Record<string, any>): void {
    const entry = this.formatLogEntry(LogLevel.DEBUG, message, metadata);
    this.writeLog(entry);
  }

  // Request-specific logging
  request(method: string, url: string, statusCode: number, responseTime: number, metadata?: Record<string, any>): void {
    const message = `${method} ${url} - ${statusCode} (${responseTime}ms)`;
    const entry = this.formatLogEntry(LogLevel.INFO, message, {
      type: 'request',
      method,
      url,
      statusCode,
      responseTime,
      ...metadata,
    });
    
    this.writeLog(entry);
  }

  // Database logging
  database(operation: string, collection?: string, metadata?: Record<string, any>): void {
    const message = collection 
      ? `Database ${operation} on ${collection}` 
      : `Database ${operation}`;
    
    const entry = this.formatLogEntry(LogLevel.DEBUG, message, {
      type: 'database',
      operation,
      collection,
      ...metadata,
    });
    
    this.writeLog(entry);
  }

  // Authentication logging
  auth(action: string, userId?: string, metadata?: Record<string, any>): void {
    const message = `Auth: ${action}${userId ? ` (User: ${userId})` : ''}`;
    const entry = this.formatLogEntry(LogLevel.INFO, message, {
      type: 'auth',
      action,
      userId,
      ...metadata,
    });
    
    this.writeLog(entry);
  }

  // Performance logging
  performance(operation: string, duration: number, metadata?: Record<string, any>): void {
    const message = `Performance: ${operation} took ${duration}ms`;
    const entry = this.formatLogEntry(LogLevel.DEBUG, message, {
      type: 'performance',
      operation,
      duration,
      ...metadata,
    });
    
    this.writeLog(entry);
  }

  // Security logging
  security(event: string, severity: 'low' | 'medium' | 'high', metadata?: Record<string, any>): void {
    const level = severity === 'high' ? LogLevel.ERROR : 
                 severity === 'medium' ? LogLevel.WARN : 
                 LogLevel.INFO;
    
    const message = `Security Event: ${event} (${severity})`;
    const entry = this.formatLogEntry(level, message, {
      type: 'security',
      event,
      severity,
      ...metadata,
    });
    
    this.writeLog(entry);
  }
}

// Export singleton logger instance
export const logger = new Logger();

// Export types for external use
export type { LogEntry };