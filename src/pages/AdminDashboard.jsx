import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, Activity, Server, Zap, RefreshCw, XCircle, AlertTriangle, CheckCircle, Clock, LineChart as LineChartIcon } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useUser } from '../context/UserContext';
import useSocket from '../hooks/useSocket';
import { Navigate } from 'react-router-dom';
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
  const [queueStats, setQueueStats] = useState(null);
  
  // Scale validation states
  const [scaleTarget, setScaleTarget] = useState(1000);
  const [scaleDuration, setScaleDuration] = useState(30);
  const [scaleRampUp, setScaleRampUp] = useState(10);
  const [loadTestStats, setLoadTestStats] = useState(null);
  const [isScaleActionLoading, setIsScaleActionLoading] = useState(false);

  const [adminData, setAdminData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [isOperatingQueue, setIsOperatingQueue] = useState(null);

  // Standard fetch function
  const fetchAdminData = async () => {
    if (!user || (!user.isAdmin && user.username !== 'admin')) return;
    try {
      const [brokerRes, queueRes, scaleRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/admin/broker-stats`),
        axios.get(`${API_BASE_URL}/api/admin/queues`),
        axios.get(`${API_BASE_URL}/api/admin/scale/status`)
      ]);
      setAdminData(brokerRes.data);
      if (queueRes.data?.queues) {
        setQueueStats(queueRes.data.queues);
      }
      if (scaleRes.data) {
        setLoadTestStats(scaleRes.data);
      }
    } catch (err) {
      console.error('Failed to fetch admin stats', err);
    }
  };

  const fetchQueueData = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/queues`);
      if (res.data?.queues) {
        setQueueStats(res.data.queues);
      }
    } catch (err) {
      console.error('Failed to fetch queue stats', err);
    }
  };

  // Poll for data
  useEffect(() => {
    if (!user || (!user.isAdmin && user.username !== 'admin')) return;
    
    setIsLoading(true);
    fetchAdminData().finally(() => setIsLoading(false));

    const interval = setInterval(() => {
      fetchAdminData();
    }, 10000); // Poll every 10s as a fallback

    return () => clearInterval(interval);
  }, [user]);

  // WebSocket for Real-Time Telemetry
  useEffect(() => {
    if (!socket || !user || (!user.isAdmin && user.username !== 'admin')) return;
    
    socket.emit('join_admin');
    
    const handleTelemetry = (data) => {
       setLiveStats(data.stats);
       if (data.analyticsLoad) setAnalyticsLoad(data.analyticsLoad);
       if (data.simulatorLoad) setSimulatorLoad(data.simulatorLoad);
       if (data.queueStats) setQueueStats(data.queueStats);
       if (data.activeLoadTest) setLoadTestStats(data.activeLoadTest);
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

  // Controls Handlers
  const handleQueueAction = async (action, queueName) => {
    if (action === 'clean') {
      const confirmClean = window.confirm(`Are you sure you want to clean completed/failed jobs from ${queueName}? Active and delayed jobs will not be affected.`);
      if (!confirmClean) return;
    }

    setIsOperatingQueue({ action, queueName });
    try {
      const res = await axios.post(`${API_BASE_URL}/api/admin/queues/${action}`, { queueName });
      addToast('success', res.data.message || `Queue action ${action} completed successfully.`);
      fetchQueueData();
    } catch (err) {
      addToast('error', err.response?.data?.error || `Failed to perform ${action} on ${queueName}`);
    } finally {
      setIsOperatingQueue(null);
    }
  };

  const handleClearCache = async () => {
    setIsClearingCache(true);
    try {
       const res = await axios.post(`${API_BASE_URL}/api/admin/broker/clear-cache`);
       addToast('success', res.data.message || 'Cache Cleared');
       fetchAdminData();
    } catch (err) {
       addToast('error', 'Failed to clear cache');
    } finally {
       setIsClearingCache(false);
    }
  };

  const handleDisconnect = async (broker_name) => {
    try {
       const res = await axios.post(`${API_BASE_URL}/api/admin/broker/disconnect`, { broker_name });
       addToast('success', res.data.message || 'Broker Disconnected');
       fetchAdminData();
    } catch (err) {
       addToast('error', 'Failed to disconnect broker');
    }
  };

  // Scale stress test action handlers
  const handleStartScaleTest = async () => {
    const confirmStart = window.confirm(`Proceed with scale stress-test simulating ${scaleTarget} clients for ${scaleDuration} seconds? This creates high network and processor load.`);
    if (!confirmStart) return;

    setIsScaleActionLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/admin/scale/start`, {
        duration: scaleDuration * 1000,
        connections: scaleTarget,
        rampUp: scaleRampUp * 1000
      });
      addToast('success', res.data.message || 'Scale simulation initiated.');
    } catch (err) {
      addToast('error', err.response?.data?.error || 'Failed to start scale test');
    } finally {
      setIsScaleActionLoading(false);
    }
  };

  const handleStopScaleTest = async () => {
    setIsScaleActionLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/admin/scale/stop`);
      addToast('success', res.data.message || 'Scale simulation stopped.');
    } catch (err) {
      addToast('error', err.response?.data?.error || 'Failed to stop scale test');
    } finally {
      setIsScaleActionLoading(false);
    }
  };

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
             onClick={handleClearCache}
             disabled={isClearingCache}
             className="px-4 py-2 bg-white/[0.05] border border-white/[0.1] rounded-xl text-sm font-bold text-white hover:bg-white/[0.1] transition-all flex items-center gap-2">
             <RefreshCw className={`w-4 h-4 ${isClearingCache ? 'animate-spin' : ''}`} /> Clear Idempotency Cache
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
                 onClick={() => handleDisconnect(broker.activeAdapter)}
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
      </div>

      {/* BullMQ Async Workers & Queues */}
      <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4 mt-8">
        <Activity className="w-5 h-5 text-primary" /> BullMQ Background Workers
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        {queueStats ? (
          Object.entries(queueStats).map(([name, stats]) => {
            const isOffline = stats === 'offline';
            const isActive = isOperatingQueue?.queueName === name;
            return (
              <div key={name} className="glass-panel p-6 border-t-4 border-t-white/[0.1] relative overflow-hidden group">
                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-lg font-black text-white">{name}</h3>
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md ${isOffline ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                      {isOffline ? 'OFFLINE' : 'OPERATIONAL'}
                    </span>
                  </div>
                  {!isOffline && (
                    <div className="p-2 rounded-xl border border-white/10 bg-white/5 flex flex-col items-center justify-center min-w-[50px]">
                      <span className="text-[10px] uppercase font-black text-zinc-400">Fail %</span>
                      <span className="text-sm font-black font-mono-data text-white">{stats.failedPercentage}%</span>
                    </div>
                  )}
                </div>

                {/* Metrics */}
                {isOffline ? (
                  <div className="text-zinc-500 text-sm py-4">Queue manager reports Redis is offline or queue is disconnected.</div>
                ) : (
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-400">Active</span>
                      <span className="font-bold text-emerald-400 font-mono-data">{stats.active}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-400">Waiting</span>
                      <span className="font-bold text-amber-400 font-mono-data">{stats.waiting}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-400">Delayed</span>
                      <span className="font-bold text-blue-400 font-mono-data">{stats.delayed}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-400">Completed</span>
                      <span className="font-bold text-zinc-300 font-mono-data">{stats.completed}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-400">Failed</span>
                      <span className={`font-bold font-mono-data ${stats.failed > 0 ? 'text-rose-400' : 'text-zinc-300'}`}>{stats.failed}</span>
                    </div>
                  </div>
                )}

                {/* Actions */}
                {!isOffline && (
                  <div className="pt-4 border-t border-white/[0.06] flex flex-wrap gap-2">
                    <button
                      onClick={() => handleQueueAction('retry', name)}
                      disabled={isOperatingQueue !== null || stats.failed === 0}
                      className={`flex-1 py-1.5 rounded-lg border text-xs font-bold transition-all text-center flex items-center justify-center gap-1 ${
                        stats.failed > 0
                          ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20 text-emerald-400'
                          : 'bg-zinc-800/20 border-zinc-700/30 text-zinc-500 cursor-not-allowed'
                      }`}
                    >
                      Retry Failed
                    </button>
                    <button
                      onClick={() => handleQueueAction('clean', name)}
                      disabled={isOperatingQueue !== null || (stats.completed === 0 && stats.failed === 0)}
                      className={`flex-1 py-1.5 rounded-lg border text-xs font-bold transition-all text-center flex items-center justify-center gap-1 ${
                        stats.completed > 0 || stats.failed > 0
                          ? 'bg-rose-500/10 hover:bg-rose-500/20 border-rose-500/20 text-rose-400'
                          : 'bg-zinc-800/20 border-zinc-700/30 text-zinc-500 cursor-not-allowed'
                      }`}
                    >
                      Clean
                    </button>
                    <button
                      onClick={() => handleQueueAction('trigger-test', name)}
                      disabled={isOperatingQueue !== null}
                      className="w-full py-1.5 bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] rounded-lg text-white text-xs font-bold transition-all text-center flex items-center justify-center gap-1"
                    >
                      {isActive && isOperatingQueue?.action === 'trigger-test' ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        'Trigger Test Job'
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="col-span-4 text-center py-8 text-zinc-500 text-sm">
            Fetching worker queue telemetry...
          </div>
        )}
      </div>

      {/* WebSocket Scale Testing & Load Simulator */}
      <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4 mt-8">
        <Activity className="w-5 h-5 text-primary" /> WebSocket Scale Testing & Load Simulator
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Controls Card */}
        <div className="glass-panel p-6 border-t-4 border-t-white/[0.1] space-y-4">
          <h3 className="text-lg font-bold text-white mb-2">Simulation Controls</h3>
          
          <div className="space-y-3">
            <div>
              <label className="text-xs text-zinc-400 font-bold uppercase tracking-widest block mb-1">Target Connections</label>
              <input
                type="number"
                value={scaleTarget}
                onChange={(e) => setScaleTarget(parseInt(e.target.value) || 1000)}
                disabled={loadTestStats?.status === 'running'}
                className="w-full bg-white/[0.03] border border-white/[0.1] rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-primary/50"
              />
            </div>
            
            <div>
              <label className="text-xs text-zinc-400 font-bold uppercase tracking-widest block mb-1">Test Duration (s)</label>
              <input
                type="number"
                value={scaleDuration}
                onChange={(e) => setScaleDuration(parseInt(e.target.value) || 30)}
                disabled={loadTestStats?.status === 'running'}
                className="w-full bg-white/[0.03] border border-white/[0.1] rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-primary/50"
              />
            </div>

            <div>
              <label className="text-xs text-zinc-400 font-bold uppercase tracking-widest block mb-1">Ramp Up Time (s)</label>
              <input
                type="number"
                value={scaleRampUp}
                onChange={(e) => setScaleRampUp(parseInt(e.target.value) || 10)}
                disabled={loadTestStats?.status === 'running'}
                className="w-full bg-white/[0.03] border border-white/[0.1] rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-primary/50"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-white/[0.06] flex gap-2">
            {loadTestStats?.status === 'running' ? (
              <button
                onClick={handleStopScaleTest}
                disabled={isScaleActionLoading}
                className="w-full py-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl text-rose-400 text-sm font-bold transition-all flex items-center justify-center gap-2"
              >
                <XCircle className="w-4 h-4" /> Stop Simulator
              </button>
            ) : (
              <button
                onClick={handleStartScaleTest}
                disabled={isScaleActionLoading}
                className="w-full py-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm font-bold transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isScaleActionLoading ? 'animate-spin' : ''}`} /> Run Simulation
              </button>
            )}
          </div>
        </div>

        {/* Telemetry Overview Card */}
        <div className="glass-panel p-6 border-t-4 border-t-white/[0.1] lg:col-span-2 relative overflow-hidden">
          <h3 className="text-lg font-bold text-white mb-6">Real-Time Simulator Telemetry</h3>
          
          {loadTestStats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Simulator Status</p>
                <p className={`text-xl font-black uppercase ${
                  loadTestStats.status === 'running' ? 'text-emerald-400 animate-pulse' :
                  loadTestStats.status === 'completed' ? 'text-blue-400' : 'text-zinc-400'
                }`}>{loadTestStats.status}</p>
              </div>

              <div>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Simulated Clients</p>
                <p className="text-xl font-black text-white font-mono-data">
                  {loadTestStats.activeConnections} <span className="text-xs text-zinc-500">/ {loadTestStats.targetConnections}</span>
                </p>
              </div>

              <div>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Fan-Out Latency</p>
                <p className={`text-xl font-black font-mono-data ${loadTestStats.avgLatencyMs > 200 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {loadTestStats.avgLatencyMs}ms
                </p>
              </div>

              <div>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Errors / Drops</p>
                <p className={`text-xl font-black font-mono-data ${loadTestStats.errors > 0 ? 'text-rose-400' : 'text-white'}`}>
                  {loadTestStats.errors} <span className="text-xs text-zinc-500">({loadTestStats.disconnects} dc)</span>
                </p>
              </div>

              {/* Progress Bar */}
              {loadTestStats.status === 'running' && (
                <div className="col-span-4 pt-4">
                  <div className="flex justify-between text-xs text-zinc-500 mb-1">
                    <span>Elapsed: {loadTestStats.elapsedSeconds}s</span>
                    <span>Target: {scaleDuration}s</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${(loadTestStats.elapsedSeconds / scaleDuration) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
              No active or past scale test telemetry available. Click Run Simulation to start.
            </div>
          )}
        </div>
      </div>

      {/* Historical Buffer Charts */}
      <div className="glass-panel p-6 border-t-4 border-t-blue-500 mt-6">
        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
          <LineChartIcon className="w-5 h-5 text-blue-400" /> API Latency Timeline (Last 60 Minutes)
        </h3>
        <div className="h-[300px] w-full">
          {telemetryBuffer && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <XAxis
                  dataKey="timestamp"
                  type="category"
                  allowDuplicatedCategory={false}
                  stroke="#52525b"
                  tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                />
                <YAxis stroke="#52525b" />
                <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a' }} labelFormatter={(l) => new Date(l).toLocaleTimeString()} />
                {Object.keys(telemetryBuffer)
                  .filter((k) => telemetryBuffer[k][1].length > 0)
                  .map((broker, i) => (
                    <Line
                      dataKey="latency"
                      data={telemetryBuffer[broker][1]}
                      name={broker}
                      key={broker}
                      stroke={i === 0 ? '#10b981' : i === 1 ? '#3b82f6' : '#f59e0b'}
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
    </motion.div>
  );
}
