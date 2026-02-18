
export const SIMILARITY_MAP = {
    // Rock / Alternative
    'muse': ['Royal Blood', 'Placebo', 'Biffy Clyro', 'Nothing But Thieves', 'Kasabian', 'Radiohead'],
    'coldplay': ['Imagine Dragons', 'OneRepublic', 'The Script', 'Maroon 5', 'Keane', 'Snow Patrol'],
    'radiohead': ['Arcade Fire', 'The Smile', 'Interpol', 'Massive Attack', 'Portishead'],
    'arctic monkeys': ['The Strokes', 'Franz Ferdinand', 'The Kooks', 'Cage The Elephant', 'The Black Keys'],
    'foo fighters': ['Queens of the Stone Age', 'Red Hot Chili Peppers', 'Pearl Jam', 'Nirvana', 'The Offspring'],
    'red hot chili peppers': ['Foo Fighters', 'Incubus', 'Rage Against The Machine', 'Jane\'s Addiction', 'Sublime'],
    
    // Pop
    'taylor swift': ['Olivia Rodrigo', 'Sabrina Carpenter', 'Ariana Grande', 'Selena Gomez', 'Lana Del Rey'],
    'dua lipa': ['Miley Cyrus', 'Doja Cat', 'Bebe Rexha', 'Rita Ora', 'Charli XCX'],
    'harry styles': ['Niall Horan', 'Louis Tomlinson', 'Shawn Mendes', '5 Seconds of Summer'],
    'billie eilish': ['Finneas', 'Lorde', 'Olivia Rodrigo', 'Melanie Martinez', 'Clairo'],
    'the weeknd': ['Drake', 'Post Malone', 'Brent Faiyaz', 'Frank Ocean', 'SZA'],
    
    // Hip Hop
    'kendrick lamar': ['J. Cole', 'Schoolboy Q', 'Anderson .Paak', 'Tyler, The Creator', 'Drake'],
    'drake': ['The Weeknd', 'J. Cole', 'Future', '21 Savage', 'Travis Scott'],
    'travis scott': ['A$AP Rocky', 'Kid Cudi', 'Playboi Carti', 'Kanye West', 'Don Toliver'],
    
    // Metal / Heavy
    'metallica': ['Megadeth', 'Iron Maiden', 'Slayer', 'Pantera', 'Avenged Sevenfold'],
    'bring me the horizon': ['Bad Omens', 'Architects', 'Falling In Reverse', 'Pierce The Veil', 'Spiritbox'],
    'slipknot': ['Korn', 'System of a Down', 'Disturbed', 'Limp Bizkit', 'Marilyn Manson'],
    'system of a down': ['Serj Tankian', 'Korn', 'Slipknot', 'Deftones', 'Rage Against The Machine'],

    // Indie
    'tame impala': ['Glass Animals', 'MGMT', 'Foster The People', 'Empire of the Sun', 'Beach House'],
    'the 1975': ['LANY', 'Pale Waves', 'The Japanese House', 'Bleachers', 'Wolf Alice'],
    
    // Electronic
    'daft punk': ['Justice', 'The Chemical Brothers', 'LCD Soundsystem', 'Gorillaz', 'Deadmau5'],
    'calvin harris': ['David Guetta', 'Avicii', 'Tiësto', 'Zedd', 'Martin Garrix']
};

export function getSimilarArtists(seedName) {
    if (!seedName) return [];
    
    // Normalize seed 
    const lowerSeed = seedName.toLowerCase().trim();
    
    // Direct match
    if (SIMILARITY_MAP[lowerSeed]) {
        return SIMILARITY_MAP[lowerSeed];
    }
    
    // Check if seed is contained (e.g. "Muse UK" -> "Muse")? No, risky.
    
    return [];
}
