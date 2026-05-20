import Constants from 'expo-constants'

// Re-export tipos desde types/api.ts para compatibilidad con imports existentes
export type {
  Artist,
  Event,
  DiscoverArtist,
  RecommendationResponse,
  ConcertRecommendationResponse,
} from '../../types/api'

import type { Artist, Event, DiscoverArtist, RecommendationResponse } from '../../types/api'

const debuggerHost = Constants.expoConfig?.hostUri
const localhost = debuggerHost?.split(':')[0] || (__DEV__ ? '192.168.1.135' : '')

export const API_URL = process.env.EXPO_PUBLIC_PROXY_URL || (localhost ? `http://${localhost}:8082` : '')

// Tipos internos para respuestas crudas de Ticketmaster
interface TMVenue {
  name?: string
  city?: { name?: string }
  country?: { name?: string }
}

interface TMEvent {
  id: string
  name: string
  dates?: { start?: { localDate?: string; dateTime?: string } }
  _embedded?: { venues?: TMVenue[]; attractions?: { name?: string }[] }
  images?: { url?: string }[]
  url?: string
  classifications?: { genre?: { name?: string }; segment?: { name?: string } }[]
  source?: string
}

interface TMArtist {
  id: string
  name: string
  images?: { url?: string }[]
  external_urls?: { spotify?: string; source?: string }
  genres?: string[]
}

export async function getRecommendations(seedArtistName: string): Promise<RecommendationResponse> {
  try {
    console.log(`🔍 [API] Fetching recommendations for seed: "${seedArtistName}" (v3)`)
    const response = await fetch(`${API_URL}/recommendations/artists?seed_artist_name=${encodeURIComponent(seedArtistName)}`)
    if (!response.ok) {
        console.warn(`❌ [API] Recommendations failed (${response.status}) for ${seedArtistName}.`)
        return { seed: seedArtistName, recommendations: [] }
    }
    const data = await response.json()
    if (!data.recommendations || data.recommendations.length === 0) {
        return { seed: seedArtistName, recommendations: [] }
    }
    return data
  } catch (error) {
    console.error("Error fetching recommendations:", error)
    return { seed: seedArtistName, recommendations: [] }
  }
}

export async function getEventsForArtist(artistName: string, latlong?: string, radius?: number): Promise<Event[]> {
  try {
    const params = new URLSearchParams()
    params.append('keyword', artistName)
    params.append('size', '5')
    if (latlong) params.append('latlong', latlong)
    if (radius) params.append('radius', String(radius))

    const response = await fetch(`${API_URL}/events?${params.toString()}`)
    if (!response.ok) return []
    
    const data = await response.json()
    const events: TMEvent[] = data._embedded?.events || []
    
    return events.map((e) => ({
      id: e.id,
      name: e.name,
      date: e.dates?.start?.localDate || '',
      venue: e._embedded?.venues?.[0]?.name || '',
      city: e._embedded?.venues?.[0]?.city?.name || '',
      country: e._embedded?.venues?.[0]?.country?.name || '',
      image: e.images?.[0]?.url,
      url: e.url,
      artistName: artistName,
      genre: e.classifications?.[0]?.genre?.name || e.classifications?.[0]?.segment?.name
    }))
  } catch (error) {
    console.error(`Error fetching events for ${artistName}:`, error)
    return []
  }
}

export async function searchSpotifyArtists(query: string, offset: number = 0): Promise<Artist[]> {
  try {
    const url = `${API_URL}/spotify/search?q=${encodeURIComponent(query)}&offset=${offset}`
    console.log(`🔍 [API] Searching Spotify: ${url}`)
    const response = await fetch(url)
    if (!response.ok) {
        console.error(`❌ [API] Search failed: ${response.status} ${response.statusText}`)
        return []
    }
    
    const data = await response.json()
    if (Array.isArray(data)) {
        return data.map((a: TMArtist) => ({
        id: a.id,
        name: a.name,
        image: a.images?.[0]?.url,
        genres: a.genres,
        external_url: a.external_urls?.spotify || a.external_urls?.source
        }))
    }
    return []
  } catch (error) {
    console.error("Error searching Spotify artists:", error)
    return []
  }
}

