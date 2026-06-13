import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, ArrowRight, RefreshCw, Activity, Zap, BarChart2, Briefcase, ChevronRight, Sparkles, Target, Globe, Newspaper, Star } from 'lucide-react';
import axios from 'axios';
import { useUser } from '../context/UserContext';
import { useToast } from '../components/Toast';
import { API_BASE_URL } from '../config';

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const HEATMAP_SECTIONS = [
  { key: 'NIFTY_50', label: 'NIFTY 50', type: 'index' },
  { key: 'BANK_NIFTY', label: 'BANK NIFTY', type: 'index' },
  { key: 'NIFTY_IT', label: 'IT INDEX', type: 'index' },
  { key: 'NIFTY_FMCG', label: 'FMCG', type: 'index' },
  { key: 'NIFTY_ENERGY', label: 'ENERGY', type: 'index' },
  { key: 'NIFTY_MIDCAP_100', label: 'MIDCAP 100', type: 'index' },
  { key: 'overbought', label: 'Overbought', type: 'mode' },
  { key: 'oversold', label: 'Oversold', type: 'mode' },
  { key: 'consolidating', label: 'Consolidating', type: 'mode' },
];

export default function Explore() {
  const [data, setData] = useState({ indices: [], top_picks: [], news: [], most_traded: [], volume_surged: [] });
  const [loading, setLoading] = useState(true);
  const [watchlist, setWatchlist] = useState([]);
  const [activeTheme, setActiveTheme] = useState(null);
  const [themeStocks, setThemeStocks] = useState([]);
  const [themeLoading, setThemeLoading] = useState(false);
  const [marketPulse, setMarketPulse] = useState({ sentiment: 68, trend: 'Bullish', fear_greed: 'Greed', signal: 'BUY' });
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [heatmapSummary, setHeatmapSummary] = useState(null);
  const [selectedHeatmapSection, setSelectedHeatmapSection] = useState('NIFTY_50');
  const [heatmapStocks, setHeatmapStocks] = useState([]);
  const [heatmapLoading, setHeatmapLoading] = useState(false);
  const { user } = useUser();
  const toast = useToast();

  const fetchThemeData = async (themeName) => {
    if (activeTheme === themeName) {
      setActiveTheme(null);
      return;
    }
    setActiveTheme(themeName);
    setThemeLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/theme/${encodeURIComponent(themeName)}`);
      setThemeStocks(res.data.stocks);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load theme data');
    } finally {
      setThemeLoading(false);
    }
  };



  const investmentThemes = [
    { name: 'High Dividend Yield', desc: 'Secure cash flow', icon: <Briefcase className="w-5 h-5" />, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { name: 'Undervalued Momentum', desc: 'Growth potential', icon: <Target className="w-5 h-5" />, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { name: 'AI & NextGen Tech', desc: 'Future leaders', icon: <Sparkles className="w-5 h-5" />, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { name: 'Green Energy Transition', desc: 'Renewables & EV', icon: <Globe className="w-5 h-5" />, color: 'text-green-400', bg: 'bg-green-500/10' },
    { name: 'PSU Monopolies', desc: 'Govt-backed', icon: <BarChart2 className="w-5 h-5" />, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  ];

  useEffect(() => {
    const fetchRealData = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/api/explore`);
        setData(response.data);
        
        const pulseRes = await axios.get(`${API_BASE_URL}/api/market/pulse`);
        setMarketPulse(pulseRes.data);

        const summaryRes = await axios.get(`${API_BASE_URL}/api/heatmap/summary`);
        setHeatmapSummary(summaryRes.data);
      } catch (e) {
        console.error('Error fetching', e);
        toast.error('Failed to load market data');
      } finally {
        setLoading(false);
      }
    };
    fetchRealData();
    
    if (user) {
       setWatchlistLoading(true);
       axios.get(`${API_BASE_URL}/api/watchlist?user_id=${user.id}`)
         .then(res => setWatchlist(res.data.watchlist))
         .catch(e => {
           console.error(e);
           toast.error('Failed to load watchlist');
         })
         .finally(() => setWatchlistLoading(false));
    }
  }, [user]);

  useEffect(() => {
    const fetchHeatmapData = async () => {
      setHeatmapLoading(true);
      try {
        const option = HEATMAP_SECTIONS.find(o => o.key === selectedHeatmapSection);
        const queryParam = option?.type === 'mode' ? `mode=${selectedHeatmapSection}` : `index=${selectedHeatmapSection}`;
        const res = await axios.get(`${API_BASE_URL}/api/heatmap?${queryParam}`);
        
        const stocks = [];
        if (res.data && res.data.children) {
          res.data.children.forEach(sector => {
            if (sector.children) {
              sector.children.forEach(st => {
                stocks.push({
                  symbol: st.symbol,
                  name: st.fullName,
                  sector: sector.name,
                  price: st.price,
                  change_pct: st.change_pct,
                  momentumScore: st.momentumScore
                });
              });
            }
          });
        }
        setHeatmapStocks(stocks);
      } catch (e) {
        console.error(e);
      } finally {
        setHeatmapLoading(false);
      }
    };
    fetchHeatmapData();
  }, [selectedHeatmapSection]);

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-10">

      <motion.section variants={fadeUp} className="relative">
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl lg:rounded-[32px] border border-white/[0.08] bg-gradient-to-br from-[#060b18] via-surface to-surface p-5 sm:p-8 md:p-10 lg:p-14 shadow-[0_50px_100px_rgba(0,0,0,0.5)]">
          {/* Ambient gradients */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[150px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-secondary/10 rounded-full blur-[100px] pointer-events-none" />
          
          <div className="relative z-10 flex flex-col lg:flex-row items-center gap-6 sm:gap-8 lg:gap-10">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-6">
                <div className="live-dot" />
                <span className="px-3 py-1 bg-primary/15 text-primary border border-primary/20 text-[10px] font-black uppercase tracking-[0.2em] rounded-full">Algo-Engine Active</span>
                <span className="text-[11px] text-zinc-600 font-mono-data">
                  {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-6xl font-black text-white leading-tight mb-4 sm:mb-6">
                Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, <span className="text-gradient">Alpha Trader</span>
              </h1>
              <p className="text-zinc-500 text-sm sm:text-base lg:text-lg max-w-xl leading-relaxed mb-5 sm:mb-8">
                Your Nexus AI engine has analyzed <span className="text-white font-bold">14,200+ data points</span>. The market is showing strong signs of <span className="text-emerald-400 font-bold uppercase tracking-wider">Sector Rotation</span> in Energy.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
                 <Link to="/portfolio" className="px-5 sm:px-8 py-3 sm:py-3.5 bg-primary text-black font-black uppercase tracking-widest rounded-xl sm:rounded-2xl hover:bg-emerald-400 transition-all hover:scale-[1.02] shadow-lg shadow-primary/20 no-underline text-center text-sm">Analyze Portfolio</Link>
                 <Link to="/screener" className="px-5 sm:px-8 py-3 sm:py-3.5 bg-white/[0.04] border border-white/[0.08] text-white font-black uppercase tracking-widest rounded-xl sm:rounded-2xl hover:bg-white/[0.08] transition-all no-underline text-center text-sm">Nexus Screener</Link>
              </div>
            </div>

            <div className="w-full lg:w-[400px] space-y-4 mt-6 lg:mt-0">
               <div className="flex items-center justify-between px-2">
                  <h3 className="text-xs font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                     <Newspaper className="w-4 h-4 text-primary" /> Intelligence Feed
                  </h3>
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
               </div>
               <div className="space-y-3">
                  {data.news && data.news.length > 0 ? data.news.map((item, idx) => (
                    <a key={idx} href={item.link} target="_blank" rel="noopener noreferrer" className="block glass-panel p-4 bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] transition-all group no-underline">
                       <div className="flex justify-between items-start mb-2">
                          <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{item.publisher}</span>
                          <span className="text-[9px] font-black px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{item.ai_sentiment}</span>
                       </div>
                       <h4 className="text-xs font-bold text-white group-hover:text-primary transition-colors line-clamp-2 leading-relaxed">{item.title}</h4>
                    </a>
                  )) : (loading ? [1,2,3].map(i => (
                    <div key={i} className="glass-panel p-4 h-20 animate-pulse" />
                  )) : (
                    <div className="text-center py-6 border border-dashed border-white/[0.05] rounded-2xl">
                       <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">No Intelligence signals today</p>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ─── MARKET SENTIMENT & PULSE ─── */}
      <motion.section variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="sm:col-span-2 lg:col-span-1 glass-panel p-5 sm:p-6 border-l-4 border-l-primary flex flex-col justify-between overflow-hidden relative group">
           <div className="relative z-10">
              <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                 <Zap className="w-3 h-3 text-primary" /> Market Sentiment
              </h3>
              <div className="flex items-end gap-3 mb-2">
                 <span className="text-4xl font-black text-white">{marketPulse.sentiment}%</span>
                 <span className="text-xs font-bold text-emerald-400 mb-1.5 uppercase tracking-widest">{marketPulse.trend}</span>
              </div>
              <div className="h-1.5 w-full bg-white/[0.04] rounded-full overflow-hidden mb-4">
                 <motion.div 
                   initial={{ width: 0 }}
                   animate={{ width: `${marketPulse.sentiment}%` }}
                   className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
                 />
              </div>
              <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest leading-relaxed">
                 Aggregate sentiment across Nifty 50 tokens is showing high institutional accumulation.
              </p>
           </div>
           {/* Abstract background shape */}
           <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
        </div>

        <div className="sm:col-span-2 lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
           {[
             { label: 'Fear & Greed', value: marketPulse.fear_greed, sub: 'Score: 74/100', icon: <Activity className="w-4 h-4" />, color: 'text-amber-400' },
             { label: 'AI Trend Signal', value: marketPulse.signal, sub: 'Strong Momentum', icon: <Target className="w-4 h-4" />, color: 'text-emerald-400' },
             { label: 'Global Market', value: 'Bullish', sub: 'NASDAQ +1.2%', icon: <Globe className="w-4 h-4" />, color: 'text-sky-400' },
           ].map((item, idx) => (
             <div key={idx} className="glass-panel p-6 border border-white/[0.04] hover:border-white/[0.1] transition-all group">
                <div className="flex items-center gap-3 mb-4">
                   <div className={`p-2 rounded-lg bg-white/[0.03] ${item.color} group-hover:scale-110 transition-transform`}>
                      {item.icon}
                   </div>
                   <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{item.label}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                   <span className="text-xl font-black text-white uppercase tracking-tight">{item.value}</span>
                   <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter">{item.sub}</span>
                </div>
             </div>
           ))}
        </div>
      </motion.section>

      {/* ─── MARKET INDICES ─── */}
      <motion.section variants={fadeUp}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Market Indices
            {loading && <RefreshCw className="w-4 h-4 animate-spin text-zinc-600" />}
          </h2>
          <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Real-Time</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {(!loading && data.indices.length > 0) ? data.indices.map((idx, i) => (
            <motion.div
              key={i}
              variants={fadeUp}
              className="glass-panel-hover p-6 cursor-pointer border border-white/[0.04] relative overflow-hidden group"
            >
              <div className="relative z-10">
                <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] mb-4">{idx.name}</p>
                <div className="flex items-end gap-3">
                  <p className="text-3xl font-black text-white font-mono-data tracking-tighter">{idx.value}</p>
                  <p className={`text-xs font-black mb-1.5 font-mono-data px-2 py-0.5 rounded-lg ${idx.positive ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' : 'text-red-400 bg-red-500/10 border border-red-500/20'}`}>
                    {idx.change} ({idx.percent})
                  </p>
                </div>
                {/* Mini bar indicator */}
                <div className="mt-5 h-1 w-full bg-white/[0.03] rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, Math.abs(parseFloat(idx.percent)) * 15 + 30)}%` }}
                    className={`h-full rounded-full transition-all duration-1000 ${idx.positive ? 'bg-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.3)]'}`}
                  />
                </div>
              </div>
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/[0.01] rounded-full blur-2xl group-hover:bg-white/[0.03] transition-colors -mr-12 -mt-12" />
            </motion.div>
          )) : (
            [1, 2, 3].map(i => (
              <div key={i} className="glass-panel p-6 h-[120px]">
                <div className="skeleton h-3 w-20 mb-4" />
                <div className="skeleton h-8 w-40 mb-3" />
                <div className="skeleton h-1 w-full mt-4" />
              </div>
            ))
          )}
        </div>
      </motion.section>

      {/* ─── YOUR WATCHLIST ─── */}
      {user && (watchlistLoading || watchlist.length > 0) && (
        <motion.section variants={fadeUp}>
           <div className="flex items-center justify-between mb-5">
             <h2 className="text-lg font-bold text-white flex items-center gap-2">
               <Star className="w-5 h-5 text-amber-400" />
               Your Watchlist
               {watchlistLoading && <RefreshCw className="w-4 h-4 animate-spin text-zinc-600" />}
             </h2>
             <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">{watchlist.length} Symbols</span>
           </div>
           <div className="flex flex-wrap gap-3">
             {watchlistLoading ? (
               [1, 2, 3].map(i => (
                 <div key={i} className="px-6 py-4 glass-panel-hover border-white/[0.06] bg-white/[0.02] flex items-center gap-4 w-48 h-16 animate-pulse" />
               ))
             ) : (
               watchlist.map((symbol, i) => (
                 <Link 
                   key={i} 
                   to={`/stock/${symbol}`}
                   className="px-6 py-4 glass-panel-hover border-white/[0.06] bg-white/[0.02] flex items-center gap-4 group no-underline"
                 >
                   <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-black text-xs">{symbol.charAt(0)}</div>
                   <div>
                      <p className="text-sm font-bold text-white group-hover:text-primary transition-colors">{symbol.replace('.NS', '')}</p>
                      <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Added Recently</p>
                   </div>
                   <ChevronRight className="w-4 h-4 text-zinc-800 transition-transform group-hover:translate-x-1" />
                 </Link>
               ))
             )}
           </div>
        </motion.section>
      )}

      {/* ─── NEXUS HEATMAP ─── */}
      <motion.section variants={fadeUp}>
        <div className="flex justify-between items-center mb-5">
           <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-400" /> Nexus Market Heatmap
           </h2>
           <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Live Constituents</span>
        </div>

        {/* Dynamic Selector Tabs */}
        <div className="flex items-center gap-2 flex-wrap mb-5">
          {HEATMAP_SECTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setSelectedHeatmapSection(opt.key)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 border ${
                selectedHeatmapSection === opt.key
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Dynamic Stock List */}
        <div className="glass-panel overflow-hidden border border-white/[0.04] bg-white/[0.01]">
          {heatmapLoading ? (
            <div className="h-48 flex items-center justify-center flex-col gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
              <span className="text-xs text-zinc-500 font-semibold">Loading constituents...</span>
            </div>
          ) : heatmapStocks.length === 0 ? (
            <div className="p-8 text-center text-zinc-600 text-sm font-semibold">
              No constituents available for this section.
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04] max-h-[350px] overflow-y-auto pr-1">
              {heatmapStocks.map((stock, i) => (
                <Link
                  key={i}
                  to={`/stock/${stock.symbol}`}
                  className="px-6 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors group no-underline"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center group-hover:scale-105 group-hover:border-primary/30 transition-all">
                      <span className="font-black text-sm text-gradient">{stock.symbol.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white group-hover:text-primary transition-colors">
                        {stock.symbol}
                      </p>
                      <p className="text-[10px] text-zinc-500 font-bold truncate max-w-[150px] sm:max-w-xs">{stock.name}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="hidden sm:block text-right">
                      <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Sector</p>
                      <p className="text-xs text-zinc-400 font-semibold">{stock.sector}</p>
                    </div>
                    <div className="text-right min-w-[70px]">
                      <p className="text-sm font-black text-white font-mono-data">₹{stock.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                      <p className={`text-[10px] font-black font-mono-data ${stock.change_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {stock.change_pct >= 0 ? '+' : ''}{stock.change_pct.toFixed(2)}%
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-800 transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </motion.section>

      {/* ─── INVESTMENT THEMES ─── */}
      <motion.section variants={fadeUp}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            Investment Themes
          </h2>
          <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">AI Curated</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
          {investmentThemes.map((theme, i) => (
            <motion.div
              key={i}
              variants={fadeUp}
              onClick={() => fetchThemeData(theme.name)}
              className={`glass-panel p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all group relative overflow-hidden
                ${activeTheme === theme.name 
                  ? 'border-primary/40 bg-primary/5 shadow-[0_0_30px_rgba(0,212,170,0.08)]' 
                  : 'hover:bg-white/[0.02] hover:-translate-y-1'
                }`}
            >
              <div className={`w-10 h-10 rounded-xl ${theme.bg} mb-3 flex items-center justify-center ${theme.color} group-hover:scale-110 transition-transform`}>
                {theme.icon}
              </div>
              <span className="font-bold text-xs text-white leading-tight mb-1">{theme.name}</span>
              <span className="text-[10px] text-zinc-600 font-medium">{theme.desc}</span>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ─── THEME EXPLORER (EXPANDED) ─── */}
      <AnimatePresence>
        {activeTheme && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Theme: <span className="text-primary">{activeTheme}</span>
              </h2>
              <button
                onClick={() => setActiveTheme(null)}
                className="text-xs font-bold text-zinc-500 hover:text-white transition-colors bg-white/[0.04] px-3 py-1.5 rounded-full border border-white/[0.06]"
              >
                CLOSE
              </button>
            </div>
            {themeLoading ? (
              <div className="flex items-center justify-center gap-3 text-zinc-500 text-sm font-semibold h-[140px] w-full border border-dashed border-white/[0.06] rounded-2xl bg-white/[0.02]">
                <RefreshCw className="w-5 h-5 animate-spin text-primary" /> Compiling {activeTheme} stocks...
              </div>
            ) : (
              <div className="flex overflow-x-auto gap-4 pb-2 hide-scrollbar">
                {themeStocks.map((stock, i) => (
                  <StockCard key={`theme-${i}`} stock={stock} />
                ))}
              </div>
            )}
          </motion.section>
        )}
      </AnimatePresence>

      {/* ─── TOP PICKS BY AI ─── */}
      <motion.section variants={fadeUp}>
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" /> Top Picks by AI Engine
          </h2>
          <button className="flex items-center gap-1 text-[10px] font-black text-primary hover:text-white transition-colors uppercase tracking-[0.2em]">
            See more <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex overflow-x-auto gap-4 pb-2 hide-scrollbar">
          {(!loading && data.top_picks.length > 0) ? data.top_picks.map((stock, i) => (
            <StockCard key={i} stock={stock} isWatchlisted={watchlist.includes(stock.symbol)} />
          )) : (
            [1, 2, 3, 4, 5].map(i => (
              <div key={i} className="min-w-[220px] h-[170px] glass-panel p-5 shrink-0">
                <div className="skeleton h-10 w-10 rounded-lg mb-4" />
                <div className="skeleton h-4 w-24 mb-2" />
                <div className="skeleton h-3 w-16 mb-4" />
                <div className="skeleton h-5 w-20" />
              </div>
            ))
          )}
        </div>
      </motion.section>

      {/* ─── MOST TRADED ─── */}
      <motion.section variants={fadeUp}>
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-sky-400" /> Most Traded on Nifty 50
          </h2>
        </div>
        <div className="flex overflow-x-auto gap-4 pb-2 hide-scrollbar">
          {(!loading && data.most_traded && data.most_traded.length > 0) ? data.most_traded.map((stock, i) => (
            <StockCard key={i} stock={stock} isWatchlisted={watchlist.includes(stock.symbol)} />
          )) : (
            [1, 2, 3, 4, 5].map(i => (
              <div key={i} className="min-w-[220px] h-[170px] glass-panel p-5 shrink-0">
                <div className="skeleton h-10 w-10 rounded-lg mb-4" />
                <div className="skeleton h-4 w-24 mb-2" />
                <div className="skeleton h-3 w-16 mb-4" />
                <div className="skeleton h-5 w-20" />
              </div>
            ))
          )}
        </div>
      </motion.section>

      {/* ─── VOLUME SURGED ─── */}
      <motion.section variants={fadeUp}>
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-amber-400" /> Volume Surge Alerts
          </h2>
        </div>
        <div className="flex overflow-x-auto gap-4 pb-2 hide-scrollbar">
          {(!loading && data.volume_surged && data.volume_surged.length > 0) ? data.volume_surged.map((stock, i) => (
            <StockCard key={i} stock={stock} isVolumeSurged isWatchlisted={watchlist.includes(stock.symbol)} />
          )) : (
            [1, 2, 3, 4, 5].map(i => (
              <div key={i} className="min-w-[220px] h-[170px] glass-panel p-5 shrink-0">
                <div className="skeleton h-10 w-10 rounded-lg mb-4" />
                <div className="skeleton h-4 w-24 mb-2" />
                <div className="skeleton h-3 w-16 mb-4" />
                <div className="skeleton h-5 w-20" />
              </div>
            ))
          )}
        </div>
      </motion.section>
    </motion.div>
  );
}

function StockCard({ stock, isVolumeSurged, isWatchlisted }) {
  return (
    <Link
      to={`/stock/${stock.symbol}`}
      className="min-w-[220px] glass-panel-hover p-6 group block shrink-0 relative overflow-hidden border border-white/[0.04] bg-white/[0.01]"
    >
      {isVolumeSurged && (
        <div className="absolute top-0 right-0 px-2.5 py-1 bg-amber-500/15 text-amber-400 text-[10px] font-black tracking-wider uppercase rounded-bl-xl border-b border-l border-amber-500/20 flex items-center gap-1.5 z-10">
          <Zap className="w-3 h-3" /> {stock.surge} Vol
        </div>
      )}

      {isWatchlisted && (
        <div className="absolute top-0 left-0 p-3 z-10">
          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.3)]" />
        </div>
      )}
      
      <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-5 group-hover:scale-110 group-hover:border-primary/30 transition-all duration-500">
        <span className="font-black text-2xl text-gradient">{stock.symbol.charAt(0)}</span>
      </div>
      
      <p className="font-black text-white text-base group-hover:text-primary transition-colors mb-0.5">
        {stock.symbol.replace('.NS', '')}
      </p>
      <p className="text-zinc-600 text-[10px] uppercase font-black tracking-[0.1em] mb-4 truncate pr-4 opacity-70 group-hover:opacity-100 transition-opacity">{stock.name}</p>
      
      <div className="flex justify-between items-end">
        <p className="font-black text-lg font-mono-data text-white/90">{stock.price}</p>
        <p className={`text-[11px] font-black flex items-center gap-1 font-mono-data px-2 py-1 rounded-lg ${stock.positive ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'}`}>
          {stock.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {stock.change}
        </p>
      </div>

      <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-white/[0.01] rounded-full blur-xl group-hover:bg-primary/5 transition-colors" />
    </Link>
  );
}
