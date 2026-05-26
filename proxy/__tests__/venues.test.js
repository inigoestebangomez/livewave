// Unit tests for VenueService utility functions

// --- haversineKm (same as in venues.js) ---
const haversineKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// --- parseDate (same logic as in venues.js) ---
function parseDate(dateText) {
  if (!dateText) return null;

  const formats = [
    { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, type: 'ddmmyyyy' },
    { regex: /^(\d{1,2})-(\d{1,2})-(\d{4})$/, type: 'ddmmyyyy' },
    { regex: /^(\d{4})-(\d{1,2})-(\d{1,2})$/, type: 'yyyymmdd' },
    { regex: /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/, type: 'monthddyyyy' },
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
        const month = monthMap[match[1].toLowerCase()];
        if (month) {
          return `${match[3]}-${month}-${match[2].padStart(2, '0')}`;
        }
      } else if (type === 'dddemonthyyyy') {
        const month = monthMap[match[2].toLowerCase()];
        if (month) {
          return `${match[3]}-${month}-${match[1].padStart(2, '0')}`;
        }
      } else if (type === 'yyyymmdd') {
        return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
      } else {
        return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
      }
    }
  }

  const parsed = new Date(dateText);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return null;
}

// --- normalizeArtistName (same logic as in venues.js) ---
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

