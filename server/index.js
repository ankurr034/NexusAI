// Load environment variables BEFORE any module that reads them at import time
// (ES module imports are hoisted, so this must be the very first import).
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import logger, { createLogger } from './utils/logger.js';

// Routes
import predictionRoutes from './routes/predictions.js';
import authRoutes from './routes/auth.js';
import premiumRoutes from './routes/premium.js';
import aiRoutes from './routes/ai.js';
import portfolioRoutes from './routes/portfolio.js';
import marketRoutes from './routes/market.js';
import premiumFeaturesRoutes from './routes/premiumFeatures.js';
import profileRoutes from './routes/profile.js';
import walletRoutes from './routes/wallet.js';
import ordersRoutes from './routes/orders.js';
import notificationsRoutes from './routes/notifications.js';
import featuresRoutes from './routes/features.js';
import BrokerGateway from './services/BrokerGateway.js';
import MarketAnalyticsEngine from './services/MarketAnalyticsEngine.js';
import PaperTradingEngine from './services/PaperTradingEngine.js';
import MarketDataService from './services/MarketDataService.js';

dotenv.config();
mongoose.set('bufferCommands', false);

const log = createLogger('Server');
const wsLog = createLogger('WebSocket');
const mktLog = createLogger('MarketData');

// ═══════════════════════════════════════════════════════════
//  Startup Environment Validation
// ═══════════════════════════════════════════════════════════
const requiredEnvs = ['BROKER_API_KEY', 'BROKER_SECRET', 'REDIRECT_URI', 'CLIENT_ID', 'CLIENT_SECRET', 'WS_URL'];
requiredEnvs.forEach(env => {
  if (!process.env[env]) {
    log.warn(`Missing ENV variable: ${env}. Broker integration may fail in production.`);
  }
});
// JWT_SECRET is validated authoritatively in utils/secrets.js (fail-fast in production).

// ═══════════════════════════════════════════════════════════
//  Global Process Error Handlers
// ═══════════════════════════════════════════════════════════
process.on('uncaughtException', (err) => {
  log.error('Uncaught Exception', { error: err.message, stack: err.stack });
});

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled Rejection', { reason: String(reason) });
});

// ═══════════════════════════════════════════════════════════
//  Express App & HTTP Server
// ═══════════════════════════════════════════════════════════
const app = express();
const analyticsEngine = new MarketAnalyticsEngine();
const httpServer = createServer(app);

// ═══════════════════════════════════════════════════════════
//  Socket.IO with Production Settings
// ═══════════════════════════════════════════════════════════
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  },
  pingInterval: 25000,     // Server-side heartbeat every 25s
  pingTimeout: 60000,      // Disconnect after 60s without pong
  maxHttpBufferSize: 1e6,  // 1MB max message size
  connectTimeout: 10000    // 10s connection timeout
});

// ═══════════════════════════════════════════════════════════
//  MULTI-INSTANCE COORDINATION
//  In pm2 cluster mode every instance runs this file, so the
//  broadcast/polling timers must fire on ONE leader only — else
//  clients get duplicated emits and Yahoo Finance gets hammered.
//  For socket fan-out across instances, set REDIS_URL so the
//  leader's emits reach clients connected to any instance.
// ═══════════════════════════════════════════════════════════
const INSTANCE_ID = process.env.NODE_APP_INSTANCE ?? process.env.pm_id ?? '0';
const IS_TIMER_LEADER = String(INSTANCE_ID) === '0';

(async () => {
  if (!process.env.REDIS_URL) {
    if (INSTANCE_ID !== '0') {
      wsLog.warn('Running a non-leader instance without REDIS_URL — socket clients here will not receive leader broadcasts. Set REDIS_URL for multi-instance fan-out.');
    }
    return;
  }
  try {
    const [{ createAdapter }, { createClient }] = await Promise.all([
      import('@socket.io/redis-adapter'),
      import('redis')
    ]);
    const pubClient = createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    wsLog.info('Socket.IO Redis adapter attached — broadcasts now fan out across instances.');
  } catch (err) {
    wsLog.error('Failed to attach Redis adapter (is `@socket.io/redis-adapter redis` installed?). Falling back to single-instance broadcasting.', { error: err.message });
  }
})();

