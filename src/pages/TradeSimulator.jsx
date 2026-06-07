import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, PlayCircle, BarChart2, Activity, Zap, Server, StopCircle, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { useUser } from '../hooks/useUser';
import { API_BASE_URL } from '../config';
import { useToast } from '../hooks/useToast';

export default function TradeSimulator() {
  const { user } = useUser();
  const { addToast } = useToast();
  
  const [orderSymbol, setOrderSymbol] = useState('RELIANCE');
  const [orderQty, setOrderQty] = useState(10);
  const [isPlacing, setIsPlacing] = useState(false);
  const [portfolio, setPortfolio] = useState({ balance: 1000000, totalTrades: 0 });

  // Simulate fetching paper portfolio (mocking for frontend display)
  useEffect(() => {
     if (user) {
         setPortfolio({ balance: 1000000, totalTrades: 0 });
     }
  }, [user]);

  const handleExecutePaperTrade = async (action) => {
    setIsPlacing(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/broker/order`, {
         user_id: user?.walletAddress || 'nexus-sim-user',
         broker_name: 'Simulated Broker',
         order_config: {
             symbol: orderSymbol,
             action: action,
             quantity: Number(orderQty),
             type: 'MARKET',
             isPaperTrade: true // Routes to PaperTradingEngine!
         }
      });
      
      if (res.data.success) {
         addToast("Simulated Order Filled", res.data.message, "success");
         setPortfolio(p => ({ ...p, totalTrades: p.totalTrades + 1 }));
      } else {
         addToast("Simulator Error", res.data.detail, "error");
      }
    } catch (e) {
      addToast("Simulator Rejected", e.response?.data?.detail || e.message, "error");
    } finally {
      setIsPlacing(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl p-8 border border-white/5"
        style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.05), rgba(16,185,129,0.05))' }}
      >
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-xl">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white flex items-center gap-3">
                 Paper Trading Engine
                 <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-1 rounded-md uppercase tracking-widest font-bold border border-blue-500/20">
                    Active
                 </span>
              </h1>
              <p className="text-zinc-400 text-sm mt-1">Virtual execution sandbox with 0ms latency and enforced risk guards.</p>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Portfolio Panel */}
          <div className="glass-panel p-6 border-t-2 border-t-emerald-500">
             <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4 flex items-center gap-2">
               <Activity size={16} className="text-emerald-500"/> Virtual Ledger
             </h3>
             <div className="space-y-6">
                <div>
                   <p className="text-xs text-zinc-500 font-bold uppercase mb-1">Buying Power</p>
                   <p className="text-3xl font-black text-white font-mono-data">₹{portfolio.balance.toLocaleString()}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                       <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Total Trades</p>
                       <p className="text-lg font-bold text-zinc-300">{portfolio.totalTrades}</p>
                    </div>
                    <div>
                       <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Risk Status</p>
                       <p className="text-lg font-bold text-emerald-400">NOMINAL</p>
                    </div>
                </div>
             </div>
          </div>

          {/* Execution Panel */}
          <div className="md:col-span-2 glass-panel p-6 border border-white/5">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                 <Zap size={16} className="text-amber-500"/> Simulator Orderbook
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Symbol</label>
                    <input 
                       value={orderSymbol} 
                       onChange={e => setOrderSymbol(e.target.value)}
                       className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white font-mono font-bold focus:outline-none focus:border-blue-500"
                    />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-2">Quantity</label>
                    <input 
                       type="number"
                       value={orderQty} 
                       onChange={e => setOrderQty(e.target.value)}
                       className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-white font-mono font-bold focus:outline-none focus:border-blue-500"
                    />
                 </div>
              </div>
              
              <div className="flex gap-4 mt-8">
                 <button 
                    onClick={() => handleExecutePaperTrade('BUY')}
                    disabled={isPlacing}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-xl shadow-lg shadow-emerald-900/20 transition-all flex items-center justify-center gap-2"
                 >
                    {isPlacing ? <RefreshCw className="animate-spin" size={18} /> : 'SIMULATE BUY'}
                 </button>
                 <button 
                    onClick={() => handleExecutePaperTrade('SELL')}
                    disabled={isPlacing}
                    className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-black py-4 rounded-xl shadow-lg shadow-rose-900/20 transition-all flex items-center justify-center gap-2"
                 >
                    {isPlacing ? <RefreshCw className="animate-spin" size={18} /> : 'SIMULATE SELL'}
                 </button>
              </div>
          </div>
      </div>
      
      {/* Simulation Replay Stub */}
      <div className="glass-panel p-6 opacity-50 cursor-not-allowed">
          <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                 <PlayCircle size={16} className="text-blue-500"/> Historical Replay Interface
              </h3>
              <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-1 rounded">COMING SOON</span>
          </div>
          <p className="text-xs text-zinc-500 mt-2">The AI Backtesting and candlestick playback suite will be enabled here.</p>
      </div>
    </div>
  );
}
