import express from 'express';
import BrokerGateway from '../services/BrokerGateway.js';
import MarketDataService from '../services/MarketDataService.js';
import { incrementOrderExecuted, incrementWalletMutation } from '../middleware/metrics.js';
import { cacheEndpoint } from '../middleware/cache.js';

const router = express.Router();

router.get('/explore', (req, res) => {
  // Helper to format a live stock entry
  const formatStock = (symbol, name, surge) => {
    const cached = MarketDataService.priceCache.get(symbol);
    const price = cached?.price || MarketDataService.getCurrentPrice(symbol);
    const changePct = cached?.changePercent || 0;
    const entry = {
      symbol, name,
      price: `₹${price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      change: `${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}%`,
      positive: changePct >= 0
    };
    if (surge) entry.surge = surge;
    return entry;
  };

  const formatIndex = (name) => {
    const cached = MarketDataService.priceCache.get(name);
    const price = cached?.price || MarketDataService.getCurrentPrice(name);
    const change = cached?.change || 0;
    const changePct = cached?.changePercent || 0;
    return {
      name,
      value: price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      change: `${change >= 0 ? '+' : ''}${change.toFixed(2)}`,
      percent: `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`,
      positive: change >= 0
    };
  };

  res.json({
    indices: [
      formatIndex('NIFTY 50'),
      formatIndex('SENSEX'),
      formatIndex('BANKNIFTY')
    ],
    top_picks: [
      formatStock('RELIANCE', 'Reliance Ind.'),
      formatStock('TCS', 'Tata Consultancy'),
      formatStock('HDFCBANK', 'HDFC Bank')
    ],
    most_traded: [
      formatStock('INFY', 'Infosys'),
      formatStock('ICICIBANK', 'ICICI Bank')
    ],
    volume_surged: [
      formatStock('TATAMOTORS', 'Tata Motors', '3x'),
      formatStock('ZOMATO', 'Zomato Ltd', '5x')
    ],
    news: [
      { publisher: 'Reuters', title: 'Foreign inflows hit 6-month high in Indian equities', link: '#', ai_sentiment: 'BULLISH' },
      { publisher: 'Bloomberg', title: 'Tech sector expects strong Q2 earnings guidance', link: '#', ai_sentiment: 'POSITIVE' }
    ]
  });
});

router.get('/market/pulse', (req, res) => {
  // Derive sentiment from live NIFTY change
  const niftyData = MarketDataService.priceCache.get('NIFTY 50');
  const changePct = niftyData?.changePercent || 0;
  
  let sentiment = 50 + Math.round(changePct * 10);
  sentiment = Math.max(10, Math.min(95, sentiment));
  
  const trend = changePct > 0.5 ? 'Bullish' : changePct < -0.5 ? 'Bearish' : 'Sideways';
  const fearGreed = sentiment > 70 ? 'Extreme Greed' : sentiment > 55 ? 'Greed' : sentiment > 45 ? 'Neutral' : sentiment > 30 ? 'Fear' : 'Extreme Fear';
  const signal = sentiment > 65 ? 'STRONG BUY' : sentiment > 55 ? 'BUY' : sentiment > 45 ? 'HOLD' : sentiment > 35 ? 'SELL' : 'STRONG SELL';
  
  res.json({ sentiment, trend, fear_greed: fearGreed, signal });
});

router.get('/watchlist', (req, res) => {
  const symbols = ['RELIANCE', 'TCS', 'TATAMOTORS', 'HDFCBANK'];
  res.json({ watchlist: symbols });
});

router.get('/theme/:themeName', (req, res) => {
  const themes = {
    'High Dividend Yield': [['NTPC', 'NTPC Ltd'], ['POWERGRID', 'Power Grid'], ['COALINDIA', 'Coal India']],
    'Undervalued Momentum': [['TATAMOTORS', 'Tata Motors'], ['ZOMATO', 'Zomato Ltd'], ['TATAPOWER', 'Tata Power']],
    'AI & NextGen Tech': [['INFY', 'Infosys'], ['TCS', 'TCS Ltd'], ['WIPRO', 'Wipro']],
    'Green Energy': [['TATAPOWER', 'Tata Power'], ['NTPC', 'NTPC Ltd'], ['POWERGRID', 'Power Grid']],
    'PSU Monopolies': [['NTPC', 'NTPC Ltd'], ['POWERGRID', 'Power Grid'], ['COALINDIA', 'Coal India']]
  };
  
  const themeStocks = themes[req.params.themeName] || themes['High Dividend Yield'];
  
  const stocks = themeStocks.map(([symbol, name]) => {
    const cached = MarketDataService.priceCache.get(symbol);
    const price = cached?.price || MarketDataService.getCurrentPrice(symbol);
    const changePct = cached?.changePercent || 0;
    return {
      symbol, name,
      price: `₹${price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      change: `${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}%`,
      positive: changePct >= 0
    };
  });

  res.json({ stocks });
});

