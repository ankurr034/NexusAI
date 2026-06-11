import fs from 'fs';
import PDFDocument from 'pdfkit';

// ── Palette ──
const INK = '#0b1220';
const PRIMARY = '#0f172a';
const BLUE = '#2563eb';
const TEAL = '#0d9488';
const RED = '#dc2626';
const AMBER = '#d97706';
const GREEN = '#16a34a';
const TEXT = '#1e293b';
const MUTED = '#64748b';
const CARD = '#f1f5f9';
const BORDER = '#cbd5e1';

const doc = new PDFDocument({ size: 'A4', margins: { top: 60, bottom: 60, left: 50, right: 50 }, bufferPages: true });
const OUT = 'e:/NexusAI/NexusAI_Analysis_and_Recommendations.pdf';
doc.pipe(fs.createWriteStream(OUT));

const PAGE_W = 595, ML = 50, MR = 545, CW = MR - ML;

function ensure(space) { if (doc.y + space > 770) doc.addPage(); }
function h1(title, n) {
  doc.addPage();
  doc.fillColor(PRIMARY).rect(ML, 55, CW, 38).fill();
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(13).text(`${n}.  ${title.toUpperCase()}`, ML + 14, 67);
  doc.y = 110; doc.fillColor(TEXT);
}
function h2(t, color = BLUE) { ensure(40); doc.moveDown(0.6); doc.fillColor(color).font('Helvetica-Bold').fontSize(11.5).text(t, ML); doc.moveDown(0.3); doc.fillColor(TEXT); }
function body(t) { ensure(30); doc.fillColor(TEXT).font('Helvetica').fontSize(10).text(t, ML, doc.y, { align: 'justify', lineGap: 2.5, width: CW }); doc.moveDown(0.5); }
function bullet(t, color = BLUE) {
  ensure(24); const y = doc.y;
  doc.fillColor(color).font('Helvetica-Bold').fontSize(10).text('▸', ML + 2, y);
  doc.fillColor(TEXT).font('Helvetica').fontSize(10).text(t, ML + 18, y, { width: CW - 18, lineGap: 2 });
  doc.moveDown(0.35);
}
function tag(label, color) {
  const w = doc.widthOfString(label, { font: 'Helvetica-Bold', size: 8 }) + 14;
  ensure(22); const y = doc.y;
  doc.roundedRect(ML, y, w, 15, 3).fill(color);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8).text(label, ML + 7, y + 4);
  doc.y = y + 15; doc.moveDown(0.2); doc.fillColor(TEXT);
}
function codeRef(t) { ensure(20); doc.fillColor(MUTED).font('Courier').fontSize(8.5).text(t, ML + 18, doc.y, { width: CW - 18 }); doc.moveDown(0.25); doc.fillColor(TEXT); }
function card(lines, accent = BLUE) {
  const pad = 10, lh = 13;
  const h = lines.length * lh + pad * 2;
  ensure(h + 10); const y = doc.y;
  doc.fillColor(CARD).roundedRect(ML, y, CW, h, 5).fill();
  doc.fillColor(accent).rect(ML, y, 4, h).fill();
  let cy = y + pad;
  lines.forEach(ln => {
    doc.fillColor(ln.c || TEXT).font(ln.b ? 'Helvetica-Bold' : 'Helvetica').fontSize(ln.s || 9.5).text(ln.t, ML + 14, cy, { width: CW - 24 });
    cy += lh * (ln.lines || 1);
  });
  doc.y = y + h + 8; doc.fillColor(TEXT);
}

