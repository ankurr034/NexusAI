import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Send, Sparkles, TrendingUp, TrendingDown, Target, Shield, BarChart3, MessageSquare, Zap, ArrowRight, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { useUser } from '../context/UserContext';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';

const SUGGESTIONS = [
  { text: "Should I buy RELIANCE?", icon: <TrendingUp size={14} /> },
  { text: "What's the target for TCS?", icon: <Target size={14} /> },
  { text: "Is INFY risky right now?", icon: <Shield size={14} /> },
  { text: "Show RSI for HDFCBANK", icon: <BarChart3 size={14} /> },
  { text: "What's the sentiment on ZOMATO?", icon: <MessageSquare size={14} /> },
  { text: 'Compare TCS vs INFY', icon: <Sparkles size={14} /> },
];

function formatBody(body) {
  // Simple markdown-like formatting 
  return body
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');
}

export default function AICopilot() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = async (text) => {
    if (!text.trim()) return;
    
    const userMsg = { role: 'user', content: text, timestamp: new Date().toLocaleTimeString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await axios.post(`${API_BASE_URL}/api/copilot/chat?user_id=${user?.id || 1}`, {
        message: text,
      });

      const copilotResponse = res.data;
      let txHash = null;
      let blockHash = null;

      try {
        // Log prediction to blockchain
        if (copilotResponse.symbol) {
          const logRes = await axios.post(`${API_BASE_URL}/api/predictions/log`, {
            ticker: copilotResponse.symbol,
            predictionText: copilotResponse.body,
            targetPrice: copilotResponse.price,
            timeframe: 'short-term'
          });
          if (logRes.data.success) {
            txHash = logRes.data.txHash;
            blockHash = logRes.data.hash;
          }
        }
      } catch (logErr) {
        console.error("Blockchain logging failed", logErr);
      }

      const aiMsg = {
        role: 'assistant',
        title: copilotResponse.title,
        verdict: copilotResponse.verdict,
        body: copilotResponse.body,
        symbol: copilotResponse.symbol,
        price: copilotResponse.price,
        change_pct: copilotResponse.change_pct,
        confidence: copilotResponse.confidence,
        timestamp: new Date().toLocaleTimeString(),
        txHash,
        blockHash
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        title: '⚠️ Error',
        body: 'Failed to get response. Please try again.',
        verdict: 'ERROR',
        timestamp: new Date().toLocaleTimeString(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  const verdictColor = (verdict) => {
    const v = verdict?.toUpperCase();
    if (['BUY', 'BULLISH', 'STRONG BUY', 'SUCCESS'].includes(v)) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (['SELL', 'BEARISH', 'ERROR'].includes(v)) return 'text-red-400 bg-red-500/10 border-red-500/20';
    if (['WAIT', 'HOLD', 'MODERATE'].includes(v)) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
  };

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl p-8"
        style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(0,212,170,0.08))' }}
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-[100px]" />
        <div className="relative flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-xl shadow-purple-500/20">
            <Bot className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white mb-1">AI Trade Copilot</h1>
            <p className="text-zinc-400 text-sm">Ask anything about stocks — get instant AI-powered analysis, targets & sentiment</p>
          </div>
          <div className="ml-auto hidden md:flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">AI Online</span>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Chat Area */}
        <div className="lg:col-span-3 glass-panel flex flex-col" style={{ minHeight: '65vh' }}>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6" style={{ maxHeight: '55vh' }}>
            {messages.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full flex flex-col items-center justify-center text-center py-16"
              >
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center mb-6">
                  <Sparkles className="w-10 h-10 text-purple-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Start a Conversation</h3>
                <p className="text-zinc-500 text-sm max-w-md mb-8">
                  Ask me about any stock — buy/sell analysis, price targets, risk assessment, technical analysis, or market sentiment.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-2xl">
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(s.text)}
                      className="flex items-center gap-2 px-4 py-3 bg-white/[0.03] border border-white/[0.06] rounded-xl text-sm text-zinc-400 hover:text-white hover:bg-white/[0.06] hover:border-white/10 transition-all text-left group"
                    >
                      <span className="text-primary group-hover:scale-110 transition-transform">{s.icon}</span>
                      <span className="truncate">{s.text}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            <AnimatePresence>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'user' ? (
                    <div className="max-w-lg bg-primary/10 border border-primary/20 rounded-2xl rounded-br-md px-5 py-3">
                      <p className="text-sm text-white">{msg.content}</p>
                      <p className="text-[10px] text-zinc-500 mt-1">{msg.timestamp}</p>
                    </div>
                  ) : (
                    <div className="max-w-2xl w-full">
                      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl rounded-bl-md overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.04]">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                              <Bot size={14} className="text-white" />
                            </div>
                            <span className="text-sm font-bold text-white">{msg.title || 'NexusAI'}</span>
                          </div>
                          {msg.verdict && (
                            <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${verdictColor(msg.verdict)}`}>
                              {msg.verdict}
                            </span>
                          )}
                        </div>
                        
                        {/* Price Bar */}
                        {msg.price > 0 && (
                          <div className="px-5 py-2 bg-white/[0.02] flex items-center gap-4 border-b border-white/[0.04]">
                            <span className="text-xs text-zinc-500">Price</span>
                            <span className="text-sm font-bold text-white font-mono">₹{msg.price?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            <span className={`text-xs font-bold ${msg.change_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {msg.change_pct >= 0 ? '▲' : '▼'} {Math.abs(msg.change_pct)?.toFixed(2)}%
                            </span>
                            {msg.confidence && (
                              <div className="ml-auto flex items-center gap-1.5">
                                <Sparkles size={10} className="text-amber-400" />
                                <span className="text-[10px] text-amber-400 font-bold">{msg.confidence}% confidence</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Body */}
                        <div className="px-5 py-4">
                          <div 
                            className="text-sm text-zinc-300 leading-relaxed prose-sm"
                            dangerouslySetInnerHTML={{ __html: formatBody(msg.body || '') }}
                          />
                        </div>

                        {/* Actions */}
                        {msg.symbol && msg.symbol !== 'NIFTY' && (
                          <div className="px-5 py-3 border-t border-white/[0.04] flex gap-2">
                            <button
                              onClick={() => navigate(`/stock/${msg.symbol}`)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary text-xs font-bold rounded-lg hover:bg-primary/20 transition-colors"
                            >
                              View Chart <ArrowRight size={12} />
                            </button>
                          </div>
                        )}

                        <div className="px-5 py-2 border-t border-white/[0.04]">
                          <p className="text-[9px] text-zinc-600">{msg.timestamp} • AI-generated analysis for educational purposes only</p>
                          {msg.blockHash && (
                            <div className="mt-2 flex items-center gap-1.5 bg-primary/10 border border-primary/20 px-2 py-1 rounded w-fit">
                              <Shield size={10} className="text-primary" />
                              <span className="text-[9px] text-primary font-bold">Blockchain Verified: {msg.blockHash.substring(0, 10)}...</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-3 text-zinc-500"
              >
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                  <Bot size={14} className="text-white animate-pulse" />
                </div>
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-zinc-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-zinc-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-zinc-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-xs text-zinc-600">Analyzing market data...</span>
              </motion.div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-white/[0.06] p-4">
            <form onSubmit={handleSubmit} className="flex gap-3">
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about any stock... e.g. 'Should I buy RELIANCE?'"
                  className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-primary/40 rounded-xl py-3.5 px-5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all placeholder:text-zinc-600"
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="px-6 py-3.5 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-xl font-bold text-sm flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-30 shadow-lg shadow-purple-500/20"
              >
                <Send size={16} />
                Send
              </button>
            </form>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Quick Actions */}
          <div className="glass-panel p-5">
            <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-4">Quick Commands</h3>
            <div className="space-y-2">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s.text)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left bg-white/[0.02] border border-white/[0.04] rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-all group"
                >
                  <span className="text-primary">{s.icon}</span>
                  <span className="truncate">{s.text}</span>
                  <ArrowRight size={12} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-zinc-600" />
                </button>
              ))}
            </div>
          </div>

          {/* Disclaimer */}
          <div className="glass-panel p-5">
            <div className="flex items-start gap-3">
              <Shield size={16} className="text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  AI Copilot provides analysis for <strong className="text-zinc-400">educational purposes only</strong>. 
                  Always do your own research before making investment decisions. Past performance ≠ future returns.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
