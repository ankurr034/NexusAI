import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Shield, Cpu, RefreshCw, CheckCircle2, ChevronRight, Newspaper, LayoutList, PieChart as PieChartIcon, BarChart3, Zap, Bot, ArrowUpRight, ArrowDownRight, Lock, ShieldCheck, User as UserIcon, ShieldAlert, Star } from 'lucide-react';
import { useToast } from '../components/Toast';
import axios from 'axios';
import CDSLModal from '../components/CDSLModal';
import { useUser } from '../context/UserContext';
import { API_BASE_URL } from '../config';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, ComposedChart, Legend, BarChart, Bar, PieChart, Pie, Cell, Brush
} from 'recharts';
import { AdvancedRealTimeChart } from "react-ts-tradingview-widgets";
import useSocket from '../hooks/useSocket';
import { formatTradingViewSymbol } from '../utils/symbolFormatter';

const TVWidgetWrapper = React.memo(({ tvSymbol }) => {
  const chartOptions = React.useMemo(() => ({
    theme: "dark",
    autosize: true,
    allow_symbol_change: false,
    hide_side_toolbar: false,
    enable_publishing: false,
    hide_top_toolbar: false,
    save_image: false,
    toolbar_bg: "#0f172a",
    studies: [
      "Volume@tv-basicstudies",
      "MASimple@tv-basicstudies"
    ]
  }), []);

  useEffect(() => {
    console.log("TradingView Mounted:", tvSymbol);
    return () => console.log("TradingView Unmounted:", tvSymbol);
  }, [tvSymbol]);

  // Using a stable key strictly bound to tvSymbol prevents TradingView from 
  // keeping stale iframes across navigations, while React.memo prevents
  // parent rerenders (from live price ticks) from touching this component.
  return (
    <AdvancedRealTimeChart
      key={tvSymbol}
      symbol={tvSymbol}
      {...chartOptions}
    />
  );
}, (prevProps, nextProps) => prevProps.tvSymbol === nextProps.tvSymbol);

