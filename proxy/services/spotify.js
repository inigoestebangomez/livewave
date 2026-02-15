import SpotifyWebApi from 'spotify-web-api-node';
import dotenv from 'dotenv';

dotenv.config();

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID,
  clientSecret: process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET,
  redirectUri: 'exp://localhost:8081' // Adjust based on Expo config
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

export const SpotifyService = {
  // Search for artists (to mix with TM results)
  searchArtists: async (query) => {
    try {
      if (!spotifyApi.getAccessToken()) {
        await getClientCredentialsToken();
      }
      const data = await spotifyApi.searchArtists(query);
      return data.body.artists.items.map(artist => ({
        id: artist.id,
        name: artist.name,
        images: artist.images,
        genres: artist.genres,
        popularity: artist.popularity,
        external_urls: artist.external_urls,
        source: 'spotify'
      }));
    } catch (err) {
      console.error('Spotify Search Error:', err);
      return [];
    }
  },

  // Get recommendations based on seed artists
  getRecommendations: async (seedArtistIds) => {
    try {
        if (!spotifyApi.getAccessToken()) {
            await getClientCredentialsToken();
        }
        const data = await spotifyApi.getRecommendations({
            seed_artists: seedArtistIds.slice(0, 5), // Max 5 seeds
            min_popularity: 50
        });
        return data.body.tracks.map(track => ({
            name: track.name,
            artist: track.artists[0].name,
            id: track.id,
            image: track.album.images[0]?.url
        }));
    } catch (err) {
        console.error('Spotify Recommendations Error:', err);
        return [];
    }
  }
};
