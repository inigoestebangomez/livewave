import { createClient } from 'jsr:@supabase/supabase-js@2'

/**
 * notify-festival-matches
 *
 * Reads festival_artists, cross-references with user genre preferences, and
 * sends push notifications only when the festival is within the user's radius.
 *
 * Requires: festival_artists.location_latitude / location_longitude to be set
 * (populated by the scraper). Entries without coordinates are skipped.
 *
 * Trigger: Manually or via cron (Supabase pg_cron)
 * Body: { "year": 2026 } (optional, defaults to current year)
 */

// Haversine distance in km
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}))
    const targetYear = body.year || new Date().getFullYear()

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Get all festival artists for this year that have coordinates
    const { data: festivalArtists, error: faError } = await supabase
      .from('festival_artists')
      .select('*')
      .eq('year', targetYear)
      .not('location_latitude', 'is', null)
      .not('location_longitude', 'is', null)

    if (faError) throw faError

    if (!festivalArtists || festivalArtists.length === 0) {
      return new Response(
        JSON.stringify({
          message: `No festival artists with coordinates found for year ${targetYear}. ` +
            'Make sure the scraper populates location_latitude and location_longitude.',
        }),
        { headers: { "Content-Type": "application/json" } }
      )
    }

    // 2. Get all genres from the DB
    const { data: allGenres } = await supabase
      .from('genres')
      .select('id, slug')

    if (!allGenres || allGenres.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No genres found in DB' }),
        { headers: { "Content-Type": "application/json" } }
      )
    }

    const genreIdToSlug = new Map(allGenres.map((g: any) => [g.id, g.slug]))

    // 3. Get all user genre preferences
    const { data: userGenreRows } = await supabase
      .from('user_genres')
      .select('user_id, genre_id')

    // 4. Get all profiles with push tokens + location
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, push_token, location_latitude, location_longitude, radius_km')
      .not('push_token', 'is', null)
      .not('location_latitude', 'is', null)
      .not('location_longitude', 'is', null)

    if (!profiles || profiles.length === 0 || !userGenreRows) {
      return new Response(
        JSON.stringify({ message: 'No users with push tokens and location' }),
        { headers: { "Content-Type": "application/json" } }
      )
    }

    // Build user → genre slugs map
    const userGenresMap = new Map<string, Set<string>>()
    for (const ug of userGenreRows) {
      const slug = genreIdToSlug.get(ug.genre_id)
      if (!slug) continue
      if (!userGenresMap.has(ug.user_id)) userGenresMap.set(ug.user_id, new Set())
      userGenresMap.get(ug.user_id)!.add(slug)
    }

    // Build push token map
    const tokenMap = new Map(profiles.map((p: any) => [p.id, p.push_token]))

    // 5. For each festival artist, find matching users within range
    let totalSent = 0
    const allMessages: any[] = []
    let skippedNoCoords = 0

    for (const fa of festivalArtists) {
      const artistGenres: string[] = fa.genres || []
      if (artistGenres.length === 0) continue

      const faLat = fa.location_latitude as number
      const faLng = fa.location_longitude as number

      for (const profile of profiles) {
        const userLat = profile.location_latitude as number
        const userLng = profile.location_longitude as number
        const radiusKm = (profile.radius_km as number) || 50

        // Check proximity first (cheapest check)
        const dist = haversineKm(userLat, userLng, faLat, faLng)
        if (dist > radiusKm) continue

        // Check genre overlap
        const userSlugs = userGenresMap.get(profile.id)
        if (!userSlugs) continue
        const overlap = artistGenres.filter((g: string) => userSlugs.has(g))
        if (overlap.length === 0) continue

        const pushToken = tokenMap.get(profile.id)
        if (!pushToken) continue

        const refKey = `festival-${fa.festival_name}-${fa.artist_name}-${profile.id}`

        // Check dedup
        const { data: existing } = await supabase
          .from('user_notifications_log')
          .select('id')
          .eq('user_id', profile.id)
          .eq('reference_key', refKey)
          .maybeSingle()

        if (existing) continue

        const title = `🎵 ${fa.artist_name} at ${fa.festival_name}!`
        const body = `${fa.artist_name} is performing at ${fa.festival_name} in ${fa.city}. Matches your taste in ${overlap[0]}!`

        allMessages.push({
          to: pushToken,
          sound: 'default',
          title,
          body,
          data: { artist: fa.artist_name, festival: fa.festival_name },
        })

        await supabase.from('user_notifications_log').insert({
          user_id: profile.id,
          type: 'festival_artist',
          reference_key: refKey,
          title,
          body,
        })

        totalSent++
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
        festival_artists_evaluated: festivalArtists.length,
        skipped_no_coords: skippedNoCoords,
        users_with_location: profiles.length,
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
