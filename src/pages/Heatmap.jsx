import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Flame, RefreshCw, BarChart3, TrendingUp, TrendingDown, Activity, Zap } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import useSocket from '../hooks/useSocket';
import D3Treemap from '../components/D3Treemap';

export default function Heatmap() {
  const socket = useSocket();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liveDelta, setLiveDelta] = useState(null);

  // 1. Initial REST Load for the full tree geometry
  const fetchHeatmap = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/heatmap`);
      setData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHeatmap();
  }, []);

  // 2. WebSocket Subscription for Delta Updates
  useEffect(() => {
    if (!socket || !data) return;

    socket.emit('join_heatmap');

    const handleUpdate = (delta) => {
       // Update global breadth state instantly in React
       setData(prev => {
           if (!prev) return prev;
           return { ...prev, breadth: delta.breadth };
       });
       
       // Pass delta directly to D3 to patch the DOM without re-rendering React
       setLiveDelta(delta);
    };

    socket.on('market_heatmap_update', handleUpdate);

    return () => {
       socket.off('market_heatmap_update', handleUpdate);
    };
  }, [socket, data !== null]);

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center flex-col gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-zinc-500 text-sm">Initializing D3 Analytics Engine...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl p-8 border border-white/5"
        style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.05), rgba(16,185,129,0.05))' }}
      >
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-emerald-500 flex items-center justify-center shadow-xl">
              <BarChart3 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white flex items-center gap-3">
                 Advanced Market Heatmap
                 <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-md uppercase tracking-widest font-bold border border-emerald-500/20 flex items-center gap-1">
                    <Activity className="w-3 h-3" /> Live D3 Engine
                 </span>
              </h1>
              <p className="text-zinc-400 text-sm mt-1">Real-time delta-streamed NIFTY 50 capitalization treemap.</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Market Breadth */}
      {data?.breadth && (
        <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-panel p-4 text-center border-t-2 border-t-emerald-500">
            <p className="text-2xl font-black text-emerald-400 font-mono-data">{data.breadth.advancers}</p>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Advancers</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-panel p-4 text-center border-t-2 border-t-rose-500">
            <p className="text-2xl font-black text-rose-400 font-mono-data">{data.breadth.decliners}</p>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Decliners</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-panel p-4 text-center border-t-2 border-t-zinc-600">
            <p className="text-2xl font-black text-zinc-400 font-mono-data">{data.breadth.unchanged}</p>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Unchanged</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-panel p-4 text-center hidden md:block">
            {/* Breadth Bar */}
            <div className="flex h-3 rounded-full overflow-hidden mb-2 bg-white/5">
              <div className="bg-emerald-500 transition-all duration-300" style={{ width: `${(data.breadth.advancers / data.breadth.total) * 100}%` }} />
              <div className="bg-zinc-700 transition-all duration-300" style={{ width: `${(data.breadth.unchanged / data.breadth.total) * 100}%` }} />
              <div className="bg-rose-500 transition-all duration-300" style={{ width: `${(data.breadth.decliners / data.breadth.total) * 100}%` }} />
            </div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Market Breadth</p>
          </motion.div>
        </div>
      )}

      {/* D3 Treemap Container */}
      <div className="glass-panel p-2 md:p-6 overflow-hidden">
         <div className="flex items-center justify-between mb-4 px-2">
             <div className="flex items-center gap-4">
                 <span className="text-sm font-bold text-white">NIFTY 50 Breakdown</span>
                 <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 rounded border border-amber-500/20">
                     <Zap className="w-3 h-3 text-amber-400" />
                     <span className="text-[10px] text-amber-400 font-bold uppercase tracking-widest">Unusual Volume Indicator</span>
                 </div>
             </div>
             
             {/* Legend */}
             <div className="hidden md:flex items-center gap-1 flex-wrap">
               {[
                 { label: '-3%', color: '#7f1d1d' },
                 { label: '-1.5%', color: '#991b1b' },
                 { label: '0%', color: '#18181b' }, // neutral/stroke
                 { label: '+1.5%', color: '#047857' },
                 { label: '+3%', color: '#064e3b' },
               ].map((item, i) => (
                 <div key={i} className="flex items-center gap-1.5 px-2 py-1">
                   <div className="w-3 h-3 rounded" style={{ backgroundColor: item.color, border: '1px solid rgba(255,255,255,0.1)' }} />
                   <span className="text-[9px] text-zinc-500 font-bold">{item.label}</span>
                 </div>
               ))}
             </div>
         </div>
         
         <div className="w-full h-full min-h-[500px]">
             <D3Treemap data={data} liveDelta={liveDelta} />
         </div>
      </div>
      
    </div>
  );
}
