import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, AlertTriangle, TrendingDown, TrendingUp, Activity, Zap, BarChart2, Target, RefreshCw, ChevronRight, ArrowDownRight, ArrowUpRight, Loader2, Info, PieChart } from 'lucide-react';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, RadarChart, Radar, PolarGrid, PolarAngleAxis, AreaChart, Area } from 'recharts';
import axios from 'axios';
import { useUser } from '../context/UserContext';
import { API_BASE_URL } from '../config';

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError(error) { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return <div className="p-8 text-center glass-panel border-rose-500/20"><AlertTriangle className="w-8 h-8 text-rose-400 mx-auto mb-4" /><h3 className="text-white font-bold mb-2">X-Ray Rendering Failed</h3><p className="text-zinc-500 text-sm">Failed to map AI insights to the dashboard. Please try refreshing.</p></div>;
    }
    return this.props.children;
  }
}

const SEVERITY_COLORS = {
  EXTREME: '#ef4444', HIGH: '#f97316', MODERATE: '#f59e0b', LOW: '#0ea5e9', POSITIVE: '#10b981',
};

export default function PortfolioXray() {
  const { user } = useUser();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => { fetchXray(); }, []);

  const fetchXray = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/portfolio/xray?user_id=${user?.id || 1}`);
      setData(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  if (loading) return <div className="py-20 text-center"><Loader2 className="w-8 h-8 text-primary mx-auto animate-spin" /></div>;
  if (!data) return null;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <PieChart size={14} /> },
    { id: 'stress', label: 'Stress Tests', icon: <AlertTriangle size={14} /> },
    { id: 'correlation', label: 'Correlation', icon: <Activity size={14} /> },
    { id: 'rebalance', label: 'Rebalance', icon: <Target size={14} /> },
  ];

  const xrayData = data?.xray || data || {};
  const healthScore = xrayData?.health_score || 0;
  const healthColor = healthScore > 75 ? '#10b981' : healthScore > 50 ? '#f59e0b' : '#ef4444';
  const riskMetrics = xrayData?.risk_metrics || {};
  const sectorExposure = xrayData?.sector_exposure || [];
  const riskDecomp = xrayData?.risk_decomposition || [];
  const holdingsDetail = xrayData?.holdings_detail || [];
  const stressTests = xrayData?.stress_tests || [];
  const corrMatrix = xrayData?.correlation_matrix || [];
  const rebalanceSugg = xrayData?.rebalance_suggestions || [];
  const concRisk = xrayData?.concentration_risk || { score: 0, top_holding_pct: 0, hhi_index: 0 };

  return (
    <ErrorBoundary>
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-500/20 flex items-center justify-center">
              <Shield className="w-6 h-6 text-violet-400" />
            </div>
            Portfolio X-Ray
          </h1>
          <p className="text-zinc-500 mt-2 text-sm">Bloomberg Terminal-grade portfolio analysis • No other Indian app has this</p>
        </div>
        <button onClick={fetchXray} className="flex items-center gap-2 px-4 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-xs font-bold text-zinc-400 hover:text-white transition-all">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Health Score Hero */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#060b18] via-surface to-surface border border-white/[0.08] p-8">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full blur-[150px] pointer-events-none" style={{ background: `${healthColor}10` }} />
        
        <div className="relative z-10 flex items-center gap-10">
          {/* Health Ring */}
          <div className="relative shrink-0">
            <svg className="w-40 h-40 -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="8" />
              <circle cx="60" cy="60" r="54" fill="none" stroke={healthColor} strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${healthScore * 3.39} 339`} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-black text-white">{healthScore}</span>
              <span className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: healthColor }}>Health Score</span>
            </div>
          </div>

          <div className="flex-1 grid grid-cols-5 gap-4">
            {[
              { label: 'Portfolio Value', value: `₹${(xrayData?.total_value || 0).toLocaleString()}`, color: 'text-white', icon: <BarChart2 size={14} /> },
              { label: 'Volatility', value: `${riskMetrics?.volatility || 0}%`, color: (riskMetrics?.volatility || 0) > 30 ? 'text-red-400' : 'text-emerald-400', icon: <Activity size={14} /> },
              { label: 'Beta', value: riskMetrics?.beta || 1.0, color: (riskMetrics?.beta || 1) > 1.2 ? 'text-amber-400' : 'text-emerald-400', icon: <TrendingUp size={14} /> },
              { label: 'Sharpe', value: riskMetrics?.sharpe || 0, color: (riskMetrics?.sharpe || 0) > 1 ? 'text-emerald-400' : 'text-amber-400', icon: <Zap size={14} /> },
              { label: 'VaR (95%)', value: `₹${(riskMetrics?.var_95 || 0).toLocaleString()}`, color: 'text-rose-400', icon: <AlertTriangle size={14} /> },
            ].map((m, i) => (
              <div key={i} className="bg-white/[0.03] rounded-2xl p-4 border border-white/[0.04]">
                <div className="flex items-center gap-2 text-zinc-600 mb-2">{m.icon}<span className="text-[9px] font-black uppercase tracking-widest">{m.label}</span></div>
                <p className={`text-xl font-black font-mono-data ${m.color}`}>{m.value}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/[0.04] pb-px">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-widest rounded-t-xl transition-all relative
              ${activeTab === tab.id ? 'text-primary' : 'text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.02]'}`}>
            {tab.icon} {tab.label}
            {activeTab === tab.id && <motion.div layoutId="xrayTab" className="absolute bottom-0 left-2 right-2 h-[2px] bg-primary rounded-full" />}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sector Exposure Pie */}
          <div className="glass-panel p-6">
            <h3 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <PieChart size={14} className="text-violet-400" /> Sector Exposure
            </h3>
            <ResponsiveContainer width="100%" height={280}>
              <RechartsPie>
                <Pie data={sectorExposure} cx="50%" cy="50%" innerRadius={70} outerRadius={110}
                  dataKey="value" paddingAngle={2} strokeWidth={0}>
                  {sectorExposure.map((s, i) => <Cell key={i} fill={s.color || '#3b82f6'} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontSize: 12 }}
                  formatter={(v) => `${v}%`} />
              </RechartsPie>
            </ResponsiveContainer>
            
            {sectorExposure.length === 0 && <p className="text-xs text-zinc-500 text-center">No sector exposure data.</p>}

            <div className="grid grid-cols-2 gap-2 mt-2">
              {sectorExposure.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded" style={{ background: s.color || '#3b82f6' }} />
                  <span className="text-zinc-500 flex-1">{s.name || 'Unknown'}</span>
                  <span className={`font-black ${s.risk_level === 'HIGH' ? 'text-red-400' : 'text-white'}`}>{s.value || 0}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Risk Decomposition */}
          <div className="glass-panel p-6">
            <h3 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <Activity size={14} className="text-rose-400" /> Risk Decomposition
            </h3>
            <div className="space-y-4 mt-6">
              {riskDecomp.map((r, i) => (
                <div key={i}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-sm font-bold text-zinc-400">{r.factor || 'Factor'}</span>
                    <span className="text-sm font-black font-mono-data" style={{ color: r.color || '#3b82f6' }}>{r.contribution || 0}%</span>
                  </div>
                  <div className="h-2.5 bg-white/[0.04] rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (r.contribution || 0) * 2)}%` }}
                      transition={{ duration: 0.8, delay: i * 0.1 }}
                      className="h-full rounded-full" style={{ background: r.color || '#3b82f6' }} />
                  </div>
                </div>
              ))}
              {riskDecomp.length === 0 && <p className="text-xs text-zinc-500">Risk decomposition unavailable.</p>}
            </div>
            
            <div className="mt-6 p-4 rounded-xl bg-violet-500/[0.05] border border-violet-500/10">
              <div className="flex items-start gap-3">
                <Info size={14} className="text-violet-400 mt-0.5 shrink-0" />
                <p className="text-xs text-zinc-500 leading-relaxed">
                  <span className="text-violet-400 font-bold">Concentration Score: {concRisk.score || 0}/100</span> — 
                  Top holding is {concRisk.top_holding_pct || 0}% of portfolio. 
                  HHI Index: {concRisk.hhi_index || 0} {(concRisk.hhi_index || 0) > 2500 ? '(Concentrated)' : '(Diversified)'}.
                </p>
              </div>
            </div>
          </div>

          {/* Holdings Breakdown */}
          <div className="glass-panel overflow-hidden lg:col-span-2">
            <div className="p-5 border-b border-white/[0.04] flex items-center justify-between">
              <h3 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em]">Holdings Detail</h3>
              <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{holdingsDetail.length} Positions</span>
            </div>
            {holdingsDetail.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-500">No holdings detail found.</div>
            ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.04]">
                    {['Symbol', 'Sector', 'Weight', 'Price', 'P&L', 'Beta', 'Volatility'].map(h => (
                      <th key={h} className="text-left p-4 text-[10px] font-black text-zinc-600 uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {holdingsDetail.map((h, i) => (
                    <motion.tr key={h.symbol} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                      className="border-b border-white/[0.02] hover:bg-white/[0.01] transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black"
                            style={{ background: `hsl(${(i * 47) % 360}, 50%, 20%)`, color: `hsl(${(i * 47) % 360}, 70%, 60%)` }}>
                            {h.symbol.slice(0, 2)}
                          </div>
                          <span className="font-bold text-white">{h.symbol}</span>
                        </div>
                      </td>
                      <td className="p-4 text-xs text-zinc-500">{h.sector}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${h.weight}%` }} />
                          </div>
                          <span className="text-xs font-black text-white font-mono-data">{h.weight}%</span>
                        </div>
                      </td>
                      <td className="p-4 font-mono-data text-xs text-white">₹{h.current_price.toLocaleString()}</td>
                      <td className={`p-4 font-mono-data text-xs font-bold ${h.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {h.pnl >= 0 ? '+' : ''}{h.pnl_pct}%
                      </td>
                      <td className={`p-4 font-mono-data text-xs font-bold ${h.beta > 1.2 ? 'text-amber-400' : 'text-emerald-400'}`}>{h.beta || 1}</td>
                      <td className={`p-4 font-mono-data text-xs font-bold ${h.volatility > 35 ? 'text-rose-400' : 'text-emerald-400'}`}>{h.volatility || 0}%</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </div>
        </div>
      )}

      {/* Stress Tests Tab */}
      {activeTab === 'stress' && (
        <div className="space-y-4">
          <div className="glass-panel p-5 bg-rose-500/[0.02] border-rose-500/10">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-rose-400 mt-0.5" />
              <div>
                <h3 className="text-sm font-black text-white mb-1">Stress Testing Engine</h3>
                <p className="text-xs text-zinc-500">Simulating historical crisis events against your current portfolio to estimate potential impact.</p>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stressTests.length === 0 && <p className="text-xs text-zinc-500">No stress tests available.</p>}
            {stressTests.map((test, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                className={`glass-panel p-6 relative overflow-hidden border ${
                  test.severity === 'POSITIVE' ? 'border-emerald-500/20' : 'border-white/[0.04]'
                }`}>
                <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-[60px] pointer-events-none"
                  style={{ background: `${SEVERITY_COLORS[test.severity] || '#fff'}10` }} />
                
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[9px] font-black px-2 py-0.5 rounded-lg uppercase tracking-widest"
                      style={{ background: `${SEVERITY_COLORS[test.severity] || '#fff'}15`, color: SEVERITY_COLORS[test.severity] || '#fff' }}>
                      {test.severity || 'UNKNOWN'}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white mb-4">{test.scenario || 'Scenario'}</h4>
                  
                  <div className="flex items-end gap-3">
                    <div>
                      <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mb-1">Impact</p>
                      <p className={`text-2xl font-black font-mono-data ${(test.impact || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {(test.impact || 0) >= 0 ? '+' : ''}₹{Math.abs(test.impact || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="mb-1">
                      <span className={`text-sm font-black font-mono-data px-2 py-1 rounded-lg ${
                        (test.impact_pct || 0) >= 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'
                      }`}>
                        {(test.impact_pct || 0) >= 0 ? '+' : ''}{test.impact_pct || 0}%
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Correlation Tab */}
      {activeTab === 'correlation' && (
        <div className="glass-panel p-6 overflow-x-auto">
          <h3 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] mb-4">Correlation Matrix</h3>
          <p className="text-xs text-zinc-600 mb-6">Higher correlation = less diversification benefit. Aim for low or negative correlations between holdings.</p>
          
          {corrMatrix.length === 0 ? (
            <p className="text-xs text-zinc-500">Correlation data unavailable.</p>
          ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="p-3 text-[10px] font-black text-zinc-600 uppercase tracking-widest text-left"></th>
                {corrMatrix.map(row => (
                  <th key={row.symbol} className="p-3 text-[10px] font-black text-zinc-400 uppercase tracking-widest">{row.symbol}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {corrMatrix.map((row, ri) => (
                <tr key={row.symbol}>
                  <td className="p-3 text-xs font-bold text-zinc-400">{row.symbol}</td>
                  {corrMatrix.map((col, ci) => {
                    const val = row[col.symbol];
                    const bg = val === 1 ? 'bg-white/[0.04]' :
                      val > 0.5 ? 'bg-red-500/10' : val > 0.3 ? 'bg-amber-500/10' : 'bg-emerald-500/10';
                    const color = val === 1 ? 'text-zinc-500' :
                      val > 0.5 ? 'text-red-400' : val > 0.3 ? 'text-amber-400' : 'text-emerald-400';
                    return (
                      <td key={ci} className={`p-3 text-center font-mono-data text-xs font-bold ${bg} ${color} border border-white/[0.02]`}>
                        {val?.toFixed(2) || '-'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      )}

      {/* Rebalance Tab */}
      {activeTab === 'rebalance' && (
        <div className="space-y-4">
          {rebalanceSugg.length > 0 ? rebalanceSugg.map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
              className={`glass-panel p-6 border-l-4 ${
                s.urgency === 'HIGH' ? 'border-l-rose-500' : s.urgency === 'MEDIUM' ? 'border-l-amber-500' : 'border-l-blue-500'
              }`}>
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  s.type === 'REDUCE' ? 'bg-rose-500/10 text-rose-400' :
                  s.type === 'DIVERSIFY' ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'
                }`}>
                  {s.type === 'REDUCE' ? <TrendingDown size={18} /> : s.type === 'DIVERSIFY' ? <Target size={18} /> : <Shield size={18} />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-black text-white uppercase tracking-wider">{s.type}</span>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                      s.urgency === 'HIGH' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'
                    }`}>{s.urgency}</span>
                  </div>
                  <p className="text-sm text-zinc-400">{s.reason}</p>
                  {s.symbol !== 'MULTIPLE' && (
                    <p className="text-xs text-zinc-600 mt-1 font-mono-data">Symbol: {s.symbol}</p>
                  )}
                </div>
                <button className="px-4 py-2 bg-primary/10 text-primary text-xs font-black rounded-xl hover:bg-primary/20 transition-all uppercase tracking-widest">
                  Apply
                </button>
              </div>
            </motion.div>
          )) : (
            <div className="glass-panel p-12 text-center">
              <Shield className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
              <h3 className="text-lg font-black text-white mb-2">Portfolio is Well-Balanced 🎉</h3>
              <p className="text-sm text-zinc-500">No rebalancing actions needed at this time.</p>
            </div>
          )}
        </div>
      )}
    </div>
    </ErrorBoundary>
  );
}