// ═══════════════ COVER ═══════════════
doc.fillColor(INK).rect(0, 0, 595, 842).fill();
doc.fillColor(BLUE).opacity(0.14).circle(560, 60, 260).fill();
doc.fillColor(TEAL).opacity(0.10).circle(40, 800, 200).fill();
doc.opacity(1);
doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(46).text('NexusAI', 60, 200);
doc.fillColor(BLUE).font('Helvetica-Bold').fontSize(15).text('TECHNICAL AUDIT & PRODUCT STRATEGY', 62, 262);
doc.strokeColor(BLUE).lineWidth(3).moveTo(62, 290).lineTo(330, 290).stroke();
doc.fillColor('#94a3b8').font('Helvetica').fontSize(11).text('An honest engineering review of the codebase, a competitive', 62, 310);
doc.text('positioning analysis, and a prioritized roadmap to make the', 62, 326);
doc.text('platform genuinely production-grade.', 62, 342);
doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10).text('SCOPE REVIEWED', 62, 640);
doc.fillColor('#94a3b8').font('Helvetica').fontSize(9)
  .text('React 19 + Vite frontend (40+ feature pages)  •  Node/Express + Socket.IO backend', 62, 658)
  .text('MongoDB/Mongoose  •  Broker adapter layer  •  Paper-trading engine  •  Razorpay', 62, 672)
  .text('Gemini AI copilot  •  Solidity smart contracts (Polygon)', 62, 686);
doc.fillColor('#64748b').font('Helvetica').fontSize(8).text('Prepared by an external code review  •  Confidential', 62, 740);

// ═══════════════ 1. EXECUTIVE SUMMARY ═══════════════
h1('Executive Summary', 1);
body('NexusAI is one of the most ambitious student / portfolio projects you can build in this space. The scope is large and largely real: a centralized live market-data engine, a paper-trading execution engine with risk guards, a broker abstraction layer with four adapters, WebSocket hardening, security middleware, a Razorpay wallet, an AI copilot, and on-chain prediction logging. The engineering instincts on display — singletons as a single source of truth, exponential backoff, health endpoints, idempotency, async DB flushing — are well above typical.');
body('However, "ambitious and broad" is not the same as "production-grade." The platform currently has a thin but critical layer of problems that an experienced reviewer (or interviewer) will find in minutes: authentication is effectively a mock, the premium paywall is bypassed in code, an idempotency check can never fire because of a timestamp bug, secrets are committed, and there are no automated tests. None of these are hard to fix — and fixing them is exactly what converts this from "impressive demo" to "credible product."');

h2('Overall verdict', PRIMARY);
card([
  { t: 'Scope & ambition', b: true, c: PRIMARY }, { t: 'Exceptional — breadth rivals real fintech MVPs.', },
  { t: 'Engineering craft', b: true, c: PRIMARY }, { t: 'Strong — patterns are mature; comments show intent.', },
  { t: 'Production readiness', b: true, c: RED }, { t: 'Not ready — auth, secrets, and tests are blocking.', },
  { t: 'Differentiation', b: true, c: AMBER }, { t: 'Promising but unfocused — too many half-features.', },
], BLUE);

h2('The one-line recommendation');
body('Stop adding features. Spend the next phase hardening what exists — real authentication, a real paywall, tests, and honest "simulated data" labelling — then pick ONE differentiator (institutional-grade risk analytics, or the on-chain verifiable track record) and make it genuinely excellent. A focused, trustworthy platform beats a 40-page one that cannot be trusted with a login.');

// ═══════════════ 2. WHAT'S GENUINELY STRONG ═══════════════
h1('What Is Genuinely Strong', 2);
body('These are real strengths, grounded in the code — lead with them when you present or interview.');

h2('1. A true single source of truth for pricing', GREEN);
body('MarketDataService is a singleton that every consumer (charts, OMS, portfolio, simulator) reads from. It batches Yahoo Finance quotes, tracks provider health, applies exponential backoff on HTTP 429, falls back to last-known-good prices, and reduces poll frequency outside market hours. This is the correct architecture and it directly solved a real bug (chart price ≠ execution price).');
codeRef('server/services/MarketDataService.js — backoff, fallback cache, isMarketOpen()');

h2('2. A paper-trading engine that thinks like an exchange', GREEN);
body('PaperTradingEngine executes in-memory for low latency, then flushes to MongoDB asynchronously every 5s. It models slippage, enforces a max-position-size limit (25% of capital), rejects insufficient-funds and short-sells, has a kill-switch, and emits risk events. That risk-first mindset is exactly what distinguishes a trading system from a CRUD app.');
codeRef('server/services/PaperTradingEngine.js:60-163 — execution + risk guards');

