import { createClient } from 'jsr:@supabase/supabase-js@2'

console.log("Hello from Functions!")

// Define input payload
interface NotifyPayload {
  record?: {
    id: string
    // other fields if needed from webhook
  }
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    const record = payload.record
    const targetEventId = record?.id

    if (!targetEventId) {
      return new Response(
        JSON.stringify({ error: 'Missing record.id' }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Initialize Supabase Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Get users near the event
    const { data: users, error: rpcError } = await supabase
      .rpc('get_users_near_event', { event_id: targetEventId })

    if (rpcError) {
      throw rpcError
    }

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

    // 3. Prepare Push Notifications
    const messages = users.map((u: any) => {
        if (!u.push_token) return null
        return {
            to: u.push_token,
            sound: 'default',
            title: `New Concert: ${artistName}!`,
            body: `${artistName} is playing at ${venue} in ${city}. Tap to see details!`,
            data: { eventId: targetEventId },
        }
    }).filter((m: any) => m !== null)

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
      JSON.stringify({ success: true, notified_count: messages.length }),
      { headers: { "Content-Type": "application/json" } }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})
