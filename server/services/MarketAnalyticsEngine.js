import { INDEX_CONSTITUENTS, getIndexSymbols } from '../data/indexConstituents.js';
import MarketDataService from './MarketDataService.js';

// ═══════════════════════════════════════════════════════════
//  MARKET ANALYTICS ENGINE — Live Data + Multi-Index
//  Builds D3-treemap-compatible trees from MarketDataService
//  price cache. No random data — everything is real or
//  deterministic-fallback from the singleton price cache.
// ═══════════════════════════════════════════════════════════

export default class MarketAnalyticsEngine {
  constructor() {
    // Stores the last-broadcast change_pct per symbol for delta diffing
    this.lastSentPrices = new Map();

    // Telemetry tracking for Admin Dashboard
    this.metrics = {
      computeLatencyMs: 0,
      updatesPerSecond: 0,
      deltaQueueSize: 0,
      activeWatchers: 0
    };

    this.tickCount = 0;
    this.lastSecond = Date.now();

    // Build a map of symbol -> { name, sector, weight }
    this.symbolRegistry = {};
    for (const [indexKey, indexDef] of Object.entries(INDEX_CONSTITUENTS)) {
      for (const [sectorName, stocks] of Object.entries(indexDef.sectors)) {
        for (const stock of stocks) {
          if (!this.symbolRegistry[stock.symbol]) {
            this.symbolRegistry[stock.symbol] = {
              symbol: stock.symbol,
              name: stock.name,
              sector: sectorName,
              weight: stock.weight
            };
          }
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  Helper: Group and calculate modes dynamically
  // ═══════════════════════════════════════════════════════════
  getSectorsAndBreadthForMode(mode) {
    const allSymbols = Object.keys(this.symbolRegistry);
    const stocksWithData = allSymbols.map(sym => {
      const reg = this.symbolRegistry[sym];
      const cached = MarketDataService.priceCache.get(sym);
      const price = cached?.price ?? 1000;
      const changePct = cached?.changePercent ?? 0;
      const volume = cached?.volume ?? 0;
      return {
        symbol: sym,
        name: reg.name,
        sector: reg.sector,
        weight: reg.weight,
        price,
        changePct,
        volume
      };
    });

    let filteredStocks = [];
    if (mode === 'overbought') {
      filteredStocks = stocksWithData.sort((a, b) => b.changePct - a.changePct).slice(0, 30);
    } else if (mode === 'oversold') {
      filteredStocks = stocksWithData.sort((a, b) => a.changePct - b.changePct).slice(0, 30);
    } else if (mode === 'consolidating') {
      filteredStocks = stocksWithData.sort((a, b) => Math.abs(a.changePct) - Math.abs(b.changePct)).slice(0, 30);
    } else {
      filteredStocks = stocksWithData.slice(0, 30);
    }

    const sectorMap = {};
    let advancers = 0;
    let decliners = 0;
    let unchanged = 0;

    for (const stock of filteredStocks) {
      if (!sectorMap[stock.sector]) {
        sectorMap[stock.sector] = {
          name: stock.sector,
          change_pct: 0,
          changeSum: 0,
          children: []
        };
      }

      const momentumScore = Math.min(100, Math.abs(stock.changePct) * 20);
      const unusualVolume = Math.abs(stock.changePct) > 3;

      sectorMap[stock.sector].children.push({
        name: stock.symbol,
        symbol: stock.symbol,
        fullName: stock.name,
        price: stock.price,
        change_pct: parseFloat(stock.changePct.toFixed(2)),
        volume: stock.volume,
        marketCap: parseFloat((stock.weight * stock.price).toFixed(2)),
        momentumScore: parseFloat(momentumScore.toFixed(1)),
        unusualVolume
      });

      sectorMap[stock.sector].changeSum += stock.changePct;
      if (stock.changePct > 0.01) advancers++;
      else if (stock.changePct < -0.01) decliners++;
      else unchanged++;
    }

    const sectorChildren = [];
    for (const sector of Object.values(sectorMap)) {
      sector.change_pct = parseFloat((sector.changeSum / sector.children.length).toFixed(2));
      delete sector.changeSum;
      sectorChildren.push(sector);
    }

    const breadth = { advancers, decliners, unchanged, total: filteredStocks.length };
    return { sectorChildren, breadth };
  }

  // ═══════════════════════════════════════════════════════════
  //  Full State — D3 treemap tree for the given index
  // ═══════════════════════════════════════════════════════════
  getFullState(indexKeyOrMode = 'NIFTY_50') {
    const isMode = ['overbought', 'oversold', 'consolidating'].includes(indexKeyOrMode);
    
    if (isMode) {
      const { sectorChildren, breadth } = this.getSectorsAndBreadthForMode(indexKeyOrMode);
      const intelligence = this.generateIntelligenceSummary(sectorChildren, breadth);
      return {
        name: indexKeyOrMode.toUpperCase(),
        children: sectorChildren,
        breadth,
        intelligence,
        timestamp: Date.now()
      };
    }

    const indexDef = INDEX_CONSTITUENTS[indexKeyOrMode];
    if (!indexDef) {
      return { name: indexKeyOrMode, children: [], breadth: { advancers: 0, decliners: 0, unchanged: 0, total: 0 }, timestamp: Date.now() };
    }

    let advancers = 0;
    let decliners = 0;
    let unchanged = 0;
    let totalStocks = 0;

    const sectorChildren = [];

    for (const [sectorName, stocks] of Object.entries(indexDef.sectors)) {
      const stockChildren = [];
      let sectorChangeSum = 0;

      for (const stock of stocks) {
        const cached = MarketDataService.priceCache.get(stock.symbol);
        const price = cached?.price ?? 1000;
        const changePct = cached?.changePercent ?? 0;
        const volume = cached?.volume ?? 0;

        const momentumScore = Math.min(100, Math.abs(changePct) * 20);
        const unusualVolume = Math.abs(changePct) > 3;

        stockChildren.push({
          name: stock.symbol,
          symbol: stock.symbol,
          fullName: stock.name,
          price,
          change_pct: parseFloat(changePct.toFixed(2)),
          volume,
          marketCap: parseFloat((stock.weight * price).toFixed(2)),
          momentumScore: parseFloat(momentumScore.toFixed(1)),
          unusualVolume
        });

        sectorChangeSum += changePct;
        totalStocks++;

        if (changePct > 0.01) advancers++;
        else if (changePct < -0.01) decliners++;
        else unchanged++;
      }

      const avgSectorChange = stocks.length > 0 ? sectorChangeSum / stocks.length : 0;

      sectorChildren.push({
        name: sectorName,
        change_pct: parseFloat(avgSectorChange.toFixed(2)),
        children: stockChildren
      });
    }

    const breadth = { advancers, decliners, unchanged, total: totalStocks };
    const intelligence = this.generateIntelligenceSummary(sectorChildren, breadth);

    return {
      name: indexDef.name,
      children: sectorChildren,
      breadth,
      intelligence,
      timestamp: Date.now()
    };
  }

  // ═══════════════════════════════════════════════════════════
  //  Delta Tick — Only changed stocks since last broadcast
  // ═══════════════════════════════════════════════════════════
  computeNextTick(indexKeyOrMode = 'NIFTY_50') {
    const startTime = performance.now();
    this.tickCount++;

    const now = Date.now();
    if (now - this.lastSecond >= 1000) {
      this.metrics.updatesPerSecond = this.tickCount;
      this.tickCount = 0;
      this.lastSecond = now;
    }

    const isMode = ['overbought', 'oversold', 'consolidating'].includes(indexKeyOrMode);

    if (isMode) {
      const { sectorChildren, breadth } = this.getSectorsAndBreadthForMode(indexKeyOrMode);
      
      const updatedStocks = [];
      const updatedSectors = {};

      for (const sector of sectorChildren) {
        let sectorDirty = false;
        for (const stock of sector.children) {
          const lastSent = this.lastSentPrices.get(stock.symbol);
          if (lastSent === undefined || Math.abs(stock.change_pct - lastSent) >= 0.01) {
            updatedStocks.push({
              symbol: stock.symbol,
              price: stock.price,
              change_pct: stock.change_pct,
              momentumScore: stock.momentumScore,
              unusualVolume: stock.unusualVolume
            });
            this.lastSentPrices.set(stock.symbol, stock.change_pct);
            sectorDirty = true;
          }
        }
        if (sectorDirty) {
          updatedSectors[sector.name] = sector.change_pct;
        }
      }

      let intelligence = null;
      if (updatedStocks.length > 0) {
        intelligence = this.generateIntelligenceSummary(sectorChildren, breadth);
      }

      this.metrics.computeLatencyMs = performance.now() - startTime;
      this.metrics.deltaQueueSize = updatedStocks.length;

      return { timestamp: now, updatedStocks, updatedSectors, breadth, intelligence };
    }

    const indexDef = INDEX_CONSTITUENTS[indexKeyOrMode];
    if (!indexDef) {
      this.metrics.computeLatencyMs = performance.now() - startTime;
      return { timestamp: now, updatedStocks: [], updatedSectors: {}, breadth: { advancers: 0, decliners: 0, unchanged: 0, total: 0 }, intelligence: null };
    }

    const updatedStocks = [];
    const updatedSectors = {};
    let advancers = 0;
    let decliners = 0;
    let unchanged = 0;
    let totalStocks = 0;

    for (const [sectorName, stocks] of Object.entries(indexDef.sectors)) {
      let sectorChangeSum = 0;
      let sectorDirty = false;

      for (const stock of stocks) {
        const cached = MarketDataService.priceCache.get(stock.symbol);
        const price = cached?.price ?? 1000;
        const changePct = cached?.changePercent ?? 0;
        totalStocks++;

        if (changePct > 0.01) advancers++;
        else if (changePct < -0.01) decliners++;
        else unchanged++;

        sectorChangeSum += changePct;

        // Only include in delta if change_pct shifted by >= 0.01 since last broadcast
        const lastSent = this.lastSentPrices.get(stock.symbol);
        if (lastSent === undefined || Math.abs(changePct - lastSent) >= 0.01) {
          const momentumScore = Math.min(100, Math.abs(changePct) * 20);
          const unusualVolume = Math.abs(changePct) > 3;

          updatedStocks.push({
            symbol: stock.symbol,
            price,
            change_pct: parseFloat(changePct.toFixed(2)),
            momentumScore: parseFloat(momentumScore.toFixed(1)),
            unusualVolume
          });

          this.lastSentPrices.set(stock.symbol, changePct);
          sectorDirty = true;
        }
      }

      if (sectorDirty) {
        updatedSectors[sectorName] = parseFloat((sectorChangeSum / stocks.length).toFixed(2));
      }
    }

    const breadth = { advancers, decliners, unchanged, total: totalStocks };

    // Generate lightweight intelligence only when there are updates
    let intelligence = null;
    if (updatedStocks.length > 0) {
      // Build minimal sector array for intelligence
      const sectorArr = Object.entries(indexDef.sectors).map(([name, stocks]) => {
        const avg = stocks.reduce((sum, s) => {
          const c = MarketDataService.priceCache.get(s.symbol);
          return sum + (c?.changePercent ?? 0);
        }, 0) / stocks.length;
        return { name, change_pct: avg };
      });
      intelligence = this.generateIntelligenceSummary(sectorArr, breadth);
    }

    this.metrics.computeLatencyMs = performance.now() - startTime;
    this.metrics.deltaQueueSize = updatedStocks.length;

    return { timestamp: now, updatedStocks, updatedSectors, breadth, intelligence };
  }

  // ═══════════════════════════════════════════════════════════
  //  Intelligence Summary — AI-style market narrative
  // ═══════════════════════════════════════════════════════════
  generateIntelligenceSummary(sectors, breadth) {
    const { advancers, decliners, total } = breadth;

    // Compute strongest & weakest sector
    let strongest = { name: 'N/A', change: 0 };
    let weakest = { name: 'N/A', change: 0 };
    let totalChange = 0;
    let sectorCount = 0;

    for (const sector of sectors) {
      const change = sector.change_pct ?? 0;
      totalChange += change;
      sectorCount++;
      if (change > strongest.change) strongest = { name: sector.name, change: parseFloat(change.toFixed(2)) };
      if (change < weakest.change) weakest = { name: sector.name, change: parseFloat(change.toFixed(2)) };
    }

    const avgChange = sectorCount > 0 ? parseFloat((totalChange / sectorCount).toFixed(2)) : 0;

    // Determine overall momentum
    const advancerRatio = total > 0 ? advancers / total : 0.5;
    let momentum;
    if (advancerRatio > 0.6) momentum = 'Bullish';
    else if (advancerRatio < 0.4) momentum = 'Bearish';
    else momentum = 'Sideways';

    // Build summary text from templates
    let summary;
    if (advancerRatio > 0.6) {
      summary = `${advancers}/${total} stocks advancing • ${strongest.name} leading +${Math.abs(strongest.change).toFixed(1)}% • Strong breadth`;
    } else if (advancerRatio < 0.4) {
      summary = `Broad-based selling • ${decliners}/${total} stocks declining • ${weakest.name} weakest at ${weakest.change.toFixed(1)}%`;
    } else {
      summary = `Mixed market breadth • ${advancers} advancing vs ${decliners} declining`;
    }

    // Add sector flavour
    if (strongest.change > 1.5) {
      summary += ` • ${strongest.name} surging`;
    } else if (weakest.change < -1.5) {
      summary += ` • ${weakest.name} under pressure`;
    }

    return {
      summary,
      avgChange,
      strongestSector: strongest,
      weakestSector: weakest,
      momentum
    };
  }

  // ═══════════════════════════════════════════════════════════
  //  Telemetry — Admin Dashboard
  // ═══════════════════════════════════════════════════════════
  getMetrics() {
    return this.metrics;
  }
}
