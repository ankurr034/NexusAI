import 'dotenv/config';
import { io } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import http from 'http';
import { JWT_SECRET } from './utils/secrets.js';

const SERVER_URL = process.env.WS_URL || 'http://localhost:8000';
const CONCURRENT_USERS = 100;
const TEST_DURATION_MS = 15000; // 15 seconds

const activeSockets = [];
const latencies = [];
let droppedConnections = 0;
let messageCount = 0;

// Generate simulated JWT tokens for 100 clients
function generateToken(index) {
  return jwt.sign(
    { userId: `stress_user_${index}`, username: `stress_trader_${index}`, role: 'premium' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

// Fetch metrics from the server's Prometheus endpoint
function fetchServerMetrics() {
  return new Promise((resolve, reject) => {
    const metricsUrl = `${SERVER_URL}/api/metrics`;
    http.get(metricsUrl, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve(data);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Parse a specific metric value from Prometheus plain-text format
function parseMetric(body, name) {
  const line = body.split('\n').find(l => l.startsWith(name) && !l.startsWith('#'));
  if (!line) return 'N/A';
  return line.split(' ').pop();
}

async function startStressTest() {
  console.log('====================================================');
  console.log('       NEXUSAI WEBSOCKET CONCURRENCY STRESS TEST    ');
  console.log('====================================================');
  console.log(`Target Server: ${SERVER_URL}`);
  console.log(`Simulating: ${CONCURRENT_USERS} concurrent users...`);
  console.log('----------------------------------------------------\n');

  const initialMetricsBody = await fetchServerMetrics().catch(() => null);
  if (initialMetricsBody) {
    console.log('--- Initial Server State (from /api/metrics) ---');
    console.log(`Active Connections: ${parseMetric(initialMetricsBody, 'active_websocket_connections')}`);
    console.log(`Server Uptime: ${parseMetric(initialMetricsBody, 'process_uptime_seconds')}s`);
    console.log(`Heap Used: ${Math.round(parseInt(parseMetric(initialMetricsBody, 'process_memory_bytes{type="heapUsed"}') || '0') / 1024 / 1024)} MB`);
    console.log('----------------------------------------------------\n');
  } else {
    console.log('⚠️ Could not connect to metrics endpoint. Is the backend running?');
  }

  const startMem = process.memoryUsage().heapUsed;

  console.log(`Connecting ${CONCURRENT_USERS} clients...`);
  for (let i = 0; i < CONCURRENT_USERS; i++) {
    const token = generateToken(i);
    const socket = io(SERVER_URL, {
      auth: { userToken: `Bearer ${token}` },
      transports: ['websocket'],
      forceNew: true,
      reconnection: true
    });

    socket.on('connect', () => {
      // Subscription Burst
      socket.emit('subscribe_stock', 'RELIANCE');
      socket.emit('subscribe_stock', 'TCS');
      socket.emit('subscribe_microstructure', 'RELIANCE');
    });

    socket.on('connect_error', (err) => {
      droppedConnections++;
      if (droppedConnections <= 5) {
        console.error(`[STRESS CLIENT ${i}] Connection error:`, err.message, err.data || '');
      }
    });

    socket.on('disconnect', () => {
      // Disconnect tracking
    });

    socket.on('market_update', (data) => {
      messageCount++;
      if (data && data.timestamp) {
        const latency = Date.now() - data.timestamp;
        latencies.push(latency);
        if (latencies.length > 1000) latencies.shift(); // Bound memory
      }
    });

    activeSockets.push(socket);
  }

  // Wait for connections to stabilize
  await new Promise(resolve => setTimeout(resolve, 3000));
  console.log(`Connected: ${activeSockets.filter(s => s.connected).length}/${CONCURRENT_USERS} clients active.`);

  // Reconnection Storm Simulation
  console.log('\n⚡ Simulating RECONNECT STORM (forcing all clients to reconnect simultaneously)...');
  activeSockets.forEach(s => {
    s.io.disconnect();
    s.io.connect();
  });

  // Let them reconnect and run for a few seconds
  await new Promise(resolve => setTimeout(resolve, 4000));
  console.log(`Stabilized after storm. Active connections: ${activeSockets.filter(s => s.connected).length}`);

  // Subscription Bursts (bursting unsub/sub commands)
  console.log('\n🔥 Simulating SUBSCRIPTION BURST (sending bulk sub/unsub messages)...');
  activeSockets.forEach(s => {
    s.emit('unsubscribe_stock', 'RELIANCE');
    s.emit('subscribe_stock', 'HDFCBANK');
  });

  await new Promise(resolve => setTimeout(resolve, TEST_DURATION_MS - 7000));

  // Compute stats
  const endMem = process.memoryUsage().heapUsed;
  const memDiff = (endMem - startMem) / 1024 / 1024;
  const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
  const maxLatency = latencies.length > 0 ? Math.max(...latencies) : 0;

  console.log('\n====================================================');
  console.log('               STRESS TEST STATISTICS               ');
  console.log('====================================================');
  console.log(`Total Connections Attempted:  ${CONCURRENT_USERS}`);
  console.log(`Active Connections Now:      ${activeSockets.filter(s => s.connected).length}`);
  console.log(`Dropped Connections/Errors:  ${droppedConnections}`);
  console.log(`Total Broadcasts Received:    ${messageCount}`);
  console.log(`Average Delivery Latency:     ${avgLatency.toFixed(2)} ms`);
  console.log(`Max Delivery Latency:         ${maxLatency} ms`);
  console.log(`Test Client Memory Growth:    ${memDiff.toFixed(2)} MB`);

  // Server post-test stats
  const finalMetricsBody = await fetchServerMetrics().catch(() => null);
  if (finalMetricsBody) {
    console.log('\n--- Final Server State (from /api/metrics) ---');
    console.log(`Active Connections: ${parseMetric(finalMetricsBody, 'active_websocket_connections')}`);
    console.log(`WebSocket Reconnects: ${parseMetric(finalMetricsBody, 'websocket_reconnects_total')}`);
    console.log(`Heap Used: ${Math.round(parseInt(parseMetric(finalMetricsBody, 'process_memory_bytes{type="heapUsed"}') || '0') / 1024 / 1024)} MB`);
    console.log(`CPU User Ticks: ${parseMetric(finalMetricsBody, 'process_cpu_usage_ticks{type="user"}')}`);
    console.log(`CPU System Ticks: ${parseMetric(finalMetricsBody, 'process_cpu_usage_ticks{type="system"}')}`);
  }

  // Cleanup connections
  console.log('\nCleaning up connections...');
  activeSockets.forEach(s => s.disconnect());
  console.log('Done.');
  console.log('====================================================');
}

startStressTest().catch(console.error);
