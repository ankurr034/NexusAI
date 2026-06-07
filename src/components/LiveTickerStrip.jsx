import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import useSocket from '../hooks/useSocket';

export default function LiveTickerStrip() {
  const [tickerData, setTickerData] = useState([
    { symbol: 'NIFTY 50', value: '22,450.60', change: '+126.35', pct: '+0.56%', up: true },
    { symbol: 'SENSEX', value: '73,876.82', change: '+410.25', pct: '+0.55%', up: true },
    { symbol: 'BANKNIFTY', value: '47,683.45', change: '-98.20', pct: '-0.21%', up: false },
    { symbol: 'RELIANCE', value: '₹2,980.00', change: '+42.15', pct: '+1.43%', up: true },
    { symbol: 'TCS', value: '₹3,842.50', change: '-18.30', pct: '-0.47%', up: false }
  ]);

  const { data: socketUpdates } = useSocket('price_update');

  useEffect(() => {
    if (socketUpdates && socketUpdates.length > 0) {
      setTickerData(socketUpdates);
    }
  }, [socketUpdates]);

  const TickerItem = ({ item }) => (
    <div className="flex items-center gap-3 px-4 py-1 whitespace-nowrap group cursor-default">
      <span className="text-[11px] font-bold text-zinc-400 group-hover:text-white transition-colors tracking-wide">{item.symbol}</span>
      <span className="text-[11px] font-mono-data font-semibold text-zinc-300">{item.value}</span>
      <span className={`text-[11px] font-mono-data font-bold ${item.up ? 'text-success' : 'text-danger'}`}>
        {item.change.startsWith('+') || item.change.startsWith('-') ? '' : (item.up ? '+' : '')}{item.change} ({item.pct.includes('%') ? item.pct : item.pct + '%'})
      </span>
    </div>
  );

  return (
    <div className="w-full bg-[#0a0a0a] border-b border-white/[0.04] overflow-hidden relative">
      <div className="ticker-strip">
        <div className="ticker-track">
          {[...tickerData, ...tickerData, ...tickerData].map((item, i) => (
            <TickerItem key={i} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
}
