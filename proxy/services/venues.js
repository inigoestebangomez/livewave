import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import { LastfmService } from './lastfm.js';

// ─── Load Venue Data ───
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const venuesPath = resolve(__dirname, '../data/venues.json');

let venuesConfig = [];

// ─── Cache ───
let venueCache = {
  data: [],
  lastFetch: null,
  health: {}
};

// Genre cache for Last.fm enrichment (24h TTL)
let genreCache = new Map();
const GENRE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const SCRAPE_DELAY_MS = 500;
const MAX_CONCURRENT = 3;
const MAX_FAILURES = 3;
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24h cooldown after failures

function loadVenues() {
  if (venuesConfig.length > 0) return venuesConfig;
  try {
    const raw = readFileSync(venuesPath, 'utf-8');
    const parsed = JSON.parse(raw);
    venuesConfig = parsed.venues || [];
    console.log(`🏠 [Venues] Loaded ${venuesConfig.length} venue configs from venues.json`);
    return venuesConfig;
  } catch (err) {
    console.error('❌ [Venues] Error loading venues.json:', err.message);
    return [];
  }
}

// ─── Date Parsing ───
function parseDate(dateText) {
  if (!dateText) return null;

  // Try various formats - note: order matters, more specific first
  const formats = [
    // DD/MM/YYYY
    { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, type: 'ddmmyyyy' },
    // DD-MM-YYYY
    { regex: /^(\d{1,2})-(\d{1,2})-(\d{4})$/, type: 'ddmmyyyy' },
    // YYYY-MM-DD
    { regex: /^(\d{4})-(\d{1,2})-(\d{1,2})$/, type: 'yyyymmdd' },
    // Month DD, YYYY (English) - e.g., "June 15, 2026"
    { regex: /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/, type: 'monthddyyyy' },
    // DD de Month YYYY (Spanish) - e.g., "15 de junio de 2026"
    { regex: /^(\d{1,2})\s+de\s+([A-Za-z]+)\s+de\s+(\d{4})$/, type: 'dddemonthyyyy' },
  ];

  const monthMap = {
    'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
    'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
    'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12',
    'january': '01', 'february': '02', 'march': '03', 'april': '04',
    'may': '05', 'june': '06', 'july': '07', 'august': '08',
    'september': '09', 'october': '10', 'november': '11', 'december': '12'
  };

  for (const { regex, type } of formats) {
    const match = dateText.match(regex);
    if (match) {
      if (type === 'monthddyyyy') {
        // English month format: "June 15, 2026"
        const month = monthMap[match[1].toLowerCase()];
        if (month) {
          return `${match[3]}-${month}-${match[2].padStart(2, '0')}`;
        }
      } else if (type === 'dddemonthyyyy') {
        // Spanish format: "15 de junio de 2026"
        const month = monthMap[match[2].toLowerCase()];
        if (month) {
          return `${match[3]}-${month}-${match[1].padStart(2, '0')}`;
        }
      } else if (type === 'yyyymmdd') {
        // YYYY-MM-DD format
        return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
      } else {
        // DD/MM/YYYY or DD-MM-YYYY
        return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
      }
    }
  }

  // Fallback: try native Date parse
  const parsed = new Date(dateText);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return null;
}

// ─── Artist Name Normalization ───
const SUFFIX_PATTERNS = [
  /\s+-\s+(LIVE|ACÚSTICO|ACUSTIC|ACUSTICO|DJ\s*SET|BAND|TRIO|QUARTET|SOLO)\s*$/i,
  /\s+(LIVE|ACÚSTICO|ACUSTIC|ACUSTICO|DJ\s*SET|BAND|TRIO|QUARTET|SOLO)\s*$/i,
  /-\s+(LIVE|ACÚSTICO|ACUSTIC|ACUSTICO|DJ\s*SET|BAND|TRIO|QUARTET|SOLO)\s*$/i,
];

