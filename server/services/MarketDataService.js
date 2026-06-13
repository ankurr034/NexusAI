import YahooFinance from 'yahoo-finance2';
import { createLogger } from '../utils/logger.js';
import { invalidateCachePattern, redisClient, isRedisReady } from '../middleware/cache.js';
import { getAllUniqueSymbols, generateFallbackPrices } from '../data/indexConstituents.js';

const log = createLogger('MarketData');
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// ═══════════════════════════════════════════════════════════
//  FALLBACK PRICES — Last-known-good baseline
//  (generated from the central indexConstituents registry)
// ═══════════════════════════════════════════════════════════
const FALLBACK_PRICES = generateFallbackPrices();

// Valid NSE symbols for validation (union of fallback keys + registry symbols)
const KNOWN_SYMBOLS = new Set([...Object.keys(FALLBACK_PRICES), ...getAllUniqueSymbols()]);

// Map UI tickers to Yahoo Finance symbols
const getYahooSymbol = (ticker) => {
  if (ticker === 'NIFTY 50') return '^NSEI';
  if (ticker === 'SENSEX') return '^BSESN';
  if (ticker === 'BANKNIFTY') return '^NSEBANK';
  if (ticker.includes('.NS') || ticker.includes('.BO') || ticker.includes('^') || ticker.includes('=')) return ticker;
  return `${ticker}.NS`;
};

class MarketDataService {
  constructor() {
    this.priceCache = new Map();
    this.historyCache = new Map();
    this.pollingInterval = null;

    // ── Provider health tracking ──
    this.providerHealth = {
      consecutiveFailures: 0,
      lastSuccessTime: Date.now(),
      lastFailureTime: 0,
      totalFetches: 0,
      totalFailures: 0,
      rateLimitedUntil: 0
    };

    // ── Rate limit backoff config ──
    this.backoff = {
      baseInterval: 5000,   // 5s normal
      maxInterval: 60000,   // 60s max backoff
      currentInterval: 5000
    };

    // Initialize with fallback prices
    Object.keys(FALLBACK_PRICES).forEach(symbol => {
      this.priceCache.set(symbol, {
        price: FALLBACK_PRICES[symbol],
        change: 0,
        changePercent: 0,
        previousClose: FALLBACK_PRICES[symbol],
        lastUpdated: Date.now(),
        source: 'fallback'
      });
    });
  }

  // ═══════════════════════════════════════════════════════════
  //  Market Hours Awareness (IST = UTC+5:30)
  // ═══════════════════════════════════════════════════════════
  isMarketOpen() {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const ist = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60000);
    const day = ist.getDay(); // 0=Sun, 6=Sat
    const hours = ist.getHours();
    const minutes = ist.getMinutes();
    const totalMinutes = hours * 60 + minutes;

