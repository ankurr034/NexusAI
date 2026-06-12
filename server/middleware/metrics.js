/**
 * metrics.js
 * Lightweight Prometheus-compatible telemetry and application monitoring.
 */

// Application telemetry counters
const metrics = {
  httpRequests: new Map(), // key: 'method:route:status' -> value: count
  httpLatencies: [],       // list of recent request latencies (ms)
  orderExecutedCount: 0,
  walletMutationCount: 0,
  activeWebsockets: 0,
  websocketReconnects: 0
};

// Log request latency and count
export const trackMetricsMiddleware = (req, res, next) => {
  if (req.path === '/api/metrics') return next();

  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    // Track latency
    metrics.httpLatencies.push(duration);
    if (metrics.httpLatencies.length > 500) {
      metrics.httpLatencies.shift(); // Keep window size bounded to 500 records
    }

    // Track request count
    const route = req.route ? req.route.path : req.path;
    const key = `${req.method}:${route}:${res.statusCode}`;
    metrics.httpRequests.set(key, (metrics.httpRequests.get(key) || 0) + 1);
  });

  next();
};

// Operational metrics increments
export const incrementOrderExecuted = () => { metrics.orderExecutedCount++; };
export const incrementWalletMutation = () => { metrics.walletMutationCount++; };
export const incrementActiveWebsockets = () => { metrics.activeWebsockets++; };
export const decrementActiveWebsockets = () => { metrics.activeWebsockets = Math.max(0, metrics.activeWebsockets - 1); };
export const incrementSocketReconnect = () => { metrics.websocketReconnects++; };

// Compute latency percentiles
const getLatencyPercentile = (p) => {
  if (metrics.httpLatencies.length === 0) return 0;
  const sorted = [...metrics.httpLatencies].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.min(idx, sorted.length - 1)];
};

// Generate Prometheus scraping format
export const getPrometheusMetrics = () => {
  const memory = process.memoryUsage();
  const uptime = process.uptime();
  const cpu = process.cpuUsage();

  let payload = '';

  // 1. Process stats
  payload += `# HELP process_uptime_seconds Process uptime in seconds\n`;
  payload += `# TYPE process_uptime_seconds gauge\n`;
  payload += `process_uptime_seconds ${uptime.toFixed(2)}\n\n`;

  payload += `# HELP process_memory_bytes Memory utilization in bytes\n`;
  payload += `# TYPE process_memory_bytes gauge\n`;
  payload += `process_memory_bytes{type="rss"} ${memory.rss}\n`;
  payload += `process_memory_bytes{type="heapTotal"} ${memory.heapTotal}\n`;
  payload += `process_memory_bytes{type="heapUsed"} ${memory.heapUsed}\n\n`;

  payload += `# HELP process_cpu_usage_ticks CPU usage ticks\n`;
  payload += `# TYPE process_cpu_usage_ticks gauge\n`;
  payload += `process_cpu_usage_ticks{type="user"} ${cpu.user}\n`;
  payload += `process_cpu_usage_ticks{type="system"} ${cpu.system}\n\n`;

  // 2. HTTP counts
  payload += `# HELP http_requests_total Total number of HTTP requests\n`;
  payload += `# TYPE http_requests_total counter\n`;
  for (const [key, count] of metrics.httpRequests.entries()) {
    const [method, route, status] = key.split(':');
    payload += `http_requests_total{method="${method}",route="${route}",status="${status}"} ${count}\n`;
  }
  payload += `\n`;

  // 3. HTTP Latency Percentiles
  payload += `# HELP http_request_duration_ms HTTP request duration in milliseconds\n`;
  payload += `# TYPE http_request_duration_ms gauge\n`;
  payload += `http_request_duration_ms{quantile="0.5"} ${getLatencyPercentile(0.5)}\n`;
  payload += `http_request_duration_ms{quantile="0.9"} ${getLatencyPercentile(0.9)}\n`;
  payload += `http_request_duration_ms{quantile="0.99"} ${getLatencyPercentile(0.99)}\n\n`;

  // 4. WebSocket counts
  payload += `# HELP active_websocket_connections Current active WebSocket connections\n`;
  payload += `# TYPE active_websocket_connections gauge\n`;
  payload += `active_websocket_connections ${metrics.activeWebsockets}\n\n`;

  payload += `# HELP websocket_reconnects_total Total WebSocket reconnections\n`;
  payload += `# TYPE websocket_reconnects_total counter\n`;
  payload += `websocket_reconnects_total ${metrics.websocketReconnects}\n\n`;

  // 5. Business Operations
  payload += `# HELP order_executions_total Total completed order executions\n`;
  payload += `# TYPE order_executions_total counter\n`;
  payload += `order_executions_total ${metrics.orderExecutedCount}\n\n`;

  payload += `# HELP wallet_mutations_total Total ledger-backed wallet balance changes\n`;
  payload += `# TYPE wallet_mutations_total counter\n`;
  payload += `wallet_mutations_total ${metrics.walletMutationCount}\n`;

  return payload;
};
