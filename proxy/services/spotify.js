import SpotifyWebApi from 'spotify-web-api-node';
import dotenv from 'dotenv';

dotenv.config();

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID,
  clientSecret: process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET,
  redirectUri: 'https://localhost:8082/callback'
});

// Helper to get a valid token (Client Credentials Flow)
// Used for searching artists generally, not user-specific data
async function getClientCredentialsToken() {
  try {
    const data = await spotifyApi.clientCredentialsGrant();
    spotifyApi.setAccessToken(data.body['access_token']);
    return data.body['access_token'];
  } catch (err) {
    console.error('Error getting Spotify Client Credentials:', err);
    throw err;
  }
}

// Helper to execute Spotify calls with auto-refresh on 401
const executeWithRetry = async (operation) => {
  try {
    // Ensure we have a token first
    if (!spotifyApi.getAccessToken()) {
      await getClientCredentialsToken();
    }
    return await operation();
  } catch (err) {
    // Check if error is 401 (Unauthorized) or 403 (Forbidden - e.g. user added to dash)
    if (err.statusCode === 401 || err.statusCode === 403) {
      console.log(`🔄 Spotify Token Error (${err.statusCode}). Refreshing...`);
      await getClientCredentialsToken();
      return await operation(); // Retry once
    }
    throw err;
  }
};

export const SpotifyService = {
  // Search for artists
  // Search for artists
  searchArtists: async (query, offset = 0) => {
    try {
      return await executeWithRetry(async () => {
        const data = await spotifyApi.searchArtists(query, { limit: 10, offset });
        if (data.body.artists.items.length > 0) {
             console.log(`🔍 [SpotifyService] Full Artist Object: ${JSON.stringify(data.body.artists.items[0])}`);
        }
        return data.body.artists.items.map(artist => ({
          id: artist.id,
          name: artist.name,
          images: artist.images,
          genres: artist.genres,
          popularity: artist.popularity,
          external_urls: artist.external_urls,
          source: 'spotify'
        }));
      });
    } catch (err) {
      console.error('❌ Spotify Search Error:', err.message);
      if (err.statusCode === 403) {
          console.error('   -> 403 Forbidden. Check Spotify Dashboard > Settings > User Management.');
      }
      return [];
    }
  },

  // Get recommendations based on seed artists
  getRecommendations: async (seedArtistIds, seedGenres = []) => {
    try {
      return await executeWithRetry(async () => {
        const seedId = seedArtistIds[0];
        console.log(`🔍 [SpotifyService] getting Related Artists (Manual Fetch) for seed: ${seedId}`);
        
        // Manual fetch for Related Artists to verify if it works (Library gave 403)
        const token = spotifyApi.getAccessToken();
        const url = `https://api.spotify.com/v1/artists/${seedId}/related-artists`;
        
        const response = await fetch(url, {
             headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
             const errorText = await response.text();
             console.error(`❌ Spotify Related Artists Error (${response.status}): ${errorText}`);
             // If this fails, THEN fall back to genre search?
             // For now let's just throw to see if it works.
             throw new Error(`Spotify API Error: ${response.status}`);
        }

        const data = await response.json();
        const artists = data.artists || [];

        // Return top 10 related artists
        return artists.slice(0, 10).map(artist => ({
            id: artist.id,
            name: artist.name,
            image: artist.images?.[0]?.url,
            genres: artist.genres,
            popularity: artist.popularity,
            external_url: artist.external_urls.spotify
        }));
      });
    } catch (err) {
      console.error('Spotify Related Artists Error:', err.message);
      // Fallback to Genre Search if Related Artists fails
      return SpotifyService.getRecommendationsByGenre(seedArtistIds, seedGenres);
    }
  },

  getRecommendationsByGenre: async (seedArtistIds, seedGenres) => {
     try {
       // executeWithRetry is likely wrapping this call from the outside or we should wrap it here? 
       // Since it's called from catch block of getRecommendations which is arguably inside executeWithRetry's scope if using `call`, 
       // but here we are calling a method. Let's just run logic.
       
        const seedId = seedArtistIds[0];
        let seedGenre;

        if (seedGenres && seedGenres.length > 0) {
            seedGenre = seedGenres[0];
        } else {
             // 2. Fallback: Get Seed Artist details to find their genre
            try {
                // Ensure we have a valid token if we need to fetch
                const token = spotifyApi.getAccessToken();
                const rawRes = await fetch(`https://api.spotify.com/v1/artists/${seedId}`, { headers: { 'Authorization': `Bearer ${token}` } });
                const rawBody = await rawRes.json();
                console.log(`🔍 [SpotifyService] RAW FETCH getArtist: ${JSON.stringify(rawBody)}`);
                
                if (rawBody.genres && rawBody.genres.length > 0) {
                    seedGenre = rawBody.genres[0];
                }
            } catch (e) {
                 console.warn(`⚠️ Could not fetch artist ${seedId} for genre fallback: ${e.message}`); 
            }
        }

        if (!seedGenre) {
            console.log(`⚠️ Artist ${seedId} has no genres. Using 'pop' as fallback.`);
            seedGenre = 'pop'; 
        }
        
        // Improve Genre selection: Don't just use the first one if it's "pop".
        // Try to find a more specific one if multiple exist? 
        // For now, let's just use what we have but ensure we actually HAVE it from the proxy call.

        console.log(`🔍 [SpotifyService] Fallback: Using genre '${seedGenre}' for recommendations`);
        
        // Randomize offset to avoid same results
        const randomOffset = Math.floor(Math.random() * 50); 
        const searchRes = await spotifyApi.searchArtists(`genre:"${seedGenre}"`, { limit: 10, offset: randomOffset });
        
        if (!searchRes.body.artists || !searchRes.body.artists.items) return [];

        return searchRes.body.artists.items
            .filter(a => a.id !== seedId)
            .slice(0, 10)
            .map(artist => ({
                id: artist.id,
                name: artist.name,
                image: artist.images?.[0]?.url,
                genres: artist.genres,
                popularity: artist.popularity,
                external_url: artist.external_urls.spotify
            }));
     } catch (e) {
         console.error("Genre Fallback Error:", e);
         return [];
     }
  },

  // Get related artists
  getRelatedArtists: async (seedArtistId) => {
    try {
      return await executeWithRetry(async () => {
        const data = await spotifyApi.getArtistRelatedArtists(seedArtistId);
        console.log(`🔍 [Spotify] Related for ${seedArtistId}:`, data.body ? (data.body.artists ? `${data.body.artists.length} found` : 'No artists property') : 'No body');
        if (!data.body || !data.body.artists) return [];
        
        return data.body.artists.slice(0, 10).map(artist => ({
            id: artist.id,
            name: artist.name,
            image: artist.images[0]?.url,
            genres: artist.genres,
            popularity: artist.popularity,
            external_url: artist.external_urls.spotify
        }));
      });
    } catch (err) {
      console.error('Spotify Related Artists Error:', err);
      return [];
    }
  }
};
