import winston from 'winston';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// ═══════════════════════════════════════════════════════════
//  Structured Logger — Production-Grade (Correlation ID support)
// ═══════════════════════════════════════════════════════════

const consoleFormat = printf(({ level, message, timestamp, service, ...meta }) => {
  const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} [${level.toUpperCase()}] [${service || 'NEXUS'}] ${message}${metaStr}`;
});

const isProd = process.env.NODE_ENV === 'production';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    isProd ? json() : consoleFormat
  ),
  defaultMeta: { 
    service: 'NexusAI',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize({ all: !isProd }),
        isProd ? json() : consoleFormat
      )
    })
  ]
});

// Add file transports in production
if (isProd) {
  logger.add(new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    maxsize: 5 * 1024 * 1024, // 5MB
    maxFiles: 5,
    format: json()
  }));
  logger.add(new winston.transports.File({
    filename: 'logs/combined.log',
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5,
    format: json()
  }));
}

// Child loggers for each service
export const createLogger = (service) => logger.child({ service });

export default logger;
