import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  walletAddress: { type: String, unique: true, required: true },
  nonce: { type: String, required: true },
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
