import { v4 as uuidv4 } from 'uuid';
import { PaperAccount, PaperPosition, PaperOrder, RiskEvent } from '../models/PaperTrading.js';
import MarketSession from '../utils/MarketSession.js';
import MarketDataService from './MarketDataService.js';
import { applySlippage, applyBuy, applySell } from './ledgerMath.js';

class PaperTradingEngine {
  constructor() {
    // Ultra-Fast In-Memory Execution Caches
    this.accounts = new Map(); // userId -> { balance, winRate, totalTrades, ... }
    this.positions = new Map(); // userId_symbol -> { quantity, averagePrice, realizedPnl }

    // Per-user execution mutex so two concurrent orders for the same user
    // can never interleave around an `await` and read a stale balance.
    this.userLocks = new Map(); // userId -> Promise
    
    // Async Flush Queues
    this.orderFlushQueue = [];
    this.positionFlushQueue = new Set();
    this.accountFlushQueue = new Set();
    this.riskFlushQueue = [];

    // Telemetry
    this.metrics = {
       simulatedTPS: 0,
       executionLatency: 0,
       riskViolations: 0,
       activePaperTraders: 0
    };
    
    this.tickCount = 0;
    this.lastSecond = Date.now();
    this.killSwitchEngaged = false;

    // Start Async DB Flush Loop
    setInterval(() => this.flushToDB(), 5000); // Flush every 5 seconds
  }

  // --- Runtime Cache Initialization ---
  async loadUserContext(userId) {
     if (this.accounts.has(userId)) return;

     let account = await PaperAccount.findOne({ userId });
     if (!account) {
        account = await PaperAccount.create({ userId, balance: 1000000 }); // 10L starting capital
     }
     
     this.accounts.set(userId, {
        balance: account.balance,
        totalTrades: account.totalTrades || 0
     });
     
     const positions = await PaperPosition.find({ userId });
     for (const pos of positions) {
        this.positions.set(`${userId}_${pos.symbol}`, {
           quantity: pos.quantity,
           averagePrice: pos.averagePrice,
           realizedPnl: pos.realizedPnl
        });
     }
     this.metrics.activePaperTraders = this.accounts.size;
  }

  // --- Per-user serialization mutex ---
  async withUserLock(userId, fn) {
    // Wait for any in-flight order for this user to finish.
    while (this.userLocks.get(userId)) {
      await this.userLocks.get(userId).catch(() => {});
    }
    let release;
    const lock = new Promise((r) => { release = r; });
    this.userLocks.set(userId, lock);
    try {
      return await fn();
    } finally {
      this.userLocks.delete(userId);
      release();
    }
  }

  // --- Execution Engine (public entry — serialized per user) ---
  async executeOrder(userId, orderConfig) {
    return this.withUserLock(userId, () => this._executeOrderInternal(userId, orderConfig));
  }

  async _executeOrderInternal(userId, orderConfig) {
    const startTime = performance.now();
    
    if (this.killSwitchEngaged) {
       throw new Error("Paper Simulator Kill-Switch Engaged. All execution halted.");
    }

    const session = MarketSession.getSessionStatus();
    if (!session.isMarketOpen) {
       this.triggerRiskEvent(userId, 'MARKET_CLOSED', `Order rejected. Market is currently ${session.status}.`);
       throw new Error(`PaperTrading Safety: Market is currently ${session.status}. Cannot execute order.`);
    }

    await this.loadUserContext(userId);
    const account = this.accounts.get(userId);
    
    // 1. Simulator Price Fetch - NOW ACCURATE
    // Pull from authoritative centralized MarketDataService cache
    const executionPrice = orderConfig.price || MarketDataService.getCurrentPrice(orderConfig.symbol); 
    
    // 2. Slippage Engine
    const slippagePct = (Math.random() * 0.001); // 0% to 0.1% slippage
    const { fillPrice: finalFillPrice, slippageVal } = applySlippage(executionPrice, orderConfig.action, slippagePct);

    const orderValue = finalFillPrice * orderConfig.quantity;

    // 3. Risk Engine Guards
    if (orderConfig.action === 'BUY' && account.balance < orderValue) {
       this.triggerRiskEvent(userId, 'INSUFFICIENT_FUNDS', `Order value ₹${orderValue.toFixed(2)} exceeds balance ₹${account.balance.toFixed(2)}`);
       throw new Error(`PaperTrading Safety: Insufficient funds. Balance: ₹${account.balance.toFixed(2)}`);
    }

    // Max Position Sizing (e.g., no single stock > 25% of initial 10L capital = 2.5L)
    const positionKey = `${userId}_${orderConfig.symbol}`;
    const currentPos = this.positions.get(positionKey) || { quantity: 0, averagePrice: 0, realizedPnl: 0 };

    if (orderConfig.action === 'BUY') {
       const newExposure = (currentPos.quantity + orderConfig.quantity) * finalFillPrice;
       if (newExposure > 250000) {
           this.triggerRiskEvent(userId, 'MAX_POSITION_SIZE_EXCEEDED', `Exposure ₹${newExposure.toFixed(2)} exceeds 25% limit.`);
           throw new Error("PaperTrading Safety: Max position size (2.5L) exceeded.");
       }
    }

    // 4. State Mutation (pure ledger math — in-memory execution is instant)
    let updatedPos;
    if (orderConfig.action === 'BUY') {
       const { position, cashDelta } = applyBuy(currentPos, orderConfig.quantity, finalFillPrice);
       account.balance += cashDelta; // cashDelta is negative
       updatedPos = position;
    } else { // SELL
       if (currentPos.quantity < orderConfig.quantity) {
           throw new Error("PaperTrading Safety: Short selling not permitted in current sandbox mode.");
       }
       const { position, cashDelta } = applySell(currentPos, orderConfig.quantity, finalFillPrice);
       account.balance += cashDelta; // cashDelta is positive (cash in)
       updatedPos = position;
    }

    account.totalTrades += 1;

    // Update Runtime Cache
    this.accounts.set(userId, account);
    this.positions.set(positionKey, updatedPos);
    
    // 5. Queue for DB Flush
    const simulatedOrderId = `PAPER_${uuidv4().split('-')[0].toUpperCase()}`;
    const orderDoc = {
       userId,
       orderId: simulatedOrderId,
       symbol: orderConfig.symbol,
       action: orderConfig.action,
       quantity: orderConfig.quantity,
       orderType: orderConfig.type || 'MARKET',
       status: 'FILLED',
       fillPrice: finalFillPrice,
       slippage: slippageVal,
       createdAt: Date.now()
    };
    
    this.orderFlushQueue.push(orderDoc);
    this.accountFlushQueue.add(userId);
    this.positionFlushQueue.add(positionKey);

    // Update Telemetry
    this.tickCount++;
    const now = Date.now();
    if (now - this.lastSecond >= 1000) {
      this.metrics.simulatedTPS = this.tickCount;
      this.tickCount = 0;
      this.lastSecond = now;
    }
    this.metrics.executionLatency = performance.now() - startTime;

    return {
       orderId: simulatedOrderId,
       status: 'FILLED',
       message: `Simulated order filled instantly at ₹${finalFillPrice.toFixed(2)}`,
       is_paper: true
    };
  }