function normalizeArtistName(name) {
  if (!name) return '';
  let result = name.trim();
  for (const pattern of SUFFIX_PATTERNS) {
    result = result.replace(pattern, '');
  }
  return result.trim();
}

// ─── Genre Inference ───

// Razzmatazz room to genre mapping
const RAZZ_ROOM_GENRE = {
  'fuego': 'latin',
  'human': 'electronic',
  'torax': 'rock',
  'razzclub': 'rock',
  'lokal': 'electronic',
};

// Last.fm tag to genre slug mapping
const LASTFM_TAG_GENRE = {
  'rock': 'rock',
  'punk': 'punk',
  'hard rock': 'rock',
  'hardcore': 'hardcore',
  'metal': 'metal',
  'heavy metal': 'metal',
  'alternative': 'indie',
  'indie': 'indie',
  'indie rock': 'indie',
  'electronic': 'electronic',
  'techno': 'techno',
  'house': 'house',
  'electro': 'electronic',
  'dance': 'electronic',
  'electronica': 'electronic',
  'hip-hop': 'rap',
  'hip hop': 'rap',
  'rap': 'rap',
  'trap': 'latin', // Latin trap
  'reggaeton': 'reggaeton',
  'latin': 'latin',
  'cumbia': 'latin',
  'salsa': 'latin',
  'flamenco': 'flamenco',
  'pop': 'pop',
  'pop rock': 'pop',
  'indie pop': 'pop',
  'synth-pop': 'pop',
  'r&b': 'rnb',
  'rnb': 'rnb',
  'soul': 'soul',
  'jazz': 'jazz',
  'blues': 'blues',
  'folk': 'folk',
  'country': 'country',
  'reggae': 'reggae',
  'dub': 'reggae',
  'ska': 'reggae',
  'classical': 'classical',
  'ambient': 'electronic',
  'downtempo': 'electronic',
  'experimental': 'indie',
  'noise': 'indie',
  'post-punk': 'rock',
  'new wave': 'rock',
  'grunge': 'rock',
  'emo': 'punk',
  'post-rock': 'indie',
};

// Tags to filter out (not actual music genres)
const LASTFM_TAG_BLOCKLIST = new Set([
  'seen live', 'favorites', 'favorite', 'my', 'to see', 'to check out',
  'all', 'songs', 'playlist', 'spotify', 'playlist-i-made', 'my-playlist',
]);

// Detect Razzmatazz room from URL and map to genre
function detectRazzRoom(url, venueId) {
  if (venueId !== 'razzmatazz' || !url) return null;
  
  const lowerUrl = url.toLowerCase();
  
  for (const [room, genre] of Object.entries(RAZZ_ROOM_GENRE)) {
    if (lowerUrl.includes(room)) {
      return genre;
    }
  }
  
  return null;
}

// Map Last.fm tags to genre slug
function mapLastfmTagsToGenre(tags) {
  if (!tags || tags.length === 0) return null;
  
  // Filter out blocklisted tags and find first valid genre mapping
  for (const tag of tags) {
    const lowerTag = tag.toLowerCase().trim();
    if (LASTFM_TAG_BLOCKLIST.has(lowerTag)) continue;
    
    if (LASTFM_TAG_GENRE[lowerTag]) {
      return LASTFM_TAG_GENRE[lowerTag];
    }
  }
  
  return null;
}

// Known artists that DON'T belong to the venue's typical genres
// Shared between inferGenreSync and inferGenreAsync
const KNOWN_ARTIST_GENRES = {
  // Rap / Hip-hop
  'oxxxymiron': 'rap', 'pedro ladroga': 'rap', 'kase.o': 'rap', '製造': 'rap',
  // Reggaeton / Latin
  'los chunguitos': 'rumba', 'kchiporros': 'cumbia', 'bresh': 'reggaeton',
  'bad bunny': 'reggaeton', 'j balvin': 'reggaeton', 'karol g': 'reggaeton',
  // Electronic / DJ
  'dj playero': 'electronic', 'nitsa': 'electronic', 'apparat': 'electronic',
  'tronkas': 'electronic', 'carne': 'electronic',
  // Pop
  'lany': 'pop', 'elle coves': 'pop', 'fran perea': 'pop',
  'madison beer': 'pop', 'tabü': 'pop', 'milkshake': 'electronic',
  // Indie
  'maig': 'indie',
};

