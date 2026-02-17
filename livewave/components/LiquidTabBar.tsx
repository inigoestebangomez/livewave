import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Platform, Dimensions } from 'react-native'
import { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { BlurView } from 'expo-blur'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const { width } = Dimensions.get('window')

export default function LiquidTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()

  // Define icons mapping based on route names
  const getIconName = (routeName: string, isFocused: boolean) => {
    switch (routeName) {
      case 'calendar':
        return isFocused ? 'calendar' : 'calendar-outline'
      case 'search':
        return isFocused ? 'search' : 'search-outline'
      case 'home':
        return isFocused ? 'home' : 'home-outline'
      case 'recommendations':
        return isFocused ? 'heart' : 'heart-outline'
      case 'settings':
        return isFocused ? 'cog' : 'cog-outline'
      default:
        return 'ellipse-outline'
    }
  }

  return (
    <View style={[styles.container, { bottom: insets.bottom }]}>
      <BlurView
        intensity={80}
        tint="systemMaterialDark"
        style={[StyleSheet.absoluteFill, styles.blurView]}
      />
      <View style={styles.tabContainer}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key]
          const isFocused = state.index === index

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            })

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name)
            }
          }

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            })
          }

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tabItem}
            >
              {isFocused && (
                <View style={styles.activeBackground} />
              )}
              <Ionicons
                name={getIconName(route.name, isFocused)}
                size={24}
                color={isFocused ? '#fff' : '#8E8E93'}
              />
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 65,
    borderRadius: 35,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 10,
  },
  blurView: {
    borderRadius: 35,
  },
  tabContainer: {
    flexDirection: 'row',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 5,
  },
  tabItem: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 35,
  },
  activeBackground: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#b10404', // Brand color
    opacity: 0.8,
  },
})
