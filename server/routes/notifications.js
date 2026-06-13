import express from 'express';
import mongoose from 'mongoose';
import { addNotificationJob } from '../services/queueManager.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════
//  Notification Model (inline to keep it self-contained)
// ═══════════════════════════════════════════════════════════
const notificationSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, enum: ['info', 'buy', 'sell', 'alert', 'system', 'payment'], default: 'info' },
  isRead: { type: Boolean, default: false },
  link: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});
notificationSchema.index({ userId: 1, createdAt: -1 });
const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);

// ═══════════════════════════════════════════════════════════
//  GET /api/notifications — Fetch user notifications
// ═══════════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const userId = req.query.user_id;
    if (!userId) return res.status(400).json({ detail: 'user_id required' });

    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    // If no notifications exist yet, seed some welcome defaults
    if (notifications.length === 0) {
      const defaults = [
        { userId, title: 'Welcome to NexusAI', message: 'Your trading account has been set up with ₹10,00,000 demo credits.', type: 'system' },
        { userId, title: 'Market Open', message: 'NSE markets are now open for trading. NIFTY 50 opened higher today.', type: 'info' },
        { userId, title: 'Complete Your KYC', message: 'Verify your identity to unlock live trading and withdrawals.', type: 'alert', link: '/kyc' }
      ];
      await Notification.insertMany(defaults);
      return res.json({
        notifications: defaults.map(n => ({
          id: n._id || 'temp',
          title: n.title,
          message: n.message,
          type: n.type,
          isRead: false,
          link: n.link,
          time: 'Just now'
        })),
        unreadCount: defaults.length
      });
    }

    const formattedNotifs = notifications.map(n => ({
      id: n._id,
      title: n.title,
      message: n.message,
      type: n.type,
      isRead: n.isRead,
      link: n.link,
      time: formatTimeAgo(n.createdAt)
    }));

    const unreadCount = notifications.filter(n => !n.isRead).length;

    res.json({ notifications: formattedNotifs, unreadCount });
  } catch (err) {
    console.error('[NOTIFICATIONS] Fetch error:', err.message);
    res.status(500).json({ detail: 'Failed to fetch notifications' });
  }
});

// ═══════════════════════════════════════════════════════════
//  POST /api/notifications/read — Mark all as read
// ═══════════════════════════════════════════════════════════
router.post('/read', async (req, res) => {
  try {
    const userId = req.query.user_id;
    if (!userId) return res.status(400).json({ detail: 'user_id required' });

    await Notification.updateMany({ userId, isRead: false }, { $set: { isRead: true } });

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    console.error('[NOTIFICATIONS] Mark-read error:', err.message);
    res.status(500).json({ detail: 'Failed to mark notifications as read' });
  }
});

// ═══════════════════════════════════════════════════════════
//  Helper: Push a notification (used by other services)
// ═══════════════════════════════════════════════════════════
export async function pushNotification(userId, title, message, type = 'info', link = null) {
  const data = { userId, title, message, type, link };
  const executeInline = async () => {
    await Notification.create(data);
  };
  await addNotificationJob(data, executeInline);
}

// ═══════════════════════════════════════════════════════════
//  Time formatting helper
// ═══════════════════════════════════════════════════════════
function formatTimeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

export default router;