// Sync version for use in normalization (legacy fallback)
function inferGenreSync(artistName, genreHint) {
  if (!artistName || !genreHint || genreHint.length === 0) return 'unknown';

  const lower = artistName.toLowerCase();

  for (const [name, genre] of Object.entries(KNOWN_ARTIST_GENRES)) {
    if (lower.includes(name)) return genre;
  }

  // Keyword-based detection
  if (lower.includes('dj ') || lower.includes('nitsa') || lower.includes('club')) return 'electronic';
  if (/\btrap\b/.test(lower) && !lower.includes('trap rock')) return 'latin';
  if (lower.includes('reggaeton') || lower.includes('cumbia') || lower.includes('rumba')) return 'latin';

  // Default to first genreHint
  return genreHint[0];
}

// Async version with Last.fm enrichment
async function inferGenreAsync(artistName, genreHint, eventUrl, venueId) {
  if (!artistName) return genreHint?.[0] || 'unknown';
  
  const lower = artistName.toLowerCase();
  
  // 1. Check known artist map
  for (const [name, genre] of Object.entries(KNOWN_ARTIST_GENRES)) {
    if (lower.includes(name)) return genre;
  }
  
  // 2. Check genre cache
  const cacheKey = artistName.toLowerCase();
  const cached = genreCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < GENRE_CACHE_TTL_MS) {
    if (cached.genre) return cached.genre;
  }
  
  // 3. Check Razzmatazz room detection
  if (venueId === 'razzmatazz' && eventUrl) {
    const roomGenre = detectRazzRoom(eventUrl, venueId);
    if (roomGenre) {
      genreCache.set(cacheKey, { genre: roomGenre, timestamp: Date.now() });
      return roomGenre;
    }
  }
  
  // 4. Try Last.fm
  try {
    const artistInfo = await LastfmService.getArtistInfo(artistName);
    if (artistInfo && artistInfo.tags && artistInfo.tags.length > 0) {
      const genre = mapLastfmTagsToGenre(artistInfo.tags);
      if (genre) {
        genreCache.set(cacheKey, { genre, timestamp: Date.now() });
        return genre;
      }
    }
  } catch (err) {
    console.warn(`⚠️ [Venues] Last.fm lookup failed for ${artistName}:`, err.message);
  }
  
  // 5. Keyword fallback (same as sync)
  if (lower.includes('dj ') || lower.includes('nitsa') || lower.includes('club')) return 'electronic';
  if (/\btrap\b/.test(lower) && !lower.includes('trap rock')) return 'latin';
  if (lower.includes('reggaeton') || lower.includes('cumbia') || lower.includes('rumba')) return 'latin';
  
  // 6. Fallback to genreHint
  const fallback = genreHint?.[0] || 'unknown';
  genreCache.set(cacheKey, { genre: fallback, timestamp: Date.now() });
  return fallback;
}

// ─── Slugify for ID ───
function slugify(text) {
  if (!text) return 'unknown';
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ─── Normalize Event ───
function normalizeEvent(scraped, config) {
  const artistName = normalizeArtistName(scraped.artistName);
  const dateStr = parsedDateToString(scraped.date);

  return {
    id: `venue-${config.id}-${slugify(artistName)}-${dateStr}`,
    name: `${artistName} @ ${config.name}`,
    artistName: artistName,
    venue: config.name,
    city: config.city,
    country: config.country,
    date: dateStr,
    url: scraped.url || null,
    image: scraped.image || null,
    genre: inferGenreSync(artistName, config.genreHint),
    source: 'venue',
    subsource: config.platform,
    lat: config.lat,
    lng: config.lng,
    _embedded: {
      venues: [{
        name: config.name,
        city: { name: config.city },
        country: { name: config.country },
        location: {
          latitude: String(config.lat),
          longitude: String(config.lng)
        }
      }]
    }
  };
}

function parsedDateToString(dateVal) {
  if (!dateVal) return 'unknown';
  if (typeof dateVal === 'string') return dateVal;
  if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
    return dateVal.toISOString().split('T')[0];
  }
  return 'unknown';
}

