import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const TM_API_KEY = process.env.TM_API_KEY;

async function inspectEvent() {
    const url = `https://app.ticketmaster.com/discovery/v2/events/Z698xZ2qZ1k7zov_I.json?apikey=${TM_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
}

inspectEvent();
