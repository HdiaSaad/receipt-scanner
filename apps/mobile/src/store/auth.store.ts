import { create } from 'zustand';
import { api } from '../services/api';
import { storage } from '../services/storage';
import type { UserProfile, AuthResponse } from '@receipt-scanner/shared';

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  login: (response: AuthResponse) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,

  login: async (response: AuthResponse) => {
    await storage.setTokens(response.accessToken, response.refreshToken);
    set({ user: response.user, isAuthenticated: true });
  },

  logout: async () => {
    try {
      await api.delete('/auth/logout');
    } catch {
      // best-effort
    }
    await storage.clearTokens();
    set({ user: null, isAuthenticated: false });
  },

  restoreSession: async () => {
    const token = await storage.getAccessToken();
    if (!token) return;
    try {
      const { data } = await api.get<UserProfile>('/users/me');
      set({ user: data, isAuthenticated: true });
    } catch {
      await storage.clearTokens();
    }
  },
}));
