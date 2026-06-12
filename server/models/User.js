import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  // ── Web2 credential identity (email/username + password) ──
  username: { type: String, unique: true, sparse: true, trim: true, lowercase: true },
  email: { type: String, unique: true, sparse: true, trim: true, lowercase: true },
  passwordHash: { type: String, default: null }, // bcrypt hash — never store plaintext
  full_name: { type: String, default: '' },
  kyc_status: { type: String, enum: ['UNVERIFIED', 'PENDING', 'VERIFIED'], default: 'UNVERIFIED' },

  // ── Web3 wallet identity (optional — only set for wallet-based signups) ──
  walletAddress: { type: String, unique: true, sparse: true },
  nonce: { type: String, default: null },

  // ── Google OAuth identity (optional — only set for Google-based signups) ──
  googleId: { type: String, unique: true, sparse: true },
  avatar: { type: String, default: '' },
  authProvider: { type: String, enum: ['local', 'google', 'wallet'], default: 'local' },

  account_mode: { type: String, enum: ['demo', 'live'], default: 'demo' },
  isPremium: { type: Boolean, default: false },
  subscription_plan: { type: String, default: 'Free' },
  premium_expiry: { type: Date, default: null },
  trial_expiry: { type: Date, default: null },
  auto_renew: { type: Boolean, default: true },
  referral_code: { type: String, default: null },
  coupons_used: [{ type: String }],
  paymentHistory: [{
    orderId: String,
    paymentId: String,
    amount: Number,
    status: String, // 'Success', 'Failed', 'Refunded'
    date: { type: Date, default: Date.now },
    plan: String,
    receiptUrl: String,
    taxAmount: Number
  }],
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.models.User || mongoose.model('User', UserSchema);

export default User;
