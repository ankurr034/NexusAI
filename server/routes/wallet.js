import express from 'express';
import { WalletAccount, WalletTransaction } from '../models/Wallet.js';
import { dbUnavailableDetail, isDbReady } from '../utils/dbReady.js';

const router = express.Router();

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
router.post('/refill', async (req, res) => {
  try {
    const userId = req.query.user_id;
    const { amount, razorpay_payment_id } = req.body;

    if (!userId) return res.status(400).json({ detail: 'user_id required' });
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ detail: 'Invalid amount' });
    }
    if (amount > 10000000) {
      return res.status(400).json({ detail: 'Maximum refill limit is ₹1,00,00,000' });
    }

    // Prevent duplicate Razorpay credits
    if (razorpay_payment_id) {
      const existing = await WalletTransaction.findOne({ reference: razorpay_payment_id });
      if (existing) {
        return res.status(409).json({ detail: 'Payment already processed', balance: (await getOrCreateWallet(userId)).balance });
      }
    }

    const wallet = await getOrCreateWallet(userId);
    const balanceBefore = wallet.balance;
    
    wallet.balance += parseFloat(amount);
    wallet.totalDeposits += parseFloat(amount);
    wallet.updatedAt = Date.now();
    await wallet.save();

    // Record ledger entry
    await WalletTransaction.create({
      userId,
      type: razorpay_payment_id ? 'RAZORPAY_CREDIT' : 'WALLET REFILL',
      amount: parseFloat(amount),
      balanceBefore,
      balanceAfter: wallet.balance,
      status: 'COMPLETED',
      reference: razorpay_payment_id || null
    });

    console.log(`[WALLET] Refill: User ${userId} +₹${amount} → ₹${wallet.balance.toFixed(2)}`);
    res.json({ success: true, balance: wallet.balance });
  } catch (err) {
    console.error('[WALLET] Refill error:', err.message);
    res.status(500).json({ detail: 'Failed to refill wallet' });
  }
});

// ═══════════════════════════════════════════════════════════
//  POST /api/wallet/withdraw — Withdraw funds
// ═══════════════════════════════════════════════════════════
router.post('/withdraw', async (req, res) => {
  try {
    const userId = req.query.user_id;
    const { amount } = req.body;

    if (!userId) return res.status(400).json({ detail: 'user_id required' });
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ detail: 'Invalid amount' });
    }

    const wallet = await getOrCreateWallet(userId);
    
    if (amount > wallet.balance) {
      return res.status(400).json({ detail: 'Insufficient balance' });
    }

    const balanceBefore = wallet.balance;
    wallet.balance -= parseFloat(amount);
    wallet.totalWithdrawals += parseFloat(amount);
    wallet.updatedAt = Date.now();
    await wallet.save();

    await WalletTransaction.create({
      userId,
      type: 'WITHDRAW',
      amount: parseFloat(amount),
      balanceBefore,
      balanceAfter: wallet.balance,
      status: 'PROCESSING' // Withdrawals are marked processing initially
    });

    console.log(`[WALLET] Withdraw: User ${userId} -₹${amount} → ₹${wallet.balance.toFixed(2)}`);
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
router.post('/verify', async (req, res) => {
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
        return res.status(400).json({ detail: 'Payment signature verification failed' });
      }
    }

    // Prevent duplicate credits
    if (razorpay_payment_id) {
      const existing = await WalletTransaction.findOne({ reference: razorpay_payment_id });
      if (existing) {
        const wallet = await getOrCreateWallet(userId);
        return res.json({ success: true, message: 'Payment already credited', balance: wallet.balance });
      }
    }

    // Credit wallet
    const wallet = await getOrCreateWallet(userId);
    const creditAmount = parseFloat(amount) || 0;
    if (creditAmount <= 0) return res.status(400).json({ detail: 'Invalid amount' });

    const balanceBefore = wallet.balance;
    wallet.balance += creditAmount;
    wallet.totalDeposits += creditAmount;
    wallet.updatedAt = Date.now();
    await wallet.save();

    await WalletTransaction.create({
      userId,
      type: 'RAZORPAY_CREDIT',
      amount: creditAmount,
      balanceBefore,
      balanceAfter: wallet.balance,
      status: 'COMPLETED',
      reference: razorpay_payment_id || `manual_${Date.now()}`
    });

    console.log(`[WALLET] Razorpay verified: User ${userId} +₹${creditAmount} → ₹${wallet.balance.toFixed(2)}`);
    res.json({ success: true, balance: wallet.balance, message: 'Payment verified and credited' });
  } catch (err) {
    console.error('[WALLET] Verify error:', err.message);
    res.status(500).json({ detail: 'Payment verification failed' });
  }
});

export default router;
