import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';

// Routes
import predictionRoutes from './routes/predictions.js';
import authRoutes from './routes/auth.js';
import premiumRoutes from './routes/premium.js';
import aiRoutes from './routes/ai.js';
import portfolioRoutes from './routes/portfolio.js';
import marketRoutes from './routes/market.js';
import premiumFeaturesRoutes from './routes/premiumFeatures.js';
import profileRoutes from './routes/profile.js';
import BrokerGateway from './services/BrokerGateway.js';
import MarketAnalyticsEngine from './services/MarketAnalyticsEngine.js';
import PaperTradingEngine from './services/PaperTradingEngine.js';

dotenv.config();

// Startup Environment Validation
const requiredEnvs = ['JWT_SECRET', 'BROKER_API_KEY', 'BROKER_SECRET', 'REDIRECT_URI', 'CLIENT_ID', 'CLIENT_SECRET', 'WS_URL'];
requiredEnvs.forEach(env => {
  if (!process.env[env]) {
    console.warn(`[WARNING] Missing ENV variable: ${env}. Broker integration may fail in production.`);
  }
});

// Global Process Error Handlers
process.on('uncaughtException', (err) => {
  console.error('CRITICAL: Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

const app = express();
const analyticsEngine = new MarketAnalyticsEngine();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Routes setup
app.use('/api/predictions', predictionRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/premium', premiumRoutes);
app.use('/api/copilot', aiRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api', marketRoutes);
app.use('/api', premiumFeaturesRoutes);

// Analytics REST Endpoint
app.get('/api/heatmap', (req, res) => {
  res.json(analyticsEngine.getFullState());
});

// Database Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nexusai')
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// WebSocket setup
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('subscribe_stock', (ticker) => {
    socket.join(`stock_${ticker}`);
    console.log(`Socket ${socket.id} joined stock_${ticker}`);
  });

  socket.on('unsubscribe_stock', (ticker) => {
    socket.leave(`stock_${ticker}`);
    console.log(`Socket ${socket.id} left stock_${ticker}`);
  });

  socket.on('subscribe_microstructure', (ticker) => {
    socket.join(`microstructure_${ticker}`);
    console.log(`Socket ${socket.id} joined microstructure_${ticker}`);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
  
  socket.on('join_admin', () => {
    socket.join('admin_telemetry');
    console.log(`[SOCKET] ${socket.id} joined admin_telemetry`);
  });

  socket.on('join_heatmap', () => {
    socket.join('market_heatmap');
    console.log(`[SOCKET] ${socket.id} joined market_heatmap`);
  });
});

// Broadcast live Admin Telemetry every 3 seconds
setInterval(() => {
  const stats = BrokerGateway.getAllBrokerStats();
  
  // Inject Analytics Load metrics into admin telemetry
  const analyticsMetrics = analyticsEngine.getMetrics();
  
  // Inject Paper Simulator metrics
  const simulatorMetrics = PaperTradingEngine.getMetrics();
  
  io.to('admin_telemetry').emit('admin_telemetry_update', {
     timestamp: Date.now(),
     stats: stats,
     analyticsLoad: analyticsMetrics,
     simulatorLoad: simulatorMetrics
  });
}, 3000);

// Broadcast Market Heatmap Deltas every 500ms
setInterval(() => {
  const delta = analyticsEngine.computeNextTick();
  if (delta.updatedStocks.length > 0) {
     io.to('market_heatmap').emit('market_heatmap_update', delta);
  }
}, 500);

// Broadcast stock updates
const activeTickers = ['NIFTY 50', 'SENSEX', 'BANKNIFTY', 'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK'];
const basePrices = { 'NIFTY 50': 22450, 'SENSEX': 73876, 'BANKNIFTY': 47683, 'RELIANCE': 2980, 'TCS': 3842, 'HDFCBANK': 1500, 'INFY': 1400, 'ICICIBANK': 1100 };

setInterval(() => {
  const updates = activeTickers.map(ticker => {
    const basePrice = basePrices[ticker];
    const variance = (Math.random() - 0.5) * (basePrice * 0.001); // 0.1% volatility
    const newPrice = basePrice + variance;
    basePrices[ticker] = newPrice; // store new base
    const change = newPrice - 22400; // Mock calculation
    const pct = (change / 22400) * 100;
    return {
      symbol: ticker,
      value: newPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 }),
      change: (variance >= 0 ? '+' : '') + variance.toFixed(2),
      pct: (variance >= 0 ? '+' : '') + pct.toFixed(2) + '%',
      up: variance >= 0
    };
  });
  
  io.emit('price_update', updates);
  io.emit('market_update', { timestamp: Date.now(), status: 'Live' });
}, 1000); // 1-second ticks for high frequency

// Simulate HFT Microstructure Updates
setInterval(() => {
  const current_price = 2950;
  const isBuy = Math.random() > 0.5;
  const new_trade = {
    time: new Date().toLocaleTimeString(),
    side: isBuy ? 'BUY' : 'SELL',
    price: current_price + (Math.random() > 0.5 ? 0.5 : -0.5),
    quantity: Math.floor(Math.random() * 2000) + 100,
    value: 0,
    is_block: Math.random() > 0.9
  };
  new_trade.value = new_trade.price * new_trade.quantity;
  
  const order_book = {
    asks: [
      { orders: Math.floor(Math.random() * 20) + 5, price: current_price + 1.5, quantity: Math.floor(Math.random() * 30000) + 5000 },
      { orders: Math.floor(Math.random() * 30) + 10, price: current_price + 1.0, quantity: Math.floor(Math.random() * 50000) + 10000 },
      { orders: Math.floor(Math.random() * 15) + 3, price: current_price + 0.5, quantity: Math.floor(Math.random() * 20000) + 2000 }
    ],
    bids: [
      { orders: Math.floor(Math.random() * 15) + 3, price: current_price - 0.5, quantity: Math.floor(Math.random() * 20000) + 2000 },
      { orders: Math.floor(Math.random() * 30) + 10, price: current_price - 1.0, quantity: Math.floor(Math.random() * 50000) + 10000 },
      { orders: Math.floor(Math.random() * 20) + 5, price: current_price - 1.5, quantity: Math.floor(Math.random() * 30000) + 5000 }
    ]
  };

  io.to('microstructure_RELIANCE').emit('microstructure_update', {
    symbol: 'RELIANCE',
    current_price: new_trade.price,
    order_book,
    new_trade
  });
}, 2500);

// Simulate AI Smart Alerts
setInterval(() => {
  const alerts = [
    { title: 'Block Deal Detected', message: '1.2M shares of HDFCBANK crossed at ₹1495', type: 'info' },
    { title: 'Smart Money Buy', message: 'Heavy institutional buying observed in RELIANCE.', type: 'buy' },
    { title: 'Volatility Spike', message: 'NIFTY 50 options IV spiked by 12% in the last 5 mins.', type: 'sell' },
    { title: 'Pattern Breakout', message: 'TCS breaking above 200-SMA with strong volume.', type: 'buy' }
  ];
  const randomAlert = alerts[Math.floor(Math.random() * alerts.length)];
  io.emit('smart_alert', randomAlert);
}, 20000);

// Global Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Express Error:', err);
  res.status(500).json({ error: 'Internal Server Error', detail: err.message });
});

const PORT = process.env.PORT || 8000;
httpServer.listen(PORT, () => {
  console.log(`Backend Server running on port ${PORT}`);
});