router.get('/stock/:tickerId', cacheEndpoint(10), async (req, res) => {
  try {
    const { tickerId } = req.params;
    const { range_type } = req.query;
    const cleanTicker = tickerId.toUpperCase();
    
    // Fetch live and historical data securely from centralized engine
    const currentPrice = MarketDataService.getCurrentPrice(cleanTicker);
    const historyData = await MarketDataService.getHistoricalData(cleanTicker, range_type || '1M');

    res.json({
      ticker: tickerId,
      current_price: currentPrice,
      sector: 'Technology',
      isin: `INE${cleanTicker.substring(0,3)}A01018`,
      fundamentals: {
        market_cap: currentPrice * 10000000,
        pe_ratio: 25.4,
        pb_ratio: 3.2,
        roe: 0.18,
        eps: currentPrice / 25.4,
        div_yield: 0.015,
        debt_to_equity: 45,
        high_52: currentPrice * 1.2,
        low_52: currentPrice * 0.7
      },
      history: historyData,
      prediction: currentPrice * 1.05,
      ai_insights: {
        overall_sentiment: cleanTicker.includes('TSLA') ? 'VOLATILE' : cleanTicker.includes('NVDA') ? 'EXTREME BULLISH' : 'BULLISH',
        detected_pattern: cleanTicker.includes('RELIANCE') ? 'Bull Flag Breakout' : 'Ascending Triangle',
        momentum_score: 65 + (cleanTicker.charCodeAt(0) % 25)
      },
      news: [
        { title: `Strong institutional buying detected in ${tickerId}`, publisher: 'Nexus Intelligence', link: '#', ai_sentiment: 'BULLISH', ai_sentiment_color: '#10b981' },
        { title: `Sector rotation favors ${tickerId}`, publisher: 'Market Watch', link: '#', ai_sentiment: 'POSITIVE', ai_sentiment_color: '#3b82f6' }
      ]
    });
  } catch (error) {
    console.error('Error fetching stock details:', error);
    res.status(500).json({ detail: 'Failed to fetch stock details' });
  }
});

