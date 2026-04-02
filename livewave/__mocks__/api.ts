export const API_URL = 'http://localhost:8082'

export const getRecommendations = jest.fn().mockResolvedValue({ seed: 'test', recommendations: [] })
export const getEventsForArtist = jest.fn().mockResolvedValue([])
export const searchSpotifyArtists = jest.fn().mockResolvedValue([])
export const getConcertRecommendations = jest.fn().mockResolvedValue({ seed: 'test', events: [] })
export const getDiscoverArtists = jest.fn().mockResolvedValue([])
