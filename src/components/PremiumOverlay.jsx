import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Zap, Crown, Shield, X, RefreshCw } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { useToast } from './Toast';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const loadRazorpay = () => {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function PremiumOverlay() {
  const { user, upgradeToPremium } = useUser();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async (planName, price) => {
    setLoading(true);
    const res = await loadRazorpay();
    if (!res) {
      toast.error('Razorpay SDK failed to load. Are you online?');
      setLoading(false);
      return;
    }

    try {
      // Fetch Razorpay key config
      const configRes = await axios.get(`${API_BASE_URL}/api/premium/config`);
      const rzpKey = configRes.data.key;

      // Create order
      const orderRes = await axios.post(`${API_BASE_URL}/api/premium/create-order`, {
        planId: planName,
        user_id: user?.id || 'mock_web2_user'
      });
      const order = orderRes.data;

      const options = {
        key: rzpKey, // Dynamically loaded key from config
        amount: order.amount,
        currency: order.currency,
        name: 'NexusAI',
        description: `${planName} Subscription`,
        order_id: order.id,
        handler: async function (response) {
          try {
            toast.success('Payment authorized. Verifying...');
            const verifyRes = await axios.post(`${API_BASE_URL}/api/premium/verify`, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              walletAddress: user?.walletAddress || user?.id,
              planId: planName,
              amount: price
            });
            
            if (verifyRes.data.success) {
              toast.success(`Welcome to ${planName}! Unlocking features...`);
              upgradeToPremium(verifyRes.data.plan, verifyRes.data.expiry);
            }
          } catch (e) {
            toast.error('Payment verification failed.');
            console.error(e);
          }
        },
        prefill: {
          name: user?.username || 'User',
          email: user?.email || 'user@nexus.ai',
          contact: '9999999999'
        },
        theme: {
          color: '#3b82f6'
        }
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();
    } catch (err) {
      console.error(err);
      toast.error('Failed to initiate payment.');
    } finally {
      setLoading(false);
    }
  };

  const plans = [
    {
      name: 'Free',
      price: '0',
      icon: <Shield className="w-6 h-6 text-zinc-400" />,
      features: ['Basic Analytics', 'Delayed Data', 'Limited AI Prompts'],
      buttonText: 'Current Plan',
      disabled: true,
      color: 'border-white/10'
    },
    {
      name: 'Pro Trader',
      price: '999',
      icon: <Zap className="w-6 h-6 text-blue-400" />,
      features: ['Live Market Data', 'AI Stock Copilot', 'Basic Options Builder', 'Stress Testing'],
      buttonText: 'Upgrade to Pro',
      disabled: false,
      color: 'border-blue-500/50 shadow-[0_0_30px_rgba(59,130,246,0.1)]'
    },
    {
      name: 'Elite AI',
      price: '2499',
      icon: <Crown className="w-6 h-6 text-amber-400" />,
      features: ['Everything in Pro', 'HFT Microstructure', 'Smart Money Flow', 'Sentiment Radar', 'Trading DNA'],
      buttonText: 'Get Elite Access',
      disabled: false,
      color: 'border-amber-500/50 shadow-[0_0_30px_rgba(245,158,11,0.15)] bg-gradient-to-b from-amber-500/5 to-transparent'
    }
  ];

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-6 bg-black/60 backdrop-blur-md rounded-2xl overflow-y-auto min-h-[80vh]">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-4xl w-full"
      >
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-400/20 to-orange-500/20 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto mb-6 shadow-xl shadow-amber-500/10">
          <Crown className="w-10 h-10" />
        </div>
        <h2 className="text-4xl font-black text-white mb-4">Upgrade to Unlock</h2>
        <p className="text-lg text-zinc-400 mb-12 max-w-2xl mx-auto">
          Get institutional-grade trading tools, live order-book analytics, and AI-powered predictive insights to dominate the markets.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div key={plan.name} className={`relative flex flex-col p-6 rounded-2xl border bg-[#0f172a] ${plan.color}`}>
              {plan.name === 'Elite AI' && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-amber-400 to-orange-500 text-black text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg">
                  Most Popular
                </div>
              )}
              
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                  {plan.icon}
                </div>
                <h3 className="text-xl font-bold text-white">{plan.name}</h3>
              </div>
              
              <div className="mb-6 text-left">
                <div className="flex items-end gap-1">
                  <span className="text-3xl font-black text-white">₹{plan.price}</span>
                  <span className="text-sm text-zinc-500 font-medium pb-1">/year</span>
                </div>
              </div>

              <div className="space-y-4 mb-8 flex-1">
                {plan.features.map((feat, i) => (
                  <div key={i} className="flex items-start gap-3 text-left">
                    <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-sm text-zinc-300 font-medium">{feat}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => handleUpgrade(plan.name, plan.price)}
                disabled={plan.disabled || loading}
                className={`w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                  plan.disabled 
                    ? 'bg-white/5 text-zinc-500 cursor-not-allowed' 
                    : plan.name === 'Elite AI'
                      ? 'bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-black shadow-lg shadow-orange-500/25'
                      : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                }`}
              >
                {loading && !plan.disabled ? <RefreshCw className="w-5 h-5 animate-spin" /> : plan.buttonText}
              </button>
            </div>
          ))}
        </div>
        
        <p className="text-xs text-zinc-500 mt-8 font-medium">
          Payments are securely processed by Razorpay. Cancel anytime.
        </p>
      </motion.div>
    </div>
  );
}
