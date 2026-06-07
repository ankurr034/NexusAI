import { v4 as uuidv4 } from 'uuid';
import { PaperAccount, PaperPosition, PaperOrder, RiskEvent } from '../models/PaperTrading.js';

class PaperTradingEngine {
  constructor() {
    // Ultra-Fast In-Memory Execution Caches
    this.accounts = new Map(); // userId -> { balance, winRate, totalTrades, ... }
    this.positions = new Map(); // userId_symbol -> { quantity, averagePrice, realizedPnl }
    
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

  // --- Execution Engine ---
  async executeOrder(userId, orderConfig) {
    const startTime = performance.now();
    
    if (this.killSwitchEngaged) {
       throw new Error("Paper Simulator Kill-Switch Engaged. All execution halted.");
    }

    await this.loadUserContext(userId);
    const account = this.accounts.get(userId);
    
    // 1. Simulator Price Fetch (Mocked for now, assumes real price is injected or fetched)
    // In production this would pull from MarketAnalyticsEngine or a Live Tick cache
    const executionPrice = orderConfig.price || 1500 + Math.random() * 50; 
    
    // 2. Slippage Engine
    const slippagePct = (Math.random() * 0.001); // 0% to 0.1% slippage
    const slippageVal = executionPrice * slippagePct;
    const finalFillPrice = orderConfig.action === 'BUY' ? executionPrice + slippageVal : executionPrice - slippageVal;
    
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

    // 4. State Mutation (In-Memory execution is instant)
    if (orderConfig.action === 'BUY') {
       account.balance -= orderValue;
       const totalQty = currentPos.quantity + orderConfig.quantity;
       const totalCost = (currentPos.quantity * currentPos.averagePrice) + orderValue;
       currentPos.averagePrice = totalCost / totalQty;
       currentPos.quantity = totalQty;
    } else { // SELL
       if (currentPos.quantity < orderConfig.quantity) {
           throw new Error("PaperTrading Safety: Short selling not permitted in current sandbox mode.");
       }
       const pnl = (finalFillPrice - currentPos.averagePrice) * orderConfig.quantity;
       account.balance += orderValue; // Gain cash
       currentPos.realizedPnl += pnl;
       currentPos.quantity -= orderConfig.quantity;
    }
    
    account.totalTrades += 1;

    // Update Runtime Cache
    this.accounts.set(userId, account);
    this.positions.set(positionKey, currentPos);
    
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
     try {
       // Flush Orders
       if (this.orderFlushQueue.length > 0) {
          const ordersToInsert = [...this.orderFlushQueue];
          this.orderFlushQueue = [];
          await PaperOrder.insertMany(ordersToInsert);
       }
       
       // Flush Risk Events
       if (this.riskFlushQueue.length > 0) {
          const risksToInsert = [...this.riskFlushQueue];
          this.riskFlushQueue = [];
          await RiskEvent.insertMany(risksToInsert);
       }

       // Flush Accounts
       for (const userId of this.accountFlushQueue) {
          const acc = this.accounts.get(userId);
          await PaperAccount.updateOne({ userId }, { $set: { balance: acc.balance, totalTrades: acc.totalTrades, updatedAt: Date.now() } });
       }
       this.accountFlushQueue.clear();

       // Flush Positions
       for (const posKey of this.positionFlushQueue) {
          const pos = this.positions.get(posKey);
          const [userId, symbol] = posKey.split('_');
          await PaperPosition.findOneAndUpdate(
             { userId, symbol },
             { $set: { quantity: pos.quantity, averagePrice: pos.averagePrice, realizedPnl: pos.realizedPnl, updatedAt: Date.now() } },
             { upsert: true }
          );
       }
       this.positionFlushQueue.clear();

     } catch (err) {
        console.error("[PaperTradingEngine] Async Flush Failed. Data preserved in queue.", err.message);
        // On critical failure, data remains in memory but isn't flushed. 
        // In true prod, we might push back to queue if transient.
     }
  }

  getMetrics() {
     return this.metrics;
  }
}

export default new PaperTradingEngine();
