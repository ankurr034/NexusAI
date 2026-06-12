import mongoose from 'mongoose';

const AuditLogSchema = new mongoose.Schema({
  userId: { type: String, index: true, default: null },
  action: { 
    type: String, 
    required: true,
    enum: [
      'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'TOKEN_REFRESH',
      'WALLET_MUTATION', 'WITHDRAW_REQUEST', 'PAYMENT_VERIFIED', 'PAYMENT_FAILED',
      'ORDER_PLACED', 'ORDER_CANCELLED', 'GTT_CANCELLED',
      'BROKER_CONNECTED', 'BROKER_DISCONNECTED', 'ADMIN_ACTION',
      'SUSPICIOUS_ACTIVITY'
    ],
    index: true 
  },
  status: { type: String, enum: ['SUCCESS', 'FAILURE', 'SUSPICIOUS'], required: true },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  ipAddress: { type: String, default: 'unknown' },
  userAgent: { type: String, default: 'unknown' },
  correlationId: { type: String, index: true, default: null }, // Trace ID for requests
  timestamp: { type: Date, default: Date.now, index: true }
});

const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);

export default AuditLog;
