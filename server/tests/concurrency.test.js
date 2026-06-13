import { describe, it, expect, vi } from 'vitest';
import OrderExecutionMutex from '../utils/orderMutex.js';
import { IdempotencyManager } from '../utils/idempotency.js';

describe('OrderExecutionMutex (Per-user Serialization Mutex)', () => {
  it('serializes concurrent execution requests for the same user without overlap', async () => {
    const executionOrder = [];
    const executionTimes = [];

    const createTask = (id, delayMs) => async (lockAcquiredTime) => {
      const start = performance.now();
      executionOrder.push(`start-${id}`);
      await new Promise(r => setTimeout(r, delayMs));
      executionOrder.push(`end-${id}`);
      const end = performance.now();
      executionTimes.push({ id, start, end });
      return id;
    };

    // Fire 3 tasks concurrently for the same user 'user1'
    const results = await Promise.all([
      OrderExecutionMutex.acquireAndExecute('user1', createTask(1, 40)),
      OrderExecutionMutex.acquireAndExecute('user1', createTask(2, 20)),
      OrderExecutionMutex.acquireAndExecute('user1', createTask(3, 10))
    ]);

    expect(results).toEqual([1, 2, 3]);

    // Check that start-X happens before end-X, and there is NO overlapping execution
    // i.e., start-2 happens only after end-1, and start-3 happens only after end-2.
    expect(executionOrder).toEqual([
      'start-1', 'end-1',
      'start-2', 'end-2',
      'start-3', 'end-3'
    ]);

    // Verify times do not overlap
    for (let i = 0; i < executionTimes.length - 1; i++) {
      expect(executionTimes[i].end).toBeLessThanOrEqual(executionTimes[i + 1].start);
    }
  });

  it('handles rejected promises safely without breaking future queue items', async () => {
    const executionOrder = [];

    const successTask = (id) => async () => {
      executionOrder.push(`success-${id}`);
      return id;
    };

    const failingTask = () => async () => {
      executionOrder.push('fail');
      throw new Error('Task Failed');
    };

    // Chain success, fail, success tasks
    const p1 = OrderExecutionMutex.acquireAndExecute('user2', successTask(1));
    const p2 = OrderExecutionMutex.acquireAndExecute('user2', failingTask());
    const p3 = OrderExecutionMutex.acquireAndExecute('user2', successTask(2));

    await expect(p1).resolves.toBe(1);
    await expect(p2).rejects.toThrow('Task Failed');
    await expect(p3).resolves.toBe(2);

    expect(executionOrder).toEqual(['success-1', 'fail', 'success-2']);
  });
});

describe('IdempotencyManager (UUID Idempotency Cache)', () => {
  it('registers new key and flags duplicates/misuse', async () => {
    const key = 'test-idempotency-uuid-1';
    const payload = { symbol: 'RELIANCE', qty: 10 };
    const wrongPayload = { symbol: 'TCS', qty: 10 };

    // 1. Initial request
    const r1 = await IdempotencyManager.checkAndRegister(key, payload);
    expect(r1.status).toBe('new');

    // 2. Duplicate while processing (locks key in processing status)
    const r2 = await IdempotencyManager.checkAndRegister(key, payload);
    expect(r2.status).toBe('processing');

    // 3. Reject different payload misuse
    await expect(IdempotencyManager.checkAndRegister(key, wrongPayload)).rejects.toThrow('MISUSE_ERROR');

    // 4. Resolve the key
    const successResponse = { success: true, orderId: 'PAPER_123' };
    await IdempotencyManager.resolve(key, successResponse, 200);

    // 5. Replay completed response
    const r3 = await IdempotencyManager.checkAndRegister(key, payload);
    expect(r3.status).toBe('completed');
    expect(r3.response).toEqual(successResponse);
    expect(r3.statusCode).toBe(200);
  });

  it('releases key on execution failure to allow retry', async () => {
    const key = 'test-idempotency-uuid-2';
    const payload = { symbol: 'INFY', qty: 5 };

    await IdempotencyManager.checkAndRegister(key, payload);
    
    // Release key
    await IdempotencyManager.release(key);

    // Should be able to register again
    const r = await IdempotencyManager.checkAndRegister(key, payload);
    expect(r.status).toBe('new');
    
    // Clean up
    await IdempotencyManager.release(key);
  });
});
