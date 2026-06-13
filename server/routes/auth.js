import express from 'express';
import { ethers } from 'ethers';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { JWT_SECRET, isProd } from '../utils/secrets.js';

const router = express.Router();

import User from '../models/User.js';
import UserSession from '../models/Session.js';
import { requireAuth } from '../middleware/auth.js';
import { requestSanitizer } from '../middleware/security.js';
import { writeAuditLog } from '../middleware/audit.js';
import crypto from 'crypto';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

router.use(requestSanitizer);

import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { detail: 'Too many authentication attempts. Please try again later.' }
});

router.use(authLimiter);

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const generateNonce = () => {
  return `Sign this message to verify you own this wallet. Nonce: ${Math.floor(Math.random() * 1000000)}`;
};

const issueAccessToken = (user) => jwt.sign(
  { id: user._id, username: user.username, walletAddress: user.walletAddress, isPremium: user.isPremium },
  JWT_SECRET,
  { expiresIn: '15m', algorithm: 'HS256' }
);

const issueToken = issueAccessToken;

const issueRefreshToken = (user, familyId) => jwt.sign(
  { id: user._id, familyId },
  JWT_SECRET,
  { expiresIn: '7d', algorithm: 'HS256' }
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
    
    // Strict password entropy validation (at least 8 chars, 1 uppercase letter, 1 number)
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      return res.status(400).json({ detail: 'Password must be at least 8 characters long and contain at least one uppercase letter and one number.' });
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
      isPremium: false,
      walletAddress: `local_user_${uname}` // unique fallback to prevent duplicate index null collisions
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
      if (!ok) {
        writeAuditLog(user._id, 'LOGIN_FAILED', 'FAILURE', { reason: 'Incorrect password' }, req);
        return res.status(401).json({ detail: 'Invalid username or password' });
      }

      // 1. Session and token parameters
      const familyId = crypto.randomUUID();
      const accessToken = issueAccessToken(user);
      const refreshToken = issueRefreshToken(user, familyId);

      // 2. Track device metadata
      const userAgent = req.headers['user-agent'] || 'unknown';
      let deviceType = 'desktop';
      if (/mobile/i.test(userAgent)) deviceType = 'mobile';
      else if (/tablet/i.test(userAgent)) deviceType = 'tablet';

      // 3. Save Session
      await UserSession.create({
        userId: user._id,
        familyId,
        tokenHash: hashToken(refreshToken),
        ipAddress: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown',
        userAgent,
        deviceType,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      });

      writeAuditLog(user._id, 'LOGIN_SUCCESS', 'SUCCESS', { provider: 'local', deviceType }, req);

      return res.json({ 
        success: true, 
        user_id: user._id, 
        token: accessToken, 
        refreshToken 
      });
    }

    writeAuditLog(null, 'LOGIN_FAILED', 'FAILURE', { reason: 'User not found' }, req);
    return res.status(401).json({ detail: 'Invalid username or password' });
  } catch (err) {
    console.error('Error in /login:', err);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════
//  POST /api/auth/refresh-token — Rotate Access/Refresh Token
// ═══════════════════════════════════════════════════════════
router.post('/refresh-token', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) return res.status(400).json({ detail: 'Refresh token required' });

    let decoded;
    try {
      decoded = jwt.verify(refresh_token, JWT_SECRET, { algorithms: ['HS256'] });
    } catch (err) {
      return res.status(401).json({ detail: 'Invalid refresh token' });
    }

    const hashedToken = hashToken(refresh_token);
    const session = await UserSession.findOne({ tokenHash: hashedToken });
    if (!session) {
      // Refresh token reuse/theft detection: invalidate all sessions in family
      await UserSession.deleteMany({ familyId: decoded.familyId });
      writeAuditLog(decoded.id, 'REFRESH_THEFT', 'FAILURE', { familyId: decoded.familyId }, req);
      return res.status(401).json({ detail: 'Token reuse detected. All sessions revoked.' });
    }

    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ detail: 'User not found' });

    // Rotate tokens
    const nextAccessToken = issueAccessToken(user);
    const nextRefreshToken = issueRefreshToken(user, decoded.familyId);

    // Update Session
    session.tokenHash = hashToken(nextRefreshToken);
    session.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await session.save();

    res.json({
      success: true,
      token: nextAccessToken,
      refreshToken: nextRefreshToken
    });
  } catch (err) {
    console.error('Error in /refresh-token:', err);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════
//  POST /api/auth/logout — Invalidate Session
// ═══════════════════════════════════════════════════════════
router.post('/logout', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (refresh_token) {
      const hashedToken = hashToken(refresh_token);
      const session = await UserSession.findOneAndDelete({ tokenHash: hashedToken });
      if (session) {
        writeAuditLog(session.userId, 'LOGOUT', 'SUCCESS', { familyId: session.familyId }, req);
      }
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    console.error('Error in /logout:', err);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════
//  GET /api/auth/me — Load authenticated profile directly from JWT user context
// ═══════════════════════════════════════════════════════════
router.get('/me', requireAuth, async (req, res) => {
  try {
    return res.json({
      user: {
        id: req.user._id,
        username: req.user.username || req.user.walletAddress || 'User',
        email: req.user.email || '',
        full_name: req.user.full_name || '',
        kyc_status: req.user.kyc_status || 'UNVERIFIED',
        account_mode: req.user.account_mode || 'demo',
        isPremium: !!req.user.isPremium,
        subscription_plan: req.user.subscription_plan || 'Free',
        walletAddress: req.user.walletAddress || null
      },
      profile: { risk_profile: 'MODERATE', trading_experience: 'INTERMEDIATE' },
      broker_connected: req.user.broker_connected || false
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

// ═══════════════════════════════════════════════════════════
//  Google OAuth — verifies a Google ID token, then find-or-create.
//  The client sends the `credential` (a Google ID/JWT token) from
//  the Google Identity Services button. We verify it server-side
//  against Google's keys — never trust the client's claims directly.
// ═══════════════════════════════════════════════════════════
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ detail: 'Missing Google credential' });
    }
    if (!googleClient) {
      return res.status(503).json({ detail: 'Google sign-in is not configured on the server' });
    }

    let payload;
    if (credential.startsWith('ya29.')) {
      // Resolve Google profile info using access token via userinfo endpoint
      const response = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${credential}`);
      if (!response.ok) {
        return res.status(401).json({ detail: 'Failed to verify Google access token' });
      }
      payload = await response.json();
    } else {
      // Verify the ID token against Google. Throws if invalid/expired/wrong audience.
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    }

    if (!payload || !payload.email) {
      return res.status(401).json({ detail: 'Could not verify Google account' });
    }

    const googleId = payload.sub;
    const email = String(payload.email).toLowerCase().trim();
    const fullName = payload.name || '';
    const avatar = payload.picture || '';

    // 1) Match an existing Google account, else 2) link to an existing
    //    email account, else 3) create a fresh Google-backed user.
    let user = await User.findOne({ googleId });

    if (!user) {
      user = await User.findOne({ email });
      if (user) {
        // Link Google to a pre-existing email/password account.
        user.googleId = googleId;
        if (!user.avatar) user.avatar = avatar;
        if (!user.full_name) user.full_name = fullName;
        await user.save();
      }
    }

    if (!user) {
      // Derive a unique username from the email local-part.
      const base = email.split('@')[0].replace(/[^a-z0-9_]/g, '') || 'user';
      let username = base;
      let suffix = 0;
      // eslint-disable-next-line no-await-in-loop
      while (await User.findOne({ username })) {
        suffix += 1;
        username = `${base}${suffix}`;
      }

      user = await User.create({
        username,
        email,
        full_name: fullName,
        avatar,
        googleId,
        authProvider: 'google',
        kyc_status: 'UNVERIFIED',
        isPremium: false,
        walletAddress: `google_user_${googleId}` // unique fallback to prevent duplicate index null collisions
      });
    }

    const token = issueToken(user);
    return res.json({
      success: true,
      user_id: user._id,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        avatar: user.avatar,
        isPremium: !!user.isPremium,
      },
    });
  } catch (err) {
    console.error('Error in /google:', err);
    return res.status(401).json({ detail: 'Google authentication failed' });
  }
});

export default router;
