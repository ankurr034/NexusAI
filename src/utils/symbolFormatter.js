export const formatTradingViewSymbol = (ticker, exchange = 'BSE') => {
  if (!ticker) return `${exchange}:SENSEX`;
  
  // Strip out known extensions and sanitize strictly
  let cleanTicker = ticker.replace('.NS', '').replace('.BO', '').toUpperCase();
  cleanTicker = cleanTicker.replace(/[^A-Z0-9]/gi, '');
  
  // Hardcode index fallbacks if needed, otherwise use provided exchange
  if (cleanTicker === 'NIFTY') return 'NSE:NIFTY';
  if (cleanTicker === 'BANKNIFTY') return 'NSE:BANKNIFTY';
  
  return `${exchange}:${cleanTicker}`;
};
