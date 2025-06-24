import { StyleSheet, Text, View, ScrollView, Image, Dimensions, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import React, { useEffect, useState, useCallback } from 'react'
import { useUser } from '@supabase/auth-helpers-react'
import { supabase } from '../lib/supabase'

const screenWidth = Dimensions.get('window').width

export default function LoggedHome() {
  const insets = useSafeAreaInsets()
  const user = useUser()
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState<string | null>(null)
  const [events, setEvents] = useState<any[]>([])

  // Obtener nombre de usuario y eventos
  const fetchData = useCallback(async () => {
    setLoading(true)
    if (!user) {
      setLoading(false)
      return
    }

    // 1. Obtener el nombre de usuario desde profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('name')
      .eq('user_id', user.id)
      .single()

    let name = profile?.name || user.email || 'Usuario'
    setUsername(name)

    // 2. Obtener los event_id de user_events
    const { data: userEvents, error: ueError } = await supabase
      .from('user_events')
      .select('event_id')
      .eq('user_id', user.id)

    if (ueError) {
      setLoading(false)
      return
    }

    const eventIds = userEvents?.map((ue: any) => ue.event_id) || []

    if (eventIds.length === 0) {
      setEvents([])
      setLoading(false)
      return
    }

    // 3. Obtener los eventos con esos IDs, ordenados por fecha
    const { data: eventsData, error: evError } = await supabase
      .from('events')
      .select('id,date,venue,city,country,artist_id,artist:artist_id(name,image_url)')
      .in('id', eventIds)
      .order('date', { ascending: true })

    if (evError) {
      setLoading(false)
      return
    }

    setEvents(eventsData || [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchData()
  }, [user, fetchData])

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator color="#b10404" size="large" />
      </View>
    )
  }

  const nextEvent = events[0]
  const upcomingEvents = events.slice(1, 6)

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={['#000000', '#b10404']}
        locations={[0.6, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.container}>
        <View style={styles.greetingContainer}>
          <Text style={styles.greetingText}>Hola {username}!</Text>
        </View>

        {nextEvent ? (
          <View style={styles.eventCard}>
            <Image
              source={{
                uri: nextEvent.artist?.image_url || 'https://via.placeholder.com/600x400?text=Sin+imagen',
              }}
              style={styles.eventImage}
            />
            <Text style={styles.eventTitle}>{nextEvent.artist?.name || 'Artista desconocido'}</Text>
            <Text style={styles.eventDate}>
              {new Date(nextEvent.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })} - {nextEvent.city}
            </Text>
          </View>
        ) : (
          <View style={styles.eventCard}>
            <Text style={{ color: '#fff', fontSize: 18, textAlign: 'center' }}>Not upcoming shows</Text>
          </View>
        )}

        <View style={styles.upcomingContainer}>
          <Text style={styles.upcomingTitle}>Upcoming</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.upcomingScroll}>
          {upcomingEvents.length === 0 && (
            <Text style={{ color: '#aaa', marginLeft: 20 }}>No more shows</Text>
          )}
          {upcomingEvents.map((event, i) => (
            <View key={event.id} style={styles.artistContainer}>
              <Image
                source={{ uri: event.artist?.image_url || 'https://via.placeholder.com/200x200?text=Sin+imagen' }}
                style={styles.artistImage}
              />
              <Text style={[styles.eventDate, styles.artistTitle]}>
                {event.artist?.name || 'Artista'}{'\n'}
                <Text style={{ color: '#b10404' }}>
                </Text>
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  greetingContainer: {
    marginTop: 30,
    marginLeft: 20,
  },
  greetingText: {
    color: 'white',
    fontSize: 40,
    fontWeight: 'bold',
  },
  eventCard: {
    marginTop: 20,
    padding: 16,
  },
  eventImage: {
    width: screenWidth * 0.9,
    height: screenWidth*0.7,
    resizeMode: 'cover',
    borderRadius: 20,
    marginBottom: 10,
  },
  eventTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
    marginLeft: 5,
  },
  eventDate: {
    color: '#aaa',
    fontSize: 14,
    marginLeft: 5,
  },
  upcomingContainer: {
    marginTop: 10,
    marginLeft: 20,
  },
  upcomingTitle: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
  },
  upcomingScroll: {
    marginLeft: 20,
    marginTop: 30,
    alignItems: 'center',
    height: screenWidth * 0.5,
  },
  artistContainer: {
    marginRight: 16,
    justifyContent: 'flex-start',
    alignItems: 'center',
    width: screenWidth * 0.42,
  },
  artistImage: {
    width: screenWidth * 0.42,
    height: screenWidth * 0.42,
    borderRadius: 12,
    marginBottom: 8,
  },
  artistTitle: {
    textAlign: 'center'
  }
})