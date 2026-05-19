import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';
import fetch from 'node-fetch';

// ─── Genre Normalization ───
// Maps festival genre labels (from festivales.json) to app genre slugs (from genres table)
const GENRE_MAP = {
  // Direct matches
  'rock': 'rock',
  'pop': 'pop',
  'indie': 'indie',
  'metal': 'metal',
  'jazz': 'jazz',
  'blues': 'blues',
  'soul': 'soul',
  'funk': 'funk',
  'punk': 'punk',
  'country': 'country',
  'reggae': 'reggae',
  'folk': 'folk',
  'flamenco': 'flamenco',

  // Spanish / accented labels
  'electrónica': 'electronic',
  'electronica': 'electronic',
  'hip-hop': 'hip-hop',
  'hip hop': 'hip-hop',
  'rap': 'hip-hop',
  'r&b': 'r-b',
  'r & b': 'r-b',

  // Subgenres → parent genre slugs
  'indie español': 'indie',
  'alternativo': 'indie',
  'rock clásico': 'rock',
  'rock urbano': 'rock',
  'hard rock': 'metal',
  'heavy metal': 'metal',
  'heavy metal extremo': 'metal',
  'death metal': 'metal',
  'hardcore': 'metal',
  'gótico': 'metal',
  'darkwave': 'electronic',
  'industrial': 'electronic',
  'edm': 'electronic',
  'techno': 'techno',
  'house': 'house',
  'trance': 'electronic',
  'hardstyle': 'electronic',
  'bass': 'electronic',
  'drum&bass': 'electronic',
  'underground': 'electronic',
  'electrónica underground': 'electronic',
  'experimental': 'electronic',

  // Urban / Latin
  'urbana': 'latin',
  'reggaeton': 'latin',
  'latina': 'latin',
  'iberoamericana': 'latin',

  // K-Pop
  'k-pop': 'k-pop',

  // Classical
  'classical': 'classical',

  // Multi-genre / misc → treated as multiple
  'multigénero': null, // Will be handled specially
  'eclectic': null,
  'arte digital': null,
  'arte': null,
  'artes': null,
  'familiar': null,
  'surf': null,
  'jam': 'rock',
  'jam bands': 'rock',
  'americana': 'folk',
  'ska': 'reggae',
  'grime': 'hip-hop',
};

// ─── Load Festival Data ───
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const festivalsPath = resolve(__dirname, '../../festivales.json');

let festivalsData = null;

function loadFestivals() {
  if (festivalsData) return festivalsData;
  try {
    const raw = readFileSync(festivalsPath, 'utf-8');
    const parsed = JSON.parse(raw);
    // Flatten all festivals from all countries into a single array
    const allFestivals = [];
    for (const [country, festivals] of Object.entries(parsed.festivales)) {
      for (const fest of festivals) {
        allFestivals.push({
          ...fest,
          pais: country,
          // Normalize genres to app slugs
          normalizedGenres: fest.generos
            .map(g => GENRE_MAP[g.toLowerCase()])
            .filter(Boolean),
        });
      }
    }
    festivalsData = allFestivals;
    console.log(`🎪 [Festivals] Loaded ${allFestivals.length} festivals from festivales.json`);
    return allFestivals;
  } catch (err) {
    console.error('❌ [Festivals] Error loading festivales.json:', err.message);
    return [];
  }
}

