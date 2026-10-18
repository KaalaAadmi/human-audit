import React from 'react';
import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';

type IoniconName = keyof typeof Ionicons.glyphMap;

interface TabIconProps {
  name: IoniconName;
  label: string;
  focused: boolean;
  activeColor: string;
}

function TabIcon({ name, label, focused, activeColor }: TabIconProps) {
  const iconColor = focused ? activeColor : Colors.textMuted;

  return (
    <View style={styles.tabItem}>
      <Ionicons name={name} size={19} color={iconColor} style={{ opacity: focused ? 1 : 0.6 }} />
      <Text
        numberOfLines={1}
        style={[
          styles.tabLabel,
          {
            color: iconColor,
            fontWeight: focused ? '600' : '400',
          },
        ]}
      >
        {label}
      </Text>
      {focused && <View style={[styles.activeIndicatorDot, { backgroundColor: activeColor }]} />}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? 'pulse' : 'pulse-outline'}
              label="Audit"
              focused={focused}
              activeColor={Colors.bioGreen}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="water"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? 'water' : 'water-outline'}
              label="Water"
              focused={focused}
              activeColor={Colors.hydration}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="diary"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? 'restaurant' : 'restaurant-outline'}
              label="Diary"
              focused={focused}
              activeColor={Colors.bioGreen}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? 'flame' : 'flame-outline'}
              label="Vitals"
              focused={focused}
              activeColor={Colors.bioAmber}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name={focused ? 'options' : 'options-outline'}
              label="System"
              focused={focused}
              activeColor={Colors.textPure}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.canvas,
    borderTopColor: Colors.borderMachined,
    borderTopWidth: 1,
    height: 72,
    paddingBottom: 14,
    paddingTop: 8,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    width: 60,
  },
  tabLabel: {
    fontSize: 9,
    letterSpacing: 0,
    textAlign: 'center',
  },
  activeIndicatorDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    marginTop: 1,
  },
});