// ═══════════════════════════════════════════════════════════
//  SECURITY MIDDLEWARE STACK
// ═══════════════════════════════════════════════════════════

// 1. Helmet: HTTP security headers
app.use(helmet({
  contentSecurityPolicy: false,  // CSP would break our SPA
  crossOriginEmbedderPolicy: false
}));

// 2. CORS
// Production allows ONLY the explicit origins in FRONTEND_URL (comma-separated).
// Localhost is auto-trusted in development only, so a deployed API never
// accepts requests from an arbitrary localhost:* origin.
const explicitOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const devLocalhost = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:3000'
];

const allowedOrigins = process.env.NODE_ENV === 'production'
  ? explicitOrigins
  : [...new Set([...devLocalhost, ...explicitOrigins])];

if (process.env.NODE_ENV === 'production' && explicitOrigins.length === 0) {
  log.warn('CORS: FRONTEND_URL is not set in production — all cross-origin browser requests will be rejected.');
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // Allow server-to-server or Postman
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // In development only, trust any localhost port for convenience.
    if (process.env.NODE_ENV !== 'production' && /^http:\/\/localhost:\d+$/.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

// 3. Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 4. MongoDB query injection prevention
app.use(mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    log.warn('Sanitized NoSQL injection attempt', { ip: req.ip, key });
  }
}));

// 5. Global rate limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,                  // 500 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
  skip: (req) => req.path === '/api/health' // Always allow health checks
});
app.use('/api/', globalLimiter);

// 6. Strict rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many authentication attempts.' }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// 7. Strict wallet & payment rate limiter
const walletLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // Max 50 wallet deposits, withdrawals or verifications per 15 minutes
  message: { error: 'Too many wallet operations. Please try again later.' }
});
app.use('/api/wallet', walletLimiter);

// 8. Trading operations rate limiter (broker orders & cancels)
const tradeLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Max 60 trades/orders per minute
  message: { error: 'Trade rate limit exceeded. Please throttle order requests.' }
});
app.use('/api/broker/order', tradeLimiter);
app.use('/api/orders/cancel', tradeLimiter);

// ═══════════════════════════════════════════════════════════
//  REQUEST TIMING & LOGGING MIDDLEWARE
// ═══════════════════════════════════════════════════════════
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 1000) {
      log.warn('Slow request', { method: req.method, url: req.originalUrl, duration: `${duration}ms`, status: res.statusCode });
    }
  });
  next();
});

// ═══════════════════════════════════════════════════════════
//  HEALTH CHECK ENDPOINTS
// ═══════════════════════════════════════════════════════════
const startTime = Date.now();

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

