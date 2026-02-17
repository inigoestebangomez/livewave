import fetch from 'node-fetch';

const API_URL = 'http://localhost:8082';

async function testArtist(name) {
    console.log(`\n--- Testing: ${name} ---`);
    const url = `${API_URL}/recommendations/artists?seed_artist_name=${encodeURIComponent(name)}`;
    console.log(`Fetching: ${url}`);
    
    try {
        const res = await fetch(url);
        console.log(`Status: ${res.status}`);
        
        if (res.ok) {
            const data = await res.json();
            console.log('Response Type:', typeof data);
            if (data.recommendations) {
                console.log(`Recommendations Found: ${data.recommendations.length}`);
                if (data.recommendations.length > 0) {
                    console.log('First rec:', data.recommendations[0].name);
                }
            } else {
                console.log('Structure:', JSON.stringify(data, null, 2));
            }
        } else {
            console.log('Error Text:', await res.text());
        }
    } catch (err) {
        console.error('Fetch Fatal Error:', err.message);
    }
}

async function run() {
    await testArtist('Muse');
    await testArtist('No Way Out'); // Known empty?
    await testArtist('Coldplay');
}

run();
