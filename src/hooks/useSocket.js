import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../config';

let socketInstance = null;

export const getSocket = () => {
  if (!socketInstance) {
    const token = localStorage.getItem('broker_access_token');
    socketInstance = io(API_BASE_URL, {
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      transports: ['websocket'],
      auth: {
        token: token || ''
      }
    });
  }
  return socketInstance;
};

export const reconnectSocket = () => {
  if (socketInstance) {
    const token = localStorage.getItem('broker_access_token');
    socketInstance.auth = { token: token || '' };
    socketInstance.removeAllListeners();
    socketInstance.disconnect();
    
    // Debounce the actual connection attempt
    setTimeout(() => {
      socketInstance.connect();
    }, 500);
  }
};

export default function useSocket(eventName) {
  const [data, setData] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const socket = useRef(null);

  useEffect(() => {
    socket.current = getSocket();

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    const onEvent = (payload) => setData(payload);

    socket.current.on('connect', onConnect);
    socket.current.on('disconnect', onDisconnect);
    
    // Heartbeat logic
    const pingInterval = setInterval(() => {
      if (socket.current?.connected) {
        socket.current.emit('ping');
      }
    }, 25000);

    if (eventName) {
      socket.current.on(eventName, onEvent);
    }

    setIsConnected(socket.current.connected);

    const handleTokenUpdated = () => {
      console.log('[SOCKET] Token updated. Reconnecting socket with new auth...');
      reconnectSocket();
    };
    
    const handleSessionExpired = () => {
      console.log('[SOCKET] Session expired. Disconnecting socket securely.');
      if (socket.current) {
         socket.current.removeAllListeners();
         socket.current.disconnect();
      }
    };

    window.addEventListener('broker_token_updated', handleTokenUpdated);
    window.addEventListener('broker_session_expired', handleSessionExpired);

    return () => {
      clearInterval(pingInterval);
      window.removeEventListener('broker_token_updated', handleTokenUpdated);
      window.removeEventListener('broker_session_expired', handleSessionExpired);
      socket.current.off('connect', onConnect);
      socket.current.off('disconnect', onDisconnect);
      if (eventName) {
        socket.current.off(eventName, onEvent);
      }
    };
  }, [eventName]);

  return { data, isConnected, socket: socket.current };
}