app.get('/api/health/deep', async (req, res) => {
  const checks = {
    server: 'healthy',
    database: 'unknown',
    marketData: 'unknown',
    websocket: 'unknown'
  };

  // MongoDB check
  try {
    checks.database = mongoose.connection.readyState === 1 ? 'healthy' : 'degraded';
  } catch { checks.database = 'unhealthy'; }

  // Market data check
  const nifty = MarketDataService.priceCache.get('NIFTY 50');
  if (nifty) {
    const age = Date.now() - nifty.lastUpdated;
    checks.marketData = age < 30000 ? 'healthy' : age < 120000 ? 'degraded' : 'stale';
    checks.marketDataAge = `${Math.floor(age / 1000)}s`;
    checks.niftyPrice = nifty.price;
  } else {
    checks.marketData = 'no_data';
  }

  // WebSocket check
  try {
    const sockets = await io.fetchSockets();
    checks.websocket = 'healthy';
    checks.connectedClients = sockets.length;
  } catch { checks.websocket = 'degraded'; }

  // Memory utilization monitoring
  const memory = process.memoryUsage();
  const memoryUsage = {
    rss: `${Math.round(memory.rss / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)}MB`,
    heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`
  };

  const overallStatus = Object.values(checks).includes('unhealthy') ? 'unhealthy' :
                        Object.values(checks).includes('degraded') ? 'degraded' : 'healthy';

  res.status(overallStatus === 'unhealthy' ? 503 : 200).json({
    status: overallStatus,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks,
    memoryUsage,
    timestamp: new Date().toISOString()
  });
});

// Market data monitoring endpoint
app.get('/api/health/market', (req, res) => {
  const symbols = ['NIFTY 50', 'SENSEX', 'BANKNIFTY', 'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK'];
  const status = symbols.map(sym => {
    const cached = MarketDataService.priceCache.get(sym);
    return {
      symbol: sym,
      price: cached?.price || null,
      change: cached?.changePercent ? `${cached.changePercent >= 0 ? '+' : ''}${cached.changePercent.toFixed(2)}%` : null,
      age: cached ? `${Math.floor((Date.now() - cached.lastUpdated) / 1000)}s` : 'N/A',
      stale: cached ? (Date.now() - cached.lastUpdated > 60000) : true
    };
  });
  res.json({ symbols: status, pollInterval: '5s', provider: 'yahoo-finance2' });
});

// ═══════════════════════════════════════════════════════════
//  ROUTES SETUP (ordered by priority)
// ═══════════════════════════════════════════════════════════
app.use('/api/predictions', predictionRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/premium', premiumRoutes);
app.use('/api/copilot', aiRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api', marketRoutes);
app.use('/api', featuresRoutes);

// Analytics REST Endpoint (before premium routes to avoid middleware interception)
app.get('/api/heatmap', (req, res) => {
  res.json(analyticsEngine.getFullState());
});

app.use('/api', premiumFeaturesRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/gtt', ordersRoutes);
app.use('/api/notifications', notificationsRoutes);

// ═══════════════════════════════════════════════════════════
//  DATABASE CONNECTION with Retry
// ═══════════════════════════════════════════════════════════
const connectDB = async (retries = 5) => {
  for (let i = 0; i < retries; i++) {
    try {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nexusai', {
        serverSelectionTimeoutMS: 5000,
        heartbeatFrequencyMS: 10000
      });
      log.info('Connected to MongoDB');
      return;
    } catch (err) {
      log.error(`MongoDB connection attempt ${i + 1}/${retries} failed`, { error: err.message });
      if (i < retries - 1) await new Promise(r => setTimeout(r, 3000));
    }
  }
  log.error('Failed to connect to MongoDB after all retries');
};
connectDB();

// ═══════════════════════════════════════════════════════════
//  WEBSOCKET SETUP — Production Hardened
// ═══════════════════════════════════════════════════════════
const wsMetrics = {
  totalConnections: 0,
  currentConnections: 0,
  totalMessages: 0,
  reconnections: new Map(), // Track reconnection rates per IP
  subscriptions: new Map()  // Track subscription counts
};

io.on('connection', (socket) => {
  wsMetrics.totalConnections++;
  wsMetrics.currentConnections++;
  wsLog.info(`Client connected: ${socket.id}`, { clients: wsMetrics.currentConnections });

  // Reconnection throttling
  const clientIp = socket.handshake.address;
  const reconnects = wsMetrics.reconnections.get(clientIp) || { count: 0, lastTime: 0 };
  const now = Date.now();
  if (now - reconnects.lastTime < 1000) {
    reconnects.count++;
    if (reconnects.count > 10) {
      wsLog.warn('Reconnection flood detected', { ip: clientIp, count: reconnects.count });
      socket.disconnect(true);
      return;
    }
  } else {
    reconnects.count = 1;
  }
  reconnects.lastTime = now;
  wsMetrics.reconnections.set(clientIp, reconnects);

  // Duplicate subscription prevention
  const socketSubs = new Set();

  socket.on('subscribe_stock', (ticker) => {
    if (typeof ticker !== 'string' || ticker.length > 30) return; // Validate
    const room = `stock_${ticker}`;
    if (!socketSubs.has(room)) {
      socket.join(room);
      socketSubs.add(room);
    }
  });

  socket.on('unsubscribe_stock', (ticker) => {
    if (typeof ticker !== 'string') return;
    const room = `stock_${ticker}`;
    socket.leave(room);
    socketSubs.delete(room);
  });

  socket.on('subscribe_microstructure', (ticker) => {
    if (typeof ticker !== 'string' || ticker.length > 30) return;
    const room = `microstructure_${ticker}`;
    if (!socketSubs.has(room)) {
      socket.join(room);
      socketSubs.add(room);
    }
  });

  socket.on('join_admin', () => {
    socket.join('admin_telemetry');
  });

  socket.on('join_heatmap', () => {
    socket.join('market_heatmap');
  });

  socket.on('disconnect', (reason) => {
    wsMetrics.currentConnections--;
    socketSubs.clear();
    wsLog.info(`Client disconnected: ${socket.id}`, { reason, clients: wsMetrics.currentConnections });
  });

  socket.on('error', (err) => {
    wsLog.error('Socket error', { socketId: socket.id, error: err.message });
  });
});

// Stale client cleanup every 5 minutes
setInterval(async () => {
  try {
    const sockets = await io.fetchSockets();
    let staleCount = 0;
    for (const s of sockets) {
      if (!s.connected) {
        s.disconnect(true);
        staleCount++;
      }
    }
    if (staleCount > 0) wsLog.info(`Cleaned ${staleCount} stale sockets`);
    // Clean old reconnection tracking entries
    const cutoff = Date.now() - 300000; // 5 min
    for (const [ip, data] of wsMetrics.reconnections) {
      if (data.lastTime < cutoff) wsMetrics.reconnections.delete(ip);
    }
  } catch (err) {
    wsLog.error('Stale client cleanup error', { error: err.message });
  }
}, 300000);

// ═══════════════════════════════════════════════════════════
//  BROADCAST TIMERS  (leader instance only — see IS_TIMER_LEADER)
// ═══════════════════════════════════════════════════════════
// Declared at module scope so the startup log can read it on every instance.
const activeTickers = ['NIFTY 50', 'SENSEX', 'BANKNIFTY', 'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK'];

if (IS_TIMER_LEADER) {

// Admin Telemetry every 3 seconds
setInterval(() => {
  const stats = BrokerGateway.getAllBrokerStats();
  const analyticsMetrics = analyticsEngine.getMetrics();
  const simulatorMetrics = PaperTradingEngine.getMetrics();
  io.to('admin_telemetry').emit('admin_telemetry_update', {
    timestamp: Date.now(),
    stats,
    analyticsLoad: analyticsMetrics,
    simulatorLoad: simulatorMetrics,
    wsMetrics: {
      current: wsMetrics.currentConnections,
      total: wsMetrics.totalConnections
    }
  });
}, 3000);

// Heatmap deltas every 500ms
setInterval(() => {
  const delta = analyticsEngine.computeNextTick();
  if (delta.updatedStocks.length > 0) {
    io.to('market_heatmap').emit('market_heatmap_update', delta);
  }
}, 500);

// ═══════════════════════════════════════════════════════════
//  MARKET DATA ENGINE — Enhanced Polling
// ═══════════════════════════════════════════════════════════
MarketDataService.startPolling(activeTickers, 5000);

// Broadcast stock updates — batched
setInterval(() => {
  const updates = MarketDataService.getLivePricesForBroadcast(activeTickers);
  if (updates && updates.length > 0) {
    io.emit('price_update', updates);
    io.emit('market_update', { timestamp: Date.now(), status: 'Live' });
  }
}, 1000);

// Microstructure Updates using LIVE prices
let microTick = 0;
setInterval(() => {
  const current_price = MarketDataService.getCurrentPrice('RELIANCE');
  microTick++;
  const isBuy = microTick % 3 !== 0;
  const spreadOffset = (microTick % 5) * 0.1;
  const new_trade = {
    time: new Date().toLocaleTimeString(),
    side: isBuy ? 'BUY' : 'SELL',
    price: parseFloat((current_price + (isBuy ? spreadOffset : -spreadOffset)).toFixed(2)),
    quantity: 200 + (microTick % 10) * 180,
    value: 0,
    is_block: microTick % 15 === 0
  };
  new_trade.value = new_trade.price * new_trade.quantity;

  const order_book = {
    asks: [
      { orders: 10 + (microTick % 8), price: parseFloat((current_price + 1.5).toFixed(2)), quantity: 12000 + (microTick % 6) * 3000 },
      { orders: 18 + (microTick % 12), price: parseFloat((current_price + 1.0).toFixed(2)), quantity: 30000 + (microTick % 8) * 4000 },
      { orders: 6 + (microTick % 5), price: parseFloat((current_price + 0.5).toFixed(2)), quantity: 8000 + (microTick % 4) * 2000 }
    ],
    bids: [
      { orders: 8 + (microTick % 5), price: parseFloat((current_price - 0.5).toFixed(2)), quantity: 10000 + (microTick % 4) * 2500 },
      { orders: 20 + (microTick % 10), price: parseFloat((current_price - 1.0).toFixed(2)), quantity: 35000 + (microTick % 6) * 3500 },
      { orders: 7 + (microTick % 6), price: parseFloat((current_price - 1.5).toFixed(2)), quantity: 9000 + (microTick % 5) * 2000 }
    ]
  };

  io.to('microstructure_RELIANCE').emit('microstructure_update', {
    symbol: 'RELIANCE',
    current_price: new_trade.price,
    order_book,
    new_trade
  });
}, 2500);

// Smart Alerts — cycling with live prices
let alertTick = 0;
setInterval(() => {
  const reliancePrice = MarketDataService.getCurrentPrice('RELIANCE');
  const hdfcPrice = MarketDataService.getCurrentPrice('HDFCBANK');
  const alerts = [
    { title: 'Block Deal Detected', message: `1.2M shares of HDFCBANK crossed at ₹${hdfcPrice.toFixed(0)}`, type: 'info' },
    { title: 'Smart Money Buy', message: `Heavy institutional buying observed in RELIANCE at ₹${reliancePrice.toFixed(0)}.`, type: 'buy' },
    { title: 'Volatility Spike', message: 'NIFTY 50 options IV spiked by 12% in the last 5 mins.', type: 'sell' },
    { title: 'Pattern Breakout', message: 'TCS breaking above 200-SMA with strong volume.', type: 'buy' }
  ];
  io.emit('smart_alert', alerts[alertTick % alerts.length]);
  alertTick++;
}, 20000);

} else {
  log.info(`Instance ${INSTANCE_ID} is a follower — broadcast/polling timers run on the leader only.`);
}

// ═══════════════════════════════════════════════════════════
//  GLOBAL ERROR HANDLER
// ═══════════════════════════════════════════════════════════
app.use((err, req, res, next) => {
  log.error('Unhandled Express Error', { method: req.method, url: req.originalUrl, error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal Server Error', detail: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message });
});

// ═══════════════════════════════════════════════════════════
//  START SERVER
// ═══════════════════════════════════════════════════════════
const PORT = process.env.PORT || 8000;
httpServer.listen(PORT, () => {
  log.info(`NexusAI Backend running on port ${PORT}`, {
    env: process.env.NODE_ENV || 'development',
    mongo: process.env.MONGODB_URI ? 'configured' : 'localhost',
    tickers: activeTickers.length
  });
});
