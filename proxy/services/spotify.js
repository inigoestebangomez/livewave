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
  getRecommendations: async (seedArtistIds) => {
    try {
      return await executeWithRetry(async () => {
        const data = await spotifyApi.getRecommendations({
            seed_artists: seedArtistIds.slice(0, 5), // Max 5 seeds
            min_popularity: 20 // Lower threshold
        });
        
        // Map Track -> Artist (Deduping required later, but for now just return the primary artist of the track)
        return data.body.tracks.map(track => ({
            id: track.artists[0].id,
            name: track.artists[0].name, // Display Artist Name, NOT Track Name
            track_name: track.name,
            image: track.album.images[0]?.url,
            genres: [], // Tracks don't have genres, artists do. leave empty.
            popularity: track.popularity,
            external_url: track.external_urls.spotify
        }));
      });
    } catch (err) {
      console.error('Spotify Recommendations Error:', err.statusCode, err.body || err.message);
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
