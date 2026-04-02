// Tipos para respuestas de APIs externas (Ticketmaster, Spotify, Festivales)

export interface Artist {
  id: string
  name: string
  image?: string
  external_url?: string
  genres?: string[]
}

export interface Event {
  id: string
  name: string
  date: string
  venue: string
  city: string
  country: string
  image?: string
  url?: string
  artistName?: string
  genre?: string
  source?: 'ticketmaster' | 'festival' | 'spotify'
}

export interface DiscoverArtist {
  id: string
  name: string
  artistName: string
  image?: string
  genre?: string
  url?: string
  source: 'festival' | 'spotify'
  venue?: string
  city?: string
  country?: string
}

export interface RecommendationResponse {
  seed: string
  recommendations: Artist[]
}

export interface ConcertRecommendationResponse {
  seed: string
  events: Event[]
  sources?: {
    ticketmaster: number
    festival: number
  }
}
