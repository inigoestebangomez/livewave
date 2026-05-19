import { SmartRecommendationsService } from './services/smart-recommendations.js';
import { FestivalService } from './services/festivals.js';
import dotenv from 'dotenv';
dotenv.config();

FestivalService.initialize();

const followedList = [
    "Simple Plan", "Green Day", "blink-182", "Sum 41"
];
// Barcelona coordinates
const latlong = "41.4054435755959,2.18009284492577";
const radius = 100;
const genres = ["rock", "punk"];

console.log("🚀 Testing Recommended Concerts near Barcelona (100km)...");

setTimeout(async () => {
    try {
        const events = await SmartRecommendationsService.getRecommendedConcertsNearMe(
            followedList,
            latlong,
            radius,
            genres,
            20
        );

        console.log(`\n🎉 Returned ${events.length} events:`);
        events.forEach((e, idx) => {
            console.log(`${idx + 1}. [${e.source.toUpperCase()}] ${e.artistName || e.name} in ${e.city} (${e.date})`);
            if (e.venueLat || e.venueLng) {
                console.log(`   └ Coords: ${e.venueLat}, ${e.venueLng}`);
            }
        });
    } catch (err) {
        console.error("Error:", err);
    }
}, 1000);
