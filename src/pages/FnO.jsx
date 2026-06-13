import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Zap, AlertTriangle, ShoppingBag, X, Activity, ChevronDown } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useToast } from '../components/Toast';
import axios from 'axios';
import { API_BASE_URL } from '../config';

export default function FnO() {
  const toast = useToast();
  const [index, setIndex] = useState('NIFTY');
  const [balance, setBalance] = useState(0);
  const [selectedContract, setSelectedContract] = useState(null);
  const [chainData, setChainData] = useState(null);
  const [loading, setLoading] = useState(true);

  const spotPrice = chainData?.spot || (index === 'NIFTY' ? 22450.60 : 47683.45);
  const strikeStep = index === 'NIFTY' ? 50 : 100;
  const lotSize = index === 'NIFTY' ? 50 : 15;

  const fetchChain = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/fno/chain/${index}`);
      setChainData(res.data);
      
      const balRes = await axios.get(`${API_BASE_URL}/api/wallet`);
      setBalance(balRes.data.balance);
    } catch (e) {
      console.error("Chain fetch error", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChain();
  }, [index]);

  const handleContractSelect = (strike, type, price) => {
    setSelectedContract({ strike, type, price, index, lotSize, premium: price * lotSize });
  };

  const executeVirtualOptionsTrade = async () => {
    if (!selectedContract) return;
    
    try {
      const idempotencyKey = self.crypto?.randomUUID ? self.crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
      const res = await axios.post(`${API_BASE_URL}/api/broker/order`, {
        ticker: `${index} ${selectedContract.strike} ${selectedContract.type}`,
        quantity: selectedContract.lotSize,
        price: selectedContract.price,
        order_type: 'MARKET',
        transaction_type: 'BUY'
      }, {
        headers: { 'X-Idempotency-Key': idempotencyKey }
      });
      
      toast.success(res.data.message);
      setSelectedContract(null);
      fetchChain();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Execution failed');
    }
  };

  const generatePayoffData = () => {
    if (!selectedContract) return [];
    const data = [];
    const viewRange = index === 'NIFTY' ? 1000 : 2500;
    const step = index === 'NIFTY' ? 20 : 50;

    for (let s = spotPrice - viewRange; s <= spotPrice + viewRange; s += step) {
      let pnl = selectedContract.type === 'CE'
        ? (Math.max(0, s - selectedContract.strike) - selectedContract.price) * selectedContract.lotSize
        : (Math.max(0, selectedContract.strike - s) - selectedContract.price) * selectedContract.lotSize;
      data.push({ strikePrice: Math.round(s), profit: Math.round(pnl) });
    }
    return data;
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 relative pb-20">

      {/* Header */}
      <div className="glass-panel p-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-white/[0.06] flex items-center justify-center">
              <Zap className="w-5 h-5 text-amber-400" />
            </div>
            Advanced Options Chain
          </h1>
          <p className="text-zinc-600 text-sm mt-1 ml-[44px]">Real-time Futures & Options Derivatives Market</p>
        </div>
        <div className="flex flex-col md:flex-row gap-3 items-center">
          <div className="bg-white/[0.03] border border-white/[0.06] p-1 flex rounded-xl">
            <button onClick={() => setIndex('NIFTY')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${index === 'NIFTY' ? 'bg-primary text-black' : 'text-zinc-500 hover:text-white'}`}>
              NIFTY 50
            </button>
            <button onClick={() => setIndex('BANKNIFTY')} className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${index === 'BANKNIFTY' ? 'bg-primary text-black' : 'text-zinc-500 hover:text-white'}`}>
              BANKNIFTY
            </button>
          </div>
          <div className="relative">
            <select className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-1.5 text-white text-sm font-semibold outline-none focus:border-primary/30 appearance-none pr-8 cursor-pointer">
              <option>28 MAR (W)</option>
              <option>04 APR (W)</option>
              <option>25 APR (M)</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Spot Price */}
      <div className="flex items-center justify-between glass-panel p-4 border-l-4 border-l-amber-500/60">
        <p className="text-[10px] font-bold uppercase text-zinc-500 tracking-widest flex items-center gap-1.5">
          <div className="live-dot" style={{ width: '6px', height: '6px' }} /> Underlying Spot
        </p>
        <p className="font-extrabold text-lg text-white font-mono-data">
          {index} <span className="text-amber-400">{spotPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
        </p>
      </div>

      <p className="text-zinc-600 text-[10px] text-center uppercase tracking-widest font-bold bg-white/[0.02] py-2 rounded-xl border border-white/[0.04]">
        <span className="text-primary">Interactive:</span> Click any LTP to open the Strategy Builder
      </p>

      {/* Options Chain Table */}
      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse text-sm">
            <thead>
              <tr className="bg-white/[0.03] border-b border-white/[0.06] font-bold text-[10px] uppercase tracking-widest text-zinc-500">
                <th colSpan="3" className="py-3 border-r border-white/[0.06] text-emerald-500">CALLS (CE)</th>
                <th className="py-3 bg-surface border-r border-white/[0.06] text-white w-28">STRIKE</th>
                <th colSpan="3" className="py-3 text-red-500">PUTS (PE)</th>
              </tr>
              <tr className="border-b border-white/[0.06] font-bold text-[10px] text-zinc-600 bg-black/20">
                <th className="py-2 pl-4 text-left">OI (Lacs)</th>
                <th className="py-2">Chg%</th>
                <th className="py-2 border-r border-white/[0.06]">LTP (₹)</th>
                <th className="py-2 bg-surface border-r border-white/[0.06]"></th>
                <th className="py-2 border-r border-white/[0.06]">LTP (₹)</th>
                <th className="py-2">Chg%</th>
                <th className="py-2 pr-4 text-right">OI (Lacs)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3 animate-pulse">
                      <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                      <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Streaming Chain Data...</span>
                    </div>
                  </td>
                </tr>
              ) : chainData?.chain?.map((row, i) => {
                const isITM_Call = row.strike < spotPrice;
                const isITM_Put = row.strike > spotPrice;
                const isATM = row.is_atm;

                return (
                  <tr key={i} className={`border-b border-white/[0.04] hover:bg-white/[0.04] transition-colors group ${isATM ? 'relative z-10' : ''}`}>
                    <td className={`py-3.5 pl-4 text-left font-medium text-zinc-400 ${isITM_Call ? 'bg-amber-500/[0.04]' : ''}`}>
                      <div className="flex items-center gap-2">
                        <span className="w-10 font-mono-data text-xs">{row.ce.oi}</span>
                        <div className="h-1 bg-emerald-500/20 rounded-full" style={{ width: `${Math.min(row.ce.oi, 40)}px` }} />
                      </div>
                    </td>
                    <td className={`py-3.5 font-semibold ${row.ce.chg >= 0 ? 'text-emerald-400' : 'text-red-400'} text-xs font-mono-data ${isITM_Call ? 'bg-amber-500/[0.04]' : ''}`}>
                      {row.ce.chg > 0 ? '+' : ''}{row.ce.chg.toFixed(1)}%
                    </td>
                    <td 
                      onClick={() => handleContractSelect(row.strike, 'CE', row.ce.price)}
                      className={`py-3.5 border-r border-white/[0.06] font-bold text-emerald-400 hover:bg-emerald-500/15 cursor-pointer transition-colors font-mono-data ${isITM_Call ? 'bg-amber-500/[0.08]' : ''}`}
                    >
                      {row.ce.price.toFixed(2)}
                    </td>
                    <td className={`py-3 font-extrabold text-sm border-r border-white/[0.06] font-mono-data ${isATM ? 'bg-primary/20 text-primary shadow-[inset_0_0_15px_rgba(0,212,170,0.1)]' : 'bg-surface/80 text-white'}`}>
                      {row.strike.toLocaleString()}
                    </td>
                    <td 
                      onClick={() => handleContractSelect(row.strike, 'PE', row.pe.price)}
                      className={`py-3.5 border-r border-white/[0.06] font-bold text-red-500 hover:bg-red-500/15 cursor-pointer transition-colors font-mono-data ${isITM_Put ? 'bg-red-500/[0.08]' : ''}`}
                    >
                      {row.pe.price.toFixed(2)}
                    </td>
                    <td className={`py-3.5 font-semibold ${row.pe.chg >= 0 ? 'text-emerald-400' : 'text-red-400'} text-xs font-mono-data ${isITM_Put ? 'bg-red-500/[0.04]' : ''}`}>
                      {row.pe.chg > 0 ? '+' : ''}{row.pe.chg.toFixed(1)}%
                    </td>
                    <td className={`py-3.5 pr-4 text-right font-medium text-zinc-400 ${isITM_Put ? 'bg-red-500/[0.04]' : ''}`}>
                      <div className="flex items-center gap-2 justify-end">
                        <div className="h-1 bg-red-500/20 rounded-full" style={{ width: `${Math.min(row.pe.oi, 40)}px` }} />
                        <span className="w-10 font-mono-data text-xs">{row.pe.oi}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-zinc-700 text-[10px] text-center uppercase tracking-widest font-bold flex items-center justify-center gap-1">
        <AlertTriangle className="w-3 h-3" /> Options trading involves extreme market risk. Use mock environment for educational simulations.
      </p>

      {/* Strategy Builder Modal */}
      <AnimatePresence>
        {selectedContract && (
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 60, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-4xl z-50 px-4"
          >
            <div className="glass-panel border border-white/[0.1] shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden">
              <div className="flex justify-between items-center p-4 border-b border-white/[0.06] bg-gradient-to-r from-primary/5 to-transparent">
                <p className="font-bold text-white flex items-center gap-2 text-sm">
                  <ShoppingBag className="w-4 h-4 text-primary" /> Strategy Builder — Long {selectedContract.type}
                </p>
                <button onClick={() => setSelectedContract(null)} className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-colors text-zinc-500">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-col md:flex-row gap-6 p-6">
                <div className="w-full md:w-1/3 space-y-4">
                  <div className="bg-white/[0.03] border border-white/[0.04] rounded-xl p-4">
                    <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-1">Contract</p>
                    <p className="text-lg font-extrabold text-white font-mono-data">
                      {selectedContract.index} <span className="text-amber-400">{selectedContract.strike.toLocaleString()} {selectedContract.type}</span>
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/[0.03] border border-white/[0.04] rounded-xl p-3">
                      <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-0.5">LTP</p>
                      <p className="text-base font-bold text-emerald-400 font-mono-data">₹{selectedContract.price.toFixed(2)}</p>
                    </div>
                    <div className="bg-white/[0.03] border border-white/[0.04] rounded-xl p-3">
                      <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-0.5">Lot Size</p>
                      <p className="text-base font-bold text-white font-mono-data">{selectedContract.lotSize}</p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/[0.04]">
                    <div className="flex justify-between items-center mb-5">
                      <span className="text-zinc-600 font-bold uppercase text-[10px] tracking-widest">Margin Required</span>
                      <span className="text-xl font-extrabold text-white font-mono-data">
                        ₹{(selectedContract.price * selectedContract.lotSize).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                    <button
                      onClick={executeVirtualOptionsTrade}
                      className="w-full bg-gradient-to-r from-primary to-emerald-400 hover:shadow-lg hover:shadow-primary/20 text-black font-extrabold uppercase tracking-wider py-3.5 rounded-xl transition-all active:scale-[0.98]"
                    >
                      Execute Virtual Trade
                    </button>
                  </div>
                </div>

                <div className="w-full md:w-2/3 h-[220px] relative mt-2 md:mt-0">
                  <p className="absolute -top-1 left-2 text-[10px] text-zinc-600 uppercase tracking-widest font-bold z-10">Estimated P&L at Expiry</p>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={generatePayoffData()} margin={{ top: 15, right: 10, left: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00d4aa" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#00d4aa" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <ReferenceLine y={0} stroke="#ffffff10" strokeDasharray="3 3" />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0c0c12', borderColor: '#ffffff10', borderRadius: '10px', color: 'white', fontFamily: 'JetBrains Mono' }}
                        itemStyle={{ fontWeight: 'bold', fontSize: '12px' }}
                      />
                      <XAxis dataKey="strikePrice" stroke="#a1a1aa" fontSize={10} />
                      <YAxis hide domain={['auto', 'auto']} />
                      <Area type="linear" dataKey="profit" name="Est. P&L (₹)" stroke="#00d4aa" fill="url(#profitGrad)" strokeWidth={2.5} isAnimationActive={true} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
