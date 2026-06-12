import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, TrendingUp, TrendingDown, Activity, Shield, Cpu, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, ComposedChart, Legend, ReferenceArea
} from 'recharts';

export default function Dashboard() {
  const [ticker, setTicker] = useState('RELIANCE');
  const [searchInput, setSearchInput] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async (symbol) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_BASE_URL}/api/stock/${symbol}`);
      setData(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(ticker);
  }, [ticker]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setTicker(searchInput.toUpperCase());
      setSearchInput('');
    }
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#121214]/90 backdrop-blur-md border border-white/10 p-3 rounded-lg shadow-2xl">
          <p className="text-zinc-400 text-xs mb-1 font-semibold">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 text-sm font-medium py-0.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-zinc-300">{entry.name}:</span>
              <span className="text-white">₹{entry.value?.toFixed(2) || 'N/A'}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="w-full max-w-xl relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-zinc-500 group-focus-within:text-primary transition-colors" />
        </div>
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Enter stock symbol (e.g. RELIANCE, TCS, INFY)"
          className="w-full bg-[#121214] border border-white/10 focus:border-primary/50 text-white rounded-xl py-4 pl-12 pr-4 shadow-lg focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-zinc-600"
        />
        <button type="submit" className="absolute inset-y-2 right-2 px-6 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-semibold transition-colors">
          Analyze
        </button>
      </form>

      {error && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-center gap-3">
          <Shield className="w-5 h-5" />
          {error}
        </motion.div>
      )}

      {loading ? (
        <div className="h-96 flex items-center justify-center flex-col gap-4">
          <RefreshCw className="w-8 h-8 text-primary animate-spin" />
          <p className="text-zinc-400 font-medium animate-pulse">Running AI pipeline & fetching live data...</p>
        </div>
      ) : data ? (
        <React.Fragment>
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <MetricCard 
              title="Current Price" 
              value={`₹ ${data.current_price?.toFixed(2)}`} 
              subtitle={data.ticker}
              icon={<Activity className="w-5 h-5 text-blue-400" />}
            />
            
            <MetricCard 
              title="LSTM AI Prediction" 
              value={data.prediction ? `₹ ${data.prediction.toFixed(2)}` : 'N/A'} 
              subtitle="Next Day Forecast"
              highlight={data.prediction > data.current_price ? 'positive' : 'negative'}
              icon={<Cpu className="w-5 h-5 text-purple-400" />}
            />

            <MetricCard 
              title="Annual Return" 
              value={`${(data.risk_metrics.annual_return * 100).toFixed(1)}%`} 
              subtitle="Historical Performance"
              highlight={data.risk_metrics.annual_return > 0 ? 'positive' : 'negative'}
              icon={<TrendingUp className="w-5 h-5 text-emerald-400" />}
            />

            <MetricCard 
              title="Volatility (Risk)" 
              value={`${(data.risk_metrics.volatility * 100).toFixed(1)}%`} 
              subtitle="Annualized Standard Deviation"
              icon={<TrendingDown className="w-5 h-5 text-orange-400" />}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Main Chart */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="lg:col-span-2 glass-panel p-6"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white">Price Action & Moving Averages</h3>
                  <p className="text-sm text-zinc-400">200-Day Historical Data</p>
                </div>
              </div>
              
              <div className="h-[250px] sm:h-[350px] lg:h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data.history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                    <XAxis dataKey="date" stroke="#a1a1aa" tick={{fill: '#a1a1aa', fontSize: 12}} tickMargin={10} minTickGap={30} />
                    <YAxis stroke="#a1a1aa" tick={{fill: '#a1a1aa', fontSize: 12}} domain={['auto', 'auto']} tickFormatter={(v) => `₹${v}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Area type="monotone" dataKey="close" name="Close Price" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorClose)" />
                    <Line type="monotone" dataKey="MA50" name="50-Day MA" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="MA200" name="200-Day MA" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Side Panel: RSI & Insights */}
            <div className="space-y-6">
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-panel p-6 h-[220px]"
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-white">RSI (Relative Strength)</h3>
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    data.history[data.history.length-1].RSI > 70 ? 'bg-red-500/20 text-red-400' :
                    data.history[data.history.length-1].RSI < 30 ? 'bg-emerald-500/20 text-emerald-400' :
                    'bg-white/10 text-white'
                  }`}>
                    {data.history[data.history.length-1].RSI?.toFixed(2)}
                  </span>
                </div>
                <div className="h-[120px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.history}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0d" vertical={false} />
                      <XAxis hide dataKey="date" />
                      <YAxis hide domain={[0, 100]} />
                      <Tooltip content={<CustomTooltip />} />
                      {/* RSI Zones mapping */}
                      <ReferenceArea y1={70} y2={100} fill="#ef4444" fillOpacity={0.05} />
                      <ReferenceArea y1={0} y2={30} fill="#10b981" fillOpacity={0.05} />
                      <Line type="monotone" dataKey="RSI" stroke="#2dd4bf" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-panel p-6"
              >
                 <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                   <Shield className="w-5 h-5 text-primary" />
                   AI Risk Analysis
                 </h3>
                 <div className="space-y-4">
                   <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                     <p className="text-zinc-400 text-sm mb-1">Sharpe Ratio</p>
                     <p className="text-2xl font-black text-white">{data.risk_metrics.sharpe_ratio.toFixed(2)}</p>
                     <p className="text-xs text-zinc-500 mt-1">
                       {data.risk_metrics.sharpe_ratio > 1 ? 'Good risk-adjusted return.' : 'Sub-optimal risk-adjusted return.'}
                     </p>
                   </div>

                   <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                     <p className="text-zinc-400 text-sm mb-1">AI Recommendation</p>
                     <p className="text-xl font-black text-white">
                        {data.prediction > data.current_price ? (
                           <span className="text-emerald-400">Bullish Accumulation</span>
                        ) : (
                           <span className="text-red-400">Cautious / Distribution</span>
                        )}
                     </p>
                     <p className="text-xs text-zinc-500 mt-2">
                       Based on Deep Learning LSTM model forecast.
                     </p>
                   </div>
                 </div>
              </motion.div>
            </div>
          </div>
        </React.Fragment>
      ) : null}
    </div>
  );
}

function MetricCard({ title, value, subtitle, icon, highlight }) {
  const highlightColor = highlight === 'positive' ? 'text-emerald-400' : highlight === 'negative' ? 'text-red-400' : 'text-white';
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel p-6 relative overflow-hidden group hover:border-white/20 transition-colors"
    >
      <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:opacity-40 transition-opacity group-hover:scale-110 duration-500">
        {icon}
      </div>
      <p className="text-zinc-400 text-sm font-semibold mb-2">{title}</p>
      <p className={`text-xl sm:text-2xl lg:text-3xl font-black tracking-tight ${highlightColor} mb-1 drop-shadow-md`}>{value}</p>
      <p className="text-xs text-zinc-500 font-medium">{subtitle}</p>
    </motion.div>
  );
}
