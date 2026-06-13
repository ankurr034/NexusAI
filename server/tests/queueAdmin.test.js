import { describe, it, expect, vi, beforeEach } from 'vitest';
import queueAdminRouter from '../routes/queueAdmin.js';

// Mock queueManager
const mockClean = vi.fn().mockResolvedValue(['job1']);
const mockGetFailed = vi.fn().mockResolvedValue([{ id: 'job_failed_1', retry: vi.fn() }]);
const mockAdd = vi.fn().mockResolvedValue({ id: 'job_test_1' });
const mockGetActiveCount = vi.fn().mockResolvedValue(1);
const mockGetWaitingCount = vi.fn().mockResolvedValue(2);
const mockGetCompletedCount = vi.fn().mockResolvedValue(10);
const mockGetFailedCount = vi.fn().mockResolvedValue(3);
const mockGetDelayedCount = vi.fn().mockResolvedValue(0);

const mockQueues = {
  aiQueue: {
    clean: mockClean,
    getFailed: mockGetFailed,
    add: mockAdd,
    getActiveCount: mockGetActiveCount,
    getWaitingCount: mockGetWaitingCount,
    getCompletedCount: mockGetCompletedCount,
    getFailedCount: mockGetFailedCount,
    getDelayedCount: mockGetDelayedCount
  },
  notificationQueue: null,
  auditQueue: null,
  brokerQueue: null
};

vi.mock('../services/queueManager.js', () => ({
  getQueues: () => mockQueues
}));

// Mock audit logging
vi.mock('../middleware/audit.js', () => ({
  writeAuditLog: vi.fn()
}));

// Mock authentication middleware
vi.mock('../middleware/auth.js', () => ({
  requireAuth: (req, res, next) => {
    req.user = { id: 'admin_user_id', username: 'admin' };
    next();
  }
}));

describe('Queue Administration Router', () => {
  let mockReq;
  let mockRes;
  let next;

  beforeEach(() => {
    mockReq = {
      body: {},
      user: { id: 'admin_user_id', username: 'admin' },
      ip: '127.0.0.1',
      headers: {}
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    next = vi.fn();
    vi.clearAllMocks();
  });

  it('GET / - retrieves queue statistics and computes failure rate', async () => {
    // Extract GET handler
    const getHandler = queueAdminRouter.stack.find(s => s.route?.methods?.get).route.stack[1].handle;
    await getHandler(mockReq, mockRes);

    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'active',
      queues: expect.objectContaining({
        aiQueue: expect.objectContaining({
          active: 1,
          waiting: 2,
          completed: 10,
          failed: 3,
          delayed: 0,
          failedPercentage: '23.1' // 3 / 13 = 23.07%
        }),
        notificationQueue: 'offline'
      })
    }));
  });

  it('POST /clean - cleans completed and failed jobs', async () => {
    mockReq.body = { queueName: 'aiQueue' };
    // Find POST /clean handler
    const cleanHandler = queueAdminRouter.stack.find(s => s.route?.path === '/clean' && s.route?.methods?.post).route.stack[2].handle;
    await cleanHandler(mockReq, mockRes);

    expect(mockClean).toHaveBeenCalledWith(0, 1000, 'completed');
    expect(mockClean).toHaveBeenCalledWith(0, 1000, 'failed');
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      message: 'Successfully cleaned queue aiQueue'
    }));
  });

  it('POST /retry - retries failed jobs idempotently', async () => {
    mockReq.body = { queueName: 'aiQueue' };
    // Find POST /retry handler
    const retryHandler = queueAdminRouter.stack.find(s => s.route?.path === '/retry' && s.route?.methods?.post).route.stack[2].handle;
    await retryHandler(mockReq, mockRes);

    expect(mockGetFailed).toHaveBeenCalled();
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      retriedCount: 1
    }));
  });

  it('POST /trigger-test - schedules a mock job', async () => {
    mockReq.body = { queueName: 'aiQueue' };
    // Find POST /trigger-test handler
    const testHandler = queueAdminRouter.stack.find(s => s.route?.path === '/trigger-test' && s.route?.methods?.post).route.stack[2].handle;
    await testHandler(mockReq, mockRes);

    expect(mockAdd).toHaveBeenCalled();
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      message: expect.stringContaining('Enqueued test job')
    }));
  });
});
