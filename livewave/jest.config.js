module.exports = {
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|react-navigation|@react-navigation/.*)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
  setupFilesAfterEnv: ['./jest.setup.js'],
  moduleNameMapper: {
    '^../../types/api$': '<rootDir>/types/api.ts',
    '^../../types/supabase$': '<rootDir>/types/supabase.ts',
    '^../../types$': '<rootDir>/types/index.ts',
    '^../app/lib/supabase$': '<rootDir>/__mocks__/supabase.ts',
    '^../app/lib/api$': '<rootDir>/__mocks__/api.ts',
  },
}
