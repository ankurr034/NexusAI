import axios from 'axios';
import * as otplib from 'otplib';
import BaseBrokerAdapter from './BaseBrokerAdapter.js';

export default class AngelOneAdapter extends BaseBrokerAdapter {
  constructor(credentials) {
    super(credentials);
    this.apiKey = credentials.apiKey || process.env.ANGEL_API_KEY;
    // Angel requires client_code and pin globally or passed via payload
    this.clientCode = credentials.clientCode || process.env.ANGEL_CLIENT_CODE;
    this.pin = credentials.pin || process.env.ANGEL_PIN;
    this.totpSecret = credentials.totpSecret || process.env.ANGEL_TOTP_SECRET;

    // Rate Limiting & Metrics
    this.requestCount = 0;
    this.retryCount = 0;
    this.cooldownStatus = false;
    this.queueSize = 0;
    this.lastLatency = 0;
    this.sessionExpiry = null;
    this.totpValid = false;

    // Optional: Time drift tolerance
    if (otplib.authenticator) {
        otplib.authenticator.options = { window: 1 };
    }

    this.client = this.createAngelClient();
  }

  isConfigured() {
    return Boolean(this.apiKey && this.clientCode && this.pin);
  }

  getCapabilities() {
    return {
      supportsRealtime: true,
      supportsOptions: true,
      supportsRefresh: true, 
      supportsSandbox: false,
      supportsGTT: true,
      supportsOrderModify: true,
      apiVersion: 'smartapi_v1'
    };
  }

  getMetrics() {
    return {
       requestCount: this.requestCount,
       retryCount: this.retryCount,
       queueSize: this.queueSize,
       isCoolingDown: this.cooldownStatus,
       latencyMs: this.lastLatency,
       totpValid: this.totpValid,
       sessionExpiry: this.sessionExpiry
    };
  }

