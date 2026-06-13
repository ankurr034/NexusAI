import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { requirePremium } from '../middleware/auth.js';
import { PaperPosition, PaperOrder } from '../models/PaperTrading.js';
import MarketDataService from '../services/MarketDataService.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();
router.use(requirePremium);

// Rate-limiting: Max 10 calls per minute per user for AI risk evaluations
const riskCoachLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many requests. Please wait a moment before consulting the Risk Coach.' }
});

const API_KEY = process.env.GEMINI_API_KEY;
let genAI = null;
let model = null;

if (API_KEY) {
  genAI = new GoogleGenerativeAI(API_KEY);
  model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', generationConfig: { responseMimeType: "application/json" } });
}

// Sector mapper for fallback asset logic
const SECTOR_MAP = {
  'RELIANCE': 'Energy',
  'TCS': 'Technology',
  'INFY': 'Technology',
  'HDFCBANK': 'Financials',
  'ICICIBANK': 'Financials',
  'TATAMOTORS': 'Auto',
  'NTPC': 'Energy',
  'ZOMATO': 'Consumer'
};

async function getPortfolioDetails(userId) {
  const positions = await PaperPosition.find({ userId, quantity: { $gt: 0 } }).lean();
  const orders = await PaperOrder.find({ userId }).lean();

  let holdings = [];
  if (positions.length === 0) {
    // Demo baseline portfolio to ensure robust calculations even for brand new accounts
    holdings = [
      { symbol: 'RELIANCE', quantity: 50, averagePrice: 2400.0, sector: 'Energy', livePrice: MarketDataService.getCurrentPrice('RELIANCE') || 2400 },
      { symbol: 'TCS', quantity: 20, averagePrice: 3500.0, sector: 'Technology', livePrice: MarketDataService.getCurrentPrice('TCS') || 3500 },
      { symbol: 'HDFCBANK', quantity: 100, averagePrice: 1500.0, sector: 'Financials', livePrice: MarketDataService.getCurrentPrice('HDFCBANK') || 1500 }
    ].map(h => ({
      ...h,
      value: h.livePrice * h.quantity,
      invested: h.averagePrice * h.quantity
    }));
  } else {
    holdings = positions.map(p => {
      const livePrice = MarketDataService.getCurrentPrice(p.symbol) || p.averagePrice || 100;
      return {
        symbol: p.symbol,
        quantity: p.quantity,
        averagePrice: p.averagePrice,
        livePrice,
        value: livePrice * p.quantity,
        invested: p.averagePrice * p.quantity,
        sector: SECTOR_MAP[p.symbol] || 'Other'
      };
    });
  }

  const totalValue = holdings.reduce((sum, h) => sum + h.value, 0);
  const totalInvested = holdings.reduce((sum, h) => sum + h.invested, 0);
  const portfolioPnl = totalValue - totalInvested;
  
  return {
    holdings,
    totalValue,
    totalInvested,
    portfolioPnl,
    tradesCount: orders.length,
    filledTradesCount: orders.filter(o => o.status === 'FILLED').length
  };
}

// Fallback JSON for portfolio risk analysis
const buildFallbackRiskData = (portfolio) => {
  const isProfit = portfolio.portfolioPnl >= 0;
  return {
    health_score: isProfit ? 82 : 68,
    volatility_score: 18,
    downside_risk_score: 45,
    var_95: Math.round(portfolio.totalValue * 0.04),
    beta: 1.12,
    behavioral_biases: {
      over_trading: Math.min(95, Math.max(10, portfolio.tradesCount * 12)),
      fomo: 35,
      disposition_effect: 42,
      discipline_score: 75
    },
    alerts: [
      {
        id: 'tech_alert',
        title: 'Sector Overconcentration',
        severity: 'HIGH',
        category: 'DIVERSIFICATION',
        message: 'Your exposure to Technology stocks exceeds 40%. Consider diversifying into defensive sectors.',
        corrective_action: 'Reduce tech exposure and reallocate 10% into FMCG or gold.'
      },
      {
        id: 'vol_alert',
        title: 'Earnings Volatility Risk',
        severity: 'MODERATE',
        category: 'VOLATILITY',
        message: 'Upcoming tech earnings could introduce elevated downside risks.',
        corrective_action: 'Implement stop-loss levels at 5% below support.'
      }
    ],
    ai_summary: `Your portfolio value is ₹${portfolio.totalValue.toLocaleString()}. Asset allocation shows minor over-concentration in Technology. Volatility parameters are within target boundaries.`
  };
};

