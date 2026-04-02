import { Stack } from 'expo-router'

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="location" options={{ animation: 'fade' }} />
      <Stack.Screen name="genres" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="artists" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="tutorial" options={{ animation: 'fade' }} />
    </Stack>
  )
}
