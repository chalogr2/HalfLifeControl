import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '@/theme';

export default function TabsLayout() {
  return (
    <Tabs
      // Back (header arrow or Android key) returns to the tab you came from —
      // e.g. Settings → Subscription → back lands on Settings, not Dashboard.
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.onSurfaceVariant,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
      {/* Reached from Settings / the free-tier limit; hidden from the bar but
          keeps the bar on screen so it navigates like any other page. */}
      <Tabs.Screen name="paywall" options={{ href: null, title: 'Pro' }} />
      <Tabs.Screen name="policies" options={{ href: null, title: 'Legal' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surfaceContainerLow,
    borderTopWidth: 0,
    elevation: 0,
    height: 64,
    paddingTop: spacing[2],
  },
  tabLabel: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 12,
  },
});
