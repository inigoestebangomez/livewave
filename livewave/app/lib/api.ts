import { Platform } from 'react-native';
import Constants from 'expo-constants';

const debuggerHost = Constants.expoConfig?.hostUri;
const localhost = debuggerHost?.split(':')[0] || 'localhost';

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

export async function getEventsForArtist(artistName: string): Promise<Event[]> {
  try {
    const response = await fetch(`${API_URL}/events?keyword=${encodeURIComponent(artistName)}&size=5`);
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
      artistName: artistName
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

export async function getConcertRecommendations(seedArtistName: string, city?: string, latlong?: string, radius?: number): Promise<{ seed: string, events: Event[] }> {
    try {
        const params = new URLSearchParams({
            seed_artist_name: seedArtistName
        });
        if (city) params.append('city', city);
        if (latlong) params.append('latlong', latlong);
        if (radius) params.append('radius', String(radius)); 
        else params.append('radius', '50'); // Default radius
        
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
             date: e.dates?.start?.localDate,
             venue: e._embedded?.venues?.[0]?.name,
             city: e._embedded?.venues?.[0]?.city?.name,
             country: e._embedded?.venues?.[0]?.country?.name,
             image: e.images?.[0]?.url,
             url: e.url,
             artistName: e._embedded?.attractions?.[0]?.name || "Unknown Artist"
        }));

        return { seed: data.seed || seedArtistName, events: mappedEvents };

    } catch (e) {
        console.error('getConcertRecommendations Error:', e);
        return { seed: seedArtistName, events: [] };
    }
}