// --- slugify (same logic as in venues.js) ---
function slugify(text) {
  if (!text) return 'unknown';
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ============ TESTS ============

// --- parseDate tests ---
test('parseDate: DD/MM/YYYY format', () => {
  expect(parseDate('15/06/2026')).toBe('2026-06-15');
  expect(parseDate('01/01/2025')).toBe('2025-01-01');
  expect(parseDate('31/12/2024')).toBe('2024-12-31');
});

test('parseDate: DD-MM-YYYY format', () => {
  expect(parseDate('15-06-2026')).toBe('2026-06-15');
});

test('parseDate: YYYY-MM-DD format', () => {
  expect(parseDate('2026-06-15')).toBe('2026-06-15');
});

test('parseDate: English month format', () => {
  expect(parseDate('June 15, 2026')).toBe('2026-06-15');
  expect(parseDate('January 1, 2025')).toBe('2025-01-01');
  expect(parseDate('December 31 2024')).toBe('2024-12-31');
});

test('parseDate: Spanish month format', () => {
  expect(parseDate('15 de junio de 2026')).toBe('2026-06-15');
  expect(parseDate('1 de enero de 2025')).toBe('2025-01-01');
});

test('parseDate: null/empty returns null', () => {
  expect(parseDate(null)).toBeNull();
  expect(parseDate('')).toBeNull();
  expect(parseDate('   ')).toBeNull();
});

test('parseDate: invalid format returns null', () => {
  expect(parseDate('not-a-date')).toBeNull();
  expect(parseDate('random text')).toBeNull();
});

// --- normalizeArtistName tests ---
test('normalizeArtistName: removes LIVE suffix', () => {
  expect(normalizeArtistName('The Strokes LIVE')).toBe('The Strokes');
  expect(normalizeArtistName('Band Name LIVE')).toBe('Band Name');
});

test('normalizeArtistName: removes ACUSTICO suffix', () => {
  expect(normalizeArtistName('Artist ACÚSTICO')).toBe('Artist');
  expect(normalizeArtistName('Artist ACUSTIC')).toBe('Artist');
});

test('normalizeArtistName: removes DJ SET suffix', () => {
  expect(normalizeArtistName('DJ Shadow DJ SET')).toBe('DJ Shadow');
});

test('normalizeArtistName: removes hyphenated suffix', () => {
  expect(normalizeArtistName('Artist - LIVE')).toBe('Artist');
  expect(normalizeArtistName('Artist - ACUSTICO')).toBe('Artist');
});

test('normalizeArtistName: keeps DJ in name', () => {
  expect(normalizeArtistName('DJ Shadow')).toBe('DJ Shadow');
  expect(normalizeArtistName('DJ Krush')).toBe('DJ Krush');
});

test('normalizeArtistName: empty returns empty', () => {
  expect(normalizeArtistName('')).toBe('');
  expect(normalizeArtistName(null)).toBe('');
  expect(normalizeArtistName('   ')).toBe(''); // whitespace is trimmed
});

// --- slugify tests ---
test('slugify: converts to lowercase', () => {
  expect(slugify('THE STROKES')).toBe('the-strokes');
  expect(slugify('Artist Name')).toBe('artist-name');
});

test('slugify: removes accents', () => {
  expect(slugify('Niños')).toBe('ninos');
  expect(slugify('España')).toBe('espana');
});

test('slugify: replaces spaces with hyphens', () => {
  expect(slugify('the strokes')).toBe('the-strokes');
  expect(slugify('one two three')).toBe('one-two-three');
});

test('slugify: removes leading/trailing hyphens', () => {
  expect(slugify('  artist')).toBe('artist');
  expect(slugify('artist  ')).toBe('artist');
});

test('slugify: empty returns unknown', () => {
  expect(slugify('')).toBe('unknown');
  expect(slugify(null)).toBe('unknown');
});

// --- haversineKm tests ---
test('haversineKm: Barcelona to Madrid is ~505km', () => {
  const dist = haversineKm(41.39, 2.15, 40.42, -3.70);
  expect(dist).toBeGreaterThan(500);
  expect(dist).toBeLessThan(520);
});

test('haversineKm: Same point returns 0', () => {
  const dist = haversineKm(41.39, 2.15, 41.39, 2.15);
  expect(dist).toBeCloseTo(0, 5);
});

test('haversineKm: Barcelona to Paris is ~830km', () => {
  const dist = haversineKm(41.39, 2.15, 48.86, 2.35);
  expect(dist).toBeGreaterThan(800);
  expect(dist).toBeLessThan(850);
});

test('haversineKm: Barcelona venues within 5km', () => {
  // Razzmatazz: 41.3972, 2.1978 | Apolo: 41.3751, 2.1593
  const dist = haversineKm(41.3972, 2.1978, 41.3751, 2.1593);
  expect(dist).toBeGreaterThan(2);
  expect(dist).toBeLessThan(6);
});

test('haversineKm: Distance filtering logic works', () => {
  const userLat = 41.39;
  const userLng = 2.15;
  const radius = 50; // 50km

  // Razzmatazz (4.6km away) should be within radius
  const razzmatazzDist = haversineKm(userLat, userLng, 41.3972, 2.1978);
  expect(razzmatazzDist).toBeLessThan(radius);

  // Madrid (505km away) should be outside radius
  const madridDist = haversineKm(userLat, userLng, 40.42, -3.70);
  expect(madridDist).toBeGreaterThan(radius);
});

// --- Genre Inference ---

// Copy the genre inference logic for testing (same as venues.js)
const RAZZ_ROOM_GENRE = {
  'fuego': 'latin',
  'human': 'electronic',
  'torax': 'rock',
  'razzclub': 'rock',
  'lokal': 'electronic',
};

const LASTFM_TAG_GENRE = {
  'rock': 'rock',
  'punk': 'punk',
  'electronic': 'electronic',
  'techno': 'techno',
  'hip-hop': 'rap',
  'hip hop': 'rap',
  'rap': 'rap',
  'reggaeton': 'reggaeton',
  'latin': 'latin',
  'indie': 'indie',
  'pop': 'pop',
};

const LASTFM_TAG_BLOCKLIST = new Set([
  'seen live', 'favorites', 'favorite', 'my', 'to see', 'to check out',
]);

function detectRazzRoom(url, venueId) {
  if (venueId !== 'razzmatazz' || !url) return null;
  const lowerUrl = url.toLowerCase();
  for (const [room, genre] of Object.entries(RAZZ_ROOM_GENRE)) {
    if (lowerUrl.includes(room)) return genre;
  }
  return null;
}

function mapLastfmTagsToGenre(tags) {
  if (!tags || tags.length === 0) return null;
  for (const tag of tags) {
    const lowerTag = tag.toLowerCase().trim();
    if (LASTFM_TAG_BLOCKLIST.has(lowerTag)) continue;
    if (LASTFM_TAG_GENRE[lowerTag]) return LASTFM_TAG_GENRE[lowerTag];
  }
  return null;
}

// Sync version (same as venues.js)
function inferGenreSync(artistName, genreHint) {
  if (!artistName || !genreHint || genreHint.length === 0) return 'unknown';
  const lower = artistName.toLowerCase();

  const knownArtistGenres = {
    'oxxxymiron': 'rap', 'pedro ladroga': 'rap', 'kase.o': 'rap',
    'los chunguitos': 'rumba', 'kchiporros': 'cumbia', 'bresh': 'reggaeton',
    'bad bunny': 'reggaeton', 'lany': 'pop', 'elle coves': 'pop',
    'dj playero': 'electronic', 'nitsa': 'electronic', 'apparat': 'electronic',
  };

  for (const [name, genre] of Object.entries(knownArtistGenres)) {
    if (lower.includes(name)) return genre;
  }

  if (lower.includes('dj ') || lower.includes('nitsa')) return 'electronic';
  if (/\btrap\b/.test(lower) && !lower.includes('trap rock')) return 'latin';
  if (lower.includes('reggaeton') || lower.includes('cumbia')) return 'latin';

  return genreHint[0];
}

// --- detectRazzRoom tests ---
test('detectRazzRoom: returns latin for fuego URL', () => {
  expect(detectRazzRoom('https://salarazzmatazz.com/fuego/artist-name', 'razzmatazz')).toBe('latin');
});

test('detectRazzRoom: returns electronic for human URL', () => {
  expect(detectRazzRoom('https://salarazzmatazz.com/human/party', 'razzmatazz')).toBe('electronic');
});

test('detectRazzRoom: returns rock for torax URL', () => {
  expect(detectRazzRoom('https://salarazzmatazz.com/torax/metal-band', 'razzmatazz')).toBe('rock');
});

test('detectRazzRoom: returns rock for razzclub URL', () => {
  expect(detectRazzRoom('https://salarazzmatazz.com/razzclub/indie-band', 'razzmatazz')).toBe('rock');
});

test('detectRazzRoom: returns null for non-razzmatazz venue', () => {
  expect(detectRazzRoom('https://sala-apolo.com/event', 'sala-apolo')).toBeNull();
});

test('detectRazzRoom: returns null for URL without room', () => {
  expect(detectRazzRoom('https://salarazzmatazz.com/conciertos/artist', 'razzmatazz')).toBeNull();
});

// --- mapLastfmTagsToGenre tests ---
test('mapLastfmTagsToGenre: maps rock tag', () => {
  expect(mapLastfmTagsToGenre(['rock', 'alternative'])).toBe('rock');
});

test('mapLastfmTagsToGenre: maps electronic tag', () => {
  expect(mapLastfmTagsToGenre(['electronic', 'house'])).toBe('electronic');
});

test('mapLastfmTagsToGenre: maps rap from hip-hop', () => {
  expect(mapLastfmTagsToGenre(['hip-hop', 'pop'])).toBe('rap');
});

test('mapLastfmTagsToGenre: filters blocklisted tags', () => {
  expect(mapLastfmTagsToGenre(['seen live', 'favorites', 'rock'])).toBe('rock');
});

test('mapLastfmTagsToGenre: returns null for blocklist only', () => {
  expect(mapLastfmTagsToGenre(['seen live', 'favorites'])).toBeNull();
});

test('mapLastfmTagsToGenre: returns null for empty tags', () => {
  expect(mapLastfmTagsToGenre([])).toBeNull();
  expect(mapLastfmTagsToGenre(null)).toBeNull();
});

// --- inferGenreSync tests ---
test('inferGenreSync: known artist overrides genreHint', () => {
  // oxxxymiron should be rap, not rock
  expect(inferGenreSync('Oxxxymiron', ['rock', 'punk'])).toBe('rap');
  expect(inferGenreSync('oxxxymiron live', ['rock'])).toBe('rap');
});

test('inferGenreSync: reggaeton keyword detection', () => {
  expect(inferGenreSync('Bad Bunny', ['rock'])).toBe('reggaeton');
  expect(inferGenreSync('DJ Playero', ['indie'])).toBe('electronic');
});

test('inferGenreSync: trap keyword (not trap rock)', () => {
  expect(inferGenreSync('Trap Latino Artist', ['rock'])).toBe('latin');
});

test('inferGenreSync: fallback to genreHint', () => {
  expect(inferGenreSync('Unknown Band', ['indie', 'pop'])).toBe('indie');
});

test('inferGenreSync: empty params returns unknown', () => {
  expect(inferGenreSync('', ['rock'])).toBe('unknown');
  expect(inferGenreSync('Artist', [])).toBe('unknown');
  expect(inferGenreSync('Artist', null)).toBe('unknown');
});