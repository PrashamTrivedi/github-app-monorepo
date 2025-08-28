import type { Env } from '../types.js';

export interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  component: string;
  message: string;
  metadata?: Record<string, any>;
  duration?: number;
  endpoint?: string;
  method?: string;
  status?: number;
  environment?: string;
}

export class Logger {
  private env: Env;
  
  constructor(env: Env) {
    this.env = env;
  }

  private createLogEntry(
    level: LogEntry['level'],
    component: string,
    message: string,
    metadata?: Record<string, any>
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      metadata: this.sanitizeMetadata(metadata),
      environment: this.env.ENVIRONMENT || 'development'
    };
  }

  private sanitizeMetadata(metadata?: Record<string, any>): Record<string, any> | undefined {
    if (!metadata) return undefined;
    
    const sanitized = { ...metadata };
    
    // Remove sensitive information from logs
    const sensitiveKeys = ['token', 'key', 'secret', 'password', 'authorization'];
    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  private log(entry: LogEntry): void {
    console.log(JSON.stringify(entry));
  }

  info(component: string, message: string, metadata?: Record<string, any>): void {
    this.log(this.createLogEntry('INFO', component, message, metadata));
  }

  warn(component: string, message: string, metadata?: Record<string, any>): void {
    this.log(this.createLogEntry('WARN', component, message, metadata));
  }

  error(component: string, message: string, metadata?: Record<string, any>): void {
    this.log(this.createLogEntry('ERROR', component, message, metadata));
  }

  debug(component: string, message: string, metadata?: Record<string, any>): void {
    // Only log debug messages in development or when DEBUG_MODE is enabled
    if (this.env.ENVIRONMENT === 'development' || this.env.DEBUG_MODE === 'true') {
      this.log(this.createLogEntry('DEBUG', component, message, metadata));
    }
  }

  /**
   * Log GitHub API calls with performance metrics
   */
  logGitHubAPICall(
    endpoint: string,
    method: string,
    status: number,
    duration: number,
    metadata?: Record<string, any>
  ): void {
    const entry = this.createLogEntry(
      status >= 400 ? 'ERROR' : 'INFO',
      'github-api',
      `GitHub API call ${method} ${endpoint}`,
      {
        ...metadata,
        endpoint,
        method,
        status,
        duration,
        type: 'github_api_call'
      }
    );
    entry.endpoint = endpoint;
    entry.method = method;
    entry.status = status;
    entry.duration = duration;
    
    this.log(entry);
  }

  /**
   * Log database operations
   */
  logDatabaseOperation(
    operation: string,
    table?: string,
    duration?: number,
    metadata?: Record<string, any>
  ): void {
    this.info('database', `Database operation: ${operation}`, {
      ...metadata,
      operation,
      table,
      duration,
      type: 'database_operation'
    });
  }

  /**
   * Log webhook events
   */
  logWebhookEvent(
    eventType: string,
    action: string,
    success: boolean,
    metadata?: Record<string, any>
  ): void {
    this.info('webhook', `Webhook ${eventType}:${action} ${success ? 'processed' : 'failed'}`, {
      ...metadata,
      eventType,
      action,
      success,
      type: 'webhook_event'
    });
  }

  /**
   * Log authentication events
   */
  logAuthEvent(
    event: string,
    success: boolean,
    installationId?: number,
    duration?: number,
    metadata?: Record<string, any>
  ): void {
    this.info('auth', `Auth event: ${event}`, {
      ...metadata,
      event,
      success,
      installationId,
      duration,
      type: 'auth_event'
    });
  }
}

/**
 * Performance measurement utility
 */
export class PerformanceTimer {
  private startTime: number;
  
  constructor() {
    this.startTime = Date.now();
  }

  end(): number {
    return Date.now() - this.startTime;
  }
}