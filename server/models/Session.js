import mongoose from 'mongoose';

const UserSessionSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  familyId: { type: String, required: true, index: true }, // Chain identification for token rotation detection
  tokenHash: { type: String, required: true, unique: true }, // Hashed refresh token
  ipAddress: { type: String, default: 'unknown' },
  userAgent: { type: String, default: 'unknown' },
  deviceType: { type: String, default: 'unknown' },
  lastActivity: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, index: true }, // Auto-expiring index
  createdAt: { type: Date, default: Date.now }
});

// Configure MongoDB TTL (Time-To-Live) index to automatically clear expired sessions
UserSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const UserSession = mongoose.models.UserSession || mongoose.model('UserSession', UserSessionSchema);

export default UserSession;
