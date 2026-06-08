import { useState, useEffect } from 'react';

const IST_OFFSET = 5.5 * 60 * 60 * 1000;

export default function useMarketSession(simulatorOverride = false) {
  const [session, setSession] = useState({
    status: 'CLOSED', // PREMARKET, OPEN, AFTERHOURS, CLOSED
    isMarketOpen: false,
    nextTransition: null
  });

  useEffect(() => {
    const updateSession = () => {
      if (simulatorOverride) {
        setSession({ status: 'OPEN', isMarketOpen: true, nextTransition: 'Never (Simulator Override)' });
        return;
      }

      const now = new Date();
      // Get UTC time, then convert to IST
      const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
      const istTime = new Date(utcTime + IST_OFFSET);

      const dayOfWeek = istTime.getDay(); // 0 = Sunday, 1 = Monday...
      const hours = istTime.getHours();
      const minutes = istTime.getMinutes();
      const totalMinutes = hours * 60 + minutes;

      const PREMARKET_START = 9 * 60; // 9:00 AM
      const OPEN_START = 9 * 60 + 15; // 9:15 AM
      const CLOSE_START = 15 * 60 + 30; // 3:30 PM
      const AFTERHOURS_END = 16 * 60; // 4:00 PM (Arbitrary after-hours period for platform features)

      // Weekends
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        setSession({ status: 'CLOSED', isMarketOpen: false, nextTransition: 'Monday 9:00 AM (Premarket)' });
        return;
      }

      // Check holidays here if an API or list is provided

      if (totalMinutes >= PREMARKET_START && totalMinutes < OPEN_START) {
        setSession({ status: 'PREMARKET', isMarketOpen: false, nextTransition: '9:15 AM (Open)' });
      } else if (totalMinutes >= OPEN_START && totalMinutes < CLOSE_START) {
        setSession({ status: 'OPEN', isMarketOpen: true, nextTransition: '3:30 PM (Close)' });
      } else if (totalMinutes >= CLOSE_START && totalMinutes < AFTERHOURS_END) {
        setSession({ status: 'AFTERHOURS', isMarketOpen: false, nextTransition: 'Tomorrow 9:00 AM (Premarket)' });
      } else {
        setSession({ status: 'CLOSED', isMarketOpen: false, nextTransition: 'Tomorrow 9:00 AM (Premarket)' });
      }
    };

    updateSession();
    // Update every minute
    const interval = setInterval(updateSession, 60000);
    return () => clearInterval(interval);
  }, [simulatorOverride]);

  return session;
}
