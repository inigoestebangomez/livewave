import { useState, useCallback } from 'react'
import { DeviceEventEmitter, Alert } from 'react-native'
import { supabase } from '../app/lib/supabase'
import { API_URL } from '../app/lib/api'
import slugify from 'slugify'

// Tipos para respuestas crudas de Ticketmaster
interface TMImage {
  url: string
  width?: number
}

interface TMSuggestion {
  id: string
  name: string
  images?: TMImage[]
  classifications?: { genre?: { name?: string } }[]
}

interface TMVenue {
  name?: string
  city?: { name?: string }
  country?: { name?: string }
}

interface TMEvent {
  id: string
  name: string
  dates?: { start?: { localDate?: string; dateTime?: string } }
  _embedded?: { venues?: TMVenue[]; attractions?: { name?: string; images?: TMImage[] }[] }
  url?: string
}

interface UseSearchArtistReturn {
  query: string
  setQuery: (q: string) => void
  suggestions: TMSuggestion[]
  selectedArtist: TMSuggestion | null
  events: TMEvent[]
  loading: boolean
  showAdded: boolean
  handleSearchChange: (q: string) => Promise<void>
  selectArtist: (artist: TMSuggestion) => Promise<void>
  addToCalendar: (event: TMEvent) => Promise<void>
  clearSearch: () => void
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export function useSearchArtist(): UseSearchArtistReturn {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<TMSuggestion[]>([])
  const [selectedArtist, setSelectedArtist] = useState<TMSuggestion | null>(null)
  const [events, setEvents] = useState<TMEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [showAdded, setShowAdded] = useState(false)

  const handleSearchChange = useCallback(async (q: string) => {
    setQuery(q)
    if (q.length < 2) {
      setSuggestions([])
      return
    }
    try {
      const response = await fetch(`${API_URL}/suggest?keyword=${encodeURIComponent(q)}`)
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      const data = await response.json()
      setSuggestions(data?._embedded?.attractions || [])
    } catch (err) {
      console.error('Error fetching suggestions', err)
      setSuggestions([])
    }
  }, [])

  const fetchAllEvents = useCallback(async (artistName: string): Promise<TMEvent[]> => {
    let allEvents: TMEvent[] = []
    let page = 0
    let hasMorePages = true
    const maxPages = 3
    const pageSize = 50
    const delayBetweenRequests = 500
    setLoading(true)
    try {
      while (hasMorePages && page < maxPages) {
        if (page > 0) await sleep(delayBetweenRequests)
        const response = await fetch(`${API_URL}/events?keyword=${encodeURIComponent(artistName)}&page=${page}&size=${pageSize}`)
        if (!response.ok) {
          if (response.status === 429) {
            await sleep(2000)
            const retryResponse = await fetch(`${API_URL}/events?keyword=${encodeURIComponent(artistName)}&page=${page}&size=${pageSize}`)
            if (!retryResponse.ok) break
            const retryData = await retryResponse.json()
            allEvents.push(...(retryData?._embedded?.events || []))
            page++
            hasMorePages = page < (retryData.page?.totalPages || 1) && page < maxPages
          } else {
            break
          }
        } else {
          const data = await response.json()
          allEvents.push(...(data?._embedded?.events || []))
          page++
          hasMorePages = page < (data.page?.totalPages || 1) && page < maxPages
        }
      }
      const deduped = Array.from(new Map(allEvents.map(e => [`${e.id}-${e.dates?.start?.localDate}`, e])).values())
      return deduped
    } catch (err) {
      console.error('Error fetching events', err)
      return allEvents
    } finally {
      setLoading(false)
    }
  }, [])

  const selectArtist = useCallback(async (artist: TMSuggestion) => {
    setSelectedArtist(artist)
    setSuggestions([])
    setQuery(artist.name)
    const allEvents = await fetchAllEvents(artist.name)
    setEvents(allEvents)
  }, [fetchAllEvents])

  const proceedToAdd = useCallback(async (
    artist: { id: string },
    city: string,
    country: string,
    venue: string,
    date: string,
    externalUrl: string,
    userId: string
  ) => {
     const { data: newEvent, error: eventError } = await supabase
       .from('events')
       .upsert(
         { artist_id: artist.id, city, country, venue, date, external_url: externalUrl, source: 'ticketmaster', url: externalUrl },
         { onConflict: 'artist_id,date,venue' }
       )
       .select()
       .single()

    if (eventError) {
      console.error('Error inserting event:', eventError)
      return
    }

    const { error: relError } = await supabase
      .from('user_events')
      .upsert(
        { user_id: userId, event_id: newEvent.id },
        { onConflict: 'user_id,event_id' }
      )

    if (relError) {
      console.error('Error saving to user_events:', relError)
    } else {
      setShowAdded(true)
      DeviceEventEmitter.emit('refreshEvents')
      setTimeout(() => setShowAdded(false), 2000)
    }
  }, [])

  const addToCalendar = useCallback(async (event: TMEvent) => {
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error('No se pudo obtener el usuario:', userError)
      return
    }

    const artistName = event._embedded?.attractions?.[0]?.name || 'Unknown'
    const artistSlug = slugify(artistName, { lower: true })

    const artistImages = selectedArtist?.images || event._embedded?.attractions?.[0]?.images || []
    const sortedImages = artistImages.sort((a, b) => (b.width || 0) - (a.width || 0))
    const imageUrl = sortedImages[0]?.url || ''

    const { data: artist, error: artistError } = await supabase
      .from('artists')
      .upsert({ name: artistName, slug: artistSlug, image_url: imageUrl }, { onConflict: 'slug' })
      .select()
      .single()

    if (artistError) {
      console.error('Error inserting artist:', artistError)
      return
    }

    const date = event.dates?.start?.dateTime || event.dates?.start?.localDate || ''
    const venue = event._embedded?.venues?.[0]?.name || ''
    const city = event._embedded?.venues?.[0]?.city?.name || ''
    const country = event._embedded?.venues?.[0]?.country?.name || ''
    const externalUrl = event.url || ''

    // Conflict check
    const eventDateStr = new Date(date).toISOString().split('T')[0]
    const { data: existingEvents, error: conflictError } = await supabase
      .from('user_events')
      .select('event_id, events(date)')
      .eq('user_id', user.id)

    if (!conflictError && existingEvents) {
      const hasConflict = existingEvents.some((e: { events?: { date?: string } | { date?: string }[] | null }) => {
        const ev = Array.isArray(e.events) ? e.events[0] : e.events
        if (!ev?.date) return false
        const d = new Date(ev.date).toISOString().split('T')[0]
        return d === eventDateStr
      })

      if (hasConflict) {
        Alert.alert(
          "Conflict Detected",
          "You already have a concert saved on this date. Do you want to add this one anyway?",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Add Anyway", onPress: () => proceedToAdd(artist, city, country, venue, date, externalUrl, user.id) }
          ]
        )
        return
      }
    }

    await proceedToAdd(artist, city, country, venue, date, externalUrl, user.id)
  }, [selectedArtist, proceedToAdd])

  const clearSearch = useCallback(() => {
    setQuery('')
    setSuggestions([])
    setSelectedArtist(null)
    setEvents([])
  }, [])

  return {
    query,
    setQuery,
    suggestions,
    selectedArtist,
    events,
    loading,
    showAdded,
    handleSearchChange,
    selectArtist,
    addToCalendar,
    clearSearch,
  }
}
