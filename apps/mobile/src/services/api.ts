import axios from 'axios';
import { storage } from './storage';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const api = axios.create({ baseURL: BASE_URL });

// Attach access token to every request
api.interceptors.request.use(async (config) => {
  const token = await storage.getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }
    originalRequest._retry = true;

    if (isRefreshing) {
      return new Promise((resolve) => {
        refreshQueue.push((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          resolve(api(originalRequest));
        });
      });
    }

    isRefreshing = true;
    try {
      const refreshToken = await storage.getRefreshToken();
      const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
      const { accessToken } = data;
      await storage.setTokens(accessToken, refreshToken!);
      refreshQueue.forEach((cb) => cb(accessToken));
      refreshQueue = [];
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return api(originalRequest);
    } catch {
      await storage.clearTokens();
      window.location.href = '/auth/login';
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  },
);
