import { SpotifyService } from './services/spotify.js';
async function test() {
  const res = await SpotifyService.searchArtists('Chappell Roan');
  console.log(res?.[0]?.images?.[0]?.url);
}
test();
