import express from 'express';
import { PaperOrder } from '../models/PaperTrading.js';
import { requireAuth } from '../middleware/auth.js';
import { requestSanitizer } from '../middleware/security.js';
import { writeAuditLog } from '../middleware/audit.js';

const router = express.Router();

router.use(requestSanitizer);
router.use(requireAuth);

// ═══════════════════════════════════════════════════════════
//  GET /api/orders — Fetch orders with optional status filter
// ═══════════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const { user_id, status } = req.query;
    if (!user_id) return res.status(400).json({ detail: 'user_id required' });

    const filter = { userId: user_id };
    
    // Map frontend filter to DB statuses
    if (status && status !== 'ALL') {
      if (status === 'OPEN') {
        filter.status = 'PENDING';
      } else if (status === 'COMPLETED' || status === 'EXECUTED') {
        filter.status = 'FILLED';
      } else if (status === 'CANCELLED' || status === 'CANCELED') {
        filter.status = 'CANCELED';
      } else if (status === 'REJECTED') {
        filter.status = 'REJECTED';
      }
    }

    const orders = await PaperOrder.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // Format for frontend OrderBook.jsx schema
    const formattedOrders = orders.map(o => ({
      order_id: o.orderId,
      symbol: o.symbol,
      action: o.action,
      quantity: o.quantity,
      order_type: o.orderType,
      status: o.status === 'FILLED' ? 'EXECUTED' : o.status,
      fill_price: o.fillPrice || null,
      price: o.price || o.fillPrice || null,
      slippage: o.slippage || 0,
      timestamp: o.createdAt,
      date: new Date(o.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
      time: new Date(o.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      is_paper: true,
      exchange: 'NSE',
      product: 'CNC'
    }));

    // Compute summary stats
    const totalOrders = formattedOrders.length;
    const executedOrders = formattedOrders.filter(o => o.status === 'EXECUTED').length;
    const pendingOrders = formattedOrders.filter(o => o.status === 'PENDING').length;

    res.json({
      success: true,
      orders: formattedOrders,
      summary: {
        total: totalOrders,
        executed: executedOrders,
        pending: pendingOrders,
        cancelled: totalOrders - executedOrders - pendingOrders
      }
    });
  } catch (err) {
    console.error('[ORDERS] Fetch error:', err.message);
    res.status(500).json({ detail: 'Failed to fetch orders' });
  }
});

// ═══════════════════════════════════════════════════════════
//  POST /api/orders/cancel — Cancel a pending order
// ═══════════════════════════════════════════════════════════
router.post('/cancel', async (req, res) => {
  try {
    const { order_id, user_id } = req.body;
    if (!order_id) return res.status(400).json({ detail: 'order_id required' });

    const order = await PaperOrder.findOne({ orderId: order_id });
    if (!order) return res.status(404).json({ detail: 'Order not found' });

    // Security: ensure user owns this order
    if (user_id && order.userId !== user_id) {
      writeAuditLog(user_id, 'ORDER_CANCELLED', 'FAILURE', { reason: 'Unauthorized access', orderId: order_id }, req);
      return res.status(403).json({ detail: 'Unauthorized access to order' });
    }

    if (order.status !== 'PENDING') {
      writeAuditLog(user_id || order.userId, 'ORDER_CANCELLED', 'FAILURE', { reason: `Invalid status: ${order.status}`, orderId: order_id }, req);
      return res.status(400).json({ detail: `Cannot cancel order with status: ${order.status}` });
    }

    order.status = 'CANCELED';
    order.rejectReason = 'Cancelled by user';
    await order.save();

    writeAuditLog(order.userId, 'ORDER_CANCELLED', 'SUCCESS', { orderId: order_id, symbol: order.symbol, quantity: order.quantity }, req);

    console.log(`[ORDERS] Cancelled: ${order_id}`);
    res.json({ success: true, message: `Order ${order_id} cancelled successfully` });
  } catch (err) {
    console.error('[ORDERS] Cancel error:', err.message);
    writeAuditLog(req.body.user_id, 'ORDER_CANCELLED', 'FAILURE', { error: err.message, orderId: req.body.order_id }, req);
    res.status(500).json({ detail: 'Failed to cancel order' });
  }
});

// ═══════════════════════════════════════════════════════════
//  POST /api/gtt/cancel — Cancel a GTT (Good Till Triggered) order
// ═══════════════════════════════════════════════════════════
router.post('/gtt/cancel', async (req, res) => {
  try {
    const { order_id, user_id } = req.body;
    if (!order_id) return res.status(400).json({ detail: 'order_id required' });

    // GTT orders are stored as PENDING orders with a trigger price
    const order = await PaperOrder.findOne({ orderId: order_id, status: 'PENDING' });
    if (!order) return res.status(404).json({ detail: 'GTT order not found or already triggered' });

    if (user_id && order.userId !== user_id) {
      writeAuditLog(user_id, 'GTT_CANCELLED', 'FAILURE', { reason: 'Unauthorized access', orderId: order_id }, req);
      return res.status(403).json({ detail: 'Unauthorized' });
    }

    order.status = 'CANCELED';
    order.rejectReason = 'GTT cancelled by user';
    await order.save();

    writeAuditLog(order.userId, 'GTT_CANCELLED', 'SUCCESS', { orderId: order_id, symbol: order.symbol }, req);

    res.json({ success: true, message: `GTT order ${order_id} cancelled` });
  } catch (err) {
    console.error('[ORDERS] GTT cancel error:', err.message);
    writeAuditLog(req.body.user_id, 'GTT_CANCELLED', 'FAILURE', { error: err.message, orderId: req.body.order_id }, req);
    res.status(500).json({ detail: 'Failed to cancel GTT order' });
  }
});

export default router;
