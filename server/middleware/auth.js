import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import mongoose from 'mongoose';
import { JWT_SECRET, isProd } from '../utils/secrets.js';

// Demo/sim identities only get a free pass OUTSIDE production.
const DEV_BYPASS_IDS = ['mock_web2_user', 'nexus-sim-user'];

export const requirePremium = async (req, res, next) => {
  try {
    let userId = req.query.user_id; // Support explicit user_id query param
    let walletAddress;

    // Prefer a verified JWT when one is present.
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        walletAddress = decoded.walletAddress;
        if (decoded.id) userId = decoded.id;
      } catch (err) {
        // Not our JWT (could be a broker token) — fall through to user_id lookup.
      }
    }

    if (!userId && !walletAddress) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Development-only convenience: allow demo/sim sessions through without a real account.
    // This NEVER runs in production, so the paywall is real where it matters.
    if (!isProd && (DEV_BYPASS_IDS.includes(userId) || req.headers['x-e2e-test'])) {
      return next();
    }

    let user;
    if (walletAddress) {
      user = await User.findOne({ walletAddress: walletAddress.toLowerCase() });
    } else if (userId && userId.startsWith('0x')) {
      user = await User.findOne({ walletAddress: userId.toLowerCase() });
    } else if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      user = await User.findById(userId);
    }

    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    // Real enforcement: a non-premium user is rejected, not silently upgraded.
    if (!user.isPremium) {
      return res.status(403).json({ success: false, error: 'Premium subscription required' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('requirePremium middleware error:', error);
    res.status(500).json({ success: false, error: 'Internal server error during authorization' });
  }
};
