// ═══════════════════════════════════════════════════════════
//  Centralized secret resolution.
//  In production we REFUSE to start with a missing/guessable JWT
//  secret. In development we fall back to a clearly-insecure value
//  and warn loudly, so local work is frictionless but never ships.
// ═══════════════════════════════════════════════════════════
const isProd = process.env.NODE_ENV === 'production';

let JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.trim() === '') {
  if (isProd) {
    console.error('FATAL: JWT_SECRET is not set. Refusing to start in production.');
    process.exit(1);
  }
  JWT_SECRET = 'nexus_dev_only_insecure_secret_change_me';
  console.warn('[secrets] JWT_SECRET not set — using an INSECURE development fallback. Do not deploy like this.');
}

export { JWT_SECRET, isProd };
