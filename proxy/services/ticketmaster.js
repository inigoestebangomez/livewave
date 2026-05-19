
import { LastfmService } from './lastfm.js';
import { getSimilarArtistsAsync } from './similarity.js';
import fetch from 'node-fetch';

const TM_API_KEY = process.env.TM_API_KEY;
const BASE_URL = 'https://app.ticketmaster.com/discovery/v2';

// --- Haversine distance in km ---
const haversineKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Known city → approx lat/lng
const CITY_COORDS = {
    'barcelona': [41.39, 2.15], 'madrid': [40.42, -3.70], 'bilbao': [43.26, -2.93],
    'valencia': [39.47, -0.38], 'sevilla': [37.39, -5.98],
};
const getCityCoords = (cityStr) => {
    if (!cityStr) return null;
    return CITY_COORDS[cityStr.toLowerCase().trim()] || null;
};

// Words that indicate a TM result is a ticket/pass, not a real concert
const TM_NOISE_WORDS = ['abono', 'abonos', 'entrada', 'entradas', 'camping', 'vip pass', 'parking', 'tablao', 'flamenco show', 'espectáculo flamenco'];
const isTmNoise = (name = '') => {
    const lower = name.toLowerCase();
    return TM_NOISE_WORDS.some(w => lower.includes(w));
};

// Non-music genres that should never be used for recommendations
const NON_MUSIC_GENRES = ['Comedy', 'Theatre', 'Talk', 'Sports', 'Film', 'Arts', 'Miscellaneous'];

