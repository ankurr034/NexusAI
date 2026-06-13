import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ToastProvider } from './components/Toast';
import { UserProvider, useUser } from './context/UserContext';
import { Web3Provider } from './context/Web3Context';
import { SocketProvider } from './context/SocketContext';
import Navbar from './components/Navbar';
import CommandBar from './components/CommandBar';
import LiveTickerStrip from './components/LiveTickerStrip';
import Footer from './components/Footer';
import PremiumOverlay from './components/PremiumOverlay';
import SmartAlerts from './components/SmartAlerts';
const Explore = React.lazy(() => import('./pages/Explore'));
const Portfolio = React.lazy(() => import('./pages/Portfolio'));
const MutualFunds = React.lazy(() => import('./pages/MutualFunds'));
const StockDetail = React.lazy(() => import('./pages/StockDetail'));
const FnO = React.lazy(() => import('./pages/FnO'));
const Wallet = React.lazy(() => import('./pages/Wallet'));
const Profile = React.lazy(() => import('./pages/Profile'));
const BrokerLink = React.lazy(() => import('./pages/BrokerLink'));
const OrderBook = React.lazy(() => import('./pages/OrderBook'));
const CDSLDashboard = React.lazy(() => import('./pages/CDSLDashboard'));
const Screener = React.lazy(() => import('./pages/Screener'));
const Login = React.lazy(() => import('./pages/Login'));
const Register = React.lazy(() => import('./pages/Register'));
const KYC = React.lazy(() => import('./pages/KYC'));

// UNIQUE FEATURES
const AICopilot = React.lazy(() => import('./pages/AICopilot'));
const SmartBaskets = React.lazy(() => import('./pages/SmartBaskets'));
const Heatmap = React.lazy(() => import('./pages/Heatmap'));
const Resources = React.lazy(() => import('./pages/Resources'));
const TradeJournal = React.lazy(() => import('./pages/TradeJournal'));
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));

// NEW PREMIUM FEATURES — SURPASSING GROWW/ZERODHA
const SmartAlertsPage = React.lazy(() => import('./pages/SmartAlerts'));
const SIPCalculator = React.lazy(() => import('./pages/SIPCalculator'));
const IPODashboard = React.lazy(() => import('./pages/IPODashboard'));
const StockCompare = React.lazy(() => import('./pages/StockCompare'));
const Tournament = React.lazy(() => import('./pages/Tournament'));
const Rewards = React.lazy(() => import('./pages/Rewards'));

// GAME-CHANGING UNIQUE FEATURES — NOT IN ANY INDIAN APP
const PortfolioXray = React.lazy(() => import('./pages/PortfolioXray'));
const RiskCoach = React.lazy(() => import('./pages/RiskCoach'));
const SentimentRadar = React.lazy(() => import('./pages/SentimentRadar'));
const EarningsCalendar = React.lazy(() => import('./pages/EarningsCalendar'));
const OptionsBuilder = React.lazy(() => import('./pages/OptionsBuilder'));
const CopyTrading = React.lazy(() => import('./pages/CopyTrading'));

// NEXT-GEN FEATURES — BEYOND GROWW/ZERODHA/ANY COMPETITOR
const TradeSimulator = React.lazy(() => import('./pages/TradeSimulator'));
const SmartMoneyFlow = React.lazy(() => import('./pages/SmartMoneyFlow'));
const StressTest = React.lazy(() => import('./pages/StressTest'));
const PriceTargets = React.lazy(() => import('./pages/PriceTargets'));
const Microstructure = React.lazy(() => import('./pages/Microstructure'));
const TradingDNA = React.lazy(() => import('./pages/TradingDNA'));

function ProtectedRoute({ children }) {
  const { user, loading } = useUser();
  if (loading) return <LoadingFallback />;
  if (!user) return <Navigate to="/login" />;
  return children;
}



function PremiumRoute({ children }) {
  const { user, loading } = useUser();
  if (loading) return <LoadingFallback />;
  if (!user) return <Navigate to="/login" />;
  
  if (!user.isPremium && !user.isDemoPremium) {
    return (
      <div className="relative w-full h-full min-h-[80vh]">
        <div className="absolute inset-0 pointer-events-none select-none overflow-hidden" style={{ filter: 'blur(12px) brightness(0.6)' }}>
           {children}
        </div>
        <PremiumOverlay />
      </div>
    );
  }
  
  return children;
}

