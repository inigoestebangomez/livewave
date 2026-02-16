import { StyleSheet, Text, View, ScrollView, Image, Dimensions, ActivityIndicator, DeviceEventEmitter, RefreshControl } from 'react-native'
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
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('user_id', user.id)
      .single()

    let name = profile?.name || user.email || 'Usuario'
    setUsername(name)

    // 2. Obtener los event_id de user_events
    const { data: userEvents } = await supabase
      .from('user_events')
      .select('event_id')
      .eq('user_id', user.id)

    const eventIds = userEvents?.map((ue: any) => ue.event_id) || []

    if (eventIds.length === 0) {
      setEvents([])
      setLoading(false)
      return
    }

    // 3. Obtener los eventos con esos IDs, ordenados por fecha
    // Filtramos para traer solo eventos futuros o de hoy
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    
    const { data: eventsData } = await supabase
      .from('events')
      .select('id,date,venue,city,country,artist_id,artist:artist_id(name,image_url)')
      .in('id', eventIds)
      .gte('date', today) // Filter: date >= today
      .order('date', { ascending: true })

    setEvents(eventsData || [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchData()
  }, [user, fetchData])

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('refreshEvents', fetchData)
    return () => sub.remove()
  }, [fetchData])

  useEffect(() => {
    registerForPushNotifications()
  }, [user])

  async function registerForPushNotifications() {
    if (!user) return
    
    try {
      const { registerForPushNotificationsAsync } = await import('../lib/notifications')
      const token = await registerForPushNotificationsAsync()
      
      if (token) {
        const { error } = await supabase
          .from('profiles')
          .update({ push_token: token })
          .eq('id', user.id)
        
        if (error) {
          console.error("Error saving push token:", error)
        }
      }
    } catch (error) {
      console.error("Error registering for push notifications:", error)
    }
  } 

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const nextEvent = events[0]
  const upcomingEvents = events.slice(1, 6)

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={['#000000', '#b10404']}
        locations={[0.6, 1]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#b10404" />
        }
      >
        <View style={[styles.greetingContainer, { marginTop: insets.top + 20 }]}>
          <Text style={styles.greetingText}>Next Concert</Text>
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
            <Text style={{ color: '#fff', fontSize: 18, textAlign: 'center' }}>No upcoming shows</Text>
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
                  {new Date(event.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                </Text>
              </Text>
            </View>
          ))}
        </ScrollView>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  scrollContent: {
    paddingBottom: 100, // Space for tab bar
  },
  greetingContainer: {
    marginLeft: 20,
    marginBottom: 10,
  },
  greetingText: {
    color: 'white',
    fontSize: 40,
    fontWeight: 'bold',
  },
  eventCard: {
    marginTop: 10,
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
  },
})