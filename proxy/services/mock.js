export const MOCK_ARTISTS = [
    { id: 'mock-1', name: 'Muse', images: [{ url: 'https://i.scdn.co/image/ab6761610000e5eb989ed05e1f37e40854O962' }], genres: ['rock'], popularity: 85 },
    { id: 'mock-2', name: 'Coldplay', images: [{ url: 'https://i.scdn.co/image/ab6761610000e5eb989ed05e1f37e40854O962' }], genres: ['pop', 'rock'], popularity: 90 },
    { id: 'mock-3', name: 'Arctic Monkeys', images: [{ url: 'https://i.scdn.co/image/ab6761610000e5eb7da39dea0a72f5a653', genres: ['indie', 'rock'], popularity: 88 }], },
    { id: 'mock-4', name: 'Dua Lipa', images: [{ url: 'https://i.scdn.co/image/ab6761610000e5eb9e690225c797cb83p913' }], genres: ['pop'], popularity: 95 },
    { id: 'mock-5', name: 'The Weeknd', images: [{ url: 'https://i.scdn.co/image/ab6761610000e5eb214f3cf1cbe7139c1f', genres: ['r&b', 'pop'], popularity: 98 }], },
    { id: 'mock-6', name: 'Foo Fighters', images: [{ url: 'https://i.scdn.co/image/ab6761610000e5eb24f3c7f99994982', genres: ['rock'], popularity: 82 }], },
    { id: 'mock-7', name: 'Red Hot Chili Peppers', images: [{ url: 'https://i.scdn.co/image/ab6761610000e5eb9f3d532L294', genres: ['rock', 'funk'], popularity: 84 }], },
    { id: 'mock-8', name: 'Billie Eilish', images: [{ url: 'https://i.scdn.co/image/ab6761610000e5eb8a3f0a3ca7d69', genres: ['pop', 'indie'], popularity: 92 }], },
    { id: 'mock-9', name: 'Tame Impala', images: [{ url: 'https://i.scdn.co/image/ab6761610000e5ebb856360f', genres: ['psychedelic', 'rock'], popularity: 80 }], },
    { id: 'mock-10', name: 'Gorillaz', images: [{ url: 'https://i.scdn.co/image/ab6761610000e5eb994101', genres: ['alternative', 'hip-hop'], popularity: 78 }], },
];

export const getMockArtists = (query) => {
    // Simple filter
    const term = query.replace('genre:', '').replace('year:', '').replace(/['"]/g, '').toLowerCase();
    
    // If specific genre search or year, return random subset
    if (query.includes('genre:') || query.includes('year:')) {
        return MOCK_ARTISTS.sort(() => 0.5 - Math.random()).slice(0, 5);
    }
    
    // Keyword search
    return MOCK_ARTISTS.filter(a => a.name.toLowerCase().includes(term));
};
