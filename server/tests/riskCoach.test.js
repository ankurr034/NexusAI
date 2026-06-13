import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

// Set environment variable BEFORE importing the router dynamically
beforeAll(() => {
  process.env.GEMINI_API_KEY = 'test-key-for-unit-testing';
});

// Mock model outputs
const mockGenerateContent = vi.fn().mockResolvedValue({
  response: {
    text: () => JSON.stringify({
      health_score: 90,
      volatility_score: 12,
      downside_risk_score: 30,
      var_95: 5000,
      beta: 0.95,
      behavioral_biases: { over_trading: 20, fomo: 15, disposition_effect: 10, discipline_score: 95 },
      alerts: [],
      ai_summary: 'Test Gemini Assessment Complete.'
    })
  }
});

vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: class {
      constructor(apiKey) {
        this.apiKey = apiKey;
      }
      getGenerativeModel() {
        return {
          generateContent: mockGenerateContent
        };
      }
    }
  };
});

// Mock database Position & Order models
vi.mock('../models/PaperTrading.js', () => {
  return {
    PaperPosition: {
      find: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([
          { symbol: 'RELIANCE', quantity: 10, averagePrice: 2400.0 }
        ])
      })
    },
    PaperOrder: {
      find: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue([])
      })
    }
  };
});

// Mock authentication middleware
vi.mock('../middleware/auth.js', () => ({
  requirePremium: (req, res, next) => {
    req.user = { id: 'test_user_id', username: 'test_user', isPremium: true };
    next();
  }
}));

describe('AI Risk Coach Router', () => {
  let mockReq;
  let mockRes;
  let next;
  let riskCoachRouter;

  beforeAll(async () => {
    // Dynamic import guarantees process.env.GEMINI_API_KEY is defined when router evaluates
    const mod = await import('../routes/riskCoach.js');
    riskCoachRouter = mod.default;
  });

  beforeEach(() => {
    mockReq = {
      body: {},
      query: { user_id: 'test_user_id' },
      user: { id: 'test_user_id', username: 'test_user', isPremium: true },
      ip: '127.0.0.1',
      headers: {}
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    next = vi.fn();
    vi.clearAllMocks();
  });

  it('GET / - returns structured risk coach profile analysis', async () => {
    const getHandler = riskCoachRouter.stack.find(s => s.route?.methods?.get).route.stack[1].handle;
    await getHandler(mockReq, mockRes);

    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      risk_coach: expect.objectContaining({
        health_score: expect.any(Number),
        beta: expect.any(Number),
        ai_summary: expect.any(String)
      })
    }));
  });

  it('POST /chat - allows interaction and returns coach recommendations', async () => {
    mockReq.body = { message: 'Analyze my profile warnings.' };
    const chatHandler = riskCoachRouter.stack.find(s => s.route?.path === '/chat' && s.route?.methods?.post).route.stack[1].handle;
    await chatHandler(mockReq, mockRes);

    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      health_score: 90,
      ai_summary: 'Test Gemini Assessment Complete.'
    }));
  });
});
