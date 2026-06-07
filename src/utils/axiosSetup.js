import axios from 'axios';
import { API_BASE_URL } from '../config';

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Expose a way to refresh token globally
export const refreshBrokerToken = async () => {
  const refreshToken = localStorage.getItem('broker_refresh_token');
  if (!refreshToken || refreshToken === 'undefined' || refreshToken === 'null') {
    window.dispatchEvent(new Event('broker_session_expired'));
    throw new Error('Broker session expired. Secure reconnection required.');
  }
  
  try {
    const res = await axios.post(`${API_BASE_URL}/api/broker/refresh`, { refresh_token: refreshToken });
    const { access_token, expires_at } = res.data;
    localStorage.setItem('broker_access_token', access_token);
    localStorage.setItem('broker_expires_at', expires_at);
    return access_token;
  } catch (err) {
    localStorage.removeItem('broker_access_token');
    localStorage.removeItem('broker_refresh_token');
    localStorage.removeItem('broker_expires_at');
    throw err;
  }
};

axiosInstance.interceptors.request.use(async (config) => {
  // Pre-check token expiry
  const expiresAt = localStorage.getItem('broker_expires_at');
  if (expiresAt && !config.url.includes('/broker/refresh') && !config.url.includes('/broker/connect')) {
    if (Date.now() >= parseInt(expiresAt, 10) - 5000) { // 5s pre-check for testing (originally 60s)
      console.log('[AXIOS] Token expiring soon. Proactively refreshing...');
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const newToken = await refreshBrokerToken();
          isRefreshing = false;
          processQueue(null, newToken);
        } catch (err) {
          isRefreshing = false;
          processQueue(err, null);
          return Promise.reject(err);
        }
      } else {
        await new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        });
      }
    }
  }
  
  config.headers = config.headers || {};
  const token = localStorage.getItem('broker_access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url.includes('/broker/refresh')) {
      originalRequest._retry = true;
      
      if (isRefreshing) {
        return new Promise(function(resolve, reject) {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers['Authorization'] = 'Bearer ' + token;
          return axiosInstance(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }
      
      originalRequest._retry = true;
      
      const refreshToken = localStorage.getItem('broker_refresh_token');
      if (!refreshToken || refreshToken === 'undefined' || refreshToken === 'null') {
         console.error('[AXIOS] No valid refresh token found. Aborting refresh queue.');
         window.dispatchEvent(new Event('broker_session_expired'));
         return Promise.reject(new Error('Broker session expired. Secure reconnection required.'));
      }
      
      isRefreshing = true;
      console.log('[AXIOS] 401 Received. Starting centralized token refresh queue...');
      
      try {
        const newToken = await refreshBrokerToken();
        isRefreshing = false;
        processQueue(null, newToken);
        originalRequest.headers['Authorization'] = 'Bearer ' + newToken;
        console.log('[AXIOS] Token refreshed successfully. Replaying queued requests.');
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        processQueue(refreshError, null);
        console.error('[AXIOS] Token refresh completely failed. Session invalid.');
        // Trigger global event for UI to catch and disconnect sockets
        window.dispatchEvent(new Event('broker_session_expired'));
        return Promise.reject(refreshError);
      }
    }

    if (!error.response) {
      error.customMessage = 'NETWORK_ERROR: Internet connection issue or server unavailable.';
      return Promise.reject(error);
    }
    
    switch (error.response.status) {
      case 401:
        error.customMessage = 'TOKEN_EXPIRED: Session expired. Please reconnect broker.';
        break;
      case 403:
        error.customMessage = 'FORBIDDEN: Broker authorization denied. Check API credentials.';
        break;
      case 429:
        error.customMessage = 'RATE_LIMIT: Rate limit exceeded. Please wait before retrying.';
        break;
      case 500:
      case 502:
      case 503:
        error.customMessage = 'SERVER_ERROR: Broker service currently unavailable.';
        break;
      default:
        error.customMessage = error.response.data?.detail || 'An unexpected error occurred.';
    }
    
    return Promise.reject(error);
  }
);

export default axiosInstance;