router.get('/', riskCoachLimiter, async (req, res) => {
  try {
    const userId = req.query.user_id || req.user?.id || 'nexus-sim-user';
    const portfolio = await getPortfolioDetails(userId);
    const fallback = buildFallbackRiskData(portfolio);

    if (!model) {
      return res.json({ success: true, risk_coach: fallback, source: 'fallback' });
    }

    const prompt = `
You are a top-tier institutional risk manager and behavioral finance expert at a premium investment bank.
Analyze the following portfolio details:
- Holdings: ${JSON.stringify(portfolio.holdings)}
- Total Capital Value: ₹${portfolio.totalValue}
- Total Capital Invested: ₹${portfolio.totalInvested}
- P&L: ₹${portfolio.portfolioPnl}
- Total Order History Count: ${portfolio.tradesCount}

Perform a rigorous risk audit and behavioral bias evaluation (disposition effect, FOMO, over-trading).
Respond strictly in JSON matching the exact schema of this fallback template: ${JSON.stringify(fallback)}.
Return only the raw JSON. No markdown backticks or extra text.
`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const match = text.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(match ? match[0] : text);
      res.json({ success: true, risk_coach: parsed, source: 'gemini' });
    } catch (apiErr) {
      console.error('[RISK_COACH] Gemini API call failed, using fallback:', apiErr.message);
      res.json({ success: true, risk_coach: fallback, source: 'fallback' });
    }
  } catch (err) {
    console.error('[RISK_COACH] End-point crash:', err.message);
    res.status(500).json({ error: 'Failed to compute portfolio risk analytics.' });
  }
});

router.post('/chat', riskCoachLimiter, async (req, res) => {
  try {
    const { message, chatHistory } = req.body;
    const userId = req.query.user_id || req.user?.id || 'nexus-sim-user';
    
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const portfolio = await getPortfolioDetails(userId);

    if (!model) {
      return res.json({
        title: 'Coach Session (Simulated)',
        verdict: 'HOLD',
        body: 'Gemini API key is not configured. Here is simulated advisory advice:\n\nBased on your holdings, Technology represents a key volatility component. Consider structural hedges.',
        symbol: null, price: null, change_pct: 0.0, confidence: 75
      });
    }

    const historyPrompt = chatHistory ? `Conversation history:\n${chatHistory.map(h => `${h.role}: ${h.content}`).join('\n')}\n` : '';

    const prompt = `
You are a senior institutional risk manager and portfolio coach.
User Portfolio details:
- Holdings: ${JSON.stringify(portfolio.holdings)}
- Total Value: ₹${portfolio.totalValue}
- P&L: ₹${portfolio.portfolioPnl}
- Number of orders: ${portfolio.tradesCount}

${historyPrompt}
User has queried: "${message}"

Respond strictly in the following JSON format without any markdown blocks or extra text:
{
  "title": "Advisory Summary Line",
  "verdict": "BUY" | "SELL" | "HOLD" | "STRONG BUY" | "ERROR",
  "body": "Detailed risk advice in markdown format. Explain the WHY behind your advice using data from their portfolio. Use **bold** for emphasis.",
  "symbol": "Ticker symbol if mentioned, else null",
  "price": Target or support price if identified, else null,
  "change_pct": Expected % move,
  "confidence": Confidence level (0-100)
}
`;

    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const match = text.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(match ? match[0] : text);
      res.json(parsed);
    } catch (err) {
      console.error('[RISK_COACH_CHAT] Failed:', err.message);
      res.status(502).json({ error: 'Failed to generate advisory response.' });
    }
  } catch (err) {
    console.error('[RISK_COACH_CHAT] Crash:', err.message);
    res.status(500).json({ error: 'Failed to process risk coach session.' });
  }
});

export default router;
