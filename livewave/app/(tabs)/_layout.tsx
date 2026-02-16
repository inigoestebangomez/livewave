import { Ionicons } from '@expo/vector-icons'
import { Tabs } from 'expo-router'
import { StyleSheet, Platform } from 'react-native'
import LiquidTabBar from '../../components/LiquidTabBar'

export default function TabLayout() {
  return (
    <Tabs
      tabBar={props => <LiquidTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false, // Labels are handled in CustomTabBar if needed, or hidden
        tabBarStyle: { position: 'absolute' }, // Required for transparency behind it if needed, though CustomTabBar handles container
        tabBarBackground: () => null, // We handle background in CustomTabBar
      }}
    >
      <Tabs.Screen
        name="calendar"
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? 'calendar' : 'calendar-outline'}
              size={24}
              color={focused ? '#fff' : '#8E8E93'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? 'search' : 'search-outline'}
              size={24}
              color={focused ? '#fff' : '#8E8E93'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={24}
              color={focused ? '#fff' : '#8E8E93'}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="recommendations"
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? 'heart' : 'heart-outline'}
              size={24}
              color={focused ? '#fff' : '#8E8E93'}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? 'cog' : 'cog-outline'}
              size={24}
              color={focused ? '#fff' : '#8E8E93'}
            />
          ),
        }}
      />
    </Tabs>
  )
}
