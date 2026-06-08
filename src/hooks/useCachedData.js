import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

// Global LRU Cache
const memoryCache = new Map();
const MAX_CACHE_SIZE = 100;

// Helper to manage cache eviction
const setCache = (key, data, ttlMs) => {
  if (memoryCache.size >= MAX_CACHE_SIZE) {
    // Evict oldest entry (Map iterates in insertion order)
    const firstKey = memoryCache.keys().next().value;
    memoryCache.delete(firstKey);
  }
  memoryCache.set(key, {
    data,
    expiry: Date.now() + ttlMs
  });
};

const getCache = (key) => {
  const item = memoryCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiry) {
    memoryCache.delete(key);
    return null; // Expired
  }
  return item.data;
};

export default function useCachedData(url, { ttl = 60000, enabled = true, cacheKey = '' } = {}) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // Initial load (skeleton)
  const [isFetching, setIsFetching] = useState(false); // Background refresh
  const [error, setError] = useState(null);
  
  const finalCacheKey = cacheKey || url;

  useEffect(() => {
    if (!enabled || !url) return;

    const abortController = new AbortController();
    
    const fetchData = async () => {
      setError(null);
      
      const cached = getCache(finalCacheKey);
      if (cached) {
        setData(cached);
        setIsLoading(false);
        // We still fetch in background if we want, but since TTL handles expiration, we can just use cache.
        if (process.env.NODE_ENV === 'development') {
           console.log(`[Cache HIT] ${finalCacheKey}`);
        }
        return;
      }
      
      if (process.env.NODE_ENV === 'development') {
         console.log(`[Cache MISS] ${finalCacheKey} - Fetching...`);
      }

      if (!data) setIsLoading(true);
      setIsFetching(true);
      
      const startTime = performance.now();

      try {
        const response = await axios.get(url, { signal: abortController.signal });
        const endTime = performance.now();
        
        if (process.env.NODE_ENV === 'development') {
           console.log(`[Performance] ${finalCacheKey} took ${(endTime - startTime).toFixed(2)}ms`);
        }
        
        setCache(finalCacheKey, response.data, ttl);
        setData(response.data);
      } catch (err) {
        if (axios.isCancel(err)) {
          console.log(`[API Cancelled] ${finalCacheKey}`);
        } else {
          setError(err.response?.data?.detail || err.message || 'Failed to fetch');
        }
      } finally {
        setIsLoading(false);
        setIsFetching(false);
      }
    };

    fetchData();

    return () => {
      abortController.abort();
    };
  }, [url, enabled, finalCacheKey, ttl]);

  // Method to manually clear cache for this key
  const invalidate = () => {
    memoryCache.delete(finalCacheKey);
  };

  return { data, isLoading, isFetching, error, invalidate };
}
