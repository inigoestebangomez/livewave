import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const TM_API_KEY = process.env.TM_API_KEY;

async function checkFestial() {
    const params = new URLSearchParams({
        apikey: TM_API_KEY,
        keyword: 'Festial',
        size: '10'
    });
    const url = `https://app.ticketmaster.com/discovery/v2/events.json?${params.toString()}`;
    const response = await fetch(url);
    const data = await response.json();
    const events = data._embedded?.events || [];
    console.log(`Found ${events.length} events matching Festial`);
    for (const e of events) {
        console.log({
            id: e.id,
            name: e.name,
            city: e._embedded?.venues?.[0]?.city?.name,
            country: e._embedded?.venues?.[0]?.country?.name,
            location: e._embedded?.venues?.[0]?.location,
            classifications: e.classifications
        });
    }
}

checkFestial();
