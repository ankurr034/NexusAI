/**
 * Base abstract class for all broker integrations.
 * Defines the normalized interface that every adapter MUST implement.
 */
export default class BaseBrokerAdapter {
  constructor(credentials) {
    this.credentials = credentials;
  }

  /**
   * Return adapter capabilities mapping
   * @returns {Object}
   */
  getCapabilities() {
    return {
      supportsRealtime: false,
      supportsOptions: false,
      supportsRefresh: false,
      supportsSandbox: false,
      supportsGTT: false,
      supportsOrderModify: false
    };
  }

  /**
   * Initialize a connection session and return standardized tokens.
   * @param {Object} payload e.g. { authCode, requestToken, etc. }
   * @returns {Promise<{ access_token, refresh_token, expires_at }>}
   */
  async connect(payload) {
    throw new Error('connect() not implemented');
  }
  
  /**
   * Refresh an existing session.
   * @param {string} refreshToken
   * @returns {Promise<{ access_token, refresh_token, expires_at }>}
   */
  async refreshToken(refreshToken) {
    throw new Error('refreshToken() not implemented');
  }

  /**
   * Fetch the user's broker profile/account details.
   * @param {string} accessToken 
   * @returns {Promise<{ id, name, email, balances }>}
   */
  async getProfile(accessToken) {
    throw new Error('getProfile() not implemented');
  }

  /**
   * Fetch standardized holdings/positions.
   * @param {string} accessToken
   * @returns {Promise<Array<{ symbol, quantity, averagePrice, currentPrice, pnl }>>}
   */
  async getHoldings(accessToken) {
    throw new Error('getHoldings() not implemented');
  }

  /**
   * Place a normalized order.
   * @param {string} accessToken
   * @param {Object} orderConfig { symbol, action, quantity, type, price }
   * @returns {Promise<{ orderId, status, message }>}
   */
  async placeOrder(accessToken, orderConfig) {
    throw new Error('placeOrder() not implemented');
  }

  /**
   * Optional: Provide a websocket feed URL or connection utility.
   * For pure API-driven normalization, we might just return the endpoint and auth.
   * @param {string} accessToken
   * @returns {Promise<{ wsUrl, payload }>}
   */
  async getMarketFeedConfig(accessToken) {
    throw new Error('getMarketFeedConfig() not implemented');
  }
}