  createAngelClient() {
    const instance = axios.create({
      baseURL: 'https://apiconnect.angelbroking.com',
      timeout: 15000,
      headers: {
        'Accept': 'application/json',
        'X-UserType': 'USER',
        'X-SourceID': 'WEB',
        'X-ClientLocalIP': '127.0.0.1',
        'X-ClientPublicIP': '127.0.0.1',
        'X-MACAddress': '00-00-00-00-00-00',
        'X-PrivateKey': this.apiKey
      }
    });

    // Request Supervisor (Proactive Throttling)
    instance.interceptors.request.use(async (config) => {
      this.queueSize++;
      if (this.queueSize > 3) {
         // Angel is strict (3 req/sec often)
         await new Promise(r => setTimeout(r, 200 * this.queueSize));
      }
      config.metadata = { startTime: Date.now() };
      return config;
    });

    // 429 Interceptor & Backoff
    instance.interceptors.response.use(
      (response) => {
        this.queueSize = Math.max(0, this.queueSize - 1);
        this.requestCount++;
        this.lastLatency = Date.now() - response.config.metadata.startTime;
        return response;
      },
      async (error) => {
        this.queueSize = Math.max(0, this.queueSize - 1);
        const originalRequest = error.config;
        
        // Handle Angel Rate Limits
        if (error.response && error.response.status === 429) {
           originalRequest._retryCount = originalRequest._retryCount || 0;
           if (originalRequest._retryCount < 3) {
             originalRequest._retryCount++;
             this.retryCount++;
             this.cooldownStatus = true;
             
             const delay = Math.pow(2, originalRequest._retryCount) * 1000 + Math.random() * 500;
             console.log(`[AngelOneAdapter] 429 Rate Limit Hit. Retrying in ${Math.round(delay)}ms...`);
             
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
    // Angel One auth bypasses typical OAuth. 
    // If requestToken contains a compound payload (clientCode:pin:totpKey), parse it.
    // Otherwise use ENV fallback.
    let code = this.clientCode;
    let pin = this.pin;
    let secret = this.totpSecret;

    if (payload.requestToken && payload.requestToken.includes(':')) {
       const parts = payload.requestToken.split(':');
       code = parts[0];
       pin = parts[1];
       if (parts[2]) secret = parts[2];
    }

    if (!code || !pin) {
       throw new Error("Missing ClientCode or PIN for Angel SmartAPI");
    }

    // 1. Generate Automated TOTP
    let totpCode;
    try {
       if (!secret) throw new Error("No TOTP Secret provided for Auto-Generation.");
       // Handle either default export or named export inside star import
       const authObj = otplib.authenticator || otplib.default?.authenticator || otplib;
       totpCode = authObj.generate(secret);
       this.totpValid = true;
    } catch (e) {
       this.totpValid = false;
       console.error("[AngelOneAdapter] TOTP Auto-Generation Failed:", e.message);
       // Graceful degradation: If TOTP gen fails, fall back to whatever the user manually provided in payload if possible, 
       // else throw to gateway.
       throw new Error("Automated TOTP Generation Failed. Manual OTP Fallback Required.");
    }

    try {
      const response = await this.client.post('/rest/auth/angelbroking/user/v1/loginByPassword', {
        clientcode: code,
        password: pin,
        totp: totpCode
      });
      
      if (!response.data || !response.data.status) {
         throw new Error(response.data.message || "Invalid Login Credentials");
      }

      const jwtToken = response.data.data.jwtToken;
      const refreshToken = response.data.data.refreshToken;
      
      this.sessionExpiry = Date.now() + (24 * 60 * 60 * 1000);

      return {
        access_token: jwtToken,
        refresh_token: refreshToken,
        expires_at: this.sessionExpiry
      };
    } catch (err) {
      console.error("[AngelOneAdapter] Login Failed:", err.response?.data || err.message);
      throw new Error("Angel One Authentication Failed: " + (err.response?.data?.message || err.message));
    }
  }

  async refreshToken(refreshToken) {
    try {
      const response = await this.client.post('/rest/auth/angelbroking/jwt/v1/generateTokens', {
        refreshToken: refreshToken
      }, {
        headers: { 'Authorization': `Bearer ${refreshToken}` } // Angel expects old JWT in header sometimes, or just refresh in body
      });

      if (!response.data.status) throw new Error(response.data.message);

      this.sessionExpiry = Date.now() + (24 * 60 * 60 * 1000);
      return {
        access_token: response.data.data.jwtToken,
        refresh_token: response.data.data.refreshToken,
        expires_at: this.sessionExpiry
      };
    } catch (e) {
      throw new Error("Angel One Refresh Failed: " + e.message);
    }
  }

  async getProfile(accessToken) {
    try {
      const response = await this.client.get('/rest/secure/angelbroking/user/v1/getProfile', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = response.data.data;
      return {
        id: data.clientcode,
        name: data.name,
        email: data.email,
        balances: { margin: 0, available: 0 } // RMS fetch requires separate call in SmartAPI
      };
    } catch (err) {
      throw new Error(`Failed to fetch Angel One profile: ${err.message}`);
    }
  }

  async getHoldings(accessToken) {
    try {
      const response = await this.client.get('/rest/secure/angelbroking/portfolio/v1/getHolding', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      if (!response.data.data) return [];
      
      return response.data.data.map(h => ({
        symbol: h.tradingsymbol,
        quantity: parseInt(h.quantity, 10),
        averagePrice: parseFloat(h.averageprice),
        currentPrice: parseFloat(h.ltp),
        pnl: parseFloat(h.profitandloss)
      }));
    } catch (err) {
      throw new Error(`Failed to fetch Angel holdings: ${err.message}`);
    }
  }

  async placeOrder(accessToken, orderConfig) {
    try {
      const orderPayload = {
        variety: "NORMAL",
        tradingsymbol: orderConfig.symbol,
        symboltoken: "3045", // Mocking token resolution for demo, SmartAPI requires exact token maps
        transactiontype: orderConfig.action === 'BUY' ? 'BUY' : 'SELL',
        exchange: "NSE",
        ordertype: orderConfig.type === 'MARKET' ? 'MARKET' : 'LIMIT',
        producttype: "DELIVERY",
        duration: "DAY",
        price: (orderConfig.price || 0).toString(),
        squareoff: "0",
        stoploss: "0",
        quantity: orderConfig.quantity.toString()
      };

      const response = await this.client.post('/rest/secure/angelbroking/order/v1/placeOrder', orderPayload, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      if (!response.data.status) throw new Error(response.data.message);

      return {
        orderId: response.data.data.orderid,
        status: 'PENDING_EXCHANGE',
        message: `Order submitted to Angel One: ${response.data.data.orderid}`
      };
    } catch (err) {
      throw new Error(`Angel One Order Placement Failed: ${err.message}`);
    }
  }

  async getMarketFeedConfig(accessToken) {
    // Angel One uses standard WSS with client code and feed token
    return {
      wsUrl: 'wss://smartapisocket.angelone.in/smart-stream',
      payload: {
        accessToken: accessToken,
        clientCode: this.clientCode
      }
    };
  }
}
