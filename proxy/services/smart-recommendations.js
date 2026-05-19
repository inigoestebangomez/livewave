import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { LastfmService } from './lastfm.js';
import { FestivalService } from './festivals.js';
import { SpotifyService } from './spotify.js';

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
    'valencia': [39.47, -0.38], 'gandía': [38.97, -0.18], 'granada': [37.18, -3.60],
    'sevilla': [37.39, -5.98], 'gijón': [43.53, -5.66], 'alcázar de san juan': [39.39, -3.21],
    // UK
    'isla de wight': [50.69, -1.30],
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
    // USA
    'indio, ca': [33.72, -116.22], 'chicago, il': [41.88, -87.63], 'las vegas, nv': [36.17, -115.14],
    'manchester, tn': [35.48, -86.08], 'austin, tx': [30.27, -97.74], 'miami, fl': [25.76, -80.19],
    'san francisco, ca': [37.77, -122.42], 'nueva york, ny': [40.71, -74.01], 'rothbury, mi': [43.51, -86.35],
    'boston, ma': [42.36, -71.06], 'sacramento, ca': [38.58, -121.49], 'louisville, ky': [38.25, -85.76],
    'detroit, mi': [42.33, -83.05], 'columbus, oh': [39.96, -83.00], 'nueva orleans, la': [29.95, -90.07]
};

const getFestivalCoords = (cityStr) => {
    if (!cityStr) return null;
    const clean = cityStr.toLowerCase().trim();
    if (clean.includes('/')) {
        const parts = clean.split('/');
        for (const part of parts) {
            const trimmed = part.trim();
            if (CITY_COORDS[trimmed]) return CITY_COORDS[trimmed];
        }
    }
    return CITY_COORDS[clean] || null;
};

// Words that indicate a TM result is a ticket/pass, not a real concert
const TM_NOISE_WORDS = ['abono', 'abonos', 'entrada', 'entradas', 'camping', 'vip pass', 'parking', 'tablao', 'flamenco show', 'espectáculo flamenco'];
const isTmNoise = (name = '') => {
    const lower = name.toLowerCase();
    return TM_NOISE_WORDS.some(w => lower.includes(w));
};

// Check if TM event is actually music (not comedy, theatre, sports)
const isMusicEvent = (e) => {
    const segs = e.classifications || [];
    for (const c of segs) {
        const seg = (c.segment?.name || '').toLowerCase();
        const gen = (c.genre?.name || '').toLowerCase();
        const sub = (c.subGenre?.name || '').toLowerCase();
        if (seg === 'music') return true;
        if (gen.includes('comedy') || gen.includes('theatre') || gen.includes('talk')) return false;
        if (sub.includes('comedy') || sub.includes('stand-up')) return false;
    }
    return true; // Default to keep if no classification info
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
};

// Keywords that indicate an event does NOT belong to a genre search
const GENRE_INCOMPATIBLE = {
    'electronic': ['reggaeton', 'latin pop', 'flamenco', 'comedy', 'stand-up', 'monólogo', 'tablao', 'bad bunny', 'j balvin', 'maluma', 'karol g', 'ozuna', 'daddy yankee', 'anuel', 'bizarrap', 'feid'],
    'techno': ['reggaeton', 'latin pop', 'flamenco', 'comedy', 'stand-up', 'monólogo', 'tablao', 'bad bunny', 'j balvin', 'maluma', 'karol g', 'ozuna', 'daddy yankee', 'anuel', 'bizarrap', 'feid'],
    'house': ['reggaeton', 'latin pop', 'flamenco', 'comedy', 'stand-up', 'monólogo', 'tablao', 'bad bunny', 'j balvin', 'maluma', 'karol g', 'ozuna', 'daddy yankee', 'anuel', 'bizarrap', 'feid'],
    'rock': ['reggaeton', 'flamenco', 'comedy', 'stand-up', 'monólogo', 'tablao', 'bad bunny'],
    'punk': ['reggaeton', 'flamenco', 'comedy', 'stand-up', 'monólogo', 'tablao', 'bad bunny'],
    'metal': ['reggaeton', 'flamenco', 'comedy', 'stand-up', 'monólogo', 'tablao', 'bad bunny'],
    'indie': ['reggaeton', 'flamenco', 'comedy', 'stand-up', 'monólogo', 'tablao', 'bad bunny'],
    'pop': ['flamenco', 'comedy', 'stand-up', 'monólogo', 'tablao'],
    'jazz': [],
    'folk': [],
    'country': [],
    'blues': [],
    'reggae': [],
    'soul': [],
    'alternative': [],
    'indie rock': [],
    'k-pop': [],
};

