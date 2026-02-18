
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET;

async function test() {
    console.log("--- Debugging Spotify Auth & Related Artists ---");
    
    // 1. Get Token
    const authOptions = {
        method: 'POST',
        headers: {
            'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    };

    try {
        const authRes = await fetch('https://accounts.spotify.com/api/token', authOptions);
        const authData = await authRes.json();
        
        if (!authData.access_token) {
            console.error("❌ Failed to get token:", authData);
            return;
        }
        
        const token = authData.access_token;
        console.log("✅ Got Token (first 10 chars):", token.substring(0, 10) + "...");

        // 2. Test Related Artists (Muse ID: 12Chz98pHFMPJEknJQMWvI)
        const museId = '12Chz98pHFMPJEknJQMWvI';
        
        console.log(`\nFetching artist details for Muse...`);
        const artistRes = await fetch(`https://api.spotify.com/v1/artists/${museId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const artistData = await artistRes.json();
        console.log("Artist Res Status:", artistRes.status);
        console.log("Artist Body:", JSON.stringify(artistData));

        /*
        const relatedRes = await fetch(`https://api.spotify.com/v1/artists/${museId}/related-artists?market=US`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        */

    } catch (e) {
        console.error("Exec Error:", e);
    }
}

test();
