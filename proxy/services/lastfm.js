import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const LASTFM_API_KEY = process.env.LASTFM_API_KEY;
const BASE_URL = 'https://ws.audioscrobbler.com/2.0';

/**
 * Last.fm Service - Proporciona artistas similares sin necesidad de hardcodear
 * 
 * Ventajas:
 * - API gratuita y estable
 * - Basada en millones de usuarios reales (scrobbling data)
 * - No requiere autenticación OAuth
 * - Devuelve match score (0-1) para ordenar por relevancia
 */
export const LastfmService = {
    
    /**
     * Obtiene artistas similares basados en datos de scrobbling de usuarios
     * @param artistName - Nombre del artista seed
     * @param limit - Numero maximo de artistas (default: 10)
     * @returns Array de artistas similares con match score
     */
    getSimilarArtists: async (artistName, limit = 10) => {
        if (!artistName || !LASTFM_API_KEY) {
            console.log('⚠️ [Last.fm] Missing artist name or API key');
            return [];
        }

        try {
            const url = `${BASE_URL}/?method=artist.getsimilar&artist=${encodeURIComponent(artistName)}&api_key=${LASTFM_API_KEY}&format=json&limit=${limit * 2}`;
            
            console.log(`🎵 [Last.fm] Fetching similar artists for: ${artistName}`);
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Last.fm API Error: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.error) {
                console.warn(`⚠️ [Last.fm] Error: ${data.message}`);
                return [];
            }

            const similarArtists = data.similarartists?.artist || [];
            
            if (similarArtists.length === 0) {
                console.log(`⚠️ [Last.fm] No similar artists found for: ${artistName}`);
                return [];
            }

            console.log(`✅ [Last.fm] Found ${similarArtists.length} similar artists for ${artistName}`);
            
            // Mapear y filtrar por match score (> 0.05 para evitar matches muy debiles)
            return similarArtists
                .map((artist) => ({
                    name: artist.name,
                    match: parseFloat(artist.match) || 0,
                    url: artist.url,
                    image: artist.image?.find((img) => img.size === 'large')?.['#text'] || 
                           artist.image?.[artist.image.length - 1]?.['#text']
                }))
                .filter((a) => a.match > 0.05)
                .slice(0, limit);
                
        } catch (error) {
            console.error('❌ [Last.fm] Error fetching similar artists:', error);
            return [];
        }
    },

    /**
     * Busca informacion de un artista
     */
    getArtistInfo: async (artistName) => {
        if (!artistName || !LASTFM_API_KEY) return null;

        try {
            const url = `${BASE_URL}/?method=artist.getinfo&artist=${encodeURIComponent(artistName)}&api_key=${LASTFM_API_KEY}&format=json`;
            
            const response = await fetch(url);
            if (!response.ok) return null;

            const data = await response.json();
            if (data.error) return null;

            const artist = data.artist;
            if (!artist) return null;

            return {
                name: artist.name,
                url: artist.url,
                bio: artist.bio?.summary,
                tags: artist.tags?.tag?.map((t) => t.name) || [],
                similar: artist.similar?.artist?.map((a) => a.name) || [],
                image: artist.image?.find((img) => img.size === 'large')?.['#text']
            };
        } catch (error) {
            console.error('❌ [Last.fm] Error fetching artist info:', error);
            return null;
        }
    },

    /**
     * Obtiene top tracks de un artista (para analisis adicional)
     */
    getTopTracks: async (artistName, limit = 5) => {
        if (!artistName || !LASTFM_API_KEY) return [];

        try {
            const url = `${BASE_URL}/?method=artist.gettoptracks&artist=${encodeURIComponent(artistName)}&api_key=${LASTFM_API_KEY}&format=json&limit=${limit}`;
            
            const response = await fetch(url);
            if (!response.ok) return [];

            const data = await response.json();
            if (data.error) return [];

            return (data.toptracks?.track || []).map((track) => ({
                name: track.name,
                playcount: parseInt(track.playcount) || 0,
                listeners: parseInt(track.listeners) || 0,
                url: track.url
            }));
        } catch (error) {
            console.error('❌ [Last.fm] Error fetching top tracks:', error);
            return [];
        }
    }
};
