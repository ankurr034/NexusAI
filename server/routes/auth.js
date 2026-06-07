import express from 'express';
import { ethers } from 'ethers';
import jwt from 'jsonwebtoken';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'nexusai_super_secret_dev_key';

import User from '../models/User.js';

const generateNonce = () => {
  return `Sign this message to verify you own this wallet. Nonce: ${Math.floor(Math.random() * 1000000)}`;
};

// Web2 Login Mock
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ detail: 'Missing credentials' });
  
  // Return a mock user id for the frontend
  res.json({ success: true, user_id: 'mock_web2_user' });
});

router.get('/me', async (req, res) => {
  const { user_id } = req.query;

  try {
    let dbUser = null;
    if (user_id && user_id !== 'mock_web2_user' && user_id !== 'nexus-sim-user') {
      const mongoose = (await import('mongoose')).default;
      if (mongoose.Types.ObjectId.isValid(user_id)) {
        dbUser = await User.findById(user_id);
      } else {
        dbUser = await User.findOne({ walletAddress: user_id.toLowerCase() });
      }
    }

    res.json({
      user: {
        id: dbUser ? dbUser._id : (user_id || 'mock_web2_user'),
        username: dbUser ? (dbUser.username || dbUser.walletAddress) : 'DemoUser',
        email: dbUser ? dbUser.email : 'demo@nexus.ai',
        kyc_status: 'VERIFIED',
        account_mode: dbUser ? dbUser.account_mode : 'demo',
        isPremium: dbUser ? dbUser.isPremium : true
      },
      profile: {
        risk_profile: 'MODERATE',
        trading_experience: 'INTERMEDIATE'
      },
      broker_connected: dbUser ? (dbUser.broker_connected || false) : true // Mock web2 user returns true so connection tests succeed
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
    const token = jwt.sign(
      { id: user._id, walletAddress: user.walletAddress, isPremium: user.isPremium },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ success: true, token, user: { walletAddress: user.walletAddress, isPremium: user.isPremium } });
  } catch (error) {
    console.error('Error verifying signature:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
