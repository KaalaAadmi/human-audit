import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, ActivityIndicator } from 'react-native';
import * as Notifications from 'expo-notifications';
import { ClerkProvider, useAuth } from '@clerk/expo';
import * as SecureStore from 'expo-secure-store';
import { Colors } from '../theme/colors';
import { CLERK_PUBLISHABLE_KEY, tokenCache } from '../lib/clerk';
import { BiometricPrivacyLock } from '../components/BiometricPrivacyLock';
// Importing this file defines the background task and HealthKit subscriptions at module scope, before any screen mounts.
import { syncAll } from '../services/connectors';
import { SyncService } from '../services/syncService';
import { DEFAULT_REMINDER_START_MIN, DEFAULT_REMINDER_END_MIN, scheduleWaterReminders } from '../services/waterReminders';

// Show reminders as a banner even while the app is open (the default is to swallow them in the foreground).
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

function RootLayoutNav() {
  const { isSignedIn, isLoaded } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;

    const inAuthGroup = segments[0] === 'auth';

    if (!isSignedIn && !inAuthGroup) {
      router.replace('/auth/login');
    } else if (isSignedIn && inAuthGroup) {
      // New sign-in: check onboarding flag before forwarding
      SecureStore.getItemAsync('humanaudit_onboarding_completed').then(flag => {
        if (flag === 'false') {
          router.replace('/onboarding');
        } else {
          router.replace('/(tabs)');
        }
      });
    }
  }, [isSignedIn, isLoaded, segments]);

  // Register this phone and pull new health data on every cold start / sign-in (syncAll throttles itself).
  useEffect(() => {
    if (isLoaded && isSignedIn) syncAll().catch((e) => console.warn('[CONNECTORS_SYNC_ERR]', e));
  }, [isLoaded, isSignedIn]);

  // Reminders are device-local, so a fresh install / reinstall has none until we schedule them from the saved profile.
  // This is also what triggers the iOS permission prompt (and creates the Notifications row in iOS Settings).
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    SyncService.fetchUserProfile()
      .then((p) => scheduleWaterReminders(
        p?.water_reminder_enabled ?? true,
        p?.water_reminder_start_min ?? DEFAULT_REMINDER_START_MIN,
        p?.water_reminder_end_min ?? DEFAULT_REMINDER_END_MIN,
        p?.water_reminder_interval_mins || 90,
      ))
      .catch((e) => console.warn('[REMINDER_SYNC_ERR]', e));
  }, [isLoaded, isSignedIn]);

  return (
    <BiometricPrivacyLock isAuthenticated={Boolean(isSignedIn)}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.canvas },
        }}
      />
    </BiometricPrivacyLock>
  );
}

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.canvas }}>
        <SafeAreaProvider>
          <RootLayoutNav />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ClerkProvider>
  );
}