// ─── Artist Cache ───
// Scraped artists cached in memory for 24h
let artistCache = {
  data: [],       // Array of { artistName, festivalName, genres, city, country, ticketUrl }
  lastFetch: 0,
};

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// ─── Scraping Logic ───
// Best-effort HTML scraping for artist names from festival pages
async function scrapeArtistsFromUrl(url, festivalName, timeout = 8000) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`⚠️ [Festivals] ${festivalName}: HTTP ${response.status}`);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const artists = new Set();

    // Noise filter: words that are NOT artist names
    const NOISE_WORDS = new Set([
      'artists', 'lineup', 'tickets', 'ticket', 'buy', 'buy tickets',
      'cookie', 'cookies', 'cookie preferences', 'cookie policy',
      'marketing', 'personalization', 'analytics', 'privacy', 'privacy policy',
      'terms', 'terms of use', 'about', 'contact', 'faq', 'help',
      'menu', 'home', 'news', 'gallery', 'info', 'schedule', 'map',
      'entradas', 'abonos', 'cartel', 'line-up', 'login', 'sign up',
      'newsletter', 'subscribe', 'follow', 'share', 'search',
      'accept', 'decline', 'close', 'more', 'read more', 'learn more',
      'camping', 'transport', 'accommodation', 'vip', 'sponsors',
    ]);

    // Substrings that strongly indicate scraper noise, not artist names
    const NOISE_SUBSTRINGS = [
      'abono', 'entrada', 'festival', 'agosto', 'julio', 'junio', 'mayo',
      'octubre', 'noviembre', 'diciembre', 'enero', 'febrero', 'marzo', 'abril',
      'january', 'february', 'march', 'april', 'june', 'july', 'august',
      'september', 'october', 'november', 'december',
      'cookie', 'privacy', 'política', 'política de', 'aviso legal',
      'ver más', 'comprar', 'venta', 'descuento', 'precio',
    ];

    const isNoise = (name) => {
      const lower = name.toLowerCase().trim();
      // Reject if too long to be an artist name
      if (lower.length > 40) return true;
      // Reject if contains punctuation typical of sentences (semicolons, multiple commas)
      if (/[;]/.test(lower)) return true;
      if ((lower.match(/,/g) || []).length > 2) return true;
      // Reject exact noise words
      if (NOISE_WORDS.has(lower)) return true;
      // Reject if contains noise substrings
      if (NOISE_SUBSTRINGS.some(s => lower.includes(s))) return true;
      // Filter out pure dates, numbers, short words
      if (/^\d+$/.test(lower)) return true;
      if (/^\d{1,2}\s*(de\s+)?\w+$/.test(lower)) return true; // "31 de julio"
      // Filter very short strings
      if (lower.length < 3) return true;
      if (/^(capa|layer)\s*\d/i.test(lower)) return true;
      return false;
    };

    // Strategy 1: Look for common lineup CSS patterns
    const lineupSelectors = [
      '.lineup-artist', '.artist-name', '.lineup__artist',
      '.artist', '.lineup-item', '.act-name',
      '[class*="lineup"] [class*="artist"]',
      '[class*="lineup"] h2', '[class*="lineup"] h3',
      '[class*="artist"] h2', '[class*="artist"] h3',
      '.lineup a', '.artists a', '.line-up a',
      '[data-artist]', '[data-name]',
    ];

    for (const selector of lineupSelectors) {
      $(selector).each((_, el) => {
        const name = $(el).attr('data-artist') || $(el).attr('data-name') || $(el).text().trim();
        if (name && name.length > 2 && name.length < 50 && !name.includes('\n') && !isNoise(name)) {
          artists.add(name);
        }
      });
      if (artists.size > 5) break; // Found enough from this selector
    }

    // Strategy 2: Look for JSON-LD structured data (some festival sites use it)
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html());
        const performers = json.performer || json.performers || [];
        const performerList = Array.isArray(performers) ? performers : [performers];
        for (const p of performerList) {
          if (p.name) artists.add(p.name);
        }
      } catch (e) { /* ignore parse errors */ }
    });

    // Strategy 3: Meta tags with artist info
    $('meta[name*="artist"], meta[property*="artist"], meta[name="description"]').each((_, el) => {
      const content = $(el).attr('content') || '';
      // Try to split comma-separated artist lists from meta descriptions
      if (content.includes(',') && content.length < 500) {
        const parts = content.split(',').map(s => s.trim()).filter(s => s.length > 1 && s.length < 40);
        if (parts.length > 3) {
          parts.forEach(p => artists.add(p));
        }
      }
    });

    console.log(`🔍 [Festivals] ${festivalName}: scraped ${artists.size} artists from ${url}`);
    return Array.from(artists);

  } catch (err) {
    if (err.name === 'AbortError') {
      console.warn(`⏱️ [Festivals] ${festivalName}: timeout scraping ${url}`);
    } else {
      console.warn(`⚠️ [Festivals] ${festivalName}: scrape error: ${err.message}`);
    }
    return [];
  }
}

