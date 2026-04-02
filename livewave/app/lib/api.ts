import { Platform } from 'react-native';
import Constants from 'expo-constants';

const debuggerHost = Constants.expoConfig?.hostUri;
const localhost = debuggerHost?.split(':')[0] || '192.168.1.135';

export const API_URL = process.env.EXPO_PUBLIC_PROXY_URL || `http://${localhost}:8082`;

export interface Artist {
  id: string;
  name: string;
  image?: string;
  external_url?: string;
  genres?: string[];
}

export interface Event {
  id: string;
  name: string;
  date: string;
  venue: string;
  city: string;
  country: string;
  image?: string;
  url?: string;
  artistName?: string;
  genre?: string;
  source?: 'ticketmaster' | 'festival' | 'spotify';
}

export interface RecommendationResponse {
  seed: string;
  recommendations: Artist[];
}

// Fallback mock data REMOVED

export async function getRecommendations(seedArtistName: string): Promise<RecommendationResponse> {
  try {
    console.log(`🔍 [API] Fetching recommendations for seed: "${seedArtistName}" (v3)`);
    const response = await fetch(`${API_URL}/recommendations/artists?seed_artist_name=${encodeURIComponent(seedArtistName)}`);
    if (!response.ok) {
        console.warn(`❌ [API] Recommendations failed (${response.status}) for ${seedArtistName}.`);
        return { seed: seedArtistName, recommendations: [] };
    }
    const data = await response.json();
    if (!data.recommendations || data.recommendations.length === 0) {
        return { seed: seedArtistName, recommendations: [] };
    }
    return data;
  } catch (error) {
    console.error("Error fetching recommendations:", error);
    return { seed: seedArtistName, recommendations: [] };
  }
}

export async function getEventsForArtist(artistName: string, latlong?: string, radius?: number): Promise<Event[]> {
  try {
    const params = new URLSearchParams();
    params.append('keyword', artistName);
    params.append('size', '5');
    if (latlong) params.append('latlong', latlong);
    if (radius) params.append('radius', String(radius));

    const response = await fetch(`${API_URL}/events?${params.toString()}`);
    if (!response.ok) return [];
    
    const data = await response.json();
    const events = data._embedded?.events || [];
    
    return events.map((e: any) => ({
      id: e.id,
      name: e.name,
      date: e.dates?.start?.localDate,
      venue: e._embedded?.venues?.[0]?.name,
      city: e._embedded?.venues?.[0]?.city?.name,
      country: e._embedded?.venues?.[0]?.country?.name,
      image: e.images?.[0]?.url,
      url: e.url,
      artistName: artistName,
      genre: e.classifications?.[0]?.genre?.name || e.classifications?.[0]?.segment?.name
    }));
  } catch (error) {
    console.error(`Error fetching events for ${artistName}:`, error);
    return [];
  }
}

// ... existing searchSpotifyArtists ...
export async function searchSpotifyArtists(query: string, offset: number = 0): Promise<Artist[]> {
  try {
    const url = `${API_URL}/spotify/search?q=${encodeURIComponent(query)}&offset=${offset}`;
    console.log(`🔍 [API] Searching Spotify: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
        console.error(`❌ [API] Search failed: ${response.status} ${response.statusText}`);
        return [];
    }
    
    const data = await response.json();
    // Proxy returns list of artists directly
    if (Array.isArray(data)) {
        return data.map((a: any) => ({
        id: a.id,
        name: a.name,
        image: a.images?.[0]?.url,
        genres: a.genres,
        external_url: a.external_urls?.spotify || a.external_urls?.source // handling potential inconsistencies
        }));
    }
    return [];
  } catch (error) {
    console.error("Error searching Spotify artists:", error);
    return [];
  }
}

export async function getConcertRecommendations(seedArtistName: string, city?: string, latlong?: string, radius?: number, genres?: string[]): Promise<{ seed: string, events: Event[], sources?: { ticketmaster: number, festival: number } }> {
    try {
        const params = new URLSearchParams({
            seed_artist_name: seedArtistName
        });
        if (city) params.append('city', city);
        if (latlong) params.append('latlong', latlong);
        if (radius) params.append('radius', String(radius)); 
        else params.append('radius', '50'); // Default radius
        if (genres && genres.length > 0) params.append('genres', genres.join(','));
        
        const url = `${API_URL}/recommendations/concerts?${params.toString()}`;
        console.log(`📡 [API] Fetching Recs: ${url}`);
        const res = await fetch(url);
        if (!res.ok) {
            console.warn(`TM Recs failed for ${seedArtistName}: ${res.status}`);
            return { seed: seedArtistName, events: [] };
        }
        const data = await res.json();
        
        const mappedEvents: Event[] = (data.events || []).map((e: any) => ({
             id: e.id,
             name: e.name,
             date: e.dates?.start?.localDate || e.date,
             venue: e._embedded?.venues?.[0]?.name || e.venue,
             city: e._embedded?.venues?.[0]?.city?.name || e.city,
             country: e._embedded?.venues?.[0]?.country?.name || e.country,
             image: e.images?.[0]?.url || e.image,
             url: e.url,
             artistName: e._embedded?.attractions?.[0]?.name || e.artistName || "Unknown Artist",
             genre: e.classifications?.[0]?.genre?.name || e.classifications?.[0]?.segment?.name || e.genre,
             source: e.source || 'ticketmaster',
        }));

        return { seed: data.seed || seedArtistName, events: mappedEvents, sources: data.sources };

    } catch (e) {
        console.error('getConcertRecommendations Error:', e);
        return { seed: seedArtistName, events: [] };
    }
}

// --- Festival Discovery ---

export interface DiscoverArtist {
  id: string;
  name: string;
  artistName: string;
  image?: string;
  genre?: string;
  url?: string;
  source: 'festival' | 'spotify';
  venue?: string;
  city?: string;
  country?: string;
}

export async function getDiscoverArtists(genres: string[], latlong?: string, radius?: number): Promise<DiscoverArtist[]> {
  try {
    const params = new URLSearchParams({ genres: genres.join(',') });
    if (latlong) params.append('latlong', latlong);
    if (radius) params.append('radius', String(radius));
    const url = `${API_URL}/discover/artists?${params.toString()}`;
    console.log(`🎪 [API] Discover Artists: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Discover Artists failed: ${response.status}`);
      return [];
    }
    const data = await response.json();
    return data.artists || [];
  } catch (error) {
    console.error('getDiscoverArtists Error:', error);
    return [];
  }
}