h2('3. Broker abstraction done properly', GREEN);
body('BrokerGateway routes to Zerodha / Upstox / Angel One / Mock adapters behind one interface, degrades to a sandbox adapter when credentials are missing, computes per-broker health scores, and keeps a telemetry buffer. The frontend stays broker-agnostic. This is a clean, extensible pattern.');
codeRef('server/services/BrokerGateway.js — adapter map + getDiagnostics()');

h2('4. Operational maturity', GREEN);
bullet('Deep health checks: /api/health/deep reports DB, market-data age, WS clients, and memory.', GREEN);
bullet('WebSocket hardening: reconnection-flood throttling, room-based subscriptions, stale-socket cleanup.', GREEN);
bullet('Security middleware stack: helmet, mongo-sanitize, tiered rate limiters (auth/wallet/trade).', GREEN);
bullet('Graceful degradation everywhere: fallbacks for prices, history (Brownian bridge), and broker failures.', GREEN);

// ═══════════════ 3. CRITICAL ISSUES ═══════════════
h1('Critical Issues Found In The Code', 3);
body('These are concrete, file-level findings. They are ordered by severity. Fix the P0 items before showing this to anyone evaluating it as a product.');

tag('P0 — BLOCKING', RED);
h2('3.1  Authentication is a mock — anyone is "logged in"', RED);
body('The /login route ignores the password entirely and returns a static user id. The /me route then reports kyc_status: "VERIFIED" and isPremium: true for that mock user. There is no password hashing, no session, no real identity for Web2 users.');
codeRef('server/routes/auth.js:15-21  — login returns { user_id: "mock_web2_user" } with no check');
codeRef('server/routes/auth.js:43-50  — hard-codes VERIFIED / isPremium:true');
bullet('Fix: implement real email+password (bcrypt) or commit fully to wallet-only auth (you already have a solid nonce/SIWE flow in /nonce + /verify). Issue a JWT and verify it on every protected route.', RED);

tag('P0 — BLOCKING', RED);
h2('3.2  The premium paywall is bypassed in middleware', RED);
body('requirePremium contains a line that flips every non-premium user to premium instead of rejecting them. Combined with dev-mode short-circuits for ids like "mock_web2_user" and "1", the entire paywall is non-functional. Razorpay can take money, but nothing actually gates on payment.');
codeRef('server/middleware/auth.js:53-56  — if (!user.isPremium) { user.isPremium = true; }');
bullet('Fix: delete the auto-upgrade; return 403 when !user.isPremium. Remove the broad dev/test id allow-list from production builds (guard strictly on NODE_ENV).', RED);

tag('P0 — SECURITY', RED);
h2('3.3  Secrets are committed and weakly defaulted', RED);
bullet('docker-compose.yml hard-codes JWT_SECRET="nexusai_super_secret_production_key" in plaintext.', RED);
bullet('JWT_SECRET falls back to a known string in two files, so a missing env silently uses a guessable key.', RED);
bullet('server/.env is present in the tree — verify it is gitignored and rotate anything that leaked.', RED);
codeRef('docker-compose.yml:12  •  server/middleware/auth.js:4  •  server/routes/auth.js:6');
bullet('Fix: move all secrets to env/secret manager, fail fast (exit) if JWT_SECRET is unset, and scrub git history if real keys were ever committed.', RED);

tag('P1 — CORRECTNESS', AMBER);
h2('3.4  Order idempotency can never trigger', AMBER);
body('The idempotency key embeds Date.now(), so every order produces a unique key. The duplicate-detection set therefore never matches, and the cache is cleared 5s later anyway. The safety net is effectively dead code — a double-click or client retry will place two orders.');
codeRef('server/services/BrokerGateway.js:156  — key = `${...}_${Date.now()}`');
bullet('Fix: have the client send a stable Idempotency-Key (UUID per user action); key the cache on that, not on time.', AMBER);

