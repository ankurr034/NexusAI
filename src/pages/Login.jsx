import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { ethers } from 'ethers';
import { useUser } from '../context/UserContext';
import { useToast } from '../components/Toast';
import { API_BASE_URL } from '../config';
import { LogIn, User, Lock, ArrowRight, Eye, EyeOff, Shield, TrendingUp, Zap, ChevronRight } from 'lucide-react';
import GoogleSignInButton from '../components/GoogleSignInButton';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, loginWithWallet } = useUser();
  const navigate = useNavigate();
  const toast = useToast();

  // Restore remembered username
  useEffect(() => {
    const saved = localStorage.getItem('nexus_remembered_user');
    if (saved) {
      setUsername(saved);
      setRememberMe(true);
    }
  }, []);

  const handleWeb3Login = async () => {
    if (typeof window.ethereum === 'undefined') {
      toast.error('MetaMask is not installed. Please install it to continue.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Request account access
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const address = accounts[0];
      const signer = await provider.getSigner();

      // 2. Fetch a nonce from the backend (mocked for frontend demo if backend is offline)
      let nonce = `NexusAI Verification: Sign this message to prove ownership of ${address}. Nonce: ${Date.now()}`;
      try {
        const nonceRes = await axios.post(`${API_BASE_URL}/api/auth/nonce`, { walletAddress: address });
        if (nonceRes.data.nonce) {
          nonce = nonceRes.data.nonce;
        }
      } catch (err) {
        console.warn('Could not fetch nonce from backend, using local nonce for demo mode');
      }

      // 3. Sign the message
      const signature = await signer.signMessage(nonce);

      // 4. Send signature to backend
      let authData = { 
        token: 'mock-web3-jwt-token', 
        user: { walletAddress: address, isPremium: false } 
      };

      try {
        const authRes = await axios.post(`${API_BASE_URL}/api/auth/verify`, {
          walletAddress: address,
          signature,
          message: nonce
        });
        authData = authRes.data;
      } catch (err) {
        console.warn('Backend Web3 auth failed, falling back to demo mode');
      }

      const res = await loginWithWallet(authData.token, authData.user);
      
      if (res.success) {
        toast.success('Wallet connected & signed successfully!');
        navigate('/explore');
      }
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to connect wallet');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    setIsSubmitting(true);

    if (rememberMe) {
      localStorage.setItem('nexus_remembered_user', username);
    } else {
      localStorage.removeItem('nexus_remembered_user');
    }

    const result = await login(username, password);
    setIsSubmitting(false);

    if (result.success) {
      toast.success('Welcome back! Entering your dashboard...');
      navigate('/');
    } else {
      toast.error(result.error);
    }
  };

  const features = [
    { icon: <TrendingUp size={16} />, text: 'AI-Powered Trading' },
    { icon: <Shield size={16} />, text: 'Bank-Grade Security' },
    { icon: <Zap size={16} />, text: 'Real-Time Analytics' },
  ];

  return (
    <div className="flex items-center justify-center min-h-[80vh] py-4 sm:py-8 px-2 sm:px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative"
      >
        {/* Main Card */}
        <div className="glass-card p-5 sm:p-8 md:p-10 relative overflow-hidden">
          {/* Decorative corner glows */}
          <div className="absolute -top-16 -right-16 w-40 h-40 bg-primary/10 blur-[60px] rounded-full pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-secondary/10 blur-[60px] rounded-full pointer-events-none" />

          {/* Header */}
          <div className="mb-8 text-center relative z-10">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: 'spring' }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-5 border border-primary/20 shadow-[0_0_40px_rgba(0,208,156,0.15)]"
            >
              <LogIn size={28} className="text-primary" />
            </motion.div>
            <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-zinc-400">
              Welcome Back
            </h1>
            <p className="text-zinc-500 mt-2 text-sm font-medium">
              Sign in to your NexusAI trading account
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5 relative z-10" id="login-form">
            {/* Username */}
            <div>
              <label htmlFor="login-username" className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 ml-1">
                Username
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600">
                  <User size={16} />
                </span>
                <input
                  id="login-username"
                  type="text"
                  required
                  autoComplete="username"
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl py-3.5 pl-12 pr-4 text-white focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none transition-all placeholder:text-zinc-700 text-sm"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="login-password" className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">
                  Password
                </label>
                <button type="button" className="text-[10px] font-bold text-primary/60 hover:text-primary uppercase tracking-wider transition-colors">
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600">
                  <Lock size={16} />
                </span>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl py-3.5 pl-12 pr-12 text-white focus:border-primary/50 focus:ring-1 focus:ring-primary/20 outline-none transition-all placeholder:text-zinc-700 text-sm"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setRememberMe(!rememberMe)}
                id="remember-me-toggle"
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                  rememberMe
                    ? 'bg-primary border-primary'
                    : 'border-zinc-700 hover:border-zinc-500'
                }`}
              >
                {rememberMe && (
                  <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <label htmlFor="remember-me-toggle" className="text-xs text-zinc-500 font-medium cursor-pointer select-none">
                Remember me on this device
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              id="login-submit-btn"
              className="w-full bg-primary hover:bg-emerald-400 text-black font-black py-4 rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider text-sm hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.01] active:scale-[0.99]"
            >
              <span>{isSubmitting ? 'Authenticating...' : 'Enter Dashboard'}</span>
              {!isSubmitting && <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />}
              {isSubmitting && (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
            </button>

            {/* Google Sign In Integration */}
            {!!import.meta.env.VITE_GOOGLE_CLIENT_ID && (
              <>
                <div className="flex items-center my-4">
                  <div className="flex-1 h-px bg-white/[0.06]" />
                  <span className="text-[10px] uppercase tracking-widest text-zinc-600 px-3 font-black">or</span>
                  <div className="flex-1 h-px bg-white/[0.06]" />
                </div>
                <GoogleSignInButton
                  label="Continue with Google"
                  onSuccess={() => navigate('/')}
                />
              </>
            )}
          </form>

          {/* Divider */}
          <div className="mt-8 pt-6 border-t border-white/[0.05] relative z-10">
            <p className="text-center text-zinc-500 text-sm">
              Don't have an account?{' '}
              <Link
                to="/register"
                id="create-account-link"
                className="text-primary hover:text-emerald-300 font-bold no-underline transition-colors"
              >
                Create Account <ChevronRight size={12} className="inline" />
              </Link>
            </p>
          </div>

          {/* Demo Login Hint */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-6 p-4 bg-primary/[0.04] rounded-2xl border border-primary/10 relative z-10"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[9px] text-primary/70 font-black uppercase tracking-widest">Demo Access</span>
                <div className="text-[11px] text-zinc-500 mt-1 font-mono-data">
                  <span className="text-zinc-400">User:</span> demo &nbsp;|&nbsp; <span className="text-zinc-400">Pass:</span> demo123
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setUsername('demo'); setPassword('demo123'); }}
                className="text-[9px] font-black text-primary/60 hover:text-primary uppercase tracking-widest px-3 py-1.5 rounded-lg bg-primary/[0.05] hover:bg-primary/[0.1] transition-all border border-primary/10"
              >
                Auto-Fill
              </button>
            </div>
          </motion.div>
        </div>

        {/* Feature badges below card */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 mt-4 sm:mt-6">
          {features.map((feat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="flex items-center gap-1.5 text-zinc-600 text-[10px] font-bold uppercase tracking-wider"
            >
              <span className="text-primary/50">{feat.icon}</span>
              {feat.text}
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
