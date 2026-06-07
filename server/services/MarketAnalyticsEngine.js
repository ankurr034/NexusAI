export default class MarketAnalyticsEngine {
  constructor() {
    this.state = {
      timestamp: Date.now(),
      sectors: this.initializeSectors(),
      breadth: { advancers: 0, decliners: 0, unchanged: 50, total: 50 }
    };
    
    // Telemetry tracking for Admin Dashboard
    this.metrics = {
      computeLatencyMs: 0,
      updatesPerSecond: 0,
      deltaQueueSize: 0,
      activeWatchers: 0
    };
    
    this.tickCount = 0;
    this.lastSecond = Date.now();
  }

  initializeSectors() {
    // Generate initial NIFTY 50 structure mapped to D3 Treemap format
    const sectors = {
      'Financial Services': ['HDFCBANK', 'ICICIBANK', 'SBIN', 'KOTAKBANK', 'AXISBANK', 'BAJFINANCE', 'BAJAJFINSV'],
      'IT': ['TCS', 'INFY', 'HCLTECH', 'WIPRO', 'TECHM', 'LTIM'],
      'Oil & Gas': ['RELIANCE', 'ONGC', 'BPCL', 'COALINDIA'],
      'Automobile': ['TATAMOTORS', 'M&M', 'MARUTI', 'BAJAJ-AUTO', 'EICHERMOT', 'HEROMOTOCO'],
      'FMCG': ['ITC', 'HUL', 'NESTLEIND', 'BRITANNIA', 'TATACONSUM'],
      'Pharma': ['SUNPHARMA', 'CIPLA', 'DRREDDY', 'DIVISLAB', 'APOLLOHOSP'],
      'Metals': ['TATASTEEL', 'HINDALCO', 'JSWSTEEL'],
      'Construction': ['LT', 'ULTRACEMCO', 'GRASIM']
    };

    const rootSectors = [];
    
    for (const [sectorName, symbols] of Object.entries(sectors)) {
      const stocks = symbols.map(sym => ({
        name: sym,
        symbol: sym,
        price: 1000 + Math.random() * 2000,
        change_pct: (Math.random() * 4) - 2, // -2% to +2%
        volume: 1000000 + Math.random() * 5000000,
        marketCap: 50000 + Math.random() * 200000,
        momentumScore: Math.random() * 100,
        unusualVolume: Math.random() > 0.8, // 20% chance of unusual volume spike
        aiInsight: this.generateMockInsight(sym)
      }));
      
      const sectorChange = stocks.reduce((acc, s) => acc + s.change_pct, 0) / stocks.length;
      
      rootSectors.push({
        name: sectorName,
        change_pct: sectorChange,
        children: stocks
      });
    }

    return rootSectors;
  }

  generateMockInsight(symbol) {
    const insights = [
      "Bullish MACD crossover detected on 15m timeframe.",
      "Unusual options sweep observed at ATM strikes.",
      "Approaching major daily resistance zone.",
      "Strong sector rotation flowing into this asset.",
      "Algorithmic block trades detected near VWAP."
    ];
    return insights[Math.floor(Math.random() * insights.length)];
  }

  // Simulates incoming ticks from BrokerGateway and generates Delta patch
  computeNextTick() {
    const startTime = performance.now();
    this.tickCount++;
    
    // Update TPS metric
    const now = Date.now();
    if (now - this.lastSecond >= 1000) {
      this.metrics.updatesPerSecond = this.tickCount;
      this.tickCount = 0;
      this.lastSecond = now;
    }

    let advancers = 0;
    let decliners = 0;
    let unchanged = 0;
    
    // We will generate a Delta object containing only changed nodes
    const delta = {
      timestamp: now,
      updatedStocks: [],
      updatedSectors: {}
    };

    // Randomly update 5-10 stocks per tick to simulate real streaming delta
    const numUpdates = Math.floor(Math.random() * 6) + 5;
    
    for (let i = 0; i < numUpdates; i++) {
      const sectorIdx = Math.floor(Math.random() * this.state.sectors.length);
      const sector = this.state.sectors[sectorIdx];
      const stockIdx = Math.floor(Math.random() * sector.children.length);
      const stock = sector.children[stockIdx];
      
      // Mutate
      const jump = (Math.random() * 0.4) - 0.2; // -0.2% to +0.2%
      stock.change_pct += jump;
      stock.price = stock.price * (1 + (jump / 100));
      stock.momentumScore = Math.min(100, Math.max(0, stock.momentumScore + (jump * 10)));
      stock.unusualVolume = Math.random() > 0.95; // Rare flash spike
      
      if (stock.change_pct > 0) advancers++;
      else if (stock.change_pct < 0) decliners++;
      else unchanged++;

      delta.updatedStocks.push({
        symbol: stock.symbol,
        price: stock.price,
        change_pct: stock.change_pct,
        momentumScore: stock.momentumScore,
        unusualVolume: stock.unusualVolume
      });
      
      // Flag sector for recalculation
      delta.updatedSectors[sector.name] = sector;
    }

    // Recompute flagged sectors
    for (const [sName, sectorRef] of Object.entries(delta.updatedSectors)) {
       sectorRef.change_pct = sectorRef.children.reduce((acc, s) => acc + s.change_pct, 0) / sectorRef.children.length;
       delta.updatedSectors[sName] = sectorRef.change_pct; // Only send sector pct in delta
    }

    this.state.breadth = { advancers, decliners, unchanged, total: 50 };
    delta.breadth = this.state.breadth;

    this.metrics.computeLatencyMs = performance.now() - startTime;
    return delta;
  }

  getFullState() {
    return {
      name: "NIFTY 50",
      children: this.state.sectors,
      breadth: this.state.breadth,
      timestamp: this.state.timestamp
    };
  }

  getMetrics() {
    return this.metrics;
  }
}
