/**
 * security.js
 * Centralized sanitization and threat protection middleware.
 */

// Helper to recursively check and sanitize keys
export const sanitizeData = (data) => {
  if (data === null || data === undefined) return data;

  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item));
  }

  if (typeof data === 'object') {
    const clean = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        // Block property names starting with $ or containing . (NoSQL Operator Injection)
        if (key.startsWith('$') || key.includes('.')) {
          console.warn(`[SECURITY] Blocked injection attempt key: ${key}`);
          continue;
        }
        clean[key] = sanitizeData(data[key]);
      }
    }
    return clean;
  }

  return data;
};

// Middleware to sanitize request bodies, queries, and params
export const requestSanitizer = (req, res, next) => {
  try {
    if (req.body) req.body = sanitizeData(req.body);
    if (req.query) req.query = sanitizeData(req.query);
    if (req.params) req.params = sanitizeData(req.params);
    next();
  } catch (err) {
    console.error('[SECURITY] Sanitization error:', err);
    res.status(400).json({ success: false, error: 'Malformed request payload' });
  }
};

// Generic type and value validators for high-risk parameters
export const validateWalletAmount = (req, res, next) => {
  const amount = parseFloat(req.body.amount || req.query.amount);
  if (req.body.amount !== undefined || req.query.amount !== undefined) {
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Transaction amount must be a positive number' });
    }
  }
  next();
};

export const validateOrderParams = (req, res, next) => {
  const { symbol, quantity, order_type, action } = req.body;
  if (req.method === 'POST') {
    if (!symbol || typeof symbol !== 'string' || symbol.trim() === '') {
      return res.status(400).json({ success: false, error: 'Invalid or missing symbol parameter' });
    }
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ success: false, error: 'Order quantity must be a positive integer' });
    }
    if (order_type && !['LIMIT', 'MARKET'].includes(order_type.toUpperCase())) {
      return res.status(400).json({ success: false, error: 'Invalid order type' });
    }
    if (action && !['BUY', 'SELL'].includes(action.toUpperCase())) {
      return res.status(400).json({ success: false, error: 'Invalid order action' });
    }
  }
  next();
};
