// Definir __DEV__ para React Native en Jest
global.__DEV__ = true

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

// Silence warnings in tests
global.console.warn = jest.fn()
global.console.error = jest.fn()
