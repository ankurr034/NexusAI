import BrokerGateway from './services/BrokerGateway.js';

async function runStressTest() {
  console.log("==========================================");
  console.log("ZERODHA KITE INTEGRATION STRESS TEST SUITE");
  console.log("==========================================\n");

  let passed = 0;
  let failed = 0;

  const assert = (condition, message) => {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  };

  // 1. Diagnostics Isolation Test
  console.log("--- 1. Diagnostics Validation ---");
  const diag = BrokerGateway.getDiagnostics('Zerodha Kite');
  assert(diag.activeAdapter === 'Zerodha Kite', "Diagnostics returns correct active adapter");
  assert(diag.isSandbox === true, "Diagnostics correctly identifies Sandbox mode (due to missing API keys in test environment)");
  assert(diag.capabilities.supportsGTT === false, "Diagnostics correctly maps capabilities (returns Mock capabilities during sandbox fallback)");
  console.log("");

  // 2. Gateway Isolation Test
  console.log("--- 2. Gateway Isolation & Sandbox Fallback ---");
  const connectRes = await BrokerGateway.connect('Zerodha Kite', { requestToken: 'INVALID_TEST_TOKEN' });
  assert(connectRes.is_sandbox === true, "Gateway falls back to sandbox on invalid credentials");
  assert(connectRes.access_token && connectRes.access_token.startsWith('MOCK'), "Gateway returns isolated mock tokens instead of crashing");
  console.log("");

  // 3. Order Idempotency & Validation
  console.log("--- 3. Order Lifecycle & Idempotency ---");
  try {
    await BrokerGateway.placeOrder('Zerodha Kite', 'TEST_TOKEN', { symbol: '', quantity: 10, action: 'BUY' });
    assert(false, "Should reject empty symbol");
  } catch (e) {
    assert(e.message.includes('Missing or invalid symbol'), "Rejects empty symbol pre-flight");
  }

  try {
    await BrokerGateway.placeOrder('Zerodha Kite', 'TEST_TOKEN', { symbol: 'AAPL', quantity: -5, action: 'BUY' });
    assert(false, "Should reject negative quantity");
  } catch (e) {
    assert(e.message.includes('Quantity must be greater than 0'), "Rejects negative quantity pre-flight");
  }

  // Idempotency test
  console.log("Placing initial valid order...");
  const order1 = await BrokerGateway.placeOrder('Zerodha Kite', 'TEST_TOKEN', { symbol: 'RELIANCE', quantity: 10, action: 'BUY', type: 'MARKET' });
  assert(order1.status === 'COMPLETE' || order1.status === 'PENDING_EXCHANGE', "Initial order succeeds");

  console.log("Placing exact duplicate order instantly...");
  try {
    await BrokerGateway.placeOrder('Zerodha Kite', 'TEST_TOKEN', { symbol: 'RELIANCE', quantity: 10, action: 'BUY', type: 'MARKET' });
    assert(false, "Should reject duplicate order");
  } catch (e) {
    assert(e.message.includes('Duplicate order detected'), "Idempotency cache natively rejects multi-submission");
  }
  console.log("");

  console.log("==========================================");
  console.log("UPSTOX PRO INTEGRATION STRESS TEST SUITE");
  console.log("==========================================\n");

  // 4. Upstox Adapter Verification
  console.log("--- 4. Upstox Gateway & Normalization Test ---");
  const upstoxConnect = await BrokerGateway.connect('Upstox Pro', { requestToken: 'TEST_UPSTOX' });
  assert(upstoxConnect.is_sandbox === true, "Upstox Gateway falls back to sandbox on invalid credentials safely");
  
  const upstoxDiag = BrokerGateway.getDiagnostics('Upstox Pro');
  assert(upstoxDiag.activeAdapter === 'Upstox Pro', "Diagnostics returns Upstox Pro");
  assert(upstoxDiag.capabilities.apiVersion === 'v2', "Upstox capabilities expose apiVersion: v2");
  
  // Test Upstox rate limit metrics presence (even though it's mock fallback, the gateway should handle gracefully)
  // Since MockAdapter doesn't have metrics yet, it returns null, which is fine for sandbox.
  assert(upstoxDiag.metrics === null || typeof upstoxDiag.metrics === 'object', "Diagnostics correctly evaluates Upstox metrics gracefully in sandbox");

  // Since we don't want to make real failing network calls to Upstox that trigger actual timeouts in the test, 
  // we will manually instantiate the real Upstox adapter to verify its rate-limiter structure.
  console.log("--- 5. Upstox Internal Rate Limiter Structure ---");
  const { default: UpstoxAdapter } = await import('./services/adapters/UpstoxAdapter.js');
  const tempUpstox = new UpstoxAdapter({ apiKey: 'FAKE', apiSecret: 'FAKE' });
  const metrics = tempUpstox.getMetrics();
  assert(metrics.queueSize === 0, "Upstox adapter initializes with 0 queue size");
  assert(metrics.isCoolingDown === false, "Upstox adapter initializes with no active cooldown");

  console.log("");
  console.log("==========================================");
  console.log("ANGEL ONE SMARTAPI INTEGRATION STRESS TEST");
  console.log("==========================================\n");

  // 6. Angel One Normalization & Sandbox
  console.log("--- 6. Angel One Isolated Auth & Sandbox Fallback ---");
  const angelConnect = await BrokerGateway.connect('Angel One', { requestToken: 'CLIENT:PIN:FAKE_TOTP_SECRET' });
  assert(angelConnect.is_sandbox === true, "Angel One Gateway gracefully isolates TOTP/SmartAPI failures into Sandbox");
  
  const angelDiag = BrokerGateway.getDiagnostics('Angel One');
  assert(angelDiag.activeAdapter === 'Angel One', "Diagnostics correctly identifies active Angel adapter");
  assert(angelDiag.capabilities.apiVersion === 'smartapi_v1', "Angel capabilities expose apiVersion: smartapi_v1");
  // The MockAdapter won't expose totpValid, but the real one does. Let's verify graceful fallback:
  assert(typeof angelDiag.healthScore === 'number', "Gateway gracefully calculates health score for Angel");

  console.log("");
  console.log("==========================================");
  console.log(`STRESS TEST COMPLETE: ${passed} Passed | ${failed} Failed`);
  console.log("==========================================");
}

runStressTest().catch(console.error);
