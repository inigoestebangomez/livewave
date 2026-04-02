import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { FestivalService } from './services/festivals.js';

dotenv.config();

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

const supabaseUrl = process.env.SUPABASE_URL || 'https://ouixpbrqmxgdmqdpfrgf.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function uploadFestivals() {
    console.log('🔄 Extrayendo array de festivales...');
    // Obtenemos los artistas ya generados/sacados en proxy
    const artists = await FestivalService.refreshCache();
    console.log(`✅ Extracción terminada. Total: ${artists.length} artistas de cartel.`);

    console.log('🗑️ Limpiando la base de datos (festival_artists)...');
    const { error: deleteError } = await supabase
        .from('festival_artists')
        .delete()
        .neq('festival_name', 'borrame'); // elimina todo de forma segura
        
    if (deleteError) {
        console.error('❌ Error al limpiar DB:', deleteError);
        return;
    }

    console.log('📍 Preparando objetos con coordenadas e insertándolos...');
    
    // Preparar el array para mandar a la bd
    const rowsToInsert = artists.map(a => {
        let lat = null, lng = null;
        if (a.city) {
            const key = a.city.toLowerCase().trim();
            if (CITY_COORDS[key]) {
                lat = CITY_COORDS[key][0];
                lng = CITY_COORDS[key][1];
            }
        }
        
        return {
            festival_name: a.festivalName || 'Desconocido', 
            artist_name: a.artistName || a.name,
            genres: a.normalizedGenres ? a.normalizedGenres : [a.classifications?.[0]?.genre?.name || a.genre || 'Indie'],
            country: a.country || 'Desconocido',
            city: a.city || 'Desconocido',
            ticket_url: a.url || '',
            location_latitude: lat,
            location_longitude: lng,
        };
    });

    const chunkSize = 200;
    for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
        const chunk = rowsToInsert.slice(i, i + chunkSize);
        const { error: insertError } = await supabase
            .from('festival_artists')
            .insert(chunk);
            
        if (insertError) {
            console.error(`❌ Error insertando bloque ${i}:`, insertError);
        } else {
            console.log(`✅ Insertados ${i + chunk.length} de ${rowsToInsert.length}`);
        }
    }
    
    console.log('🎉 ¡Carga a Supabase de festivales completa! (Con latitud/longitud añadidas)');
    process.exit(0);
}

uploadFestivals();