// ─── Platform Scrapers ───
async function scrapeMutick(config) {
  try {
    const response = await fetch(config.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const events = [];

    const containerSel = config.selectors.eventContainer || '.event-card';
    $(containerSel).each((_, el) => {
      const artistName = $(el).find(config.selectors.artistName || '.event-title').text().trim();
      const dateText = $(el).find(config.selectors.date || '.event-date').text().trim();
      const eventUrl = $(el).find(config.selectors.eventUrl || '.event-link').attr('href');
      const image = $(el).find(config.selectors.image || '.event-image img').attr('src');

      const parsedDate = parseDate(dateText);

      if (artistName && parsedDate) {
        events.push({
          artistName,
          date: parsedDate,
          url: eventUrl,
          image,
        });
      }
    });

    return events;
  } catch (err) {
    console.warn(`⚠️ [Venues] mutick scrape failed for ${config.name}:`, err.message);
    return [];
  }
}

async function scrapeHfmn(config) {
  try {
    const response = await fetch(config.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ca,es,en;q=0.9',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const events = [];

    const containerSel = config.selectors.eventContainer || '.concert-item';
    $(containerSel).each((_, el) => {
      const artistName = $(el).find(config.selectors.artistName || '.concert-artist').text().trim();
      const dateText = $(el).find(config.selectors.date || '.concert-date').text().trim();
      const eventUrl = $(el).find(config.selectors.eventUrl || 'a.concert-link').attr('href');
      const image = $(el).find(config.selectors.image || '.concert-image img').attr('src');

      const parsedDate = parseDate(dateText);

      if (artistName && parsedDate) {
        events.push({
          artistName,
          date: parsedDate,
          url: eventUrl,
          image,
        });
      }
    });

    return events;
  } catch (err) {
    console.warn(`⚠️ [Venues] hfmncrew scrape failed for ${config.name}:`, err.message);
    return [];
  }
}

async function scrapeEntradium(config) {
  try {
    const response = await fetch(config.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es,en;q=0.9',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const events = [];

    const containerSel = config.selectors.eventContainer || '.event-card';
    $(containerSel).each((_, el) => {
      // Entradium may store date in data-date attribute
      let dateText = $(el).find(config.selectors.date || '.event-date').attr('data-date') ||
                    $(el).find(config.selectors.date || '.event-date').text().trim();

      const artistName = $(el).find(config.selectors.artistName || '.event-title').text().trim();
      const eventUrl = $(el).find(config.selectors.eventUrl || '.event-link').attr('href');
      const image = $(el).find(config.selectors.image || '.event-image img').attr('src');

      const parsedDate = parseDate(dateText);

      if (artistName && parsedDate) {
        events.push({
          artistName,
          date: parsedDate,
          url: eventUrl,
          image,
        });
      }
    });

    return events;
  } catch (err) {
    console.warn(`⚠️ [Venues] entradium scrape failed for ${config.name}:`, err.message);
    return [];
  }
}

// ─── Direct Platform Scraper (official venue websites) ───
async function scrapeDirect(config) {
  try {
    const response = await fetch(config.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es,ca,en;q=0.9',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const events = [];
    const seen = new Set();

    const selectors = config.selectors || {};
    const containerSel = selectors.eventContainer;
    
    if (!containerSel) {
      console.warn(`⚠️ [Venues] direct scraper: no eventContainer selector for ${config.name}`);
      return [];
    }

    $(containerSel).each((_, el) => {
      let artistName = '';
      let dateText = '';
      let eventUrl = '';
      let image = '';
      let genre = '';
      let venue = config.name;

      const $el = $(el);

      // Apolo-style: container IS the <a> link — get text directly
      if (selectors.artistName === containerSel || (selectors.artistName && selectors.artistName.includes('href'))) {
        // Container is the link itself — artist name is the link text
        // For .c-results__event__title links, text is clean: "The Aristocrats", "Nitsa: BAILE INoLVIDABLE | DJ Playero + FLACA + Agila 777"
        const linkText = $el.text().trim();
        
        // If text has multiple lines, parse the main title (Apolo-style metadata)
        if (linkText.includes('\n')) {
          const lines = linkText.split('\n').map(l => l.trim()).filter(Boolean);
          for (const line of lines) {
            if (line.includes('Concierto') || line.includes('Club') || line.includes('Entradas') || line.includes('Gratis')) continue;
            if (line.includes('·') && line.length < 80) continue;
            if (line.length >= 2 && line.length <= 150) {
              artistName = line;
              break;
            }
          }
        } else {
          // Single-line text is the artist name directly
          artistName = linkText;
        }
        
        // If link text parsing failed, try the href slug
        if (!artistName) {
          const href = $el.attr('href') || '';
          const slugMatch = href.match(/\/evento\/(.+?)(?:-\d+)?$/);
          if (slugMatch) {
            artistName = slugMatch[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          }
        }
        eventUrl = $el.attr('href') || '';
      }
      // Razzmatazz-style: artist name in img alt attribute
      else if (selectors.artistName === 'img[alt]') {
        $el.find('img').each((_, img) => {
          const alt = $(img).attr('alt');
          if (alt && alt.trim()) {
            artistName = alt.trim();
            image = $(img).attr('src') || $(img).attr('data-src') || image;
            return false;
          }
        });
      }
      // Generic: find artist name inside container
      else if (selectors.artistName) {
        artistName = $el.find(selectors.artistName).text().trim();
      }

      // Extract event URL
      if (!eventUrl && selectors.eventUrl) {
        const linkSel = selectors.eventUrl === '/agenda/' ? 'a[href*="/agenda/"]' : selectors.eventUrl;
        const link = $el.find(linkSel).first();
        eventUrl = link.attr('href') || $el.attr('href') || '';
      }

      // Extract date from URL pattern: /agenda/YYYY-MM-DD-slug/ or /evento/slug-20260520
      if (eventUrl) {
        const agendaDateMatch = eventUrl.match(/\/agenda\/(\d{4}-\d{2}-\d{2})-/);
        if (agendaDateMatch) {
          dateText = agendaDateMatch[1];
        }
        // Apolo URLs like /es/evento/the-aristocrats-6543 don't have dates
      }

      // Fallback: try to find date text in container or metadata
      if (!dateText && selectors.date) {
        // For Apolo: date is in span.c-leadMeta like "Concierto · Sala Apolo · 19:00"
        // but we need the actual date, which comes from surrounding date headers
        const dateContent = $el.find(selectors.date).text().trim();
        // Only use if it contains a date pattern
        if (dateContent && /\d{1,2}.*(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|\d{4})/i.test(dateContent)) {
          dateText = dateContent;
        }
      }

      // For sites like Apolo where date is in surrounding structural elements rather than inside each event
      if (!dateText && config.dateLabelSelector) {
        // Find the closest date label sibling/parent that precedes this event
        const parent = $el.parent();
        const dateLabel = parent.prevAll(config.dateLabelSelector).first().text().trim();
        if (dateLabel) {
          dateText = dateLabel;
        }
      }

      // Extract genre hint (Concierto vs Club event)
      if ($el.text().includes('Concierto') || $el.text().includes('concierto')) {
        genre = 'rock'; // Concerts are likely rock/indie/etc
      } else if ($el.text().includes('Club') || $el.text().includes('club') || $el.text().includes('Nitsa')) {
        genre = 'electronic'; // Club nights are electronic
      }

      // Get image from inside the event
      if (!image) {
        const img = $el.find('img').first();
        image = img.attr('src') || img.attr('data-src') || '';
      }

      // Make URL absolute
      if (eventUrl && !eventUrl.startsWith('http')) {
        try {
          eventUrl = new URL(eventUrl, config.url).href;
        } catch (_) { /* keep relative */ }
      }

      if (!artistName) return; // Skip events without artist name
      const key = `${artistName}|${venue}`;
      if (seen.has(key)) return; // Skip duplicates
      seen.add(key);

      const parsedDate = parseDate(dateText);

      // For Apolo-style sites without dates, still include the event (date is unknown)
      events.push({
        artistName,
        date: parsedDate || null,
        url: eventUrl,
        image,
        genre,
        venue,
      });
    });

    return events;
  } catch (err) {
    console.warn(`⚠️ [Venues] direct scrape failed for ${config.name}:`, err.message);
    return [];
  }
}

// ─── Main Scrape Function ───
async function scrapeVenue(config) {
  const platform = config.platform;

  switch (platform) {
    case 'mutick':
      return await scrapeMutick(config);
    case 'hfmncrew':
      return await scrapeHfmn(config);
    case 'entradium':
      return await scrapeEntradium(config);
    case 'direct':
      return await scrapeDirect(config);
    default:
      console.warn(`⚠️ [Venues] Unknown platform: ${platform}`);
      return [];
  }
}

// ─── Haversine Distance ───
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Health Tracking ───
function updateHealth(platform, success) {
  if (!venueCache.health[platform]) {
    venueCache.health[platform] = {
      status: 'ok',
      lastSuccess: null,
      failures: 0,
      consecutiveFailures: 0,
      disabledUntil: null,
    };
  }

  const health = venueCache.health[platform];

  if (success) {
    health.consecutiveFailures = 0;
    health.lastSuccess = Date.now();
    health.status = 'ok';
    health.disabledUntil = null;
  } else {
    health.consecutiveFailures++;
    health.failures++;

    if (health.consecutiveFailures >= MAX_FAILURES) {
      health.status = 'down';
      health.disabledUntil = Date.now() + COOLDOWN_MS;
      console.warn(`🏠 [Venues] Platform ${platform} disabled after ${MAX_FAILURES} consecutive failures`);
    }
  }
}

function isPlatformEnabled(platform) {
  const health = venueCache.health[platform];
  if (!health) return true;
  if (health.status === 'ok') return true;
  if (health.disabledUntil && Date.now() > health.disabledUntil) {
    // Retry after cooldown
    return true;
  }
  return false;
}

// ─── Genre Enrichment ───
async function enrichGenres(events) {
  if (!events || events.length === 0) return;
  
  console.log(`🏠 [Venues] Enriching genres for ${events.length} events...`);
  
  // Dedupe artists
  const artistMap = new Map(); // artistName -> { genreHint, eventUrl, venueId, indices[] }
  events.forEach((event, idx) => {
    const key = event.artistName?.toLowerCase();
    if (!key) return;
    
    if (!artistMap.has(key)) {
      artistMap.set(key, {
        artistName: event.artistName,
        genreHint: events.filter(e => e.artistName?.toLowerCase() === key).map(e => e.genre).filter(Boolean),
        eventUrl: event.url,
        venueId: events.find(e => e.artistName?.toLowerCase() === key && e.venue === 'Razzmatazz') ? 'razzmatazz' : null,
        indices: []
      });
    }
    artistMap.get(key).indices.push(idx);
  });
  
  // Process each unique artist
  let enriched = 0;
  const uniqueArtists = Array.from(artistMap.values());
  
  for (const artistData of uniqueArtists) {
    try {
      // Get genreHint from first matching event
      const firstEvent = events[artistData.indices[0]];
      const genreHint = firstEvent?.genre ? [firstEvent.genre] : [];
      
      // Infer genre with enrichment
      const genre = await inferGenreAsync(
        artistData.artistName,
        genreHint,
        artistData.eventUrl,
        artistData.venueId
      );
      
      // Update all events for this artist
      for (const idx of artistData.indices) {
        events[idx].genre = genre;
      }
      enriched++;
    } catch (err) {
      console.warn(`⚠️ [Venues] Genre enrichment failed for ${artistData.artistName}:`, err.message);
      // Keep baseline genre (already set by inferGenreSync)
    }
  }
  
  console.log(`🏠 [Venues] Enriched genres for ${enriched} unique artists`);
}

// ─── Main Refresh ───
async function refreshCache() {
  // Check if cache is still valid
  if (venueCache.lastFetch && Date.now() - venueCache.lastFetch < CACHE_TTL_MS && venueCache.data.length > 0) {
    console.log(`🏠 [Venues] Cache still valid (${venueCache.data.length} events)`);
    return venueCache.data;
  }

  console.log('🏠 [Venues] Refreshing venue cache...');
  const venues = loadVenues();
  const allEvents = [];

  // Process in batches
  const batchSize = MAX_CONCURRENT;
  for (let i = 0; i < venues.length; i += batchSize) {
    const batch = venues.slice(i, i + batchSize);

    const promises = batch.map(async (config) => {
      // Check if platform is disabled
      if (!isPlatformEnabled(config.platform)) {
        console.log(`🏠 [Venues] Skipping disabled platform: ${config.platform}`);
        return [];
      }

      const scraped = await scrapeVenue(config);
      const normalized = scraped.map(event => normalizeEvent(event, config));

      // Update health
      updateHealth(config.platform, normalized.length > 0);

      return normalized;
    });

    const results = await Promise.all(promises);
    allEvents.push(...results.flat());

    // Delay between batches
    if (i + batchSize < venues.length) {
      await new Promise(r => setTimeout(r, SCRAPE_DELAY_MS));
    }
  }

  // Enrich genres via Last.fm (with graceful error handling)
  try {
    await enrichGenres(allEvents);
  } catch (err) {
    console.warn(`⚠️ [Venues] Genre enrichment failed, using baseline genres:`, err.message);
  }

  venueCache.data = allEvents;
  venueCache.lastFetch = Date.now();

  console.log(`🏠 [Venues] Cached ${allEvents.length} events from ${venues.length} venues`);
  return allEvents;
}

// ─── Public API ───
export const VenueService = {

  async initialize() {
    loadVenues();
    // Background refresh
    VenueService.refreshCache().catch(err => {
      console.error('❌ [Venues] Background refresh failed:', err.message);
    });
  },

  async refreshCache() {
    return await refreshCache();
  },

  getEventsByGenres(genres) {
    const events = venueCache.data;
    if (!genres || genres.length === 0) return events;

    const userSet = new Set(genres.map(g => g.toLowerCase()));

    return events.filter(e => {
      const eventGenres = e.genre ? [e.genre] : [];
      return eventGenres.some(g => userSet.has(g));
    });
  },

  getEventsNearLocation(latlong, radius, genres) {
    const events = venueCache.data;
    if (!latlong) return [];

    const [userLat, userLng] = latlong.split(',').map(parseFloat);
    if (isNaN(userLat) || isNaN(userLng)) return [];

    // Filter by genres first (if provided)
    let filtered = events;
    if (genres && genres.length > 0) {
      const userSet = new Set(genres.map(g => g.toLowerCase()));
      filtered = events.filter(e => {
        const eventGenres = e.genre ? [e.genre] : [];
        return eventGenres.some(g => userSet.has(g));
      });
    }

    // Then filter by distance
    return filtered.filter(e => {
      if (e.lat == null || e.lng == null) return false;
      const dist = haversineKm(userLat, userLng, e.lat, e.lng);
      return dist <= radius;
    });
  },

  getHealth() {
    return venueCache.health;
  },

  getCacheStatus() {
    return {
      lastRefresh: venueCache.lastFetch,
      eventCount: venueCache.data.length,
    };
  },

  // For testing
  _resetCache() {
    venueCache = { data: [], lastFetch: null, health: {} };
    venuesConfig = [];
  },
};