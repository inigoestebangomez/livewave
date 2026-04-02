import { renderHook, waitFor } from '@testing-library/react-native'
import { useRecommendations } from '../useRecommendations'

// Mock useUser
jest.mock('@supabase/auth-helpers-react', () => ({
  useUser: jest.fn(() => ({ id: 'user-123', email: 'test@test.com' })),
}))

// Mock useFocusEffect
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react')
    useEffect(cb, [])
  },
}))

// Mock react-native
jest.mock('react-native', () => ({
  DeviceEventEmitter: { emit: jest.fn() },
  Platform: { OS: 'ios' },
  StyleSheet: { create: (s: unknown) => s },
}))

// Mock supabase
jest.mock('../../app/lib/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ 
      data: { location_latitude: '41.38', location_longitude: '2.17', radius_km: 50 }, 
      error: null 
    }),
  },
}))

// Mock API functions
jest.mock('../../app/lib/api', () => ({
  getEventsForArtist: jest.fn().mockResolvedValue([]),
  getConcertRecommendations: jest.fn().mockResolvedValue({ seed: 'Muse', events: [] }),
  getDiscoverArtists: jest.fn().mockResolvedValue([]),
}))

jest.mock('../../hooks/useCityLabel', () => ({
  getCityLabel: jest.fn().mockReturnValue('Barcelona'),
}))

describe('useRecommendations', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('devuelve loading=true inicialmente', () => {
    const { supabase } = require('../../app/lib/supabase')
    supabase.eq.mockResolvedValue({ data: [] })
    
    const { result } = renderHook(() => useRecommendations())
    expect(result.current.loading).toBe(true)
  })

  it('maneja usuario no autenticado', async () => {
    const { useUser } = require('@supabase/auth-helpers-react')
    useUser.mockReturnValueOnce(null)

    const { result } = renderHook(() => useRecommendations())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.recommendedEvents).toEqual([])
      expect(result.current.yourEvents).toEqual([])
    })
  })

  it('devuelve eventos vacíos cuando no hay seguidos', async () => {
    const { supabase } = require('../../app/lib/supabase')
    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { location_latitude: '41.38', location_longitude: '2.17', radius_km: 50 }, error: null }),
          limit: jest.fn().mockResolvedValue({ data: [] }),
          then: jest.fn().mockResolvedValue({ data: [] }),
        }),
      }),
    })

    const { result } = renderHook(() => useRecommendations())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
  })
})
