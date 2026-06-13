import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { requirePremium } from '../middleware/auth.js';
import { addAIJob } from '../services/queueManager.js';

const router = express.Router();
router.use(requirePremium);

const API_KEY = process.env.GEMINI_API_KEY;
export let genAI;
export let model;

if (API_KEY) {
  genAI = new GoogleGenerativeAI(API_KEY);
  model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
}

// ═══════════════════════════════════════════════════════════
//  Per-user throttling + daily cost cap (in-memory).
//  Prevents a single user from running up the Gemini bill.
// ═══════════════════════════════════════════════════════════
const RATE_WINDOW_MS = 60 * 1000;   // 1 minute
const RATE_MAX = 10;                 // max 10 calls/min/user
const DAILY_CAP = 200;               // max 200 calls/user/day

const usage = new Map(); // key -> { windowStart, windowCount, dayStart, dayCount }

function getUserKey(req) {
  return req.user?._id?.toString() || req.query.user_id || req.ip || 'anon';
}

function checkAndRecord(key) {
  const now = Date.now();
  let u = usage.get(key);
  if (!u) { u = { windowStart: now, windowCount: 0, dayStart: now, dayCount: 0 }; usage.set(key, u); }

  // Roll the per-minute window
  if (now - u.windowStart >= RATE_WINDOW_MS) { u.windowStart = now; u.windowCount = 0; }
  // Roll the daily window
  if (now - u.dayStart >= 24 * 60 * 60 * 1000) { u.dayStart = now; u.dayCount = 0; }

  if (u.dayCount >= DAILY_CAP) return { ok: false, code: 429, error: 'Daily AI usage limit reached. Try again tomorrow.' };
  if (u.windowCount >= RATE_MAX) return { ok: false, code: 429, error: 'Too many AI requests. Please wait a moment.' };

  u.windowCount++; u.dayCount++;
  return { ok: true };
}

// Periodically evict idle usage entries so the map cannot grow unbounded.
setInterval(() => {
  const cutoff = Date.now() - 25 * 60 * 60 * 1000;
  for (const [k, u] of usage) if (u.dayStart < cutoff) usage.delete(k);
}, 60 * 60 * 1000);

// ═══════════════════════════════════════════════════════════
//  Response validation — never trust raw model output.
// ═══════════════════════════════════════════════════════════
export const VALID_VERDICTS = ['BUY', 'SELL', 'HOLD', 'STRONG BUY', 'ERROR'];

export function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : text);
}

export function validateAdvice(obj) {
  if (!obj || typeof obj !== 'object') return null;
  if (typeof obj.title !== 'string' || !obj.title.trim()) return null;
  if (!VALID_VERDICTS.includes(obj.verdict)) return null;
  if (typeof obj.body !== 'string' || !obj.body.trim()) return null;

  // Coerce numerics defensively; clamp confidence to 0–100.
  const price = Number(obj.price);
  const changePct = Number(obj.change_pct);
  let confidence = Number(obj.confidence);
  if (!Number.isFinite(confidence)) confidence = 50;
  confidence = Math.max(0, Math.min(100, confidence));

  return {
    title: obj.title.trim(),
    verdict: obj.verdict,
    body: obj.body,
    symbol: typeof obj.symbol === 'string' ? obj.symbol : null,
    price: Number.isFinite(price) ? price : null,
    change_pct: Number.isFinite(changePct) ? changePct : 0,
    confidence
  };
}

export const PROMPT = (message) => `
You are a senior financial analyst and AI trading copilot.
User query: "${message}"

Respond strictly in the following JSON format without any markdown blocks or extra text:
{
  "title": "Short title of analysis",
  "verdict": "BUY" | "SELL" | "HOLD" | "STRONG BUY" | "ERROR",
  "body": "Detailed markdown explanation. Include Risk assessment and key levels. Use **bold** for emphasis.",
  "symbol": "Ticker symbol if identified, else null",
  "price": Estimated target or current price as a number,
  "change_pct": Expected % change,
  "confidence": Confidence percentage (0-100)
}`;

router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }
    if (message.length > 2000) {
      return res.status(400).json({ error: 'Message too long (max 2000 chars)' });
    }

    // Throttle + cost cap
    const limit = checkAndRecord(getUserKey(req));
    if (!limit.ok) return res.status(limit.code).json({ error: limit.error });

    const runAIJobInline = async () => {
      if (!model) {
        return {
          title: 'Mock AI Response',
          verdict: 'HOLD',
          body: 'Gemini API key is not configured. This is a simulated response.\n\n**Risk:** Medium\n**Recommendation:** Wait for API integration.',
          symbol: 'MOCK', price: 100.0, change_pct: 0.0, confidence: 50
        };
      }

      let parsed = null;
      for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
        try {
          const result = await model.generateContent(PROMPT(message));
          parsed = validateAdvice(extractJson(result.response.text()));
        } catch (e) {
          if (attempt === 1) {
            console.error('Gemini call/parse failed after retry:', e.message);
          }
        }
      }

      if (!parsed) {
        throw new Error('AI response was invalid. Please rephrase and try again.');
      }
      return parsed;
    };

    const queueResult = await addAIJob(
      { userId: getUserKey(req), message },
      runAIJobInline
    );

    if (!queueResult.success || !queueResult.result) {
      return res.status(502).json({ error: 'AI response was invalid or timed out.' });
    }

    res.json(queueResult.result);
  } catch (error) {
    console.error('Error in AI Chat:', error);
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

export default router;
