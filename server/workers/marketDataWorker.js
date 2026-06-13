import 'dotenv/config';
import mongoose from 'mongoose';
import { createClient } from 'redis';
import { createLogger } from '../utils/logger.js';
import MarketDataService from '../services/MarketDataService.js';

const log = createLogger('MarketDataWorker');

const activeTickers = [
  'NIFTY 50', 'SENSEX', 'BANKNIFTY',
  'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK'
];

async function start() {
  log.info('Starting Market Data Polling Worker...');

  // 1. Connect MongoDB (if configured, to ensure same environment readiness)
  if (process.env.MONGODB_URI) {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      log.info('Connected to MongoDB');
    } catch (err) {
      log.error('Failed to connect to MongoDB', { error: err.message });
      process.exit(1);
    }
  }

  // 2. Ensure Redis is connected (Pub/Sub and Caching require it)
  if (!process.env.REDIS_URL) {
    log.error('REDIS_URL env variable is missing! Worker requires Redis for distributed caching and Pub/Sub. Exiting.');
    process.exit(1);
  }

  log.info(`Connecting to Redis at: ${process.env.REDIS_URL}`);
  
  // 3. Initialize Polling Loop
  // MarketDataService requires the global redisClient in cache.js to be initialized.
  // We can let the cache.js autoconnect, or verify it here.
  // Wait, since we import MarketDataService, it will import cache.js which sets up redisClient.
  // Let's print health state and ensure polling is running.
  
  MarketDataService.startPolling(activeTickers, 5000);

  // Periodic heartbeat reporting
  setInterval(() => {
    const health = MarketDataService.getHealthStatus();
    log.info('Worker Heartbeat Metric Update', {
      uptime: process.uptime().toFixed(0) + 's',
      status: health.status,
      successRate: health.successRate,
      consecutiveFailures: health.consecutiveFailures,
      totalFetches: health.totalFetches
    });
  }, 10000);

  // Graceful shutdown handling
  const shutdown = async (signal) => {
    log.info(`Received ${signal}. Shutting down worker gracefully...`);
    if (MarketDataService.pollingInterval) {
      clearInterval(MarketDataService.pollingInterval);
    }
    try {
      await mongoose.disconnect();
      log.info('MongoDB connection closed.');
    } catch {}
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch(err => {
  log.error('Uncaught error in Market Data Worker:', err);
  process.exit(1);
});
