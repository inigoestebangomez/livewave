import { renderHook, waitFor } from '@testing-library/react-native'
import { useUserEvents } from '../useUserEvents'

// Mock useUser from supabase auth helpers
jest.mock('@supabase/auth-helpers-react', () => ({
  useUser: jest.fn(() => ({ id: 'user-123', email: 'test@test.com' })),
}))

// Mock DeviceEventEmitter sin cargar react-native real
jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter', () => {
  return jest.fn().mockImplementation(() => ({
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    emit: jest.fn(),
  }))
})

jest.mock('react-native', () => ({
  DeviceEventEmitter: {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    emit: jest.fn(),
  },
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
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({ data: [] }),
  },
}))

describe('useUserEvents', () => {
  it('devuelve loading=false tras cargar', async () => {
    const { result } = renderHook(() => useUserEvents())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.events).toEqual([])
  })

  it('maneja usuario no autenticado', async () => {
    const { useUser } = require('@supabase/auth-helpers-react')
    useUser.mockReturnValueOnce(null)

    const { result } = renderHook(() => useUserEvents())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.events).toEqual([])
    })
  })

  it('devuelve eventos cuando hay datos', async () => {
    const mockEvents = [
      { id: 'evt-1', date: '2026-05-01', venue: 'Sala Apolo', city: 'Barcelona', country: 'España', artist_id: 'art-1', external_url: null, artist: { name: 'Muse', image_url: 'http://img.jpg' } },
    ]
    
    const { supabase } = require('../../app/lib/supabase')
    supabase.eq.mockResolvedValueOnce({ data: [{ event_id: 'evt-1' }] })
    supabase.order.mockResolvedValueOnce({ data: mockEvents })

    const { result } = renderHook(() => useUserEvents())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
  })
})
