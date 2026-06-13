import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, AlertTriangle, Activity, Zap, RefreshCw, Send, Sparkles, TrendingUp, TrendingDown, Target, Info, ShieldAlert } from 'lucide-react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import axios from 'axios';
import { useUser } from '../context/UserContext';
import { API_BASE_URL } from '../config';

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError(error) { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center glass-panel border-rose-500/20">
          <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto mb-4" />
          <h3 className="text-white font-bold mb-2">Coach Panel Rendering Failed</h3>
          <p className="text-zinc-500 text-sm">Failed to map AI insights to the dashboard. Please try refreshing.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

const PRESETS = [
  { text: "Assess my portfolio downside", icon: <TrendingDown size={14} /> },
  { text: "Analyze my trading behavioral biases", icon: <Activity size={14} /> },
  { text: "Provide a worst-case market stress test", icon: <AlertTriangle size={14} /> },
  { text: "Suggest a portfolio hedge", icon: <Shield size={14} /> },
];

export default function RiskCoach() {
  const { user } = useUser();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const chatEndRef = useRef(null);

  const fetchRiskReport = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE_URL}/api/portfolio/risk-coach?user_id=${user?.id || 'nexus-sim-user'}`);
      if (res.data?.success) {
        setData(res.data.risk_coach);
      }
    } catch (e) {
      console.error('Failed to fetch AI risk coach report:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRiskReport();
  }, [user]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const sendChatMessage = async (text) => {
    if (!text.trim()) return;
    const userMsg = { role: 'user', content: text };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setSendingMsg(true);

    try {
      // Build simple text history to send
      const history = chatMessages.slice(-6); // last 6 messages
      const res = await axios.post(`${API_BASE_URL}/api/portfolio/risk-coach/chat?user_id=${user?.id || 'nexus-sim-user'}`, {
        message: text,
        chatHistory: history
      });
      
      const coachResponse = res.data;
      const coachMsg = {
        role: 'assistant',
        title: coachResponse.title,
        body: coachResponse.body,
        verdict: coachResponse.verdict,
        confidence: coachResponse.confidence
      };
      setChatMessages(prev => [...prev, coachMsg]);
    } catch (err) {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        title: '⚠️ Advisory Error',
        body: 'Failed to complete risk consult. Please rephrase or try again.',
        verdict: 'ERROR',
        confidence: 0
      }]);
    } finally {
      setSendingMsg(false);
    }
  };

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'HIGH':
      case 'EXTREME':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      case 'MODERATE':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      default:
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
        <p className="text-zinc-500 text-sm font-semibold">Consulting Risk Coach & Auditing Portfolio...</p>
      </div>
    );
  }

  const riskData = data || {};
  const healthScore = riskData.health_score || 0;
  const healthColor = healthScore > 75 ? '#10b981' : healthScore > 50 ? '#f59e0b' : '#ef4444';

  const chartData = [
    { name: 'Over-trading', score: riskData.behavioral_biases?.over_trading || 0 },
    { name: 'FOMO Bias', score: riskData.behavioral_biases?.fomo || 0 },
    { name: 'Disposition', score: riskData.behavioral_biases?.disposition_effect || 0 },
    { name: 'Discipline', score: riskData.behavioral_biases?.discipline_score || 0 }
  ];

  return (
    <ErrorBoundary>
      <div className="space-y-8 pb-20">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-white flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-500/20 flex items-center justify-center">
                <Shield className="w-6 h-6 text-violet-400" />
              </div>
              AI Risk Coach
            </h1>
            <p className="text-zinc-500 mt-2 text-sm">Bloomberg-grade portfolio intelligence and behavioral diagnostics.</p>
          </div>
          <button onClick={fetchRiskReport} className="flex items-center gap-2 px-4 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-xs font-bold text-zinc-400 hover:text-white transition-all">
            <RefreshCw size={14} /> Re-Audit
          </button>
        </div>

        {/* Dashboard Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Health Score & Diagnostics */}
          <div className="glass-panel p-8 flex flex-col items-center justify-center text-center space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[200px] h-[200px] rounded-full blur-[80px] pointer-events-none" style={{ background: `${healthColor}08` }} />
            
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-violet-400" /> Portfolio Health
            </h3>

            {/* Health Ring */}
            <div className="relative shrink-0">
              <svg className="w-40 h-40 -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="8" />
                <circle cx="60" cy="60" r="54" fill="none" stroke={healthColor} strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${healthScore * 3.39} 339`} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-black text-white">{healthScore}</span>
                <span className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: healthColor }}>Score</span>
              </div>
            </div>

            {/* Downside details */}
            <div className="grid grid-cols-3 gap-4 w-full pt-4 border-t border-white/[0.06] text-center">
              <div>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Beta</p>
                <p className="text-lg font-black font-mono-data text-white">{riskData.beta || '1.0'}</p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Volatility</p>
                <p className="text-lg font-black font-mono-data text-white">{riskData.volatility_score || '0'}%</p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">VaR (95%)</p>
                <p className="text-sm font-black font-mono-data text-rose-400">₹{(riskData.var_95 || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Behavioral Radar Map */}
          <div className="glass-panel p-6 flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-400" /> Behavioral Analytics
              </h3>
              <p className="text-xs text-zinc-500">Measures tendencies of over-trading, FOMO buying, and disposition metrics.</p>
            </div>
            
            <div className="h-[200px] w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={chartData}>
                  <PolarGrid stroke="rgba(255,255,255,0.05)" />
                  <PolarAngleAxis dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 10 }} />
                  <Radar name="Score" dataKey="score" stroke="#10b981" fill="#10b981" fillOpacity={0.2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* AI Risk Summary Card */}
          <div className="glass-panel p-6 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-[150px] h-[150px] bg-gradient-to-br from-violet-500/10 to-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
            <div>
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-400" /> Structural Assessment
              </h3>
              <p className="text-sm text-zinc-300 leading-relaxed font-medium">
                {riskData.ai_summary}
              </p>
            </div>
            <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs text-zinc-500">
              <span>Audited dynamically</span>
              <span className="flex items-center gap-1"><Info size={12} /> Bloomberg Term Grade</span>
            </div>
          </div>
        </div>

        {/* Actionable Insights and Chat Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Actionable Alerts Panel */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" /> Strategic Risk Warnings
            </h3>
            <div className="space-y-4">
              {riskData.alerts && riskData.alerts.length > 0 ? (
                riskData.alerts.map((alert) => (
                  <div key={alert.id || alert.title} className="glass-panel p-6 border-l-4 border-l-amber-500 relative overflow-hidden group">
                    <div className="flex items-center justify-between gap-4 mb-3">
                      <h4 className="text-base font-black text-white">{alert.title}</h4>
                      <span className={`text-[9px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${getSeverityBadge(alert.severity)}`}>
                        {alert.severity}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-300 mb-4">{alert.message}</p>
                    <div className="p-3 bg-white/[0.02] border border-white/[0.05] rounded-xl flex items-start gap-3">
                      <Zap className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-black text-violet-400 uppercase tracking-widest mb-1">Corrective Recommendation</p>
                        <p className="text-xs text-zinc-400">{alert.corrective_action}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="glass-panel p-6 text-center text-zinc-500 text-sm">
                  No risk alerts triggered. Portfolio maintains structural equilibrium.
                </div>
              )}
            </div>
          </div>

          {/* Interactive Chat Panel */}
          <div className="glass-panel p-6 flex flex-col justify-between h-[500px]">
            <div>
              <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <Shield className="w-5 h-5 text-violet-400" /> Risk Consult Session
              </h3>
              <p className="text-xs text-zinc-500 mb-4">Discuss hedging, volatility, and portfolio optimization with your coach.</p>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {chatMessages.length === 0 ? (
                <div className="text-center text-zinc-500 text-xs py-8 space-y-4">
                  <p>Select a preset topic below or query the coach directly:</p>
                  <div className="grid grid-cols-1 gap-2 max-w-[280px] mx-auto text-left">
                    {PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        onClick={() => sendChatMessage(preset.text)}
                        className="p-2 bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.08] text-zinc-300 rounded-lg flex items-center gap-2 text-[10px] font-bold uppercase transition-all duration-200"
                      >
                        {preset.icon}
                        <span>{preset.text}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                chatMessages.map((msg, index) => {
                  const isUser = msg.role === 'user';
                  return (
                    <div key={index} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                        isUser 
                          ? 'bg-primary/20 border border-primary/30 text-white rounded-br-none' 
                          : 'bg-white/[0.04] border border-white/[0.08] text-zinc-300 rounded-bl-none'
                      }`}>
                        {!isUser && msg.title && (
                          <div className="font-extrabold text-white mb-1 uppercase tracking-widest flex items-center gap-1.5">
                            <Zap size={10} className="text-violet-400" />
                            {msg.title}
                          </div>
                        )}
                        <p className="whitespace-pre-wrap">{msg.body || msg.content}</p>
                      </div>
                    </div>
                  );
                })
              )}
              {sendingMsg && (
                <div className="flex justify-start">
                  <div className="p-3 bg-white/[0.04] border border-white/[0.08] text-zinc-500 rounded-2xl rounded-bl-none text-xs flex items-center gap-2">
                    <RefreshCw className="w-3 h-3 animate-spin text-violet-400" />
                    <span>Analyzing portfolio dynamics...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Box */}
            <form onSubmit={(e) => { e.preventDefault(); sendChatMessage(chatInput); }} className="flex gap-2 pt-3 border-t border-white/[0.06]">
              <input
                type="text"
                placeholder="Ask about structural risks..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={sendingMsg}
                className="flex-1 bg-white/[0.03] border border-white/[0.1] rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-primary/50 transition-all"
              />
              <button
                type="submit"
                disabled={sendingMsg || !chatInput.trim()}
                className="p-2.5 bg-primary hover:bg-primary-hover disabled:bg-zinc-800 disabled:text-zinc-600 rounded-xl text-white transition-all"
              >
                <Send size={14} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
