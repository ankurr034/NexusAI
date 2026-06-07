import mongoose from 'mongoose';

const paperAccountSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  balance: { type: Number, default: 1000000 }, // Default 10L simulated capital
  maxDrawdown: { type: Number, default: 0 },
  winRate: { type: Number, default: 0 },
  totalTrades: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const paperPositionSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  symbol: { type: String, required: true },
  quantity: { type: Number, default: 0 },
  averagePrice: { type: Number, default: 0 },
  realizedPnl: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now }
});
// Ensure a user only has one active position document per symbol
paperPositionSchema.index({ userId: 1, symbol: 1 }, { unique: true });

const paperOrderSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  orderId: { type: String, required: true, unique: true },
  symbol: { type: String, required: true },
  action: { type: String, enum: ['BUY', 'SELL'], required: true },
  quantity: { type: Number, required: true },
  orderType: { type: String, enum: ['MARKET', 'LIMIT'], required: true },
  price: { type: Number },
  status: { type: String, enum: ['PENDING', 'FILLED', 'REJECTED', 'CANCELED'], default: 'PENDING' },
  fillPrice: { type: Number },
  slippage: { type: Number },
  rejectReason: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const riskEventSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  eventType: { type: String, required: true }, // e.g. 'MAX_POSITION_SIZE_EXCEEDED', 'KILL_SWITCH_ENGAGED'
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const PaperAccount = mongoose.model('PaperAccount', paperAccountSchema);
export const PaperPosition = mongoose.model('PaperPosition', paperPositionSchema);
export const PaperOrder = mongoose.model('PaperOrder', paperOrderSchema);
export const RiskEvent = mongoose.model('RiskEvent', riskEventSchema);
