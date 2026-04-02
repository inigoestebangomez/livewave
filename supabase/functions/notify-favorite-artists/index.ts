import { createClient } from 'jsr:@supabase/supabase-js@2'

console.log("Hello from notify-favorite-artists!")

/**
 * notify-favorite-artists
 *
 * For each user, fetches their followed artists, queries Ticketmaster using
 * the user's own location + radius, and only sends push notifications for
 * events that are actually within range.
 *
 * TM results are cached per (artistName + roundedLat + roundedLng) to avoid
 * duplicate API calls when multiple users follow the same artist from a
 * similar location.
 *
 * Trigger: pg_cron daily at 12:00 UTC ("notify-fav-artists-daily")
 */

// Round a coordinate to 1 decimal place (~11km grid) for cache bucketing
function roundCoord(n: number): number {
  return Math.round(n * 10) / 10
}

Deno.serve(async (_req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const tmApiKey = Deno.env.get('TM_API_KEY')

    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Load all users with push tokens and location
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, push_token, location_latitude, location_longitude, radius_km')
      .not('push_token', 'is', null)
      .not('location_latitude', 'is', null)
      .not('location_longitude', 'is', null)

    if (profilesError) throw profilesError
    if (!profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No users with push tokens and location' }),
        { headers: { "Content-Type": "application/json" } }
      )
    }

    // 2. Load all user_follows with artist names in one query
    const { data: userFollows, error: followsError } = await supabase
      .from('user_follows')
      .select('user_id, artists ( id, name )')

    if (followsError) throw followsError
    if (!userFollows || userFollows.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No followed artists found' }),
        { headers: { "Content-Type": "application/json" } }
      )
    }

    // Map: userId -> Set<artistNameLower>
    const userArtistsMap = new Map<string, Set<string>>()
    for (const row of userFollows) {
      const uId = row.user_id
      const aName = (row.artists as any)?.name
      if (!uId || !aName) continue
      if (!userArtistsMap.has(uId)) userArtistsMap.set(uId, new Set())
      userArtistsMap.get(uId)!.add(aName.toLowerCase())
    }

    // 3. TM cache: key = `${artistLower}|${roundedLat}|${roundedLng}`
    //    value = array of { eventId, venue, city, lat, lng }
    const tmCache = new Map<string, Array<{
      eventId: string
      venue: string
      city: string
      lat: number | null
      lng: number | null
    }>>()

    async function fetchTMEvents(artistName: string, lat: number, lng: number, radiusKm: number) {
      const cacheKey = `${artistName}|${roundCoord(lat)}|${roundCoord(lng)}`
      if (tmCache.has(cacheKey)) return tmCache.get(cacheKey)!

      const results: Array<{ eventId: string; venue: string; city: string; lat: number | null; lng: number | null }> = []

      if (!tmApiKey) {
        tmCache.set(cacheKey, results)
        return results
      }

      try {
        const url = new URL('https://app.ticketmaster.com/discovery/v2/events.json')
        url.searchParams.set('apikey', tmApiKey)
        url.searchParams.set('keyword', artistName)
        url.searchParams.set('latlong', `${lat},${lng}`)
        url.searchParams.set('radius', String(Math.min(radiusKm, 500))) // TM max is 500 miles but we'll use km
        url.searchParams.set('unit', 'km')
        url.searchParams.set('size', '10')
        url.searchParams.set('sort', 'date,asc')

        const res = await fetch(url.toString())
        if (!res.ok) {
          tmCache.set(cacheKey, results)
          return results
        }

        const data = await res.json()
        const events = data._embedded?.events || []

        for (const ev of events) {
          const venue = ev._embedded?.venues?.[0]
          const venueName = venue?.name || 'Unknown Venue'
          const cityName = venue?.city?.name || 'Unknown City'
          const evLat = parseFloat(venue?.location?.latitude)
          const evLng = parseFloat(venue?.location?.longitude)

          results.push({
            eventId: `tm-${ev.id}`,
            venue: venueName,
            city: cityName,
            lat: isNaN(evLat) ? null : evLat,
            lng: isNaN(evLng) ? null : evLng,
          })
        }
      } catch (_e) { /* ignore TM errors */ }

      tmCache.set(cacheKey, results)
      return results
    }

    // Helper: Haversine distance in km between two lat/lng points
    function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
      const R = 6371
      const dLat = (lat2 - lat1) * Math.PI / 180
      const dLng = (lng2 - lng1) * Math.PI / 180
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    }

    // 4. Load festival_artists for cross-reference
    const { data: festivalArtists } = await supabase
      .from('festival_artists')
      .select('id, artist_name, festival_name, city, country, location_latitude, location_longitude')

    // Build festival lookup: artistNameLower -> [festival entries]
    type FestivalEntry = {
      id: string
      festival_name: string
      city: string
      country: string
      lat: number | null
      lng: number | null
    }
    const festivalMap = new Map<string, FestivalEntry[]>()
    for (const fa of (festivalArtists || [])) {
      if (!fa.artist_name) continue
      const key = fa.artist_name.toLowerCase()
      if (!festivalMap.has(key)) festivalMap.set(key, [])
      festivalMap.get(key)!.push({
        id: fa.id,
        festival_name: fa.festival_name,
        city: fa.city || 'Unknown City',
        country: fa.country || '',
        lat: fa.location_latitude ?? null,
        lng: fa.location_longitude ?? null,
      })
    }

    // 5. Process each user
    const allMessages: any[] = []
    let totalSent = 0

    for (const profile of profiles) {
      const userLat = profile.location_latitude as number
      const userLng = profile.location_longitude as number
      const radiusKm = (profile.radius_km as number) || 50
      const artistNames = userArtistsMap.get(profile.id)
      if (!artistNames || artistNames.size === 0) continue

      for (const artistName of artistNames) {
        // --- Ticketmaster events (location-filtered by API) ---
        const tmEvents = await fetchTMEvents(artistName, userLat, userLng, radiusKm)

        for (const ev of tmEvents) {
          // Double-check with haversine if the event has coords
          if (ev.lat !== null && ev.lng !== null) {
            const dist = haversineKm(userLat, userLng, ev.lat, ev.lng)
            if (dist > radiusKm) continue
          }

          const refKey = `fav-${ev.eventId}-${profile.id}`
          const { data: existing } = await supabase
            .from('user_notifications_log')
            .select('id')
            .eq('user_id', profile.id)
            .eq('reference_key', refKey)
            .maybeSingle()

          if (existing) continue

          const title = `🎵 Show Alert: ${artistName}!`
          const body = `${artistName} is playing at ${ev.venue} in ${ev.city}. Tap to see details!`

          allMessages.push({
            to: profile.push_token,
            sound: 'default',
            title,
            body,
            data: { artist: artistName, source: 'ticketmaster', eventId: ev.eventId },
          })

          await supabase.from('user_notifications_log').insert({
            user_id: profile.id,
            type: 'favorite_artist',
            reference_key: refKey,
            title,
            body,
          })
          totalSent++
        }

        // --- Festival artists (filter by haversine if coords available, else skip) ---
        const festivals = festivalMap.get(artistName) || []
        for (const fa of festivals) {
          // If festival has coordinates, check distance
          if (fa.lat !== null && fa.lng !== null) {
            const dist = haversineKm(userLat, userLng, fa.lat, fa.lng)
            if (dist > radiusKm) continue
          } else {
            // No coordinates: skip — we can't verify proximity
            continue
          }

          const refKey = `fav-fest-${fa.id}-${profile.id}`
          const { data: existing } = await supabase
            .from('user_notifications_log')
            .select('id')
            .eq('user_id', profile.id)
            .eq('reference_key', refKey)
            .maybeSingle()

          if (existing) continue

          const title = `🎵 Show Alert: ${artistName} at ${fa.festival_name}!`
          const body = `${artistName} is performing at ${fa.festival_name} in ${fa.city}. Tap to see details!`

          allMessages.push({
            to: profile.push_token,
            sound: 'default',
            title,
            body,
            data: { artist: artistName, source: 'festival', festivalId: fa.id },
          })

          await supabase.from('user_notifications_log').insert({
            user_id: profile.id,
            type: 'favorite_artist',
            reference_key: refKey,
            title,
            body,
          })
          totalSent++
        }
      }
    }

    // 6. Send in batches of 100 to Expo
    for (let i = 0; i < allMessages.length; i += 100) {
      const batch = allMessages.slice(i, i + 100)
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(batch),
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        users_processed: profiles.length,
        tm_cache_entries: tmCache.size,
        notifications_sent: totalSent,
      }),
      { headers: { "Content-Type": "application/json" } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})
