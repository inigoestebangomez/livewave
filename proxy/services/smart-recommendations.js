import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { LastfmService } from './lastfm.js';
import { FestivalService } from './festivals.js';

dotenv.config();

const TM_API_KEY = process.env.TM_API_KEY;
const BASE_URL = 'https://app.ticketmaster.com/discovery/v2';

// --- Haversine distance in km between two lat/lng points ---
const haversineKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Known festival city → approx lat/lng
const CITY_COORDS = {
    'barcelona': [41.39, 2.15], 'madrid': [40.42, -3.70], 'bilbao': [43.26, -2.93],
    'viveiro': [43.66, -7.60], 'castellón': [39.99, -0.03], 'burriana': [39.89, -0.08],
    'villarrobledo': [39.26, -2.60], 'santiago': [42.88, -8.54],
    'aranda de duero': [41.67, -3.69], 'vitoria': [42.85, -2.67],
    'almería': [36.84, -2.46], 'huesca': [42.14, -0.41], 'asturias': [43.36, -5.85],
    'benidorm': [38.54, -0.13], 'villena': [38.63, -0.87],
    // UK
    'pilton': [51.15, -2.59], 'reading': [51.45, -0.98], 'leeds': [53.80, -1.55],
    'daresbury': [53.35, -2.62], 'donington': [52.83, -1.37], 'winchester': [51.06, -1.31],
    'manchester': [53.48, -2.24], 'cornualles': [50.26, -5.05], 'londres': [51.51, -0.13],
    'suffolk': [52.19, 0.97], 'glasgow': [55.86, -4.26], 'dorset': [50.75, -2.34],
    'cumbria': [54.46, -2.97], 'cambridgeshire': [52.20, 0.13], 'derbyshire': [53.10, -1.60],
    // Germany
    'wacken': [53.89, 9.36], 'nürburgring': [50.34, 6.94], 'núremberg': [49.45, 11.08],
    'scheeßel': [53.17, 9.49], 'neuhausen': [47.69, 8.79], 'weeze': [51.59, 6.15],
    'mannheim': [49.49, 8.47], 'kastellaun': [50.07, 7.44], 'ferropolis': [51.69, 12.37],
    'hamburgo': [53.55, 10.00], 'berlín': [52.52, 13.40], 'neustadt-glewe': [53.37, 11.59],
    'leipzig': [51.34, 12.37], 'cuxhaven': [53.87, 8.70], 'dinkelsbühl': [49.07, 10.32],
    'rothenburg': [49.38, 10.18], 'lärz': [53.32, 12.72],
};

const getFestivalCoords = (cityStr) => {
    if (!cityStr) return null;
    const key = cityStr.toLowerCase().trim();
    return CITY_COORDS[key] || null;
};

// Words that indicate a TM result is a ticket/pass, not a real concert
const TM_NOISE_WORDS = ['abono', 'abonos', 'entrada', 'entradas', 'camping', 'vip pass', 'parking'];
const isTmNoise = (name = '') => {
    const lower = name.toLowerCase();
    return TM_NOISE_WORDS.some(w => lower.includes(w));
};

// Genre slug to Ticketmaster classification name mapping
const GENRE_TO_TICKETMASTER = {
    'rock': 'Rock',
    'pop': 'Pop',
    'hip-hop': 'Hip-Hop/Rap',
    'rap': 'Hip-Hop/Rap',
    'electronic': 'Electronic',
    'metal': 'Metal',
    'indie': 'Alternative',
    'techno': 'Techno',
    'punk': 'Punk',
    'rnb': 'R&B',
    'latin': 'Latin',
    'classical': 'Classical',
    'jazz': 'Jazz',
    'folk': 'Folk',
    'country': 'Country',
    'blues': 'Blues',
    'reggae': 'Reggae',
    'soul': 'Soul',
    'alternative': 'Alternative',
    'indie rock': 'Alternative',
    'k-pop': 'K-Pop',
};

// Simple in-memory cache for Ticketmaster events (5 min TTL)
const eventsCache = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

function getCachedEvents(artistName, countryCode = null) {
    const key = countryCode 
        ? `${artistName.toLowerCase()}:${countryCode}` 
        : `${artistName.toLowerCase()}:local`;
    const cached = eventsCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.events;
    }
    eventsCache.delete(key);
    return null;
}

