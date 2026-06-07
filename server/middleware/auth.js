import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'nexusai_super_secret_dev_key';

export const requirePremium = async (req, res, next) => {
  try {
    let userId = req.query.user_id; // Support explicit user_id query param
    let walletAddress;

    // Check for Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        walletAddress = decoded.walletAddress;
      } catch (err) {
        console.error('JWT verification failed:', err.message);
      }
    }

    if (!userId && !walletAddress) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    let user;
    if (walletAddress) {
      user = await User.findOne({ walletAddress: walletAddress.toLowerCase() });
    } else if (userId && userId.startsWith('0x')) {
      user = await User.findOne({ walletAddress: userId.toLowerCase() });
    } else {
      // Mock web2 user simulation
      if (userId === 'mock_web2_user') {
        // Assume web2 mock users always pass for testing, or we enforce strict
        return next();
      }
    }

    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    if (!user.isPremium) {
      return res.status(403).json({ success: false, error: 'Premium subscription required' });
    }

    // Check expiry
    if (user.premium_expiry && new Date() > new Date(user.premium_expiry)) {
      // Subscription expired
      user.isPremium = false;
      await user.save();
      return res.status(403).json({ success: false, error: 'Premium subscription expired' });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    console.error('requirePremium middleware error:', error);
    res.status(500).json({ success: false, error: 'Internal server error during authorization' });
  }
};
