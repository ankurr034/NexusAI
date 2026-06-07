import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '../config';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [liveMarketData, setLiveMarketData] = useState({});

  useEffect(() => {
    const socketInstance = io(API_BASE_URL || 'http://localhost:8000', {
      transports: ['websocket'],
    });

    socketInstance.on('connect', () => {
      console.log('Connected to real-time server');
    });

    socketInstance.on('market_update', (data) => {
      setLiveMarketData(prev => ({
        ...prev,
        ...data
      }));
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, liveMarketData }}>
      {children}
    </SocketContext.Provider>
  );
};
