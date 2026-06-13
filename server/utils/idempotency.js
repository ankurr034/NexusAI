import crypto from 'crypto';
import { isRedisReady, redisClient } from '../middleware/cache.js';

const idempotencyLog = (msg, meta = {}) => {
  console.log(`[IDEMPOTENCY] ${new Date().toISOString()} - ${msg}`, JSON.stringify(meta));
};

// Local cache fallback
const localCache = new Map();

// Helper to compute a hash of request body
function getPayloadHash(payload) {
  const cleanPayload = payload ? { ...payload } : {};
  // Exclude non-idempotent tracking parameters like timestamp or wallet balances if passed
  delete cleanPayload.timestamp;
  delete cleanPayload.balance;
  return crypto.createHash('sha256').update(JSON.stringify(cleanPayload)).digest('hex');
}

export class IdempotencyManager {
  static async checkAndRegister(key, requestBody) {
    const payloadHash = getPayloadHash(requestBody);
    const redisKey = `idempotency:order:${key}`;
    const ttlSeconds = 120; // 2 minutes TTL

    if (process.env.REDIS_URL && isRedisReady) {
      const existing = await redisClient.get(redisKey);
      if (existing) {
        const record = JSON.parse(existing);
        if (record.payloadHash !== payloadHash) {
          idempotencyLog('Key misuse detected (different payloads)', { key });
          throw new Error('MISUSE_ERROR');
        }
        return record;
      }

      // Lock with 'processing' state
      const initialRecord = {
        status: 'processing',
        payloadHash,
        timestamp: Date.now()
      };
      await redisClient.set(redisKey, JSON.stringify(initialRecord), {
        NX: true,
        EX: 10 // 10s processing safety lock
      });
      return { status: 'new' };
    } else {
      // Local Memory Cache Fallback
      if (localCache.has(key)) {
        const record = localCache.get(key);
        if (record.payloadHash !== payloadHash) {
          idempotencyLog('Key misuse detected (different payloads)', { key });
          throw new Error('MISUSE_ERROR');
        }
        return record;
      }

      const initialRecord = {
        status: 'processing',
        payloadHash,
        timestamp: Date.now()
      };
      localCache.set(key, initialRecord);

      // Clean up processing locks after 10 seconds if not resolved
      setTimeout(() => {
        const record = localCache.get(key);
        if (record && record.status === 'processing') {
          localCache.delete(key);
        }
      }, 10000);

      return { status: 'new' };
    }
  }

  static async resolve(key, responsePayload, statusCode) {
    const redisKey = `idempotency:order:${key}`;
    const ttlSeconds = 120;

    if (process.env.REDIS_URL && isRedisReady) {
      const existing = await redisClient.get(redisKey);
      if (!existing) return;
      const record = JSON.parse(existing);
      record.status = 'completed';
      record.response = responsePayload;
      record.statusCode = statusCode;
      
      await redisClient.set(redisKey, JSON.stringify(record), {
        EX: ttlSeconds
      });
    } else {
      const record = localCache.get(key);
      if (!record) return;
      record.status = 'completed';
      record.response = responsePayload;
      record.statusCode = statusCode;
      
      localCache.set(key, record);
      
      // Expire completed cache after TTL
      setTimeout(() => {
        localCache.delete(key);
      }, ttlSeconds * 1000);
    }
  }

  static async release(key) {
    const redisKey = `idempotency:order:${key}`;
    if (process.env.REDIS_URL && isRedisReady) {
      await redisClient.del(redisKey);
    } else {
      localCache.delete(key);
    }
  }
}
