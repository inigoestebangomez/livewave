import { Ionicons } from '@expo/vector-icons'
import { Tabs } from 'expo-router'
import { StyleSheet } from 'react-native'

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
      }}
    >
      <Tabs.Screen
        name="calendar"
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name="calendar-outline"
              size={focused ? 30 : 26}
              color={focused ? '#fff' : '#aaa'}
              style={[styles.iconBase, focused && styles.iconFocused]}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name="search-outline"
              size={focused ? 30 : 26}
              color={focused ? '#fff' : '#aaa'}
              style={[styles.iconBase, focused && styles.iconFocused]}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name="ellipse-outline"
              size={focused ? 30 : 26}
              color={focused ? '#fff' : '#aaa'}
              style={[styles.iconHome, focused && styles.iconFocused]}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="user"
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name="person-outline"
              size={focused ? 30 : 26}
              color={focused ? '#fff' : '#aaa'}
              style={[styles.iconBase, focused && styles.iconFocused]}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name="cog-outline"
              size={focused ? 30 : 26}
              color={focused ? '#fff' : '#aaa'}
              style={[styles.iconBase, focused && styles.iconFocused]}
            />
          ),
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: 'transparent',
    position: 'absolute',
    borderTopWidth: 0,
    elevation: 0,
    height: 65,
  },
  iconBase: {
    borderRadius: 12,
  },
  iconFocused: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  iconHome: {
    padding: 12,
    borderRadius: 16,
  },
})
