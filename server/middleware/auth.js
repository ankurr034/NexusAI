import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import mongoose from 'mongoose';
import { JWT_SECRET, isProd } from '../utils/secrets.js';

// Demo/sim identities get a free pass OUTSIDE production when auth is omitted
const DEV_BYPASS_IDS = ['mock_web2_user', 'nexus-sim-user'];

export const requireAuth = async (req, res, next) => {
  try {
    let token;
    
    // 1. Check custom X-User-Token header (our preferred platform JWT header)
    const userTokenHeader = req.headers['x-user-token'];
    if (userTokenHeader && userTokenHeader.startsWith('Bearer ')) {
      token = userTokenHeader.split(' ')[1];
    }
    
    // 2. Fall back to standard Authorization header if X-User-Token is missing
    const authHeader = req.headers.authorization;
    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    let decoded = null;
    if (token) {
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (err) {
        if (err.name === 'TokenExpiredError') {
          return res.status(401).json({ success: false, error: 'TOKEN_EXPIRED', detail: 'Platform session expired. Please log in again.' });
        }
        return res.status(401).json({ success: false, error: 'Authentication failed', detail: 'Invalid or malformed security token.' });
      }
    }

    let userId = req.query.user_id || req.body.user_id || (decoded ? decoded.id : null);

    // Bypass for local development/E2E tests ONLY when not in production
    if (!isProd && (!token || DEV_BYPASS_IDS.includes(userId)) && (DEV_BYPASS_IDS.includes(userId) || req.headers['x-e2e-test'])) {
      req.user = {
        _id: userId || 'nexus-sim-user',
        id: userId || 'nexus-sim-user',
        username: 'DemoUser',
        isPremium: !isProd
      };
      return next();
    }

    if (!decoded) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    // ═══════════════════════════════════════════════════════════
    //  ID-OR Prevention (Ownership Validation)
    // ═══════════════════════════════════════════════════════════
    const reqUserId = req.query.user_id || req.body.user_id;
    if (reqUserId) {
      const match = String(reqUserId).toLowerCase().trim() === String(user._id).toLowerCase().trim();
      if (!match && !DEV_BYPASS_IDS.includes(reqUserId)) {
        console.warn(`[SECURITY] Blocked unauthorized ID-OR access. Authenticated: ${user._id}, Requested: ${reqUserId}`);
        return res.status(403).json({ success: false, error: 'Forbidden', detail: 'Access denied: Cannot query or modify resource of another user.' });
      }
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('requireAuth middleware error:', error);
    res.status(500).json({ success: false, error: 'Internal server error during authentication' });
  }
};

export const requirePremium = async (req, res, next) => {
  // Stacks requirePremium safely on top of requireAuth
  requireAuth(req, res, () => {
    try {
      if (!req.user.isPremium) {
        return res.status(403).json({ success: false, error: 'Premium subscription required' });
      }
      next();
    } catch (err) {
      res.status(500).json({ success: false, error: 'Internal authorization error' });
    }
  });
};
