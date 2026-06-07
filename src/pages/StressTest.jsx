import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, AlertTriangle, TrendingDown, Zap, BarChart2, Activity, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { useUser } from '../context/UserContext';
import { API_BASE_URL } from '../config';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, RadialBarChart, RadialBar } from 'recharts';

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError(error) { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return <div className="p-8 text-center glass-panel border-rose-500/20"><AlertTriangle className="w-8 h-8 text-rose-400 mx-auto mb-4" /><h3 className="text-white font-bold mb-2">Simulation Rendering Failed</h3><p className="text-zinc-500 text-sm">Our AI engine encountered an unexpected data structure. Please try refreshing.</p></div>;
    }
    return this.props.children;
  }
}

export default function StressTest() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedScenario, setExpandedScenario] = useState(null);
  const { user } = useUser();

  useEffect(() => {
    const uid = user?.id || 1;
    axios.get(`${API_BASE_URL}/api/portfolio/stresstest?user_id=${uid}`)
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center flex-col gap-4">
        <RefreshCw className="w-8 h-8 text-rose-400 animate-spin" />
        <p className="text-zinc-400 font-bold animate-pulse text-sm">Running stress simulations...</p>
      </div>
    );
  }

  if (!data) return null;

  const testData = data?.stress_test || data || {};
  const resilienceScore = testData?.survival_probability || testData?.resilience_score || 0;
  const resilienceColor = resilienceScore > 70 ? 'emerald' : resilienceScore > 40 ? 'amber' : 'red';
  const riskMetrics = testData?.risk_metrics || {};
  const scenarios = testData?.scenarios || [];
  const monteCarlo = testData?.monte_carlo || [];

  return (
    <ErrorBoundary>
    <motion.div variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.5 } } }} initial="hidden" animate="show" className="space-y-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-[28px] border border-white/[0.06] bg-gradient-to-br from-[#120508] via-surface to-surface p-8 md:p-12">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-rose-500/10 rounded-full blur-[150px] pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500/20 to-orange-500/20 border border-rose-500/20 flex items-center justify-center">
              <Shield className="w-7 h-7 text-rose-400" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-white">Portfolio Stress Test</h1>
              <p className="text-zinc-500 text-sm mt-0.5">Black Swan Analyzer — See how your portfolio survives market crashes</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Portfolio Risk Score</p>
            <p className="text-2xl font-black text-white font-mono-data">{testData?.portfolio_risk || 0}/100</p>
          </div>
        </div>
      </div>

      {/* AI Summary Banner */}
      {testData?.ai_summary && (
        <div className="glass-panel p-5 bg-rose-500/[0.05] border-rose-500/20 flex items-start gap-4">
          <Zap className="w-5 h-5 text-rose-400 mt-0.5 shrink-0" />
          <div>
            <h4 className="text-sm font-black text-white mb-1">AI Risk Assessment</h4>
            <p className="text-sm text-zinc-400 leading-relaxed">{testData.ai_summary}</p>
          </div>
        </div>
      )}

      {/* Resilience Score + Risk Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Resilience Score */}
        <div className="glass-panel p-8 border border-white/[0.04] flex flex-col items-center justify-center">
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4">Resilience Score</p>
          <div className="relative w-40 h-40">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#ffffff08" strokeWidth="8" />
              <circle cx="50" cy="50" r="42" fill="none" stroke={`var(--color-${resilienceColor}-400, #f43f5e)`}
                strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${resilienceScore * 2.64} 264`}
                className="transition-all duration-1000" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-4xl font-black text-${resilienceColor}-400`}>{resilienceScore}</span>
              <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">/100</span>
            </div>
          </div>
          <p className={`text-xs font-black uppercase tracking-widest mt-4 text-${resilienceColor}-400`}>
            {resilienceScore > 70 ? 'STRONG' : resilienceScore > 40 ? 'MODERATE' : 'VULNERABLE'}
          </p>
        </div>

        {/* Risk Metrics */}
        <div className="md:col-span-2 glass-panel p-6 border border-white/[0.04]">
          <h3 className="text-xs font-black text-white uppercase tracking-widest mb-5 flex items-center gap-2">
            <Activity className="w-4 h-4 text-rose-400" /> Risk Metrics
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: 'Max Drawdown', value: `${testData?.max_drawdown || 0}%`, desc: 'Estimated worst drop' },
              { label: 'Volatility Score', value: `${testData?.volatility_score || 0}/100`, desc: 'Market sensitivity' },
              { label: 'VaR (95%) 1-Day', value: `₹${(riskMetrics?.var_95_1day || 0).toLocaleString()}`, desc: 'Max expected daily loss' },
              { label: 'Portfolio Beta', value: riskMetrics?.beta || 1.0, desc: 'Market correlation' },
              { label: 'Crash Impact', value: `${testData?.crash_impact || 0}%`, desc: 'Systemic risk est.' },
              { label: 'Expected Shortfall', value: `₹${(riskMetrics?.expected_shortfall || 0).toLocaleString()}`, desc: 'Avg loss beyond VaR' },
            ].map((m, i) => (
              <div key={i} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-2">{m.label}</p>
                <p className="text-lg font-black text-white font-mono-data">{m.value}</p>
                <p className="text-[9px] text-zinc-600 font-bold mt-1">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Crash Scenarios */}
      <div className="glass-panel p-6 border border-white/[0.04]">
        <h3 className="text-xs font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" /> Historical Crash Scenarios
        </h3>
        
        {scenarios.length === 0 && (
           <p className="text-xs text-zinc-500">No crash scenarios generated.</p>
        )}

        <div className="space-y-3">
          {scenarios.map((scenario, i) => (
            <div key={i} className="border border-white/[0.04] rounded-2xl overflow-hidden hover:border-white/[0.08] transition-all">
              <button
                onClick={() => setExpandedScenario(expandedScenario === i ? null : i)}
                className="w-full p-5 flex items-center gap-4 text-left hover:bg-white/[0.02] transition-all"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  Math.abs(scenario.nifty_drop) > 20 ? 'bg-red-500/15' : Math.abs(scenario.nifty_drop) > 5 ? 'bg-amber-500/15' : 'bg-zinc-500/15'
                }`}>
                  <TrendingDown className={`w-6 h-6 ${
                    Math.abs(scenario.nifty_drop) > 20 ? 'text-red-400' : Math.abs(scenario.nifty_drop) > 5 ? 'text-amber-400' : 'text-zinc-400'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-white">{scenario.name}</p>
                  <p className="text-[10px] text-zinc-500 font-bold">{scenario.desc} • {scenario.date}</p>
                </div>
                <div className="text-right mr-4">
                  <p className="text-sm font-black text-red-400 font-mono-data">{scenario.portfolio_impact_pct}%</p>
                  <p className="text-[10px] text-zinc-600 font-bold">₹{Math.abs(scenario.portfolio_impact_value)?.toLocaleString()} loss</p>
                </div>
                <div className="text-right mr-2">
                  <p className="text-xs font-bold text-zinc-400 font-mono-data">₹{scenario.post_crash_value?.toLocaleString()}</p>
                  <p className="text-[9px] text-zinc-600 font-bold">Surviving Value</p>
                </div>
                {expandedScenario === i ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
              </button>
              
              <AnimatePresence>
                {expandedScenario === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 border-t border-white/[0.04] pt-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {scenario.stock_impacts?.map((s, j) => (
                          <div key={j} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-black text-white">{s.symbol || 'SYM'}</span>
                              <span className="text-[9px] font-bold text-zinc-500">{s.sector || 'N/A'}</span>
                            </div>
                            <p className="text-sm font-black text-red-400 font-mono-data">{s.impact_pct || 0}%</p>
                            <p className="text-[9px] text-zinc-600 font-bold">₹{Math.abs(s.impact_value || 0)?.toLocaleString()} loss</p>
                          </div>
                        ))}
                        {(!scenario.stock_impacts || scenario.stock_impacts.length === 0) && (
                          <p className="text-xs text-zinc-500 col-span-2">No detailed stock impact data provided.</p>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-4 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                        <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                        <p className="text-xs text-zinc-400">
                          Estimated recovery: <span className="font-black text-white">{scenario.recovery_estimate_months} months</span>
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>

      {/* Monte Carlo Projection */}
      <div className="glass-panel p-6 border border-white/[0.04]">
        <h3 className="text-xs font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-violet-400" /> Monte Carlo Projection (1 Year)
        </h3>
        
        {monteCarlo.length === 0 && (
           <p className="text-xs text-zinc-500 mb-4">Monte Carlo projections unavailable.</p>
        )}

        {monteCarlo.length > 0 && (
          <>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monteCarlo} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                  <XAxis dataKey="percentile" stroke="#52525b" tick={{ fill: '#71717a', fontSize: 11 }} tickFormatter={v => `${v}th`} />
                  <YAxis stroke="#52525b" tick={{ fill: '#71717a', fontSize: 10 }} tickFormatter={v => `₹${(v/100000).toFixed(1)}L`} />
              <Tooltip content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  return (
                    <div className="bg-[#0a0a12]/95 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl">
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">{d.percentile}th Percentile</p>
                      <p className="text-sm font-bold text-white">₹{d.projected_value?.toLocaleString()}</p>
                      <p className={`text-xs font-black ${d.return_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{d.return_pct > 0 ? '+' : ''}{d.return_pct}%</p>
                    </div>
                  );
                }
                return null;
              }} />
              <Bar dataKey="projected_value" radius={[6, 6, 0, 0]}>
                {monteCarlo?.map((entry, index) => (
                  <Cell key={index} fill={entry.return_pct >= 0 ? '#10b981' : '#ef4444'} fillOpacity={0.6 + (index * 0.05)} />
                ))}
              </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-zinc-600 font-bold text-center mt-3">
            Based on Monte Carlo simulation. Lower percentiles = worst case scenarios.
          </p>
        </>
        )}
      </div>
    </motion.div>
    </ErrorBoundary>
  );
}
