import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { requireAuth, requirePremium } from '../middleware/auth.js';
import { JWT_SECRET } from '../utils/secrets.js';

describe('requireAuth Middleware (Authentication Hardening)', () => {
  let mockReq;
  let mockRes;
  let next;

  beforeEach(() => {
    mockReq = {
      headers: {},
      query: {},
      body: {},
      ip: '127.0.0.1',
      path: '/api/test'
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    next = vi.fn();
    // Clear mocks
    vi.clearAllMocks();
  });

  it('rejects requests missing auth headers', async () => {
    await requireAuth(mockReq, mockRes, next);
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: 'Authentication required'
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects expired tokens', async () => {
    const expiredToken = jwt.sign({ id: 'some_user', exp: Math.floor(Date.now() / 1000) - 10, iat: Math.floor(Date.now() / 1000) - 60 }, JWT_SECRET);
    mockReq.headers['x-user-token'] = `Bearer ${expiredToken}`;
    
    await requireAuth(mockReq, mockRes, next);
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'TOKEN_EXPIRED'
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects tokens signed with different secrets (forged)', async () => {
    const forgedToken = jwt.sign({ id: 'some_user', exp: Math.floor(Date.now() / 1000) + 1000, iat: Math.floor(Date.now() / 1000) }, 'forged_secret');
    mockReq.headers['x-user-token'] = `Bearer ${forgedToken}`;
    
    await requireAuth(mockReq, mockRes, next);
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'Authentication failed'
    }));
  });

  it('rejects algorithm mismatch attempts (e.g. none algorithm)', async () => {
    // Construct a JWT with 'none' algorithm manually
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ id: 'some_user', exp: Math.floor(Date.now() / 1000) + 1000, iat: Math.floor(Date.now() / 1000) })).toString('base64url');
    const token = `${header}.${payload}.`;
    mockReq.headers['x-user-token'] = `Bearer ${token}`;

    await requireAuth(mockReq, mockRes, next);
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'Authentication failed'
    }));
  });
});

describe('requirePremium Middleware (Paywall Gates)', () => {
  let mockReq;
  let mockRes;
  let next;

  beforeEach(() => {
    mockReq = {
      headers: {},
      query: {},
      body: {},
      ip: '127.0.0.1',
      path: '/api/premium-feature'
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    next = vi.fn();
  });

  it('blocks non-premium users with 403 Forbidden', async () => {
    // Generate valid token for standard user
    const userToken = jwt.sign({ id: 'standard_user_id', exp: Math.floor(Date.now() / 1000) + 1000, iat: Math.floor(Date.now() / 1000) }, JWT_SECRET);
    mockReq.headers['x-user-token'] = `Bearer ${userToken}`;

    // Mock DB User response
    const User = (await import('../models/User.js')).default;
    const findByIdSpy = vi.spyOn(User, 'findById').mockResolvedValue({
      _id: 'standard_user_id',
      username: 'standard',
      isPremium: false
    });

    await requirePremium(mockReq, mockRes, next);
    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: 'Premium subscription required'
    });
    expect(next).not.toHaveBeenCalled();
    findByIdSpy.mockRestore();
  });

  it('allows premium users with valid subscription status', async () => {
    const premiumToken = jwt.sign({ id: 'premium_user_id', exp: Math.floor(Date.now() / 1000) + 1000, iat: Math.floor(Date.now() / 1000) }, JWT_SECRET);
    mockReq.headers['x-user-token'] = `Bearer ${premiumToken}`;

    const User = (await import('../models/User.js')).default;
    const findByIdSpy = vi.spyOn(User, 'findById').mockResolvedValue({
      _id: 'premium_user_id',
      username: 'premium',
      isPremium: true
    });

    await requirePremium(mockReq, mockRes, next);
    expect(next).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
    findByIdSpy.mockRestore();
  });
});