export const TicketmasterService = {
  
  // Search for events with filters
  searchEvents: async ({ keyword, page = 0, size = 20, city, latLong, radius, classificationName, sort = 'date,asc' }) => {
    if (!TM_API_KEY) throw new Error('Missing TM_API_KEY');
    
    const params = new URLSearchParams({
        apikey: TM_API_KEY,
        page: String(page),
        size: String(size),
        sort: sort
    });

    if (keyword) params.append('keyword', keyword);
    if (city) params.append('city', city);
    if (latLong) {
        params.append('latlong', latLong);
        params.append('unit', 'km');
    }
    if (radius) params.append('radius', radius);
    if (classificationName) params.append('classificationName', classificationName);

    const url = `${BASE_URL}/events.json?${params.toString()}`;
    console.log(`🔍 [TMService] Fetching Events: ${url}`);
    if (city) console.log(`   -> City Filter: ${city}`);
    if (latLong) console.log(`   -> LatLong Filter: ${latLong}`);

    const response = await fetch(url);
    if (!response.ok) {
        if (response.status === 429) {
             console.warn("⚠️ TM Rate Limit Exceeded. Waiting 1s...");
             await new Promise(r => setTimeout(r, 1000));
             return [];
        }
        throw new Error(`TM API Error: ${response.status}`);
    }
    
    const data = await response.json();
    const events = data._embedded?.events || [];
    
    // Strip noise + post-filter by distance (TM sometimes ignores latlong)
    let filtered = events.filter(e => !isTmNoise(e.name) && !isTmNoise(e._embedded?.attractions?.[0]?.name));
    
    if (latLong && radius) {
        const [userLat, userLng] = latLong.split(',').map(parseFloat);
        const maxKm = parseFloat(radius) || 200;
        const before = filtered.length;
        filtered = filtered.filter(e => {
            const venue = e._embedded?.venues?.[0];
            if (venue?.location?.latitude && venue?.location?.longitude) {
                const dist = haversineKm(userLat, userLng, parseFloat(venue.location.latitude), parseFloat(venue.location.longitude));
                return dist <= maxKm;
            }
            const coords = getCityCoords(venue?.city?.name);
            if (coords) {
                const dist = haversineKm(userLat, userLng, coords[0], coords[1]);
                return dist <= maxKm;
            }
            return false;
        });
        if (filtered.length < before) {
            console.log(`📍 [TMService] Distance post-filter: ${before} → ${filtered.length}`);
        }
    }
    
    return filtered;
  },

  // ... searchAttractions ...
  searchAttractions: async (keyword) => {
      if (!TM_API_KEY) throw new Error('Missing TM_API_KEY');
      const url = `${BASE_URL}/attractions.json?apikey=${TM_API_KEY}&keyword=${encodeURIComponent(keyword)}`;
      const response = await fetch(url);
      const data = await response.json();
      const attractions = data._embedded?.attractions || [];
      
      // Filter out non-music genres and noise
      return attractions.filter(a => {
          // Check for non-music genre classification
          const classification = a.classifications?.[0];
          const genre = classification?.genre?.name;
          const subGenre = classification?.subGenre?.name;
          const searchGenre = subGenre && subGenre !== 'Undefined' ? subGenre : genre;
          
          if (searchGenre && NON_MUSIC_GENRES.includes(searchGenre)) {
              console.log(`🚫 [TMService] Filtering non-music attraction: ${a.name} (${searchGenre})`);
              return false;
          }
          
          return !isTmNoise(a.name);
      });
  },

  // Get recommendations based on seed artist name + location
  // Usa Last.fm para artistas similares (basado en datos reales de usuarios)
  getConcertRecommendations: async ({ seedArtistName, city, latLong, radius = 50 }) => {
      console.log(`🎯 [TMService] Getting recs for seed: ${seedArtistName}`);
      let allEvents = [];

      // STRATEGY 1: Last.fm Similar Artists (Data-driven, no hardcode)
      console.log(`🎵 [TMService] Strategy 1: Fetching similar artists from Last.fm...`);
       const lastfmArtists = await LastfmService.getSimilarArtists(seedArtistName, 5);
       
       if (lastfmArtists.length > 0) {
           console.log(`✅ [TMService] Last.fm found ${lastfmArtists.length} similar artists:`);
           lastfmArtists.slice(0, 3).forEach(a => {
               console.log(`   • ${a.name} (match: ${(a.match * 100).toFixed(1)}%)`);
           });
           
           // Search for events for top similar artists (Sequential with delay)
           // Reduced to top 3 to avoid TM rate limits
           const topSimilar = lastfmArtists.slice(0, 3).map(a => a.name);
           const allEvents = [];
           for (const artist of topSimilar) {
               try {
                   const events = await TicketmasterService.searchEvents({
                       keyword: artist,
                       city,
                       latLong,
                       radius,
                       size: 5
                   });
                   allEvents.push(...events);
                   // 500ms delay between requests to avoid rate limiting
                   await new Promise(r => setTimeout(r, 500));
                } catch (e) {
                    // Skip failed searches
                }
            }
           
            if (allEvents.length > 0) {
               console.log(`✨ [TMService] Found ${allEvents.length} events via Last.fm similar artists.`);
               return allEvents;
           } else {
               console.log(`⚠️ [TMService] Last.fm artists yielded no events. Trying festival co-occurrence...`);
           }
      } else {
          console.log(`⚠️ [TMService] Last.fm returned no similar artists.`);
      }

      // STRATEGY 2: Festival Co-occurrence Map (Dynamic, from festival data)
      console.log(`🎪 [TMService] Strategy 2: Checking festival co-occurrence map...`);
      const festivalArtists = await getSimilarArtistsAsync(seedArtistName);
      
      if (festivalArtists.length > 0) {
          console.log(`✅ [TMService] Festival map found: ${festivalArtists.join(', ')}`);
          
           const topFestival = festivalArtists.slice(0, 3);
           allEvents = [];
           for (const artist of topFestival) {
               try {
                   const events = await TicketmasterService.searchEvents({
                       keyword: artist,
                       city,
                       latLong,
                       radius,
                       size: 5
                   });
                   allEvents.push(...events);
                   await new Promise(r => setTimeout(r, 500));
               } catch (e) {
                   // Skip failed searches
               }
           }
          
          if (allEvents.length > 0) {
              console.log(`✨ [TMService] Found ${allEvents.length} events via festival co-occurrence.`);
              return allEvents;
          } else {
              console.log(`⚠️ [TMService] Festival map yielded no events. Falling back to genre.`);
          }
      }

      // STRATEGY 3: Fallback to Ticketmaster Genre (Broadest)
      console.log(`🎸 [TMService] Strategy 3: Genre-based fallback...`);
      const attractions = await TicketmasterService.searchAttractions(seedArtistName);
      if (attractions.length === 0) {
          console.log(`❌ [TMService] Artist not found in Ticketmaster. No recommendations possible.`);
          return [];
      }

      const artist = attractions[0];
      const classification = artist.classifications?.[0];
      const genre = classification?.genre?.name;
      const subGenre = classification?.subGenre?.name;

      const searchGenre = subGenre && subGenre !== 'Undefined' ? subGenre : genre;

      if (!searchGenre || searchGenre === 'Undefined') {
          console.log(`⚠️ [TMService] Artist ${seedArtistName} has no genre in TM. Cannot recommend.`);
          return [];
      }

      // Never search by non-music genres (comedy, theatre, etc.)
      if (NON_MUSIC_GENRES.includes(searchGenre)) {
          console.log(`⚠️ [TMService] Genre "${searchGenre}" is non-music. No recommendations possible.`);
          return [];
      }

      console.log(`🎯 [TMService] Searching by genre: ${searchGenre}`);

      const genreEvents = await TicketmasterService.searchEvents({
          classificationName: searchGenre,
          city,
          latLong,
          radius,
          size: 10
      });

      console.log(`✨ [TMService] Found ${genreEvents.length} events via genre fallback:`);
      genreEvents.forEach(e => {
          const venue = e._embedded?.venues?.[0];
          console.log(`   → ${e.name} @ ${venue?.city?.name || 'unknown'} (${venue?.location?.latitude || 'no lat'}, ${venue?.location?.longitude || 'no lng'})`);
      });
      return genreEvents;
  }
};
