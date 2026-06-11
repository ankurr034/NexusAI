import { describe, it, expect } from 'vitest';
import { applySlippage, applyBuy, applySell, buildIdempotencyKey } from '../services/ledgerMath.js';

const flat = { quantity: 0, averagePrice: 0, realizedPnl: 0 };

describe('applySlippage', () => {
  it('fills a BUY worse (higher) than base price', () => {
    const { fillPrice, slippageVal } = applySlippage(100, 'BUY', 0.001);
    expect(fillPrice).toBeCloseTo(100.1, 6);
    expect(slippageVal).toBeCloseTo(0.1, 6);
  });

  it('fills a SELL worse (lower) than base price', () => {
    const { fillPrice } = applySlippage(100, 'SELL', 0.001);
    expect(fillPrice).toBeCloseTo(99.9, 6);
  });

  it('is a no-op at zero slippage', () => {
    expect(applySlippage(250, 'BUY', 0).fillPrice).toBe(250);
  });
});

describe('applyBuy', () => {
  it('opens a position at the fill price', () => {
    const { position, cashDelta } = applyBuy(flat, 10, 100);
    expect(position.quantity).toBe(10);
    expect(position.averagePrice).toBe(100);
    expect(cashDelta).toBe(-1000); // cash leaves the account
  });

  it('computes a cost-basis weighted average across two buys', () => {
    const first = applyBuy(flat, 10, 100).position;       // 10 @ 100
    const second = applyBuy(first, 10, 200).position;      // +10 @ 200
    expect(second.quantity).toBe(20);
    expect(second.averagePrice).toBe(150);                 // (1000+2000)/20
  });

  it('rejects non-positive quantity', () => {
    expect(() => applyBuy(flat, 0, 100)).toThrow();
    expect(() => applyBuy(flat, -5, 100)).toThrow();
  });
});

describe('applySell', () => {
  it('realizes profit against the average basis', () => {
    const pos = applyBuy(flat, 10, 100).position;          // basis 100
    const { position, cashDelta, pnl } = applySell(pos, 10, 120);
    expect(pnl).toBe(200);                                  // (120-100)*10
    expect(cashDelta).toBe(1200);                           // cash returns
    expect(position.quantity).toBe(0);
    expect(position.averagePrice).toBe(0);                  // flat resets basis
    expect(position.realizedPnl).toBe(200);
  });

  it('realizes a loss correctly', () => {
    const pos = applyBuy(flat, 10, 100).position;
    const { pnl } = applySell(pos, 5, 80);
    expect(pnl).toBe(-100);                                 // (80-100)*5
  });

  it('keeps the basis on a partial sell', () => {
    const pos = applyBuy(flat, 10, 100).position;
    const { position } = applySell(pos, 4, 150);
    expect(position.quantity).toBe(6);
    expect(position.averagePrice).toBe(100);
  });

  it('refuses to sell more than held (no short-selling)', () => {
    const pos = applyBuy(flat, 3, 100).position;
    expect(() => applySell(pos, 5, 100)).toThrow(/short selling/i);
  });

  it('accumulates realized P&L across multiple sells', () => {
    let pos = applyBuy(flat, 10, 100).position;
    pos = applySell(pos, 5, 110).position;                 // +50
    pos = applySell(pos, 5, 90).position;                  // -50
    expect(pos.realizedPnl).toBe(0);
    expect(pos.quantity).toBe(0);
  });
});

describe('buildIdempotencyKey', () => {
  it('is stable for identical orders (no embedded timestamp)', () => {
    const a = buildIdempotencyKey({ accountRef: 'u1', symbol: 'RELIANCE', action: 'BUY', quantity: 10 });
    const b = buildIdempotencyKey({ accountRef: 'u1', symbol: 'RELIANCE', action: 'BUY', quantity: 10 });
    expect(a).toBe(b); // <- the original Date.now() bug made these differ
  });

  it('differs when any identifying field differs', () => {
    const base = { accountRef: 'u1', symbol: 'RELIANCE', action: 'BUY', quantity: 10 };
    expect(buildIdempotencyKey(base)).not.toBe(buildIdempotencyKey({ ...base, quantity: 11 }));
    expect(buildIdempotencyKey(base)).not.toBe(buildIdempotencyKey({ ...base, action: 'SELL' }));
  });

  it('separates orders into coarse time buckets when provided', () => {
    const k1 = buildIdempotencyKey({ accountRef: 'u1', symbol: 'X', action: 'BUY', quantity: 1, bucketSeconds: 100 });
    const k2 = buildIdempotencyKey({ accountRef: 'u1', symbol: 'X', action: 'BUY', quantity: 1, bucketSeconds: 101 });
    expect(k1).not.toBe(k2);
  });
});
