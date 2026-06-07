import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, Download, Zap, XCircle, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useUser } from '../context/UserContext';
import { useToast } from './Toast';

export default function BillingTab() {
  const { user } = useUser();
  const toast = useToast();
  const [billingData, setBillingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchBillingData();
  }, [user]);

  const fetchBillingData = async () => {
    if (!user) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/api/premium/billing-history?user_id=${user.id}`);
      setBillingData(res.data);
    } catch (err) {
      console.error('Failed to fetch billing data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm("Are you sure you want to cancel your premium subscription? You will lose access to elite features at the end of your billing cycle.")) return;
    
    setProcessing(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/premium/cancel`, { user_id: user.id });
      if (res.data.success) {
        toast.success(res.data.message);
        fetchBillingData();
      }
    } catch (err) {
      toast.error('Failed to cancel subscription');
    } finally {
      setProcessing(false);
    }
  };

  const handleToggleAutoRenew = async () => {
    setProcessing(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/premium/toggle-autorenew`, { user_id: user.id });
      if (res.data.success) {
        toast.success(`Auto-renew is now ${res.data.auto_renew ? 'enabled' : 'disabled'}`);
        fetchBillingData();
      }
    } catch (err) {
      toast.error('Failed to toggle auto-renew');
    } finally {
      setProcessing(false);
    }
  };

  if (loading || !billingData) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const { plan, isPremium, expiry, auto_renew, history } = billingData;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      {/* Current Subscription Card */}
      <div className="glass-panel p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] pointer-events-none" />
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div>
            <h3 className="text-xl font-black text-white mb-2 flex items-center gap-2">
              <Zap className="text-amber-400 w-6 h-6" />
              Current Plan: {plan}
            </h3>
            {isPremium ? (
              <p className="text-zinc-400 text-sm">
                Your subscription is active until <strong className="text-white">{new Date(expiry).toLocaleDateString()}</strong>.
              </p>
            ) : (
              <p className="text-zinc-400 text-sm">You are currently on the Free plan.</p>
            )}
          </div>
          
          {isPremium && (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
                <span className="text-xs font-bold text-zinc-300">Auto-Renew</span>
                <button 
                  onClick={handleToggleAutoRenew}
                  disabled={processing}
                  className={`w-12 h-6 rounded-full p-1 transition-colors ${auto_renew ? 'bg-emerald-500' : 'bg-zinc-600'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full transition-transform ${auto_renew ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
              <button 
                onClick={handleCancel}
                disabled={processing || !auto_renew}
                className="flex items-center gap-2 px-4 py-2 border border-rose-500/20 text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl transition-all disabled:opacity-50 text-sm font-bold"
              >
                <XCircle className="w-4 h-4" /> Cancel Plan
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Billing History Table */}
      <div className="glass-panel overflow-hidden">
        <div className="p-6 border-b border-white/[0.06] flex items-center gap-3">
          <CreditCard className="w-5 h-5 text-zinc-400" />
          <h3 className="text-lg font-bold text-white">Payment History & Invoices</h3>
        </div>
        
        {history && history.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-400">
              <thead className="bg-white/[0.02] border-b border-white/[0.06] text-xs uppercase tracking-widest font-black text-zinc-500">
                <tr>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Plan / Description</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Invoice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {history.map((tx, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.01] transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-zinc-300">{new Date(tx.date).toLocaleDateString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-white font-bold">{tx.plan || 'Subscription Upgrade'}</td>
                    <td className="px-6 py-4 whitespace-nowrap font-mono">₹{tx.amount?.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {tx.status === 'Success' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><CheckCircle2 className="w-3 h-3" /> Paid</span>}
                      {tx.status === 'Failed' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-rose-500/10 text-rose-400 border border-rose-500/20"><AlertCircle className="w-3 h-3" /> Failed</span>}
                      {tx.status === 'Refunded' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"><RefreshCw className="w-3 h-3" /> Refunded</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {tx.status === 'Success' ? (
                        <a href={tx.receiptUrl || '#'} onClick={(e) => { e.preventDefault(); toast.success('Downloading Invoice PDF...'); }} className="inline-flex items-center gap-2 text-primary hover:text-white transition-colors font-bold text-xs">
                          <Download className="w-4 h-4" /> PDF
                        </a>
                      ) : (
                        <span className="text-zinc-600">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-zinc-500 flex flex-col items-center">
            <CreditCard className="w-12 h-12 mb-4 opacity-20" />
            <p>No billing history available.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
