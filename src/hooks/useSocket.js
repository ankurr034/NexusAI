import { useEffect, useState } from 'react';
import { useSocketProvider } from '../context/SocketContext';

export default function useSocket(eventName) {
  const { socket, isConnected, subscribe, unsubscribe } = useSocketProvider();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!socket || !eventName) return;

    const onEvent = (payload) => setData(payload);
    socket.on(eventName, onEvent);

    return () => {
      socket.off(eventName, onEvent);
    };
  }, [socket, eventName]);

  return { data, isConnected, socket, subscribe, unsubscribe };
}
