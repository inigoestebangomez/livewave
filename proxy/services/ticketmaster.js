
import { SIMILARITY_MAP, getSimilarArtists } from './similarity.js';
import fetch from 'node-fetch';

const TM_API_KEY = process.env.TM_API_KEY;
const BASE_URL = 'https://app.ticketmaster.com/discovery/v2';

export const TicketmasterService = {
  
  // Search for events with filters
  searchEvents: async ({ keyword, page = 0, size = 20, city, latLong, radius, classificationName, sort = 'date,asc' }) => {
    if (!TM_API_KEY) throw new Error('Missing TM_API_KEY');
    
    // ... existing code ...
    // Note: If keyword is provided, use it. If not, rely on classification.
    const params = new URLSearchParams({
        apikey: TM_API_KEY,
        page: String(page),
        size: String(size),
        sort: sort
    });

    if (keyword) params.append('keyword', keyword);
    if (city) params.append('city', city);
    if (latLong) params.append('latlong', latLong);
    if (radius) params.append('radius', radius);
    if (classificationName) params.append('classificationName', classificationName);

    const url = `${BASE_URL}/events.json?${params.toString()}`;
    console.log(`🔍 [TMService] Fetching Events: ${url}`);
    if (city) console.log(`   -> City Filter: ${city}`);
    if (latLong) console.log(`   -> LatLong Filter: ${latLong}`);

    const response = await fetch(url);
    if (!response.ok) {
        // Handle 429
        if (response.status === 429) {
             console.warn("⚠️ TM Rate Limit Exceeded. Waiting 1s...");
             await new Promise(r => setTimeout(r, 1000));
             return []; // Retry logic needed ideally, but simple return for now
        }
        throw new Error(`TM API Error: ${response.status}`);
    }
    
    const data = await response.json();
    return data._embedded?.events || [];
  },

  // ... searchAttractions ...
  searchAttractions: async (keyword) => {
      if (!TM_API_KEY) throw new Error('Missing TM_API_KEY');
      const url = `${BASE_URL}/attractions.json?apikey=${TM_API_KEY}&keyword=${encodeURIComponent(keyword)}`;
      const response = await fetch(url);
      const data = await response.json();
      return data._embedded?.attractions || [];
  },

  // Get recommendations based on seed artist name + location
  getConcertRecommendations: async ({ seedArtistName, city, latLong, radius = 50 }) => {
      console.log(`🎯 [TMService] Getting recs for seed: ${seedArtistName}`);
      let allEvents = [];

      // STRATEGY 1: Check Hardcoded Similar Artists
      const similarArtists = getSimilarArtists(seedArtistName);
      
      if (similarArtists.length > 0) {
          console.log(`✅ Found similar artists in map: ${similarArtists.join(', ')}`);
          
          // Search for events for these artists (Parallel)
          // Limit to top 3 to avoid rate limits
          const topSimilar = similarArtists.slice(0, 3);
          const promises = topSimilar.map(artist => 
             TicketmasterService.searchEvents({
                 keyword: artist, // Search by Artist Name
                 city,
                 latLong,
                 radius,
                 size: 5 // fewer per artist
             }).catch(e => [])
          );
          
          const results = await Promise.all(promises);
          allEvents = results.flat();
          
          if (allEvents.length > 0) {
              console.log(`✨ Found ${allEvents.length} events via Similarity Map.`);
              return allEvents;
          } else {
              console.log(`⚠️ Similarity Map yielded no events. Falling back to Genre.`);
          }
      }

      // STRATEGY 2: Fallback to Ticketmaster Genre (Broader)
      // 1. Find Artist to get Genre
      const attractions = await TicketmasterService.searchAttractions(seedArtistName);
      if (attractions.length === 0) return [];

      const artist = attractions[0];
      const classification = artist.classifications?.[0];
      const genre = classification?.genre?.name;
      const subGenre = classification?.subGenre?.name;

      // Prefer subGenre (e.g. "Alternative Rock") over Genre ("Rock")
      const searchGenre = subGenre && subGenre !== 'Undefined' ? subGenre : genre;

      if (!searchGenre || searchGenre === 'Undefined') {
          console.log(`⚠️ Artist ${seedArtistName} has no genre in TM. Cannot recommend.`);
          return [];
      }

      console.log(`🎯 [TMService] Fallback: Recommending via genre: ${searchGenre}`);

      // 2. Search Events in this genre
      const genreEvents = await TicketmasterService.searchEvents({
          classificationName: searchGenre,
          city,
          latLong,
          radius,
          size: 10
      });

      return genreEvents;
  }
};
