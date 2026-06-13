import 'dotenv/config';
import mongoose from 'mongoose';
import { Worker } from 'bullmq';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createLogger } from '../utils/logger.js';
import { PROMPT, validateAdvice, extractJson } from '../routes/ai.js';

const log = createLogger('AsyncWorker');

const REDIS_URL = process.env.REDIS_URL;
const REDIS_CONFIG = REDIS_URL ? {
  connection: {
    url: REDIS_URL,
    reconnectStrategy: (retries) => Math.min(retries * 500, 2000)
  }
} : null;

// Initialize Google Generative AI for out-of-process AI processing
const API_KEY = process.env.GEMINI_API_KEY;
let genAI = null;
let aiModel = null;
if (API_KEY) {
  genAI = new GoogleGenerativeAI(API_KEY);
  aiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
}

async function start() {
  log.info('Starting Async Queue Worker...');

  if (!REDIS_URL) {
    log.error('REDIS_URL env variable is missing! Worker requires Redis for queue processing. Exiting.');
    process.exit(1);
  }

  // 1. Connect MongoDB to write audit logs & notifications
  if (process.env.MONGODB_URI) {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      log.info('Connected to MongoDB');
    } catch (err) {
      log.error('Failed to connect to MongoDB:', { error: err.message });
      process.exit(1);
    }
  }

  // 2. Initialize Workers
  
  // A. AI Queue Worker
  const aiWorker = new Worker('aiQueue', async (job) => {
    log.info(`Processing AI Job ${job.id} for user ${job.data.userId}`);
    if (!aiModel) {
      log.warn('Gemini API Key missing. Returning mock advice.');
      return {
        title: 'Mock AI Response',
        verdict: 'HOLD',
        body: 'Gemini API key is not configured on the worker. This is a simulated response.\n\n**Risk:** Medium\n**Recommendation:** Wait for API integration.',
        symbol: 'MOCK', price: 100.0, change_pct: 0.0, confidence: 50
      };
    }

    let parsed = null;
    for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
      try {
        const result = await aiModel.generateContent(PROMPT(job.data.message));
        parsed = validateAdvice(extractJson(result.response.text()));
      } catch (e) {
        if (attempt === 1) {
          log.error(`Gemini call failed on job ${job.id}:`, { error: e.message });
          throw e; // Fail job to trigger retry/dead-letter
        }
      }
    }

    if (!parsed) {
      throw new Error('AI response was invalid or malformed.');
    }
    return parsed;
  }, {
    ...REDIS_CONFIG,
    concurrency: 5 // Process up to 5 AI requests concurrently
  });

  // B. Notification Queue Worker
  const notificationWorker = new Worker('notificationQueue', async (job) => {
    log.info(`Processing Notification Job ${job.id} for user ${job.data.userId}`);
    const Notification = mongoose.models.Notification;
    if (Notification) {
      await Notification.create(job.data);
    }
  }, {
    ...REDIS_CONFIG,
    concurrency: 20
  });

  // C. Audit Queue Worker
  const auditWorker = new Worker('auditQueue', async (job) => {
    log.info(`Processing Audit Job ${job.id} - ${job.data.action}`);
    const AuditLog = mongoose.models.AuditLog;
    if (AuditLog) {
      await AuditLog.create(job.data);
    }
  }, {
    ...REDIS_CONFIG,
    concurrency: 50
  });

  // D. Broker Sync Queue Worker
  const brokerWorker = new Worker('brokerQueue', async (job) => {
    log.info(`Processing Broker Sync Job ${job.id} for user ${job.data.userId}`);
    // Simulate broker sync delay
    await new Promise(resolve => setTimeout(resolve, 3000));
    log.info(`Broker sync complete for user ${job.data.userId}`);
  }, {
    ...REDIS_CONFIG,
    concurrency: 2
  });

  // Log worker failures
  const logFailure = (workerName) => (job, err) => {
    log.error(`Job failed in ${workerName}:`, { jobId: job?.id, error: err.message });
  };

  aiWorker.on('failed', logFailure('aiWorker'));
  notificationWorker.on('failed', logFailure('notificationWorker'));
  auditWorker.on('failed', logFailure('auditWorker'));
  brokerWorker.on('failed', logFailure('brokerWorker'));

  // Heartbeat monitoring logs
  setInterval(() => {
    log.info('Async Worker Heartbeat Status Check', {
      uptime: process.uptime().toFixed(0) + 's',
      memory: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1) + ' MB'
    });
  }, 10000);

  // Graceful shutdown handling
  const shutdown = async (signal) => {
    log.info(`Received ${signal}. Closing workers gracefully...`);
    await Promise.all([
      aiWorker.close(),
      notificationWorker.close(),
      auditWorker.close(),
      brokerWorker.close()
    ]);
    try {
      await mongoose.disconnect();
      log.info('MongoDB disconnected.');
    } catch {}
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch(err => {
  log.error('Fatal worker crash:', err);
  process.exit(1);
});