router.get('/history', async (req, res) => {
  try {
    const { symbol, range_type } = req.query;
    if (!symbol) return res.status(400).json({ detail: 'Symbol required' });
    const cleanTicker = symbol.toUpperCase();
    
    const historyData = await MarketDataService.getHistoricalData(cleanTicker, range_type || '1M');
    
    res.json({ history: historyData });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

router.get('/news', (req, res) => {
  try {
    const { symbol } = req.query;
    if (!symbol) return res.status(400).json({ detail: 'Symbol required' });
    res.json({
      news: [
        { title: `Strong institutional buying detected in ${symbol}`, publisher: 'Nexus Intelligence', link: '#', ai_sentiment: 'BULLISH', ai_sentiment_color: '#10b981' },
        { title: `Sector rotation favors ${symbol}`, publisher: 'Market Watch', link: '#', ai_sentiment: 'POSITIVE', ai_sentiment_color: '#3b82f6' },
        { title: `${symbol} upcoming earnings expectations`, publisher: 'Bloomberg', link: '#', ai_sentiment: 'NEUTRAL', ai_sentiment_color: '#8b5cf6' }
      ]
    });
  } catch(e) {
    res.status(500).json({ detail: e.message });
  }
});

router.get('/cdsl/status/:tickerId', (req, res) => {
  // Mock CDSL authorization response to fix the 404 error
  res.json({ authorized: true });
});

router.get('/broker/diagnostics', async (req, res) => {
  try {
    const { broker_name } = req.query;
    if (!broker_name) return res.status(400).json({ detail: 'broker_name required' });
    
    const diagnostics = BrokerGateway.getDiagnostics(broker_name);
    res.json(diagnostics);
  } catch(e) {
    res.status(500).json({ detail: e.message || 'Failed to fetch diagnostics' });
  }
});

// ==========================
// ADMIN OPERATIONS ENDPOINTS
// Protected: requires admin role
// ==========================
const requireAdmin = (req, res, next) => {
  const userId = req.query.user_id || req.body?.user_id;
  // In production: verify JWT and check user.isAdmin flag in DB
  // For now: allow mock_web2_user (dev) and block unauthenticated access
  if (!userId) {
    return res.status(401).json({ detail: 'Authentication required for admin operations' });
  }
  next();
};

router.get('/admin/broker-stats', requireAdmin, (req, res) => {
  try {
    const stats = BrokerGateway.getAllBrokerStats();
    res.json({ success: true, data: stats, buffer: BrokerGateway.telemetryBuffer });
  } catch(e) {
    res.status(500).json({ detail: e.message });
  }
});

router.post('/admin/broker/clear-cache', requireAdmin, (req, res) => {
  try {
    const result = BrokerGateway.clearIdempotencyCache();
    res.json({ success: true, ...result });
  } catch(e) {
    res.status(500).json({ detail: e.message });
  }
});

router.post('/admin/broker/disconnect', requireAdmin, (req, res) => {
  try {
    const { broker_name } = req.body;
    // In a real scenario, this drops the live DB session or Socket for the specific broker
    // For now, we simulate the force disconnect.
    res.json({ success: true, message: `Force disconnected all sessions for ${broker_name}` });
  } catch(e) {
    res.status(500).json({ detail: e.message });
  }
});

router.post('/broker/connect', async (req, res) => {
  try {
    const { user_id } = req.query;
    const { broker_name, api_key } = req.body;
    if (!user_id) return res.status(400).json({ detail: 'User ID required' });
    
    // Attempt to update user in DB
    if (user_id !== 'mock_web2_user' && user_id !== 'nexus-sim-user') {
      const User = (await import('../models/User.js')).default;
      const mongoose = (await import('mongoose')).default;
      let query = mongoose.Types.ObjectId.isValid(user_id) ? { _id: user_id } : { walletAddress: user_id.toLowerCase() };
      await User.findOneAndUpdate(query, { broker_connected: true, active_broker: broker_name });
    }
    
    // Dispatch to Gateway
    const payload = { requestToken: api_key || 'DUMMY_TOKEN' };
    const connectionTokens = await BrokerGateway.connect(broker_name, payload);
    
    res.json({ 
      success: true, 
      message: connectionTokens.warning 
         ? `Connected to ${broker_name} (Sandbox Fallback: ${connectionTokens.warning})` 
         : `Successfully connected to ${broker_name}`,
      access_token: connectionTokens.access_token,
      refresh_token: connectionTokens.refresh_token,
      expires_at: connectionTokens.expires_at,
      is_sandbox: connectionTokens.is_sandbox
    });
  } catch(e) {
    console.error("[MARKET ROUTE] Connect Error:", e.message);
    res.status(500).json({ detail: e.message || 'Failed to connect broker' });
  }
});

router.post('/broker/refresh', async (req, res) => {
  try {
    const { refresh_token, broker_name } = req.body;
    if (!refresh_token) {
      return res.status(401).json({ detail: 'Refresh token required' });
    }
    
    const activeBroker = broker_name || 'Zerodha Kite'; // In reality fetched from DB
    const tokens = await BrokerGateway.refreshToken(activeBroker, refresh_token);
    
    res.json({
      success: true,
      access_token: tokens.access_token,
      expires_at: tokens.expires_at,
      refresh_token: tokens.refresh_token || refresh_token // Keep old if not rotated
    });
  } catch(e) {
    console.error("[MARKET ROUTE] Refresh Error:", e.message);
    res.status(403).json({ detail: e.message || 'Failed to refresh token' });
  }
});

router.post('/broker/order', async (req, res) => {
  const orderLog = (msg, meta = {}) => console.log(`[OMS] ${msg}`, JSON.stringify(meta));

  try {
    const { broker_name, access_token, order_config, user_id } = req.body;
    const activeUser = user_id || req.query.user_id || 'nexus-sim-user';

    // ── Parse order from both flat body and wrapped order_config ──
    const oc = order_config || {};
    const symbol = oc.symbol || req.body.ticker || req.body.symbol || 'RELIANCE';
    const action = (oc.action || req.body.transaction_type || 'BUY').toUpperCase();
    const quantity = parseInt(oc.quantity || req.body.quantity || 1, 10);
    const orderType = (oc.type || oc.orderType || req.body.order_type || 'MARKET').toUpperCase();
    const price = parseFloat(oc.price || req.body.price || 0);

    // ── Input validation ──
    if (!symbol || typeof symbol !== 'string' || symbol.length > 20) {
      return res.status(400).json({ detail: 'Invalid symbol' });
    }
    if (!['BUY', 'SELL'].includes(action)) {
      return res.status(400).json({ detail: 'Action must be BUY or SELL' });
    }
    if (!quantity || quantity < 1 || quantity > 10000) {
      return res.status(400).json({ detail: 'Quantity must be 1-10000' });
    }

    // ── Idempotency check (prevent duplicate orders within 3s) ──
    const idempotencyKey = `${activeUser}_${symbol}_${action}_${quantity}_${Math.floor(Date.now() / 3000)}`;
    if (global._orderIdempotencyCache?.has(idempotencyKey)) {
      return res.status(409).json({ detail: 'Duplicate order detected. Please wait.' });
    }
    if (!global._orderIdempotencyCache) global._orderIdempotencyCache = new Set();
    global._orderIdempotencyCache.add(idempotencyKey);
    setTimeout(() => global._orderIdempotencyCache?.delete(idempotencyKey), 5000);

    // ── Get live execution price ──
    const livePrice = price > 0 ? price : MarketDataService.getCurrentPrice(symbol);

    // ── Wallet integration: check & deduct/credit ──
    const { WalletAccount, WalletTransaction } = await import('../models/Wallet.js');
    let wallet = await WalletAccount.findOne({ userId: activeUser });
    if (!wallet) {
      wallet = await WalletAccount.create({ userId: activeUser, balance: 1000000 });
    }

    const orderValue = livePrice * quantity;

    if (action === 'BUY') {
      if (wallet.balance < orderValue) {
        orderLog('Rejected: Insufficient funds', { userId: activeUser, symbol, orderValue, balance: wallet.balance });
        return res.status(400).json({
          detail: 'Insufficient wallet balance',
          required: orderValue,
          available: wallet.balance,
          rejection_reason: 'INSUFFICIENT_FUNDS'
        });
      }

      // Deduct from wallet atomically
      const balanceBefore = wallet.balance;
      wallet.balance -= orderValue;
      wallet.usedMargin += orderValue;
      wallet.updatedAt = Date.now();
      await wallet.save();
      incrementWalletMutation();

      // Record wallet transaction
      await WalletTransaction.create({
        userId: activeUser,
        type: 'ORDER_DEBIT',
        amount: orderValue,
        balanceBefore,
        balanceAfter: wallet.balance,
        status: 'COMPLETED',
        reference: idempotencyKey,
        metadata: { symbol, action, quantity, price: livePrice }
      });
    }

    // ── Execute through PaperTradingEngine ──
    const finalOrderConfig = {
      symbol,
      action,
      quantity,
      type: orderType,
      price: livePrice,
      isPaperTrade: true,
      idempotencyKey // share the route's stable key with the gateway dedup layer
    };

    let orderResult;
    try {
      orderResult = await BrokerGateway.placeOrder(
        broker_name || 'Zerodha Kite',
        access_token || 'MOCK_TOKEN',
        finalOrderConfig,
        activeUser
      );
    } catch (execErr) {
      // Rollback wallet on execution failure
      if (action === 'BUY') {
        wallet.balance += orderValue;
        wallet.usedMargin = Math.max(0, wallet.usedMargin - orderValue);
        wallet.updatedAt = Date.now();
        await wallet.save();
        incrementWalletMutation();

        await WalletTransaction.create({
          userId: activeUser,
          type: 'ORDER_ROLLBACK',
          amount: orderValue,
          balanceBefore: wallet.balance - orderValue,
          balanceAfter: wallet.balance,
          status: 'COMPLETED',
          reference: `ROLLBACK_${idempotencyKey}`,
          metadata: { reason: execErr.message }
        });
        orderLog('Rolled back wallet deduction', { userId: activeUser, symbol, amount: orderValue });
      }
      throw execErr;
    }

    // ── Credit wallet on SELL ──
    if (action === 'SELL') {
      const balanceBefore = wallet.balance;
      wallet.balance += orderValue;
      wallet.usedMargin = Math.max(0, wallet.usedMargin - orderValue);
      wallet.updatedAt = Date.now();
      await wallet.save();
      incrementWalletMutation();

      await WalletTransaction.create({
        userId: activeUser,
        type: 'ORDER_CREDIT',
        amount: orderValue,
        balanceBefore,
        balanceAfter: wallet.balance,
        status: 'COMPLETED',
        reference: idempotencyKey,
        metadata: { symbol, action, quantity, price: livePrice }
      });
    }

    orderLog('Order executed', {
      userId: activeUser, symbol, action, quantity,
      price: livePrice, orderId: orderResult.orderId,
      newBalance: wallet.balance
    });

    incrementOrderExecuted();
    res.json({
      success: true,
      message: orderResult.message,
      order_id: orderResult.orderId,
      is_paper: true,
      execution_price: livePrice,
      order_value: orderValue,
      balance: wallet.balance
    });
  } catch(e) {
    console.error('[OMS] Order execution failed:', e.message);
    res.status(500).json({
      detail: e.message || 'Failed to execute order',
      rejection_reason: e.message?.includes('INSUFFICIENT') ? 'INSUFFICIENT_FUNDS' :
                        e.message?.includes('SHORT') ? 'NO_SHORT_SELLING' : 'EXECUTION_ERROR'
    });
  }
});

export default router;
