/**
 * Logging Utilities
 * Sistema de logs e auditoria
 */

// Log de requisição
export async function logRequest(request, env) {
  try {
    const url = new URL(request.url);
    const logData = {
      timestamp: new Date().toISOString(),
      method: request.method,
      path: url.pathname,
      query: url.search,
      userAgent: request.headers.get('User-Agent'),
      ip: request.headers.get('CF-Connecting-IP'),
      country: request.headers.get('CF-IPCountry'),
      referer: request.headers.get('Referer'),
      contentType: request.headers.get('Content-Type')
    };
    
    // Log no console (para debug)
    console.log('Request:', JSON.stringify(logData));
    
    // Armazenar no D1 se disponível
    if (env.DB) {
      await env.DB.prepare(`
        INSERT INTO request_logs (
          timestamp, method, path, query, user_agent, 
          ip, country, referer, content_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        logData.timestamp,
        logData.method,
        logData.path,
        logData.query,
        logData.userAgent,
        logData.ip,
        logData.country,
        logData.referer,
        logData.contentType
      ).run();
    }
    
  } catch (error) {
    console.error('Error logging request:', error);
  }
}

// Log de erro
export async function logError(error, context, env) {
  try {
    const errorData = {
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      context: JSON.stringify(context),
      level: 'error'
    };
    
    console.error('Error:', JSON.stringify(errorData));
    
    if (env.DB) {
      await env.DB.prepare(`
        INSERT INTO error_logs (
          timestamp, message, stack, context, level
        ) VALUES (?, ?, ?, ?, ?)
      `).bind(
        errorData.timestamp,
        errorData.message,
        errorData.stack,
        errorData.context,
        errorData.level
      ).run();
    }
    
  } catch (logError) {
    console.error('Error logging error:', logError);
  }
}

// Log de auditoria
export async function logAudit(action, userId, details, env) {
  try {
    const auditData = {
      timestamp: new Date().toISOString(),
      action: action,
      userId: userId,
      details: JSON.stringify(details),
      ip: details.ip || 'unknown'
    };
    
    console.log('Audit:', JSON.stringify(auditData));
    
    if (env.DB) {
      await env.DB.prepare(`
        INSERT INTO audit_logs (
          timestamp, action, user_id, details, ip
        ) VALUES (?, ?, ?, ?, ?)
      `).bind(
        auditData.timestamp,
        auditData.action,
        auditData.userId,
        auditData.details,
        auditData.ip
      ).run();
    }
    
  } catch (error) {
    console.error('Error logging audit:', error);
  }
}

// Log de performance
export async function logPerformance(endpoint, duration, status, env) {
  try {
    const perfData = {
      timestamp: new Date().toISOString(),
      endpoint: endpoint,
      duration: duration,
      status: status
    };
    
    // Log apenas se duração > 1s ou erro
    if (duration > 1000 || status >= 400) {
      console.log('Performance:', JSON.stringify(perfData));
      
      if (env.DB) {
        await env.DB.prepare(`
          INSERT INTO performance_logs (
            timestamp, endpoint, duration, status
          ) VALUES (?, ?, ?, ?)
        `).bind(
          perfData.timestamp,
          perfData.endpoint,
          perfData.duration,
          perfData.status
        ).run();
      }
    }
    
  } catch (error) {
    console.error('Error logging performance:', error);
  }
}

// Estruturar logs por nível
export function createLogger(level = 'info') {
  const levels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
  };
  
  const currentLevel = levels[level] || levels.info;
  
  return {
    error: (message, context = {}) => {
      if (currentLevel >= levels.error) {
        console.error(`[ERROR] ${message}`, context);
      }
    },
    
    warn: (message, context = {}) => {
      if (currentLevel >= levels.warn) {
        console.warn(`[WARN] ${message}`, context);
      }
    },
    
    info: (message, context = {}) => {
      if (currentLevel >= levels.info) {
        console.info(`[INFO] ${message}`, context);
      }
    },
    
    debug: (message, context = {}) => {
      if (currentLevel >= levels.debug) {
        console.debug(`[DEBUG] ${message}`, context);
      }
    }
  };
}

// Agrupar logs por sessão
export class SessionLogger {
  constructor(sessionId, env) {
    this.sessionId = sessionId;
    this.env = env;
    this.logs = [];
    this.startTime = Date.now();
  }
  
  log(level, message, context = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level,
      message: message,
      context: context,
      sessionId: this.sessionId
    };
    
    this.logs.push(logEntry);
    console.log(`[${level.toUpperCase()}] ${message}`, context);
  }
  
  async flush() {
    try {
      if (this.logs.length === 0) return;
      
      const sessionData = {
        sessionId: this.sessionId,
        startTime: new Date(this.startTime).toISOString(),
        endTime: new Date().toISOString(),
        duration: Date.now() - this.startTime,
        logCount: this.logs.length,
        logs: JSON.stringify(this.logs)
      };
      
      if (this.env.DB) {
        await this.env.DB.prepare(`
          INSERT INTO session_logs (
            session_id, start_time, end_time, duration, log_count, logs
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          sessionData.sessionId,
          sessionData.startTime,
          sessionData.endTime,
          sessionData.duration,
          sessionData.logCount,
          sessionData.logs
        ).run();
      }
      
    } catch (error) {
      console.error('Error flushing session logs:', error);
    }
  }
  
  error(message, context) { this.log('error', message, context); }
  warn(message, context) { this.log('warn', message, context); }
  info(message, context) { this.log('info', message, context); }
  debug(message, context) { this.log('debug', message, context); }
}