// Simple in-memory cache for Ticketmaster events (6 hour TTL)
// Aggressive caching to reduce API rate limit issues
const eventsCache = new Map();
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

function getCachedEvents(artistName, countryCode = null, latlong = null, radius = 200) {
    let latlongKey = 'local';
    if (latlong) {
        const [lat, lng] = latlong.split(',').map(parseFloat);
        latlongKey = `${lat.toFixed(1)},${lng.toFixed(1)}:${radius}`;
    }
    const key = countryCode 
        ? `${artistName.toLowerCase()}:${countryCode}` 
        : `${artistName.toLowerCase()}:${latlongKey}`;
    const cached = eventsCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.events;
    }
    eventsCache.delete(key);
    return null;
}

function setCachedEvents(artistName, events, countryCode = null, latlong = null, radius = 200) {
    let latlongKey = 'local';
    if (latlong) {
        const [lat, lng] = latlong.split(',').map(parseFloat);
        latlongKey = `${lat.toFixed(1)},${lng.toFixed(1)}:${radius}`;
    }
    const key = countryCode 
        ? `${artistName.toLowerCase()}:${countryCode}` 
        : `${artistName.toLowerCase()}:${latlongKey}`;
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
        
        // Process in batches of 3 with 1s delay between batches to avoid TM rate limiting
        const BATCH_SIZE = 3;
        const DELAY_MS = 1000;
        const artistsToCheck = followedArtists.slice(0, 10); // Limit to 10 (was 15)
        const results = [];
        
        for (let i = 0; i < artistsToCheck.length; i += BATCH_SIZE) {
            const batch = artistsToCheck.slice(i, i + BATCH_SIZE);
            
            const batchResults = await Promise.allSettled(
                batch.map(async (artistName) => {
                    try {
                        // Use a large radius for festivals (1000km) so we catch shows anywhere in the country
                        // TM already uses countryCode for country-wide search, but festivals need distance filter
                        const festivalRadius = Math.max(parseInt(radius) || 200, 1000);
                        const events = await SmartRecommendationsService.searchArtistEvents(artistName, latlong, festivalRadius, countryCode);
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
            
            // Delay between batches to avoid TM rate limiting
            if (i + BATCH_SIZE < artistsToCheck.length) {
                await new Promise(r => setTimeout(r, DELAY_MS));
            }
        }
        
        // Enrich results with Last.fm images for events without images (festivals, etc.)
        // Spotify rate-limits aggressively, so we use Last.fm as primary image source
        if (results.length > 0) {
            for (const result of results) {
                if (!result.nextEvent.image) {
                    try {
                        const artistInfo = await LastfmService.getArtistInfo(result.artistName);
                        if (artistInfo?.image) {
                            result.nextEvent.image = artistInfo.image;
                            for (const evt of result.events) {
                                if (!evt.image) evt.image = artistInfo.image;
                            }
                        }
                    } catch (e) {
                        // Silently fail — images are nice-to-have
                    }
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
    getDiscoverArtistsWithConcerts: async (seedArtistName, latlong, radius = 200, limit = 10, userGenres = [], countryCode = null, excludeArtists = []) => {
        if (!seedArtistName) {
            return [];
        }

        console.log(`🎵 [SmartRecs] Discovering artists similar to ${seedArtistName} with upcoming concerts... (genres: ${userGenres.join(',') || 'none'})`);
        
        // ===================== STRATEGY 1: Last.fm =====================
        const similarArtists = await LastfmService.getSimilarArtists(seedArtistName, 30);
        let filteredArtists = similarArtists;
        
        if (similarArtists.length > 0 && userGenres.length > 0) {
            // Genre overlap scoring with Last.fm tags
            let seedTags = [];
            const seedInfo = await LastfmService.getArtistInfo(seedArtistName);
            if (seedInfo && seedInfo.tags) {
                seedTags = seedInfo.tags.map(t => t.toLowerCase());
            }
            
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

            const scored = artistsWithTags.map(({ artist, tags }) => {
                const allTags = [...tags, ...seedTags];
                const genreOverlap = userGenres.filter(g => 
                    allTags.some(t => t.includes(g) || g.includes(t))
                ).length;
                const genreScore = Math.min(genreOverlap / Math.max(userGenres.length, 1), 1);
                const matchScore = artist.match || 0;
                const combinedScore = (genreScore * 0.6) + (matchScore * 0.4);
                return { artist, tags, genreOverlap, combinedScore };
            });

            filteredArtists = scored
                .filter(({ genreOverlap, matchScore }) => 
                    genreOverlap > 0 || (matchScore && matchScore > 0.5)
                )
                .sort((a, b) => b.combinedScore - a.combinedScore)
                .map(({ artist }) => artist);

            if (filteredArtists.length < 3) {
                filteredArtists = similarArtists.filter(a => a.match > 0.3);
            }
        }

        // Exclude artists the user already follows — do this BEFORE TM API calls to avoid wasting quota
        const excludeSet = new Set(excludeArtists.map(n => n.toLowerCase()));
        const candidateArtists = filteredArtists.filter(a => !excludeSet.has(a.name.toLowerCase()));

        // Check Last.fm similars for concerts
        let artistsWithConcerts = [];
        const BATCH_SIZE = 5;
        for (let i = 0; i < candidateArtists.length && artistsWithConcerts.length < limit; i += BATCH_SIZE) {
            const batch = candidateArtists.slice(i, i + BATCH_SIZE);
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
                }
            }
        }

        // Note: Spotify Related Artists fallback removed — API returns 403 consistently

        console.log(`✅ [SmartRecs] Found ${artistsWithConcerts.length} similar artists with upcoming concerts`);
        if (artistsWithConcerts.length > 0) {
            console.log(`🎵 [SmartRecs] Discover results for ${seedArtistName}:`);
            artistsWithConcerts.forEach(a => {
                const firstEvent = a.events?.[0];
                console.log(`   → ${a.artistName} @ ${firstEvent?.city || 'unknown'} (${a.source})`);
            });
        }
        return artistsWithConcerts.slice(0, limit);
    },

    /**
     * Get festival events for a specific artist
     * Searches scraped festival data for artist appearances
     * Filters by distance from user location
     */
    getFestivalEventsForArtist: (artistName, latlong, radius = 200, countryCode = null) => {
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
                    date: match.date || null, // Use manual date from JSON if available
                    venue: venue?.name || '',
                    city: venue?.city?.name || '',
                    country: venue?.country?.name || '',
                    image: null, // No image from festival scraping
                    url: match.url || '',
                    artistName: match.name,
                    source: 'festival',
                };
            });

            // When countryCode is provided, filter by country instead of distance
            // This ensures users see ALL their favorite artists' shows in their country
            if (countryCode) {
                const COUNTRY_CODE_MAP = {
                    'ES': 'Espana',
                    'GB': 'UK',
                    'DE': 'Alemania',
                    'PT': 'Portugal',
                };
                const targetCountry = COUNTRY_CODE_MAP[countryCode];
                if (targetCountry) {
                    const beforeFilter = festivalEvents.length;
                    festivalEvents = festivalEvents.filter(event => event.country === targetCountry);
                    if (beforeFilter !== festivalEvents.length) {
                        console.log(`🌍 [SmartRecs] Festival country filter for ${artistName}: ${beforeFilter} → ${festivalEvents.length} in ${targetCountry}`);
                    }
                }
            } else if (latlong && festivalEvents.length > 0) {
                // Fallback: filter by distance when no countryCode
                const [userLat, userLng] = latlong.split(',').map(parseFloat);
                const maxKm = parseFloat(radius) || 200;
                festivalEvents = festivalEvents.filter(event => {
                    const coords = getFestivalCoords(event.city);
                    if (!coords) return false;
                    const distKm = haversineKm(userLat, userLng, coords[0], coords[1]);
                    return distKm <= maxKm;
                });
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
        const cached = getCachedEvents(artistName, countryCode, latlong, radius);
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
                const rawEvents = events
                    .filter(e => !isTmNoise(e.name) && !isTmNoise(e._embedded?.attractions?.[0]?.name) && isMusicEvent(e))
                    .map(e => ({
                        id: e.id,
                        name: e.name,
                        date: e.dates?.start?.localDate,
                        time: e.dates?.start?.localTime,
                        venue: e._embedded?.venues?.[0]?.name,
                        city: e._embedded?.venues?.[0]?.city?.name,
                        country: e._embedded?.venues?.[0]?.country?.name,
                        venueLat: e._embedded?.venues?.[0]?.location?.latitude,
                        venueLng: e._embedded?.venues?.[0]?.location?.longitude,
                        image: e.images?.[0]?.url,
                        url: e.url,
                        artistName: e._embedded?.attractions?.[0]?.name || artistName,
                        source: 'ticketmaster',
                    }));
                
                // Post-filter by actual venue distance (TM sometimes returns events outside radius)
                if (latlong && radius) {
                    const [userLat, userLng] = latlong.split(',').map(parseFloat);
                    const maxKm = parseFloat(radius) || 200;
                    const before = rawEvents.length;
                    const filtered = rawEvents.filter(e => {
                        if (e.venueLat && e.venueLng) {
                            const dist = haversineKm(userLat, userLng, parseFloat(e.venueLat), parseFloat(e.venueLng));
                            return dist <= maxKm;
                        }
                        // No venue coords: use city coords or discard
                        const coords = getFestivalCoords(e.city);
                        if (coords) {
                            const dist = haversineKm(userLat, userLng, coords[0], coords[1]);
                            return dist <= maxKm;
                        }
                        return false; // Discard if we can't determine distance
                    });
                    console.log(`📍 [SmartRecs] TM distance post-filter: ${before} → ${filtered.length} for ${artistName}`);
                    return filtered;
                }
                return rawEvents;
            })(),
            // Festival fetch - no countryCode support for festivals
            Promise.resolve(SmartRecommendationsService.getFestivalEventsForArtist(artistName, latlong, radius, countryCode))
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
            setCachedEvents(artistName, deduped, countryCode, latlong, radius);
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
            classificationName: `${genre},Music`, // Only music events, no comedy
            size: String(limit * 3), // Fetch more to filter
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

            const rawEvents = events
                .filter(e => !isTmNoise(e.name) && isMusicEvent(e))
                .map(e => ({
                    id: e.id,
                    name: e.name,
                    date: e.dates?.start?.localDate,
                    venue: e._embedded?.venues?.[0]?.name,
                    city: e._embedded?.venues?.[0]?.city?.name,
                    venueLat: e._embedded?.venues?.[0]?.location?.latitude,
                    venueLng: e._embedded?.venues?.[0]?.location?.longitude,
                    image: e.images?.[0]?.url,
                    url: e.url,
                    artistName: e._embedded?.attractions?.[0]?.name || e.name,
                    genre: genre,
                    source: 'genre'
                }));
            
            // Post-filter by actual venue distance
            let filtered = rawEvents;
            if (latlong && radius) {
                const [userLat, userLng] = latlong.split(',').map(parseFloat);
                const maxKm = parseFloat(radius) || 200;
                const before = filtered.length;
                filtered = rawEvents.filter(e => {
                    if (e.venueLat && e.venueLng) {
                        const dist = haversineKm(userLat, userLng, parseFloat(e.venueLat), parseFloat(e.venueLng));
                        return dist <= maxKm;
                    }
                    // No venue coords: use city coords or discard
                    const coords = getFestivalCoords(e.city);
                    if (coords) {
                        const dist = haversineKm(userLat, userLng, coords[0], coords[1]);
                        return dist <= maxKm;
                    }
                    return false; // Discard if we can't determine distance
                });
                console.log(`📍 [SmartRecs] Genre distance post-filter: ${before} → ${filtered.length}`);
            }
            
            // Filter out events that don't match the searched genre (e.g. Bad Bunny in Electronic)
            const incompatibleWords = GENRE_INCOMPATIBLE[genre.toLowerCase()] || [];
            if (incompatibleWords.length > 0) {
                const beforeGenreFilter = filtered.length;
                filtered = filtered.filter(e => {
                    const text = `${e.artistName || ''} ${e.name || ''}`.toLowerCase();
                    // Case-insensitive matching for keywords
                    const blocked = incompatibleWords.some(w => text.includes(w.toLowerCase()));
                    if (blocked) {
                        console.log(`   ❌ Genre mismatch: ${e.name} @ ${e.city} — not "${genre}"`);
                    }
                    return !blocked;
                });
                if (filtered.length < beforeGenreFilter) {
                    console.log(`🎵 [SmartRecs] Genre compatibility filter: ${beforeGenreFilter} → ${filtered.length}`);
                }
            }
            
            if (filtered.length > 0) {
                console.log(`🎸 [SmartRecs] Genre "${genre}" final events:`);
                filtered.forEach(e => console.log(`   → ${e.name} @ ${e.city}`));
            }
            
            return filtered.slice(0, limit);
        } catch (err) {
            console.error(`❌ [SmartRecs] Error getting ${genre} events:`, err.message);
            return [];
        }
    },

    /**
     * Para "Recommended Concerts" (cerca del usuario):
     * Recibe todos los artistas seguidos, busca similares en Last.fm,
     * verifica conciertos DENTRO del radio del usuario (latlong + radius).
     * También combina conciertos por género para rellenar gaps.
     *
     * @param {string[]} followedArtists - Artistas seguidos (se usan todos como seeds)
     * @param {string} latlong - Coords del usuario "lat,lng"
     * @param {number} radius - Radio en km
     * @param {string[]} genres - Géneros del usuario para búsqueda adicional
     * @param {number} limit - Max conciertos a devolver
     */
    getRecommendedConcertsNearMe: async (followedArtists, latlong, radius = 120, genres = [], limit = 20) => {
        if (!latlong) return [];

        const seeds = followedArtists.slice(0, 5); // Limit seeds to avoid TM rate limits
        console.log(`🎯 [SmartRecs] Recommended Concerts: ${seeds.length} seeds, radius ${radius}km, genres: ${genres.join(',') || 'none'}`);

        // 1. Find similar artists for each seed in parallel
        const similarByArtist = await Promise.allSettled(
            seeds.map(async (seedName) => {
                const similar = await LastfmService.getSimilarArtists(seedName, 10);
                return similar.map(a => ({ ...a, seed: seedName }));
            })
        );

        // Aggregate similar artists, deduplicate by name, keep highest match score
        const similarMap = new Map();
        for (const result of similarByArtist) {
            if (result.status !== 'fulfilled') continue;
            for (const artist of result.value) {
                const key = artist.name.toLowerCase();
                if (!similarMap.has(key) || similarMap.get(key).match < artist.match) {
                    similarMap.set(key, artist);
                }
            }
        }

        const uniqueSimilar = Array.from(similarMap.values())
            .sort((a, b) => (b.match || 0) - (a.match || 0))
            .slice(0, 15); // Check top 15 similar artists for concerts

        // 2. Check which similar artists have concerts near the user — in parallel batches
        const BATCH_SIZE = 5;
        const concertEvents = [];
        const seenArtists = new Set();

        for (let i = 0; i < uniqueSimilar.length && concertEvents.length < limit; i += BATCH_SIZE) {
            const batch = uniqueSimilar.slice(i, i + BATCH_SIZE);
            const results = await Promise.allSettled(
                batch.map(async (artist) => {
                    // Use latlong + radius (NOT countryCode) — we want events NEAR the user
                    const events = await SmartRecommendationsService.searchArtistEvents(
                        artist.name, latlong, radius, null
                    );
                    return { artist, events };
                })
            );

            for (const result of results) {
                if (result.status !== 'fulfilled' || result.value.events.length === 0) continue;
                const { artist, events } = result.value;
                if (seenArtists.has(artist.name.toLowerCase())) continue;
                seenArtists.add(artist.name.toLowerCase());

                // Add each event individually (not grouped by artist like Discover)
                for (const event of events) {
                    concertEvents.push({
                        ...event,
                        similarTo: artist.seed,
                        matchScore: artist.match || 0,
                    });
                    if (concertEvents.length >= limit) break;
                }
            }
        }

        // 3. Fill remaining slots with genre-based events near the user
        const remaining = limit - concertEvents.length;
        if (remaining > 0 && genres.length > 0) {
            const genreResults = await Promise.allSettled(
                genres.slice(0, 3).map(genre =>
                    SmartRecommendationsService.getUpcomingByGenre(genre, latlong, radius, Math.ceil(remaining / genres.length), null)
                )
            );
            for (const result of genreResults) {
                if (result.status !== 'fulfilled') continue;
                for (const event of result.value) {
                    const key = (event.artistName || event.name || '').toLowerCase();
                    if (!seenArtists.has(key)) {
                        seenArtists.add(key);
                        concertEvents.push(event);
                        if (concertEvents.length >= limit) break;
                    }
                }
            }
        }

        // 3b. Add festival artists matching user genres within radius
        if (genres.length > 0 && concertEvents.length < limit) {
            const festivalArtists = FestivalService.getDiscoverArtists(genres);
            if (festivalArtists.length > 0 && latlong) {
                const [userLat, userLng] = latlong.split(',').map(parseFloat);
                const festCounts = new Map();
                
                for (const fa of festivalArtists) {
                    if (concertEvents.length >= limit) break;
                    const key = (fa.artistName || fa.name || '').toLowerCase();
                    if (seenArtists.has(key)) continue;

                    // Distance check using city coords
                    const coords = fa.lat && fa.lng 
                        ? [fa.lat, fa.lng]
                        : getFestivalCoords(fa.city);
                    if (coords) {
                        const distKm = haversineKm(userLat, userLng, coords[0], coords[1]);
                        if (distKm > radius) continue;
                    } else {
                        // If we have a location filter but can't resolve the festival coordinates,
                        // exclude it to respect the user's location radius filter.
                        continue;
                    }

                    // Max 3 per festival
                    const festName = (fa.venue || fa.festival || '').toLowerCase();
                    if (festName) {
                        const count = festCounts.get(festName) || 0;
                        if (count >= 3) continue;
                        festCounts.set(festName, count + 1);
                    }

                    seenArtists.add(key);
                    concertEvents.push({
                        ...fa,
                        source: fa.source || 'festival',
                    });
                }
                console.log(`🎪 [SmartRecs] Added ${concertEvents.filter(e => e.source === 'festival').length} festival events`);
            }
        }

        // 4. Sort by date ascending
        concertEvents.sort((a, b) => {
            if (!a.date) return 1;
            if (!b.date) return -1;
            return new Date(a.date) - new Date(b.date);
        });

        console.log(`✅ [SmartRecs] Recommended Concerts: ${concertEvents.length} events near [${latlong}]`);
        return concertEvents.slice(0, limit);
    },
};
