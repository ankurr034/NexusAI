import BaseBrokerAdapter from './BaseBrokerAdapter.js';

/**
 * Simulates a successful broker connection for platforms
 * that are pending live API integration.
 */
export default class MockBrokerAdapter extends BaseBrokerAdapter {
  getCapabilities() {
    return {
      supportsRealtime: true,
      supportsOptions: false,
      supportsRefresh: true,
      supportsSandbox: true,
      supportsGTT: false,
      supportsOrderModify: true
    };
  }

  async connect(payload) {
    // Return standard mock tokens
    const accessToken = `MOCK-AT-${Math.random().toString(36).substring(7).toUpperCase()}`;
    const refreshToken = `MOCK-RT-${Math.random().toString(36).substring(7).toUpperCase()}`;
    const expiresAt = Date.now() + 30000; // 30 seconds for test expiry

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt
    };
  }

  async refreshToken(refreshToken) {
    if (!refreshToken || refreshToken.includes('INVALID')) {
      throw new Error('Refresh token revoked or expired');
    }
    return {
      access_token: `MOCK-AT-${Math.random().toString(36).substring(7).toUpperCase()}`,
      refresh_token: refreshToken,
      expires_at: Date.now() + 30000
    };
  }

  async getProfile(accessToken) {
    return {
      id: 'mock_123',
      name: 'Mock User',
      email: 'mock@nexus.ai',
      balances: { margin: 1000000, available: 850000 }
    };
  }

  async getHoldings(accessToken) {
    return [
      { symbol: 'RELIANCE', quantity: 50, averagePrice: 2400, currentPrice: 2450, pnl: 2500 },
      { symbol: 'INFY', quantity: 100, averagePrice: 1500, currentPrice: 1480, pnl: -2000 }
    ];
  }

  async placeOrder(accessToken, orderConfig) {
    return {
      orderId: `MOCK-ORD-${Math.random().toString(36).substring(7).toUpperCase()}`,
      status: 'COMPLETE',
      message: `Mock order for ${orderConfig.quantity} ${orderConfig.symbol} executed successfully.`
    };
  }
}
