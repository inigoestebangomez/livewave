import { useEffect, useState, useCallback } from 'react'
import { DeviceEventEmitter } from 'react-native'
import { useUser } from '@supabase/auth-helpers-react'
import { supabase } from '../app/lib/supabase'
import type { EventWithArtist } from '../types/supabase'

interface UseUserEventsOptions {
  futureOnly?: boolean
  listenRefresh?: boolean
}

interface UseUserEventsReturn {
  events: EventWithArtist[]
  loading: boolean
  refreshing: boolean
  refresh: () => Promise<void>
}

export function useUserEvents(options: UseUserEventsOptions = {}): UseUserEventsReturn {
  const { futureOnly = false, listenRefresh = true } = options
  const user = useUser()
  const [events, setEvents] = useState<EventWithArtist[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchEvents = useCallback(async () => {
    if (!user) {
      setEvents([])
      setLoading(false)
      return
    }

    try {
      const { data: userEvents } = await supabase
        .from('user_events')
        .select('event_id')
        .eq('user_id', user.id)

      const eventIds = userEvents?.map((ue) => ue.event_id) || []

      if (eventIds.length === 0) {
        setEvents([])
        return
      }

       let query = supabase
         .from('events')
         .select('id, date, venue, city, country, external_url, source, url, artist_id, artist:artist_id(name, image_url)')
         .in('id', eventIds)

      if (futureOnly) {
        const today = new Date().toISOString().split('T')[0]
        query = query.gte('date', today)
      }

      const { data } = await query.order('date', { ascending: true })

      // Supabase devuelve relaciones como arrays, normalizar a objeto
      const normalized = ((data as unknown as Array<EventWithArtist & { artist: EventWithArtist['artist'] | EventWithArtist['artist'][] }>) || []).map((e) => ({
        ...e,
        artist: Array.isArray(e.artist) ? e.artist[0] : e.artist,
      }))

      setEvents(normalized)
    } catch (error) {
      console.error('Error fetching user events:', error)
    } finally {
      setLoading(false)
    }
  }, [user, futureOnly])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    await fetchEvents()
    setRefreshing(false)
  }, [fetchEvents])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  useEffect(() => {
    if (!listenRefresh) return
    const sub = DeviceEventEmitter.addListener('refreshEvents', fetchEvents)
    return () => sub.remove()
  }, [fetchEvents, listenRefresh])

  return { events, loading, refreshing, refresh }
}
