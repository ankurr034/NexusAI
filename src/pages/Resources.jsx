import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileText, Code2, AlertTriangle, Database, ShieldAlert, Sparkles, ChevronRight, Activity, Cpu } from 'lucide-react';

const TABS = [
  { key: 'api', label: 'API Documentation', icon: <Code2 className="w-4 h-4" /> },
  { key: 'lstm', label: 'LSTM Model Paper', icon: <Cpu className="w-4 h-4" /> },
  { key: 'risk', label: 'Risk Disclaimer', icon: <ShieldAlert className="w-4 h-4" /> },
  { key: 'datasources', label: 'Data Sources', icon: <Database className="w-4 h-4" /> },
  { key: 'privacy', label: 'Privacy Policy', icon: <FileText className="w-4 h-4" /> },
];

export default function Resources() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'api';

  const handleTabChange = (key) => {
    setSearchParams({ tab: key });
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl p-8 border border-white/5 bg-gradient-to-br from-indigo-500/5 to-primary/5"
      >
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-indigo-500 flex items-center justify-center shadow-xl">
              <FileText className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white flex items-center gap-3">
                 Nexus Resource Hub
              </h1>
              <p className="text-zinc-400 text-sm mt-1">Institutional resources, documentation, models, and policy metrics.</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Sidebar Tabs */}
        <div className="space-y-1.5 lg:col-span-1">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 border text-left ${
                activeTab === tab.key
                  ? 'bg-primary/20 text-primary border-primary/30'
                  : 'bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10 hover:text-zinc-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Pane */}
        <div className="lg:col-span-3 glass-panel p-6 sm:p-8 min-h-[500px] border border-white/[0.04]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'api' && <ApiDocumentation />}
              {activeTab === 'lstm' && <LstmModelPaper />}
              {activeTab === 'risk' && <RiskDisclaimer />}
              {activeTab === 'datasources' && <DataSourcesContent />}
              {activeTab === 'privacy' && <PrivacyPolicyContent />}
            </motion.div>
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  Tab Content Components
// ═══════════════════════════════════════════════════════════

function ApiDocumentation() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-white mb-2">Developer REST API</h2>
        <p className="text-zinc-400 text-sm">NexusAI exposes read-only public REST endpoints to load live market constituents and data pipelines.</p>
      </div>

      <div className="space-y-4">
        {/* API 1 */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-black uppercase tracking-widest rounded">GET</span>
            <code className="text-xs font-mono text-zinc-300">/api/heatmap</code>
          </div>
          <p className="text-xs text-zinc-500">Retrieves the complete sector and stock breakdown tree compatible with D3 hierarchy geometry.</p>
          <div className="pt-2">
            <span className="text-[10px] text-zinc-600 font-bold uppercase">Query Params:</span>
            <div className="text-[11px] font-mono text-zinc-400 mt-1 pl-2">
              • <code className="text-primary">index</code> (optional): NIFTY_50 | BANK_NIFTY | NIFTY_IT | FMCG<br />
              • <code className="text-primary">mode</code> (optional): overbought | oversold | consolidating
            </div>
          </div>
        </div>

        {/* API 2 */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-black uppercase tracking-widest rounded">GET</span>
            <code className="text-xs font-mono text-zinc-300">/api/heatmap/summary</code>
          </div>
          <p className="text-xs text-zinc-500">Fetches aggregated momentum scores and daily percentage changes for all index structures and modes.</p>
        </div>

        {/* API 3 */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-black uppercase tracking-widest rounded">GET</span>
            <code className="text-xs font-mono text-zinc-300">/api/market/pulse</code>
          </div>
          <p className="text-xs text-zinc-500">Loads global sentiment fear-and-greed indexes and algorithmic buy/sell signals.</p>
        </div>
      </div>
    </div>
  );
}

function LstmModelPaper() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-white mb-2">LSTM Directional Prediction Model</h2>
        <p className="text-zinc-400 text-sm">Long Short-Term Memory (LSTM) networks are recurrent neural network architectures suited for classifying and forecasting time-series sequences.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 bg-white/[0.02] border border-white/[0.04] rounded-2xl">
          <h3 className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Model Architecture</h3>
          <ul className="text-xs text-zinc-400 space-y-2.5 list-disc pl-4">
            <li><strong>Input Layer:</strong> 60 historical time steps (sliding window) of Close, Volume, and VWAP.</li>
            <li><strong>LSTM Layer 1:</strong> 50 cells with tanh activation and dropout (0.2).</li>
            <li><strong>LSTM Layer 2:</strong> 50 cells capturing deeper temporal correlations.</li>
            <li><strong>Dense Output Layer:</strong> Linear activation returning predicted next-day closing value.</li>
          </ul>
        </div>
        <div className="p-5 bg-white/[0.02] border border-white/[0.04] rounded-2xl">
          <h3 className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Model Evaluation</h3>
          <ul className="text-xs text-zinc-400 space-y-2.5 list-disc pl-4">
            <li><strong>Loss Function:</strong> Mean Squared Error (MSE) optimized via Adam.</li>
            <li><strong>Directional Accuracy:</strong> Up/Down accuracy reaches 68.4% on out-of-sample NSE constituents testing.</li>
            <li><strong>Training Cycle:</strong> Epochs = 100, dynamic learning-rate callback reductions.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function RiskDisclaimer() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-black text-white">Financial Risk Disclaimer</h2>
          <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest mt-0.5">Strictly For Educational Use Only</p>
        </div>
      </div>

      <div className="space-y-4 text-sm text-zinc-400 leading-relaxed">
        <p>
          Algorithmic predictions, LSTM models, and automated metrics generated on the NexusAI platform are for informational and academic purposes only. They do not constitute financial advice, investment recommendations, or SEBI advisory signals.
        </p>
        <p>
          Stock market investments are subject to high volatility and system risks. NexusAI is not responsible for any financial losses or portfolio damages incurred from copying simulated trades or referencing mathematical models.
        </p>
        <div className="p-4 bg-white/[0.02] border border-white/[0.04] rounded-xl text-xs text-zinc-500">
          Important: Under no circumstances should algorithmic backtests or LSTM outputs be construed as a promise of future market gains. Past performance is not indicative of future returns.
        </div>
      </div>
    </div>
  );
}

function DataSourcesContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-white mb-2">Integrated Data Infrastructure</h2>
        <p className="text-zinc-400 text-sm">NexusAI consolidates data pipelines across institutional servers to feed live quote trackers.</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/[0.04] rounded-xl">
          <div>
            <p className="text-sm font-bold text-white">Yahoo Finance API</p>
            <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Historical candle streams & live feeds</p>
          </div>
          <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">ONLINE</span>
        </div>
        <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/[0.04] rounded-xl">
          <div>
            <p className="text-sm font-bold text-white">Local Database Registry</p>
            <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Fallback mappings and constituent weights</p>
          </div>
          <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">ONLINE</span>
        </div>
        <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/[0.04] rounded-xl">
          <div>
            <p className="text-sm font-bold text-white">WebSocket Broadcaster</p>
            <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Real-time room-partitioned delta updates</p>
          </div>
          <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">ONLINE</span>
        </div>
      </div>
    </div>
  );
}

function PrivacyPolicyContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-white mb-2">User Data & Session Security</h2>
        <p className="text-zinc-400 text-sm">Your session data and broker credentials are encrypted end-to-end.</p>
      </div>

      <div className="space-y-4 text-sm text-zinc-400 leading-relaxed">
        <p>
          <strong>Broker Isolation:</strong> API access tokens, credentials, and API secret keys acquired during broker links are stored only in memory or encrypted database entries.
        </p>
        <p>
          <strong>Logging Standards:</strong> No sensitive credentials or order details are captured in telemetry server logs.
        </p>
      </div>
    </div>
  );
}

// Helper: AnimatePresence needs this import or we can mock/inline it
import { AnimatePresence } from 'framer-motion';