tag('P1 — RELIABILITY', AMBER);
h2('3.5  In-memory execution risks silent data loss', AMBER);
body('Balances and positions mutate in memory and flush every 5s. A crash between flushes loses trades; the code comment acknowledges this. There is also no per-user lock around the async loadUserContext → mutate sequence, so interleaved orders can read a stale balance.');
codeRef('server/services/PaperTradingEngine.js:178-218 — flushToDB, no retry/back-pressure');
bullet('Fix: write-ahead the order before mutating, use atomic $inc on the account doc as the source of truth, and re-queue failed flushes instead of dropping them.', AMBER);

tag('P2 — TRUST', BLUE);
h2('3.6  Simulated data is presented as live market signal', BLUE);
body('Microstructure order books, "Block Deal Detected" smart alerts, and the slippage model are generated from counters and Math.random(). For a demo that is fine — but unlabelled fake signals in a finance product erode trust fast and would be a compliance problem in production.');
codeRef('server/index.js:447-496 — microTick order book + cycling alerts');
bullet('Fix: badge every synthetic feed as "Simulated / Demo" in the UI, and gate real signals behind a clearly separate data source.', BLUE);

tag('P2 — QUALITY', BLUE);
h2('3.7  No automated tests or CI', BLUE);
body('There are ad-hoc scripts (stress_test.js, e2e_test.js) but no test framework, no assertions, no CI pipeline. For a system handling money-like state, this is the highest-leverage gap after auth.');
bullet('Fix: add Vitest/Jest for the OMS and ledger math (the parts where bugs cost money), plus a GitHub Actions lint+test gate.', BLUE);

h2('Other notes', MUTED);
bullet('Singletons + setInterval timers mean two server instances would double-broadcast and double-poll — horizontal scaling needs Redis adapter + a leader for timers.', MUTED);
bullet('Gemini JSON is parsed via regex with no schema validation or per-route rate limit (cost risk on the AI endpoint).', MUTED);
bullet('Root package.json is still name:"frontend", version:"0.0.0" — polish before sharing.', MUTED);
bullet('CORS production config allows any localhost origin — tighten for real deployment.', MUTED);

// ═══════════════ 4. COMPETITIVE POSITIONING ═══════════════
h1('How To Be Better Than Other Platforms', 4);
body('You cannot out-Zerodha Zerodha on execution, or out-TradingView TradingView on charts — they have years and capital. The winning move is not "more features," it is a sharp, defensible angle. Here is an honest read of the landscape and where NexusAI can actually win.');

h2('The landscape (be realistic)');
card([
  { t: 'Zerodha / Upstox / Angel One', b: true, c: PRIMARY }, { t: 'Own real execution, licences, liquidity. You will not beat them there.' },
  { t: 'TradingView', b: true, c: PRIMARY }, { t: 'Owns charting + social. Deep moat on visualization.' },
  { t: 'Groww / INDmoney', b: true, c: PRIMARY }, { t: 'Own the simple, friendly retail onboarding experience.' },
  { t: 'Smallcase', b: true, c: PRIMARY }, { t: 'Owns thematic/basket investing.' },
], PRIMARY);

h2('Where NexusAI can genuinely differentiate', TEAL);
bullet('Institutional-grade risk, retail-simple UX. Portfolio X-Ray, stress tests, correlation/beta, and "what happens to MY holdings in a 2008-style crash" is something the big brokers do NOT surface well. Own "understand your risk before you trade."', TEAL);
bullet('A verifiable, tamper-proof track record. Your on-chain PredictionLogger is a real differentiator: let users (or an AI) publish a prediction, hash it on Polygon, and prove later they called it — no screenshot fakery. "Provable alpha" is a story no broker tells.', TEAL);
bullet('A genuinely useful AI copilot — not a chatbot gimmick. Wire Gemini to the user\'s actual portfolio + live data and have it explain concentration risk, suggest hedges, and answer "why did my P&L move today." Grounded, personal, explainable.', TEAL);
bullet('A serious paper-trading / learning arena. Your engine already models slippage and risk limits. Lean into education: tournaments, a trading-DNA profile, post-trade analytics — the best risk-free place to learn Indian markets.', TEAL);

