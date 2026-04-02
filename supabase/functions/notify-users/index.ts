import { createClient } from 'jsr:@supabase/supabase-js@2'

console.log("Hello from Functions!")

// Define input payload
interface NotifyPayload {
  record?: {
    id: string
  }
  type?: 'concert_nearby' | 'genre_match'
  // genre_match fields
  artist_name?: string
  festival_name?: string
  city?: string
  genres?: string[]
}

Deno.serve(async (req) => {
  try {
    const payload: NotifyPayload = await req.json()

    // Initialize Supabase Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const notificationType = payload.type || 'concert_nearby'

    // ─── MODE 1: Concert Nearby (Original) ───
    if (notificationType === 'concert_nearby') {
      const targetEventId = payload.record?.id
      if (!targetEventId) {
        return new Response(
          JSON.stringify({ error: 'Missing record.id' }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        )
      }

      // 1. Get users near the event
      const { data: users, error: rpcError } = await supabase
        .rpc('get_users_near_event', { event_id: targetEventId })

      if (rpcError) throw rpcError

      if (!users || users.length === 0) {
        return new Response(
          JSON.stringify({ message: 'No users found near this event.' }),
          { headers: { "Content-Type": "application/json" } }
        )
      }

      // 2. Fetch event + artist details
      const { data: event } = await supabase
        .from('events')
        .select(`*, artists ( name )`)
        .eq('id', targetEventId)
        .single()
      
      const artistName = event?.artists?.name || 'New Concert'
      const venue = event?.venue || 'Unknown Venue'
      const city = event?.city || 'Unknown City'

      // 3. Prepare Push Notifications (with dedup check)
      const messages = []
      for (const u of users) {
        if (!u.push_token) continue

        const refKey = `concert-${targetEventId}-${u.id}`

        // Check if already sent
        const { data: existing } = await supabase
          .from('user_notifications_log')
          .select('id')
          .eq('user_id', u.id)
          .eq('reference_key', refKey)
          .maybeSingle()

        if (existing) continue // Already notified

        const title = `New Concert: ${artistName}!`
        const body = `${artistName} is playing at ${venue} in ${city}. Tap to see details!`

        messages.push({
          to: u.push_token,
          sound: 'default',
          title,
          body,
          data: { eventId: targetEventId },
        })

        // Log notification
        await supabase.from('user_notifications_log').insert({
          user_id: u.id,
          type: 'concert_nearby',
          reference_key: refKey,
          title,
          body,
        })
      }

      // 4. Send to Expo
      if (messages.length > 0) {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Accept-Encoding': 'gzip, deflate',
          },
          body: JSON.stringify(messages),
        });
      }

      return new Response(
        JSON.stringify({ success: true, type: 'concert_nearby', notified_count: messages.length }),
        { headers: { "Content-Type": "application/json" } }
      )
    }

    // ─── MODE 2: Genre Match (Festival Engine) ───
    if (notificationType === 'genre_match') {
      const { artist_name, festival_name, city, genres } = payload

      if (!artist_name || !genres || genres.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Missing artist_name or genres for genre_match' }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        )
      }

      // 1. Find users whose genres overlap
      const { data: matchingGenreRows } = await supabase
        .from('genres')
        .select('id, slug')
        .in('slug', genres)

      if (!matchingGenreRows || matchingGenreRows.length === 0) {
        return new Response(
          JSON.stringify({ message: 'No matching genres found in DB' }),
          { headers: { "Content-Type": "application/json" } }
        )
      }

      const genreIds = matchingGenreRows.map((g: any) => g.id)

      const { data: userGenreRows } = await supabase
        .from('user_genres')
        .select('user_id')
        .in('genre_id', genreIds)

      const userIds = [...new Set((userGenreRows || []).map((ug: any) => ug.user_id))]

      if (userIds.length === 0) {
        return new Response(
          JSON.stringify({ message: 'No users with matching genres' }),
          { headers: { "Content-Type": "application/json" } }
        )
      }

      // 2. Get push tokens for matching users
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, push_token')
        .in('id', userIds)
        .not('push_token', 'is', null)

      if (!profiles || profiles.length === 0) {
        return new Response(
          JSON.stringify({ message: 'No users with push tokens' }),
          { headers: { "Content-Type": "application/json" } }
        )
      }

      // 3. Send notifications (with dedup)
      const messages = []
      const genreLabel = genres[0] || 'music'
      const venueInfo = festival_name ? ` at ${festival_name}` : ''
      const cityInfo = city ? ` in ${city}` : ''

      for (const profile of profiles) {
        const refKey = `genre-${artist_name}-${festival_name || 'unknown'}-${profile.id}`

        const { data: existing } = await supabase
          .from('user_notifications_log')
          .select('id')
          .eq('user_id', profile.id)
          .eq('reference_key', refKey)
          .maybeSingle()

        if (existing) continue

        const title = `🎵 ${artist_name}${venueInfo}!`
        const body = `${artist_name} is performing${venueInfo}${cityInfo}. Matches your taste in ${genreLabel}!`

        messages.push({
          to: profile.push_token,
          sound: 'default',
          title,
          body,
          data: { artist: artist_name, festival: festival_name },
        })

        await supabase.from('user_notifications_log').insert({
          user_id: profile.id,
          type: 'genre_match',
          reference_key: refKey,
          title,
          body,
        })
      }

      // 4. Send to Expo
      if (messages.length > 0) {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Accept-Encoding': 'gzip, deflate',
          },
          body: JSON.stringify(messages),
        });
      }

      return new Response(
        JSON.stringify({ success: true, type: 'genre_match', notified_count: messages.length }),
        { headers: { "Content-Type": "application/json" } }
      )
    }

    return new Response(
      JSON.stringify({ error: `Unknown type: ${notificationType}` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})
