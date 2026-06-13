import { createClient } from 'redis';

export let redisClient = null;
export let isRedisReady = false;

// Initialize Redis Client if REDIS_URL is provided
if (process.env.REDIS_URL) {
  try {
    redisClient = createClient({
      url: process.env.REDIS_URL,
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries) => {
          if (retries > 5) {
            console.warn('[REDIS] Connection failed. Falling back to non-cached database query execution.');
            isRedisReady = false;
            return false; // Stop retrying
          }
          return Math.min(retries * 500, 2000);
        }
      }
    });

    redisClient.on('error', (err) => {
      console.warn('[REDIS] Client error:', err.message);
      isRedisReady = false;
    });

    redisClient.on('connect', () => {
      console.log('[REDIS] Connecting...');
    });

    redisClient.on('ready', () => {
      console.log('[REDIS] Client ready and connected.');
      isRedisReady = true;
    });

    redisClient.connect().catch((err) => {
      console.warn('[REDIS] Connection bootstrap failed:', err.message);
      isRedisReady = false;
    });
  } catch (err) {
    console.error('[REDIS] Initialization error:', err.message);
  }
}

/**
 * Cache Middleware Generator.
 * Caches response JSON for the specified TTL (in seconds).
 */
export const cacheEndpoint = (ttlSeconds = 60) => {
  return async (req, res, next) => {
    // If Redis is disabled, not connected, or not ready, bypass silently
    if (!redisClient || !isRedisReady) {
      res.setHeader('X-Cache', 'BYPASS');
      return next();
    }

    const cacheKey = `cache:${req.baseUrl || ''}${req.path}:${JSON.stringify(req.query)}`;

    try {
      const cachedResponse = await redisClient.get(cacheKey);
      if (cachedResponse) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Content-Type', 'application/json');
        return res.send(cachedResponse);
      }

      // Intercept res.json to cache responses
      res.setHeader('X-Cache', 'MISS');
      const originalJson = res.json;

      res.json = function (body) {
        // Cache body payload asynchronously
        setImmediate(async () => {
          try {
            await redisClient.set(cacheKey, JSON.stringify(body), {
              EX: ttlSeconds
            });
          } catch (err) {
            console.warn('[REDIS] Cache set failed:', err.message);
          }
        });

        return originalJson.call(this, body);
      };

      next();
    } catch (err) {
      console.warn('[REDIS] Cache fetch failed:', err.message);
      res.setHeader('X-Cache', 'ERROR-BYPASS');
      next();
    }
  };
};

/**
 * Force clear cache keys matching a pattern.
 */
export const invalidateCachePattern = async (pattern) => {
  if (!redisClient || !isRedisReady) return;
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
      console.log(`[REDIS] Invalidated cache keys for pattern: ${pattern} (${keys.length} keys)`);
    }
  } catch (err) {
    console.warn('[REDIS] Cache invalidation failed:', err.message);
  }
};
