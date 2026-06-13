import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { JWT_SECRET } from '../utils/secrets.js';

// Structured logging helper for authentication
const authSecurityLog = (msg, meta = {}) => {
  console.warn(`[AUTH_SECURITY] ${new Date().toISOString()} - ${msg}`, JSON.stringify(meta));
};

export const requireAuth = async (req, res, next) => {
  try {
    let token;
    
    // 1. Check custom X-User-Token header (preferred)
    const userTokenHeader = req.headers['x-user-token'];
    if (userTokenHeader && userTokenHeader.startsWith('Bearer ')) {
      token = userTokenHeader.split(' ')[1];
    }
    
    // 2. Fall back to standard Authorization header
    const authHeader = req.headers.authorization;
    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      authSecurityLog('Missing authentication token', { ip: req.ip, path: req.path });
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    let decoded = null;
    try {
      // Hardened verification: Explicitly require HMAC-SHA256 algorithm and validate claims
      decoded = jwt.verify(token, JWT_SECRET, {
        algorithms: ['HS256']
      });

      // Reject tokens missing critical claims
      if (!decoded.exp || !decoded.iat || !decoded.id) {
        authSecurityLog('Token rejected due to missing standard claims', { decoded, ip: req.ip });
        return res.status(401).json({ success: false, error: 'Authentication failed', detail: 'Invalid token structure.' });
      }
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        authSecurityLog('Token expired', { ip: req.ip });
        return res.status(401).json({ success: false, error: 'TOKEN_EXPIRED', detail: 'Platform session expired. Please log in again.' });
      }
      authSecurityLog('Token verification failure', { error: err.message, ip: req.ip });
      return res.status(401).json({ success: false, error: 'Authentication failed', detail: 'Invalid or malformed security token.' });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      authSecurityLog('User not found in database for valid token', { userId: decoded.id });
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    // ID-OR Prevention: Ensure that if a user_id parameter is passed in query/body, it matches the token
    const reqUserId = req.query.user_id || req.body.user_id;
    if (reqUserId) {
      const match = String(reqUserId).toLowerCase().trim() === String(user._id).toLowerCase().trim();
      if (!match) {
        authSecurityLog('Blocked unauthorized ID-OR access attempt', {
          authenticatedUser: user._id,
          requestedUser: reqUserId,
          ip: req.ip
        });
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
  requireAuth(req, res, () => {
    try {
      if (!req.user.isPremium) {
        authSecurityLog('Premium access denied', {
          userId: req.user._id,
          username: req.user.username,
          path: req.path,
          ip: req.ip
        });
        return res.status(403).json({ success: false, error: 'Premium subscription required' });
      }
      next();
    } catch (err) {
      res.status(500).json({ success: false, error: 'Internal authorization error' });
    }
  });
};
