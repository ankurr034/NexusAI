import { isRedisReady, redisClient } from '../middleware/cache.js';

// Structured logging helper
const mutexLog = (msg, meta = {}) => {
  console.log(`[MUTEX] ${new Date().toISOString()} - ${msg}`, JSON.stringify(meta));
};

class LocalLockQueue {
  constructor() {
    this.lastPromise = Promise.resolve();
    this.activeWorkers = 0;
    this.lastUsed = Date.now();
  }

  async enqueue(fn) {
    this.activeWorkers++;
    this.lastUsed = Date.now();
    
    // Chain onto the last promise
    const nextPromise = this.lastPromise.then(async () => {
      const lockAcquiredTime = performance.now();
      try {
        return await fn(lockAcquiredTime);
      } finally {
        this.lastUsed = Date.now();
      }
    }).catch(async (err) => {
      // Ensure errors in one execution do not poison/break subsequent chained executions
      throw err; 
    });

    this.lastPromise = nextPromise.catch(() => {});
    
    try {
      return await nextPromise;
    } finally {
      this.activeWorkers--;
    }
  }
}

import { omsMutexQueueDepth, omsMutexWaitDuration } from './telemetry.js';

class OrderExecutionMutex {
  constructor() {
    this.queues = new Map(); // userId -> LocalLockQueue
    // Periodically clean up inactive queues to prevent memory leaks
    setInterval(() => this.pruneInactiveQueues(), 60000); // every 1 min
  }

  pruneInactiveQueues() {
    const now = Date.now();
    const beforePruneCount = this.queues.size;
    for (const [userId, queue] of this.queues.entries()) {
      if (queue.activeWorkers === 0 && now - queue.lastUsed > 30000) {
        this.queues.delete(userId);
      }
    }
    if (this.queues.size < beforePruneCount) {
      mutexLog('Pruned inactive queues', { 
        removed: beforePruneCount - this.queues.size, 
        currentQueues: this.queues.size 
      });
    }
  }

  /**
   * Execute an operation inside a lock for the user.
   */
  async acquireAndExecute(userId, operationFn) {
    const queueDepth = this.queues.get(userId)?.activeWorkers || 0;
    mutexLog('Acquiring lock request', { userId, queueDepth });
    omsMutexQueueDepth.set({ userId }, queueDepth + 1);

    const waitStart = performance.now();

    if (process.env.REDIS_URL && isRedisReady) {
      const lockKey = `lock:user:${userId}`;
      const token = Math.random().toString(36).substring(2);
      const lockTimeout = 15000;

      const startTime = Date.now();
      let acquired = false;
      
      while (Date.now() - startTime < 15000) {
        const result = await redisClient.set(lockKey, token, {
          NX: true,
          PX: lockTimeout
        });
        if (result === 'OK') {
          acquired = true;
          break;
        }
        await new Promise(r => setTimeout(r, 50));
      }

      if (!acquired) {
        omsMutexQueueDepth.set({ userId }, Math.max(0, (this.queues.get(userId)?.activeWorkers || 0)));
        throw new Error('Lock acquisition timeout. Please retry your order.');
      }

      const lockAcquiredTime = performance.now();
      omsMutexWaitDuration.observe((lockAcquiredTime - waitStart) / 1000);

      try {
        mutexLog('Redis lock acquired', { userId, duration: performance.now() - lockAcquiredTime });
        return await operationFn(lockAcquiredTime);
      } finally {
        const currentToken = await redisClient.get(lockKey);
        if (currentToken === token) {
          await redisClient.del(lockKey);
        }
        omsMutexQueueDepth.set({ userId }, Math.max(0, (this.queues.get(userId)?.activeWorkers || 0)));
      }
    } else {
      // Single-instance local lock queue
      if (!this.queues.has(userId)) {
        this.queues.set(userId, new LocalLockQueue());
      }
      const queue = this.queues.get(userId);
      
      const wrappedOperation = async (lockAcquiredTime) => {
        omsMutexWaitDuration.observe((performance.now() - waitStart) / 1000);
        try {
          return await operationFn(lockAcquiredTime);
        } finally {
          omsMutexQueueDepth.set({ userId }, Math.max(0, queue.activeWorkers - 1));
        }
      };

      return await queue.enqueue(wrappedOperation);
    }
  }
}

export default new OrderExecutionMutex();