function setCachedEvents(artistName, events, countryCode = null) {
    const key = countryCode 
        ? `${artistName.toLowerCase()}:${countryCode}` 
        : `${artistName.toLowerCase()}:local`;
    eventsCache.set(key, { events, timestamp: Date.now() });
}

/**
 * Smart Recommendations Service
 * 
 * Lógica coherente: SOLO mostrar artistas que tienen conciertos reales programados
 * No más artistas históricos sin gira (Elvis, Bon Jovi, etc.)
 */
export const SmartRecommendationsService = {

    /**
     * Para "Your Artists On Tour":
     * Recibe lista de artistas seguidos, devuelve solo los que tienen conciertos próximos
     * OPTIMIZADO: Usa Promise.allSettled para paralelizar
     * 
     * When countryCode is provided, uses country-level filtering for TM API
     * instead of latlong+radius (festivals still use radius)
     */
    getYourArtistsOnTour: async (followedArtists, latlong, radius = 200, countryCode = null) => {
        if (!followedArtists || followedArtists.length === 0) {
            return [];
        }

        console.log(`🎵 [SmartRecs] Checking ${followedArtists.length} followed artists for upcoming concerts... (countryCode: ${countryCode || 'local'})`);
        
        // Process in batches of 5 to avoid rate limiting
        const BATCH_SIZE = 5;
        const artistsToCheck = followedArtists.slice(0, 15); // Limit to 15
        const results = [];
        
        for (let i = 0; i < artistsToCheck.length; i += BATCH_SIZE) {
            const batch = artistsToCheck.slice(i, i + BATCH_SIZE);
            
            const batchResults = await Promise.allSettled(
                batch.map(async (artistName) => {
                    try {
                        const events = await SmartRecommendationsService.searchArtistEvents(artistName, latlong, radius, countryCode);
                        if (events.length > 0) {
                            return {
                                artistName,
                                events,
                                eventCount: events.length,
                                nextEvent: events[0]
                            };
                        }
                        return null;
                    } catch (e) {
                        console.warn(`⚠️ [SmartRecs] Error for ${artistName}:`, e.message);
                        return null;
                    }
                })
            );
            
            for (const result of batchResults) {
                if (result.status === 'fulfilled' && result.value) {
                    results.push(result.value);
                }
            }
        }
        
        console.log(`✅ [SmartRecs] Found ${results.length} artists with upcoming concerts out of ${artistsToCheck.length} followed`);
        
        return results;
    },

    /**
     * Para "Discover" (reemplaza "Trending"):
     * Busca artistas similares que REALMENTE tengan conciertos programados
     * Basado en Last.fm + verificación con Ticketmaster
     *
     * Ahora soporta filtro por géneros para priorizar artistas del mismo género
     *
     * OPTIMIZADO: Usa concurrencia limitada en lugar de peticiones secuenciales
     */
    getDiscoverArtistsWithConcerts: async (seedArtistName, latlong, radius = 200, limit = 10, userGenres = [], countryCode = null) => {
        if (!seedArtistName) {
            return [];
        }

        console.log(`🎵 [SmartRecs] Discovering artists similar to ${seedArtistName} with upcoming concerts... (genres: ${userGenres.join(',') || 'none'})`);
        
        // 1. Get similar artists from Last.fm (request more to allow for genre filtering)
        const similarArtists = await LastfmService.getSimilarArtists(seedArtistName, 30);
        
        if (similarArtists.length === 0) {
            console.log(`⚠️ [SmartRecs] No similar artists found for ${seedArtistName}`);
            return [];
        }

        console.log(`🎵 [SmartRecs] Found ${similarArtists.length} similar artists from Last.fm, checking for concerts...`);
        
        // 2. If genres provided, get seed artist's tags from Last.fm for genre overlap scoring
        let seedTags = [];
        if (userGenres.length > 0) {
            const seedInfo = await LastfmService.getArtistInfo(seedArtistName);
            if (seedInfo && seedInfo.tags) {
                seedTags = seedInfo.tags.map(t => t.toLowerCase());
                console.log(`🏷️ [SmartRecs] Seed artist tags: ${seedTags.join(', ')}`);
            }
        }

        // 3. Filter similar artists by genre overlap when genres are provided
        //    Keep artists that share genre tags OR have high match score
        let filteredArtists = similarArtists;
        if (userGenres.length > 0) {
            // For each similar artist, check Last.fm tags for genre overlap
            // We check in batches to avoid too many API calls
            const BATCH_SIZE = 5;
            const artistsWithTags = [];
            
            for (let i = 0; i < Math.min(similarArtists.length, 15); i += BATCH_SIZE) {
                const batch = similarArtists.slice(i, i + BATCH_SIZE);
                const tagResults = await Promise.allSettled(
                    batch.map(async (artist) => {
                        const info = await LastfmService.getArtistInfo(artist.name);
                        const tags = (info?.tags || []).map(t => t.toLowerCase());
                        return { artist, tags };
                    })
                );
                
                for (const result of tagResults) {
                    if (result.status === 'fulfilled' && result.value) {
                        artistsWithTags.push(result.value);
                    }
                }
            }

            // Score each artist: genre overlap + Last.fm match score
            const scored = artistsWithTags.map(({ artist, tags }) => {
                const allTags = [...tags, ...seedTags];
                const genreOverlap = userGenres.filter(g => 
                    allTags.some(t => t.includes(g) || g.includes(t))
                ).length;
                
                // Normalize: 0-1 genre overlap + 0-1 match score
                const genreScore = Math.min(genreOverlap / Math.max(userGenres.length, 1), 1);
                const matchScore = artist.match || 0;
                
                // Combined score: genre overlap is more important
                const combinedScore = (genreScore * 0.6) + (matchScore * 0.4);
                
                return { artist, tags, genreOverlap, combinedScore };
            });

            // Sort by combined score and filter out low-relevance results
            // Keep artists with ANY genre overlap OR very high match (> 0.5)
            filteredArtists = scored
                .filter(({ genreOverlap, matchScore }) => 
                    genreOverlap > 0 || (matchScore && matchScore > 0.5)
                )
                .sort((a, b) => b.combinedScore - a.combinedScore)
                .map(({ artist }) => artist);

            console.log(`🎯 [SmartRecs] Genre filter: ${similarArtists.length} → ${filteredArtists.length} artists with genre overlap`);
            
            // If genre filtering removed too many results, fall back to high-match-score artists
            if (filteredArtists.length < 3) {
                filteredArtists = similarArtists.filter(a => a.match > 0.3);
                console.log(`⚠️ [SmartRecs] Too few results after genre filter, using match score fallback: ${filteredArtists.length} artists`);
            }
        }

        // 4. Check which ones have upcoming concerts CON CONCURRENCIA
        const BATCH_SIZE = 5;
        const artistsWithConcerts = [];
        
        for (let i = 0; i < filteredArtists.length && artistsWithConcerts.length < limit; i += BATCH_SIZE) {
            const batch = filteredArtists.slice(i, i + BATCH_SIZE);

            const results = await Promise.allSettled(
                batch.map(async (artist) => {
                    const events = await SmartRecommendationsService.searchArtistEvents(artist.name, latlong, radius, countryCode);
                    return { artist, events };
                })
            );
            
            for (const result of results) {
                if (result.status === 'fulfilled' && result.value.events.length > 0) {
                    const { artist, events } = result.value;
                    artistsWithConcerts.push({
                        id: `discover-${artist.name}`,
                        name: artist.name,
                        artistName: artist.name,
                        image: artist.image,
                        match: artist.match,
                        source: 'lastfm',
                        genre: null,
                        events: events.slice(0, 3),
                        eventCount: events.length,
                        url: events[0].url
                    });
                    console.log(`  ✅ ${artist.name}: ${events.length} concerts (match: ${(artist.match * 100).toFixed(0)}%)`);
                }
            }
            
            if (artistsWithConcerts.length >= limit) {
                break;
            }
        }

        console.log(`✅ [SmartRecs] Found ${artistsWithConcerts.length} similar artists with upcoming concerts`);
        return artistsWithConcerts.slice(0, limit);
    },

    /**
     * Get festival events for a specific artist
     * Searches scraped festival data for artist appearances
     * Filters by distance from user location
     */
    getFestivalEventsForArtist: (artistName, latlong, radius = 200) => {
        try {
            const results = FestivalService.searchArtistsByName(artistName);

            if (!results || results.length === 0) {
                return [];
            }

            // Transform FestivalService format → Event format matching searchArtistEvents
            let festivalEvents = results.map(match => {
                const venue = match._embedded?.venues?.[0];
                return {
                    id: match.id,
                    name: `${match.name} @ ${venue?.name || match.name}`,
                    date: null, // Festival dates often unknown from scraping
                    venue: venue?.name || '',
                    city: venue?.city?.name || '',
                    country: venue?.country?.name || '',
                    image: null, // No image from festival scraping
                    url: match.url || '',
                    artistName: match.name,
                    source: 'festival',
                };
            });

            // Filter festival events by distance if user location is provided
            if (latlong && festivalEvents.length > 0) {
                const [userLat, userLng] = latlong.split(',').map(parseFloat);
                const maxKm = parseFloat(radius) || 200;

                const beforeFilter = festivalEvents.length;
                festivalEvents = festivalEvents.filter(event => {
                    const coords = getFestivalCoords(event.city);
                    if (!coords) return false;
                    const distKm = haversineKm(userLat, userLng, coords[0], coords[1]);
                    return distKm <= maxKm;
                });

                if (beforeFilter !== festivalEvents.length) {
                    console.log(`📍 [SmartRecs] Festival distance filter for ${artistName}: ${beforeFilter} → ${festivalEvents.length} within ${maxKm}km`);
                }
            }

            return festivalEvents;
        } catch (err) {
            console.error(`❌ [SmartRecs] Error getting festival events for ${artistName}:`, err.message);
            return [];
        }
    },

    /**
     * Search events for a specific artist
     * CACHING: 5 minutes TTL to reduce API calls
     * Now fetches both Ticketmaster AND Festival events in parallel
     * 
     * When countryCode is provided, uses country-level filtering instead of latlong+radius
     */
    searchArtistEvents: async (artistName, latlong, radius = 200, countryCode = null) => {
        if (!artistName) return [];

        // Check cache first
        const cached = getCachedEvents(artistName, countryCode);
        if (cached) {
            console.log(`📦 [SmartRecs] Cache hit for ${artistName}`);
            return cached;
        }

        // Fetch TM events and Festival events in parallel
        const [tmResult, festResult] = await Promise.allSettled([
            // TM fetch - the original logic, extracted as inline
            (async () => {
                if (!TM_API_KEY) return [];
                const params = new URLSearchParams({
                    apikey: TM_API_KEY,
                    keyword: artistName,
                    size: '10',
                    sort: 'date,asc'
                });
                // When countryCode is provided, use country-level filtering
                // Otherwise fall back to latlong+radius
                if (countryCode) {
                    params.append('countryCode', countryCode);
                } else if (latlong) {
                    params.append('latlong', latlong);
                    params.append('radius', String(radius));
                    params.append('unit', 'km');
                }
                const today = new Date().toISOString().split('T')[0];
                params.append('startDateTime', `${today}T00:00:00Z`);
                const url = `${BASE_URL}/events.json?${params.toString()}`;
                const response = await fetch(url);
                if (!response.ok) {
                    if (response.status === 429) {
                        console.warn(`⚠️ [SmartRecs] Rate limited for ${artistName}, waiting...`);
                        await new Promise(r => setTimeout(r, 1000));
                    }
                    return [];
                }
                const data = await response.json();
                const events = data._embedded?.events || [];
                return events
                    .filter(e => !isTmNoise(e.name) && !isTmNoise(e._embedded?.attractions?.[0]?.name))
                    .map(e => ({
                        id: e.id,
                        name: e.name,
                        date: e.dates?.start?.localDate,
                        time: e.dates?.start?.localTime,
                        venue: e._embedded?.venues?.[0]?.name,
                        city: e._embedded?.venues?.[0]?.city?.name,
                        country: e._embedded?.venues?.[0]?.country?.name,
                        image: e.images?.[0]?.url,
                        url: e.url,
                        artistName: e._embedded?.attractions?.[0]?.name || artistName,
                        source: 'ticketmaster',
                    }));
            })(),
            // Festival fetch - no countryCode support for festivals
            Promise.resolve(SmartRecommendationsService.getFestivalEventsForArtist(artistName, latlong, radius))
        ]);

        // Extract results, falling back to empty arrays on failure
        const tmEvents = tmResult.status === 'fulfilled' ? tmResult.value : [];
        const festEvents = festResult.status === 'fulfilled' ? festResult.value : [];

        if (tmResult.status === 'rejected') {
            console.error(`❌ [SmartRecs] TM error for ${artistName}:`, tmResult.reason?.message);
        }
        if (festResult.status === 'rejected') {
            console.error(`❌ [SmartRecs] Festival error for ${artistName}:`, festResult.reason?.message);
        }

        console.log(`🎵 [SmartRecs] ${artistName}: ${tmEvents.length} TM + ${festEvents.length} festival events`);

        // Merge and deduplicate
        let merged = [...tmEvents];

        // Add festival events that don't overlap with TM events
        for (const fest of festEvents) {
            const isDuplicate = tmEvents.some(tm => {
                // Check if TM event name contains festival venue name, or same city + similar date
                const tmNameNorm = (tm.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                const festVenueNorm = (fest.venue || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                const festNameNorm = (fest.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                // If TM event name contains the festival name or venue, it's a duplicate
                if (festVenueNorm && tmNameNorm.includes(festVenueNorm)) return true;
                if (festNameNorm && tmNameNorm.includes(festNameNorm)) return true;
                // Same artist, same city, same date
                if (tm.city === fest.city && tm.date === fest.date && tm.date !== null) return true;
                return false;
            });
            if (!isDuplicate) {
                merged.push(fest);
            }
        }

        // Deduplicate by date + city + venue (TM can return same event multiple times)
        const deduped = [];
        const seen = new Set();
        for (const event of merged) {
            const key = `${event.date || ''}_${(event.city || '').toLowerCase()}_${(event.venue || '').toLowerCase()}`;
            if (!seen.has(key)) {
                seen.add(key);
                deduped.push(event);
            }
        }

        // Cache the deduplicated result
        if (deduped.length > 0) {
            setCachedEvents(artistName, deduped, countryCode);
        }

        return deduped;
    },

    /**
     * Get upcoming concerts by genre (alternative to trending)
     * Returns actual concerts happening, not just popular artists
     * Now supports genre slug mapping to TM classification names
     */
    getUpcomingByGenre: async (genre, latlong, radius = 200, limit = 15, countryCode = null) => {
        if (!TM_API_KEY || !genre) return [];

        // Map genre slug to TM classification name
        const tmGenre = GENRE_TO_TICKETMASTER[genre.toLowerCase().trim()] || genre;

        console.log(`🎵 [SmartRecs] Finding upcoming ${genre} (TM: ${tmGenre}) concerts... (countryCode: ${countryCode || 'local'})`);

        const params = new URLSearchParams({
            apikey: TM_API_KEY,
            classificationName: genre,
            size: String(limit * 2), // Fetch more to filter
            sort: 'date,asc'
        });

        // When countryCode is provided, use country-level filtering instead of latlong+radius
        if (countryCode) {
            params.append('countryCode', countryCode);
        } else if (latlong) {
            params.append('latlong', latlong);
            params.append('radius', String(radius));
            params.append('unit', 'km');
        }

        // Only future events
        const today = new Date().toISOString().split('T')[0];
        params.append('startDateTime', `${today}T00:00:00Z`);

        const url = `${BASE_URL}/events.json?${params.toString()}`;

        try {
            const response = await fetch(url);
            if (!response.ok) return [];

            const data = await response.json();
            const events = data._embedded?.events || [];

            return events
                .filter(e => !isTmNoise(e.name))
                .slice(0, limit)
                .map(e => ({
                    id: e.id,
                    name: e.name,
                    date: e.dates?.start?.localDate,
                    venue: e._embedded?.venues?.[0]?.name,
                    city: e._embedded?.venues?.[0]?.city?.name,
                    image: e.images?.[0]?.url,
                    url: e.url,
                    artistName: e._embedded?.attractions?.[0]?.name || e.name,
                    genre: genre,
                    source: 'ticketmaster'
                }));
        } catch (err) {
            console.error(`❌ [SmartRecs] Error getting ${genre} events:`, err.message);
            return [];
        }
    }
};