export async function getConcertRecommendations(
  seedArtistName: string,
  city?: string,
  latlong?: string,
  radius?: number,
  genres?: string[],
  followedArtists?: string[]
): Promise<{ seed: string, events: Event[], sources?: { ticketmaster: number, festival: number } }> {
    try {
        const params = new URLSearchParams()
        // Prefer followed_artists for the new endpoint logic; fall back to seed
        if (followedArtists && followedArtists.length > 0) {
            params.append('followed_artists', followedArtists.join(','))
        } else {
            params.append('seed_artist_name', seedArtistName)
        }
        if (city) params.append('city', city)
        if (latlong) params.append('latlong', latlong)
        if (radius) params.append('radius', String(radius)) 
        else params.append('radius', '120')
        if (genres && genres.length > 0) params.append('genres', genres.join(','))
        
        const url = `${API_URL}/recommendations/concerts?${params.toString()}`
        console.log(`📡 [API] Fetching Recs: followed=${followedArtists?.length || 0} artists, radius=${radius || 120}km`)
        const res = await fetch(url)
        if (!res.ok) {
            console.warn(`TM Recs failed: ${res.status}`)
            return { seed: seedArtistName, events: [] }
        }
        const data = await res.json()
        
        const mappedEvents: Event[] = (data.events || []).map((e: TMEvent & { date?: string; venue?: string; city?: string; country?: string; image?: string; artistName?: string; genre?: string }) => ({
             id: e.id,
             name: e.name,
             date: e.dates?.start?.localDate || e.date || '',
             venue: e._embedded?.venues?.[0]?.name || e.venue || '',
             city: e._embedded?.venues?.[0]?.city?.name || e.city || '',
             country: e._embedded?.venues?.[0]?.country?.name || e.country || '',
             image: e.images?.[0]?.url || e.image,
             url: e.url,
             artistName: e._embedded?.attractions?.[0]?.name || e.artistName || "Unknown Artist",
             genre: e.classifications?.[0]?.genre?.name || e.classifications?.[0]?.segment?.name || e.genre,
             source: (e.source as Event['source']) || 'ticketmaster',
        }))

        return { seed: data.seed || seedArtistName, events: mappedEvents, sources: data.sources }

    } catch (e) {
        console.error('getConcertRecommendations Error:', e)
        return { seed: seedArtistName, events: [] }
    }
}


export async function getDiscoverArtists(genres: string[], latlong?: string, radius?: number): Promise<DiscoverArtist[]> {
  try {
    const params = new URLSearchParams({ genres: genres.join(',') })
    if (latlong) params.append('latlong', latlong)
    if (radius) params.append('radius', String(radius))
    const url = `${API_URL}/discover/artists?${params.toString()}`
    console.log(`🎪 [API] Discover Artists: ${url}`)
    const response = await fetch(url)
    if (!response.ok) {
      console.warn(`Discover Artists failed: ${response.status}`)
      return []
    }
    const data = await response.json()
    return data.artists || []
  } catch (error) {
    console.error('getDiscoverArtists Error:', error)
    return []
  }
}

// === NUEVAS FUNCIONES COHERENTES ===

export interface ArtistOnTour {
  artistName: string
  events: Event[]
  eventCount: number
  nextEvent: Event
}

/**
 * Obtiene SOLO los artistas seguidos que tienen conciertos próximos
 * 
 * When countryCode is provided, uses country-level filtering for TM API
 * instead of latlong+radius
 */
