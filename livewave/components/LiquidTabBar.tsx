import React, { useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Platform, Dimensions, Animated } from 'react-native'
import { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { BlurView } from 'expo-blur'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const { width } = Dimensions.get('window')

export default function LiquidTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()

  // Calculate dimensions for animation
  const containerWidth = width - 40 // left 20, right 20
  const tabWidth = containerWidth / state.routes.length
  const bubbleSize = 50
  const bubbleOffset = (tabWidth - bubbleSize) / 2

  const translateX = useRef(new Animated.Value(state.index * tabWidth)).current

  useEffect(() => {
    Animated.spring(translateX, {
      toValue: state.index * tabWidth,
      useNativeDriver: true,
      bounciness: 8, // slight liquid bounce
      speed: 12
    }).start()
  }, [state.index])

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
        intensity={100}
        tint={Platform.OS === 'ios' ? 'systemThinMaterialDark' : 'dark'}
        experimentalBlurMethod="dimezisBlurView"
        style={[StyleSheet.absoluteFill, styles.blurView]}
      />
      <View style={styles.tabContainer}>
        {/* The sliding bubble */}
        <Animated.View
          style={[
            styles.activeBackground,
            {
              left: bubbleOffset,
              transform: [{ translateX }],
            }
          ]}
        />
        
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
      height: 10,
    },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    backgroundColor: 'transparent',
  },
  blurView: {
    borderRadius: 35,
  },
  tabContainer: {
    flexDirection: 'row',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 0, // removed padding to keep calculations simpler
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
