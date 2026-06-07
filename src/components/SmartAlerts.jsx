import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, TrendingUp, TrendingDown, Zap, AlertTriangle, X } from 'lucide-react';
import useSocket from '../hooks/useSocket';

export default function SmartAlerts() {
  const { data: alertData } = useSocket('smart_alert');
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    if (alertData) {
      const newAlert = { ...alertData, id: Date.now() };
      setAlerts(prev => [newAlert, ...prev].slice(0, 5));
      setTimeout(() => {
        setAlerts(prev => prev.filter(a => a.id !== newAlert.id));
      }, 8000);
    }
  }, [alertData]);

  const removeAlert = (id) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none w-80">
      <AnimatePresence>
        {alerts.map(alert => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className={`pointer-events-auto p-4 rounded-xl border shadow-2xl relative overflow-hidden group
              ${alert.type === 'buy' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 
                alert.type === 'sell' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 
                'bg-amber-500/10 border-amber-500/20 text-amber-400'}
            `}
          >
            <div className={`absolute top-0 left-0 w-1 h-full ${alert.type === 'buy' ? 'bg-emerald-500' : alert.type === 'sell' ? 'bg-red-500' : 'bg-amber-500'}`} />
            
            <button onClick={() => removeAlert(alert.id)} className="absolute top-2 right-2 p-1 text-white/50 hover:text-white transition-colors">
              <X className="w-3 h-3" />
            </button>

            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                {alert.type === 'buy' ? <TrendingUp className="w-5 h-5" /> : 
                 alert.type === 'sell' ? <TrendingDown className="w-5 h-5" /> : 
                 <Zap className="w-5 h-5" />}
              </div>
              <div>
                <h4 className="text-[11px] font-black uppercase tracking-widest text-white/80 mb-1 flex items-center gap-1.5">
                  <Bell className="w-3 h-3" /> {alert.title}
                </h4>
                <p className="text-sm font-medium text-white leading-snug">{alert.message}</p>
                <div className="mt-2 text-[10px] font-mono-data opacity-60">
                  {new Date().toLocaleTimeString('en-US', { hour12: false })}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
