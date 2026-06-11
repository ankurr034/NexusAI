import ZerodhaAdapter from './adapters/ZerodhaAdapter.js';
import UpstoxAdapter from './adapters/UpstoxAdapter.js';
import AngelOneAdapter from './adapters/AngelOneAdapter.js';
import MockBrokerAdapter from './adapters/MockBrokerAdapter.js';
import PaperTradingEngine from './PaperTradingEngine.js';

/**
 * BrokerGateway
 * Centralized abstraction layer. Routes frontend requests to the correct 
 * broker-specific adapter so the frontend remains entirely broker-agnostic.
 */
class BrokerGateway {
  constructor() {
    this.adapters = {
      'Zerodha Kite': new ZerodhaAdapter({}),
      'Upstox Pro': new UpstoxAdapter({}),
      'Groww': new MockBrokerAdapter({}),
      'Angel One': new AngelOneAdapter({})
    };
    
    // Default fallback adapter for unrecognized names
    this.fallbackAdapter = new MockBrokerAdapter({});
    
    // Order Idempotency Cache
    this.orderCache = new Set();

    // Operational Telemetry Buffer
    this.telemetryBuffer = {
       'Zerodha Kite': { 1: [], 5: [], 60: [] }, // Minutes
       'Upstox Pro': { 1: [], 5: [], 60: [] },
       'Groww': { 1: [], 5: [], 60: [] },
       'Angel One': { 1: [], 5: [], 60: [] }
    };
    
    // Start background metrics roller
    this.warnedAdapters = new Set();
    setInterval(() => this.rollMetrics(), 60000); // Roll every minute
  }

  getAdapter(brokerName) {
    const adapter = this.adapters[brokerName] || this.fallbackAdapter;
    // Check if adapter has required credentials configured
    if (adapter.isConfigured && !adapter.isConfigured()) {
       if (!this.warnedAdapters.has(brokerName)) {
          console.warn(`[BrokerGateway] ${brokerName} is not fully configured. Falling back to Mock Sandbox.`);
          this.warnedAdapters.add(brokerName);
       }
       return this.fallbackAdapter;
    }
    return adapter;
  }

  computeHealthScore(metrics, isSandbox) {
    if (isSandbox) return 50; // Degraded but functioning
    if (!metrics) return 100; // Mock usually
    let score = 100;
    
    // Penalize high latency
    if (metrics.latencyMs > 1000) score -= 15;
    else if (metrics.latencyMs > 500) score -= 5;
    
    // Penalize queued requests heavily
    if (metrics.queueSize > 10) score -= 20;
    else if (metrics.queueSize > 5) score -= 10;
    
    // Penalize active cooldown state
    if (metrics.isCoolingDown) score -= 30;
    
    // Penalize retry volume
    if (metrics.retryCount > 5) score -= 10;
    
    return Math.max(0, score);
  }

  getDiagnostics(brokerName) {
    const adapter = this.getAdapter(brokerName);
    const isSandbox = adapter instanceof MockBrokerAdapter;
    const metrics = typeof adapter.getMetrics === 'function' ? adapter.getMetrics() : null;
    const healthScore = this.computeHealthScore(metrics, isSandbox);
    
    return {
      activeAdapter: brokerName,
      isSandbox,
      healthScore,
      capabilities: adapter.getCapabilities(),
      metrics: metrics || { requestCount: 0, retryCount: 0, queueSize: 0, isCoolingDown: false, latencyMs: 0 },
      timestamp: Date.now()
    };
  }

  getAllBrokerStats() {
    return Object.keys(this.adapters).map(name => this.getDiagnostics(name));
  }

  rollMetrics() {
     // Snapshot current state into historical buffer
     const stats = this.getAllBrokerStats();
     const now = Date.now();
     for (const stat of stats) {
        const broker = stat.activeAdapter;
        const snapshot = { timestamp: now, health: stat.healthScore, latency: stat.metrics.latencyMs, queue: stat.metrics.queueSize };
        
        // Push to 1m (we record every 1m here, so it's a 60m buffer, actually let's just keep 60 points)
        if (!this.telemetryBuffer[broker]) continue;
        
        this.telemetryBuffer[broker][1].push(snapshot);
        if (this.telemetryBuffer[broker][1].length > 60) this.telemetryBuffer[broker][1].shift();
     }
  }

  async connect(brokerName, payload) {
    try {
      const adapter = this.getAdapter(brokerName);
      const res = await adapter.connect(payload);
      res.is_sandbox = adapter instanceof MockBrokerAdapter;
      return res;
    } catch (err) {
      console.error(`[BrokerGateway] Connection failed for ${brokerName}. Degrading to Sandbox:`, err.message);
      const fallbackRes = await this.fallbackAdapter.connect(payload);
      fallbackRes.is_sandbox = true;
      fallbackRes.warning = err.message;
      return fallbackRes;
    }
  }

  async refreshToken(brokerName, refreshToken) {
    return await this.getAdapter(brokerName).refreshToken(refreshToken);
  }

  async getProfile(brokerName, accessToken) {
    return await this.getAdapter(brokerName).getProfile(accessToken);
  }

  async getHoldings(brokerName, accessToken) {
    return await this.getAdapter(brokerName).getHoldings(accessToken);
  }

  async placeOrder(brokerName, accessToken, orderConfig, userId = 'nexus-sim-user') {
    // 1. Paper Trading Simulator Intercept
    if (orderConfig.isPaperTrade) {
       return await PaperTradingEngine.executeOrder(userId, orderConfig);
    }

    // 2. Pre-flight Safety Validation
    if (!orderConfig.symbol || typeof orderConfig.symbol !== 'string') {
      throw new Error('BrokerGateway Safety: Missing or invalid symbol');
    }
    if (!orderConfig.quantity || orderConfig.quantity <= 0) {
      throw new Error('BrokerGateway Safety: Quantity must be greater than 0');
    }
    if (!['BUY', 'SELL'].includes(orderConfig.action)) {
      throw new Error('BrokerGateway Safety: Invalid order action');
    }

    // 2. Strict Idempotency Check
    // Use a STABLE key — never embed Date.now(), or every order is unique and
    // the duplicate check can never fire. Prefer a client/route-supplied key;
    // otherwise derive one from the order's identifying fields.
    const idempotencyKey = orderConfig.idempotencyKey
      || `${accessToken}_${orderConfig.symbol}_${orderConfig.action}_${orderConfig.quantity}`;
    if (this.orderCache.has(idempotencyKey)) {
      throw new Error('BrokerGateway Safety: Duplicate order detected. Rejected to prevent multi-submission.');
    }
    
    try {
      this.orderCache.add(idempotencyKey);
      const adapter = this.getAdapter(brokerName);
      return await adapter.placeOrder(accessToken, orderConfig);
    } catch (err) {
      console.error(`[BrokerGateway] Order placement failed on ${brokerName}:`, err.message);
      throw err;
    } finally {
      // Clear cache key after 5 seconds to allow natural repeat orders
      setTimeout(() => this.orderCache.delete(idempotencyKey), 5000);
    }
  }

  // Admin Controls
  clearIdempotencyCache() {
    const count = this.orderCache.size;
    this.orderCache.clear();
    return { message: `Cleared ${count} idempotency locks.` };
  }
  
  // WebSocket Supervisor methods
  async getMarketFeedConfig(brokerName, accessToken) {
      const adapter = this.getAdapter(brokerName);
      if (typeof adapter.getMarketFeedConfig === 'function') {
         return await adapter.getMarketFeedConfig(accessToken);
      }
      return null;
  }
}

export default new BrokerGateway();