  // --- Risk Engine Helpers ---
  triggerRiskEvent(userId, type, message) {
    this.metrics.riskViolations++;
    this.riskFlushQueue.push({ userId, eventType: type, message, createdAt: Date.now() });
    console.warn(`[PaperTrading Risk] ${type} for User ${userId}: ${message}`);
  }

  engageKillSwitch(state) {
     this.killSwitchEngaged = state;
     return { success: true, message: `Simulator Kill Switch: ${state ? 'ENGAGED' : 'DISENGAGED'}` };
  }

  // --- Async Persistence Pipeline ---
  async flushToDB() {
     // Orders: drain, attempt, and RE-QUEUE on failure so a transient DB
     // error never silently loses trades (the original code dropped them).
     if (this.orderFlushQueue.length > 0) {
        const ordersToInsert = this.orderFlushQueue.splice(0, this.orderFlushQueue.length);
        try {
           await PaperOrder.insertMany(ordersToInsert, { ordered: false });
        } catch (err) {
           this.orderFlushQueue.unshift(...ordersToInsert);
           console.error('[PaperTradingEngine] Order flush failed — re-queued', ordersToInsert.length, 'orders.', err.message);
        }
     }

     // Risk events: re-queue on failure too.
     if (this.riskFlushQueue.length > 0) {
        const risksToInsert = this.riskFlushQueue.splice(0, this.riskFlushQueue.length);
        try {
           await RiskEvent.insertMany(risksToInsert, { ordered: false });
        } catch (err) {
           this.riskFlushQueue.unshift(...risksToInsert);
           console.error('[PaperTradingEngine] Risk flush failed — re-queued.', err.message);
        }
     }

     // Accounts: keep the userId queued if its write fails.
     for (const userId of [...this.accountFlushQueue]) {
        const acc = this.accounts.get(userId);
        if (!acc) { this.accountFlushQueue.delete(userId); continue; }
        try {
           await PaperAccount.updateOne(
              { userId },
              { $set: { balance: acc.balance, totalTrades: acc.totalTrades, updatedAt: Date.now() } },
              { upsert: true }
           );
           this.accountFlushQueue.delete(userId);
        } catch (err) {
           console.error(`[PaperTradingEngine] Account flush failed for ${userId} — will retry.`, err.message);
        }
     }

     // Positions: keep the key queued if its write fails.
     for (const posKey of [...this.positionFlushQueue]) {
        const pos = this.positions.get(posKey);
        if (!pos) { this.positionFlushQueue.delete(posKey); continue; }
        const sepIdx = posKey.indexOf('_');
        const userId = posKey.slice(0, sepIdx);
        const symbol = posKey.slice(sepIdx + 1);
        try {
           await PaperPosition.findOneAndUpdate(
              { userId, symbol },
              { $set: { quantity: pos.quantity, averagePrice: pos.averagePrice, realizedPnl: pos.realizedPnl, updatedAt: Date.now() } },
              { upsert: true }
           );
           this.positionFlushQueue.delete(posKey);
        } catch (err) {
           console.error(`[PaperTradingEngine] Position flush failed for ${posKey} — will retry.`, err.message);
        }
     }
  }

  getMetrics() {
     return this.metrics;
  }
}

export default new PaperTradingEngine();
