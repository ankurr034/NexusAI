import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Briefcase, PlusCircle, AlertCircle, TrendingUp, TrendingDown, ArrowUpRight, ShieldCheck, Lock, FileText, Clock, Activity, Zap, PieChart, AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useToast } from '../components/Toast';
import CDSLModal from '../components/CDSLModal';
import { useUser } from '../context/UserContext';
import { API_BASE_URL } from '../config';

export default function Portfolio() {
  const toast = useToast();
  const { user, isLiveMode } = useUser();
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cdslOpen, setCdslOpen] = useState(false);
  const [selectedHolding, setSelectedHolding] = useState(null);
  const [sellQty, setSellQty] = useState(0);
  const [mode, setMode] = useState('Demo');
  const [analysis, setAnalysis] = useState({ score: 0, insights: [], diversification: [] });

  const [summary, setSummary] = useState({ total_invested: 0, total_current: 0, total_pnl: 0, total_pnl_pct: 0 });

  const fetchLivePortfolio = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [res, analysisRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/portfolio?user_id=${user.id}`),
        axios.get(`${API_BASE_URL}/api/portfolio/analysis?user_id=${user.id}`)
      ]);
      setHoldings(res.data.holdings || []);
      setSummary({
        total_invested: res.data.summary?.invested || 0,
        total_current: res.data.summary?.current || 0,
        total_pnl: res.data.summary?.pnl || 0,
        total_pnl_pct: res.data.summary?.invested > 0 ? (res.data.summary.pnl / res.data.summary.invested) * 100 : 0
      });
      setMode(res.data.mode || 'Demo');
      setAnalysis(analysisRes.data || { score: 0, insights: [], diversification: [] });
    } catch (err) {
      console.error('Failed to load portfolio data from backend', err);
      toast.error('Failed to load portfolio data');
      setHoldings([]);
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchLivePortfolio();
  }, [fetchLivePortfolio, isLiveMode]);

  const initiateSell = (holding) => {
    setSelectedHolding(holding);
    setSellQty(holding.qty);
    setCdslOpen(true);
  };

  const handleSellExecuted = async (holdingToSell = null, qtyToSell = null) => {
    const targetHolding = holdingToSell || selectedHolding;
    if (!targetHolding || !user) return;
    const targetQty = qtyToSell || sellQty || targetHolding.qty;
    try {
      const idempotencyKey = self.crypto?.randomUUID ? self.crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);
      await axios.post(`${API_BASE_URL}/api/broker/order?user_id=${user.id}`, {
        ticker: targetHolding.symbol,
        quantity: targetQty,
        price: targetHolding.current_price,
        transaction_type: 'SELL',
        order_type: 'MARKET',
        product_type: 'CNC'
      }, {
        headers: { 'X-Idempotency-Key': idempotencyKey }
      });
      toast.success(`[${mode}] Sold ${targetQty} shares of ${targetHolding.symbol}`);
      fetchLivePortfolio();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Sell failed');
    }
  };

  const totalInvested = summary.total_invested;
  const totalCurrent = summary.total_current;
  const totalReturns = summary.total_pnl;
  const returnPercent = (summary.total_pnl_pct || 0).toFixed(2);
  const isProfit = totalReturns >= 0;

  const handleLiquidateAll = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/portfolio/liquidate?user_id=${user.id}`);
      toast.success(`[${mode}] Liquidated ${res.data.executed} positions.`);
      fetchLivePortfolio();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Liquidation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      
      {/* Page Header */}
      <div className="flex flex-col gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
             <h1 className="text-2xl font-extrabold text-white flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-white/[0.06] flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-primary" />
              </span>
              My Portfolio
            </h1>
            <div className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border ${mode === 'Live' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
              {mode} Account
            </div>
            {loading && <RefreshCw className="w-4 h-4 animate-spin text-zinc-600 ml-2" />}
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 ml-0 sm:ml-[52px]">Managing {holdings.length} holdings in {mode.toLowerCase()} environment</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <Link to="/cdsl" className="flex items-center gap-2 text-xs font-black text-blue-400 bg-blue-500/5 hover:bg-blue-500/10 transition-all px-4 py-2.5 rounded-xl border border-blue-500/20 uppercase tracking-widest no-underline">
            <ShieldCheck className="w-4 h-4" /> CDSL E-DIS
          </Link>
          <Link to="/orders" className="flex items-center gap-2 text-xs font-black text-amber-400 bg-amber-400/5 hover:bg-amber-400/10 transition-all px-4 py-2.5 rounded-xl border border-amber-400/20 uppercase tracking-widest no-underline">
            <FileText className="w-4 h-4" /> Order Book
          </Link>
          <Link to="/" className="flex items-center gap-2 text-sm font-bold text-primary bg-primary/10 hover:bg-primary/15 transition-all px-5 py-2.5 rounded-xl border border-primary/20 no-underline">
            <PlusCircle className="w-4 h-4" /> INVEST MORE
          </Link>
          <button 
            onClick={() => {
              if (window.confirm("CRITICAL: This will sell ALL AUTHORIZED holdings at market price. Continue?")) {
                handleLiquidateAll();
              }
            }}
            disabled={loading || holdings.filter(h => h.is_authorized).length === 0}
            className="flex items-center gap-2 text-xs font-black text-rose-400 bg-rose-500/5 hover:bg-rose-500/10 transition-all px-4 py-2.5 rounded-xl border border-rose-500/20 uppercase tracking-widest disabled:opacity-30"
          >
            <ShieldAlert className="w-4 h-4" /> Liquidate All
          </button>
        </div>
      </div>

      {loading ? (
        <div className="glass-panel p-8">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}
            </div>
            <div className="skeleton h-64 rounded-xl" />
          </div>
        </div>
      ) : holdings.length === 0 ? (
        <div className="glass-panel p-8">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-white/[0.03] border border-white/[0.06] rounded-2xl flex items-center justify-center mb-6">
              <AlertCircle className="w-10 h-10 text-zinc-600" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">{mode} Portfolio is Empty</h2>
            <p className="text-zinc-500 max-w-sm mb-8">
              Start trading in {mode.toLowerCase()} mode to build your assets and track performance.
            </p>
            <Link to="/" className="px-6 py-3 bg-gradient-to-r from-primary to-emerald-400 text-black font-bold rounded-xl hover:shadow-primary/20 hover:shadow-lg transition-all no-underline">
              Explore Markets
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="glass-panel p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-[40px] group-hover:bg-primary/10 transition-all" />
              <p className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest mb-2">Portfolio Value</p>
              <p className="text-3xl font-extrabold text-white font-mono-data">₹{totalCurrent.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
            </div>

            <div className="glass-panel p-6 relative overflow-hidden group">
              <div className={`absolute top-0 right-0 w-24 h-24 ${isProfit ? 'bg-emerald-500/5' : 'bg-red-500/5'} rounded-full blur-[40px] group-hover:blur-[20px] transition-all`} />
              <p className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest mb-2">Total P&L</p>
              <div className="flex items-end gap-2">
                <p className={`text-3xl font-extrabold font-mono-data ${isProfit ? 'text-emerald-400' : 'text-danger'}`}>
                  {isProfit ? '+' : ''}₹{(totalReturns || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </p>
                <span className={`text-sm font-bold mb-1 flex items-center gap-1 ${isProfit ? 'text-emerald-400/60' : 'text-red-400/60'}`}>
                  {isProfit ? <ArrowUpRight className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {returnPercent}%
                </span>
              </div>
            </div>

            <div className="glass-panel p-6 relative overflow-hidden group">
              <p className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest mb-2">Total Invested</p>
              <p className="text-3xl font-bold text-zinc-400 font-mono-data">₹{totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
            </div>

            <div className="glass-panel p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/5 rounded-full blur-[30px]" />
              <p className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest mb-2">CDSL Auth Status</p>
              <div className="flex items-end gap-2">
                <p className="text-2xl font-extrabold text-blue-400 font-mono-data">
                  {holdings.filter(h => h.is_authorized).length}/{holdings.length}
                </p>
                <span className="text-xs text-zinc-600 mb-1 font-bold">Authorized</span>
              </div>
            </div>
          </div>

          {/* Holdings Table */}
          <div className="glass-panel overflow-hidden border-white/[0.04]">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.06] text-zinc-500 text-[10px] uppercase tracking-widest">
                    <th className="py-5 px-6 font-bold">Asset</th>
                    <th className="py-5 px-6 font-bold">ISIN</th>
                    <th className="py-5 px-6 font-bold text-right">Qty</th>
                    <th className="py-5 px-6 font-bold text-right">Avg Price</th>
                    <th className="py-5 px-6 font-bold text-right">LTP</th>
                    <th className="py-5 px-6 font-bold text-right">P&L</th>
                    <th className="py-5 px-6 font-bold text-center">CDSL Status</th>
                    <th className="py-5 px-6 font-bold text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h, i) => {
                    const rt = h.current - h.invested;
                    const isProfitRow = rt >= 0;
                    return (
                      <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group">
                        <td className="py-5 px-6">
                          <Link to={`/stock/${h.symbol}`} className="block no-underline">
                            <div className="flex items-center gap-3">
                               <div className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/[0.06] group-hover:border-primary/30 transition-colors">
                                  <span className="text-[10px] font-black text-zinc-400">{h.symbol.slice(0, 2)}</span>
                               </div>
                               <div>
                                  <p className="font-bold text-white group-hover:text-primary transition-colors mb-0">{h.symbol}</p>
                                  <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-tighter">{h.exchange} • {h.segment}</p>
                               </div>
                            </div>
                          </Link>
                        </td>
                        <td className="py-5 px-6 text-[10px] font-mono-data text-zinc-500 tracking-tighter">{h.isin}</td>
                        <td className="py-5 px-6 text-right font-bold text-zinc-300 font-mono-data">{h.qty || 0}</td>
                        <td className="py-5 px-6 text-right font-medium text-zinc-500 font-mono-data">₹{(h.avg_price || 0).toFixed(2)}</td>
                        <td className="py-5 px-6 text-right font-bold text-white font-mono-data">₹{(h.current_price || 0).toLocaleString('en-IN')}</td>
                        <td className={`py-5 px-6 text-right font-extrabold font-mono-data ${isProfitRow ? 'text-emerald-400' : 'text-danger'}`}>
                          <div className="flex flex-col items-end">
                            <span>{rt > 0 ? '+' : ''}₹{(rt || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                            <span className="text-[10px] font-medium opacity-60 mt-0.5">{(h.pnl_pct || 0).toFixed(2)}%</span>
                          </div>
                        </td>
                        <td className="py-5 px-6 text-center">
                           {h.is_authorized ? (
                             <div className="flex flex-col items-center">
                               <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-0.5">
                                 <ShieldCheck className="w-3 h-3" /> Authorized
                               </span>
                               <span className="text-[9px] text-zinc-600 font-mono-data flex items-center gap-1">
                                 <Clock className="w-2.5 h-2.5" />
                                 {h.dis_slip_no ? `DIS: ${h.dis_slip_no.slice(-10)}` : 'Active'}
                               </span>
                             </div>
                           ) : (
                             <span className="flex items-center justify-center gap-1 text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                               <Lock className="w-3 h-3" /> Pending E-DIS
                             </span>
                           )}
                        </td>
                        <td className="py-5 px-6 text-right">
                          <div className="flex justify-end">
                            {h.is_authorized ? (
                              <button 
                                onClick={() => {
                                  setSelectedHolding(h);
                                  setSellQty(h.qty);
                                  handleSellExecuted(h, h.qty);
                                }}
                                className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-500 hover:text-black transition-all shadow-lg shadow-emerald-500/10"
                              >
                                Execute Sell
                              </button>
                            ) : (
                              <button 
                                onClick={() => initiateSell(h)}
                                className="px-4 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-amber-500 hover:text-white transition-all flex items-center gap-1.5 shadow-lg shadow-amber-500/10"
                              >
                                <Lock className="w-3 h-3" /> Authorize
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ─── PORTFOLIO SANITIZER (AI Insights) ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mt-6 sm:mt-10">
            <div className="lg:col-span-2 glass-panel p-5 sm:p-8 lg:p-10 relative overflow-hidden border-white/[0.08] shadow-[0_30px_60px_rgba(0,0,0,0.4)]">
              <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
              
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-lg shadow-primary/10">
                     <ShieldCheck className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white leading-tight">Nexus AI Sanitizer</h2>
                    <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-[0.2em] mt-1">Portfolio Wellness & Risk Matrix</p>
                  </div>
                </div>
                <div className="text-right">
                   <span className={`text-5xl font-black font-mono-data ${analysis.score > 80 ? 'text-emerald-400' : analysis.score > 50 ? 'text-amber-400' : 'text-red-400'}`}>
                     {analysis.score}
                   </span>
                   <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mt-1">Health Score</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-10">
                 {/* Sector Allocation Heatmap */}
                 <div className="space-y-6">
                    <h3 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                       <PieChart className="w-4 h-4 text-primary" /> Diversification Heatmap
                    </h3>
                    <div className="space-y-4">
                       {analysis.diversification.length > 0 ? analysis.diversification.map((d, i) => (
                          <div key={i} className="space-y-2">
                             <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                                <span>{d.name}</span>
                                <span className="text-white">{d.value}%</span>
                             </div>
                             <div className="h-2 w-full bg-white/[0.03] rounded-full overflow-hidden border border-white/[0.04]">
                               <motion.div 
                                 initial={{ width: 0 }}
                                 animate={{ width: `${d.value}%` }}
                                 className={`h-full rounded-full ${i % 3 === 0 ? 'bg-primary shadow-[0_0_15px_rgba(0,212,170,0.4)]' : i % 3 === 1 ? 'bg-secondary' : 'bg-blue-500'}`}
                               />
                             </div>
                          </div>
                       )) : <p className="text-zinc-700 text-xs italic">Awaiting data...</p>}
                    </div>
                 </div>

                 {/* Alpha Insights */}
                 <div className="space-y-6">
                    <h3 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                       <Activity className="w-4 h-4 text-secondary" /> Nexus Alpha Insights
                    </h3>
                    <div className="space-y-4">
                       {analysis.insights.length > 0 ? analysis.insights.map((insight, i) => (
                          <motion.div 
                             key={i} 
                             initial={{ opacity: 0, x: 20 }}
                             animate={{ opacity: 1, x: 0 }}
                             transition={{ delay: i * 0.1 }}
                             className={`p-5 rounded-2xl border flex gap-4 ${
                               insight.type === 'WARNING' ? 'bg-red-500/5 border-red-500/20 text-red-100 shadow-[0_10px_30px_rgba(239,68,68,0.05)]' : 
                               insight.type === 'SUCCESS' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-100 shadow-[0_10px_30px_rgba(16,185,129,0.05)]' :
                               'bg-blue-500/5 border-blue-500/20 text-blue-100 shadow-[0_10px_30px_rgba(59,130,246,0.05)]'
                             }`}
                          >
                             {insight.type === 'WARNING' ? <AlertTriangle className="w-6 h-6 text-red-400 shrink-0" /> : 
                              insight.type === 'SUCCESS' ? <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" /> :
                              <Info className="w-6 h-6 text-blue-400 shrink-0" />}
                             <p className="text-xs font-medium leading-relaxed mt-0.5">{insight.text}</p>
                          </motion.div>
                       )) : (
                          <div className="p-10 bg-white/[0.01] border border-dashed border-white/[0.08] rounded-[24px] text-center text-zinc-700 text-xs font-bold uppercase tracking-widest">
                            No active threats detected.
                          </div>
                       )}
                    </div>
                 </div>
              </div>
            </div>

            {/* Side Pulse Sidebar */}
            <div className="space-y-6">
               <div className="glass-panel p-8 border-white/[0.08] bg-gradient-to-br from-white/[0.01] to-white/[0.04] shadow-xl">
                  <h3 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                     <Zap className="w-4 h-4 text-amber-400" /> Deep Analytics
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                     {[
                       { label: 'System Beta', val: '1.24', sub: 'Aggressive' },
                       { label: 'Ex-Alpha', val: '+4.2%', sub: 'Vs Sector' },
                       { label: 'Drawdown', val: '4.8%', sub: 'Max MTD' },
                       { label: 'Risk Adjusted', val: '7.8', sub: 'Sharpe Ratio' }
                     ].map((stat, i) => (
                        <div key={i} className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-2xl text-center hover:bg-white/[0.05] transition-all cursor-crosshair">
                           <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1.5">{stat.label}</p>
                           <p className="text-base font-black text-white font-mono-data mb-0.5">{stat.val}</p>
                           <p className="text-[8px] font-black text-primary uppercase tracking-tighter">{stat.sub}</p>
                        </div>
                     ))}
                  </div>
               </div>

               <div className="glass-panel p-8 border-primary/20 bg-primary/5 relative overflow-hidden group">
                  <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-[40px] group-hover:bg-primary/20 transition-all" />
                  <h3 className="text-xs font-black text-primary uppercase tracking-[0.2em] mb-3">Nexus AI Hedge Advice</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed mb-6 font-medium">
                     Your energy exposure is <span className="text-white font-bold">18% above target</span>. Nexus suggests hedging with 500 units of <span className="text-white font-bold">NIFTY JUN PUT</span> or liquidating 5% of Reliance.
                  </p>
                  <button className="w-full py-3.5 bg-primary text-black font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-emerald-400 transition-all hover:scale-[1.02] shadow-lg shadow-primary/10">Execute AI Hedge</button>
               </div>
            </div>
          </div>
        </>
      )}

      {selectedHolding && (
        <CDSLModal 
          isOpen={cdslOpen} 
          onClose={() => setCdslOpen(false)} 
          onAuthorized={() => {
            handleSellExecuted();
            setCdslOpen(false);
          }}
          stockSymbol={selectedHolding.symbol}
          quantity={sellQty || selectedHolding.qty}
        />
      )}
    </motion.div>
  );
}
