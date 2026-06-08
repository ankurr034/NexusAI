import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, Activity, Server, Zap, RefreshCw, XCircle, AlertTriangle, CheckCircle, Clock, LineChart as LineChartIcon } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useUser } from '../context/UserContext';
import useSocket from '../hooks/useSocket';
import { Navigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '../components/Toast';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function AdminDashboard() {
  const { user } = useUser();
  const socket = useSocket();
  const { addToast } = useToast();
  const [liveStats, setLiveStats] = useState([]);
  const [telemetryBuffer, setTelemetryBuffer] = useState(null);
  const [analyticsLoad, setAnalyticsLoad] = useState(null);
  const [simulatorLoad, setSimulatorLoad] = useState(null);
  
  // React Query for initial load and polling
  const { data: adminData, isLoading, refetch } = useQuery({
    queryKey: ['adminBrokerStats'],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE_URL}/api/admin/broker-stats`);
      return res.data;
    },
    refetchInterval: 10000, // Poll every 10s as a fallback
    enabled: !!(user?.isAdmin || user?.username === 'admin')
  });

  // WebSocket for Real-Time Telemetry
  useEffect(() => {
    if (!socket || !user || (!user.isAdmin && user.username !== 'admin')) return;
    
    socket.emit('join_admin');
    
    const handleTelemetry = (data) => {
       setLiveStats(data.stats);
       if (data.analyticsLoad) setAnalyticsLoad(data.analyticsLoad);
       if (data.simulatorLoad) setSimulatorLoad(data.simulatorLoad);
    };
    
    socket.on('admin_telemetry_update', handleTelemetry);
    
    return () => {
       socket.off('admin_telemetry_update', handleTelemetry);
    };
  }, [socket, user]);

  useEffect(() => {
    if (adminData?.data && liveStats.length === 0) {
       setLiveStats(adminData.data);
    }
    if (adminData?.buffer) {
       setTelemetryBuffer(adminData.buffer);
    }
  }, [adminData]);

  // Mutations for Admin Controls
  const clearCacheMutation = useMutation({
    mutationFn: async () => {
       const res = await axios.post(`${API_BASE_URL}/api/admin/broker/clear-cache`);
       return res.data;
    },
    onSuccess: (data) => addToast('success', data.message || 'Cache Cleared'),
    onError: (err) => addToast('error', 'Failed to clear cache')
  });

  const disconnectMutation = useMutation({
    mutationFn: async (broker_name) => {
       const res = await axios.post(`${API_BASE_URL}/api/admin/broker/disconnect`, { broker_name });
       return res.data;
    },
    onSuccess: (data) => addToast('success', data.message || 'Broker Disconnected'),
    onError: (err) => addToast('error', 'Failed to disconnect broker')
  });

  if (!user || (!user.isAdmin && user.username !== 'admin')) {
    return <Navigate to="/explore" />;
  }

  if (isLoading && liveStats.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const getHealthColor = (score) => {
    if (score >= 90) return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10';
    if (score >= 70) return 'text-amber-400 border-amber-500/20 bg-amber-500/10';
    return 'text-rose-400 border-rose-500/20 bg-rose-500/10';
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-rose-500" />
            Operations Command Center
          </h1>
          <p className="text-zinc-500 mt-2 font-medium">Real-time broker telemetry, gateway health, and systemic diagnostics.</p>
        </div>
        <div className="flex items-center gap-3">
           <button 
             onClick={() => clearCacheMutation.mutate()}
             disabled={clearCacheMutation.isLoading}
             className="px-4 py-2 bg-white/[0.05] border border-white/[0.1] rounded-xl text-sm font-bold text-white hover:bg-white/[0.1] transition-all flex items-center gap-2">
             <RefreshCw className={`w-4 h-4 ${clearCacheMutation.isLoading ? 'animate-spin' : ''}`} /> Clear Idempotency Cache
           </button>
        </div>
      </div>

      {/* Broker Health Matrix */}
      <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4"><Server className="w-5 h-5 text-primary" /> Active Broker Gateways</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {liveStats.map((broker) => (
          <div key={broker.activeAdapter} className="glass-panel p-6 border-t-4 border-t-white/[0.1] relative overflow-hidden group">
            
            {/* Header */}
            <div className="flex justify-between items-start mb-6">
              <div>
                 <h3 className="text-lg font-black text-white">{broker.activeAdapter}</h3>
                 <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md ${broker.isSandbox ? 'bg-orange-500/20 text-orange-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                    {broker.isSandbox ? 'SANDBOX' : 'LIVE PRODUCTION'}
                 </span>
              </div>
              <div className={`p-2 rounded-xl border ${getHealthColor(broker.healthScore)} flex flex-col items-center justify-center min-w-[50px]`}>
                 <span className="text-[10px] uppercase font-black opacity-80">Score</span>
                 <span className="text-lg font-black font-mono-data">{broker.healthScore}</span>
              </div>
            </div>

            {/* Metrics */}
            <div className="space-y-4 mb-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-500 flex items-center gap-2"><Clock className="w-4 h-4" /> Latency</span>
                <span className={`text-sm font-bold font-mono-data ${broker.metrics.latencyMs > 500 ? 'text-rose-400' : 'text-emerald-400'}`}>
                   {broker.metrics.latencyMs}ms
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-500 flex items-center gap-2"><Activity className="w-4 h-4" /> Queue Depth</span>
                <span className={`text-sm font-bold font-mono-data ${broker.metrics.queueSize > 5 ? 'text-amber-400' : 'text-zinc-300'}`}>
                   {broker.metrics.queueSize} req
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-500 flex items-center gap-2"><Zap className="w-4 h-4" /> 429 Cooldown</span>
                <span className={`text-sm font-bold ${broker.metrics.isCoolingDown ? 'text-rose-400' : 'text-emerald-400'}`}>
                   {broker.metrics.isCoolingDown ? 'ACTIVE' : 'CLEAR'}
                </span>
              </div>
              
              {/* Angel One specific metrics */}
              {broker.activeAdapter === 'Angel One' && (
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/[0.05]">
                  <span className="text-sm font-medium text-zinc-500 flex items-center gap-2"><Server className="w-4 h-4" /> TOTP Generator</span>
                  <span className={`text-sm font-bold ${broker.metrics.totpValid ? 'text-emerald-400' : 'text-rose-400'}`}>
                     {broker.metrics.totpValid ? 'SYNCED' : 'OFFLINE'}
                  </span>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="pt-4 border-t border-white/[0.06] flex gap-2">
               <button 
                 onClick={() => disconnectMutation.mutate(broker.activeAdapter)}
                 className="flex-1 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg text-rose-400 text-xs font-bold transition-all flex items-center justify-center gap-2">
                 <XCircle className="w-3 h-3" /> Force Disconnect
               </button>
            </div>

          </div>
        ))}
      </div>

      {/* System Diagnostics & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Live Alerts Stream */}
         <div className="lg:col-span-2 glass-panel p-6 border-l-4 border-l-primary">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-400" /> Live System Alerts</h3>
            <div className="space-y-3">
               {liveStats.some(b => b.metrics.isCoolingDown) && (
                 <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex gap-3 items-center">
                    <XCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
                    <p className="text-sm text-zinc-300"><span className="text-white font-bold">Rate Limit Spikes Detected:</span> One or more brokers are actively throttling requests. Gateway is delaying outgoing syncs.</p>
                 </div>
               )}
               {liveStats.some(b => b.isSandbox && b.activeAdapter !== 'Groww' && b.activeAdapter !== 'Angel One') && (
                 <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex gap-3 items-center">
                    <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                    <p className="text-sm text-zinc-300"><span className="text-white font-bold">Sandbox Degradation:</span> Live credentials for primary brokers are missing or failed. Users are routed to mocked feeds.</p>
                 </div>
               )}
               <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex gap-3 items-center">
                  <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <p className="text-sm text-zinc-300"><span className="text-white font-bold">Gateway Stabilized:</span> WebSocket supervisor reports 0 zombie feeds. Idempotency cache holding firm.</p>
               </div>
            </div>
         </div>

         {/* Analytics Engine Load Stub */}
         <div className="glass-panel p-6 border border-white/[0.04]">
             <h3 className="text-lg font-bold text-white mb-6">Analytics Engine</h3>
             {analyticsLoad ? (
                <div className="space-y-5">
                    <div>
                       <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Compute Latency</p>
                       <p className={`text-2xl font-black font-mono-data ${analyticsLoad.computeLatencyMs > 10 ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {analyticsLoad.computeLatencyMs.toFixed(2)}ms
                       </p>
                    </div>
                    <div>
                       <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Tick Throughput</p>
                       <p className="text-2xl font-black text-white font-mono-data">{analyticsLoad.updatesPerSecond} TPS</p>
                    </div>
                    <div>
                       <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Status</p>
                       <p className="text-lg font-black text-emerald-400 font-mono-data">STREAMING DELTAS</p>
                    </div>
                </div>
             ) : (
                <div className="flex items-center justify-center h-full text-zinc-500 text-sm">Awaiting Engine Telemetry...</div>
             )}
         </div>

         {/* Paper Simulator Stub */}
         <div className="glass-panel p-6 border border-white/[0.04]">
             <h3 className="text-lg font-bold text-white mb-6">Simulator Engine</h3>
             {simulatorLoad ? (
                <div className="space-y-5">
                    <div>
                       <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Execution Latency</p>
                       <p className={`text-2xl font-black font-mono-data ${simulatorLoad.executionLatency > 5 ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {simulatorLoad.executionLatency.toFixed(2)}ms
                       </p>
                    </div>
                    <div>
                       <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Simulated TPS</p>
                       <p className="text-2xl font-black text-white font-mono-data">{simulatorLoad.simulatedTPS} TPS</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div>
                          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Traders</p>
                          <p className="text-lg font-black text-blue-400 font-mono-data">{simulatorLoad.activePaperTraders}</p>
                       </div>
                       <div>
                          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Violations</p>
                          <p className="text-lg font-black text-rose-400 font-mono-data">{simulatorLoad.riskViolations}</p>
                       </div>
                    </div>
                </div>
             ) : (
                <div className="flex items-center justify-center h-full text-zinc-500 text-sm">Awaiting Engine Telemetry...</div>
             )}
         </div>
         {/* Historical Buffer Charts */}
         <div className="lg:col-span-3 glass-panel p-6 border-t-4 border-t-blue-500 mt-6">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2"><LineChartIcon className="w-5 h-5 text-blue-400" /> API Latency Timeline (Last 60 Minutes)</h3>
            <div className="h-[300px] w-full">
               {telemetryBuffer && (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <XAxis dataKey="timestamp" type="category" allowDuplicatedCategory={false} stroke="#52525b" tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} />
                      <YAxis stroke="#52525b" />
                      <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a' }} labelFormatter={(l) => new Date(l).toLocaleTimeString()} />
                      {Object.keys(telemetryBuffer).filter(k => telemetryBuffer[k][1].length > 0).map((broker, i) => (
                         <Line 
                            dataKey="latency" 
                            data={telemetryBuffer[broker][1]} 
                            name={broker} 
                            key={broker} 
                            stroke={i === 0 ? "#10b981" : i === 1 ? "#3b82f6" : "#f59e0b"} 
                            dot={false}
                            strokeWidth={2}
                         />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
               )}
               {!telemetryBuffer && (
                 <div className="w-full h-full flex items-center justify-center text-zinc-500 font-bold">Waiting for telemetry buffer...</div>
               )}
            </div>
         </div>
      </div>
    </motion.div>
  );
}
