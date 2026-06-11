// ═══════════════════════════════════════════════════════════
//  Pure ledger math — no I/O, no globals. Kept separate so the
//  money-critical logic can be unit-tested in isolation.
// ═══════════════════════════════════════════════════════════

/**
 * Apply a slippage model to a base execution price.
 * BUY fills slightly worse (higher), SELL slightly worse (lower).
 * @param {number} basePrice
 * @param {'BUY'|'SELL'} action
 * @param {number} slippagePct - fractional (e.g. 0.001 = 0.1%)
 * @returns {{ fillPrice: number, slippageVal: number }}
 */
export function applySlippage(basePrice, action, slippagePct) {
  const slippageVal = basePrice * slippagePct;
  const fillPrice = action === 'BUY' ? basePrice + slippageVal : basePrice - slippageVal;
  return { fillPrice, slippageVal };
}

/**
 * Compute the resulting position + cash delta for a BUY.
 * Average price is the cost-basis weighted average.
 * @param {{quantity:number, averagePrice:number, realizedPnl:number}} position
 * @param {number} qty
 * @param {number} fillPrice
 * @returns {{ position: object, cashDelta: number }}  cashDelta is negative (cash out)
 */
export function applyBuy(position, qty, fillPrice) {
  if (qty <= 0) throw new Error('Buy quantity must be positive');
  const orderValue = fillPrice * qty;
  const totalQty = position.quantity + qty;
  const totalCost = position.quantity * position.averagePrice + orderValue;
  return {
    position: {
      quantity: totalQty,
      averagePrice: totalCost / totalQty,
      realizedPnl: position.realizedPnl
    },
    cashDelta: -orderValue
  };
}

/**
 * Compute the resulting position + cash delta + realized P&L for a SELL.
 * Rejects selling more than held (no short-selling in sandbox).
 * @returns {{ position: object, cashDelta: number, pnl: number }}  cashDelta is positive (cash in)
 */
export function applySell(position, qty, fillPrice) {
  if (qty <= 0) throw new Error('Sell quantity must be positive');
  if (position.quantity < qty) throw new Error('Insufficient quantity — short selling not permitted');
  const orderValue = fillPrice * qty;
  const pnl = (fillPrice - position.averagePrice) * qty;
  const remaining = position.quantity - qty;
  return {
    position: {
      quantity: remaining,
      // Average price is meaningless once flat; keep last basis until re-entry.
      averagePrice: remaining === 0 ? 0 : position.averagePrice,
      realizedPnl: position.realizedPnl + pnl
    },
    cashDelta: orderValue,
    pnl
  };
}

/**
 * Build a STABLE idempotency key for an order. Never include a raw
 * timestamp here, or every key is unique and dedup can never fire.
 * An optional time bucket (whole seconds) gives a coarse retry window
 * without making every call unique.
 */
export function buildIdempotencyKey({ accountRef, symbol, action, quantity, bucketSeconds }) {
  const base = `${accountRef}_${symbol}_${action}_${quantity}`;
  return bucketSeconds ? `${base}_${bucketSeconds}` : base;
}
