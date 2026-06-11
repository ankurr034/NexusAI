import express from 'express';
import { ethers } from 'ethers';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { JWT_SECRET, isProd } from '../utils/secrets.js';

const router = express.Router();

import User from '../models/User.js';

const generateNonce = () => {
  return `Sign this message to verify you own this wallet. Nonce: ${Math.floor(Math.random() * 1000000)}`;
};

const issueToken = (user) => jwt.sign(
  { id: user._id, username: user.username, walletAddress: user.walletAddress, isPremium: user.isPremium },
  JWT_SECRET,
  { expiresIn: '7d' }
);

// ═══════════════════════════════════════════════════════════
//  Web2 Registration — real bcrypt-hashed credentials
// ═══════════════════════════════════════════════════════════
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, full_name } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ detail: 'Username, email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ detail: 'Password must be at least 6 characters' });
    }

    const uname = String(username).toLowerCase().trim();
    const mail = String(email).toLowerCase().trim();

    const existing = await User.findOne({ $or: [{ username: uname }, { email: mail }] });
    if (existing) {
      return res.status(409).json({ detail: 'An account with that username or email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      username: uname,
      email: mail,
      passwordHash,
      full_name: full_name || '',
      kyc_status: 'UNVERIFIED',
      isPremium: false
    });

    res.json({ success: true, user_id: user._id });
  } catch (err) {
    console.error('Error in /register:', err);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════
//  Web2 Login — verifies a real hashed password
// ═══════════════════════════════════════════════════════════
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ detail: 'Missing credentials' });

    const ident = String(username).toLowerCase().trim();
    const user = await User.findOne({ $or: [{ username: ident }, { email: ident }] });

    if (user && user.passwordHash) {
      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return res.status(401).json({ detail: 'Invalid username or password' });

      const token = issueToken(user);
      return res.json({ success: true, user_id: user._id, token });
    }

    // Documented demo account — allowed ONLY outside production. No prod backdoor.
    if (!isProd && ident === 'demo' && password === 'demo123') {
      return res.json({ success: true, user_id: 'nexus-sim-user' });
    }

    return res.status(401).json({ detail: 'Invalid username or password' });
  } catch (err) {
    console.error('Error in /login:', err);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

router.get('/me', async (req, res) => {
  const { user_id } = req.query;
  const DEMO_IDS = ['mock_web2_user', 'nexus-sim-user'];

  try {
    let dbUser = null;
    if (user_id && !DEMO_IDS.includes(user_id)) {
      const mongoose = (await import('mongoose')).default;
      if (mongoose.Types.ObjectId.isValid(user_id)) {
        dbUser = await User.findById(user_id);
      } else {
        dbUser = await User.findOne({ walletAddress: user_id.toLowerCase() });
      }
    }

    if (dbUser) {
      // Real account — report real, DB-backed flags (no hardcoded premium/verified).
      return res.json({
        user: {
          id: dbUser._id,
          username: dbUser.username || dbUser.walletAddress || 'User',
          email: dbUser.email || '',
          full_name: dbUser.full_name || '',
          kyc_status: dbUser.kyc_status || 'UNVERIFIED',
          account_mode: dbUser.account_mode || 'demo',
          isPremium: !!dbUser.isPremium,
          subscription_plan: dbUser.subscription_plan || 'Free',
          walletAddress: dbUser.walletAddress || null
        },
        profile: { risk_profile: 'MODERATE', trading_experience: 'INTERMEDIATE' },
        broker_connected: false
      });
    }

    // Demo/sim session. Full access is granted in development only — never in production.
    return res.json({
      user: {
        id: user_id || 'mock_web2_user',
        username: 'DemoUser',
        email: 'demo@nexus.ai',
        kyc_status: isProd ? 'UNVERIFIED' : 'VERIFIED',
        account_mode: 'demo',
        isPremium: !isProd,
        subscription_plan: isProd ? 'Free' : 'Demo'
      },
      profile: { risk_profile: 'MODERATE', trading_experience: 'INTERMEDIATE' },
      broker_connected: false
    });
  } catch (err) {
    console.error('Error in /me:', err);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

router.post('/nonce', async (req, res) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress) return res.status(400).json({ error: 'walletAddress is required' });

    let user = await User.findOne({ walletAddress: walletAddress.toLowerCase() });

    if (!user) {
      user = new User({ walletAddress: walletAddress.toLowerCase(), nonce: generateNonce() });
      await user.save();
    } else {
      user.nonce = generateNonce();
      await user.save();
    }

    res.json({ nonce: user.nonce });
  } catch (error) {
    console.error('Error generating nonce:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/verify', async (req, res) => {
  try {
    const { walletAddress, signature } = req.body;
    if (!walletAddress || !signature) return res.status(400).json({ error: 'Missing parameters' });

    const user = await User.findOne({ walletAddress: walletAddress.toLowerCase() });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Verify signature
    const recoveredAddress = ethers.verifyMessage(user.nonce, signature);

    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Refresh nonce to prevent replay attacks
    user.nonce = generateNonce();
    await user.save();

    // Issue JWT
    const token = issueToken(user);

    res.json({ success: true, token, user: { walletAddress: user.walletAddress, isPremium: user.isPremium } });
  } catch (error) {
    console.error('Error verifying signature:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
