import { useState, useCallback, useRef, useEffect } from 'react'
import { useUser } from '@supabase/auth-helpers-react'
import { supabase } from '../app/lib/supabase'
import {
  getConcertRecommendations,
  getYourArtistsOnTour,
  getDiscoverWithConcerts,
  getUpcomingByGenre,
} from '../app/lib/api'
import type { Event, DiscoverArtistWithConcerts } from '../types/api'
import { getCityLabel, getCountryLabel, getCountryCode } from './useCityLabel'

// Genre seed map for fallback when user has no followed artists
const GENRE_SEED_MAP: Record<string, string> = {
  rock: 'Muse',
  pop: 'Dua Lipa',
  'hip-hop': 'Kendrick Lamar',
  electronic: 'ODESZA',
  metal: 'Metallica',
  indie: 'Tame Impala',
  techno: 'Amelie Lens',
}

// In-memory cache with stale-while-revalidate support
// Fresh (< 5 min): return immediately, no refetch
// Stale (< 30 min): return immediately, refetch in background
// Expired (> 30 min): discard, fetch fresh
const cache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_VERSION = 'v3' // Bump when backend changes significantly
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes (fresh)
const CACHE_STALE_TTL = 30 * 60 * 1000 // 30 minutes (max stale age)

interface CacheResult<T> {
  data: T
  fresh: boolean // true = within TTL, no refetch needed
}

function getCached<T>(key: string): CacheResult<T> | null {
  const entry = cache.get(key)
  if (!entry) return null
  const age = Date.now() - entry.timestamp
  if (age < CACHE_TTL) {
    return { data: entry.data as T, fresh: true }
  }
  if (age < CACHE_STALE_TTL) {
    return { data: entry.data as T, fresh: false }
  }
  cache.delete(key)
  return null
}

function setCache(key: string, data: unknown) {
  cache.set(key, { data, timestamp: Date.now() })
}

interface UseRecommendationsReturn {
  loading: boolean
  refreshing: boolean
  seedArtist: string | null
  recommendedEvents: Event[]
  yourArtistsOnTour: { artistName: string; events: Event[]; eventCount: number; nextEvent: Event }[]
  discoverArtists: DiscoverArtistWithConcerts[]
  userCity: string | undefined
  refresh: () => Promise<void>
  // Progressive loading states
  artistsOnTourLoading: boolean
  discoverLoading: boolean
  concertsLoading: boolean
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
  const [yourArtistsOnTour, setYourArtistsOnTour] = useState<{ artistName: string; events: Event[]; eventCount: number; nextEvent: Event }[]>([])
  const [discoverArtists, setDiscoverArtists] = useState<DiscoverArtistWithConcerts[]>([])
  const [userCity, setUserCity] = useState<string | undefined>(undefined)
  
  // Refs to capture current state values for caching
  const recommendedEventsRef = useRef(recommendedEvents);
  const yourArtistsOnTourRef = useRef(yourArtistsOnTour);
  const discoverArtistsRef = useRef(discoverArtists);
  
  // Progressive loading states
  const [artistsOnTourLoading, setArtistsOnTourLoading] = useState(true)
  const [discoverLoading, setDiscoverLoading] = useState(true)
  const [concertsLoading, setConcertsLoading] = useState(true)

