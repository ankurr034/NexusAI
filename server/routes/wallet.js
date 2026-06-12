import express from 'express';
import { WalletAccount, WalletTransaction } from '../models/Wallet.js';
import { dbUnavailableDetail, isDbReady } from '../utils/dbReady.js';
import { requireAuth } from '../middleware/auth.js';
import { requestSanitizer, validateWalletAmount } from '../middleware/security.js';
import { writeAuditLog } from '../middleware/audit.js';
import { incrementWalletMutation } from '../middleware/metrics.js';

const router = express.Router();

router.use(requestSanitizer);
router.use(requireAuth);

const demoWallet = {
  balance: 1000000,
  usedMargin: 0,
  totalDeposits: 0,
  totalWithdrawals: 0,
  transactions: [],
  mode: 'Demo',
  warning: dbUnavailableDetail()
};

// ═══════════════════════════════════════════════════════════
//  Helper: Get or create wallet for a user
// ═══════════════════════════════════════════════════════════
async function getOrCreateWallet(userId) {
  let wallet = await WalletAccount.findOne({ userId });
  if (!wallet) {
    wallet = await WalletAccount.create({ userId, balance: 1000000 });
  }
  return wallet;
}

// ═══════════════════════════════════════════════════════════
//  GET /api/wallet — Fetch balance + transaction history
// ═══════════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const userId = req.query.user_id;
    if (!userId) return res.status(400).json({ detail: 'user_id required' });
    if (!isDbReady()) return res.json(demoWallet);

    const wallet = await getOrCreateWallet(userId);
    const transactions = await WalletTransaction.find({ userId })
      .sort({ date: -1 })
      .limit(50)
      .lean();

    // Format transactions for frontend schema compatibility
    const formattedTxns = transactions.map(t => ({
      type: t.type,
      date: new Date(t.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
      amount: t.amount,
      status: t.status,
      reference: t.reference
    }));

    res.json({
      balance: wallet.balance,
      usedMargin: wallet.usedMargin,
      totalDeposits: wallet.totalDeposits,
      totalWithdrawals: wallet.totalWithdrawals,
      transactions: formattedTxns
    });
  } catch (err) {
    console.error('[WALLET] Fetch error:', err.message);
    res.status(500).json({ detail: 'Failed to fetch wallet data' });
  }
});

// ═══════════════════════════════════════════════════════════
//  POST /api/wallet/refill — Add funds (demo or post-payment)
// ═══════════════════════════════════════════════════════════
router.post('/refill', validateWalletAmount, async (req, res) => {
  try {
    const userId = req.query.user_id;
    const { amount, razorpay_payment_id } = req.body;

    if (!userId) return res.status(400).json({ detail: 'user_id required' });
    const creditAmount = parseFloat(amount);
    if (creditAmount > 10000000) {
      return res.status(400).json({ detail: 'Maximum refill limit is ₹1,00,00,000' });
    }

    // Prevent duplicate Razorpay credits
    if (razorpay_payment_id) {
      const existing = await WalletTransaction.findOne({ reference: razorpay_payment_id });
      if (existing) {
        const wallet = await getOrCreateWallet(userId);
        return res.status(409).json({ detail: 'Payment already processed', balance: wallet.balance });
      }
    }

    const currentWallet = await getOrCreateWallet(userId);
    const balanceBefore = currentWallet.balance;

    const wallet = await WalletAccount.findOneAndUpdate(
      { userId },
      { 
        $inc: { balance: creditAmount, totalDeposits: creditAmount },
        $set: { updatedAt: Date.now() }
      },
      { new: true, upsert: true, runValidators: true }
    );

    incrementWalletMutation();

    const typeStr = razorpay_payment_id ? 'RAZORPAY_CREDIT' : 'WALLET REFILL';

    // Record ledger entry
    await WalletTransaction.create({
      userId,
      type: typeStr,
      amount: creditAmount,
      balanceBefore,
      balanceAfter: wallet.balance,
      status: 'COMPLETED',
      reference: razorpay_payment_id || null
    });

    writeAuditLog(userId, 'WALLET_MUTATION', 'SUCCESS', { type: typeStr, amount: creditAmount, balanceBefore, balanceAfter: wallet.balance, reference: razorpay_payment_id }, req);

    console.log(`[WALLET] Refill: User ${userId} +₹${creditAmount} → ₹${wallet.balance.toFixed(2)}`);
    res.json({ success: true, balance: wallet.balance });
  } catch (err) {
    console.error('[WALLET] Refill error:', err.message);
    res.status(500).json({ detail: 'Failed to refill wallet' });
  }
});

