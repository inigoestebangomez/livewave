import { useState, useCallback } from 'react'
import { useUser } from '@supabase/auth-helpers-react'
import { useFocusEffect } from 'expo-router'
import { supabase } from '../app/lib/supabase'
import {
  getEventsForArtist,
  getConcertRecommendations,
  getDiscoverArtists,
} from '../app/lib/api'
import type { Event, DiscoverArtist } from '../types/api'
import { getCityLabel } from './useCityLabel'

const GENRE_SEED_MAP: Record<string, string> = {
  rock: 'Muse',
  pop: 'Dua Lipa',
  'hip-hop': 'Kendrick Lamar',
  electronic: 'Daft Punk',
  metal: 'Metallica',
  indie: 'Tame Impala',
  techno: 'Amelie Lens',
}

interface UseRecommendationsReturn {
  loading: boolean
  refreshing: boolean
  seedArtist: string | null
  recommendedEvents: Event[]
  yourEvents: Event[]
  trendingArtists: DiscoverArtist[]
  userCity: string | undefined
  refresh: () => Promise<void>
}

/** Extrae el primer elemento de una relación Supabase (puede venir como objeto o array) */
function firstRelation<T>(val: T | T[] | null | undefined): T | null {
  if (!val) return null
  return Array.isArray(val) ? (val[0] ?? null) : val
}

export function useRecommendations(): UseRecommendationsReturn {
  const user = useUser()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [seedArtist, setSeedArtist] = useState<string | null>(null)
  const [recommendedEvents, setRecommendedEvents] = useState<Event[]>([])
  const [yourEvents, setYourEvents] = useState<Event[]>([])
  const [trendingArtists, setTrendingArtists] = useState<DiscoverArtist[]>([])
  const [userCity, setUserCity] = useState<string | undefined>(undefined)

  const fetchData = useCallback(async () => {
    setLoading(true)
    if (!user) {
      setLoading(false)
      return
    }

    try {
      // 0. Obtener géneros del usuario
      const { data: userGenresData } = await supabase
        .from('user_genres')
        .select('genres(slug)')
        .eq('user_id', user.id)

      const genreSlugs = (userGenresData || [])
        .map((ug: { genres?: { slug?: string } | { slug?: string }[] | null }) => {
          const g = firstRelation(ug.genres)
          return g?.slug
        })
        .filter((s): s is string => !!s)

      let userLatLong: string | undefined
      let userRadius = 50

      const { data: profile } = await supabase
        .from('profiles')
        .select('location_latitude, location_longitude, radius_km')
        .eq('id', user.id)
        .single()

      if (profile) {
        if (profile.radius_km) userRadius = profile.radius_km
        if (profile.location_latitude && profile.location_longitude) {
          userLatLong = `${profile.location_latitude},${profile.location_longitude}`
          const lat = parseFloat(String(profile.location_latitude))
          const lng = parseFloat(String(profile.location_longitude))
          setUserCity(getCityLabel(lat, lng))
        }
      }

      // 2. Artistas seguidos
      const { data: follows } = await supabase
        .from('user_follows')
        .select('artist:artists(name)')
        .eq('user_id', user.id)
        .limit(50)

      const allFollowedNames = (follows || [])
        .map((f: { artist?: { name?: string } | { name?: string }[] | null }) => {
          const a = firstRelation(f.artist)
          return a?.name
        })
        .filter((n): n is string => !!n)

      const namesForEvents = [...allFollowedNames]
        .sort(() => 0.5 - Math.random())
        .slice(0, 15)

      if (namesForEvents.length > 0) {
        const promises = namesForEvents.map(name =>
          getEventsForArtist(name, userLatLong, 2000)
        )
        const results = await Promise.all(promises)
        const eventsFlat = results
          .flat()
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        setYourEvents(
          Array.from(new Map(eventsFlat.map(item => [item.id, item])).values())
        )
      } else {
        setYourEvents([])
      }

      // 4. Selección de seed artist
      let seedName: string | null = null

      if (allFollowedNames.length > 0) {
        seedName = allFollowedNames[Math.floor(Math.random() * allFollowedNames.length)]
      }

      if (!seedName) {
        const { data: userEvents } = await supabase
          .from('user_events')
          .select('event_id')
          .eq('user_id', user.id)
          .limit(5)

        if (userEvents && userEvents.length > 0) {
          const eventIds = userEvents.map((ue) => ue.event_id)
          const { data: eventsData } = await supabase
            .from('events')
            .select('artist:artist_id(name)')
            .in('id', eventIds)
            .limit(5)

          if (eventsData && eventsData.length > 0) {
            const randomEvent = eventsData[Math.floor(Math.random() * eventsData.length)]
            const artist = firstRelation<{ name?: string }>(
              (randomEvent as { artist?: { name?: string } | { name?: string }[] }).artist
            )
            if (artist?.name) seedName = artist.name
          }
        }
      }

      if (!seedName) {
        if (genreSlugs.length > 0) {
          const randomGenre = genreSlugs[Math.floor(Math.random() * genreSlugs.length)]
          seedName = GENRE_SEED_MAP[randomGenre] || 'Coldplay'
        } else {
          seedName = 'Coldplay'
        }
      }

      // 5. Recomendaciones
      if (seedName) {
        setSeedArtist(seedName)
        const response = await getConcertRecommendations(
          seedName, undefined, userLatLong, userRadius, genreSlugs
        )

        if (response?.events?.length > 0) {
          const uniqueEventsMap = new Map<string, Event>()
          response.events.forEach((item) => {
            if (item.artistName && !uniqueEventsMap.has(item.artistName)) {
              uniqueEventsMap.set(item.artistName, item)
            }
          })
          setRecommendedEvents(Array.from(uniqueEventsMap.values()))
        } else {
          setRecommendedEvents([])
        }
      }

      // 6. Trending
      if (genreSlugs.length > 0) {
        const discovered = await getDiscoverArtists(genreSlugs, userLatLong, userRadius)
        setTrendingArtists(discovered.slice(0, 15))
      }
    } catch (error) {
      console.error("Error loading recommendations:", error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useFocusEffect(
    useCallback(() => {
      fetchData()
    }, [fetchData])
  )

  const refresh = useCallback(async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }, [fetchData])

  return {
    loading,
    refreshing,
    seedArtist,
    recommendedEvents,
    yourEvents,
    trendingArtists,
    userCity,
    refresh,
  }
}
