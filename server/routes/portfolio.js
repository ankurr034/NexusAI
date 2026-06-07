import express from 'express';

const router = express.Router();

// Mock initial data for Demo environment
const MOCK_HOLDINGS = [
  { symbol: 'RELIANCE', exchange: 'NSE', segment: 'EQ', isin: 'INE002A01018', qty: 50, avg_price: 2400.0, current_price: 2450.5, current: 122525, invested: 120000, pnl_pct: 2.1, is_authorized: true },
  { symbol: 'TCS', exchange: 'NSE', segment: 'EQ', isin: 'INE467B01029', qty: 20, avg_price: 3500.0, current_price: 3450.0, current: 69000, invested: 70000, pnl_pct: -1.4, is_authorized: false },
  { symbol: 'HDFCBANK', exchange: 'NSE', segment: 'EQ', isin: 'INE040A01034', qty: 100, avg_price: 1500.0, current_price: 1620.0, current: 162000, invested: 150000, pnl_pct: 8.0, is_authorized: true }
];

router.get('/', (req, res) => {
  const invested = MOCK_HOLDINGS.reduce((sum, h) => sum + h.invested, 0);
  const current = MOCK_HOLDINGS.reduce((sum, h) => sum + h.current, 0);
  
  res.json({
    mode: 'Demo',
    summary: {
      invested,
      current,
      pnl: current - invested
    },
    holdings: MOCK_HOLDINGS
  });
});

router.get('/analysis', (req, res) => {
  res.json({
    score: 85,
    diversification: [
      { name: 'Technology', value: 30 },
      { name: 'Energy', value: 45 },
      { name: 'Financials', value: 25 }
    ],
    insights: [
      { type: 'SUCCESS', text: 'HDFCBANK is showing strong upward momentum. Consider holding.' },
      { type: 'WARNING', text: 'TCS is slightly below average cost. Monitor for support levels.' },
      { type: 'INFO', text: 'Portfolio is well diversified across 3 major sectors.' }
    ]
  });
});

router.post('/liquidate', (req, res) => {
  // Mock liquidation
  res.json({ success: true, executed: 2, message: 'Liquidated authorized holdings' });
});

export default router;