h2('What to cut or de-emphasize', AMBER);
body('Forty feature pages dilute the story and multiply the surface area of half-working code. Pick the 3-4 that ladder up to your chosen angle (e.g. Portfolio X-Ray, Stress Test, AI Copilot, On-chain track record) and make them excellent. Move the rest behind a "Labs" flag or remove them.');

// ═══════════════ 5. ROADMAP ═══════════════
h1('Prioritized Roadmap', 5);
body('A sequenced plan. Do not skip ahead — the P0 layer is what makes everything above it believable.');

tag('PHASE 0 — TRUST (1-2 weeks)', RED);
bullet('Real auth: bcrypt email/password OR full wallet-SIWE; verify JWT on every protected route.');
bullet('Fix the paywall: remove the auto-premium line; return 403; strict NODE_ENV guards.');
bullet('Secrets: env/secret manager, fail-fast on missing JWT_SECRET, rotate + scrub history.');
bullet('Fix idempotency with a client-supplied key; write-ahead orders before mutating balances.');
bullet('Label every simulated feed clearly in the UI.');

tag('PHASE 1 — CONFIDENCE (2-3 weeks)', AMBER);
bullet('Tests: Vitest on OMS + ledger math; e2e happy-path; GitHub Actions lint+test gate.');
bullet('Observability: structured logs already exist — add error tracking (Sentry) and a status page.');
bullet('Harden the AI route: schema-validate Gemini output, add a per-user rate limit and a cost cap.');
bullet('Pick the ONE differentiator and write the product narrative around it.');

tag('PHASE 2 — SCALE & POLISH (3-6 weeks)', BLUE);
bullet('Redis: Socket.IO adapter for multi-instance fan-out; move shared state out of singletons; elect a single timer leader.');
bullet('Real data source for the chosen differentiator (or a clearly-licensed market feed).');
bullet('Deepen the on-chain track record: verification UI, shareable proof links.');
bullet('Accessibility + mobile pass on the core 4 pages; performance budget on the dashboard.');

h2('Highest-leverage quick wins (do this week)', GREEN);
bullet('Delete auth.js:53-56 auto-premium line.', GREEN);
bullet('Remove the plaintext JWT_SECRET from docker-compose.yml.', GREEN);
bullet('Replace Date.now() in the idempotency key.', GREEN);
bullet('Add a "Simulated" badge component and drop it on the microstructure + alerts panels.', GREEN);
bullet('Write 10 unit tests for the buy/sell ledger math.', GREEN);

// ═══════════════ 6. HOW TO TALK ABOUT IT ═══════════════
h1('How To Present This (Resume & Pitch)', 6);
body('The project is a strong signal IF you frame it with engineering honesty. Interviewers and reviewers respect "I built X, found these flaws, and here is how I fixed them" far more than "everything works perfectly."');

h2('Resume bullets (accurate, quantified)');
bullet('Built a real-time trading platform: centralized market-data singleton (Yahoo Finance) feeding a Socket.IO broadcast layer with reconnection throttling and room-based subscriptions.');
bullet('Designed a paper-trading execution engine with in-memory fills, slippage modelling, position-size limits, and async MongoDB persistence.');
bullet('Implemented a broker abstraction layer (4 adapters) with health scoring and automatic sandbox fallback.');
bullet('Added an on-chain (Polygon/Solidity) prediction logger for tamper-proof, verifiable forecasts.');

h2('The honesty that wins interviews', PRIMARY);
body('Be ready to say: "Auth started as a mock so I could iterate on the trading core; my next step is real SIWE/JWT. I also found that my idempotency key included a timestamp, so it never deduplicated — I fixed it with a client-supplied key. The slippage and microstructure feeds are simulated and labelled as such." This turns every flaw in this report into evidence that you can audit and harden your own systems — which is exactly what senior engineering is.');

doc.end();
console.log('Analysis PDF written to', OUT);