    // NSE: Mon-Fri, 9:15 AM to 3:30 PM IST
    if (day === 0 || day === 6) return false;
    if (totalMinutes < 555 || totalMinutes > 930) return false; // 9:15=555, 15:30=930
    return true;
  }

  // ═══════════════════════════════════════════════════════════
  //  Symbol Validation
  // ═══════════════════════════════════════════════════════════
  validateSymbol(symbol) {
    if (!symbol || typeof symbol !== 'string') return false;
    if (symbol.length > 30) return false;
    if (KNOWN_SYMBOLS.has(symbol)) return true;
    // Allow any alphanumeric symbol up to 15 chars
    return /^[A-Z0-9&\s]{1,15}$/.test(symbol);
  }

  // ═══════════════════════════════════════════════════════════
  //  Stale Price Detection
  // ═══════════════════════════════════════════════════════════
  isPriceStale(symbol, maxAgeMs = 300000) { // Default: 5 minutes
    const cached = this.priceCache.get(symbol);
    if (!cached) return true;
    return (Date.now() - cached.lastUpdated) > maxAgeMs;
  }

  getPriceAge(symbol) {
    const cached = this.priceCache.get(symbol);
    if (!cached) return Infinity;
    return Date.now() - cached.lastUpdated;
  }

  // ═══════════════════════════════════════════════════════════
  //  Rate Limit Handling with Exponential Backoff
  // ═══════════════════════════════════════════════════════════
  shouldSkipFetch() {
    if (Date.now() < this.providerHealth.rateLimitedUntil) {
      return true;
    }
    return false;
  }

  onFetchSuccess() {
    this.providerHealth.consecutiveFailures = 0;
    this.providerHealth.lastSuccessTime = Date.now();
    this.providerHealth.totalFetches++;
    // Reset backoff on success
    this.backoff.currentInterval = this.backoff.baseInterval;
  }

  onFetchFailure(error) {
    this.providerHealth.consecutiveFailures++;
    this.providerHealth.lastFailureTime = Date.now();
    this.providerHealth.totalFailures++;
    this.providerHealth.totalFetches++;

    // Detect rate limiting (HTTP 429 or too many failures)
    if (error?.message?.includes('429') || error?.message?.includes('Too Many Requests')) {
      this.providerHealth.rateLimitedUntil = Date.now() + 60000; // Back off 60s
      log.warn('Yahoo Finance rate limited. Backing off for 60s.');
    }

    // Exponential backoff
    this.backoff.currentInterval = Math.min(
      this.backoff.maxInterval,
      this.backoff.currentInterval * 1.5
    );
  }

  // ═══════════════════════════════════════════════════════════
  //  Core: Fetch Live Quotes from Yahoo Finance
  // ═══════════════════════════════════════════════════════════
  async fetchLiveQuotes(symbols) {
    if (this.shouldSkipFetch()) {
      return; // Rate-limited, skip
    }

    try {
      const yahooSymbols = symbols.map(getYahooSymbol);
      if (yahooSymbols.length === 0) return;

      const quotes = await yahooFinance.quote(yahooSymbols);
      const updatesForPubSub = [];

      quotes.forEach((q) => {
        let originalSymbol = q.symbol;
        const origIdx = yahooSymbols.indexOf(q.symbol);
        if (origIdx >= 0) {
          originalSymbol = symbols[origIdx];
        } else {
          if (q.symbol === '^NSEI') originalSymbol = 'NIFTY 50';
          else if (q.symbol === '^BSESN') originalSymbol = 'SENSEX';
          else if (q.symbol === '^NSEBANK') originalSymbol = 'BANKNIFTY';
          else originalSymbol = q.symbol.replace('.NS', '');
        }

        const currentPrice = q.regularMarketPrice || q.price || this.priceCache.get(originalSymbol)?.price || FALLBACK_PRICES[originalSymbol] || 1000;
        const previousClose = q.regularMarketPreviousClose || currentPrice;
        const change = currentPrice - previousClose;
        const changePercent = previousClose ? (change / previousClose) * 100 : 0;

        const priceData = {
          price: currentPrice,
          change,
          changePercent,
          previousClose,
          lastUpdated: Date.now(),
          source: 'yahoo',
          marketState: q.marketState || 'UNKNOWN'
        };

        this.priceCache.set(originalSymbol, priceData);

        // Populate Redis cache and pub/sub message list
        if (redisClient && isRedisReady) {
          redisClient.set(`market_price:${originalSymbol}`, JSON.stringify(priceData), { EX: 86400 }).catch(() => {});
          updatesForPubSub.push({ symbol: originalSymbol, ...priceData });
        }

        invalidateCachePattern(`cache:/api/stock/${originalSymbol}*`).catch(() => {});
      });

      // Publish quotes batch to Redis pub/sub channel
      if (updatesForPubSub.length > 0 && redisClient && isRedisReady) {
        redisClient.publish('market_data_updates', JSON.stringify(updatesForPubSub)).catch(() => {});
      }

      if (quotes.length > 0) {
        invalidateCachePattern('cache:/api/heatmap*').catch(() => {});
      }

      this.onFetchSuccess();
    } catch (err) {
      this.onFetchFailure(err);
      log.warn(`Live quote fetch failed: ${err.message}. Retaining cached prices. Backoff: ${Math.round(this.backoff.currentInterval / 1000)}s`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  Polling Engine — Smart scheduling based on market hours
  // ═══════════════════════════════════════════════════════════
  startPolling(symbols, intervalMs = 5000) {
    if (this.pollingInterval) clearInterval(this.pollingInterval);

    // Initial fetch immediately
    this.fetchLiveQuotes(symbols);

    this.pollingInterval = setInterval(() => {
      // During market hours: normal polling
      // Outside market hours: reduced polling (30s) to conserve API quota
      const effectiveInterval = this.isMarketOpen() ? intervalMs : 30000;

      // If we're in reduced mode and haven't waited enough, skip
      if (!this.isMarketOpen()) {
        const lastFetch = this.providerHealth.lastSuccessTime;
        if (Date.now() - lastFetch < 25000) return; // Wait at least 25s outside hours
      }

      this.fetchLiveQuotes(symbols);
    }, intervalMs);

    log.info(`Market data polling started for ${symbols.length} symbols at ${intervalMs}ms interval`);
  }

  // ═══════════════════════════════════════════════════════════
  //  Pub/Sub Rehydration Helper
  // ═══════════════════════════════════════════════════════════
  updatePriceFromPubSub(symbol, priceData) {
    this.priceCache.set(symbol, priceData);
  }

  // ═══════════════════════════════════════════════════════════
  //  Price Access
  // ═══════════════════════════════════════════════════════════
  getCurrentPrice(symbol) {
    const cached = this.priceCache.get(symbol);
    if (cached) return cached.price;

    // Asynchronous rehydration from Redis if running in distributed mode
    if (redisClient && isRedisReady) {
      redisClient.get(`market_price:${symbol}`).then(val => {
        if (val) {
          try {
            this.priceCache.set(symbol, JSON.parse(val));
          } catch {}
        }
      }).catch(() => {});
    } else {
      // Trigger async fetch for unknown symbols in fallback local mode
      this.fetchLiveQuotes([symbol]).catch(() => {});
    }
    return FALLBACK_PRICES[symbol] || 1000.0;
  }

  getLivePricesForBroadcast(symbols) {
    return symbols.map(symbol => {
      const data = this.priceCache.get(symbol);
      if (!data) return null;

      return {
        symbol,
        value: data.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        change: (data.change >= 0 ? '+' : '') + data.change.toFixed(2),
        pct: (data.changePercent >= 0 ? '+' : '') + data.changePercent.toFixed(2) + '%',
        up: data.change >= 0,
        stale: this.isPriceStale(symbol)
      };
    }).filter(Boolean);
  }

  // ═══════════════════════════════════════════════════════════
  //  Provider Health Status
  // ═══════════════════════════════════════════════════════════
  getHealthStatus() {
    const allPrices = Array.from(this.priceCache.entries());
    const stalePrices = allPrices.filter(([sym]) => this.isPriceStale(sym));

    return {
      provider: 'yahoo-finance2',
      status: this.providerHealth.consecutiveFailures === 0 ? 'healthy' :
              this.providerHealth.consecutiveFailures < 3 ? 'degraded' : 'unhealthy',
      consecutiveFailures: this.providerHealth.consecutiveFailures,
      totalFetches: this.providerHealth.totalFetches,
      totalFailures: this.providerHealth.totalFailures,
      successRate: this.providerHealth.totalFetches > 0
        ? `${((1 - this.providerHealth.totalFailures / this.providerHealth.totalFetches) * 100).toFixed(1)}%`
        : 'N/A',
      lastSuccess: new Date(this.providerHealth.lastSuccessTime).toISOString(),
      lastFailure: this.providerHealth.lastFailureTime > 0
        ? new Date(this.providerHealth.lastFailureTime).toISOString() : null,
      rateLimited: Date.now() < this.providerHealth.rateLimitedUntil,
      backoffInterval: `${Math.round(this.backoff.currentInterval / 1000)}s`,
      marketOpen: this.isMarketOpen(),
      cachedSymbols: this.priceCache.size,
      staleSymbols: stalePrices.length
    };
  }

  // ═══════════════════════════════════════════════════════════
  //  Historical Data with Enhanced Caching
  // ═══════════════════════════════════════════════════════════
  async getHistoricalData(symbol, rangeType = '1M') {
    const cacheKey = `${symbol}_${rangeType}`;
    const cached = this.historyCache.get(cacheKey);

    // Smart cache TTL based on range
    const cacheTTL = rangeType === '1D' ? 5 * 60 * 1000 : // 5 min for intraday
                     rangeType === '1W' ? 15 * 60 * 1000 : // 15 min for weekly
                     30 * 60 * 1000; // 30 min for monthly+

    if (cached && (Date.now() - cached.timestamp < cacheTTL)) {
      return cached.data;
    }

    try {
      const yahooSymbol = getYahooSymbol(symbol);
      const now = new Date();
      const period1 = new Date();

      let interval = '1d';

      if (rangeType === '1D') {
        period1.setDate(now.getDate() - 1);
        interval = '5m';
      } else if (rangeType === '1W') {
        period1.setDate(now.getDate() - 7);
        interval = '15m';
      } else if (rangeType === '1M') {
        period1.setMonth(now.getMonth() - 1);
      } else if (rangeType === '3M') {
        period1.setMonth(now.getMonth() - 3);
      } else if (rangeType === '6M') {
        period1.setMonth(now.getMonth() - 6);
      } else if (rangeType === '1Y') {
        period1.setFullYear(now.getFullYear() - 1);
      } else if (rangeType === '5Y') {
        period1.setFullYear(now.getFullYear() - 5);
        interval = '1wk';
      } else {
        period1.setMonth(now.getMonth() - 1);
      }

      const result = await yahooFinance.historical(yahooSymbol, {
        period1: period1.toISOString().split('T')[0],
        period2: new Date().toISOString().split('T')[0],
        interval
      });

      const formattedData = result.map(d => ({
        date: d.date.toISOString().split('T')[0],
        open: parseFloat(d.open?.toFixed(2) || 0),
        high: parseFloat(d.high?.toFixed(2) || 0),
        low: parseFloat(d.low?.toFixed(2) || 0),
        close: parseFloat(d.close?.toFixed(2) || 0),
        volume: d.volume || 0
      })).filter(d => d.close > 0);

      // Ensure last candle matches live price
      if (formattedData.length > 0) {
        formattedData[formattedData.length - 1].close = this.getCurrentPrice(symbol);
      }

      this.historyCache.set(cacheKey, { data: formattedData, timestamp: Date.now() });
      return formattedData;
    } catch (err) {
      log.warn(`History fetch failed for ${symbol}/${rangeType}: ${err.message}`);

      // Deterministic fallback using Brownian bridge from current price
      const currentPrice = this.getCurrentPrice(symbol);
      const historyData = [];
      const count = { '1D': 78, '1W': 35, '1M': 30, '3M': 90, '6M': 180, '1Y': 365, '5Y': 260 }[rangeType] || 30;
      let priceIter = currentPrice * 0.85;
      const step = (currentPrice - priceIter) / count;

      for (let i = count; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        // Deterministic walk: trend toward current price with symbol-seeded variation
        const seed = (symbol.charCodeAt(0) + i * 7) % 100;
        const noise = ((seed / 100) - 0.45) * currentPrice * 0.015;
        priceIter = priceIter + step + noise;

        historyData.push({
          date: d.toISOString().split('T')[0],
          close: parseFloat(priceIter.toFixed(2)),
          open: parseFloat((priceIter - currentPrice * 0.005).toFixed(2)),
          high: parseFloat((priceIter + currentPrice * 0.008).toFixed(2)),
          low: parseFloat((priceIter - currentPrice * 0.012).toFixed(2)),
          volume: 500000 + (seed * 10000)
        });
      }

      // Last candle = exact live price
      if (historyData.length > 0) {
        historyData[historyData.length - 1].close = currentPrice;
      }

      return historyData;
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  Cache Cleanup — Evict old history cache entries
  // ═══════════════════════════════════════════════════════════
  cleanupHistoryCache() {
    const maxAge = 60 * 60 * 1000; // 1 hour
    let cleaned = 0;
    for (const [key, val] of this.historyCache) {
      if (Date.now() - val.timestamp > maxAge) {
        this.historyCache.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) log.info(`Cleaned ${cleaned} stale history cache entries`);
  }

  // ═══════════════════════════════════════════════════════════
  //  Batched Quote Fetching — Rate-limit safe for large symbol lists
  // ═══════════════════════════════════════════════════════════
  async fetchLiveQuotesBatched(allSymbols, batchSize = 25) {
    const batches = [];
    for (let i = 0; i < allSymbols.length; i += batchSize) {
      batches.push(allSymbols.slice(i, i + batchSize));
    }
    for (let b = 0; b < batches.length; b++) {
      await this.fetchLiveQuotes(batches[b]);
      // Small delay between batches to avoid Yahoo Finance rate limits
      if (b < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  //  Static: All Heatmap Symbols
  // ═══════════════════════════════════════════════════════════
  static getAllHeatmapSymbols() {
    return getAllUniqueSymbols();
  }
}

// Singleton instance
const instance = new MarketDataService();

// Schedule history cache cleanup every 30 minutes
setInterval(() => instance.cleanupHistoryCache(), 30 * 60 * 1000);

// Re-export the static method on the singleton for convenience
export { MarketDataService };
export default instance;
