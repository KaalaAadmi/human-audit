import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, ActivityIndicator } from 'react-native';
import { ClerkProvider, useAuth } from '@clerk/expo';
import * as SecureStore from 'expo-secure-store';
import { Colors } from '../theme/colors';
import { CLERK_PUBLISHABLE_KEY, tokenCache } from '../lib/clerk';
import { BiometricPrivacyLock } from '../components/BiometricPrivacyLock';

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
