import mongoose from 'mongoose';

export function isDbReady() {
  return mongoose.connection.readyState === 1;
}

export function dbUnavailableDetail() {
  return 'Database unavailable; returning demo data';
}