  // Guard against concurrent fetches and stale overwrites
  const fetchingRef = useRef(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const fetchData = useCallback(async (forceFresh = false) => {
    if (!user) {
      setLoading(false)
      setArtistsOnTourLoading(false)
      setDiscoverLoading(false)
      setConcertsLoading(false)
      return
    }

    // Prevent concurrent fetches
    if (fetchingRef.current) return
    fetchingRef.current = true

    const userId = user.id

    try {
      // ========== Step 1: Fetch user config ==========
      const [userGenresResult, profileResult, followsResult] = await Promise.all([
        supabase.from('user_genres').select('genres(slug)').eq('user_id', userId),
        supabase.from('profiles').select('location_latitude, location_longitude, radius_km').eq('id', userId).single(),
        supabase.from('user_follows').select('artist:artists(name)').eq('user_id', userId).limit(50),
      ])

      if (!mountedRef.current) return

      const genreSlugs = (userGenresResult.data || [])
        .map((ug: { genres?: { slug?: string } | { slug?: string }[] | null }) => {
          const g = firstRelation(ug.genres)
          return g?.slug
        })
        .filter((s): s is string => !!s)

      let userLatLong: string | undefined
      let userRadius = 200

      const profile = profileResult.data
      let userCountryCode: string | null = null
      if (profile) {
        if (profile.radius_km) userRadius = profile.radius_km
        if (profile.location_latitude && profile.location_longitude) {
          userLatLong = `${profile.location_latitude},${profile.location_longitude}`
          const lat = parseFloat(String(profile.location_latitude))
          const lng = parseFloat(String(profile.location_longitude))
          userCountryCode = getCountryCode(lat, lng)
          setUserCity(getCityLabel(lat, lng))
        }
      }

      // ========== Step 2: Stale-While-Revalidate cache check ==========
      const cacheKey = `recs-${userId}-${userCountryCode || 'local'}-${CACHE_VERSION}`
      const cached = getCached<{
        seedArtist: string | null
        recommendedEvents: Event[]
        yourArtistsOnTour: typeof yourArtistsOnTour
        discoverArtists: DiscoverArtistWithConcerts[]
        userCity: string | undefined
      }>(cacheKey)

      if (cached && !forceFresh) {
        // Show cached data INSTANTLY — no loading flash
        setSeedArtist(cached.data.seedArtist)
        setRecommendedEvents(cached.data.recommendedEvents)
        setYourArtistsOnTour(cached.data.yourArtistsOnTour)
        setDiscoverArtists(cached.data.discoverArtists)
        setUserCity(cached.data.userCity)
        setLoading(false)
        setArtistsOnTourLoading(false)
        setDiscoverLoading(false)
        setConcertsLoading(false)

        // If cache is fresh, skip re-fetch entirely
        if (cached.fresh) {
          fetchingRef.current = false
          return
        }
        // Stale: show cached data now, re-validate in background (fall through)
      }

      const allFollowedNames = (followsResult.data || [])
        .map((f: { artist?: { name?: string } | { name?: string }[] | null }) => {
          const a = firstRelation(f.artist)
          return a?.name
        })
        .filter((n): n is string => !!n)

      if (!mountedRef.current) return

      // Only show skeleton loading if we have NO cached data (first load)
      if (!cached || forceFresh) {
        setLoading(true)
        setArtistsOnTourLoading(true)
        setDiscoverLoading(true)
        setConcertsLoading(true)
      }

      // ========== Step 3: Build recommendation strategy ==========
      const artistsToCheck = allFollowedNames.slice(0, 15)

      let seedName: string | null = null
      if (allFollowedNames.length > 0) {
        seedName = allFollowedNames[Math.floor(Math.random() * allFollowedNames.length)]
      } else {
        seedName = genreSlugs.length > 0 
          ? GENRE_SEED_MAP[genreSlugs[0]] || 'Coldplay'
          : 'Coldplay'
      }

      // ========== Step 4: Launch independent fetches for progressive loading ==========
      
      // For Discover section, try multiple seeds instead of just one random artist
      const discoverSeedNames = allFollowedNames.length > 0 
        ? allFollowedNames.slice(0, 3)  // Use top 3 followed artists as potential seeds
        : [genreSlugs.length > 0 
            ? GENRE_SEED_MAP[genreSlugs[0]] || 'Coldplay'
            : 'Coldplay'];

      // Launch all fetches independently - each updates its own state when done
      const fetchArtistsOnTour = async () => {
        try {
          // For "Your Artists On Tour" - use countryCode for broader search since user follows these artists
          const result = artistsToCheck.length > 0 
            ? await getYourArtistsOnTour(artistsToCheck, userLatLong, userRadius, userCountryCode)
            : []
          if (mountedRef.current) {
            setYourArtistsOnTour(result)
            yourArtistsOnTourRef.current = result;
          }
        } catch (error) {
          console.error("Error fetching artists on tour:", error)
          if (mountedRef.current) {
            setYourArtistsOnTour([])
          }
        } finally {
          if (mountedRef.current) setArtistsOnTourLoading(false)
        }
      }

      const fetchDiscover = async () => {
        try {
          // Seeds: top 3 followed artists to get diverse similar-artist suggestions
          const discoverSeeds = allFollowedNames.length > 0 
            ? allFollowedNames.slice(0, 3)
            : [genreSlugs.length > 0 
                ? GENRE_SEED_MAP[genreSlugs[0]] || 'Coldplay'
                : 'Coldplay'];
          
          // Run all seeds IN PARALLEL — backend handles its own rate limiting per seed
          const seedResults = await Promise.allSettled(
            discoverSeeds.map(seed =>
              getDiscoverWithConcerts(
                seed,
                userLatLong,
                userRadius,
                10,
                genreSlugs,
                userCountryCode,
                allFollowedNames  // Pass exclusion list to backend — no frontend filter needed
              )
            )
          );

          // Merge results, deduplicate by artist name (keep highest eventCount)
          const bestByArtist = new Map<string, DiscoverArtistWithConcerts>();
          for (const result of seedResults) {
            if (result.status !== 'fulfilled') continue;
            for (const artist of result.value) {
              const key = artist.artistName.toLowerCase();
              const existing = bestByArtist.get(key);
              if (!existing || artist.eventCount > existing.eventCount) {
                bestByArtist.set(key, artist);
              }
            }
          }

          const discoverResult = Array.from(bestByArtist.values())
            .sort((a, b) => b.eventCount - a.eventCount)
            .slice(0, 8);

          if (mountedRef.current) {
            setDiscoverArtists(discoverResult);
            discoverArtistsRef.current = discoverResult;
          }
        } catch (error) {
          console.error("Error fetching discover artists:", error)
          if (mountedRef.current) {
            setDiscoverArtists([])
          }
        } finally {
          if (mountedRef.current) setDiscoverLoading(false)
        }
      }


      const fetchConcerts = async () => {
        try {
          // Recommended Concerts: near the user, similar to their followed artists
          // Send ALL followed artists (backend picks top seeds and finds similar artists with concerts near user)
          const concertsResponse = await getConcertRecommendations(
            seedName || 'unknown',  // Legacy fallback; backend uses followedArtists if provided
            undefined,
            userLatLong,
            userRadius,
            genreSlugs,
            allFollowedNames  // All followed artists as seeds — backend decides similarity logic
          )

          const recommendedEvents = concertsResponse?.events || []

          if (mountedRef.current) {
            setRecommendedEvents(recommendedEvents)
            recommendedEventsRef.current = recommendedEvents;
            if (!seedArtist && seedName) {
              setSeedArtist(seedName);
            }
          }
        } catch (error) {
          console.error("Error fetching concert recommendations:", error)
          if (mountedRef.current) {
            setRecommendedEvents([])
          }
        } finally {
          if (mountedRef.current) setConcertsLoading(false)
        }
      }


      // Wait for all promises to settle before caching
      await Promise.allSettled([
        fetchArtistsOnTour(),
        fetchDiscover(),
        fetchConcerts()
      ]);

      // Once all fetches are done, hide the main loading spinner
      if (mountedRef.current) {
        setLoading(false);
      }

      // Cache results with the final state values
      // NOTE: This caching happens after the state is updated by the async functions
      if (forceFresh || !cached) {
        setCache(`recs-${userId}-${userCountryCode || 'local'}-${CACHE_VERSION}`, {
          seedArtist: seedName,
          recommendedEvents: recommendedEventsRef.current, // Use ref to get final values
          yourArtistsOnTour: yourArtistsOnTourRef.current, 
          discoverArtists: discoverArtistsRef.current,
          userCity: userLatLong ? getCountryLabel(
            parseFloat(String(profile?.location_latitude)),
            parseFloat(String(profile?.location_longitude))
          ) : undefined,
        });
      }

    } catch (error) {
      console.error("Error loading recommendations:", error)
      // Don't reset states on error — keep previous data
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [user])

  // Load data once when user is available
  useEffect(() => {
    if (user) {
      fetchData()
    }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(async () => {
    // Clear cache on manual refresh
    cache.clear()
    fetchingRef.current = false // Allow new fetch
    setRefreshing(true)
    setArtistsOnTourLoading(true)
    setDiscoverLoading(true)
    setConcertsLoading(true)

    await fetchData(true) // forceFresh = true
    
    setRefreshing(false)
  }, [fetchData])

  return {
    loading,
    refreshing,
    seedArtist,
    recommendedEvents,
    yourArtistsOnTour,
    discoverArtists,
    userCity,
    refresh,
    artistsOnTourLoading,
    discoverLoading,
    concertsLoading,
  }
}