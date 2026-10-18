import * as SecureStore from 'expo-secure-store';

export const tokenCache = {
  async getToken(key: string) {
    try {
      const item = await SecureStore.getItemAsync(key);
      return item;
    } catch (error) {
      console.warn('SecureStore get item error: ', error);
      await SecureStore.deleteItemAsync(key);
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      return SecureStore.setItemAsync(key, value);
    } catch (err) {
      console.warn('SecureStore save item error: ', err);
      return;
    }
  },
  async clearToken(key: string) {
    try {
      return SecureStore.deleteItemAsync(key);
    } catch (err) {
      return;
    }
  },
};

import Constants from 'expo-constants';

export const CLERK_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  (Constants.expoConfig?.extra as any)?.clerkPublishableKey ||
  (Constants.expoConfig?.extra as any)?.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ||
  '';

export const isClerkConfigured = Boolean(
  CLERK_PUBLISHABLE_KEY &&
  !CLERK_PUBLISHABLE_KEY.includes('placeholder') &&
  (CLERK_PUBLISHABLE_KEY.startsWith('pk_test_') || CLERK_PUBLISHABLE_KEY.startsWith('pk_live_'))
);