function LoadingFallback() {
  return (
    <div className="h-screen flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}

function AnimatedRoutes() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      
      <Route path="/" element={<Explore />} />
      <Route path="/portfolio" element={<ProtectedRoute><Portfolio /></ProtectedRoute>} />
      <Route path="/orders" element={<ProtectedRoute><OrderBook /></ProtectedRoute>} />
      <Route path="/cdsl" element={<ProtectedRoute><CDSLDashboard /></ProtectedRoute>} />
      <Route path="/screener" element={<ProtectedRoute><Screener /></ProtectedRoute>} />
      <Route path="/mutual-funds" element={<MutualFunds />} />
      <Route path="/mutualfunds" element={<MutualFunds />} />
      <Route path="/fno" element={<FnO />} />
      <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/kyc" element={<ProtectedRoute><KYC /></ProtectedRoute>} />
      <Route path="/connect-broker" element={<ProtectedRoute><BrokerLink /></ProtectedRoute>} />
      <Route path="/stock/:tickerId" element={<StockDetail />} />

      {/* UNIQUE FEATURES */}
      <Route path="/copilot" element={<ProtectedRoute><AICopilot /></ProtectedRoute>} />
      <Route path="/baskets" element={<SmartBaskets />} />
      <Route path="/heatmap" element={<Heatmap />} />
      <Route path="/resources" element={<Resources />} />
      <Route path="/journal" element={<ProtectedRoute><TradeJournal /></ProtectedRoute>} />

      {/* ADMIN */}
      <Route path="/admin" element={<AdminDashboard />} />

      {/* NEW PREMIUM FEATURES */}
      <Route path="/alerts" element={<PremiumRoute><SmartAlertsPage /></PremiumRoute>} />
      <Route path="/sip-calculator" element={<SIPCalculator />} />
      <Route path="/ipo" element={<IPODashboard />} />
      <Route path="/compare" element={<StockCompare />} />
      <Route path="/tournament" element={<Tournament />} />
      <Route path="/arena" element={<Tournament />} />
      <Route path="/rewards" element={<ProtectedRoute><Rewards /></ProtectedRoute>} />

      {/* GAME-CHANGING UNIQUE FEATURES */}
      <Route path="/xray" element={<PremiumRoute><PortfolioXray /></PremiumRoute>} />
      <Route path="/risk-coach" element={<PremiumRoute><RiskCoach /></PremiumRoute>} />
      <Route path="/sentiment" element={<SentimentRadar />} />
      <Route path="/earnings" element={<EarningsCalendar />} />
      <Route path="/options-builder" element={<OptionsBuilder />} />
      <Route path="/copy-trading" element={<CopyTrading />} />

      {/* NEXT-GEN: BEYOND ANY COMPETITOR */}
      <Route path="/simulator" element={<TradeSimulator />} />
      <Route path="/smart-money" element={<PremiumRoute><SmartMoneyFlow /></PremiumRoute>} />
      <Route path="/stress-test" element={<PremiumRoute><StressTest /></PremiumRoute>} />
      <Route path="/price-targets" element={<PremiumRoute><PriceTargets /></PremiumRoute>} />
      <Route path="/microstructure" element={<Microstructure />} />
      <Route path="/trading-dna" element={<PremiumRoute><TradingDNA /></PremiumRoute>} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <BrowserRouter>
      <UserProvider>
        <ToastProvider>
          <Web3Provider>
            <SocketProvider>
              <div className="min-h-screen bg-background relative text-zinc-100 noise-overlay">
                {/* Ambient gradients — scaled for mobile */}
                <div className="fixed top-0 left-1/4 w-[300px] sm:w-[500px] lg:w-[800px] h-[300px] sm:h-[500px] lg:h-[800px] bg-primary/[0.03] rounded-full blur-[100px] sm:blur-[150px] lg:blur-[200px] pointer-events-none" />
                <div className="fixed bottom-0 right-1/4 w-[200px] sm:w-[400px] lg:w-[600px] h-[200px] sm:h-[400px] lg:h-[600px] bg-secondary/[0.03] rounded-full blur-[100px] sm:blur-[150px] lg:blur-[200px] pointer-events-none" />

                <LiveTickerStrip />
                <Navbar />
                <CommandBar />

                <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 relative z-10 min-h-[80vh]">
                  <AnimatedRoutes />
                </main>

                <Footer />
                <SmartAlerts />
              </div>
            </SocketProvider>
          </Web3Provider>
        </ToastProvider>
      </UserProvider>
    </BrowserRouter>
  );
}

export default App;