export async function getYourArtistsOnTour(
  artistNames: string[],
  latlong?: string,
  radius?: number,
  countryCode?: string | null
): Promise<ArtistOnTour[]> {
  try {
    const params = new URLSearchParams({
      artists: artistNames.join(',')
    })
    if (latlong) params.append('latlong', latlong)
    if (radius) params.append('radius', String(radius))
    if (countryCode) params.append('countryCode', countryCode)

    const url = `${API_URL}/recommendations/your-artists-on-tour?${params.toString()}`
    console.log(`🎵 [API] Your Artists On Tour: ${artistNames.length} artists (countryCode: ${countryCode || 'local'})`)

    const response = await fetch(url)
    if (!response.ok) {
      console.warn(`Your Artists On Tour failed: ${response.status}`)
      return []
    }

    const data = await response.json()
    return data.artists || []
  } catch (error) {
    console.error('getYourArtistsOnTour Error:', error)
    return []
  }
}

export interface DiscoverArtistWithConcerts {
  id: string
  name: string
  artistName: string
  image?: string
  match: number
  source: string
  genre?: string
  events: Event[]
  eventCount: number
  url?: string
}

/**
 * Descubre artistas similares que REALMENTE tienen conciertos programados
 * Reemplaza el "trending" engañoso
 */
export async function getDiscoverWithConcerts(
  seedArtistName: string,
  latlong?: string,
  radius?: number,
  limit?: number,
  genres?: string[],
  countryCode?: string | null,
  excludeArtists?: string[]
): Promise<DiscoverArtistWithConcerts[]> {
  try {
    const params = new URLSearchParams({
      seed_artist_name: seedArtistName
    })
    if (latlong) params.append('latlong', latlong)
    if (radius) params.append('radius', String(radius))
    if (limit) params.append('limit', String(limit))
    if (genres && genres.length > 0) params.append('genres', genres.join(','))
    if (countryCode) params.append('countryCode', countryCode)
    if (excludeArtists && excludeArtists.length > 0) params.append('excludeArtists', excludeArtists.join(','))

    const url = `${API_URL}/recommendations/discover-with-concerts?${params.toString()}`
    console.log(`🎵 [API] Discover With Concerts: seed=${seedArtistName}, exclude=${excludeArtists?.length || 0} artists`)

    const response = await fetch(url)
    if (!response.ok) {
      console.warn(`Discover With Concerts failed: ${response.status}`)
      return []
    }

    const data = await response.json()
    return data.artists || []
  } catch (error) {
    console.error('getDiscoverWithConcerts Error:', error)
    return []
  }
}


/**
 * Obtiene conciertos próximos por género (búsqueda por clasificación en Ticketmaster)
 * Usa mapeo de slugs a nombres de clasificación TM
 */
export async function getUpcomingByGenre(
  genre: string,
  latlong?: string,
  radius?: number,
  limit?: number,
  countryCode?: string | null
): Promise<{ genre: string; count: number; events: Event[] }> {
  try {
    const params = new URLSearchParams({ genre })
    if (latlong) params.append('latlong', latlong)
    if (radius) params.append('radius', String(radius))
    if (limit) params.append('limit', String(limit))
    if (countryCode) params.append('countryCode', countryCode)

    const url = `${API_URL}/recommendations/upcoming-by-genre?${params.toString()}`
    console.log(`🎸 [API] Upcoming by genre: ${genre}`)

    const response = await fetch(url)
    if (!response.ok) {
      console.warn(`Upcoming by genre failed: ${response.status}`)
      return { genre, count: 0, events: [] }
    }

    const data = await response.json()

    // Map TM events to our Event format
    const events: Event[] = (data.events || []).map((e: any) => ({
      id: e.id,
      name: e.name,
      date: e.date || '',
      venue: e.venue || '',
      city: e.city || '',
      country: e.country || '',
      image: e.image,
      url: e.url,
      artistName: e.artistName || e.name,
      genre: e.genre || genre,
      source: e.source || 'genre',
    }))

    return { genre: data.genre || genre, count: data.count || 0, events }
  } catch (error) {
    console.error('getUpcomingByGenre Error:', error)
    return { genre, count: 0, events: [] }
  }
}