export default function StockDetail() {
  const toast = useToast();
  const { tickerId } = useParams();
  const { user, isLiveMode, brokerConnected } = useUser();
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [inWatchlist, setInWatchlist] = useState(false);

  const [orderType, setOrderType] = useState('BUY');
  const [deliveryType, setDeliveryType] = useState('Delivery');
  const [orderMode, setOrderMode] = useState('Market');
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(0);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [balance, setBalance] = useState(0);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [timeRange, setTimeRange] = useState('1Y');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [chartType, setChartType] = useState('Line');
  const [cdslOpen, setCdslOpen] = useState(false);
  const [exchange, setExchange] = useState('BSE'); // Default to BSE for better TradingView widget resolution

  // Formatted symbol using useMemo
  const tvSymbol = React.useMemo(() => formatTradingViewSymbol(tickerId, exchange), [tickerId, exchange]);

  // Real-time Socket Connection
  const { socket, isConnected, data: socketData } = useSocket('price_update');

  useEffect(() => {
    if (socket && isConnected && tickerId) {
      console.log(`[WebSocket] Subscribing to stock: ${tickerId}`);
      socket.emit('subscribe_stock', tickerId);

      return () => {
        console.log(`[WebSocket] Unsubscribing from stock: ${tickerId}`);
        socket.emit('unsubscribe_stock', tickerId);
        socket.off('price_update');
      };
    }
  }, [socket, isConnected, tickerId]);

  useEffect(() => {
    if (socketData && Array.isArray(socketData)) {
      const match = socketData.find(d => d.symbol === tickerId.replace('.NS', '').replace('.BO', ''));
      if (match) {
        setPrice(parseFloat(match.value.replace(/,/g, '')));
        console.log("Price Update Received");
      }
    }
  }, [socketData, tickerId]);

  console.log("Parent Rerender: StockDetail");

  const fetchBalance = useCallback(async () => {
    if (!user) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/api/wallet?user_id=${user.id}`);
      setBalance(res.data.balance);
    } catch (err) {
      console.error('Failed to fetch balance', err);
    }
  }, [user]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance, isLiveMode]);

  useEffect(() => {
    const abortController = new AbortController();
    
    const fetchData = async () => {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        console.log(`[API] Fetching data for: ${tickerId}`);
        const response = await axios.get(`${API_BASE_URL}/api/stock/${tickerId}?range_type=${timeRange}`, {
          signal: abortController.signal
        });
        setData(response.data);
        if (response.data.current_price) setPrice(response.data.current_price);
        
        // Also check CDSL status
        const cdslRes = await axios.get(`${API_BASE_URL}/api/cdsl/status/${tickerId}?user_id=${user.id}`, {
          signal: abortController.signal
        });
        setIsAuthorized(cdslRes.data.authorized);
      } catch (err) {
        if (axios.isCancel(err)) {
           console.log(`[API] Request cancelled for ${tickerId}`);
           return;
        }
        setError(err.response?.data?.detail || 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };
    if (tickerId && user) {
      fetchData();
      
      // Fetch watchlist status
      axios.get(`${API_BASE_URL}/api/watchlist?user_id=${user.id}`, { signal: abortController.signal })
        .then(res => setInWatchlist(res.data.watchlist.includes(tickerId)))
        .catch(e => {
            if (!axios.isCancel(e)) console.error(e);
        });
    }

    return () => {
      console.log(`[API] Cleaning up async fetch for ${tickerId}`);
      abortController.abort();
    };
  }, [tickerId, timeRange, user, isLiveMode]);

  const toggleWatchlist = async () => {
    if (!user) return;
    try {
      const res = await axios.post(`${API_BASE_URL}/api/watchlist/toggle?user_id=${user.id}&symbol=${tickerId}`);
      if (res.data.status === 'success') {
        setInWatchlist(res.data.action === 'added');
        toast.success(res.data.action === 'added' ? 'Added to watchlist' : 'Removed from watchlist');
      }
    } catch (err) {
      toast.error('Failed to update watchlist');
    }
  };


  const handleOrder = async (e) => {
    if (e) e.preventDefault();
    
    const currentPriceVal = data?.current_price || 0;
    const tradePrice = orderMode === 'Market' ? currentPriceVal : price;
    const totalCost = tradePrice * qty;
    
    if (orderType === 'BUY' && totalCost > balance) {
      toast.error('Insufficient balance for this order');
      return;
    }
    
    if (orderType === 'SELL' && !isAuthorized && deliveryType === 'Delivery') {
      setCdslOpen(true);
      return;
    }
    
    await executeOrder();
  };

  const executeOrder = async () => {
    if (!user) return;
    const currentPriceVal = data?.current_price || 0;
    const tradePrice = orderMode === 'Market' ? currentPriceVal : price;

    try {
      const res = await axios.post(`${API_BASE_URL}/api/broker/order?user_id=${user.id}`, {
        ticker: tickerId,
        quantity: qty,
        price: tradePrice,
        order_type: orderMode,
        transaction_type: orderType,
        product_type: deliveryType === 'Delivery' ? 'CNC' : 'MIS',
        exchange: exchange
      });
      
      toast.success(res.data.message);
      setOrderSuccess(true);
      setTimeout(() => setOrderSuccess(false), 3000);
      
      // Refresh balance
      fetchBalance();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Order execution failed.');
    }
  };

  const currentPrice = data?.current_price || 0;
  const previousPrice = data?.history?.[data.history.length - 2]?.close || currentPrice;
  const dayChange = currentPrice - previousPrice;
  const dayChangePercent = previousPrice > 0 ? (dayChange / previousPrice) * 100 : 0;
  const isPositive = dayChange >= 0;

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-panel p-3 border border-white/[0.08] shadow-2xl z-50">
          <p className="text-zinc-500 text-[10px] mb-1.5 font-bold uppercase tracking-widest">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 text-xs font-medium py-0.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || '#fff' }} />
              <span className="text-zinc-400">{entry.name}:</span>
              <span className="text-white font-bold font-mono-data">
                {typeof entry.value === 'number' ? entry.value.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : entry.value}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const filteredData = React.useMemo(() => {
    if (!data?.history) return [];
    let d = [...data.history];
    
    // Apply date range filter
    if (dateRange.start) d = d.filter(item => item.date >= dateRange.start);
    if (dateRange.end) d = d.filter(item => item.date <= dateRange.end);

    // Apply time range presets
    if (!dateRange.start && !dateRange.end) {
       if (timeRange === '1M') d = d.slice(-30);
       else if (timeRange === '3M') d = d.slice(-90);
       else if (timeRange === '6M') d = d.slice(-180);
    }
    
    return d;
  }, [data?.history, timeRange, dateRange]);

  const CandleStick = (props) => {
    const { x, y, width, height, low, high, open, close } = props;
    if (!open || !close || !low || !high || high === low) return null;
    const isBullish = close >= open;
    const color = isBullish ? '#00d4aa' : '#ef4444';

    return (
      <g>
        <line x1={x + width / 2} y1={y} x2={x + width / 2} y2={y + height} stroke={color} strokeWidth={1.5} />
        <rect 
          x={x} 
          y={isBullish ? y + (height * (high - close) / (high - low)) : y + (height * (high - open) / (high - low))} 
          width={width} 
          height={Math.max(1, height * Math.abs(open - close) / (high - low))} 
          fill={color} 
        />
      </g>
    );
  };

  // Generate Prediction Data Array for Chart
  const predictionData = React.useMemo(() => {
    if (!filteredData || filteredData.length === 0 || !data?.prediction) return [];
    
    // Take the last 20 days of history
    const recentHistory = filteredData.slice(-20).map(d => ({
      date: d.date,
      price: d.close,
      isPrediction: false
    }));
    
    const lastPoint = recentHistory[recentHistory.length - 1];
    
    // Create 5 future prediction points
    const futurePoints = [];
    let currentPredPrice = lastPoint.price;
    const targetPredPrice = data.prediction;
    const step = (targetPredPrice - currentPredPrice) / 5;
    
    for (let i = 1; i <= 5; i++) {
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + i);
      futurePoints.push({
        date: nextDate.toISOString().split('T')[0],
        prediction: currentPredPrice + (step * i),
        isPrediction: true
      });
    }
    
    // Link the last actual point to the prediction line so it connects seamlessly
    return [
      ...recentHistory,
      { date: lastPoint.date, prediction: lastPoint.price, isPrediction: true },
      ...futurePoints
    ];
  }, [filteredData, data?.prediction]);

  const handleDateChange = (type, val) => {
    setDateRange(prev => ({ ...prev, [type]: val }));
    setTimeRange('Custom');
  };

  if (!user && !loading) {
     return <div className="flex flex-col items-center justify-center py-20 text-center">
        <UserIcon className="w-16 h-16 text-zinc-700 mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Login Required</h2>
        <p className="text-zinc-500 mb-6">Please log in to view detailed stock insights and place orders.</p>
        <Link to="/login" className="px-6 py-3 bg-primary text-black font-bold rounded-xl">Go to Login</Link>
     </div>
  }

  return (
    <div className="space-y-6 pb-20">
      {error && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-red-500/10 border border-red-500/15 text-red-400 rounded-xl flex items-center gap-3 text-sm font-medium">
          <Shield className="w-5 h-5 shrink-0" /> {error}
        </motion.div>
      )}

      {loading ? (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="skeleton w-12 h-12 rounded-xl" />
            <div>
              <div className="skeleton h-8 w-40 mb-2" />
              <div className="skeleton h-4 w-24" />
            </div>
          </div>
          <div className="skeleton h-10 w-60" />
          <div className="skeleton h-[400px] rounded-2xl" />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[1,2,3,4,5].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}
          </div>
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative">

          {/* LEFT PANEL */}
          <div className="lg:col-span-2 space-y-8">
            {/* Header */}
            <div>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                    <span className="font-extrabold text-2xl text-gradient">{data.ticker.charAt(0)}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h1 className="text-3xl font-extrabold text-white leading-tight">{data.ticker.replace('.NS', '')}</h1>
                      <button 
                        onClick={toggleWatchlist}
                        className={`p-2 rounded-xl border transition-all ${inWatchlist ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-white/[0.04] border-white/[0.06] text-zinc-600 hover:text-white'}`}
                      >
                        <Star className={`w-5 h-5 ${inWatchlist ? 'fill-amber-400' : ''}`} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] font-bold px-2 py-0.5 bg-white/[0.04] rounded text-zinc-500 uppercase tracking-widest">{data.sector || 'Equities'}</span>
                       <div className="flex bg-white/[0.03] p-1 rounded-lg border border-white/[0.06]">
                          <button onClick={() => setChartType('Line')} className={`px-2 py-1 text-[9px] font-black uppercase rounded-md transition-all ${chartType === 'Line' ? 'bg-primary text-black' : 'text-zinc-500'}`}>Line</button>
                          <button onClick={() => setChartType('Candle')} className={`px-2 py-1 text-[9px] font-black uppercase rounded-md transition-all ${chartType === 'Candle' ? 'bg-primary text-black' : 'text-zinc-500'}`}>Candle</button>
                       </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-white/[0.03] p-1.5 rounded-xl border border-white/[0.06] overflow-x-auto no-scrollbar max-w-full">
                  {['1D', '1W', '1M', '3M', '1Y', '5Y', 'ALL'].map(range => (
                    <button
                      key={range}
                      onClick={() => { setTimeRange(range); setDateRange({ start: '', end: '' }); }}
                      className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all shrink-0 ${timeRange === range ? 'bg-white/10 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      {range}
                    </button>
                  ))}
                  <div className="w-px h-4 bg-white/10 mx-1" />
                  <div className="flex items-center gap-2 pl-1">
                    <input type="date" value={dateRange.start} onChange={(e) => handleDateChange('start', e.target.value)} className="bg-transparent border-none text-[10px] text-zinc-400 focus:outline-none w-24" />
                    <span className="text-zinc-700 font-bold">→</span>
                    <input type="date" value={dateRange.end} onChange={(e) => handleDateChange('end', e.target.value)} className="bg-transparent border-none text-[10px] text-zinc-400 focus:outline-none w-24" />
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-end gap-4">
                <h2 className="text-4xl font-extrabold font-mono-data">₹{currentPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</h2>
                <p className={`text-lg font-bold flex items-center pb-1 font-mono-data ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isPositive ? <ArrowUpRight className="w-5 h-5 mr-0.5" /> : <ArrowDownRight className="w-5 h-5 mr-0.5" />}
                  {isPositive ? '+' : ''}{dayChange.toFixed(2)} ({isPositive ? '+' : ''}{dayChangePercent.toFixed(2)}%)
                </p>
                <span className="text-xs text-zinc-600 pb-1.5 font-bold">Market {isLiveMode ? 'Real-Time' : 'Simulated'}</span>
              </div>

              {/* AI Badges */}
              {data.ai_insights && (
                <div className="flex gap-2.5 mt-4 flex-wrap">
                  <div className="px-3 py-1.5 rounded-full border border-primary/15 bg-primary/10 text-primary text-[11px] font-bold flex items-center gap-1.5">
                    <Bot className="w-3.5 h-3.5" /> NLP Sentiment: {data.ai_insights.overall_sentiment}
                  </div>
                  <div className="px-3 py-1.5 rounded-full border border-amber-500/15 bg-amber-500/10 text-amber-400 text-[11px] font-bold flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" /> {data.ai_insights.detected_pattern}
                  </div>
                </div>
              )}
            </div>

            {/* Main Chart - TradingView Advanced */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-[500px] w-full relative group rounded-xl overflow-hidden border border-white/[0.04]">
              <TVWidgetWrapper tvSymbol={tvSymbol} />
            </motion.div>

            {/* AI LSTM Card with Prediction Line Chart */}
            <div className="glass-panel p-6 border-l-4 border-l-primary flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="flex-1 w-full">
                <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-primary" /> Neural Engine Analysis
                </h3>
                <p className="text-zinc-600 text-xs mb-4">Predictive optimization using user-specific historical alpha tracking</p>
                <div className="flex items-end gap-4 mb-6">
                  <div>
                    <p className="text-zinc-600 text-[10px] mb-0.5 uppercase font-bold tracking-widest">Est. Close Prediction</p>
                    <p className="text-2xl font-extrabold text-white font-mono-data">₹{(typeof data.prediction === 'number') ? data.prediction.toFixed(2) : 'Analyzing...'}</p>
                  </div>
                  {data.prediction && (
                    <div className={`flex items-center gap-1.5 font-bold text-sm mb-1 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] ${data.prediction > currentPrice ? 'text-emerald-400' : 'text-red-400'}`}>
                      {data.prediction > currentPrice ? '▲ BUY SIGNAL' : '▼ SELL SIGNAL'}
                    </div>
                  )}
                </div>

                {/* AI Prediction Recharts Graph */}
                <div className="w-full h-40 bg-[#060b18]/50 rounded-xl border border-white/[0.04] p-3">
                   <ResponsiveContainer width="100%" height="100%">
                     <ComposedChart data={predictionData}>
                       <defs>
                         <linearGradient id="colorPred" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="5%" stopColor={data.prediction > currentPrice ? "#10b981" : "#ef4444"} stopOpacity={0.3}/>
                           <stop offset="95%" stopColor={data.prediction > currentPrice ? "#10b981" : "#ef4444"} stopOpacity={0}/>
                         </linearGradient>
                       </defs>
                       <XAxis dataKey="date" hide />
                       <YAxis domain={['auto', 'auto']} hide />
                       <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }} />
                       <Line type="monotone" dataKey="price" stroke="#00d4aa" strokeWidth={2} dot={false} name="Actual Price" />
                       <Line type="monotone" dataKey="prediction" stroke={data.prediction > currentPrice ? "#10b981" : "#ef4444"} strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} name="AI Prediction" />
                       <Area type="monotone" dataKey="prediction" fill="url(#colorPred)" stroke="none" />
                     </ComposedChart>
                   </ResponsiveContainer>
                </div>
              </div>

              {data.ai_insights && (
                <div className="w-full md:w-44 bg-white/[0.03] rounded-xl p-4 border border-white/[0.04] text-center shrink-0">
                  <p className="text-zinc-600 text-[10px] font-bold mb-2 uppercase tracking-widest">Momentum Index</p>
                  <div className="relative w-full h-1.5 bg-surface rounded-full overflow-hidden mb-2">
                    <div
                      className="absolute top-0 left-0 h-full bg-gradient-to-r from-red-500 via-amber-500 to-emerald-500 rounded-full transition-all duration-1000"
                      style={{ width: `${data.ai_insights.momentum_score}%` }}
                    />
                  </div>
                  <p className="text-xl font-extrabold text-white font-mono-data">{data.ai_insights.momentum_score}<span className="text-xs font-medium text-zinc-600">/100</span></p>
                </div>
              )}
            </div>

            {/* Fundamentals */}
            <div className="pt-4 border-t border-white/[0.04]">
              <h3 className="text-lg font-bold text-white mb-5">Fundamentals</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  { label: 'Market Cap', value: (data.fundamentals?.market_cap && data.fundamentals.market_cap !== 'N/A') ? `₹${(data.fundamentals.market_cap / 10000000).toFixed(2)}Cr` : 'N/A' },
                  { label: 'P/E Ratio', value: (typeof data.fundamentals?.pe_ratio === 'number') ? data.fundamentals.pe_ratio.toFixed(2) : 'N/A' },
                  { label: 'P/B Ratio', value: (typeof data.fundamentals?.pb_ratio === 'number') ? data.fundamentals.pb_ratio.toFixed(2) : 'N/A' },
                  { label: 'ROE', value: (typeof data.fundamentals?.roe === 'number') ? `${(data.fundamentals.roe * 100).toFixed(2)}%` : 'N/A' },
                  { label: 'EPS (TTM)', value: (typeof data.fundamentals?.eps === 'number') ? `₹${data.fundamentals.eps.toFixed(2)}` : 'N/A' },
                  { label: 'Div Yield', value: (typeof data.fundamentals?.div_yield === 'number') ? `${(data.fundamentals.div_yield * 100).toFixed(2)}%` : '0.00%' },
                  { label: 'Debt/Equity', value: (typeof data.fundamentals?.debt_to_equity === 'number') ? `${(data.fundamentals.debt_to_equity / 100).toFixed(2)}` : '0.00' },
                  { label: '52W High', value: (typeof data.fundamentals?.high_52 === 'number') ? `₹${data.fundamentals.high_52.toFixed(2)}` : 'N/A', color: 'text-emerald-400' },
                  { label: '52W Low', value: (typeof data.fundamentals?.low_52 === 'number') ? `₹${data.fundamentals.low_52.toFixed(2)}` : 'N/A', color: 'text-red-400' },
                ].map((item, idx) => (
                  <div key={idx} className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-3">
                    <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest mb-1">{item.label}</p>
                    <p className={`font-bold text-sm font-mono-data ${item.color || 'text-white'}`}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Intelligence News Feed (Groww Style) */}
            <div className="pt-8 border-t border-white/[0.04]">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <Newspaper className="w-5 h-5 text-primary" /> Intelligence Feed
                </h3>
                <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Live AI Insights
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.news && data.news.length > 0 ? data.news.map((item, i) => (
                  <motion.a 
                    key={i} 
                    href={item.link} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    whileHover={{ y: -4, backgroundColor: 'rgba(255,255,255,0.04)' }}
                    className="block p-6 rounded-[24px] border border-white/[0.06] bg-white/[0.02] hover:border-primary/30 transition-all group relative overflow-hidden no-underline"
                  >
                    <div className="flex justify-between items-start mb-3">
                       <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.1em]">{item.publisher}</span>
                       <span 
                         className="text-[9px] font-black px-2 py-1 rounded-lg border uppercase tracking-widest"
                         style={{ backgroundColor: `${item.ai_sentiment_color}15`, color: item.ai_sentiment_color, borderColor: `${item.ai_sentiment_color}30` }}
                       >
                         {item.ai_sentiment}
                       </span>
                    </div>
                    <h4 className="font-bold text-white text-[15px] group-hover:text-primary transition-colors leading-snug mb-4 line-clamp-3">
                      {item.title}
                    </h4>
                    <div className="flex items-center justify-between mt-auto">
                       <span className="text-[10px] text-zinc-600 font-mono-data uppercase tracking-tighter">AI AGGREGATED • {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                       <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </div>
                  </motion.a>
                )) : (
                  <div className="col-span-full py-10 text-center border-2 border-dashed border-white/[0.04] rounded-3xl">
                     <p className="text-zinc-600 text-sm font-bold uppercase tracking-widest">No intelligence signals found for this script today</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT PANEL - Order Form */}
          <div className="lg:col-span-1 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel overflow-hidden sticky top-24 border border-white/[0.08] shadow-2xl z-20"
            >
              {/* Buy/Sell Tabs */}
              <div className="flex border-b border-white/[0.06]">
                <button
                  onClick={() => setOrderType('BUY')}
                  className={`flex-1 py-4 font-extrabold text-xs tracking-widest transition-all ${orderType === 'BUY' ? 'bg-emerald-500/10 text-emerald-400 border-b-2 border-emerald-400' : 'text-zinc-600 hover:text-white hover:bg-white/[0.02]'}`}
                >
                  BUY
                </button>
                <button
                  onClick={() => setOrderType('SELL')}
                  className={`flex-1 py-4 font-extrabold text-xs tracking-widest transition-all ${orderType === 'SELL' ? 'bg-red-500/10 text-red-400 border-b-2 border-red-400' : 'text-zinc-600 hover:text-white hover:bg-white/[0.02]'}`}
                >
                  SELL
                </button>
              </div>

              <div className="p-6 space-y-6">
                 {/* Environment Header */}
                 <div className={`p-2.5 rounded-xl border flex items-center gap-2 ${isLiveMode ? 'bg-rose-500/10 border-rose-500/15' : 'bg-emerald-500/10 border-emerald-500/15'}`}>
                   <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isLiveMode ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                   <span className={`text-[10px] font-black tracking-widest uppercase ${isLiveMode ? 'text-rose-400' : 'text-emerald-400'}`}>
                      Executing in {isLiveMode ? 'Live Market' : 'Demo Environment'}
                   </span>
                 </div>

                <AnimatePresence>
                  {orderSuccess && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="p-3 bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 rounded-xl flex justify-center items-center gap-2 text-xs font-bold overflow-hidden"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Order Executed — View in Book
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Delivery Toggle */}
                <div className="flex items-center justify-between text-xs font-bold text-zinc-500 pb-3 border-b border-white/[0.04]">
                  <div className="flex gap-5">
                    {['Delivery', 'Intraday'].map(type => (
                      <button key={type} onClick={() => setDeliveryType(type)} className={`transition-colors flex flex-col items-center gap-1 ${deliveryType === type ? 'text-white' : 'hover:text-zinc-300'}`}>
                        {type}
                        {deliveryType === type && <div className="w-6 h-0.5 bg-primary rounded-full" />}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-4 items-center">
                    <div className="flex bg-white/[0.03] p-1 rounded-lg border border-white/[0.06]">
                      {['NSE', 'BSE'].map(ex => (
                        <button 
                          key={ex} 
                          onClick={() => setExchange(ex)}
                          className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-md transition-all ${exchange === ex ? 'bg-primary text-black' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                          {ex}
                        </button>
                      ))}
                    </div>
                    <span className="text-zinc-600 px-2 py-1 bg-white/[0.03] rounded border border-white/[0.04] text-[10px] tracking-widest">{deliveryType === 'Delivery' ? 'CNC' : 'MIS'}</span>
                  </div>
                </div>

                {/* ISIN & Settlement Info */}
                {data.isin && (
                  <div className="flex items-center justify-between text-[10px] font-mono-data text-zinc-600 pb-3 border-b border-white/[0.04]">
                    <span>ISIN: <span className="text-zinc-400">{data.isin}</span></span>
                    <span className="text-zinc-500">T+1 Settle</span>
                  </div>
                )}

                {/* CDSL Auth Warning for Sell */}
                {orderType === 'SELL' && !isAuthorized && deliveryType === 'Delivery' && (
                  <div className="flex items-center gap-2 p-2.5 bg-amber-500/5 border border-amber-500/15 rounded-xl">
                    <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="text-[10px] text-amber-400 font-bold">CDSL authorization required for delivery sale</span>
                  </div>
                )}

                {/* Qty + Price */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-zinc-500">Quantity</span>
                    <input
                      type="number" value={qty}
                      onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="bg-white/[0.03] border border-white/[0.06] rounded-xl py-2 px-4 text-right w-28 text-white font-bold focus:outline-none focus:border-primary/30 transition-all font-mono-data"
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-zinc-500">Order Price</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setOrderMode(orderMode === 'Market' ? 'Limit' : 'Market')} className="text-[10px] text-primary font-bold px-2 py-1.5 bg-primary/10 hover:bg-primary/15 transition-colors rounded-lg border border-primary/15 tracking-wider">
                        {orderMode}
                      </button>
                      <input
                        type="number"
                        value={orderMode === 'Market' ? currentPrice.toFixed(2) : price}
                        onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                        disabled={orderMode === 'Market'}
                        className="bg-white/[0.03] border border-white/[0.06] rounded-xl py-3 px-4 text-right w-28 text-white font-bold focus:outline-none focus:border-primary/30 transition-all disabled:opacity-40 font-mono-data"
                      />
                    </div>
                  </div>
                </div>

                {/* Balance Info */}
                <div className="flex justify-between items-center text-xs font-medium border-t border-white/[0.04] pt-4">
                  <span className="text-zinc-600">Available: <span className="text-zinc-400 font-mono-data">₹{balance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span></span>
                  <span className="text-zinc-600">Total: <span className="text-zinc-400 font-bold font-mono-data">₹{((orderMode === 'Market' ? currentPrice : price) * qty).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span></span>
                </div>

                {/* Broker Info */}
                {isLiveMode && (
                  <div className={`flex items-center gap-2 p-2.5 rounded-xl border ${brokerConnected ? 'bg-emerald-500/5 border-emerald-500/15 text-emerald-400' : 'bg-rose-500/5 border-rose-500/15 text-rose-400'}`}>
                    {brokerConnected ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" size={14} />}
                    <span className="text-[10px] font-bold tracking-tight uppercase">
                      {brokerConnected ? 'Active Broker Connection' : 'No Broker Linked — Orders will Fail'}
                    </span>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  onClick={handleOrder}
                  disabled={isLiveMode && !brokerConnected}
                  className={`w-full py-4 rounded-xl font-extrabold text-base transition-all active:scale-[0.98] shadow-lg tracking-wider disabled:opacity-50 disabled:grayscale
                    ${orderType === 'BUY'
                      ? 'bg-gradient-to-r from-emerald-500 to-primary text-black hover:shadow-primary/20'
                      : 'bg-gradient-to-r from-red-500 to-rose-400 text-white hover:shadow-red-500/20'
                    }`}
                >
                  {orderType} {tickerId.replace('.NS', '')}
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      ) : null}

      {data && (
        <CDSLModal 
          isOpen={cdslOpen} 
          onClose={() => setCdslOpen(false)} 
          onAuthorized={() => {
            setIsAuthorized(true);
            executeOrder();
          }}
          stockSymbol={tickerId?.replace('.NS', '')}
          quantity={qty}
        />
      )}
    </div>
  );
}
