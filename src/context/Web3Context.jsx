import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useToast } from '../components/Toast';
import { useUser } from './UserContext';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const Web3Context = createContext();

export const useWeb3 = () => useContext(Web3Context);

export const Web3Provider = ({ children }) => {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const toast = useToast();

  const { loginWithWallet } = useUser();

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      toast.error('MetaMask is not installed. Please install it to use this feature.');
      return;
    }

    try {
      setIsConnecting(true);
      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      
      // Request account access
      const accounts = await web3Provider.send("eth_requestAccounts", []);
      
      if (accounts.length > 0) {
        const walletAddress = accounts[0];
        const web3Signer = await web3Provider.getSigner();

        // 1. Get nonce from backend
        const nonceRes = await axios.post(`${API_BASE_URL}/api/auth/nonce`, { walletAddress });
        const { nonce } = nonceRes.data;

        // 2. Sign message
        const signature = await web3Signer.signMessage(nonce);

        // 3. Verify signature with backend
        const verifyRes = await axios.post(`${API_BASE_URL}/api/auth/verify`, { walletAddress, signature });
        
        if (verifyRes.data.success) {
          setProvider(web3Provider);
          setSigner(web3Signer);
          setAccount(walletAddress);
          
          // Sync with UserContext
          await loginWithWallet(verifyRes.data.token, verifyRes.data.user);
          
          toast.success('Wallet connected and authenticated successfully!');
        }
      }
    } catch (error) {
      console.error("Wallet connection failed:", error);
      if (error.code === 4001) {
        toast.warning('User rejected the connection request.');
      } else {
        toast.error('Failed to authenticate wallet.');
      }
    } finally {
      setIsConnecting(false);
    }
  }, [toast, loginWithWallet]);

  const disconnectWallet = useCallback(() => {
    setProvider(null);
    setSigner(null);
    setAccount(null);
    toast.info('Wallet disconnected.');
  }, [toast]);

  // Handle account and network changes
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          toast.info('Wallet account changed.');
        } else {
          disconnectWallet();
        }
      });

      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeAllListeners('accountsChanged');
        window.ethereum.removeAllListeners('chainChanged');
      }
    };
  }, [disconnectWallet, toast]);

  return (
    <Web3Context.Provider
      value={{
        provider,
        signer,
        account,
        isConnecting,
        connectWallet,
        disconnectWallet,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
};
