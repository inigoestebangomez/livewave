import { Platform } from 'react-native';

const API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8082' : 'http://localhost:8082';

export interface Artist {
  id: string;
  name: string;
  image?: string;
  external_url?: string;
  genres?: string[];
}

export interface RecommendationResponse {
  seed: string;
  recommendations: Artist[];
}

// Fallback mock data in case API fails (e.g. Spotify 403)
const MOCK_RECOMMENDATIONS: Artist[] = [
  { id: '1', name: 'Royal Blood', image: 'https://i.scdn.co/image/ab6761610000e5eb5b4f722c6t5215d862f94b15', genres: ['modern rock'] },
  { id: '2', name: 'Nothing But Thieves', image: 'https://i.scdn.co/image/ab6761610000e5eb989ed05e1f37e40854O962', genres: ['alternative rock'] },
  { id: '3', name: 'The Kooks', image: 'https://i.scdn.co/image/ab6761610000e5ebf8696d5b9d799c7595l6760', genres: ['indie pop'] },
  { id: '4', name: 'Two Door Cinema Club', image: 'https://i.scdn.co/image/ab6761610000e5eb38758827725u859754f9', genres: ['indie rock'] },
  { id: '5', name: 'Foals', image: 'https://i.scdn.co/image/ab6761610000e5ebcdce762d127w260e03e4', genres: ['math rock'] },
];

export async function getRecommendations(seedArtistName: string): Promise<RecommendationResponse> {
  try {
    const response = await fetch(`${API_URL}/recommendations/artists?seed_artist_name=${encodeURIComponent(seedArtistName)}`);
    
    if (!response.ok) {
        console.warn(`Recommendations API failed (${response.status}), utilising mock data.`);
        return { seed: seedArtistName, recommendations: MOCK_RECOMMENDATIONS };
    }

    const data = await response.json();
    
    // Check if empty or error structure, allow fallback
    if (!data.recommendations || data.recommendations.length === 0) {
         return { seed: seedArtistName, recommendations: MOCK_RECOMMENDATIONS };
    }

    return data;
  } catch (error) {
    console.error("Error fetching recommendations, using mock:", error);
    return { seed: seedArtistName, recommendations: MOCK_RECOMMENDATIONS };
  }
}