// ═══════════════════════════════════════════════════════════
//  POST /api/wallet/withdraw — Withdraw funds
// ═══════════════════════════════════════════════════════════
router.post('/withdraw', validateWalletAmount, async (req, res) => {
  try {
    const userId = req.query.user_id;
    const { amount } = req.body;

    if (!userId) return res.status(400).json({ detail: 'user_id required' });
    const debitAmount = parseFloat(amount);

    const currentWallet = await getOrCreateWallet(userId);
    const balanceBefore = currentWallet.balance;

    // Perform atomic debit with conditional check to prevent negative balance
    const wallet = await WalletAccount.findOneAndUpdate(
      { userId, balance: { $gte: debitAmount } },
      {
        $inc: { balance: -debitAmount, totalWithdrawals: debitAmount },
        $set: { updatedAt: Date.now() }
      },
      { new: true, runValidators: true }
    );

    if (!wallet) {
      writeAuditLog(userId, 'WITHDRAW_REQUEST', 'FAILURE', { reason: 'Insufficient balance', amount: debitAmount }, req);
      return res.status(400).json({ detail: 'Insufficient balance' });
    }

    incrementWalletMutation();

    await WalletTransaction.create({
      userId,
      type: 'WITHDRAW',
      amount: debitAmount,
      balanceBefore,
      balanceAfter: wallet.balance,
      status: 'PROCESSING'
    });

    writeAuditLog(userId, 'WITHDRAW_REQUEST', 'SUCCESS', { amount: debitAmount, balanceBefore, balanceAfter: wallet.balance }, req);

    console.log(`[WALLET] Withdraw: User ${userId} -₹${debitAmount} → ₹${wallet.balance.toFixed(2)}`);
    res.json({ success: true, balance: wallet.balance });
  } catch (err) {
    console.error('[WALLET] Withdraw error:', err.message);
    res.status(500).json({ detail: 'Failed to process withdrawal' });
  }
});

// ═══════════════════════════════════════════════════════════
//  POST /api/wallet/reset — Reset demo account
// ═══════════════════════════════════════════════════════════
router.post('/reset', async (req, res) => {
  try {
    const userId = req.query.user_id;
    if (!userId) return res.status(400).json({ detail: 'user_id required' });

    const wallet = await getOrCreateWallet(userId);
    const balanceBefore = wallet.balance;
    
    wallet.balance = 1000000;
    wallet.usedMargin = 0;
    wallet.totalDeposits = 0;
    wallet.totalWithdrawals = 0;
    wallet.updatedAt = Date.now();
    await wallet.save();

    incrementWalletMutation();

    // Record the reset
    await WalletTransaction.create({
      userId,
      type: 'RESET',
      amount: 0,
      balanceBefore,
      balanceAfter: 1000000,
      status: 'COMPLETED',
      metadata: { reason: 'Demo account reset by user' }
    });

    // Clear all transaction history for demo
    await WalletTransaction.deleteMany({ userId, type: { $ne: 'RESET' } });

    console.log(`[WALLET] Reset: User ${userId} → ₹10,00,000`);
    res.json({ success: true, message: 'Demo account reset successfully', balance: 1000000 });
  } catch (err) {
    console.error('[WALLET] Reset error:', err.message);
    res.status(500).json({ detail: 'Failed to reset account' });
  }
});

