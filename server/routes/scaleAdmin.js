import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { fork } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Shared state of the active load test
export let activeLoadTest = {
  status: 'idle', // 'idle' | 'running' | 'completed' | 'failed'
  activeConnections: 0,
  targetConnections: 0,
  messagesReceived: 0,
  avgLatencyMs: 0,
  disconnects: 0,
  errors: 0,
  elapsedSeconds: 0,
  history: [] // buffer of latency/connections over time
};

let childProcess = null;

// Allow bypass for metrics reporting endpoint
router.post('/report', async (req, res) => {
  const { status, activeConnections, targetConnections, messagesReceived, avgLatencyMs, disconnects, errors, elapsedSeconds } = req.body;
  
  activeLoadTest = {
    ...activeLoadTest,
    status,
    activeConnections,
    targetConnections,
    messagesReceived,
    avgLatencyMs,
    disconnects,
    errors,
    elapsedSeconds
  };

  // Log history points
  if (status === 'running') {
    activeLoadTest.history.push({
      time: Math.round(elapsedSeconds),
      connections: activeConnections,
      latency: avgLatencyMs
    });
  }

  res.json({ success: true });
});

// Helper to check if user is admin
function isAdmin(req) {
  return req.user?.username === 'admin' || req.user?.username === 'DemoUser';
}

router.get('/status', requireAuth, (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: 'Admin permissions required.' });
  }
  res.json(activeLoadTest);
});

router.post('/start', requireAuth, (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: 'Admin permissions required.' });
  }

  if (activeLoadTest.status === 'running') {
    return res.status(400).json({ error: 'A scale load test is already active.' });
  }

  const duration = req.body.duration || 30000;
  const connections = req.body.connections || 1000;
  const rampUp = req.body.rampUp || 10000;

  activeLoadTest = {
    status: 'running',
    activeConnections: 0,
    targetConnections: connections,
    messagesReceived: 0,
    avgLatencyMs: 0,
    disconnects: 0,
    errors: 0,
    elapsedSeconds: 0,
    history: []
  };

  const scriptPath = path.resolve(__dirname, '../../scripts/websocketLoadTest.js');

  try {
    childProcess = fork(scriptPath, [duration.toString(), connections.toString(), rampUp.toString()], {
      env: { ...process.env, API_BASE_URL: `http://localhost:${process.env.PORT || 5000}` }
    });

    childProcess.on('exit', (code) => {
      activeLoadTest.status = code === 0 ? 'completed' : 'failed';
      childProcess = null;
    });

    res.json({ success: true, message: `WebSocket scale simulation started targeting ${connections} clients.` });
  } catch (err) {
    activeLoadTest.status = 'failed';
    res.status(500).json({ error: 'Failed to trigger load simulator process', details: err.message });
  }
});

router.post('/stop', requireAuth, (req, res) => {
  if (!isAdmin(req)) {
    return res.status(403).json({ error: 'Admin permissions required.' });
  }

  if (childProcess) {
    childProcess.kill('SIGINT');
    childProcess = null;
    activeLoadTest.status = 'completed';
    return res.json({ success: true, message: 'Load test terminated successfully.' });
  }

  res.status(400).json({ error: 'No active load test found.' });
});

export default router;
