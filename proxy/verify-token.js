import SpotifyWebApi from 'spotify-web-api-node';
import dotenv from 'dotenv';
dotenv.config();

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID,
  clientSecret: process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET,
});

async function verify() {
  try {
    console.log('--- Verifying Client Credentials ---');
    console.log('ID:', process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID);
    
    // Get token
    const data = await spotifyApi.clientCredentialsGrant();
    console.log('\n--- Token Response ---');
    console.log('Status Code:', data.statusCode);
    console.log('Body:', JSON.stringify(data.body, null, 2));
    
    const token = data.body['access_token'];
    spotifyApi.setAccessToken(token);

    // Try simple call
    console.log('\n--- Testing Search ---');
    try {
        const search = await spotifyApi.searchArtists('Muse');
        console.log('Search Status:', search.statusCode);
        console.log('Items:', search.body.artists.items.length);
    } catch (e) {
        console.error('Search ERROR:', e.statusCode, e.body);
    }

  } catch (err) {
    console.error('Grant ERROR:', err);
  }
}

verify();
