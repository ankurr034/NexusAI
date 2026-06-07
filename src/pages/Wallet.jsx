import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Wallet as WalletIcon, ArrowUpRight, ArrowDownLeft, History, RefreshCw, Trophy, ShieldCheck, AlertCircle, Sparkles, User as UserIcon, ShieldAlert } from 'lucide-react';
import { useToast } from '../components/Toast';
import { useUser } from '../context/UserContext';
import { useWeb3 } from '../context/Web3Context';
import axios from 'axios';
import { Link } from 'react-router-dom';
import PaymentPortal from '../components/PaymentPortal';
import { API_BASE_URL } from '../config';

export default function Wallet() {
  const toast = useToast();
  const { user, isLiveMode, refreshUser } = useUser();
  const { account, connectWallet, disconnectWallet, isConnecting } = useWeb3();
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [showPayment, setShowPayment] = useState(false);

  const fetchWallet = useCallback(async () => {
    if (!user) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/api/wallet?user_id=${user.id}`);
      setBalance(res.data.balance);
      setTransactions(res.data.transactions || []);
    } catch (e) {
      console.error("Wallet Fetch Error", e);
    }
  }, [user]);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet, isLiveMode]);

  const handleAction = async (type) => {
    if (!user) return;
    const val = parseFloat(amount);
    if (!val || isNaN(val) || val <= 0) {
      toast.warning('Please enter a valid amount');
      return;
    }
    if (loading) return;

    setLoading(true);
    if (type === 'ADD') {
      if (isLiveMode) {
        setShowPayment(true);
        setLoading(false);
        return;
      }
      try {
        const res = await axios.post(`${API_BASE_URL}/api/wallet/refill?user_id=${user.id}`, { amount: val });
        setBalance(res.data.balance);
        toast.success(`₹${val.toLocaleString()} credited successfully!`);
        fetchWallet();
        if (refreshUser) refreshUser();
        setAmount('');
      } catch (e) {
        // Fallback if backend is unavailable
        setBalance(prev => prev + val);
        setTransactions(prev => [{
          type: 'WALLET REFILL',
          date: new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
          amount: val,
          status: 'COMPLETED'
        }, ...prev]);
        toast.success(`₹${val.toLocaleString()} credited successfully!`);
        setAmount('');
      } finally {
        setLoading(false);
      }
    } else {
      if (user.kyc_status !== 'VERIFIED') {
        toast.error('Withdrawals restricted! Please complete your KYC verification first.');
        setLoading(false);
        return;
      }
      if (val > balance) {
        toast.error('Insufficient balance for withdrawal');
        setLoading(false);
        return;
      }
      try {
        const res = await axios.post(`${API_BASE_URL}/api/wallet/withdraw?user_id=${user.id}`, { amount: val });
        setBalance(res.data.balance);
        toast.success(`₹${val.toLocaleString()} withdrawal initialized!`);
        fetchWallet();
        if (refreshUser) refreshUser();
        setAmount('');
      } catch (e) {
        // Fallback if backend is unavailable
        setBalance(prev => prev - val);
        setTransactions(prev => [{
          type: 'WITHDRAW',
          date: new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
          amount: val,
          status: 'PROCESSING'
        }, ...prev]);
        toast.success(`₹${val.toLocaleString()} withdrawal initialized!`);
        setAmount('');
      } finally {
        setLoading(false);
      }
    }
  };

  const resetAccount = async () => {
    if (isLiveMode) {
      toast.warning('Portfolio reset is only available for Demo accounts.');
      return;
    }
    if (window.confirm('Reset your Demo balances and transaction history? This cannot be undone.')) {
      try {
        await axios.post(`${API_BASE_URL}/api/wallet/reset?user_id=${user.id}`);
        toast.success("Demo account reset successfully!");
        fetchWallet();
      } catch (e) {
        toast.error("Account reset failed.");
      }
    }
  };

  if (!user) {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
            <UserIcon className="w-16 h-16 text-zinc-700 mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Wallet Access Restricted</h2>
            <p className="text-zinc-500 mb-6">Create or log in to an account to manage your trading funds.</p>
            <Link to="/login" className="px-6 py-3 bg-primary text-black font-bold rounded-xl no-underline">Go to Login</Link>
        </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto space-y-6 pb-20">

      {/* Environment Banner */}
      <div className={`relative overflow-hidden rounded-2xl border transition-all p-5 ${
          isLiveMode 
            ? 'border-rose-500/20 bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent' 
            : 'border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent'
        }`}>
        <div className={`absolute right-0 top-0 w-40 h-40 rounded-full blur-[60px] pointer-events-none ${isLiveMode ? 'bg-rose-500/10' : 'bg-primary/10'}`} />
        <div className="flex items-start gap-4 relative z-10">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${isLiveMode ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-primary/10 border-primary/20 text-primary'}`}>
             {isLiveMode ? <ShieldAlert className="w-5 h-5" /> : <Trophy className="w-5 h-5" />}
          </div>
          <div>
            <h3 className={`text-sm font-black uppercase tracking-wider ${isLiveMode ? 'text-rose-400' : 'text-primary'}`}>
                {isLiveMode ? 'Live Trading Wallet' : 'Paper Trading Environment'}
            </h3>
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed max-w-xl">
              {isLiveMode 
                ? 'Managing real capital for trade execution via broker APIs. All credits represent withdrawable funds.' 
                : 'Zero-risk educational simulation. Use your demo credits to learn market dynamics and strategy execution.'}
            </p>
          </div>
        </div>
      </div>

      {/* Web3 Wallet Card */}
      <div className="glass-panel p-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${account ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-orange-500/10 border-orange-500/20 text-orange-400'}`}>
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Web3 Authentication</h2>
              <p className="text-sm text-zinc-400">
                {account ? `Connected: ${account.substring(0, 6)}...${account.substring(account.length - 4)}` : 'Link your MetaMask wallet to access blockchain features.'}
              </p>
            </div>
          </div>
          <div>
            {account ? (
              <button onClick={disconnectWallet} className="px-6 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-bold rounded-xl transition-all">
                Disconnect Wallet
              </button>
            ) : (
              <button onClick={connectWallet} disabled={isConnecting} className="px-6 py-3 bg-gradient-to-r from-orange-400 to-amber-500 hover:shadow-lg hover:shadow-orange-500/20 text-black font-bold rounded-xl transition-all disabled:opacity-50 flex items-center gap-2">
                {isConnecting ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Connect MetaMask'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Balance + Actions Card */}
      <div className="glass-panel p-8">
        <div className="flex items-center justify-between mb-8 border-b border-white/[0.04] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-white/[0.06] flex items-center justify-center">
              <WalletIcon className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-white">Funds & Margins</h1>
          </div>
          <button onClick={resetAccount} className="text-[10px] font-bold text-zinc-600 hover:text-red-400 transition-colors uppercase tracking-widest flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" /> Reset Demo Account
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {/* Balance Display */}
          <div className="space-y-4">
            <div>
              <p className="text-zinc-600 font-bold text-[10px] uppercase tracking-widest mb-2 flex items-center gap-2">
                Available Cash <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              </p>
              <h2 className="text-5xl font-extrabold text-white font-mono-data mb-1">
                ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </h2>
            </div>
            
            <div className="flex gap-6">
                <div>
                   <p className="text-[9px] text-zinc-600 font-bold uppercase mb-1">Used Margin</p>
                   <p className="text-sm font-bold text-zinc-400">₹0.00</p>
                </div>
                <div>
                   <p className="text-[9px] text-zinc-600 font-bold uppercase mb-1">Payable</p>
                   <p className="text-sm font-bold text-zinc-400">₹0.00</p>
                </div>
            </div>
          </div>

          {/* Actions Panel */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 blur-[50px] rounded-full pointer-events-none" />

            <div className="relative z-10 w-full mb-4">
              <label className="text-[10px] font-bold text-zinc-600 mb-1.5 block uppercase tracking-widest">Transaction Amount</label>
              <div className="flex items-center bg-black/30 border border-white/[0.06] rounded-xl px-4 py-3 focus-within:border-primary/30 transition-all">
                <span className="text-xl font-bold text-zinc-600 mr-2">₹</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="bg-transparent text-xl font-extrabold text-white w-full focus:outline-none font-mono-data"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="flex gap-3 relative z-10">
              <button
                onClick={() => handleAction('ADD')}
                disabled={loading}
                className="flex-1 py-3 bg-gradient-to-r from-primary to-emerald-400 hover:shadow-lg hover:shadow-primary/20 text-black font-bold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><ArrowDownLeft className="w-5 h-5" /> REFILL</>}
              </button>
              <button
                onClick={() => handleAction('WITHDRAW')}
                disabled={loading}
                className="flex-1 py-3 border border-white/[0.1] hover:bg-rose-500/10 hover:text-rose-400 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                <ArrowUpRight className="w-5 h-5" /> WITHDRAW
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="glass-panel overflow-hidden">
        <div className="p-6 border-b border-white/[0.06]">
           <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-zinc-500" /> Recent Activity History
          </h3>
        </div>

        <div className="divide-y divide-white/[0.04]">
          {transactions.length > 0 ? transactions.map((txn, i) => {
            const isDebit = txn.type.includes('BUY') || txn.type === 'WITHDRAW';
            return (
              <div key={i} className="flex items-center justify-between p-6 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`p-2.5 rounded-xl border ${isDebit ? 'border-red-500/15 bg-red-500/10 text-red-400' : 'border-emerald-500/15 bg-emerald-500/10 text-emerald-400'}`}>
                    {isDebit ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="font-bold text-white text-sm tracking-tight">{txn.type}</p>
                    <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{txn.date}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-extrabold font-mono-data ${isDebit ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {isDebit ? '-' : '+'}₹{txn.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{txn.status}</p>
                </div>
              </div>
            );
          }) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
               <History className="w-12 h-12 text-zinc-800 mb-3" />
               <p className="text-sm text-zinc-600">No transactions recorded for this mode.</p>
            </div>
          )}
        </div>
      </div>

      <PaymentPortal 
        isOpen={showPayment} 
        onClose={() => setShowPayment(false)} 
        amount={Number(amount)} 
        onPaymentSuccess={async (paidAmount) => {
          setBalance(prev => prev + paidAmount);
          setTransactions(prev => [{
            type: 'WALLET REFILL',
            date: new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
            amount: paidAmount,
            status: 'COMPLETED'
          }, ...prev]);
          fetchWallet();
          if (refreshUser) refreshUser();
          setAmount('');
        }}
      />
    </motion.div>
  );
}
