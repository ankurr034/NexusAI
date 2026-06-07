import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, TrendingUp, Shield, HelpCircle, ChevronRight, CheckCircle2, AlertCircle, Building2, Globe, Activity, LayoutGrid, ArrowRight, RefreshCw, ShieldAlert, XCircle } from 'lucide-react';
import axiosInstance from '../utils/axiosSetup';
import { useUser } from '../context/UserContext';
import { useToast } from '../components/Toast';
import { API_BASE_URL } from '../config';

const BROKERS = [
  { id: 'kite', name: 'Zerodha Kite', logo: 'ZK', color: 'bg-orange-500', iconColor: 'text-orange-500' },
  { id: 'upstox', name: 'Upstox Pro', logo: 'UP', color: 'bg-blue-600', iconColor: 'text-blue-600' },
  { id: 'groww', name: 'Groww', logo: 'G', color: 'bg-emerald-500', iconColor: 'text-emerald-500' },
  { id: 'angel', name: 'Angel One', logo: 'A1', color: 'bg-blue-800', iconColor: 'text-blue-800' },
];

export default function BrokerLink() {
  const { user, refreshUser, brokerConnected } = useUser();
  const toast = useToast();
  const navigate = useNavigate();
  const [selectedBroker, setSelectedBroker] = useState(null);
  const [connectionState, setConnectionState] = useState('idle'); // idle, connecting, authenticating, connected, failed
  const [connectionError, setConnectionError] = useState(null);
  const [isSandboxMode, setIsSandboxMode] = useState(false);

  const handleLink = async (broker) => {
    if (connectionState === 'connecting' || connectionState === 'authenticating') return;
    
    if (!user) {
        toast.error("Please login to connect a broker");
        return;
    }
    setSelectedBroker(broker);
    setConnectionState('connecting');
    setConnectionError(null);
    
    try {
      // Simulate multiple loading phases
      await new Promise(resolve => setTimeout(resolve, 800));
      setConnectionState('authenticating');

      // Direct integration with backend via centralized axios instance
      const res = await axiosInstance.post(`/api/broker/connect?user_id=${user.id}`, {
        broker_name: broker.name,
        api_key: `AK-${Math.random().toString(36).substring(7).toUpperCase()}`,
        api_secret: `AS-${Math.random().toString(36).substring(7).toUpperCase()}`,
        client_id: `CID-${Math.random().toString(36).substring(7).toUpperCase()}`
      });
      
      const { access_token, refresh_token, expires_at, is_sandbox } = res.data;
      if (access_token) {
        localStorage.setItem('broker_access_token', access_token);
        localStorage.setItem('broker_refresh_token', refresh_token);
        localStorage.setItem('broker_expires_at', expires_at);
        setIsSandboxMode(is_sandbox || false);
        // Force socket to reconnect and pick up new token
        window.dispatchEvent(new Event('broker_token_updated'));
      }
      
      // Simulate OAuth redirect delay
      setTimeout(async () => {
        await refreshUser();
        setConnectionState('connected');
      }, 1500);
    } catch (err) {
      setConnectionError(err.customMessage || err.message || "Broker gateway connection failed. Please check your network.");
      setConnectionState('failed');
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto space-y-10 pb-20">
      
      {/* Hero Link Section */}
      <div className="relative rounded-[40px] overflow-hidden border border-white/[0.08] bg-gradient-to-br from-[#060b18] via-surface to-surface p-10 md:p-16 shadow-[0_50px_100px_rgba(0,0,0,0.5)]">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-secondary/10 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-16">
          <div className="max-w-xl text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-4 mb-6">
               <span className="px-3 py-1 bg-primary/15 text-primary border border-primary/20 text-[10px] font-black uppercase tracking-widest rounded-full">Secure API Gateway</span>
               {brokerConnected ? (
                 <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20"><CheckCircle2 className="w-3.5 h-3.5" /> Broker Active</span>
               ) : (
                 <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> ISO 27001 Certified</span>
               )}
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-white leading-tight mb-8">
              Bridge your <span className="text-gradient">Broker API</span> to Nexus AI
            </h1>
            <div className="space-y-8">
              <p className="text-zinc-500 text-lg leading-relaxed font-medium">
                Sync your external demat account with Nexus AI for seamless live trade execution and portfolio tracking.
              </p>
              <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm font-bold text-zinc-400">
                 <div className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-emerald-400" /> T-Zero Latency</div>
                 <div className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-emerald-400" /> Auto CDSL E-DIS</div>
                 <div className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-emerald-400" /> Tax Shield Reports</div>
                 <div className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-emerald-400" /> Multi-Leg Orders</div>
              </div>
            </div>
          </div>

          <div className="flex-1 w-full max-w-md">
            <div className="glass-panel p-10 space-y-8 relative border-white/[0.08] shadow-2xl backdrop-blur-3xl rounded-[32px]">
                <div className="flex justify-between items-center mb-2">
                   <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Select Provider</h3>
                   <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                
                <div className="grid grid-cols-2 gap-5">
                   {BROKERS.map((broker) => (
                      <motion.button
                        key={broker.id}
                        whileHover={{ y: -6, scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleLink(broker)}
                        className={`p-7 rounded-[28px] border transition-all flex flex-col items-center gap-4 group relative overflow-hidden ${
                            selectedBroker?.id === broker.id 
                            ? 'bg-primary/20 border-primary shadow-[0_20px_50px_rgba(0,212,170,0.15)]' 
                            : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-primary/30'
                        }`}
                      >
                         <div className={`w-14 h-14 ${broker.color} rounded-2xl flex items-center justify-center font-black text-2xl text-white shadow-xl group-hover:rotate-6 transition-transform relative z-10`}>
                            {broker.logo}
                         </div>
                         <span className="text-[10px] font-black text-white uppercase tracking-widest relative z-10 group-hover:text-primary transition-colors">{broker.name}</span>
                         <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </motion.button>
                   ))}
                </div>
                
                <div className="mt-8 pt-8 border-t border-white/[0.04] text-center">
                   <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest leading-relaxed">By bridging your account, you authorize Nexus AI to access your trading credentials for execution.</p>
                </div>
            </div>
          </div>
        </div>
      </div>

      {/* Linking Modal */}
      <AnimatePresence>
        {(connectionState !== 'idle') && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/95 backdrop-blur-2xl" />
             <motion.div 
               initial={{ scale: 0.9, opacity: 0, y: 40 }} 
               animate={{ scale: 1, opacity: 1, y: 0 }}
               exit={{ scale: 0.9, opacity: 0, y: 40 }}
               className="relative w-full max-w-lg bg-[#0a0f1a] border border-white/[0.08] rounded-[48px] overflow-hidden p-12 text-center shadow-[0_50px_100px_rgba(0,0,0,0.8)]"
             >
                {(connectionState === 'connecting' || connectionState === 'authenticating') ? (
                    <div className="space-y-12 py-10">
                        <div className="relative mx-auto w-36 h-36 flex items-center justify-center">
                            <RefreshCw className="w-24 h-24 text-primary opacity-20 animate-spin" />
                            <div className="absolute w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center border border-primary/30 backdrop-blur-md shadow-[0_0_40px_rgba(0,212,170,0.2)]">
                                <span className="font-black text-3xl text-primary">{selectedBroker?.logo}</span>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-4xl font-black text-white mb-3">
                                {connectionState === 'connecting' ? 'Establishing Tunnel' : 'Syncing Engine'}
                            </h3>
                            <p className="text-zinc-500 font-bold uppercase tracking-[0.3em] text-[10px]">
                                {connectionState === 'connecting' ? `Connecting to ${selectedBroker?.name}` : `Authorizing Secure API Key`}
                            </p>
                        </div>
                    </div>
                ) : connectionState === 'failed' ? (
                    <div className="space-y-10">
                        <div className="w-28 h-28 bg-rose-500/10 rounded-[32px] flex items-center justify-center mx-auto border-2 border-rose-500/30 relative">
                            <XCircle className="w-14 h-14 text-rose-500" />
                        </div>
                        <div>
                            <h3 className="text-4xl font-black text-white">Connection Failed</h3>
                            <p className="text-rose-400 text-sm mt-4 px-6 font-bold">{connectionError}</p>
                        </div>
                        <div className="flex flex-col gap-3">
                           <button 
                              onClick={() => handleLink(selectedBroker)}
                              className="w-full py-5 bg-primary/10 text-primary border border-primary/20 font-black uppercase tracking-widest rounded-3xl hover:bg-primary/20 transition-all shadow-lg"
                           >
                               Retry Connection
                           </button>
                           <button 
                              onClick={() => setConnectionState('idle')}
                              className="w-full py-4 bg-white/[0.04] text-zinc-400 font-bold uppercase tracking-widest rounded-3xl hover:bg-white/[0.08] hover:text-white transition-all"
                           >
                               Cancel
                           </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-10">
                        <div className="w-28 h-28 bg-emerald-500/10 rounded-[32px] flex items-center justify-center mx-auto border-2 border-emerald-500/30 shadow-[0_0_60px_rgba(16,185,129,0.25)] relative">
                            <CheckCircle2 className="w-14 h-14 text-emerald-400" />
                            <div className="absolute -top-2 -right-2 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center border-4 border-[#0a0f1a]">
                               <div className="w-2 h-2 bg-white rounded-full animate-ping" />
                            </div>
                        </div>
                        <div>
                            <h3 className="text-4xl font-black text-white">Bridge Active</h3>
                            <p className="text-zinc-500 text-base mt-4 px-6 leading-relaxed">Your {selectedBroker?.name} account is now integrated for Live execution with Nexus AI orchestration.</p>
                        </div>
                        <div className="pt-4 grid grid-cols-2 gap-5">
                             <div className="p-5 bg-white/[0.02] border border-white/[0.04] rounded-3xl text-left">
                                <p className="text-[10px] font-black text-zinc-600 uppercase mb-2 tracking-widest">API Status</p>
                                <p className="text-sm font-bold text-emerald-400 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> CONNECTED</p>
                             </div>
                             <div className="p-5 bg-white/[0.02] border border-white/[0.04] rounded-3xl text-left">
                                <p className="text-[10px] font-black text-zinc-600 uppercase mb-2 tracking-widest">Environment</p>
                                <p className={`text-sm font-bold ${isSandboxMode ? 'text-orange-400' : 'text-amber-400'}`}>
                                   {isSandboxMode ? 'SANDBOX (DEMO)' : 'PRODUCTION'}
                                </p>
                             </div>
                        </div>
                        <button 
                           onClick={() => { setConnectionState('idle'); navigate('/portfolio'); }}
                           className="w-full mt-6 py-5 bg-primary text-black font-black uppercase tracking-widest rounded-3xl hover:bg-emerald-400 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 shadow-lg shadow-primary/20"
                        >
                            Open Trading Deck <ArrowRight className="w-6 h-6" />
                        </button>
                    </div>
                )}
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="glass-panel p-8 space-y-6 group hover:border-primary/30 transition-all">
              <div className="w-12 h-12 bg-white/[0.04] border border-white/10 rounded-2xl flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <Globe className="w-6 h-6 text-zinc-400 group-hover:text-primary transition-colors" />
              </div>
              <h4 className="text-xl font-extrabold text-white">Cross-Chain Trading</h4>
              <p className="text-zinc-500 text-sm leading-relaxed">Execute across multiple brokers and exchanges simultaneously with unified margin management.</p>
          </div>
          <div className="glass-panel p-8 space-y-6 group hover:border-primary/30 transition-all">
              <div className="w-12 h-12 bg-white/[0.04] border border-white/10 rounded-2xl flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <Activity className="w-6 h-6 text-zinc-400 group-hover:text-primary transition-colors" />
              </div>
              <h4 className="text-xl font-extrabold text-white">Smart Routing</h4>
              <p className="text-zinc-500 text-sm leading-relaxed">Nexus AI automatically routes orders to the broker offering the lowest slippage and best liquidity.</p>
          </div>
          <div className="glass-panel p-8 space-y-6 group hover:border-primary/30 transition-all">
              <div className="w-12 h-12 bg-white/[0.04] border border-white/10 rounded-2xl flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <LayoutGrid className="w-6 h-6 text-zinc-400 group-hover:text-primary transition-colors" />
              </div>
              <h4 className="text-xl font-extrabold text-white">Live Audit trail</h4>
              <p className="text-zinc-500 text-sm leading-relaxed">Real-time exchange confirmation and digital contract notes synced directly to your Nexus ledger.</p>
          </div>
      </div>

    </motion.div>
  );
}
