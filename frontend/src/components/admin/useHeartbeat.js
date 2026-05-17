import { useEffect, useRef, useState } from 'react';
import { adminApi } from '../../lib/api.js';

/**
 * Polling silenzioso ogni `intervalMs`. Pausa quando tab nascosta.
 * Ritorna: { data, lastUpdate, setOnNewBooking }
 */
export default function useHeartbeat(intervalMs = 30000) {
  const [data, setData] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const lastBookingIdRef = useRef(null);
  const newBookingHandlerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let timer;

    async function tick() {
      if (document.hidden || cancelled) return;
      try {
        const res = await adminApi.getHeartbeat();
        if (cancelled) return;
        setData(res);
        setLastUpdate(new Date());
        if (
          lastBookingIdRef.current &&
          res.last_booking_id &&
          res.last_booking_id !== lastBookingIdRef.current &&
          newBookingHandlerRef.current
        ) {
          newBookingHandlerRef.current(res);
        }
        lastBookingIdRef.current = res.last_booking_id;
      } catch (_) { /* silenzioso */ }
    }

    tick(); // primo tick subito
    timer = setInterval(tick, intervalMs);

    const onVis = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [intervalMs]);

  function setOnNewBooking(handler) {
    newBookingHandlerRef.current = handler;
  }

  return { data, lastUpdate, setOnNewBooking };
}
