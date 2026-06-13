import { io } from 'socket.io-client';
import axios from 'axios';

const SERVER_URL = process.env.API_BASE_URL || 'http://localhost:5000';
const DURATION_MS = parseInt(process.argv[2]) || 30000; // default 30 seconds
const TARGET_CONNECTIONS = parseInt(process.argv[3]) || 1000; // default 1000 connections
const RAMP_UP_MS = parseInt(process.argv[4]) || 10000; // default 10s ramp up

console.log(`[LOAD_TEST] Starting load test targeting ${TARGET_CONNECTIONS} clients over ${DURATION_MS/1000}s`);

const clients = [];
let latencySum = 0;
let latencyCount = 0;
let messagesReceived = 0;
let disconnects = 0;
let errors = 0;

const startTime = Date.now();

// Report metrics back to the server
async function reportMetrics(status = 'running') {
  const elapsed = (Date.now() - startTime) / 1000;
  const avgLatency = latencyCount > 0 ? parseFloat((latencySum / latencyCount).toFixed(2)) : 0;
  
  const payload = {
    status,
    activeConnections: clients.filter(c => c.connected).length,
    targetConnections: TARGET_CONNECTIONS,
    messagesReceived,
    avgLatencyMs: avgLatency,
    disconnects,
    errors,
    elapsedSeconds: Math.min(elapsed, DURATION_MS / 1000)
  };

  try {
    await axios.post(`${SERVER_URL}/api/admin/scale/report`, payload, {
      headers: { 'x-user-token': 'Bearer test-admin-token-bypass' } // Bypass token checked on mock route
    });
  } catch (err) {
    // Fail silently if server endpoint not fully responsive during heavy load
  }
}

// Gradually spawn connections
const spawnInterval = RAMP_UP_MS / TARGET_CONNECTIONS;
let spawnedCount = 0;

const spawnTimer = setInterval(() => {
  if (spawnedCount >= TARGET_CONNECTIONS || Date.now() - startTime >= DURATION_MS) {
    clearInterval(spawnTimer);
    return;
  }

  const socket = io(SERVER_URL, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: true
  });

  socket.on('connect', () => {
    socket.emit('join_heatmap', 'NIFTY_50');
  });

  socket.on('market_heatmap_update', (data) => {
    messagesReceived++;
    if (data.timestamp) {
      const latency = Date.now() - data.timestamp;
      // Filter extreme anomalies out of average calculation
      if (latency >= 0 && latency < 5000) {
        latencySum += latency;
        latencyCount++;
      }
    }
  });

  socket.on('disconnect', () => {
    disconnects++;
  });

  socket.on('connect_error', () => {
    errors++;
  });

  clients.push(socket);
  spawnedCount++;
}, spawnInterval);

// Periodic status updates
const statusTimer = setInterval(() => {
  reportMetrics('running');
}, 1000);

// Cleanup
setTimeout(() => {
  clearInterval(spawnTimer);
  clearInterval(statusTimer);
  
  console.log(`[LOAD_TEST] Completed. Disconnecting all ${clients.length} clients...`);
  reportMetrics('completed').finally(() => {
    clients.forEach(socket => {
      try {
        socket.disconnect();
      } catch {}
    });
    process.exit(0);
  });
}, DURATION_MS);
