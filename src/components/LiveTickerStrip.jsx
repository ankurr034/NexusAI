import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import useSocket from '../hooks/useSocket';
import useMarketSession from '../hooks/useMarketSession';

export default function LiveTickerStrip() {
  const session = useMarketSession(false);
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
    <div className="w-full bg-[#0a0a0a] border-b border-white/[0.04] overflow-hidden relative flex items-center">
      <div className="px-4 py-1.5 border-r border-white/[0.04] flex items-center gap-2 shrink-0 bg-white/[0.01]">
         <div className={`w-1.5 h-1.5 rounded-full ${session.status === 'OPEN' ? 'bg-emerald-500 animate-pulse' : session.status === 'PREMARKET' ? 'bg-amber-500' : 'bg-red-500'}`} />
         <span className={`text-[10px] font-black tracking-widest uppercase ${session.status === 'OPEN' ? 'text-emerald-400' : session.status === 'PREMARKET' ? 'text-amber-400' : 'text-zinc-500'}`}>
            MARKET {session.status}
         </span>
         <span className="text-[9px] text-zinc-600 font-bold ml-1 hidden md:inline-block">({session.nextTransition})</span>
      </div>
      <div className="ticker-strip flex-1">
        <div className="ticker-track">
          {[...tickerData, ...tickerData, ...tickerData].map((item, i) => (
            <TickerItem key={i} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
}
