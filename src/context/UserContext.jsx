import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const UserContext = createContext();

export const useUser = () => useContext(UserContext);

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLiveMode, setIsLiveMode] = useState(localStorage.getItem('nexus_is_live') === 'true');
  const [brokerConnected, setBrokerConnected] = useState(false);

  useEffect(() => {
    // Check for saved user ID in local storage
    const savedUserId = localStorage.getItem('nexus_user_id');
    if (savedUserId) {
      fetchUserData(savedUserId);
    } else {
      setLoading(false);
    }
    
    const handleBrokerExpired = () => {
      console.log('[USER CONTEXT] Broker session completely expired. Disconnecting locally.');
      setBrokerConnected(false);
    };
    
    window.addEventListener('broker_session_expired', handleBrokerExpired);
    return () => window.removeEventListener('broker_session_expired', handleBrokerExpired);
  }, []);

  const fetchUserData = async (userId) => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      const res = await axios.get(`${API_BASE_URL}/api/auth/me?user_id=${userId}`);
      setUser(res.data.user);
      setProfile(res.data.profile);
      
      const isMockUser = res.data.user.id === 'mock_web2_user' || res.data.user.id === 'nexus-sim-user';
      let dbModeIsLive = res.data.user.account_mode === 'live';
      
      if (isMockUser) {
        dbModeIsLive = localStorage.getItem('nexus_is_live') === 'true';
        res.data.user.account_mode = dbModeIsLive ? 'live' : 'demo';
        setUser(res.data.user);
      }
      
      setIsLiveMode(dbModeIsLive);
      localStorage.setItem('nexus_is_live', String(dbModeIsLive));
      
      // Rehydrate local broker state from valid tokens, else use backend status
      const localToken = localStorage.getItem('broker_access_token');
      const localExpiry = localStorage.getItem('broker_expires_at');
      
      if (localToken && localExpiry && Date.now() < parseInt(localExpiry, 10)) {
         setBrokerConnected(true);
      } else if (localToken) {
         // Has token but expired. Axios interceptor will auto-refresh it on first API call.
         setBrokerConnected(true);
      } else {
         setBrokerConnected(res.data.broker_connected);
      }
    } catch (err) {
      console.error("Failed to fetch user data", err);
      // Fallback for demo frontend mode if backend is unavailable
      if (!err.response) {
        setUser({
          id: userId,
          username: 'NexusUser',
          email: 'user@nexus.ai',
          kyc_status: 'VERIFIED',
          account_mode: localStorage.getItem('nexus_is_live') === 'true' ? 'live' : 'demo',
          isPremium: false,
          subscription_plan: 'Free'
        });
        setProfile({
          risk_profile: 'MODERATE',
          trading_experience: 'INTERMEDIATE'
        });
        return;
      }
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      const res = await axios.post(`${API_BASE_URL}/api/auth/login`, { username, password });
      localStorage.setItem('nexus_user_id', res.data.user_id);
      await fetchUserData(res.data.user_id);
      return { success: true };
    } catch (err) {
      // Mock login for offline frontend simulation
      if (!err.response) {
        const dummyId = 'nexus-sim-user';
        localStorage.setItem('nexus_user_id', dummyId);
        await fetchUserData(dummyId);
        return { success: true };
      }
      return { success: false, error: err.response?.data?.detail || `Login failed` };
    }
  };

  const loginWithWallet = async (token, userData) => {
    localStorage.setItem('nexus_jwt', token);
    localStorage.setItem('nexus_user_id', userData.walletAddress);
    
    // Stub ENS resolution (can be replaced with ethers.js/wagmi lookup)
    const mockEns = null; 

    setUser({
      id: userData.walletAddress,
      username: '', // Leave empty to force getDisplayName to fallback cleanly
      full_name: '',
      email: '',
      ensName: mockEns,
      kyc_status: 'UNVERIFIED',
      account_mode: isLiveMode ? 'live' : 'demo',
      isPremium: userData.isPremium,
      walletAddress: userData.walletAddress
    });
    
    setProfile({
      risk_profile: 'MODERATE',
      trading_experience: 'ADVANCED'
    });
    
    return { success: true };
  };

  const register = async (userData) => {
    try {
      await axios.post(`${API_BASE_URL}/api/auth/register`, userData);
      return { success: true };
    } catch (err) {
      // Mock registration for offline frontend simulation
      if (!err.response) {
        return { success: true };
      }
      return { success: false, error: err.response?.data?.detail || `Registration failed` };
    }
  };

  const logout = () => {
    localStorage.removeItem('nexus_user_id');
    localStorage.removeItem('nexus_is_live');
    setUser(null);
    setProfile(null);
    setIsLiveMode(false);
  };

  const toggleMode = async () => {
    const newMode = isLiveMode ? 'demo' : 'live';
    try {
      await axios.post(`${API_BASE_URL}/api/profile/update?user_id=${user.id}`, {
        account_mode: newMode
      });
      setIsLiveMode(!isLiveMode);
      localStorage.setItem('nexus_is_live', String(!isLiveMode));
      if (user) {
        setUser({ ...user, account_mode: newMode });
      }
      window.dispatchEvent(new Event('broker_token_updated'));
      return { success: true };
    } catch (err) {
      console.warn('Backend failed to switch mode, falling back to local state:', err);
      // Mock toggle for offline frontend simulation or if DB times out
      setIsLiveMode(!isLiveMode);
      localStorage.setItem('nexus_is_live', String(!isLiveMode));
      if (user) {
        setUser({ ...user, account_mode: newMode });
      }
      window.dispatchEvent(new Event('broker_token_updated'));
      return { success: true };
    }
  };

  const upgradeToPremium = (plan, expiry) => {
    if (user) {
      setUser({ ...user, isPremium: true, subscription_plan: plan, premium_expiry: expiry });
    }
  };

  const contextValue = useMemo(() => ({
    user, 
    profile, 
    loading, 
    isLiveMode, 
    brokerConnected, 
    login, 
    loginWithWallet,
    register, 
    logout, 
    toggleMode,
    upgradeToPremium,
    refreshUser: () => {
      if (user?.id) fetchUserData(user.id);
    }
  }), [user, profile, loading, isLiveMode, brokerConnected]);

  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  );
};
