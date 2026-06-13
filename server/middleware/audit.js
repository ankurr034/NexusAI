import AuditLog from '../models/AuditLog.js';
import crypto from 'crypto';
import { addAuditJob } from '../services/queueManager.js';

/**
 * Centralized asynchronous, non-blocking audit logging helper.
 */
export const writeAuditLog = (userId, action, status, details = {}, req = null) => {
  let ipAddress = 'unknown';
  let userAgent = 'unknown';
  let correlationId = null;

  if (req) {
    ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    userAgent = req.headers['user-agent'] || 'unknown';
    correlationId = req.headers['x-correlation-id'] || req.correlationId || null;
  }

  const jobData = {
    userId,
    action,
    status,
    details,
    ipAddress,
    userAgent,
    correlationId,
    timestamp: new Date()
  };

  const executeInline = async () => {
    await AuditLog.create(jobData);
  };

  // Dispatch via queue manager
  addAuditJob(jobData, executeInline);
};

/**
 * Middleware to generate correlation IDs for audit tracking.
 */
export const correlationMiddleware = (req, res, next) => {
  const cid = req.headers['x-correlation-id'] || crypto.randomUUID();
  req.correlationId = cid;
  res.setHeader('X-Correlation-Id', cid);
  next();
};
