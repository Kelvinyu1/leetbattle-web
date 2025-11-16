import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

export function useSocket() {
  const ref = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const s = io(import.meta.env.VITE_API_URL, { transports: ['websocket'] });
    ref.current = s;
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    return () => { s.close(); };
  }, []);

  return { socket: ref.current, connected };
}

