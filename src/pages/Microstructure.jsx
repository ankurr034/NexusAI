import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, Search, Zap, ArrowUpRight, ArrowDownRight, BarChart2, Eye, RefreshCw, AlertTriangle, Layers } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import useSocket from '../hooks/useSocket';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell } from 'recharts';

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.5 } } };

export default function Microstructure() {
  const [symbol, setSymbol] = useState('RELIANCE');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('RELIANCE');
  const { socket, isConnected, data: socketData } = useSocket('microstructure_update');

  const fetchData = (sym) => {
    setLoading(true);
    axios.get(`${API_BASE_URL}/api/microstructure/${sym}`)
      .then(res => { setData(res.data); setSymbol(sym); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { 
    fetchData('RELIANCE'); 
  }, []);

  useEffect(() => {
    if (socket && isConnected && symbol) {
      socket.emit('subscribe_microstructure', symbol);
    }
  }, [socket, isConnected, symbol]);

  useEffect(() => {
    if (socketData && socketData.symbol === symbol) {
      setData(prev => {
        if (!prev) return prev;
        const newTape = [socketData.new_trade, ...prev.trade_tape].slice(0, 50);
        return {
          ...prev,
          current_price: socketData.current_price,
          order_book: socketData.order_book,
          trade_tape: newTape
        };
      });
    }
  }, [socketData, symbol]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchInput.trim()) fetchData(searchInput.trim().toUpperCase());
  };

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center flex-col gap-4">
        <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
        <p className="text-zinc-400 font-bold animate-pulse text-sm">Analyzing order flow...</p>
      </div>
    );
  }

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" className="space-y-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-[28px] border border-white/[0.06] bg-gradient-to-br from-[#040d08] via-surface to-surface p-8 md:p-12">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-[150px] pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 flex items-center justify-center">
              <Layers className="w-7 h-7 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-white">Market Microstructure</h1>
              <p className="text-zinc-500 text-sm mt-0.5">Bloomberg-grade order flow analytics on your dashboard</p>
            </div>
          </div>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input value={searchInput} onChange={e => setSearchInput(e.target.value.toUpperCase())} placeholder="Symbol..."
                className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 pl-10 py-3 text-sm font-bold text-white focus:outline-none focus:border-emerald-500/40 w-48" />
            </div>
            <button type="submit" className="px-6 py-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-emerald-500/25 transition-all">
              Scan
            </button>
          </form>
        </div>
      </div>

      {data && (
        <>
          {/* Signal Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Order Imbalance', value: data.signals?.order_imbalance, color: data.signals?.order_imbalance?.includes('BUY') ? 'emerald' : data.signals?.order_imbalance?.includes('SELL') ? 'red' : 'zinc' },
              { label: 'Spread Quality', value: data.spread?.quality, color: data.spread?.quality === 'TIGHT' ? 'emerald' : data.spread?.quality === 'WIDE' ? 'red' : 'amber' },
              { label: 'Spread Trend', value: data.signals?.spread_trend, color: data.signals?.spread_trend === 'TIGHTENING' ? 'emerald' : data.signals?.spread_trend === 'WIDENING' ? 'red' : 'zinc' },
              { label: 'Block Alert', value: data.signals?.large_order_alert ? '🚨 ACTIVE' : 'None', color: data.signals?.large_order_alert ? 'amber' : 'zinc' },
            ].map((s, i) => (
              <div key={i} className="glass-panel p-5 border border-white/[0.04]">
                <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-3">{s.label}</p>
                <p className={`text-sm font-black text-${s.color}-400 uppercase tracking-wider`}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Order Book Depth + Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Order Book Visualization */}
            <div className="glass-panel p-6 border border-white/[0.04]">
              <h3 className="text-xs font-black text-white uppercase tracking-widest mb-5 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" /> Level 2 Order Book — {data.symbol}
              </h3>
              <div className="space-y-1.5">
                {/* Asks (reversed) */}
                {[...data.order_book?.asks || []].reverse().map((a, i) => (
                  <div key={`a${i}`} className="flex items-center gap-2 relative h-8">
                    <div className="absolute right-0 top-0 h-full bg-red-500/8 rounded-r"
                      style={{ width: `${Math.min(100, (a.quantity / 50000) * 100)}%` }} />
                    <span className="text-[10px] font-mono text-zinc-500 w-8 text-right z-10">{a.orders}</span>
                    <span className="text-xs font-bold text-red-400 font-mono-data w-20 z-10">₹{a.price?.toLocaleString()}</span>
                    <span className="text-[10px] text-zinc-500 font-mono-data z-10 flex-1 text-right">{a.quantity?.toLocaleString()}</span>
                  </div>
                ))}
                
                {/* Spread Line */}
                <div className="flex items-center gap-3 py-2 border-y border-white/[0.06]">
                  <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Spread</span>
                  <span className="text-xs font-black text-white font-mono-data">₹{data.spread?.absolute}</span>
                  <span className="text-[9px] font-bold text-zinc-500">({data.spread?.percentage}%)</span>
                  <span className="text-lg font-black text-white ml-auto font-mono-data">₹{data.current_price?.toLocaleString()}</span>
                </div>
                
                {/* Bids */}
                {data.order_book?.bids?.map((b, i) => (
                  <div key={`b${i}`} className="flex items-center gap-2 relative h-8">
                    <div className="absolute left-0 top-0 h-full bg-emerald-500/8 rounded-l"
                      style={{ width: `${Math.min(100, (b.quantity / 50000) * 100)}%` }} />
                    <span className="text-[10px] font-mono text-zinc-500 w-8 text-right z-10">{b.orders}</span>
                    <span className="text-xs font-bold text-emerald-400 font-mono-data w-20 z-10">₹{b.price?.toLocaleString()}</span>
                    <span className="text-[10px] text-zinc-500 font-mono-data z-10 flex-1 text-right">{b.quantity?.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Liquidity Metrics */}
            <div className="space-y-6">
              <div className="glass-panel p-6 border border-white/[0.04]">
                <h3 className="text-xs font-black text-white uppercase tracking-widest mb-5 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-sky-400" /> Liquidity Metrics
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Bid Depth', value: data.liquidity?.total_bid_depth?.toLocaleString(), color: 'emerald' },
                    { label: 'Ask Depth', value: data.liquidity?.total_ask_depth?.toLocaleString(), color: 'red' },
                    { label: 'Bid/Ask Ratio', value: data.liquidity?.bid_ask_ratio, color: data.liquidity?.bid_ask_ratio > 1 ? 'emerald' : 'red' },
                    { label: 'VWAP', value: `₹${data.liquidity?.vwap?.toLocaleString()}`, color: 'violet' },
                    { label: 'Avg Trade Size', value: data.liquidity?.avg_trade_size, color: 'amber' },
                    { label: 'Impact Cost (1Cr)', value: `${data.liquidity?.impact_cost_1cr}%`, color: 'cyan' },
                  ].map((m, i) => (
                    <div key={i} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                      <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">{m.label}</p>
                      <p className={`text-sm font-black text-${m.color}-400 font-mono-data`}>{m.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hidden Liquidity Alert */}
              {data.signals?.hidden_liquidity && (
                <div className="glass-panel p-4 border border-amber-500/20 bg-amber-500/5 flex items-center gap-3">
                  <Eye className="w-5 h-5 text-amber-400" />
                  <div>
                    <p className="text-xs font-black text-amber-400">Hidden Liquidity Detected</p>
                    <p className="text-[10px] text-zinc-500 font-bold">Iceberg orders detected — large orders being hidden below surface</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Order Flow Imbalance Timeline */}
          <div className="glass-panel p-6 border border-white/[0.04]">
            <h3 className="text-xs font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-violet-400" /> Order Flow Imbalance (OFI)
            </h3>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.ofi_timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                  <XAxis dataKey="time" stroke="#52525b" tick={{ fill: '#71717a', fontSize: 9 }} minTickGap={20} />
                  <YAxis stroke="#52525b" tick={{ fill: '#71717a', fontSize: 10 }} />
                  <ReferenceLine y={0} stroke="#ffffff15" strokeDasharray="3 3" />
                  <Tooltip content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-[#0a0a12]/95 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl">
                          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">{d.time}</p>
                          <p className={`text-sm font-black ${d.ofi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>OFI: {d.ofi}%</p>
                          <p className="text-xs text-zinc-500">Buy: {d.buy_volume?.toLocaleString()} | Sell: {d.sell_volume?.toLocaleString()}</p>
                        </div>
                      );
                    }
                    return null;
                  }} />
                  <Bar dataKey="ofi" radius={[3, 3, 0, 0]}>
                    {data.ofi_timeline?.map((entry, index) => (
                      <Cell key={index} fill={entry.ofi >= 0 ? '#10b981' : '#ef4444'} fillOpacity={0.6} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Trade Tape */}
          <div className="glass-panel p-6 border border-white/[0.04]">
            <h3 className="text-xs font-black text-white uppercase tracking-widest mb-5 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" /> Live Trade Tape
            </h3>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-white/[0.06]">
                    {['Time', 'Side', 'Price', 'Qty', 'Value', 'Type'].map(h => (
                      <th key={h} className="text-[9px] font-black text-zinc-600 uppercase tracking-widest py-3 px-3 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.trade_tape?.map((t, i) => (
                    <tr key={i} className={`border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors ${t.is_block ? 'bg-amber-500/[0.03]' : ''}`}>
                      <td className="py-2.5 px-3 text-[10px] text-zinc-500 font-mono">{t.time}</td>
                      <td className="py-2.5 px-3">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded ${t.side === 'BUY' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{t.side}</span>
                      </td>
                      <td className="py-2.5 px-3 text-xs font-bold text-white font-mono-data">₹{t.price?.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-xs text-zinc-400 font-mono-data">{t.quantity?.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-xs text-zinc-400 font-mono-data">₹{t.value?.toLocaleString()}</td>
                      <td className="py-2.5 px-3">
                        {t.is_block && <span className="text-[8px] font-black px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 uppercase tracking-widest">BLOCK</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}
