import * as SecureStore from 'expo-secure-store';

// AFTER_FIRST_UNLOCK: token survives background tasks once the user has unlocked
// the device once after boot. Default WHEN_UNLOCKED throws KeyChainException in
// background/cold-start contexts before the first interactive unlock.
// ponytail: single global option, per-key granularity if needed later
const TOKEN_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export const tokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key, TOKEN_OPTIONS);
    } catch (error) {
      console.warn('SecureStore get item error: ', error);
      // Delete the inaccessible item so a fresh token can be stored next sign-in.
      SecureStore.deleteItemAsync(key, TOKEN_OPTIONS).catch(() => null);
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      return SecureStore.setItemAsync(key, value, TOKEN_OPTIONS);
    } catch (err) {
      console.warn('SecureStore save item error: ', err);
      return;
    }
  },
  async clearToken(key: string) {
    try {
      return SecureStore.deleteItemAsync(key, TOKEN_OPTIONS);
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