// ═══════════════════════════════════════════════════════════
//  POST /api/wallet/create-order — Create Razorpay order for wallet top-up
// ═══════════════════════════════════════════════════════════
router.post('/create-order', async (req, res) => {
  try {
    const userId = req.query.user_id;
    const { amount } = req.body;

    if (!userId) return res.status(400).json({ detail: 'user_id required' });
    if (!amount || isNaN(amount) || amount < 100) {
      return res.status(400).json({ detail: 'Minimum amount is ₹100' });
    }

    // Dynamic import Razorpay to share config
    const Razorpay = (await import('razorpay')).default;
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_mockkey',
      key_secret: process.env.RAZORPAY_KEY_SECRET || 'mocksecret',
    });

    const options = {
      amount: Math.round(amount * 100), // paise
      currency: 'INR',
      receipt: `wallet_${userId}_${Date.now()}`,
      notes: { userId, type: 'WALLET_REFILL' }
    };

    const order = await razorpay.orders.create(options);
    res.json({ success: true, order_id: order.id, amount: order.amount, currency: order.currency });
  } catch (err) {
    console.error('[WALLET] Create order error:', err.message);
    // Fallback for test environments without Razorpay keys
    res.json({
      success: true,
      order_id: `order_demo_${Date.now()}`,
      amount: Math.round(req.body.amount * 100),
      currency: 'INR',
      is_demo: true
    });
  }
});

// ═══════════════════════════════════════════════════════════
//  POST /api/wallet/verify — Verify Razorpay payment and credit wallet
// ═══════════════════════════════════════════════════════════
router.post('/verify', validateWalletAmount, async (req, res) => {
  try {
    const userId = req.query.user_id;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;

    if (!userId) return res.status(400).json({ detail: 'user_id required' });

    const secret = process.env.RAZORPAY_KEY_SECRET || 'mocksecret';

    // Verify signature
    if (razorpay_signature && razorpay_order_id) {
      const crypto = (await import('crypto')).default;
      const expected = crypto
        .createHmac('sha256', secret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (expected !== razorpay_signature) {
        writeAuditLog(userId, 'PAYMENT_FAILED', 'FAILURE', { reason: 'Signature mismatch', orderId: razorpay_order_id, paymentId: razorpay_payment_id }, req);
        return res.status(400).json({ detail: 'Payment signature verification failed' });
      }
    } else {
      // In production, signature verification MUST be mandatory
      if (process.env.NODE_ENV === 'production') {
        writeAuditLog(userId, 'PAYMENT_FAILED', 'FAILURE', { reason: 'Missing signature in production', orderId: razorpay_order_id }, req);
        return res.status(400).json({ detail: 'Payment signature is required' });
      }
    }

    // Prevent duplicate credits
    if (razorpay_payment_id) {
      const existing = await WalletTransaction.findOne({ reference: razorpay_payment_id });
      if (existing) {
        const wallet = await getOrCreateWallet(userId);
        writeAuditLog(userId, 'PAYMENT_VERIFIED', 'SUCCESS', { note: 'Duplicate credit blocked', paymentId: razorpay_payment_id, balance: wallet.balance }, req);
        return res.json({ success: true, message: 'Payment already credited', balance: wallet.balance });
      }
    }

    const currentWallet = await getOrCreateWallet(userId);
    const balanceBefore = currentWallet.balance;
    const creditAmount = parseFloat(amount) || 0;

    const wallet = await WalletAccount.findOneAndUpdate(
      { userId },
      {
        $inc: { balance: creditAmount, totalDeposits: creditAmount },
        $set: { updatedAt: Date.now() }
      },
      { new: true, upsert: true, runValidators: true }
    );

    incrementWalletMutation();

    await WalletTransaction.create({
      userId,
      type: 'RAZORPAY_CREDIT',
      amount: creditAmount,
      balanceBefore,
      balanceAfter: wallet.balance,
      status: 'COMPLETED',
      reference: razorpay_payment_id || `manual_${Date.now()}`
    });

    writeAuditLog(userId, 'PAYMENT_VERIFIED', 'SUCCESS', { orderId: razorpay_order_id, paymentId: razorpay_payment_id, amount: creditAmount, balanceBefore, balanceAfter: wallet.balance }, req);

    console.log(`[WALLET] Razorpay verified: User ${userId} +₹${creditAmount} → ₹${wallet.balance.toFixed(2)}`);
    res.json({ success: true, balance: wallet.balance, message: 'Payment verified and credited' });
  } catch (err) {
    console.error('[WALLET] Verify error:', err.message);
    writeAuditLog(req.query.user_id, 'PAYMENT_FAILED', 'FAILURE', { error: err.message }, req);
    res.status(500).json({ detail: 'Payment verification failed' });
  }
});

export default router;
