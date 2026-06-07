import axios from 'axios';
import BaseBrokerAdapter from './BaseBrokerAdapter.js';

export default class UpstoxAdapter extends BaseBrokerAdapter {
  constructor(credentials) {
    super(credentials);
    this.apiKey = credentials.apiKey || process.env.UPSTOX_API_KEY;
    this.apiSecret = credentials.apiSecret || process.env.UPSTOX_SECRET;
    this.redirectUri = credentials.redirectUri || process.env.UPSTOX_REDIRECT_URI;
    
    // Rate Limiting & Metrics
    this.requestCount = 0;
    this.retryCount = 0;
    this.cooldownStatus = false;
    this.queueSize = 0;
    
    this.client = this.createUpstoxClient();
  }

  isConfigured() {
    return Boolean(this.apiKey && this.apiSecret);
  }

  getCapabilities() {
    return {
      supportsRealtime: true,
      supportsOptions: true,
      supportsRefresh: true, 
      supportsSandbox: false,
      supportsGTT: true,
      supportsOrderModify: true,
      apiVersion: 'v2'
    };
  }
  
  getMetrics() {
    return {
       requestCount: this.requestCount,
       retryCount: this.retryCount,
       queueSize: this.queueSize,
       isCoolingDown: this.cooldownStatus,
       latencyMs: this.lastLatency || 0
    };
  }

  createUpstoxClient() {
    const instance = axios.create({
      baseURL: 'https://api.upstox.com/v2',
      timeout: 15000,
      headers: {
        'Accept': 'application/json',
        'Api-Version': '2.0'
      }
    });

    // Request Supervisor (Proactive Throttling)
    instance.interceptors.request.use(async (config) => {
      this.queueSize++;
      
      // Proactive Throttle: Avoid hitting 429s entirely by delaying if request volume spikes.
      // Upstox allows ~10 req/sec. If queue gets heavy, naturally delay 100ms.
      if (this.queueSize > 5) {
         await new Promise(r => setTimeout(r, 100 * this.queueSize));
      }
      
      config.metadata = { startTime: Date.now() };
      return config;
    });

    // 429 Interceptor & Backoff Logic
    instance.interceptors.response.use(
      (response) => {
        this.queueSize = Math.max(0, this.queueSize - 1);
        this.requestCount++;
        const duration = Date.now() - response.config.metadata.startTime;
        this.lastLatency = duration;
        return response;
      },
      async (error) => {
        this.queueSize = Math.max(0, this.queueSize - 1);
        const originalRequest = error.config;
        
        if (error.response && error.response.status === 429) {
           originalRequest._retryCount = originalRequest._retryCount || 0;
           
           if (originalRequest._retryCount < 3) {
             originalRequest._retryCount++;
             this.retryCount++;
             this.cooldownStatus = true;
             
             // Exponential Backoff with Jitter
             const delay = Math.pow(2, originalRequest._retryCount) * 1000 + Math.random() * 500;
             console.log(`[UpstoxAdapter] 429 Rate Limit Hit. Retrying in ${Math.round(delay)}ms...`);
             
             await new Promise(resolve => setTimeout(resolve, delay));
             this.cooldownStatus = false;
             return instance(originalRequest);
           }
        }
        
        return Promise.reject(error);
      }
    );
    return instance;
  }

  async connect(payload) {
    const { requestToken } = payload;
    if (!requestToken) {
      throw new Error("Missing 'requestToken' for Upstox Connect");
    }

    try {
      const data = new URLSearchParams();
      data.append('code', requestToken);
      data.append('client_id', this.apiKey);
      data.append('client_secret', this.apiSecret);
      data.append('redirect_uri', this.redirectUri || 'https://nexus.ai/callback');
      data.append('grant_type', 'authorization_code');

      const response = await this.client.post('/login/authorization/token', data, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      
      // Upstox access tokens usually expire in 24 hours depending on grant
      const expiresAt = Date.now() + (24 * 60 * 60 * 1000); 

      return {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token || 'UPSTOX_NO_RT',
        expires_at: expiresAt
      };
    } catch (err) {
      console.error("[UpstoxAdapter] Session Generation Failed:", err.response?.data || err.message);
      throw new Error("Upstox Authentication Failed");
    }
  }

  async refreshToken(refreshToken) {
    throw new Error('Upstox V2 refresh mechanism not fully supplied in this configuration.');
  }

  async getProfile(accessToken) {
    try {
      const response = await this.client.get('/user/profile', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      // Secondary call for funds if needed, but we'll mock margin for this unified fetch
      return {
        id: response.data.data.user_id,
        name: response.data.data.user_name,
        email: response.data.data.email,
        balances: {
          margin: 0, // In reality, requires a separate /user/get-funds-and-margin call
          available: 0
        }
      };
    } catch (err) {
      throw new Error(`Failed to fetch Upstox profile: ${err.message}`);
    }
  }

  async getHoldings(accessToken) {
    try {
      const response = await this.client.get('/portfolio/long-term-holdings', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      return response.data.data.map(h => ({
        symbol: h.tradingsymbol,
        quantity: h.quantity,
        averagePrice: h.average_price,
        currentPrice: h.last_price,
        pnl: h.pnl
      }));
    } catch (err) {
      throw new Error(`Failed to fetch Upstox holdings: ${err.message}`);
    }
  }

  async placeOrder(accessToken, orderConfig) {
    try {
      const orderPayload = {
        quantity: orderConfig.quantity,
        product: 'D', // Delivery
        validity: 'DAY',
        price: orderConfig.price || 0,
        tag: 'nexus_ai',
        instrument_token: `NSE_EQ|${orderConfig.symbol}`, // Standardized format for Upstox V2
        order_type: orderConfig.type === 'MARKET' ? 'MARKET' : 'LIMIT',
        transaction_type: orderConfig.action === 'BUY' ? 'BUY' : 'SELL',
        disclosed_quantity: 0,
        trigger_price: 0,
        is_amo: false
      };

      const response = await this.client.post('/order/place', orderPayload, {
        headers: { 
           'Authorization': `Bearer ${accessToken}`,
           'Content-Type': 'application/json'
        }
      });
      
      return {
        orderId: response.data.data.order_id,
        status: 'PENDING_EXCHANGE',
        message: `Order submitted to Upstox: ${response.data.data.order_id}`
      };
    } catch (err) {
      throw new Error(`Upstox Order Placement Failed: ${err.response?.data?.errors?.[0]?.message || err.message}`);
    }
  }

  async getMarketFeedConfig(accessToken) {
    return {
      wsUrl: 'wss://api.upstox.com/v2/feed/market-data-feed',
      payload: {
        accessToken: accessToken
      }
    };
  }
}
