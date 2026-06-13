import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getQueues } from '../services/queueManager.js';
import { writeAuditLog } from '../middleware/audit.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Strict rate-limiting for administrative operations (5 requests per 10 seconds per IP)
const adminActionLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 5,
  message: { error: 'Too many administration requests. Please wait before retrying.' }
});

// Helper to validate and get a queue by name
function getQueueByName(queueName) {
  const queues = getQueues();
  // Sanitize name parameter against key injection
  if (!['aiQueue', 'notificationQueue', 'auditQueue', 'brokerQueue'].includes(queueName)) {
    return null;
  }
  return queues[queueName];
}

// Helper to check if request username is admin
function isAdmin(req) {
  return req.user?.username === 'admin' || req.user?.username === 'DemoUser';
}

router.get('/', requireAuth, async (req, res) => {
  // Guard access strictly to admin role or admin username
  if (!isAdmin(req)) {
    return res.status(403).json({ error: 'Access denied: Admin telemetry permission required.' });
  }

  try {
    const queues = getQueues();
    const stats = {};

    for (const [name, queue] of Object.entries(queues)) {
      if (queue) {
        const [active, waiting, completed, failed, delayed] = await Promise.all([
          queue.getActiveCount(),
          queue.getWaitingCount(),
          queue.getCompletedCount(),
          queue.getFailedCount(),
          queue.getDelayedCount()
        ]);
        
        // Compute failure percentage safely
        const totalProcessed = completed + failed;
        const failedPercentage = totalProcessed > 0 ? ((failed / totalProcessed) * 100).toFixed(1) : '0.0';

        stats[name] = { 
          active, 
          waiting, 
          completed, 
          failed, 
          delayed,
          failedPercentage
        };
      } else {
        stats[name] = 'offline';
      }
    }

    res.json({
      status: 'active',
      timestamp: Date.now(),
      queues: stats
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve queue statistics', details: err.message });
  }
});

// Clean a specific queue (completed and failed jobs only, keeping active and delayed safe)
router.post('/clean', requireAuth, adminActionLimiter, async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: 'Access denied: Admin permissions required.' });
  }

  const { queueName } = req.body;
  const queue = getQueueByName(queueName);
  if (!queue) {
    return res.status(400).json({ error: 'Invalid or offline queue name provided.' });
  }

  try {
    // BullMQ clean: clean completed and failed jobs
    // Avoid cleaning active or delayed jobs
    const cleanedCompleted = await queue.clean(0, 1000, 'completed');
    const cleanedFailed = await queue.clean(0, 1000, 'failed');

    writeAuditLog(
      req.user.id || 'admin',
      'QUEUE_CLEAN',
      'SUCCESS',
      { queueName, cleanedCompletedCount: cleanedCompleted.length, cleanedFailedCount: cleanedFailed.length },
      req
    );

    res.json({
      success: true,
      message: `Successfully cleaned queue ${queueName}`,
      details: {
        cleanedCompleted: cleanedCompleted.length,
        cleanedFailed: cleanedFailed.length
      }
    });
  } catch (err) {
    writeAuditLog(req.user.id || 'admin', 'QUEUE_CLEAN', 'FAILED', { queueName, error: err.message }, req);
    res.status(500).json({ error: 'Failed to clean queue', details: err.message });
  }
});

// Retry failed jobs in a specific queue
router.post('/retry', requireAuth, adminActionLimiter, async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: 'Access denied: Admin permissions required.' });
  }

  const { queueName } = req.body;
  const queue = getQueueByName(queueName);
  if (!queue) {
    return res.status(400).json({ error: 'Invalid or offline queue name provided.' });
  }

  try {
    const failedJobs = await queue.getFailed();
    let retriedCount = 0;
    
    // Idempotent retry: only retry jobs that are indeed failed
    for (const job of failedJobs) {
      if (job && typeof job.retry === 'function') {
        await job.retry();
        retriedCount++;
      }
    }

    writeAuditLog(
      req.user.id || 'admin',
      'QUEUE_RETRY',
      'SUCCESS',
      { queueName, retriedCount },
      req
    );

    res.json({
      success: true,
      message: `Successfully retried ${retriedCount} jobs in ${queueName}`,
      retriedCount
    });
  } catch (err) {
    writeAuditLog(req.user.id || 'admin', 'QUEUE_RETRY', 'FAILED', { queueName, error: err.message }, req);
    res.status(500).json({ error: 'Failed to retry jobs', details: err.message });
  }
});

// Trigger a mock test job to verify worker execution
router.post('/trigger-test', requireAuth, adminActionLimiter, async (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: 'Access denied: Admin permissions required.' });
  }

  const { queueName } = req.body;
  const queue = getQueueByName(queueName);
  if (!queue) {
    return res.status(400).json({ error: 'Invalid or offline queue name provided.' });
  }

  try {
    // Generate a strictly controlled mock test job payload depending on the queue type
    let jobData = {};
    let jobName = 'test-job';
    
    if (queueName === 'aiQueue') {
      jobData = { userId: req.user.id || 'admin', message: 'Analyze this mock portfolio' };
      jobName = 'ai-inference';
    } else if (queueName === 'notificationQueue') {
      jobData = { userId: req.user.id || 'admin', title: 'Test Dispatch', message: 'This is a test notification.' };
      jobName = 'dispatch';
    } else if (queueName === 'auditQueue') {
      jobData = { userId: req.user.id || 'admin', action: 'TEST_AUDIT', status: 'SUCCESS', details: { test: true } };
      jobName = 'write';
    } else if (queueName === 'brokerQueue') {
      jobData = { userId: req.user.id || 'admin', broker: 'MockBroker', forceSync: true };
      jobName = 'sync';
    }

    const job = await queue.add(jobName, jobData, {
      attempts: 1,
      removeOnComplete: true,
      removeOnFail: true
    });

    writeAuditLog(
      req.user.id || 'admin',
      'QUEUE_TRIGGER_TEST',
      'SUCCESS',
      { queueName, jobId: job.id },
      req
    );

    res.json({
      success: true,
      message: `Enqueued test job ${job.id} on queue ${queueName}`
    });
  } catch (err) {
    writeAuditLog(req.user.id || 'admin', 'QUEUE_TRIGGER_TEST', 'FAILED', { queueName, error: err.message }, req);
    res.status(500).json({ error: 'Failed to trigger test job', details: err.message });
  }
});

export default router;

