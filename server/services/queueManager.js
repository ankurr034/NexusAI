import { Queue, QueueEvents } from 'bullmq';
import { isRedisReady } from '../middleware/cache.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('QueueManager');

let aiQueue = null;
let notificationQueue = null;
let auditQueue = null;
let brokerQueue = null;

let aiQueueEvents = null;

const REDIS_URL = process.env.REDIS_URL;
const REDIS_CONFIG = REDIS_URL ? {
  connection: {
    url: REDIS_URL,
    // Add reconnect strategy for resilience
    reconnectStrategy: (retries) => Math.min(retries * 500, 2000)
  }
} : null;

export const initQueues = () => {
  if (REDIS_URL && isRedisReady) {
    try {
      aiQueue = new Queue('aiQueue', REDIS_CONFIG);
      notificationQueue = new Queue('notificationQueue', REDIS_CONFIG);
      auditQueue = new Queue('auditQueue', REDIS_CONFIG);
      brokerQueue = new Queue('brokerQueue', REDIS_CONFIG);

      // Listener for waiting on synchronous jobs
      aiQueueEvents = new QueueEvents('aiQueue', REDIS_CONFIG);
      
      log.info('BullMQ Queues and QueueEvents initialized successfully.');
    } catch (err) {
      log.error('Failed to initialize BullMQ Queues, using fallback.', { error: err.message });
      aiQueue = null;
      notificationQueue = null;
      auditQueue = null;
      brokerQueue = null;
      aiQueueEvents = null;
    }
  } else {
    log.warn('Redis is not connected. BullMQ running in local fallback (in-process synchronous execution) mode.');
  }
};

// Expose underlying queues for dashboard inspection
export const getQueues = () => ({
  aiQueue,
  notificationQueue,
  auditQueue,
  brokerQueue
});

// Helper to push AI jobs
export const addAIJob = async (data, executeFallback) => {
  if (aiQueue && isRedisReady) {
    try {
      const job = await aiQueue.add('ai-inference', data, {
        attempts: 2,
        backoff: { type: 'exponential', delay: 1000 },
        timeout: 25000 // 25s timeout for AI jobs
      });
      log.info(`Enqueued AI Job ${job.id} for user ${data.userId}`);
      
      // Wait for the worker to finish the job and return the result
      if (aiQueueEvents) {
        const result = await job.waitUntilFinished(aiQueueEvents);
        return { success: true, result };
      }
    } catch (err) {
      log.warn(`AI Job enqueue or wait failed: ${err.message}. Falling back to inline execution.`);
    }
  }
  
  // Fallback to inline execution
  log.info(`Executing AI Job inline for user ${data.userId}`);
  const result = await executeFallback();
  return { success: true, result };
};

// Helper to push notifications (non-blocking)
export const addNotificationJob = async (data, executeFallback) => {
  if (notificationQueue && isRedisReady) {
    try {
      const job = await notificationQueue.add('dispatch', data, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: 100
      });
      return { success: true, jobId: job.id };
    } catch (err) {
      log.warn(`Notification enqueue failed: ${err.message}. Running inline fallback.`);
    }
  }
  executeFallback().catch(() => {});
  return { success: true, inline: true };
};

// Helper to push audit logs (non-blocking)
export const addAuditJob = async (data, executeFallback) => {
  if (auditQueue && isRedisReady) {
    try {
      await auditQueue.add('write', data, {
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
        removeOnFail: 1000
      });
      return { success: true };
    } catch (err) {
      log.warn(`Audit log enqueue failed: ${err.message}. Running inline fallback.`);
    }
  }
  executeFallback().catch(() => {});
  return { success: true, inline: true };
};

// Helper to push broker sync tasks (non-blocking)
export const addBrokerSyncJob = async (data, executeFallback) => {
  if (brokerQueue && isRedisReady) {
    try {
      // De-duplicate: use userId as job name/id to avoid sync storms
      const job = await brokerQueue.add('sync', data, {
        jobId: `sync:${data.userId}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: 100
      });
      return { success: true, jobId: job.id };
    } catch (err) {
      log.warn(`Broker sync enqueue failed: ${err.message}. Running inline fallback.`);
    }
  }
  executeFallback().catch(() => {});
  return { success: true, inline: true };
};
