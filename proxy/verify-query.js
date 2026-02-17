import SpotifyWebApi from 'spotify-web-api-node';
import dotenv from 'dotenv';
dotenv.config();

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID,
  clientSecret: process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET,
});

async function verify() {
  try {
    const data = await spotifyApi.clientCredentialsGrant();
    const token = data.body['access_token'];
    spotifyApi.setAccessToken(token);

    const queries = ['Muse', 'genre:rock', 'genre:"rock"', 'year:2024'];

    for (const q of queries) {
        try {
            const search = await spotifyApi.searchArtists(q);
            console.log(`Query: '${q}' -> Status: ${search.statusCode}, Items: ${search.body.artists.items.length}`);
        } catch (e) {
            console.error(`Query: '${q}' -> ERROR:`, e.statusCode, e.body);
        }
    }

  } catch (err) {
    console.error('Grant ERROR:', err);
  }
}

verify();
