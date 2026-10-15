import React from 'react';
import { Tabs } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../theme/colors';

interface TabIconProps {
  emoji: string;
  name: string;
  focused: boolean;
  color?: string;
}

function TabIcon({ emoji, name, focused, color = Colors.bioGreen }: TabIconProps) {
  return (
    <View style={styles.tabItem}>
      <Text style={{ fontSize: 18, opacity: focused ? 1 : 0.45 }}>{emoji}</Text>
      <Text
        style={[
          styles.tabLabel,
          { color: focused ? color : Colors.textMuted, fontWeight: focused ? '700' : '500' },
        ]}
      >
        {name}
      </Text>
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
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" name="Audit" focused={focused} color={Colors.bioGreen} />,
        }}
      />
      <Tabs.Screen
        name="water"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="💧" name="Water" focused={focused} color={Colors.hydration} />,
        }}
      />
      <Tabs.Screen
        name="diary"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🥗" name="Diary" focused={focused} color={Colors.bioGreen} />,
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="⚡" name="Vitals" focused={focused} color={Colors.bioAmber} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="⚙️" name="System" focused={focused} color={Colors.textPure} />,
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
    gap: 3,
  },
  tabLabel: {
    fontSize: 10,
    letterSpacing: 0.3,
  },
});
