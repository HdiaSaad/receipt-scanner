import { Preferences } from '@capacitor/preferences';

const KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
} as const;

export const storage = {
  async setTokens(access: string, refresh: string): Promise<void> {
    await Preferences.set({ key: KEYS.ACCESS_TOKEN, value: access });
    await Preferences.set({ key: KEYS.REFRESH_TOKEN, value: refresh });
  },
  async getAccessToken(): Promise<string | null> {
    const { value } = await Preferences.get({ key: KEYS.ACCESS_TOKEN });
    return value;
  },
  async getRefreshToken(): Promise<string | null> {
    const { value } = await Preferences.get({ key: KEYS.REFRESH_TOKEN });
    return value;
  },
  async clearTokens(): Promise<void> {
    await Preferences.remove({ key: KEYS.ACCESS_TOKEN });
    await Preferences.remove({ key: KEYS.REFRESH_TOKEN });
  },
};
