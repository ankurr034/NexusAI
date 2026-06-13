import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useToast } from '../components/Toast';
import {
  UserPlus, User, Mail, Lock, UserCircle, ArrowRight, ShieldCheck,
  CreditCard, Building2, Smartphone, CheckCircle2, AlertCircle,
  RefreshCw, ChevronLeft, Eye, EyeOff, AtSign, Fingerprint
} from 'lucide-react';
import GoogleSignInButton from '../components/GoogleSignInButton';

export default function Register() {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    pan: '',
    aadhaar: '',
    bank_name: '',
    bank_acc_no: '',
    bank_ifsc: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const { register } = useUser();
  const navigate = useNavigate();
  const toast = useToast();

  const updateField = (name, val) => {
    setFormData({ ...formData, [name]: val });
    if (errors[name]) {
      setErrors({ ...errors, [name]: null });
    }
  };

  // Password strength calculator
  const passwordStrength = useMemo(() => {
    const p = formData.password;
    if (!p) return { score: 0, label: '', color: '' };
    let score = 0;
    if (p.length >= 8) score++;
    if (p.length >= 12) score++;
    if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++;
    if (/\d/.test(p)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(p)) score++;

    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'];
    const colors = ['', '#ef4444', '#f59e0b', '#eab308', '#22c55e', '#00d09c'];
    return { score, label: labels[score] || 'Weak', color: colors[score] || '#ef4444' };
  }, [formData.password]);

  // Validate email format
  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // Validate PAN format
  const isValidPAN = (pan) => /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan.toUpperCase());

  // Validate step before proceeding
  const validateStep = (stepIndex) => {
    const newErrors = {};

    if (stepIndex === 0) {
      if (!formData.full_name.trim()) newErrors.full_name = 'Full name is required';
      if (!formData.username.trim()) newErrors.username = 'Username is required';
      else if (formData.username.length < 3) newErrors.username = 'Username must be at least 3 characters';
      if (!formData.email.trim()) newErrors.email = 'Email is required';
      else if (!isValidEmail(formData.email)) newErrors.email = 'Invalid email format';
      if (!formData.password) newErrors.password = 'Password is required';
      else if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
      if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    }

    if (stepIndex === 1) {
      if (formData.pan && !isValidPAN(formData.pan)) newErrors.pan = 'Invalid PAN format (e.g. ABCDE1234F)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    if (validateStep(step)) {
      setStep(prev => prev + 1);
    }
  };

  const handlePrevStep = () => setStep(prev => prev - 1);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    const { confirmPassword, ...submitData } = formData;
    const result = await register(submitData);
    setLoading(false);

    if (result.success) {
      toast.success('Account created! Welcome to NexusAI.');
      navigate('/login');
    } else {
      toast.error(result.error);
    }
  };

  const stepsMetadata = [
    { title: 'Account Creation', sub: 'Identity & Security', icon: <UserPlus size={18} /> },
    { title: 'PAN Verification', sub: 'Legal Identity', icon: <CreditCard size={18} /> },
    { title: 'DigiLocker Sync', sub: 'National ID', icon: <Fingerprint size={18} /> },
    { title: 'Bank Linkage', sub: 'Settlement Setup', icon: <Building2 size={18} /> }
  ];

  const InputError = ({ error }) => error ? (
    <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="text-[10px] text-red-400 font-bold mt-1.5 ml-1 flex items-center gap-1">
      <AlertCircle size={10} /> {error}
    </motion.p>
  ) : null;

  return (
    <div className="flex items-center justify-center min-h-[85vh] py-10 relative overflow-hidden">
      <div className="fixed top-0 right-0 w-[800px] h-[800px] bg-primary/[0.03] rounded-full blur-[200px] -z-10 pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-[600px] h-[600px] bg-secondary/[0.03] rounded-full blur-[150px] -z-10 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl"
      >
        <div className="glass-card p-8 md:p-10 relative overflow-hidden">
          {/* Decorative glow */}
          <div className="absolute -top-16 -right-16 w-40 h-40 bg-primary/10 blur-[60px] rounded-full pointer-events-none" />

          {/* Step Indicator */}
          <div className="flex items-center gap-2 mb-10 overflow-x-auto no-scrollbar pb-2">
            {stepsMetadata.map((m, idx) => (
              <div key={idx} className="flex-1 min-w-[60px] flex items-center gap-2">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black transition-all duration-300 ${
                  idx < step ? 'bg-primary text-black shadow-lg shadow-primary/20' :
                  idx === step ? 'bg-primary/20 text-primary border border-primary/30' :
                  'bg-white/[0.04] text-zinc-600 border border-white/[0.06]'
                }`}>
                  {idx < step ? <CheckCircle2 size={14} /> : m.icon}
                </div>
                {idx < 3 && <div className={`flex-1 h-px transition-all duration-500 ${idx < step ? 'bg-primary' : 'bg-white/[0.06]'}`} />}
              </div>
            ))}
          </div>

          <div className="mb-8">
            <h2 className="text-2xl md:text-3xl font-black text-white leading-tight">{stepsMetadata[step].title}</h2>
            <p className="text-zinc-600 text-[10px] font-black uppercase tracking-[0.2em] mt-1.5">{stepsMetadata[step].sub}</p>
          </div>

          <AnimatePresence mode="wait">
            {/* STEP 0: Account Basics */}
            {step === 0 && (
              <motion.form
                key="s0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleNextStep(); }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">Full Name</label>
                    <div className="relative">
                      <UserCircle className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                      <input
                        type="text" id="reg-fullname" value={formData.full_name}
                        onChange={(e) => updateField('full_name', e.target.value)}
                        className={`w-full bg-white/[0.03] border ${errors.full_name ? 'border-red-500/50' : 'border-white/[0.08]'} rounded-xl py-3 pl-11 pr-4 text-white focus:border-primary/50 outline-none transition-all placeholder:text-zinc-700 text-sm`}
                        placeholder="John Doe"
                      />
                    </div>
                    <InputError error={errors.full_name} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">Username</label>
                    <div className="relative">
                      <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                      <input
                        type="text" id="reg-username" value={formData.username}
                        onChange={(e) => updateField('username', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                        className={`w-full bg-white/[0.03] border ${errors.username ? 'border-red-500/50' : 'border-white/[0.08]'} rounded-xl py-3 pl-11 pr-4 text-white focus:border-primary/50 outline-none transition-all placeholder:text-zinc-700 text-sm`}
                        placeholder="johndoe123"
                      />
                    </div>
                    <InputError error={errors.username} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                    <input
                      type="email" id="reg-email" value={formData.email}
                      onChange={(e) => updateField('email', e.target.value)}
                      className={`w-full bg-white/[0.03] border ${errors.email ? 'border-red-500/50' : 'border-white/[0.08]'} rounded-xl py-3 pl-11 pr-4 text-white focus:border-primary/50 outline-none transition-all placeholder:text-zinc-700 text-sm`}
                      placeholder="john@example.com"
                    />
                  </div>
                  <InputError error={errors.email} />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                    <input
                      type={showPassword ? 'text' : 'password'} id="reg-password" value={formData.password}
                      onChange={(e) => updateField('password', e.target.value)}
                      className={`w-full bg-white/[0.03] border ${errors.password ? 'border-red-500/50' : 'border-white/[0.08]'} rounded-xl py-3 pl-11 pr-12 text-white focus:border-primary/50 outline-none transition-all placeholder:text-zinc-700 text-sm`}
                      placeholder="Min 6 characters"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors">
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {formData.password && (
                    <div className="flex items-center gap-2 mt-2 ml-1">
                      <div className="flex gap-1 flex-1">
                        {[1,2,3,4,5].map(i => (
                          <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
                            style={{ backgroundColor: i <= passwordStrength.score ? passwordStrength.color : 'rgba(255,255,255,0.06)' }} />
                        ))}
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: passwordStrength.color }}>
                        {passwordStrength.label}
                      </span>
                    </div>
                  )}
                  <InputError error={errors.password} />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                    <input
                      type="password" id="reg-confirm-password" value={formData.confirmPassword}
                      onChange={(e) => updateField('confirmPassword', e.target.value)}
                      className={`w-full bg-white/[0.03] border ${errors.confirmPassword ? 'border-red-500/50' : formData.confirmPassword && formData.password === formData.confirmPassword ? 'border-primary/40' : 'border-white/[0.08]'} rounded-xl py-3 pl-11 pr-12 text-white focus:border-primary/50 outline-none transition-all placeholder:text-zinc-700 text-sm`}
                      placeholder="Re-enter password"
                    />
                    {formData.confirmPassword && formData.password === formData.confirmPassword && (
                      <CheckCircle2 size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-primary" />
                    )}
                  </div>
                  <InputError error={errors.confirmPassword} />
                </div>

                <button type="submit" id="reg-next-btn"
                  className="w-full py-4 bg-primary text-black font-black uppercase tracking-widest rounded-xl hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 text-sm mt-2">
                  Continue Setup <ArrowRight className="w-4 h-4" />
                </button>

                {/* Google Signup Integration */}
                {!!import.meta.env.VITE_GOOGLE_CLIENT_ID && (
                  <>
                    <div className="flex items-center my-4">
                      <div className="flex-1 h-px bg-white/[0.06]" />
                      <span className="text-[10px] uppercase tracking-widest text-zinc-600 px-3 font-black">or</span>
                      <div className="flex-1 h-px bg-white/[0.06]" />
                    </div>
                    <GoogleSignInButton
                      label="Sign up with Google"
                      onSuccess={() => navigate('/')}
                    />
                  </>
                )}
              </motion.form>
            )}

            {/* STEP 1: PAN Verification */}
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <div className="p-5 bg-amber-500/[0.04] border border-amber-500/10 rounded-2xl flex gap-4">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                    PAN verification is <span className="text-amber-400 font-bold">optional</span> during signup. You can complete it later from your KYC dashboard.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">Permanent Account Number (PAN)</label>
                  <div className="relative">
                    <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                    <input
                      type="text" maxLength={10} id="reg-pan" value={formData.pan}
                      onChange={(e) => updateField('pan', e.target.value.toUpperCase())}
                      className={`w-full bg-white/[0.03] border ${errors.pan ? 'border-red-500/50' : 'border-white/[0.08]'} rounded-xl py-4 pl-11 pr-4 text-white font-mono-data tracking-[0.3em] focus:border-primary/50 transition-all placeholder:text-zinc-700 text-sm`}
                      placeholder="ABCDE1234F"
                    />
                    {formData.pan.length === 10 && isValidPAN(formData.pan) && (
                      <CheckCircle2 size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-primary" />
                    )}
                  </div>
                  <InputError error={errors.pan} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={handlePrevStep} className="py-3.5 bg-white/[0.03] border border-white/[0.08] text-white font-black uppercase tracking-widest rounded-xl hover:bg-white/[0.06] text-sm transition-all">Back</button>
                  <button onClick={handleNextStep} className="py-3.5 bg-primary text-black font-black uppercase tracking-widest rounded-xl hover:scale-[1.01] text-sm transition-all shadow-lg shadow-primary/20">
                    {formData.pan ? 'Verify PAN' : 'Skip for Now'}
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 2: DigiLocker / Aadhaar */}
            {step === 2 && (
              <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <div className="text-center space-y-4 py-4">
                  <div className="w-16 h-16 bg-blue-500/10 rounded-2xl border border-blue-500/20 flex items-center justify-center mx-auto shadow-[0_0_40px_rgba(59,130,246,0.1)]">
                    <ShieldCheck className="w-8 h-8 text-blue-400" />
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-white">Identity Verification</h4>
                    <p className="text-zinc-500 text-xs mt-1">This step is optional during signup</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-2xl flex items-center gap-4">
                    <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400"><CheckCircle2 size={18} /></div>
                    <div>
                      <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Digital Identity</p>
                      <p className="text-sm font-bold text-white">Aadhaar can be linked later in KYC</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={handlePrevStep} className="py-3.5 bg-white/[0.03] border border-white/[0.08] text-white font-black uppercase tracking-widest rounded-xl hover:bg-white/[0.06] text-sm transition-all">Back</button>
                  <button onClick={handleNextStep} className="py-3.5 bg-primary text-black font-black uppercase tracking-widest rounded-xl hover:scale-[1.01] text-sm transition-all shadow-lg shadow-primary/20">Continue</button>
                </div>
              </motion.div>
            )}

            {/* STEP 3: Bank Link */}
            {step === 3 && (
              <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                <div className="p-4 bg-primary/[0.04] border border-primary/10 rounded-2xl flex gap-3">
                  <AlertCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                    Bank details are <span className="text-primary font-bold">optional</span>. You can add them later for live trading.
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">Bank Name</label>
                    <div className="relative">
                      <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                      <input type="text" id="reg-bank" value={formData.bank_name}
                        onChange={(e) => updateField('bank_name', e.target.value)}
                        className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl py-3 pl-11 pr-4 text-white outline-none text-sm placeholder:text-zinc-700 focus:border-primary/50 transition-all"
                        placeholder="HDFC, ICICI, SBI, etc." />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">Account Number</label>
                    <div className="relative">
                      <Smartphone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                      <input type="text" id="reg-accno" value={formData.bank_acc_no}
                        onChange={(e) => updateField('bank_acc_no', e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl py-3 pl-11 pr-4 text-white font-mono-data outline-none text-sm placeholder:text-zinc-700 focus:border-primary/50 transition-all"
                        placeholder="0000 0000 0000" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-zinc-600 uppercase tracking-widest ml-1">IFSC Code</label>
                    <input type="text" id="reg-ifsc" value={formData.bank_ifsc}
                      onChange={(e) => updateField('bank_ifsc', e.target.value.toUpperCase())}
                      className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl py-3 px-4 text-white font-mono-data outline-none text-sm tracking-widest placeholder:text-zinc-700 focus:border-primary/50 transition-all"
                      placeholder="HDFC0000001" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={handlePrevStep} className="py-3.5 bg-white/[0.03] border border-white/[0.08] text-white font-black uppercase tracking-widest rounded-xl hover:bg-white/[0.06] text-sm transition-all">Back</button>
                  <button onClick={handleSubmit} disabled={loading} id="reg-submit-btn"
                    className="py-3.5 bg-primary text-black font-black uppercase tracking-widest rounded-xl hover:scale-[1.01] text-sm transition-all disabled:opacity-30 flex items-center justify-center gap-2 shadow-lg shadow-primary/20">
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <>Create Account <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-white/[0.04] text-center relative z-10">
            <div className="flex items-center justify-center gap-6 text-[9px] font-bold text-zinc-700 uppercase tracking-widest mb-4">
              <span className="flex items-center gap-1.5"><ShieldCheck size={12} /> ISO 27001</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 size={12} /> SEBI Compliant</span>
            </div>
            <Link to="/login" className="inline-flex items-center gap-2 text-primary font-bold text-xs hover:text-emerald-300 no-underline transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" /> Already have an account? Sign in
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
