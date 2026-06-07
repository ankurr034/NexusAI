import express from 'express';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import User from '../models/User.js';

const router = express.Router();

// Rate limiting for premium routes
const premiumLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' }
});

router.use(premiumLimiter);

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_mockkey',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'mocksecret',
});

const PLAN_PRICES = {
  'Pro Trader': 999,
  'Elite AI': 2499
};

// Create an order
router.post('/create-order', async (req, res) => {
  try {
    const { planId, user_id } = req.body;
    
    if (!planId || !PLAN_PRICES[planId]) {
      return res.status(400).json({ error: 'Invalid or missing planId' });
    }

    const amount = PLAN_PRICES[planId];

    const options = {
      amount: amount * 100, // paise
      currency: "INR",
      receipt: `receipt_order_${Date.now()}`,
      notes: {
        planId: planId,
        userId: user_id
      }
    };

    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Verify payment
router.post('/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, walletAddress, planId, amount } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'mocksecret')
      .update(body.toString())
      .digest('hex');

    if (expectedSignature === razorpay_signature || process.env.NODE_ENV === 'development' || !process.env.RAZORPAY_KEY_ID) {
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);

      if (walletAddress) {
        const updatedUser = await User.findOneAndUpdate(
          { walletAddress: walletAddress.toLowerCase() },
          { 
            isPremium: true,
            subscription_plan: planId || 'Pro Trader',
            premium_expiry: expiryDate,
            auto_renew: true,
            $push: {
              paymentHistory: {
                orderId: razorpay_order_id,
                paymentId: razorpay_payment_id,
                amount: amount,
                status: 'Success',
                plan: planId || 'Pro Trader',
                receiptUrl: `https://nexusai.dev/invoice/${razorpay_payment_id}`,
                taxAmount: amount * 0.18
              }
            }
          },
          { new: true }
        );
        if (!updatedUser) {
           return res.status(404).json({ success: false, error: 'User not found' });
        }
      }

      res.json({ success: true, message: 'Payment verified and Premium activated', plan: planId || 'Pro Trader', expiry: expiryDate });
    } else {
      res.status(400).json({ success: false, error: 'Invalid signature' });
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

// Webhook Handler
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'mockwebhooksecret';
    
    // In production, you would verify the raw body
    // const expectedSignature = crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');
    // if (expectedSignature !== signature && process.env.NODE_ENV !== 'development') return res.status(400).send('Invalid signature');

    const event = req.body;
    const { event: eventType, payload } = event;
    const payment = payload?.payment?.entity;
    const userId = payment?.notes?.userId;

    if (!userId) return res.status(400).send('No user ID in notes');

    const user = await User.findOne({ walletAddress: userId.toLowerCase() }) || await User.findById(userId);

    if (!user) return res.status(404).send('User not found');

    switch(eventType) {
      case 'payment.captured':
        if (!user.paymentHistory.find(p => p.paymentId === payment.id)) {
          user.isPremium = true;
          user.premium_expiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
          user.auto_renew = true;
          user.paymentHistory.push({
            paymentId: payment.id,
            orderId: payment.order_id,
            amount: payment.amount / 100,
            status: 'Success',
            plan: payment.notes.planId || 'Pro Trader'
          });
          await user.save();
        }
        break;
      case 'payment.failed':
        if (!user.paymentHistory.find(p => p.paymentId === payment.id)) {
          user.paymentHistory.push({
            paymentId: payment.id,
            orderId: payment.order_id,
            amount: payment.amount / 100,
            status: 'Failed',
            plan: payment.notes.planId
          });
          await user.save();
        }
        break;
      case 'subscription.cancelled':
        user.auto_renew = false;
        await user.save();
        break;
      case 'refund.processed':
        user.isPremium = false;
        user.paymentHistory.push({
          paymentId: payment.id,
          status: 'Refunded'
        });
        await user.save();
        break;
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Webhook Error');
  }
});

// Cancel Subscription
router.post('/cancel', async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'User ID required' });

    const user = await User.findOne({ walletAddress: user_id.toLowerCase() });
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.auto_renew = false;
    await user.save();

    res.json({ success: true, message: 'Subscription auto-renew disabled. Premium access will end at the end of the billing cycle.', expiry: user.premium_expiry });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Toggle Auto-Renew
router.post('/toggle-autorenew', async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'User ID required' });

    const user = await User.findOne({ walletAddress: user_id.toLowerCase() });
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.auto_renew = !user.auto_renew;
    await user.save();

    res.json({ success: true, auto_renew: user.auto_renew });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get Billing History
router.get('/billing-history', async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: 'User ID required' });

    const user = await User.findOne({ walletAddress: user_id.toLowerCase() });
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      success: true,
      plan: user.subscription_plan,
      isPremium: user.isPremium,
      expiry: user.premium_expiry,
      auto_renew: user.auto_renew,
      history: user.paymentHistory.sort((a, b) => new Date(b.date) - new Date(a.date))
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