// ─── Main scraping orchestrator ───
async function scrapeAllFestivals() {
  const festivals = loadFestivals();
  const allArtists = [];

  // Scrape in batches of 5 to avoid overwhelming
  const batchSize = 5;
  for (let i = 0; i < festivals.length; i += batchSize) {
    const batch = festivals.slice(i, i + batchSize);
    const promises = batch.map(async (fest) => {
      // 1. Try scraping from the web
      const scraped = await scrapeArtistsFromUrl(fest.entradas, fest.nombre);

      // 2. Also include manually curated artists from festivales.json (for JS-heavy sites)
      const manual = fest.artistas || [];
      if (manual.length > 0) {
        console.log(`📋 [Festivals] ${fest.nombre}: ${manual.length} manual artists from JSON`);
      }

      // Merge both — manual artists take priority (deduplication happens later)
      const allNames = [...new Set([...manual, ...scraped])];

      return allNames.map(artistName => ({
        artistName,
        festivalName: fest.nombre,
        genres: fest.normalizedGenres,
        city: fest.ubicacion,
        country: fest.pais,
        ticketUrl: fest.entradas,
        date: fest.fecha || null, // Include manual date from JSON if available
      }));
    });

    const results = await Promise.all(promises);
    allArtists.push(...results.flat());

    // Small delay between batches
    if (i + batchSize < festivals.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log(`🎪 [Festivals] Total scraped: ${allArtists.length} artist entries from ${festivals.length} festivals`);
  return allArtists;
}

// ─── Public API ───
export const FestivalService = {

  // Initialize and cache scraped data
  async initialize() {
    loadFestivals();
    // Don't block startup — scrape in background
    FestivalService.refreshCache().catch(err => {
      console.error('❌ [Festivals] Background scrape failed:', err.message);
    });
  },

  // Refresh scraped artist cache
  async refreshCache() {
    if (Date.now() - artistCache.lastFetch < CACHE_TTL && artistCache.data.length > 0) {
      console.log(`🎪 [Festivals] Cache still valid (${artistCache.data.length} artists)`);
      return artistCache.data;
    }

    console.log('🎪 [Festivals] Refreshing artist cache...');
    const artists = await scrapeAllFestivals();
    artistCache = { data: artists, lastFetch: Date.now() };
    return artists;
  },

  // Get all loaded festivals (from JSON, no scraping)
  getFestivals() {
    return loadFestivals();
  },

  // Get festivals matching user genres
  getFestivalsByGenres(userGenreSlugs) {
    const festivals = loadFestivals();
    if (!userGenreSlugs || userGenreSlugs.length === 0) return festivals;

    const userSet = new Set(userGenreSlugs.map(g => g.toLowerCase()));
    return festivals
      .map(f => {
        const matchCount = f.normalizedGenres.filter(g => userSet.has(g)).length;
        return { ...f, matchScore: matchCount };
      })
      .filter(f => f.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore);
  },

  // Get artists from scraped data that match user genres
  // Returns in Event-like format for frontend compatibility
  getArtistsByGenres(userGenreSlugs) {
    const artists = artistCache.data;
    if (!userGenreSlugs || userGenreSlugs.length === 0) return artists;

    const userSet = new Set(userGenreSlugs.map(g => g.toLowerCase()));
    return artists.filter(a =>
      a.genres.some(g => userSet.has(g))
    );
  },

  // Search artists by name keyword
  searchArtistsByName(keyword) {
    if (!keyword || keyword.length < 2) return [];
    const lowerKeyword = keyword.toLowerCase();
    
    // Search in cache
    const matches = artistCache.data.filter(a => 
      a.artistName.toLowerCase().includes(lowerKeyword)
    );

    // Deduplicate by artist name
    const unique = new Map();
    for (const a of matches) {
      if (!unique.has(a.artistName.toLowerCase())) {
        unique.set(a.artistName.toLowerCase(), a);
      }
    }

    // Convert to typical attraction structure expected by frontend
    return Array.from(unique.values()).map(a => ({
      id: `fest-${a.festivalName}-${a.artistName}`.replace(/\s+/g, '-').toLowerCase(),
      name: a.artistName,
      source: 'festival',
      url: a.ticketUrl,
      images: [],
      date: a.date, // Include festival date if available
      classifications: [{
        genre: { name: a.genres[0] || 'Music' }
      }],
      _embedded: {
        venues: [{
          name: a.festivalName,
          city: { name: a.city },
          country: { name: a.country }
        }]
      }
    }));
  },

  // Get festival-sourced artists as Event-like objects for the frontend
  getDiscoverArtists(userGenreSlugs) {
    const matchingArtists = this.getArtistsByGenres(userGenreSlugs);

    // Deduplicate by artist name (keep first occurrence)
    const unique = new Map();
    for (const a of matchingArtists) {
      if (!unique.has(a.artistName.toLowerCase())) {
        unique.set(a.artistName.toLowerCase(), a);
      }
    }

    // Convert to Event-like format
    return Array.from(unique.values()).map(a => ({
      id: `fest-${a.festivalName}-${a.artistName}`.replace(/\s+/g, '-').toLowerCase(),
      name: `${a.artistName} @ ${a.festivalName}`,
      artistName: a.artistName,
      venue: a.festivalName,
      city: a.city,
      country: a.country,
      url: a.ticketUrl,
      genre: a.genres[0] || 'Music',
      source: 'festival',
      date: null, // Festival dates not always available from scraping
      image: null, // No image from scraping
    }));
  },

  // Build co-occurrence map: artists at the same festival → similar
  getCoOccurrenceMap() {
    const festivalGroups = {};
    for (const a of artistCache.data) {
      if (!festivalGroups[a.festivalName]) {
        festivalGroups[a.festivalName] = [];
      }
      festivalGroups[a.festivalName].push(a.artistName);
    }

    const coMap = {};
    for (const [, artists] of Object.entries(festivalGroups)) {
      for (const artist of artists) {
        const key = artist.toLowerCase();
        if (!coMap[key]) coMap[key] = new Set();
        for (const other of artists) {
          if (other !== artist) coMap[key].add(other);
        }
      }
    }

    // Convert sets to arrays
    const result = {};
    for (const [key, set] of Object.entries(coMap)) {
      result[key] = Array.from(set).slice(0, 6); // Top 6 similar
    }
    return result;
  },

  // Get genre-matched festival events for notifications
  // Returns: [{ artistName, festivalName, genres, city, country, ticketUrl }]
  getMatchesForUserGenres(userGenreSlugs) {
    const festivals = this.getFestivalsByGenres(userGenreSlugs);
    const artists = this.getArtistsByGenres(userGenreSlugs);

    return {
      matchingFestivals: festivals.map(f => ({
        name: f.nombre,
        city: f.ubicacion,
        country: f.pais,
        genres: f.normalizedGenres,
        ticketUrl: f.entradas,
      })),
      matchingArtists: artists,
    };
  },
};
