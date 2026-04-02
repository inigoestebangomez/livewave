// proxy.js
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import fetch from 'node-fetch'
import { SpotifyService } from './services/spotify.js'
import { TicketmasterService } from './services/ticketmaster.js'
import { FestivalService } from './services/festivals.js'

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

dotenv.config()

// Initialize festival engine in background (scrapes festival sites)
FestivalService.initialize();

const app = express()
const PORT = process.env.PORT || 8082
const TM_API_KEY = process.env.TM_API_KEY

if (!TM_API_KEY) {
  console.error('❌ Error: TM_API_KEY no encontrada en el archivo .env')
  // Don't exit, just warn, so Spotify can still work
}

app.use(cors())
app.use(express.json())

app.use((req, res, next) => {
  console.log(`📡 ${new Date().toISOString()} - ${req.method} ${req.url}`)
  next()
})

// --- TICKETMASTER ENDPOINTS ---

app.get('/recommendations/concerts', async (req, res) => {
    const { seed_artist_name, city, latlong, radius, genres } = req.query;
    
    if (!seed_artist_name) {
        return res.status(400).json({ error: 'Missing seed_artist_name' });
    }

    try {
        console.log(`🎯 Recs for: ${seed_artist_name} near ${city || latlong}`);
        
        // Fetch from Ticketmaster (existing)
        const tmEventsPromise = TicketmasterService.getConcertRecommendations({
            seedArtistName: seed_artist_name,
            city,
            latLong: latlong,
            radius
        }).catch(err => {
            console.warn('TM Recs failed:', err.message);
            return [];
        });

        // Fetch from Festival Engine (new)
        const userGenres = genres ? genres.split(',') : [];
        let festivalArtists = userGenres.length > 0
            ? FestivalService.getDiscoverArtists(userGenres)
            : [];

        // Filter festival artists by distance using haversine (requires user latlong)
        if (latlong && festivalArtists.length > 0) {
            const [userLat, userLng] = latlong.split(',').map(parseFloat);
            const maxKm = parseFloat(radius) || 200; // generous radius for festivals

            const filtered = festivalArtists.filter(a => {
                const coords = getFestivalCoords(a.city);
                if (!coords) return false; // skip if city unknown in our table
                const distKm = haversineKm(userLat, userLng, coords[0], coords[1]);
                return distKm <= maxKm;
            });

            console.log(`📍 [Recs] Festival filter: ${festivalArtists.length} → ${filtered.length} within ${maxKm}km of [${latlong}]`);
            festivalArtists = filtered;
        } else {
            // No location provided → hide festival artists to avoid global noise
            festivalArtists = [];
        }

        const tmEvents = await tmEventsPromise;

        // Filter out TM noise (passes, tickets, non-artist events)
        const tmNoiseWords = ['abono', 'abonos', 'entrada', 'entradas', 'camping', 'vip pass', 'parking'];
        const filteredTmEvents = tmEvents.filter(e => {
            const name = (e.name || '').toLowerCase();
            const artistName = (e._embedded?.attractions?.[0]?.name || e.artistName || '').toLowerCase();
            
            // If the event name or attraction name contains a noise word, skip it
            if (tmNoiseWords.some(w => name.includes(w) || artistName.includes(w))) {
                return false;
            }
            return true;
        });

        // Merge: TM events first, then festival-sourced (tagged with source)
        const tmTagged = filteredTmEvents.map(e => ({ ...e, source: 'ticketmaster' }));
        const merged = [...tmTagged, ...festivalArtists];

        // Deduplicate by artist name (keep first)
        const seen = new Set();
        const deduped = merged.filter(e => {
            const key = (e._embedded?.attractions?.[0]?.name || e.artistName || e.name || '').toLowerCase();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        // Enrich festival-sourced events with Spotify artist images
        const festivalDeduped = deduped.filter(e => e.source === 'festival' && !e.image);
        if (festivalDeduped.length > 0) {
            const enrichPromises = festivalDeduped.slice(0, 20).map(async (event) => {
                try {
                    const artistName = event.artistName || event.name;
                    const results = await SpotifyService.searchArtists(artistName);
                    if (results && results.length > 0) {
                        const match = results[0];
                        const searchName = artistName.toLowerCase();
                        const foundName = (match.name || '').toLowerCase();
                        if (foundName.includes(searchName.split(' ')[0]) || searchName.includes(foundName.split(' ')[0])) {
                            event.image = match.images?.[0]?.url || null;
                        }
                    }
                } catch (_) { /* silently skip */ }
            });
            await Promise.allSettled(enrichPromises);
        }

        res.json({
            seed: seed_artist_name,
            events: deduped,
            sources: { ticketmaster: tmTagged.length, festival: festivalArtists.length }
        });
    } catch (err) {
        console.error('Recs Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.get('/suggest', async (req, res) => {
// ... existing suggest code ...
  const keyword = req.query.keyword || ''
  
  if (!keyword || keyword.length < 2) {
    return res.status(400).json({ error: 'Keyword debe tener al menos 2 caracteres' })
  }

  // Parallel Fetch: Ticketmaster + Spotify
  const tmUrl = `https://app.ticketmaster.com/discovery/v2/suggest?apikey=${TM_API_KEY}&keyword=${encodeURIComponent(keyword)}`
  
  try {
    const [tmResponse, spotifyArtists] = await Promise.all([
      fetch(tmUrl).then(r => r.json()).catch(e => ({ error: e })),
      SpotifyService.searchArtists(keyword)
    ])

    const tmAttractions = tmResponse._embedded?.attractions || []
    
    // Fetch from festival service (local cache)
    const festivalArtists = FestivalService.searchArtistsByName(keyword)

    // Normalize data structure
    const combined = [
      ...tmAttractions.map(a => ({ ...a, source: 'ticketmaster' })),
      ...festivalArtists.map(a => ({ ...a, source: 'festival' })),
      ...spotifyArtists.map(a => ({ ...a, source: 'spotify' }))
    ]

    // Simple dedup by name - keep the first one found (prioritizing TM, then Festival, then Spotify)
    const unique = Array.from(new Map(combined.map(item => [item.name.toLowerCase(), item])).values())

    res.json({ _embedded: { attractions: unique } })
  } catch (error) {
    console.error('❌ Error en /suggest:', error.message)
    res.status(500).json({ error: 'Error interno', details: error.message })
  }
})

app.get('/events', async (req, res) => {
    const keyword = req.query.keyword || ''
    const page = req.query.page || 0
    const size = req.query.size || 20
    const latlong = req.query.latlong
    const radius = req.query.radius || 200
    
    if (!keyword) return res.status(400).json({ error: 'Missing keyword' })
  
    // Ticketmaster Events
    let tmUrl = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TM_API_KEY}&keyword=${encodeURIComponent(keyword)}&sort=date,asc&page=${page}&size=${size}`
    if (latlong) {
        tmUrl += `&latlong=${latlong}&radius=${radius}&unit=km`;
    }
    
    try {
      const response = await fetch(tmUrl)
      const data = await response.json()
      
      // Only include festival events on the first page to avoid duplicates
      if (parseInt(page) === 0) {
        // Festival Events
        let festivalArtists = FestivalService.searchArtistsByName(keyword)
        
        // Filter festival events by distance if user location is known
        if (latlong && festivalArtists.length > 0) {
            const [userLat, userLng] = latlong.split(',').map(parseFloat);
            const maxKm = parseFloat(radius) || 200;
            festivalArtists = festivalArtists.filter(a => {
                const coords = getFestivalCoords(a.city);
                if (!coords) return false;
                return haversineKm(userLat, userLng, coords[0], coords[1]) <= maxKm;
            });
        }
        
        if (!data._embedded) data._embedded = { events: [] };
        if (!data._embedded.events) data._embedded.events = [];
        
        const festivalEvents = festivalArtists.map(a => ({
          id: a.id,
          name: `${a.name} @ ${a._embedded?.venues?.[0]?.name || 'Festival'}`,
          type: "event",
          url: a.url,
          images: a.images,
          dates: {
            start: {
              localDate: "2026-06-01", // Default upcoming date or TBA
              dateTime: null
            }
          },
          classifications: a.classifications,
          _embedded: {
             venues: a._embedded.venues,
             attractions: [a]
          }
        }));
        
        data._embedded.events = [...festivalEvents, ...data._embedded.events];
      }
      
      res.json(data)
    } catch (error) {
      console.error('Events Error:', error.message)
      res.status(500).json({ error: 'Events Error' })
    }
})

// --- SPOTIFY-SPECIFIC ENDPOINTS ---

app.get('/spotify/recommendations', async (req, res) => {
    const { seeds } = req.query; // Comma separated artist IDs
    if (!seeds) return res.status(400).json({ error: 'Missing seeds' });
    
    const recs = await SpotifyService.getRecommendations(seeds.split(','));
    res.json(recs);
});

app.get('/spotify/search', async (req, res) => {
    const query = req.query.q;
    const offset = req.query.offset ? parseInt(req.query.offset) : 0;
    
    if (!query) return res.status(400).json({ error: 'Missing query' });
    
    try {
        const results = await SpotifyService.searchArtists(query, offset);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/recommendations/artists', async (req, res) => {
    const { seed_artist_name } = req.query;
    if (!seed_artist_name) return res.status(400).json({ error: 'Missing seed_artist_name' });
    
    try {
        // 1. Find the Spotify ID for the artist name
        const searchResults = await SpotifyService.searchArtists(seed_artist_name);
        if (!searchResults || searchResults.length === 0) {
            console.log(`⚠️ Artist not found for seeding: ${seed_artist_name}`);
            return res.json({ seed: seed_artist_name, recommendations: [] }); 
        }
        
        const bestMatch = searchResults[0]; // Assume first result is correct
        
        console.log(`🎯 [Proxy] Seed Artist Found: ${bestMatch.name} (${bestMatch.id}) Genres: ${bestMatch.genres}`);
        
        // 2. Get recommendations based on this artist seed
        // Pass genres to avoid extra lookup
        const related = await SpotifyService.getRecommendations([bestMatch.id], bestMatch.genres || []);
        
        res.json({
            seed: bestMatch.name,
            recommendations: related
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// --- FESTIVAL DISCOVERY ENDPOINTS ---

app.get('/discover/artists', async (req, res) => {
    const { genres, latlong, radius } = req.query;
    if (!genres) return res.status(400).json({ error: 'Missing genres param (comma-separated)' });

    try {
        const userGenres = genres.split(',').map(g => g.trim().toLowerCase());
        let festivalArtists = FestivalService.getDiscoverArtists(userGenres);

        // Filter festival artists by distance if user location is known
        if (latlong && festivalArtists.length > 0) {
            const [userLat, userLng] = latlong.split(',').map(parseFloat);
            const maxKm = parseFloat(radius) || 200;
            const before = festivalArtists.length;
            festivalArtists = festivalArtists.filter(a => {
                const coords = getFestivalCoords(a.city);
                if (!coords) return false;
                return haversineKm(userLat, userLng, coords[0], coords[1]) <= maxKm;
            });
            console.log(`📍 [Discover] Festival filter: ${before} → ${festivalArtists.length} within ${maxKm}km`);
        } else if (!latlong) {
            // No location → don't pollute with global festival noise
            festivalArtists = [];
        }

        // Also get Spotify-based recommendations for a popular artist in the genre
        // to mix sources
        let spotifyArtists = [];
        try {
            const recs = await SpotifyService.getRecommendationsByGenre(['dummyId'], [userGenres[0]]);
            spotifyArtists = (recs || []).map(a => ({
                id: `spotify-${a.id}`,
                name: a.name,
                artistName: a.name,
                image: a.image,
                genre: (a.genres && a.genres[0]) || userGenres[0],
                url: a.external_url,
                source: 'spotify',
            }));
        } catch (err) {
            console.warn('Spotify discover fallback failed:', err.message);
        }

        // Merge and deduplicate — Spotify first (more relevant/known artists)
        const all = [...spotifyArtists, ...festivalArtists];
        const seen = new Set();
        const deduped = all.filter(a => {
            const key = (a.artistName || a.name || '').toLowerCase();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        // Enrich festival artists (which have image:null) with Spotify artist images
        // Enrich all nearby festival artists (already filtered to ≤30 by location)
        const toEnrich = festivalArtists.filter(a => !a.image).slice(0, 30);
        if (toEnrich.length > 0) {
            console.log(`🖼️  [Discover] Enriching ${toEnrich.length} festival artists with Spotify images...`);
            const enrichPromises = toEnrich.map(async (artist) => {
                try {
                    const results = await SpotifyService.searchArtists(artist.artistName || artist.name);
                    if (results && results.length > 0) {
                        const match = results[0];
                        const searchName = (artist.artistName || artist.name || '').toLowerCase();
                        const foundName = (match.name || '').toLowerCase();
                        if (foundName.includes(searchName.split(' ')[0]) || searchName.includes(foundName.split(' ')[0])) {
                            artist.image = match.images?.[0]?.url || null;
                            artist.url = artist.url || match.external_urls?.spotify;
                        }
                    }
                } catch (_) { /* silently skip if lookup fails */ }
            });
            await Promise.allSettled(enrichPromises);
        }

        console.log(`🎪 [Discover] ${deduped.length} artists (${festivalArtists.length} festival, ${spotifyArtists.length} spotify)`);
        res.json({ artists: deduped, total: deduped.length });
    } catch (err) {
        console.error('Discover Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

app.get('/festivals/status', (req, res) => {
    const festivals = FestivalService.getFestivals();
    res.json({
        loaded: festivals.length,
        countries: [...new Set(festivals.map(f => f.pais))],
    });
});

app.get('/health', (req, res) => {
  const festivals = FestivalService.getFestivals();
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    tmKey: !!TM_API_KEY,
    spotifyClient: !!process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID,
    festivalCount: festivals.length,
  })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Proxy corriendo en http://0.0.0.0:${PORT}`)
})