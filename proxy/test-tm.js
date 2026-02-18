
import fetch from 'node-fetch';

const PROXY_URL = 'http://localhost:8082';

async function testTMRecommendations(seedArtist, city, radius = 50) {
    console.log(`\n--- Testing TM Recs for: ${seedArtist} in ${city} (Radius: ${radius}) ---`);
    const url = `${PROXY_URL}/recommendations/concerts?seed_artist_name=${encodeURIComponent(seedArtist)}&city=${encodeURIComponent(city)}&radius=${radius}`;
    
    console.log(`Fetching: ${url}`);
    try {
        const response = await fetch(url);
        console.log(`Status: ${response.status}`);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.log(`Error Text: ${errorText}`);
            return;
        }

        const data = await response.json();
        console.log(`Response Type: ${typeof data}`);
        
        if (data.events && data.events.length > 0) {
            console.log(`Events Found: ${data.events.length}`);
            console.log(`First Event: ${data.events[0].name} @ ${data.events[0]._embedded?.venues?.[0]?.name}`);
            console.log(`First Event Classifications: ${JSON.stringify(data.events[0].classifications)}`);
        } else {
            console.log('Events Found: 0');
        }

    } catch (e) {
        console.error('Fetch Error:', e.message);
    }
}

(async () => {
    // Muse -> Likely Rock/Alt Rock in Barcelona with large radius
    await testTMRecommendations('Muse', 'Barcelona');
    
    // Test large radius
    console.log('\n--- Testing Large Radius (500km) ---');
    await testTMRecommendations('Coldplay', 'Barcelona', 500); // Might find something further away?
    // Note: My test helper function hardcodes radius=50, I should update it to accept radius.
})();
