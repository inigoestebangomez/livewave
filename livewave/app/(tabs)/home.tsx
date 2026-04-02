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
    <View style={styles.container}>
      <LinearGradient
        colors={['#000000', '#b10404']}
        locations={[0.6, 1]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#b10404" />
        }
      >
        <View style={[styles.greetingContainer, { marginTop: insets.top + 20 }]}>
          <Text style={styles.greetingText}>Next Concert</Text>
        </View>

        {nextEvent ? (
          <View style={styles.mainCardWrapper}>
              <View style={styles.eventCard}>
                <Image
                  source={{
                    uri: nextEvent.artist?.image_url || 'https://via.placeholder.com/600x400?text=Sin+imagen',
                  }}
                  style={styles.eventImage}
                />
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.8)', '#000']}
                  style={styles.imageOverlay}
                />
                <View style={styles.mainEventInfo}>
                    <Text style={styles.eventTitle} numberOfLines={1}>{nextEvent.artist?.name || 'Artista desconocido'}</Text>
                    <Text style={styles.eventDate}>
                      {new Date(nextEvent.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })} • {nextEvent.city}
                    </Text>
                </View>
              </View>
          </View>
        ) : (
          <View style={[styles.eventCard, styles.emptyCard]}>
            <Text style={styles.emptyText}>No upcoming shows</Text>
          </View>
        )}

        <View style={styles.upcomingContainer}>
          <Text style={styles.upcomingTitle}>Upcoming</Text>
        </View>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.upcomingScroll}>
          {upcomingEvents.length === 0 && (
            <Text style={styles.emptyUpcomingText}>No more shows saved</Text>
          )}
          {upcomingEvents.map((event, i) => (
            <View key={event.id} style={styles.artistContainer}>
              <Image
                source={{ uri: event.artist?.image_url || 'https://via.placeholder.com/200x200?text=Sin+imagen' }}
                style={styles.artistImage}
              />
              <Text style={styles.artistTitle} numberOfLines={1}>
                {event.artist?.name || 'Artista'}
              </Text>
              <Text style={styles.upcomingDateText}>
                  {new Date(event.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }).toUpperCase()}
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
    flex: 1,
    backgroundColor: '#000',
  },
  scrollContent: {
    paddingBottom: 120, // Space for tab bar
  },
  greetingContainer: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  greetingText: {
    color: 'white',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  mainCardWrapper: {
      paddingHorizontal: 20,
  },
  eventCard: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(30,30,30,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  emptyCard: {
      padding: 40,
      marginHorizontal: 20,
      alignItems: 'center',
      justifyContent: 'center',
      borderStyle: 'dashed',
      borderColor: 'rgba(255,255,255,0.2)'
  },
  emptyText: {
      color: '#888',
      fontSize: 16,
      fontWeight: '500'
  },
  eventImage: {
    width: '100%',
    aspectRatio: 1, 
    resizeMode: 'cover',
  },
  imageOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: '50%',
  },
  mainEventInfo: {
      position: 'absolute',
      bottom: 20,
      left: 20,
      right: 20,
  },
  eventTitle: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 10
  },
  eventDate: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  upcomingContainer: {
    marginTop: 30,
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  upcomingTitle: {
    color: 'white',
    fontSize: 22,
    fontWeight: '700',
  },
  upcomingScroll: {
    paddingHorizontal: 20,
  },
  emptyUpcomingText: {
      color: '#666',
      fontSize: 14,
  },
  artistContainer: {
    marginRight: 16,
    width: screenWidth * 0.35, // Slightly smaller for better fit
  },
  artistImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    marginBottom: 10,
    backgroundColor: '#333'
  },
  artistTitle: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2
  },
  upcomingDateText: {
      color: '#ccc',
      fontSize: 12,
      fontWeight: 'bold'
  }
})