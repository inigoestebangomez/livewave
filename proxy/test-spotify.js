import SpotifyWebApi from 'spotify-web-api-node';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

async function test() {
    const clientId = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET;

    console.log(`Client ID: ${clientId ? clientId.substring(0, 4) + '...' : 'MISSING'}`);
    console.log(`Client Secret: ${clientSecret ? clientSecret.substring(0, 4) + '...' : 'MISSING'}`);

    if (!clientId || !clientSecret) return;

    const spotifyApi = new SpotifyWebApi({ clientId, clientSecret });

    try {
        console.log("Getting Client Credentials Token...");
        const data = await spotifyApi.clientCredentialsGrant();
        const token = data.body['access_token'];
        console.log(`Token obtained: ${token.substring(0, 10)}... (Expires in ${data.body['expires_in']})`);

        console.log("Testing Manual Fetch to Search API...");
        const res = await fetch('https://api.spotify.com/v1/search?q=Muse&type=artist', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log(`Search Status: ${res.status} ${res.statusText}`);
        const body = await res.text();
        console.log("Search Body:", body);
        
        console.log("Testing Manual Fetch to Get Artist (Muse)...");
        const res2 = await fetch('https://api.spotify.com/v1/artists/12Chz98pHFMPJEknNbEGYI', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log(`GetArtist Status: ${res2.status} ${res2.statusText}`);
        const body2 = await res2.text();
        console.log("GetArtist Body:", body2);

    } catch (e) {
        console.error("Error:", e);
    }
}

test();
