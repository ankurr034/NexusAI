// ═══════════════════════════════════════════════════════════
//  INDEX CONSTITUENTS REGISTRY
//  Central source of truth for all index/sector mappings.
//  Add new indices by appending a new key + constituents array.
// ═══════════════════════════════════════════════════════════

export const INDEX_CONSTITUENTS = {

  // ── NIFTY 50 ─────────────────────────────────────────────
  NIFTY_50: {
    name: 'NIFTY 50',
    description: 'Top 50 companies by market cap on NSE',
    sectors: {
      'Financial Services': [
        { symbol: 'HDFCBANK', name: 'HDFC Bank', weight: 12.5 },
        { symbol: 'ICICIBANK', name: 'ICICI Bank', weight: 7.8 },
        { symbol: 'SBIN', name: 'State Bank of India', weight: 3.2 },
        { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank', weight: 3.0 },
        { symbol: 'AXISBANK', name: 'Axis Bank', weight: 2.8 },
        { symbol: 'BAJFINANCE', name: 'Bajaj Finance', weight: 2.5 },
        { symbol: 'BAJAJFINSV', name: 'Bajaj Finserv', weight: 1.2 },
        { symbol: 'INDUSINDBK', name: 'IndusInd Bank', weight: 1.0 },
        { symbol: 'SBILIFE', name: 'SBI Life Insurance', weight: 0.9 },
        { symbol: 'HDFCLIFE', name: 'HDFC Life Insurance', weight: 0.8 },
      ],
      'IT': [
        { symbol: 'TCS', name: 'Tata Consultancy', weight: 4.5 },
        { symbol: 'INFY', name: 'Infosys', weight: 5.8 },
        { symbol: 'HCLTECH', name: 'HCL Technologies', weight: 2.2 },
        { symbol: 'WIPRO', name: 'Wipro', weight: 1.2 },
        { symbol: 'TECHM', name: 'Tech Mahindra', weight: 0.9 },
        { symbol: 'LTIM', name: 'LTIMindtree', weight: 0.8 },
      ],
      'Oil & Gas': [
        { symbol: 'RELIANCE', name: 'Reliance Industries', weight: 10.2 },
        { symbol: 'ONGC', name: 'Oil & Natural Gas Corp', weight: 1.5 },
        { symbol: 'BPCL', name: 'Bharat Petroleum', weight: 0.7 },
        { symbol: 'COALINDIA', name: 'Coal India', weight: 0.9 },
      ],
      'Automobile': [
        { symbol: 'TATAMOTORS', name: 'Tata Motors', weight: 1.8 },
        { symbol: 'M&M', name: 'Mahindra & Mahindra', weight: 2.0 },
        { symbol: 'MARUTI', name: 'Maruti Suzuki', weight: 1.8 },
        { symbol: 'BAJAJ-AUTO', name: 'Bajaj Auto', weight: 1.0 },
        { symbol: 'EICHERMOT', name: 'Eicher Motors', weight: 0.9 },
        { symbol: 'HEROMOTOCO', name: 'Hero MotoCorp', weight: 0.7 },
      ],
      'FMCG': [
        { symbol: 'ITC', name: 'ITC Limited', weight: 4.0 },
        { symbol: 'HINDUNILVR', name: 'Hindustan Unilever', weight: 2.8 },
        { symbol: 'NESTLEIND', name: 'Nestle India', weight: 0.8 },
        { symbol: 'BRITANNIA', name: 'Britannia Industries', weight: 0.6 },
        { symbol: 'TATACONSUM', name: 'Tata Consumer', weight: 0.5 },
      ],
      'Pharma & Healthcare': [
        { symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical', weight: 1.8 },
        { symbol: 'CIPLA', name: 'Cipla', weight: 0.8 },
        { symbol: 'DRREDDY', name: "Dr. Reddy's Labs", weight: 0.9 },
        { symbol: 'DIVISLAB', name: "Divi's Laboratories", weight: 0.6 },
        { symbol: 'APOLLOHOSP', name: 'Apollo Hospitals', weight: 0.7 },
      ],
      'Metals & Mining': [
        { symbol: 'TATASTEEL', name: 'Tata Steel', weight: 0.9 },
        { symbol: 'HINDALCO', name: 'Hindalco Industries', weight: 0.8 },
        { symbol: 'JSWSTEEL', name: 'JSW Steel', weight: 0.9 },
      ],
      'Infrastructure & Cement': [
        { symbol: 'LT', name: 'Larsen & Toubro', weight: 3.5 },
        { symbol: 'ULTRACEMCO', name: 'UltraTech Cement', weight: 1.2 },
        { symbol: 'GRASIM', name: 'Grasim Industries', weight: 0.8 },
        { symbol: 'ADANIPORTS', name: 'Adani Ports', weight: 1.0 },
      ],
      'Telecom & Media': [
        { symbol: 'BHARTIARTL', name: 'Bharti Airtel', weight: 3.8 },
      ],
      'Consumer Durables': [
        { symbol: 'TITAN', name: 'Titan Company', weight: 1.8 },
        { symbol: 'ASIANPAINT', name: 'Asian Paints', weight: 1.5 },
        { symbol: 'TRENT', name: 'Trent Ltd', weight: 0.9 },
      ],
      'Power': [
        { symbol: 'NTPC', name: 'NTPC Ltd', weight: 1.5 },
        { symbol: 'POWERGRID', name: 'Power Grid Corp', weight: 1.0 },
        { symbol: 'BEL', name: 'Bharat Electronics', weight: 0.8 },
      ],
    }
  },

  // ── BANK NIFTY ───────────────────────────────────────────
  BANK_NIFTY: {
    name: 'BANK NIFTY',
    description: 'Banking sector index',
    sectors: {
      'Private Banks': [
        { symbol: 'HDFCBANK', name: 'HDFC Bank', weight: 28.0 },
        { symbol: 'ICICIBANK', name: 'ICICI Bank', weight: 22.0 },
        { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank', weight: 12.0 },
        { symbol: 'AXISBANK', name: 'Axis Bank', weight: 10.0 },
        { symbol: 'INDUSINDBK', name: 'IndusInd Bank', weight: 5.0 },
        { symbol: 'BANDHANBNK', name: 'Bandhan Bank', weight: 1.5 },
        { symbol: 'FEDERALBNK', name: 'Federal Bank', weight: 1.5 },
        { symbol: 'IDFCFIRSTB', name: 'IDFC First Bank', weight: 1.5 },
        { symbol: 'AUBANK', name: 'AU Small Finance Bank', weight: 2.0 },
      ],
      'Public Sector Banks': [
        { symbol: 'SBIN', name: 'State Bank of India', weight: 10.0 },
        { symbol: 'BANKBARODA', name: 'Bank of Baroda', weight: 2.5 },
        { symbol: 'PNB', name: 'Punjab National Bank', weight: 2.0 },
        { symbol: 'CANBK', name: 'Canara Bank', weight: 1.0 },
        { symbol: 'UNIONBANK', name: 'Union Bank of India', weight: 1.0 },
      ],
    }
  },

  // ── NIFTY IT ─────────────────────────────────────────────
  NIFTY_IT: {
    name: 'NIFTY IT',
    description: 'Information Technology sector index',
    sectors: {
      'Large Cap IT': [
        { symbol: 'TCS', name: 'Tata Consultancy', weight: 25.0 },
        { symbol: 'INFY', name: 'Infosys', weight: 22.0 },
        { symbol: 'HCLTECH', name: 'HCL Technologies', weight: 12.0 },
        { symbol: 'WIPRO', name: 'Wipro', weight: 8.0 },
        { symbol: 'TECHM', name: 'Tech Mahindra', weight: 7.0 },
      ],
      'Mid Cap IT': [
        { symbol: 'LTIM', name: 'LTIMindtree', weight: 7.0 },
        { symbol: 'MPHASIS', name: 'Mphasis', weight: 4.0 },
        { symbol: 'PERSISTENT', name: 'Persistent Systems', weight: 4.0 },
        { symbol: 'COFORGE', name: 'Coforge', weight: 3.5 },
        { symbol: 'LTTS', name: 'L&T Technology Services', weight: 3.5 },
        { symbol: 'KPITTECH', name: 'KPIT Technologies', weight: 2.0 },
        { symbol: 'TATAELXSI', name: 'Tata Elxsi', weight: 2.0 },
      ],
    }
  },

  // ── NIFTY FMCG ───────────────────────────────────────────
  NIFTY_FMCG: {
    name: 'NIFTY FMCG',
    description: 'Fast Moving Consumer Goods sector index',
    sectors: {
      'Beverages & Tobacco': [
        { symbol: 'ITC', name: 'ITC Limited', weight: 22.0 },
        { symbol: 'UBL', name: 'United Breweries', weight: 2.5 },
        { symbol: 'VBL', name: 'Varun Beverages', weight: 3.0 },
        { symbol: 'RADICO', name: 'Radico Khaitan', weight: 1.5 },
      ],
      'Personal & Home Care': [
        { symbol: 'HINDUNILVR', name: 'Hindustan Unilever', weight: 20.0 },
        { symbol: 'GODREJCP', name: 'Godrej Consumer', weight: 4.0 },
        { symbol: 'DABUR', name: 'Dabur India', weight: 4.5 },
        { symbol: 'COLPAL', name: 'Colgate-Palmolive', weight: 3.5 },
        { symbol: 'MARICO', name: 'Marico', weight: 3.5 },
        { symbol: 'EMAMILTD', name: 'Emami', weight: 1.5 },
        { symbol: 'JYOTHYLAB', name: 'Jyothy Labs', weight: 1.0 },
        { symbol: 'PGHH', name: 'Procter & Gamble Hygiene', weight: 2.0 },
      ],
      'Food Products': [
        { symbol: 'NESTLEIND', name: 'Nestle India', weight: 12.0 },
        { symbol: 'BRITANNIA', name: 'Britannia Industries', weight: 8.0 },
        { symbol: 'TATACONSUM', name: 'Tata Consumer', weight: 6.0 },
      ],
    }
  },

  // ── NIFTY ENERGY ─────────────────────────────────────────
  NIFTY_ENERGY: {
    name: 'NIFTY ENERGY',
    description: 'Energy sector index',
    sectors: {
      'Oil & Gas': [
        { symbol: 'RELIANCE', name: 'Reliance Industries', weight: 28.0 },
        { symbol: 'ONGC', name: 'Oil & Natural Gas Corp', weight: 10.0 },
        { symbol: 'BPCL', name: 'Bharat Petroleum', weight: 5.0 },
        { symbol: 'IOC', name: 'Indian Oil Corp', weight: 4.5 },
        { symbol: 'GAIL', name: 'GAIL India', weight: 4.0 },
        { symbol: 'OIL', name: 'Oil India Ltd', weight: 2.5 },
        { symbol: 'PETRONET', name: 'Petronet LNG', weight: 3.0 },
        { symbol: 'HINDPETRO', name: 'Hindustan Petroleum', weight: 3.0 },
      ],
      'Power & Utilities': [
        { symbol: 'NTPC', name: 'NTPC Ltd', weight: 12.0 },
        { symbol: 'POWERGRID', name: 'Power Grid Corp', weight: 8.0 },
        { symbol: 'ADANIGREEN', name: 'Adani Green Energy', weight: 5.0 },
        { symbol: 'TATAPOWER', name: 'Tata Power', weight: 4.0 },
        { symbol: 'COALINDIA', name: 'Coal India', weight: 6.0 },
      ],
      'Energy Infrastructure': [
        { symbol: 'ADANIENSOL', name: 'Adani Energy Solutions', weight: 3.0 },
        { symbol: 'NHPC', name: 'NHPC Ltd', weight: 2.0 },
      ],
    }
  },

  // ── NIFTY MIDCAP 100 ────────────────────────────────────
  NIFTY_MIDCAP_100: {
    name: 'NIFTY MIDCAP 100',
    description: 'Top 100 midcap companies by market cap',
    sectors: {
      'Financial Services': [
        { symbol: 'CHOLAFIN', name: 'Cholamandalam Fin.', weight: 2.2 },
        { symbol: 'MUTHOOTFIN', name: 'Muthoot Finance', weight: 1.5 },
        { symbol: 'MANAPPURAM', name: 'Manappuram Finance', weight: 0.8 },
        { symbol: 'SHRIRAMFIN', name: 'Shriram Finance', weight: 1.8 },
        { symbol: 'MFSL', name: 'Max Financial Services', weight: 1.2 },
        { symbol: 'LICHSGFIN', name: 'LIC Housing Finance', weight: 0.9 },
        { symbol: 'PFC', name: 'Power Finance Corp', weight: 1.4 },
        { symbol: 'RECLTD', name: 'REC Ltd', weight: 1.3 },
        { symbol: 'CANFINHOME', name: 'Can Fin Homes', weight: 0.5 },
        { symbol: 'RBLBANK', name: 'RBL Bank', weight: 0.5 },
        { symbol: 'STARHEALTH', name: 'Star Health Insurance', weight: 0.8 },
        { symbol: 'SUNDARMFIN', name: 'Sundaram Finance', weight: 0.6 },
      ],
      'IT & Technology': [
        { symbol: 'PERSISTENT', name: 'Persistent Systems', weight: 1.8 },
        { symbol: 'COFORGE', name: 'Coforge', weight: 1.5 },
        { symbol: 'MPHASIS', name: 'Mphasis', weight: 1.4 },
        { symbol: 'KPITTECH', name: 'KPIT Technologies', weight: 1.2 },
        { symbol: 'TATAELXSI', name: 'Tata Elxsi', weight: 1.0 },
        { symbol: 'DIXON', name: 'Dixon Technologies', weight: 1.1 },
        { symbol: 'OFSS', name: 'Oracle Financial Services', weight: 0.8 },
        { symbol: 'TATACOMM', name: 'Tata Communications', weight: 0.7 },
        { symbol: 'NAUKRI', name: 'Info Edge (Naukri)', weight: 1.5 },
      ],
      'Pharma & Healthcare': [
        { symbol: 'AUROPHARMA', name: 'Aurobindo Pharma', weight: 1.2 },
        { symbol: 'LUPIN', name: 'Lupin Ltd', weight: 1.3 },
        { symbol: 'BIOCON', name: 'Biocon', weight: 0.8 },
        { symbol: 'IPCALAB', name: 'IPCA Laboratories', weight: 0.7 },
        { symbol: 'LALPATHLAB', name: 'Dr. Lal PathLabs', weight: 0.7 },
        { symbol: 'GLENMARK', name: 'Glenmark Pharma', weight: 0.6 },
        { symbol: 'TORNTPHARM', name: 'Torrent Pharmaceuticals', weight: 1.0 },
        { symbol: 'SYNGENE', name: 'Syngene International', weight: 0.6 },
        { symbol: 'MAXHEALTH', name: 'Max Healthcare', weight: 1.2 },
        { symbol: 'METROPOLIS', name: 'Metropolis Healthcare', weight: 0.5 },
        { symbol: 'ZYDUSLIFE', name: 'Zydus Lifesciences', weight: 0.9 },
        { symbol: 'ALKEM', name: 'Alkem Laboratories', weight: 0.8 },
      ],
      'Automobile & Ancillary': [
        { symbol: 'TVSMOTOR', name: 'TVS Motor', weight: 1.5 },
        { symbol: 'ASHOKLEY', name: 'Ashok Leyland', weight: 1.0 },
        { symbol: 'ESCORTS', name: 'Escorts Kubota', weight: 0.7 },
        { symbol: 'BALKRISIND', name: 'Balkrishna Industries', weight: 0.7 },
        { symbol: 'MRF', name: 'MRF Ltd', weight: 0.5 },
        { symbol: 'SONACOMS', name: 'Sona BLW Precision', weight: 0.8 },
        { symbol: 'EXIDEIND', name: 'Exide Industries', weight: 0.6 },
      ],
      'Chemicals & Materials': [
        { symbol: 'SRF', name: 'SRF Ltd', weight: 1.0 },
        { symbol: 'PIIND', name: 'PI Industries', weight: 1.0 },
        { symbol: 'DEEPAKNTR', name: 'Deepak Nitrite', weight: 0.7 },
        { symbol: 'NAVINFLUOR', name: 'Navin Fluorine', weight: 0.5 },
        { symbol: 'ATUL', name: 'Atul Ltd', weight: 0.5 },
        { symbol: 'COROMANDEL', name: 'Coromandel International', weight: 0.7 },
        { symbol: 'TATACHEM', name: 'Tata Chemicals', weight: 0.6 },
      ],
      'Consumer & Retail': [
        { symbol: 'JUBLFOOD', name: 'Jubilant FoodWorks', weight: 0.9 },
        { symbol: 'PAGEIND', name: 'Page Industries', weight: 0.7 },
        { symbol: 'VOLTAS', name: 'Voltas Ltd', weight: 0.8 },
        { symbol: 'CROMPTON', name: 'Crompton Greaves CE', weight: 0.5 },
        { symbol: 'HONAUT', name: 'Honeywell Automation', weight: 0.5 },
        { symbol: 'DELHIVERY', name: 'Delhivery Ltd', weight: 0.6 },
        { symbol: 'IRCTC', name: 'IRCTC', weight: 0.8 },
      ],
      'Infrastructure & Capital Goods': [
        { symbol: 'ABB', name: 'ABB India', weight: 1.5 },
        { symbol: 'HAL', name: 'Hindustan Aeronautics', weight: 2.0 },
        { symbol: 'CUMMINSIND', name: 'Cummins India', weight: 0.9 },
        { symbol: 'THERMAX', name: 'Thermax Ltd', weight: 0.5 },
        { symbol: 'TIMKEN', name: 'Timken India', weight: 0.4 },
        { symbol: 'BHEL', name: 'Bharat Heavy Electricals', weight: 0.7 },
        { symbol: 'POLYCAB', name: 'Polycab India', weight: 1.2 },
        { symbol: 'SUPREMEIND', name: 'Supreme Industries', weight: 0.6 },
        { symbol: 'ASTRAL', name: 'Astral Ltd', weight: 0.7 },
      ],
      'Metals & Mining': [
        { symbol: 'VEDL', name: 'Vedanta Ltd', weight: 1.0 },
        { symbol: 'NMDC', name: 'NMDC Ltd', weight: 0.8 },
        { symbol: 'NATIONALUM', name: 'National Aluminium', weight: 0.5 },
        { symbol: 'SAIL', name: 'Steel Authority of India', weight: 0.6 },
        { symbol: 'JINDALSTEL', name: 'Jindal Steel & Power', weight: 0.9 },
      ],
      'Real Estate': [
        { symbol: 'GODREJPROP', name: 'Godrej Properties', weight: 0.9 },
        { symbol: 'OBEROIRLTY', name: 'Oberoi Realty', weight: 0.7 },
        { symbol: 'PRESTIGE', name: 'Prestige Estates', weight: 0.8 },
        { symbol: 'PHOENIXLTD', name: 'Phoenix Mills', weight: 0.6 },
      ],
      'Oil Gas & Energy': [
        { symbol: 'PETRONET', name: 'Petronet LNG', weight: 0.8 },
        { symbol: 'HINDPETRO', name: 'Hindustan Petroleum', weight: 0.7 },
        { symbol: 'TATAPOWER', name: 'Tata Power', weight: 1.0 },
        { symbol: 'TORNTPOWER', name: 'Torrent Power', weight: 0.7 },
        { symbol: 'NHPC', name: 'NHPC Ltd', weight: 0.5 },
      ],
      'Cement & Building': [
        { symbol: 'ACC', name: 'ACC Ltd', weight: 0.6 },
        { symbol: 'DALBHARAT', name: 'Dalmia Bharat', weight: 0.5 },
        { symbol: 'RAMCOCEM', name: 'Ramco Cements', weight: 0.4 },
        { symbol: 'SHREECEM', name: 'Shree Cement', weight: 0.8 },
        { symbol: 'PIDILITIND', name: 'Pidilite Industries', weight: 1.2 },
      ],
      'Media & Entertainment': [
        { symbol: 'SUNTV', name: 'Sun TV Network', weight: 0.5 },
        { symbol: 'ZEEL', name: 'Zee Entertainment', weight: 0.3 },
        { symbol: 'PVR', name: 'PVR INOX', weight: 0.4 },
      ],
      'Telecom & Utilities': [
        { symbol: 'INDUSTOWER', name: 'Indus Towers', weight: 0.8 },
        { symbol: 'CONCOR', name: 'Container Corp of India', weight: 0.6 },
        { symbol: 'GMRINFRA', name: 'GMR Airports Infra', weight: 0.5 },
        { symbol: 'INDHOTEL', name: 'Indian Hotels', weight: 0.7 },
      ],
      'Agri & Fertilizers': [
        { symbol: 'UPL', name: 'UPL Ltd', weight: 0.5 },
      ],
    }
  },
};

// ═══════════════════════════════════════════════════════════
//  Helper Utilities
// ═══════════════════════════════════════════════════════════

/** Returns a flat array of all unique symbols across all indices */
export function getAllUniqueSymbols() {
  const symbolSet = new Set();
  for (const index of Object.values(INDEX_CONSTITUENTS)) {
    for (const stocks of Object.values(index.sectors)) {
      stocks.forEach(s => symbolSet.add(s.symbol));
    }
  }
  return [...symbolSet];
}

/** Returns symbols for a specific index key */
export function getIndexSymbols(indexKey) {
  const index = INDEX_CONSTITUENTS[indexKey];
  if (!index) return [];
  const symbols = [];
  for (const stocks of Object.values(index.sectors)) {
    stocks.forEach(s => symbols.push(s.symbol));
  }
  return symbols;
}

/** Returns the full list of available index keys */
export function getAvailableIndices() {
  return Object.entries(INDEX_CONSTITUENTS).map(([key, val]) => ({
    key,
    name: val.name,
    description: val.description,
    stockCount: getIndexSymbols(key).length
  }));
}

/** Returns fallback prices for all known symbols */
export function generateFallbackPrices() {
  const FALLBACK_MAP = {
    // Indices
    'NIFTY 50': 22450.00, 'SENSEX': 73876.00, 'BANKNIFTY': 47683.00,
    // Large Caps
    RELIANCE: 2950.20, TCS: 4120.00, HDFCBANK: 1440.50, INFY: 1400.00,
    ICICIBANK: 1100.00, HINDUNILVR: 2350.00, ITC: 440.00, SBIN: 780.00,
    BHARTIARTL: 1350.00, BAJFINANCE: 7200.00, KOTAKBANK: 1780.00,
    LT: 3450.00, HCLTECH: 1550.00, ASIANPAINT: 2800.00, AXISBANK: 1120.00,
    MARUTI: 10800.00, SUNPHARMA: 1180.00, TITAN: 3200.00, ULTRACEMCO: 9800.00,
    WIPRO: 480.00, ONGC: 260.00, NTPC: 340.50, TATAMOTORS: 980.40,
    POWERGRID: 280.90, 'M&M': 2580.00, JSWSTEEL: 820.00, TECHM: 1420.00,
    TATASTEEL: 140.00, INDUSINDBK: 1480.00, ADANIPORTS: 1190.00,
    BAJAJFINSV: 1650.00, COALINDIA: 450.00, BPCL: 320.00,
    'BAJAJ-AUTO': 8800.00, GRASIM: 2350.00, CIPLA: 1480.00, DRREDDY: 5600.00,
    EICHERMOT: 4500.00, DIVISLAB: 3800.00, BRITANNIA: 5200.00,
    APOLLOHOSP: 5900.00, NESTLEIND: 2350.00, TATACONSUM: 1050.00,
    HEROMOTOCO: 4800.00, HINDALCO: 540.00, LTIM: 5400.00,
    SBILIFE: 1480.00, HDFCLIFE: 640.00, BEL: 280.00, TRENT: 5600.00,
    // Bank Nifty extras
    BANDHANBNK: 220.00, FEDERALBNK: 165.00, IDFCFIRSTB: 78.00,
    AUBANK: 680.00, BANKBARODA: 240.00, PNB: 105.00, CANBK: 110.00,
    UNIONBANK: 120.00,
    // IT extras
    MPHASIS: 2800.00, PERSISTENT: 4200.00, COFORGE: 6800.00, LTTS: 4800.00,
    KPITTECH: 1450.00, TATAELXSI: 6500.00,
    // FMCG extras
    GODREJCP: 1150.00, DABUR: 560.00, COLPAL: 2700.00, MARICO: 580.00,
    UBL: 1650.00, VBL: 1200.00, RADICO: 1800.00, EMAMILTD: 580.00,
    JYOTHYLAB: 420.00, PGHH: 15000.00,
    // Energy extras
    IOC: 130.00, GAIL: 190.00, OIL: 340.00, PETRONET: 320.00,
    HINDPETRO: 380.00, ADANIGREEN: 1600.00, TATAPOWER: 390.20,
    ADANIENSOL: 780.00, NHPC: 85.00,
    // Midcap 100
    CHOLAFIN: 1280.00, MUTHOOTFIN: 1650.00, MANAPPURAM: 180.00,
    SHRIRAMFIN: 2400.00, MFSL: 980.00, LICHSGFIN: 620.00,
    PFC: 420.00, RECLTD: 480.00, CANFINHOME: 850.00, RBLBANK: 220.00,
    STARHEALTH: 540.00, SUNDARMFIN: 4200.00,
    AUROPHARMA: 1120.00, LUPIN: 1650.00, BIOCON: 280.00,
    IPCALAB: 1350.00, LALPATHLAB: 2800.00, GLENMARK: 1400.00,
    TORNTPHARM: 3200.00, SYNGENE: 780.00, MAXHEALTH: 820.00,
    METROPOLIS: 1800.00, ZYDUSLIFE: 940.00, ALKEM: 5200.00,
    TVSMOTOR: 2200.00, ASHOKLEY: 190.00, ESCORTS: 3600.00,
    BALKRISIND: 2700.00, MRF: 125000.00, SONACOMS: 580.00, EXIDEIND: 420.00,
    SRF: 2400.00, PIIND: 3600.00, DEEPAKNTR: 2100.00,
    NAVINFLUOR: 3800.00, ATUL: 6400.00, COROMANDEL: 1350.00,
    TATACHEM: 1050.00,
    JUBLFOOD: 520.00, PAGEIND: 38000.00, VOLTAS: 1280.00,
    CROMPTON: 340.00, HONAUT: 42000.00, DELHIVERY: 420.00, IRCTC: 880.00,
    ABB: 5800.00, HAL: 3800.00, CUMMINSIND: 2800.00,
    THERMAX: 3200.00, TIMKEN: 3400.00, BHEL: 240.00,
    POLYCAB: 5600.00, SUPREMEIND: 4800.00, ASTRAL: 1800.00,
    VEDL: 320.00, NMDC: 240.00, NATIONALUM: 150.00, SAIL: 115.00,
    JINDALSTEL: 780.00,
    GODREJPROP: 2400.00, OBEROIRLTY: 1600.00, PRESTIGE: 1350.00, PHOENIXLTD: 1800.00,
    TORNTPOWER: 1650.00, ACC: 2200.00, DALBHARAT: 1800.00,
    RAMCOCEM: 780.00, SHREECEM: 26000.00, PIDILITIND: 2700.00,
    SUNTV: 680.00, ZEEL: 140.00, PVR: 1450.00,
    INDUSTOWER: 340.00, CONCOR: 820.00, GMRINFRA: 85.00, INDHOTEL: 620.00,
    UPL: 480.00, NAUKRI: 5800.00, OFSS: 9500.00, TATACOMM: 1750.00, DIXON: 5600.00,
    // Other commonly tracked
    ZOMATO: 165.20, TATAMTRDVR: 780.00,
  };
  return FALLBACK_MAP;
}
