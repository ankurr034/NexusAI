import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

const mockFork = vi.fn().mockImplementation(() => {
  return {
    on: vi.fn(),
    kill: vi.fn()
  };
});

vi.mock('child_process', () => {
  return {
    fork: mockFork
  };
});

// Mock authentication middleware
vi.mock('../middleware/auth.js', () => ({
  requireAuth: (req, res, next) => {
    req.user = { id: 'admin_user_id', username: 'admin' };
    next();
  }
}));

describe('Scale Administration Router', () => {
  let mockReq;
  let mockRes;
  let next;
  let scaleAdminRouter;

  beforeAll(async () => {
    const mod = await import('../routes/scaleAdmin.js');
    scaleAdminRouter = mod.default;
  });

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

  it('POST /start - starts scale load simulator process', async () => {
    mockReq.body = { duration: 10000, connections: 500, rampUp: 2000 };
    // Find POST /start handler
    const startHandler = scaleAdminRouter.stack.find(s => s.route?.path === '/start' && s.route?.methods?.post).route.stack[1].handle;
    await startHandler(mockReq, mockRes);

    expect(mockFork).toHaveBeenCalled();
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      message: expect.stringContaining('scale simulation started')
    }));
  });

  it('POST /report - records status and telemetry reporting details', async () => {
    mockReq.body = {
      status: 'running',
      activeConnections: 120,
      targetConnections: 500,
      messagesReceived: 450,
      avgLatencyMs: 12.5,
      disconnects: 0,
      errors: 0,
      elapsedSeconds: 2.5
    };
    
    // Find POST /report handler
    const reportHandler = scaleAdminRouter.stack.find(s => s.route?.path === '/report' && s.route?.methods?.post).route.stack[0].handle;
    await reportHandler(mockReq, mockRes);

    expect(mockRes.json).toHaveBeenCalledWith({ success: true });
  });

  it('GET /status - retrieves cached load test status metrics', async () => {
    // Find GET /status handler
    const statusHandler = scaleAdminRouter.stack.find(s => s.route?.path === '/status' && s.route?.methods?.get).route.stack[1].handle;
    await statusHandler(mockReq, mockRes);

    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'running',
      activeConnections: 120,
      targetConnections: 500
    }));
  });

  it('POST /stop - terminates active child load processes', async () => {
    // Find POST /stop handler
    const stopHandler = scaleAdminRouter.stack.find(s => s.route?.path === '/stop' && s.route?.methods?.post).route.stack[1].handle;
    await stopHandler(mockReq, mockRes);

    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      message: expect.stringContaining('terminated successfully')
    }));
  });
});
