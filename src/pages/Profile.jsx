import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Phone, Calendar, Shield, Award, TrendingUp, History, Settings, LogOut, ChevronRight, Activity, Zap, ShieldCheck, CheckCircle2, CreditCard, Building2, MapPin, AlertCircle, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useUser } from '../context/UserContext';
import { useToast } from '../components/Toast';
import { API_BASE_URL } from '../config';
import BillingTab from '../components/BillingTab';
import { getDisplayName, getAvatarInitials, shortenWallet } from '../utils/identity';

export default function Profile() {
  const { user, profile: contextProfile, logout, refreshUser } = useUser();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  const handleCopyWallet = () => {
    if (user?.walletAddress) {
      navigator.clipboard.writeText(user.walletAddress);
      setCopied(true);
      toast.success('Wallet address copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      try {
        const res = await axios.get(`${API_BASE_URL}/api/auth/me?user_id=${user.id}`);
        setProfileData(res.data);
      } catch (e) {
        console.error("Failed to fetch profile", e);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  if (loading || !profileData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4 text-zinc-500 animate-pulse">
            <div className="w-12 h-12 rounded-full border-t-2 border-primary animate-spin" />
            <div className="text-[10px] font-bold uppercase tracking-widest">Loading Artificial Intelligence Profile...</div>
        </div>
      </div>
    );
  }

  const { user: userDetails, profile: kycDetails } = profileData;
  const isKycVerified = userDetails.kyc_status === 'VERIFIED';

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto space-y-8 pb-20">
      {/* Header Profile Section */}
      <div className="relative rounded-2xl sm:rounded-3xl lg:rounded-[40px] overflow-hidden border border-white/[0.06] bg-[#060b18] p-5 sm:p-8 md:p-12 shadow-2xl">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/[0.04] rounded-full blur-[150px] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col items-center md:flex-row md:items-center gap-8 sm:gap-12">
          <div className="relative group">
            <div className="w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 rounded-2xl sm:rounded-3xl md:rounded-[48px] bg-gradient-to-br from-primary to-secondary p-1 rotate-3 group-hover:rotate-0 transition-transform duration-700 shadow-2xl">
              <div className="w-full h-full bg-[#060b18] rounded-2xl sm:rounded-3xl md:rounded-[44px] flex items-center justify-center p-2 sm:p-3">
                <div className="w-full h-full bg-zinc-900/50 rounded-xl sm:rounded-2xl md:rounded-[38px] flex items-center justify-center overflow-hidden">
                   {userDetails.avatar_url ? (
                     <img src={userDetails.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                   ) : (
                     <span className="text-4xl sm:text-5xl md:text-6xl font-black text-primary/80 uppercase tracking-tighter">
                       {getAvatarInitials(userDetails)}
                     </span>
                   )}
                </div>
              </div>
            </div>
            {isKycVerified && (
              <div className="absolute -bottom-2 -right-2 bg-emerald-500 w-10 h-10 rounded-2xl border-4 border-[#060b18] shadow-lg flex items-center justify-center">
                 <ShieldCheck className="w-6 h-6 text-white" />
              </div>
            )}
          </div>

          <div className="text-center md:text-left space-y-6 flex-1">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                <h1 className="text-4xl font-black text-white tracking-tight">{getDisplayName(userDetails)}</h1>
                <div className={`px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 ${isKycVerified ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-500'}`}>
                   {isKycVerified ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                   {userDetails.kyc_status}
                </div>
              </div>
              <p className="text-zinc-500 font-bold uppercase tracking-[0.3em] text-[11px]">{userDetails.account_type || 'Retail'} Trading Member • ID: {userDetails.id?.toString().padStart(6, '0') || 'N/A'}</p>
            </div>

            <div className="flex flex-wrap justify-center md:justify-start gap-3">
              {(userDetails.email || userDetails.phone) ? (
                <>
                  {userDetails.email && (
                    <div className="flex items-center gap-3 px-5 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-2xl group hover:bg-white/[0.06] transition-all">
                      <Mail className="w-4 h-4 text-zinc-500 group-hover:text-primary transition-colors" />
                      <span className="text-sm font-bold text-zinc-300">{userDetails.email}</span>
                    </div>
                  )}
                  {userDetails.phone && (
                    <div className="flex items-center gap-3 px-5 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-2xl group hover:bg-white/[0.06] transition-all">
                      <Phone className="w-4 h-4 text-zinc-500 group-hover:text-primary transition-colors" />
                      <span className="text-sm font-bold text-zinc-300">{userDetails.phone}</span>
                    </div>
                  )}
                </>
              ) : userDetails.walletAddress ? (
                <button 
                  onClick={handleCopyWallet}
                  className="flex items-center gap-3 px-5 py-2.5 bg-primary/10 border border-primary/20 rounded-2xl group hover:bg-primary/20 transition-all text-primary"
                >
                  <Activity className="w-4 h-4 text-primary group-hover:animate-pulse" />
                  <span className="text-sm font-bold font-mono-data tracking-wider">
                    Connected: {shortenWallet(userDetails.walletAddress)}
                  </span>
                  {copied ? <CheckCircle2 className="w-4 h-4 ml-1" /> : <ChevronRight className="w-4 h-4 opacity-50 ml-1 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />}
                </button>
              ) : null}
              
              <div className="flex items-center gap-3 px-5 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-2xl">
                <Calendar className="w-4 h-4 text-zinc-600" />
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                  Joined {userDetails.created_at ? new Date(userDetails.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : 'Recently'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-4 border-b border-white/[0.06] mb-8 pb-4">
        <button 
          onClick={() => setActiveTab('overview')} 
          className={`px-4 py-2 text-sm font-bold uppercase tracking-widest rounded-xl transition-all ${activeTab === 'overview' ? 'bg-primary/10 text-primary border border-primary/20' : 'text-zinc-500 hover:text-white'}`}
        >
          Overview
        </button>
        <button 
          onClick={() => setActiveTab('billing')} 
          className={`px-4 py-2 text-sm font-bold uppercase tracking-widest rounded-xl transition-all ${activeTab === 'billing' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'text-zinc-500 hover:text-white'}`}
        >
          Billing & Subscription
        </button>
      </div>

      {activeTab === 'overview' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-8">
         <div className="lg:col-span-2 space-y-8">
            <div className="glass-panel p-10 relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full blur-[60px] group-hover:bg-primary/10 transition-all" />
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 pb-6 border-b border-white/[0.06]">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <CreditCard className="w-6 h-6 text-primary" />
                     </div>
                     <div>
                        <h3 className="text-xl font-black text-white">Identity Matrix</h3>
                        <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mt-1">Verified Government Credentials</p>
                     </div>
                  </div>
                  {isKycVerified && (
                     <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">KYC COMPLIANT</span>
                     </div>
                  )}
               </div>

                {!isKycVerified && (
                  <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-8 bg-amber-500/5 border border-amber-500/10 rounded-[32px] mb-10">
                    <div className="flex items-center gap-4 text-amber-500">
                      <AlertCircle className="w-8 h-8" />
                      <div>
                        <h4 className="text-lg font-black uppercase tracking-widest text-white">KYC Required</h4>
                        <p className="text-xs font-bold text-amber-500/80 uppercase tracking-widest mt-1">Unlock live trading & payouts</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => navigate('/kyc')}
                      className="px-8 py-3.5 bg-amber-500 text-black font-black uppercase tracking-widest rounded-2xl hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20"
                    >
                      Complete Verification Now
                    </button>
                  </div>
                )}

               <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-8">
                  <div className="p-6 bg-white/[0.02] border border-white/[0.04] rounded-3xl space-y-4">
                     <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Primary Tax ID (PAN)</span>
                        {kycDetails.pan && <CheckCircle2 size={12} className="text-emerald-500" />}
                     </div>
                     <p className="text-2xl font-black text-white font-mono-data tracking-[0.2em]">{kycDetails.pan || 'UNAVAILABLE'}</p>
                     <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-600">
                        <Shield size={12} /> SECURED STORAGE
                     </div>
                  </div>

                  <div className="p-6 bg-white/[0.02] border border-white/[0.04] rounded-3xl space-y-4">
                     <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">National ID (Aadhaar)</span>
                        {kycDetails.aadhaar && <CheckCircle2 size={12} className="text-emerald-500" />}
                     </div>
                     <p className="text-2xl font-black text-white font-mono-data tracking-[0.2em]">{kycDetails.aadhaar ? `•••• •••• ${kycDetails.aadhaar.slice(-4)}` : 'UNAVAILABLE'}</p>
                     <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-600">
                        <Lock size={12} /> DIGILOCKER SYNCED
                     </div>
                  </div>
               </div>
            </div>

            <div className="glass-panel p-10 relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-40 h-40 bg-secondary/5 rounded-full blur-[60px] group-hover:bg-secondary/10 transition-all" />
               <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-secondary/10 border border-secondary/20 flex items-center justify-center">
                     <Building2 className="w-6 h-6 text-secondary" />
                  </div>
                  <div>
                     <h3 className="text-xl font-black text-white">Fiscal Connectivity</h3>
                     <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mt-1">Linked Bank Primary Node</p>
                  </div>
               </div>

               <div className="p-5 sm:p-8 bg-gradient-to-br from-white/[0.03] to-white/[0.01] border border-white/[0.08] rounded-2xl sm:rounded-[32px] flex flex-col sm:flex-row items-center gap-5 sm:gap-8">
                  <div className="w-20 h-20 bg-secondary text-black rounded-3xl flex items-center justify-center font-black text-3xl shadow-xl shadow-secondary/20 shrink-0">
                     {kycDetails.bank_name?.charAt(0) || 'B'}
                  </div>
                  <div className="flex-1 space-y-4 text-center md:text-left">
                     <div>
                        <h4 className="text-2xl font-black text-white">{kycDetails.bank_name || 'No Bank Linked'}</h4>
                        <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] mt-1">IFSC: {kycDetails.bank_ifsc || 'XXXX0000000'}</p>
                     </div>
                     <div className="flex items-center justify-center md:justify-start gap-4">
                        <div className="flex flex-col">
                           <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Account Type</span>
                           <span className="text-sm font-bold text-zinc-400">SAVINGS</span>
                        </div>
                        <div className="w-px h-6 bg-white/[0.08]" />
                        <div className="flex flex-col">
                           <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Account Number</span>
                           <span className="text-sm font-bold text-zinc-400 font-mono-data tracking-widest">•••• •••• {kycDetails.bank_acc_no?.slice(-4) || '0000'}</span>
                        </div>
                     </div>
                  </div>
                  <button className="px-6 py-3 bg-secondary/10 border border-secondary/20 text-secondary text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-secondary hover:text-black transition-all">Change Mode</button>
               </div>
            </div>
         </div>

         <div className="space-y-6">
            <div className="glass-panel p-8 space-y-6">
               <h3 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
                  <Activity size={16} /> Strategy Matrix
               </h3>
               {[
                  { label: 'Risk Profile', val: 'Aggressive', color: 'text-amber-400' },
                  { label: 'Market Segment', val: 'FnO Active', color: 'text-emerald-400' },
                  { label: 'Broker Status', val: 'Connected', color: 'text-primary' },
                  { label: 'Payout Cycle', val: 'Quarterly', color: 'text-zinc-400' }
               ].map((item, i) => (
                  <div key={i} className="flex justify-between items-center py-4 border-b border-white/[0.04] last:border-0">
                     <span className="text-xs font-bold text-zinc-500">{item.label}</span>
                     <span className={`text-xs font-black uppercase tracking-widest ${item.color}`}>{item.val}</span>
                  </div>
               ))}
            </div>

            <div className="glass-panel p-8 bg-gradient-to-br from-primary/10 to-transparent border-primary/20 relative overflow-hidden group">
               <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-primary/20 rounded-full blur-[40px] group-hover:scale-125 transition-transform" />
               <Zap className="w-8 h-8 text-primary mb-4" />
               <h4 className="text-lg font-black text-white">Upgrade to Pro+</h4>
               <p className="text-xs text-zinc-500 mt-2 leading-relaxed mb-6">Unlock deep-learning portfolio rebalancing and multi-broker routing.</p>
               <button className="w-full py-3.5 bg-primary text-black font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-emerald-400 transition-all shadow-lg shadow-primary/20">Analyze ROI</button>
            </div>

            <button onClick={logout} className="w-full py-4 bg-rose-500/5 border border-rose-500/10 text-rose-500 font-black text-xs uppercase tracking-widest rounded-3xl hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center gap-3">
               <LogOut size={16} /> Terminate Session
            </button>
         </div>
      </div>
      ) : (
        <BillingTab />
      )}
    </motion.div>
  );
}
