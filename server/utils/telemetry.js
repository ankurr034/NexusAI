import Sentry from '@sentry/node';
import client from 'prom-client';
import crypto from 'crypto';
import { SENTRY_DSN, isProd } from './secrets.js';

// ═══════════════════════════════════════════════════════════
//  Sentry Initialization
// ═══════════════════════════════════════════════════════════
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: 'nexusai-backend@1.0.0',
    tracesSampleRate: 1.0,
    beforeSend(event) {
      // Redact sensitive headers/payloads
      if (event.request && event.request.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['x-user-token'];
        delete event.request.headers['cookie'];
      }
      return event;
    }
  });
  console.log('[SENTRY] Initialized successfully.');
} else {
  console.warn('[SENTRY] SENTRY_DSN is not configured. Running without Sentry instrumentation.');
}

// ═══════════════════════════════════════════════════════════
//  Prometheus Registry & Metrics definition
// ═══════════════════════════════════════════════════════════
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// 1. HTTP Request Latency
export const httpLatencyHistogram = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  register
});

// 2. Active WebSockets Connections
export const activeSocketGauge = new client.Gauge({
  name: 'socket_connections_active',
  help: 'Number of active Socket.IO connections',
  register
});

// 3. Socket.IO Broadcast metrics
export const socketBroadcastsCounter = new client.Counter({
  name: 'socket_broadcasts_total',
  help: 'Total number of websocket broadcasts emitted',
  labelNames: ['channel'],
  register
});

// 4. OMS Mutex queue depth
export const omsMutexQueueDepth = new client.Gauge({
  name: 'oms_mutex_queue_depth',
  help: 'Current depth of the serialization mutex queue per user',
  labelNames: ['userId'],
  register
});

// 5. OMS Mutex wait time
export const omsMutexWaitDuration = new client.Histogram({
  name: 'oms_mutex_wait_duration_seconds',
  help: 'Latency of waiting to acquire the serialization mutex lock',
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 3],
  register
});

// 6. OMS Order execution latency
export const omsOrderLatency = new client.Histogram({
  name: 'oms_order_execution_seconds',
  help: 'Total order execution latency including balance checks and gateway dispatch',
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  register
});

// 7. Idempotency replayed requests
export const idempotencyReplayCounter = new client.Counter({
  name: 'oms_idempotency_replays_total',
  help: 'Total number of replayed responses served via idempotency cache',
  register
});

// 8. Auth failures
export const authFailuresCounter = new client.Counter({
  name: 'auth_failures_total',
  help: 'Total number of failed authentication attempts',
  register
});

// 9. Rate Limit triggers
export const rateLimitTriggersCounter = new client.Counter({
  name: 'rate_limit_triggers_total',
  help: 'Total number of rate limit activations',
  labelNames: ['route'],
  register
});

// 10. Redis connection reconnects
export const redisReconnectsCounter = new client.Counter({
  name: 'redis_reconnects_total',
  help: 'Total number of Redis reconnection events',
  register
});

// 11. Worker heartbeat
export const workerHeartbeatGauge = new client.Gauge({
  name: 'worker_heartbeat_timestamp',
  help: 'Epoch timestamp of the last worker loop execution',
  register
});

export { register };

// ═══════════════════════════════════════════════════════════
//  Correlation ID Middleware
// ═══════════════════════════════════════════════════════════
export const correlationIdMiddleware = (req, res, next) => {
  const reqId = req.headers['x-request-id'] || crypto.randomUUID();
  req.id = reqId;
  res.setHeader('X-Request-Id', reqId);
  
  // Bind Sentry scopes to request context
  if (SENTRY_DSN) {
    Sentry.configureScope((scope) => {
      scope.setTag('request_id', reqId);
      if (req.user) {
        scope.setUser({ id: req.user._id, username: req.user.username });
      }
    });
  }
  next();
};
