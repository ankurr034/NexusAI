const IST_OFFSET = 5.5 * 60 * 60 * 1000;

class MarketSession {
  constructor() {
    this.simulatorOverride = false;
  }

  setSimulatorOverride(state) {
    this.simulatorOverride = state;
  }

  getSessionStatus() {
    if (this.simulatorOverride) {
      return { status: 'OPEN', isMarketOpen: true, nextTransition: 'Never (Simulator Override)' };
    }

    const now = new Date();
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const istTime = new Date(utcTime + IST_OFFSET);

    const dayOfWeek = istTime.getDay(); // 0 = Sunday
    const hours = istTime.getHours();
    const minutes = istTime.getMinutes();
    const totalMinutes = hours * 60 + minutes;

    const PREMARKET_START = 9 * 60; // 9:00 AM
    const OPEN_START = 9 * 60 + 15; // 9:15 AM
    const CLOSE_START = 15 * 60 + 30; // 3:30 PM
    const AFTERHOURS_END = 16 * 60; // 4:00 PM

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return { status: 'CLOSED', isMarketOpen: false, nextTransition: 'Monday 9:00 AM (Premarket)' };
    }

    if (totalMinutes >= PREMARKET_START && totalMinutes < OPEN_START) {
      return { status: 'PREMARKET', isMarketOpen: false, nextTransition: '9:15 AM (Open)' };
    } else if (totalMinutes >= OPEN_START && totalMinutes < CLOSE_START) {
      return { status: 'OPEN', isMarketOpen: true, nextTransition: '3:30 PM (Close)' };
    } else if (totalMinutes >= CLOSE_START && totalMinutes < AFTERHOURS_END) {
      return { status: 'AFTERHOURS', isMarketOpen: false, nextTransition: 'Tomorrow 9:00 AM (Premarket)' };
    } else {
      return { status: 'CLOSED', isMarketOpen: false, nextTransition: 'Tomorrow 9:00 AM (Premarket)' };
    }
  }
}

export default new MarketSession();
