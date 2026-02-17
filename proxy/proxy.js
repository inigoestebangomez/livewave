// proxy.js
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import fetch from 'node-fetch'
import { SpotifyService } from './services/spotify.js'

dotenv.config()

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

app.get('/suggest', async (req, res) => {
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
    
    // Normalize data structure
    const combined = [
      ...tmAttractions.map(a => ({ ...a, source: 'ticketmaster' })),
      ...spotifyArtists.map(a => ({ ...a, source: 'spotify' }))
    ]

    // Simple dedup by name
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
    
    if (!keyword) return res.status(400).json({ error: 'Missing keyword' })
  
    // For now, only Ticketmaster has "Events"
    // Future: Scrape small distributors here
    const url = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TM_API_KEY}&keyword=${encodeURIComponent(keyword)}&sort=date,asc&page=${page}&size=${size}`
    
    try {
      const response = await fetch(url)
      const data = await response.json()
      res.json(data)
    } catch (error) {
      res.status(500).json({ error: 'TM Error' })
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
        
        // 2. Get recommendations based on this artist seed
        const related = await SpotifyService.getRecommendations([bestMatch.id]);
        
        res.json({
            seed: bestMatch.name,
            recommendations: related
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    tmKey: !!TM_API_KEY,
    spotifyClient: !!process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID
  })
})

app.listen(PORT, () => {
  console.log(`✅ Proxy corriendo en http://localhost:${PORT}`)
})