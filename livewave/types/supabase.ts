// Tipos para las tablas de Supabase usadas en LiveWave

export interface Profile {
  id: string
  user_id: string
  name: string | null
  avatar_url: string | null
  location: unknown | null // PostGIS WKB — no usar para display
  location_latitude: number | null
  location_longitude: number | null
  radius_km: number
  has_onboarded: boolean
  push_token: string | null
}

export interface ArtistRow {
  id: string
  name: string
  slug: string
  image_url: string | null
}

export interface EventRow {
  id: string
  artist_id: string
  date: string
  venue: string
  city: string
  country: string
  external_url: string | null
  source: string | null
  url: string | null
}

export interface UserEventRow {
  user_id: string
  event_id: string
}

export interface GenreRow {
  id: string
  slug: string
  name?: string
}

export interface UserGenreRow {
  user_id: string
  genre_id: string
}

export interface UserFollowRow {
  user_id: string
  artist_id: string
}

// Tipos compuestos (con joins)
// Supabase devuelve relaciones como arrays al usar .select('relation(field)')
export interface EventWithArtist extends EventRow {
  artist: Pick<ArtistRow, 'name' | 'image_url'>
}

export type SupabaseJoin<T> = T | T[] | null

export interface UserEventWithDate extends UserEventRow {
  events: SupabaseJoin<Pick<EventRow, 'date'>>
}

export interface UserGenreWithSlug extends UserGenreRow {
  genres: SupabaseJoin<Pick<GenreRow, 'slug'>>
}

export interface UserFollowWithArtist extends UserFollowRow {
  artist: SupabaseJoin<Pick<ArtistRow, 'name'>>
}
