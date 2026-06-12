import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../config';

const SocketContext = createContext();

export const useSocketProvider = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  
  // Multiplexing & Telemetry states
  const subscriptions = useRef(new Map()); // ticker -> refCount
  const reconnectAttempts = useRef(0);
  const heartbeatTimer = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    let reconnectDelay = 1000;
    
    const connectSocket = () => {
      const token = localStorage.getItem('broker_access_token');
      const userToken = localStorage.getItem('nexus_jwt');
      const socketInstance = io(API_BASE_URL || 'http://localhost:8000', {
        transports: ['websocket'],
        reconnection: false, // We'll handle custom exponential backoff
        auth: { 
          token: token || '',
          userToken: userToken || ''
        }
      });

      socketInstance.on('connect', () => {
        if (import.meta.env.DEV) console.log('[Socket TELEMETRY] Connected successfully');
        setIsConnected(true);
        reconnectAttempts.current = 0;
        reconnectDelay = 1000;
        
        // Re-subscribe to active multiplexed channels
        subscriptions.current.forEach((refCount, ticker) => {
           if (refCount > 0) socketInstance.emit('subscribe_stock', ticker);
        });
        
        startHeartbeat(socketInstance);
      });

      socketInstance.on('disconnect', () => {
        if (import.meta.env.DEV) console.log('[Socket TELEMETRY] Disconnected');
        setIsConnected(false);
        stopHeartbeat();
        handleReconnect();
      });

      setSocket(socketInstance);
      socketRef.current = socketInstance;
      return socketInstance;
    };

    const handleReconnect = () => {
      reconnectAttempts.current += 1;
      // Exponential backoff with jitter
      const jitter = Math.random() * 500;
      reconnectDelay = Math.min(reconnectDelay * 1.5, 30000);
      const finalDelay = reconnectDelay + jitter;
      
      if (import.meta.env.DEV) {
        console.log(`[Socket TELEMETRY] Reconnecting in ${Math.round(finalDelay)}ms (Attempt ${reconnectAttempts.current})`);
      }
      
      setTimeout(() => {
        if (!socketRef.current?.connected) {
          socketRef.current?.connect();
        }
      }, finalDelay);
    };

    const startHeartbeat = (instance) => {
      stopHeartbeat();
      heartbeatTimer.current = setInterval(() => {
        if (document.visibilityState === 'visible' && instance.connected) {
           instance.emit('ping');
           if (import.meta.env.DEV) console.log('[Socket TELEMETRY] Heartbeat sent');
        }
      }, 25000);
    };

    const stopHeartbeat = () => {
      if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
         if (import.meta.env.DEV) console.log('[Socket TELEMETRY] Tab inactive, pausing heartbeat');
      } else {
         if (import.meta.env.DEV) console.log('[Socket TELEMETRY] Tab active, resuming heartbeat');
      }
    };
    
    const handleForceReconnect = () => {
       if (import.meta.env.DEV) console.log('[Socket TELEMETRY] Forced reconnect triggered by auth change');
       if (socketRef.current?.connected) {
          socketRef.current.disconnect();
          // The disconnect event handler will automatically handle the reconnect loop
       } else {
          handleReconnect();
       }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("broker_token_updated", handleForceReconnect);
    const instance = connectSocket();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("broker_token_updated", handleForceReconnect);
      stopHeartbeat();
      instance.removeAllListeners();
      instance.disconnect();
    };
  }, []);

  // Multiplexing API
  const subscribe = (ticker) => {
    if (!ticker) return;
    const count = subscriptions.current.get(ticker) || 0;
    subscriptions.current.set(ticker, count + 1);
    
    if (import.meta.env.DEV) {
       console.log(`[Socket TELEMETRY] subscribe(${ticker}) | RefCount: ${count + 1} | Active Subs: ${subscriptions.current.size}`);
    }
    
    if (count === 0 && socketRef.current?.connected) {
       socketRef.current.emit('subscribe_stock', ticker);
    }
  };

  const unsubscribe = (ticker) => {
    if (!ticker) return;
    const count = subscriptions.current.get(ticker) || 0;
    if (count <= 1) {
       subscriptions.current.delete(ticker);
       if (import.meta.env.DEV) console.log(`[Socket TELEMETRY] unsubscribe(${ticker}) | RefCount: 0 (Emitting to server) | Active Subs: ${subscriptions.current.size}`);
       if (socketRef.current?.connected) {
         socketRef.current.emit('unsubscribe_stock', ticker);
       }
    } else {
       subscriptions.current.set(ticker, count - 1);
       if (import.meta.env.DEV) console.log(`[Socket TELEMETRY] unsubscribe(${ticker}) | RefCount: ${count - 1}`);
    }
  };

  return (
    <SocketContext.Provider value={{ socket, isConnected, subscribe, unsubscribe }}>
      {children}
    </SocketContext.Provider>
  );
};
