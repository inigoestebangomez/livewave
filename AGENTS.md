# LiveWave - Agent Guidelines

## Project Overview
LiveWave is an Expo/React Native/TypeScript mobile app for discovering and tracking live music concerts. Uses expo-router for file-based routing and Supabase for backend services.

## Build & Development Commands

### Development Server
```bash
npm start              # Start Expo dev server
npm run android        # expo start --android
npm run ios            # expo start --ios
npm run web            # expo start --web
```

### Linting
```bash
npm run lint           # Run ESLint (expo-config-expo flat config)
```

### Type Checking
```bash
npx tsc --noEmit       # TypeScript type checking (no explicit script)
```

### Project Reset
```bash
npm run reset-project  # Resets to blank app directory
```

### Testing
Jest is configured for both the livewave app and the proxy server.

#### Livewave (React Native)
```bash
npm test              # Run all tests
npm test -- path/to/file.test.tsx    # Single test file
npm test -- --watch                  # Watch mode
```

#### Proxy (Node.js)
```bash
cd proxy && npm test                  # Run all proxy tests
cd proxy && npm test -- --watch       # Watch mode
```

## Project Structure
```
livewave/
├── app/                    # Expo router screens (file-based routing)
│   ├── _layout.tsx         # Root layout (providers, toast config)
│   ├── index.tsx           # Landing/auth screen
│   ├── (auth)/             # Auth screens (login, register, etc.)
│   ├── (onboarding)/       # Onboarding flow screens
│   ├── (tabs)/             # Main tab navigation screens
│   └── lib/                # Utilities (supabase, api, notifications)
├── components/             # Shared reusable components
├── assets/                 # Static assets (images, icons)
```

## Code Style Guidelines

### TypeScript
- Strict mode enabled (`"strict": true` in tsconfig)
- Avoid `any` - use proper types or generics
- Use `type` for unions/primitives, `interface` for object shapes
- Type Supabase responses: `const { data, error }: { data: Profile | null; error: PostgrestError | null } = ...`

### Imports
```tsx
// 1. React & React Native core
import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, StyleSheet, Platform } from 'react-native'

// 2. Third-party libraries
import { useUser } from '@supabase/auth-helpers-react'
import { Ionicons } from '@expo/vector-icons'

// 3. Project imports (use relative for app/ internal, no @/ alias used)
import { supabase } from '../lib/supabase'
import LiquidTabBar from '../../components/LiquidTabBar'
```

### Component Patterns
- Default export: `export default function ComponentName() { ... }`
- Functional components with hooks at top level
- Early returns for loading/conditional states
- Callbacks wrapped in `useCallback` when passed as props
- StyleSheet at file bottom: `const styles = StyleSheet.create({ ... })`

### Naming Conventions
- **Files**: `kebab-case.tsx` for screens, `PascalCase.tsx` for components
- **Components**: PascalCase (`LiquidTabBar`, `LoggedHome`)
- **Functions/variables**: camelCase (`fetchData`, `handleLogin`)
- **Constants**: UPPER_SNAKE_CASE (`API_URL`)
- **Types**: PascalCase (`UserProfile`)

### Styling
- Use `StyleSheet.create()` - defined at bottom of file
- Dark theme primary: background `#000`, accents `#b10404` (brand red)
- Use `react-native-safe-area-context` for insets
- Platform-specific code: `{Platform.OS === 'ios' && <Component />}`
- Gradient backgrounds via `expo-linear-gradient`

### Error Handling
```tsx
try {
  const { data, error } = await supabase.from('table').select('*')
  if (error) throw error
  // process data
} catch (error: any) {
  Alert.alert('Error', error.message)
} finally {
  setLoading(false)
}
```

### Supabase Patterns
- Client initialized in `app/lib/supabase.ts`
- Use `@supabase/auth-helpers-react` hooks: `useUser()`, `useSession()`
- Auth state checks: `const { data } = await supabase.auth.getSession()`
- Typed queries with `.select('field', { count: 'exact' })`

### Navigation (expo-router)
```tsx
import { useRouter, Link } from 'expo-router'
const router = useRouter()
router.replace('/(tabs)/home')    // Replace history
router.push('/details')           // Push to stack
<Link href="/screen">Text</Link>  // Declarative navigation
```

## Key Dependencies
- `expo` ~54.0, `react-native` 0.81.5, `react` 19.1.0
- `expo-router` ~6.0 - File-based routing
- `@supabase/supabase-js` ^2.50 - Backend/auth
- `react-native-toast-message` - Toast notifications
- `expo-linear-gradient` - Gradient backgrounds
- `@expo/vector-icons` (Ionicons) - Icons

## Environment Variables
Required in `.env` (prefixed for Expo):
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

## Common Patterns
- Pull-to-refresh: `RefreshControl` in `ScrollView`
- Device events: `DeviceEventEmitter` for cross-component communication
- Dynamic imports for heavy modules: `const mod = await import('./lib/notifications')`
- Auth flow: Check session → check onboarding → navigate accordingly
