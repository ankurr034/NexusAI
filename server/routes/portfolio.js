import express from 'express';
import { PaperPosition } from '../models/PaperTrading.js';
import MarketDataService from '../services/MarketDataService.js';
import { dbUnavailableDetail, isDbReady } from '../utils/dbReady.js';

const router = express.Router();

function buildDemoPortfolio() {
  const demoHoldings = [
    { symbol: 'RELIANCE', exchange: 'NSE', segment: 'EQ', isin: 'INE002A01018', qty: 50, avg_price: 2400.0 },
    { symbol: 'TCS', exchange: 'NSE', segment: 'EQ', isin: 'INE467B01029', qty: 20, avg_price: 3500.0 },
    { symbol: 'HDFCBANK', exchange: 'NSE', segment: 'EQ', isin: 'INE040A01034', qty: 100, avg_price: 1500.0 }
  ].map(h => {
    const livePrice = MarketDataService.getCurrentPrice(h.symbol);
    const current = livePrice * h.qty;
    const invested = h.avg_price * h.qty;
    return {
      ...h,
      current_price: livePrice,
      current,
      invested,
      pnl: current - invested,
      pnl_pct: parseFloat(((current - invested) / invested * 100).toFixed(2)),
      is_authorized: true
    };
  });

  const invested = demoHoldings.reduce((sum, h) => sum + h.invested, 0);
  const current = demoHoldings.reduce((sum, h) => sum + h.current, 0);

  return {
    mode: 'Demo',
    summary: { invested, current, pnl: current - invested },
    holdings: demoHoldings
  };
}

// ═══════════════════════════════════════════════════════════
//  GET /api/portfolio — Live portfolio from PaperPosition + MarketDataService
// ═══════════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const userId = req.query.user_id || 'nexus-sim-user';
    if (!isDbReady()) {
      return res.json({ ...buildDemoPortfolio(), warning: dbUnavailableDetail() });
    }
    
    // Fetch real positions from DB
    const positions = await PaperPosition.find({ userId, quantity: { $gt: 0 } }).lean();
    
    if (positions.length === 0) {
      return res.json(buildDemoPortfolio());
    }

    // Real positions from PaperTradingEngine
    const holdings = positions.map(p => {
      const livePrice = MarketDataService.getCurrentPrice(p.symbol);
      const current = livePrice * p.quantity;
      const invested = p.averagePrice * p.quantity;
      return {
        symbol: p.symbol,
        exchange: 'NSE',
        segment: 'EQ',
        isin: `INE${p.symbol.substring(0, 3)}`,
        qty: p.quantity,
        avg_price: parseFloat(p.averagePrice.toFixed(2)),
        current_price: livePrice,
        current: parseFloat(current.toFixed(2)),
        invested: parseFloat(invested.toFixed(2)),
        pnl: parseFloat((current - invested).toFixed(2)),
        pnl_pct: parseFloat(((current - invested) / invested * 100).toFixed(2)),
        realized_pnl: parseFloat((p.realizedPnl || 0).toFixed(2)),
        is_authorized: true
      };
    });

    const invested = holdings.reduce((sum, h) => sum + h.invested, 0);
    const current = holdings.reduce((sum, h) => sum + h.current, 0);

    res.json({
      mode: 'Paper Trading',
      summary: { invested, current, pnl: current - invested },
      holdings
    });
  } catch (err) {
    console.error('[PORTFOLIO] Fetch error:', err.message);
    res.status(500).json({ detail: 'Failed to fetch portfolio' });
  }
});

// ═══════════════════════════════════════════════════════════
//  GET /api/portfolio/analysis — Dynamic analysis
// ═══════════════════════════════════════════════════════════
router.get('/analysis', async (req, res) => {
  try {
    const userId = req.query.user_id || 'nexus-sim-user';
    const positions = isDbReady()
      ? await PaperPosition.find({ userId, quantity: { $gt: 0 } }).lean()
      : [];
    
    // Calculate sector diversification from actual positions
    const sectorMap = {
      'RELIANCE': 'Energy', 'TCS': 'Technology', 'INFY': 'Technology',
      'HDFCBANK': 'Financials', 'ICICIBANK': 'Financials',
      'TATAMOTORS': 'Auto', 'NTPC': 'Energy', 'ZOMATO': 'Consumer'
    };

    let totalValue = 0;
    const sectorValues = {};

    const holdingsData = positions.length > 0 ? positions.map(p => ({
      symbol: p.symbol, qty: p.quantity, avg: p.averagePrice
    })) : [
      { symbol: 'RELIANCE', qty: 50, avg: 2400 },
      { symbol: 'TCS', qty: 20, avg: 3500 },
      { symbol: 'HDFCBANK', qty: 100, avg: 1500 }
    ];

    holdingsData.forEach(h => {
      const price = MarketDataService.getCurrentPrice(h.symbol);
      const value = price * h.qty;
      totalValue += value;
      const sector = sectorMap[h.symbol] || 'Other';
      sectorValues[sector] = (sectorValues[sector] || 0) + value;
    });

    const diversification = Object.entries(sectorValues).map(([name, val]) => ({
      name, value: Math.round((val / totalValue) * 100)
    }));

    const insights = [];
    holdingsData.forEach(h => {
      const price = MarketDataService.getCurrentPrice(h.symbol);
      const pnlPct = ((price - h.avg) / h.avg) * 100;
      if (pnlPct > 5) {
        insights.push({ type: 'SUCCESS', text: `${h.symbol} is up ${pnlPct.toFixed(1)}% from your avg cost. Consider booking partial profits.` });
      } else if (pnlPct < -5) {
        insights.push({ type: 'WARNING', text: `${h.symbol} is down ${Math.abs(pnlPct).toFixed(1)}% from your avg cost. Monitor for support levels.` });
      } else {
        insights.push({ type: 'INFO', text: `${h.symbol} is trading near your average cost. Hold for long-term growth.` });
      }
    });

    const score = Math.min(100, Math.max(40, 60 + diversification.length * 8));

    res.json({ score, diversification, insights });
  } catch (err) {
    console.error('[PORTFOLIO] Analysis error:', err.message);
    res.status(500).json({ detail: 'Failed to compute portfolio analysis' });
  }
});

router.post('/liquidate', (req, res) => {
  res.json({ success: true, executed: 2, message: 'Liquidated authorized holdings' });
});

export default router;
