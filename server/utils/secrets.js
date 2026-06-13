import dotenv from 'dotenv';
dotenv.config();

const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

const JWT_SECRET = process.env.JWT_SECRET;
const MONGODB_URI = process.env.MONGODB_URI;
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const SENTRY_DSN = process.env.SENTRY_DSN;

// Fail-fast environment validation
if (!isTest) {
  const missingSecrets = [];
  
  if (!JWT_SECRET || JWT_SECRET.trim() === '' || JWT_SECRET === 'nexus_dev_only_insecure_secret_change_me') {
    missingSecrets.push('JWT_SECRET');
  }
  if (!MONGODB_URI || MONGODB_URI.trim() === '') {
    missingSecrets.push('MONGODB_URI');
  }
  if (!RAZORPAY_KEY_ID || RAZORPAY_KEY_ID.trim() === '' || RAZORPAY_KEY_ID === 'rzp_test_yourkeyid') {
    missingSecrets.push('RAZORPAY_KEY_ID');
  }
  if (!RAZORPAY_KEY_SECRET || RAZORPAY_KEY_SECRET.trim() === '' || RAZORPAY_KEY_SECRET === 'mocksecret') {
    missingSecrets.push('RAZORPAY_KEY_SECRET');
  }
  if (!GEMINI_API_KEY || GEMINI_API_KEY.trim() === '' || GEMINI_API_KEY === 'dummy_key') {
    missingSecrets.push('GEMINI_API_KEY');
  }
  if (isProd && (!SENTRY_DSN || SENTRY_DSN.trim() === '')) {
    missingSecrets.push('SENTRY_DSN (Required in production)');
  }

  if (missingSecrets.length > 0) {
    console.error(`\n[FATAL] Missing or insecure critical configuration variables: ${missingSecrets.join(', ')}`);
    console.error('Server cannot start. Please verify your environment variables or .env configuration.\n');
    process.exit(1);
  }
}

// In test environment, fallback to secure mocks to prevent crash
const activeSecret = JWT_SECRET || 'test_secret_for_unit_tests_only';

export { activeSecret as JWT_SECRET, SENTRY_DSN, isProd };
