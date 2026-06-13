import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, Bell, User, Activity, Menu, X, ChevronDown, Link as LinkIcon, LogOut, Shield, ShieldAlert, Wallet as WalletIcon, Zap } from 'lucide-react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import axios from 'axios';
import { useUser } from '../context/UserContext';
import { useToast } from './Toast';
import { API_BASE_URL } from '../config';
import { getDisplayName, getAvatarInitials } from '../utils/identity';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, isLiveMode, toggleMode, logout } = useUser();
  const toast = useToast();
  
  const [search, setSearch] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  
  const searchRef = useRef(null);
  const profileRef = useRef(null);
  const notificationRef = useRef(null);

  const [notifications, setNotifications] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/api/notifications?user_id=${user.id}`);
      setNotifications(res.data.notifications);
    } catch (e) {
      console.error(e);
    }
  }, [user]);

  const markNotificationsRead = async () => {
    if (!user) return;
    try {
      await axios.post(`${API_BASE_URL}/api/notifications/read?user_id=${user.id}`);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchNotifications();
      }
    }, 30000); // 30s poll
    return () => clearInterval(interval);
  }, [user, fetchNotifications]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/stock/${search.toUpperCase().trim()}`);
      setSearch('');
      setIsFocused(false);
      searchRef.current?.blur();
    }
  };

  const [switchingMode, setSwitchingMode] = useState(false);
  const handleToggleMode = async () => {
    if (switchingMode) return;
    setSwitchingMode(true);
    const result = await toggleMode();
    if (result && result.success) {
      toast.success(`Switched to ${!isLiveMode ? 'Live Trading' : 'Demo Mode'} successfully`);
    } else {
      toast.error(result?.error || 'Failed to switch mode');
    }
    setSwitchingMode(false);
  };

  const navLinks = useMemo(() => [
    { path: '/', label: 'Explore' },
    { path: '/copilot', label: '🤖 AI Copilot' },
    { path: '/risk-coach', label: '🛡️ Risk Coach' },
    { path: '/simulator', label: '⚡ Simulator' },
    { path: '/smart-money', label: '💰 Smart Money' },
    { path: '/trading-dna', label: '🧬 My DNA' },
    { path: '/microstructure', label: '🔬 Microstructure' },
    { path: '/price-targets', label: '🎯 Targets' },
    { path: '/stress-test', label: '🛡️ Stress Test' },
    { path: '/xray', label: '🧬 X-Ray' },
    { path: '/sentiment', label: '📡 Sentiment' },
    { path: '/earnings', label: '📅 Earnings' },
    { path: '/options-builder', label: '🎯 Options' },
    { path: '/copy-trading', label: '👥 Copy Trade' },
    { path: '/portfolio', label: 'Holdings' },
    { path: '/orders', label: 'Orders' },
    { path: '/screener', label: 'Screener' },
    { path: '/compare', label: 'Compare' },
    { path: '/heatmap', label: 'Heatmap' },
    { path: '/baskets', label: 'Baskets' },
    { path: '/tournament', label: '🏆 Arena' },
    { path: '/ipo', label: '🚀 IPO' },
    { path: '/alerts', label: '🔔 Alerts' },
    { path: '/fno', label: 'F&O' },
    { path: '/mutual-funds', label: 'MF' },
    { path: '/sip-calculator', label: 'SIP' },
    { path: '/rewards', label: '⭐ Rewards' },
    { path: '/wallet', label: 'Wallet' },
  ], []);

  const isActive = (path) => location.pathname === path;

  return (
    <>
      <nav className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#06060a]/95 backdrop-blur-2xl shadow-[0_1px_0_rgba(255,255,255,0.04)]' : 'bg-[#06060a]/80 backdrop-blur-md'}`}>
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
          
          {/* Top Row */}
          <div className="flex justify-between items-center h-14 sm:h-16">
            
            {/* Logo */}
            <Link to="/" className="flex items-center gap-1.5 sm:gap-2.5 group shrink-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg group-hover:shadow-primary/20 transition-shadow">
                <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div className="flex items-baseline gap-1 sm:gap-1.5">
                <span className="text-lg sm:text-xl font-extrabold tracking-tight text-white">Nexus</span>
                <span className="text-lg sm:text-xl font-extrabold tracking-tight text-gradient">AI</span>
              </div>
            </Link>

            {/* Search Bar - Desktop */}
            <form onSubmit={handleSearch} className="hidden lg:flex w-full max-w-md mx-4 xl:mx-8 relative">
              <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${isFocused ? 'bg-primary/5 shadow-[0_0_0_2px_rgba(0,212,170,0.15)]' : ''}`} />
              <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors z-10 ${isFocused ? 'text-primary' : 'text-zinc-500'}`} />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="Search stocks, ETFs, mutual funds..."
                className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none transition-all relative z-10 placeholder:text-zinc-600"
              />
              {search && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600 font-mono z-10 border border-white/10 px-1.5 py-0.5 rounded">
                  ENTER ↵
                </span>
              )}
            </form>

            {/* Right Actions */}
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Mode Toggle Button */}
              {user && (
                <button 
                  onClick={handleToggleMode}
                  disabled={switchingMode}
                  className={`hidden lg:flex items-center gap-2 px-3 py-1.5 border rounded-full mr-2 transition-all group overflow-hidden relative
                    ${switchingMode ? 'opacity-50 cursor-not-allowed' : ''}
                    ${isLiveMode 
                      ? 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20' 
                      : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                    }`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isLiveMode ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    {switchingMode ? 'SWITCHING...' : (isLiveMode ? 'LIVE TRADING' : 'DEMO MODE')}
                  </span>
                  <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )}

              <div className="relative" ref={notificationRef}>
                <button 
                  onClick={() => {
                    setNotificationsOpen(!notificationsOpen);
                    if (!notificationsOpen) markNotificationsRead();
                  }}
                  className="relative p-2.5 text-zinc-500 hover:text-white hover:bg-white/[0.04] rounded-xl transition-all"
                >
                  <Bell className="w-[18px] h-[18px]" />
                  {user && notifications.some(n => !n.is_read) && (
                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-primary rounded-full border-2 border-[#06060a] ring-2 ring-primary/20" />
                  )}
                </button>

                <AnimatePresence>
                  {notificationsOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-3 w-[calc(100vw-2rem)] sm:w-80 bg-[#0a0a0f] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden z-50 py-2"
                    >
                      <div className="px-5 py-4 border-b border-white/[0.04] flex items-center justify-between">
                         <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Notifications</h3>
                         <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">{notifications.length} Alerts</span>
                      </div>
                      <div className="max-h-[400px] overflow-y-auto no-scrollbar">
                        {notifications.length > 0 ? notifications.map((n, idx) => (
                          <div key={idx} className={`px-5 py-4 border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors relative ${!n.is_read ? 'bg-primary/[0.02]' : ''}`}>
                             <div className="flex items-start gap-4">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${n.type === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-400' : n.type === 'ALERT' ? 'bg-amber-500/10 text-amber-400' : 'bg-primary/10 text-primary'}`}>
                                   <Zap size={14} />
                                </div>
                                <div className="flex-1 min-w-0">
                                   <p className="text-[13px] font-bold text-white mb-0.5 leading-snug">{n.title}</p>
                                   <p className="text-xs text-zinc-500 line-clamp-2 mb-1.5">{n.message}</p>
                                   <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-tighter">{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • SYSTEM</p>
                                </div>
                             </div>
                             {!n.is_read && <div className="absolute top-4 right-4 w-1.5 h-1.5 rounded-full bg-primary" />}
                          </div>
                        )) : (
                          <div className="py-12 text-center flex flex-col items-center">
                             <div className="w-12 h-12 rounded-full bg-white/[0.03] flex items-center justify-center mb-3">
                                <Activity className="w-5 h-5 text-zinc-700" />
                             </div>
                             <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">No New Notifications</p>
                          </div>
                        )}
                      </div>
                      <button className="w-full py-3.5 text-xs font-bold text-primary hover:bg-primary/5 transition-colors border-t border-white/[0.04]">View All Alerts</button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              <Link to="/connect-broker" className="hidden xl:flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary rounded-xl transition-all no-underline">
                <LinkIcon className={`w-3.5 h-3.5 ${isLiveMode ? 'animate-bounce' : 'animate-pulse'}`} />
                <span className="text-xs font-black uppercase tracking-widest">Broker</span>
              </Link>

              <div className="w-px h-6 bg-white/[0.08] mx-1 sm:mx-2 hidden md:block" />

              {user ? (
                <div className="relative" ref={profileRef}>
                  <button 
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-1.5 sm:gap-2 ml-1 p-1 sm:pr-3 bg-white/[0.04] border border-white/[0.06] rounded-xl cursor-pointer hover:bg-white/[0.06] transition-all"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-secondary/20 border border-white/10 flex items-center justify-center">
                      <span className="text-[10px] font-black text-white tracking-widest">{getAvatarInitials(user)}</span>
                    </div>
                    <div className="hidden sm:flex flex-col text-left overflow-hidden max-w-[120px]">
                      <span className="text-xs font-bold text-white leading-none mb-0.5 truncate">{getDisplayName(user)}</span>
                      <span className="text-[9px] font-bold text-primary uppercase tracking-widest leading-none">{user.account_type || 'Free'}</span>
                    </div>
                    <ChevronDown className={`hidden sm:block w-3.5 h-3.5 text-zinc-500 ml-1 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {profileOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-3 w-[calc(100vw-2rem)] sm:w-64 bg-[#0a0a0f] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden py-2 z-50"
                      >
                        <div className="px-4 py-3 border-b border-white/[0.04] mb-1">
                          <p className="text-xs text-zinc-500 mb-1 tracking-wider uppercase font-bold">Wallet Balance</p>
                          <p className="text-lg font-black text-white">₹{(profile?.balance || 0).toLocaleString()}</p>
                        </div>

                        <Link to="/profile" className="flex items-center gap-3 px-4 py-3 text-sm text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-all no-underline">
                          <User size={16} />
                          <span>Trading Profile</span>
                        </Link>
                        <Link to="/wallet" className="flex items-center gap-3 px-4 py-3 text-sm text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-all no-underline">
                          <WalletIcon size={16} />
                          <span>My Wallet</span>
                        </Link>
                        
                        <div className="h-px bg-white/[0.04] my-1" />

                        <button 
                          onClick={handleToggleMode}
                          disabled={switchingMode}
                          className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-all hover:bg-white/[0.04] ${switchingMode ? 'opacity-50' : ''}`}
                        >
                          <div className="flex items-center gap-3 text-zinc-400">
                            {isLiveMode ? <ShieldAlert size={16} className="text-rose-500" /> : <Shield size={16} className="text-emerald-500" />}
                            <span className={isLiveMode ? "text-rose-400" : "text-emerald-400"}>
                               {switchingMode ? 'Switching...' : (isLiveMode ? 'Switch to Demo' : 'Switch to Live')}
                            </span>
                          </div>
                          <div className={`w-8 h-4 rounded-full relative transition-colors ${isLiveMode ? 'bg-rose-500/20' : 'bg-emerald-500/20'}`}>
                            <div className={`absolute top-1 w-2 h-2 rounded-full transition-all ${isLiveMode ? 'right-1 bg-rose-500' : 'left-1 bg-emerald-500'}`} />
                          </div>
                        </button>

                        <div className="h-px bg-white/[0.04] my-1" />

                        <button 
                          onClick={logout}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-rose-400 hover:bg-rose-500/10 transition-all font-semibold"
                        >
                          <LogOut size={16} />
                          <span>Log Out</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="flex items-center gap-1 sm:gap-2">
                  <Link to="/login" className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold text-zinc-400 hover:text-white transition-all">Log In</Link>
                  <Link to="/register" className="px-3 sm:px-5 py-2 text-xs sm:text-sm font-black bg-primary text-black rounded-xl hover:bg-primary-hover transition-all shadow-lg shadow-primary/20">Sign Up</Link>
                </div>
              )}

              {/* Mobile Menu Toggle */}
              <button 
                onClick={() => setMobileOpen(!mobileOpen)}
                className="lg:hidden p-2 sm:p-2.5 text-zinc-400 hover:text-white hover:bg-white/[0.04] rounded-xl transition-all"
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Nav Tabs - Desktop (hidden on mobile, shown from lg+) */}
          <div className="hidden lg:flex gap-0.5 xl:gap-1 -mb-px overflow-x-auto no-scrollbar pb-1 hide-scrollbar">
            {navLinks.map(link => (
              <Link
                key={link.path}
                to={link.path}
                className={`relative px-2.5 xl:px-4 py-2.5 xl:py-3 text-xs xl:text-sm font-semibold transition-colors rounded-t-lg whitespace-nowrap shrink-0
                  ${isActive(link.path)
                    ? 'text-primary'
                    : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.02]'
                  }`}
              >
                {link.label}
                {isActive(link.path) && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-2 right-2 h-[2px] bg-primary rounded-full"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </Link>
            ))}
          </div>
        </div>

        {/* Separator line */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      </nav>

      {/* Mobile/Tablet Nav Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed inset-x-0 top-14 sm:top-16 bottom-0 z-40 bg-[#06060a]/98 backdrop-blur-2xl border-b border-white/[0.06] lg:hidden overflow-y-auto"
          >
            <div className="p-3 sm:p-4 space-y-1 pb-24">
              {/* Mobile Search */}
              <form onSubmit={handleSearch} className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search stocks, ETFs, mutual funds..."
                  className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none"
                />
              </form>

              {/* Mode toggle for mobile */}
              {user && (
                <button 
                  onClick={handleToggleMode}
                  disabled={switchingMode}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 border rounded-xl mb-3 transition-all
                    ${switchingMode ? 'opacity-50' : ''}
                    ${isLiveMode 
                      ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' 
                      : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    }`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isLiveMode ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    {switchingMode ? 'SWITCHING...' : (isLiveMode ? 'LIVE TRADING' : 'DEMO MODE')}
                  </span>
                </button>
              )}
              
              {/* Nav links in a scrollable grid on tablets, list on phones */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 sm:gap-1.5">
                {navLinks.map(link => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`block px-3 sm:px-4 py-3 rounded-xl text-xs sm:text-sm font-semibold transition-colors text-center sm:text-left truncate
                      ${isActive(link.path)
                        ? 'text-primary bg-primary/10'
                        : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                      }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>

              <div className="h-px bg-white/[0.06] my-3" />

              {/* Broker link for mobile */}
              {user && (
                <Link to="/connect-broker" className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary rounded-xl transition-all no-underline mb-2">
                  <LinkIcon className="w-3.5 h-3.5" />
                  <span className="text-xs font-black uppercase tracking-widest">Connect Broker</span>
                </Link>
              )}
              
              {!user && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <Link to="/login" className="flex items-center justify-center p-3 rounded-xl bg-white/[0.04] text-white text-sm font-bold">Log In</Link>
                  <Link to="/register" className="flex items-center justify-center p-3 rounded-xl bg-primary text-black text-sm font-bold">Sign Up</Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
