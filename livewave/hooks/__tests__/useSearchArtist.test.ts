import { renderHook, act } from '@testing-library/react-native'
import { useSearchArtist } from '../useSearchArtist'

// Mock global fetch
global.fetch = jest.fn()

// Mock react-native
jest.mock('react-native', () => ({
  DeviceEventEmitter: { emit: jest.fn() },
  Alert: { alert: jest.fn() },
  Platform: { OS: 'ios' },
  StyleSheet: { create: (s: unknown) => s },
}))

// Mock supabase
jest.mock('../../app/lib/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: { id: 'artist-1' }, error: null }),
    auth: {
      getUser: jest.fn().mockResolvedValue({ 
        data: { user: { id: 'user-123' } }, 
        error: null 
      }),
    },
  },
}))

jest.mock('../../app/lib/api', () => ({
  API_URL: 'http://localhost:8082',
}))

describe('useSearchArtist', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockReset()
  })

  it('estado inicial es correcto', () => {
    const { result } = renderHook(() => useSearchArtist())
    expect(result.current.query).toBe('')
    expect(result.current.suggestions).toEqual([])
    expect(result.current.selectedArtist).toBeNull()
    expect(result.current.events).toEqual([])
    expect(result.current.loading).toBe(false)
  })

  it('clearSearch resetea el estado', () => {
    const { result } = renderHook(() => useSearchArtist())

    act(() => {
      result.current.clearSearch()
    })

    expect(result.current.query).toBe('')
    expect(result.current.suggestions).toEqual([])
    expect(result.current.selectedArtist).toBeNull()
    expect(result.current.events).toEqual([])
  })

  it('handleSearchChange no busca con query < 2 chars', async () => {
    const { result } = renderHook(() => useSearchArtist())

    await act(async () => {
      await result.current.handleSearchChange('M')
    })

    expect(global.fetch).not.toHaveBeenCalled()
    expect(result.current.suggestions).toEqual([])
  })

  it('handleSearchChange busca con query >= 2 chars', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ _embedded: { attractions: [{ id: '1', name: 'Muse' }] } }),
    })

    const { result } = renderHook(() => useSearchArtist())

    await act(async () => {
      await result.current.handleSearchChange('Mu')
    })

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/suggest?keyword=Mu')
    )
  })
})
