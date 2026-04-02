import { FestivalService } from './services/festivals.js';
(async () => {
   // Only scrape Low Festival
   const festivales = FestivalService.getFestivals().filter(f => f.nombre === 'Low Festival');
   console.log('Testing:', festivales.length);
   // ... wait, I need to call the private scrapeArtistsFromUrl.
})();
