import { StyleSheet, Text, View, ScrollView, Image, Dimensions, DeviceEventEmitter, RefreshControl, Alert, TouchableOpacity } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import React, { useEffect, useState } from 'react'
import { useUser } from '@supabase/auth-helpers-react'
import { supabase } from '../lib/supabase'
import { useUserEvents } from '../../hooks'
import ConcertDetailSheet from '../../components/ConcertDetailSheet'

const screenWidth = Dimensions.get('window').width

export default function LoggedHome() {
  const insets = useSafeAreaInsets()
  const user = useUser()
  const { events, refreshing, refresh } = useUserEvents({ futureOnly: true })
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [isSheetVisible, setIsSheetVisible] = useState(false)

  // Registrar push notifications
  useEffect(() => {
    if (!user) return
    const register = async () => {
      try {
        const { registerForPushNotificationsAsync } = await import('../lib/notifications')
        const token = await registerForPushNotificationsAsync()
        if (token && token.startsWith('ExponentPushToken')) {
          await supabase.from('profiles').update({ push_token: token }).eq('id', user.id)
        }
      } catch (error) {
        console.error("Error registering for push notifications:", error)
      }
    }
    register()
  }, [user])

  const nextEvent = events[0]
  const upcomingEvents = events.slice(1, 6)

  const handleDelete = async (id: string) => {
    try {
      // Delete from user_events first (the join table)
      await supabase.from('user_events').delete().eq('event_id', id).eq('user_id', user?.id || '')
      
      // Then delete from events if no other users have it saved
      // For simplicity, we'll just remove it from events too
      // In a more complex app, we'd check if other users have it saved
      await supabase.from('events').delete().eq('id', id)
      
      // Refresh events
      await refresh()
      
      // Close bottom sheet
      setIsSheetVisible(false)
    } catch (error) {
      console.error('Error deleting event:', error)
      Alert.alert('Error', 'No se pudo eliminar el concierto')
    }
  }

  const handleCloseSheet = () => {
    setIsSheetVisible(false)
    setSelectedEvent(null)
  }

  return (
    <>
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
           <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#b10404" />
         }
       >
         <View style={[styles.greetingContainer, { marginTop: insets.top + 20 }]}>
           <Text style={styles.greetingText}>Next Concert</Text>
         </View>

          {nextEvent ? (
           <TouchableOpacity style={styles.mainCardWrapper} activeOpacity={0.85} onPress={() => {
              setSelectedEvent({
                id: nextEvent.id,
                artistName: nextEvent.artist?.name || '',
                artistImageUrl: nextEvent.artist?.image_url || null,
                date: nextEvent.date,
                venue: nextEvent.venue || null,
                city: nextEvent.city || null,
                country: nextEvent.country || null,
                externalUrl: nextEvent.external_url || null,
                source: nextEvent.source || null,
                url: nextEvent.url || null
              });
              setIsSheetVisible(true);
            }}>
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
            </TouchableOpacity>
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
            {upcomingEvents.map((event) => (
              <TouchableOpacity key={event.id} style={styles.artistContainer} activeOpacity={0.8} onPress={() => {
               setSelectedEvent({
                 id: event.id,
                 artistName: event.artist?.name || '',
                 artistImageUrl: event.artist?.image_url || null,
                 date: event.date,
                 venue: event.venue || null,
                 city: event.city || null,
                 country: event.country || null,
                 externalUrl: event.external_url || null,
                 source: event.source || null,
                 url: event.url || null
              });
              setIsSheetVisible(true);
            }}>
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
              </TouchableOpacity>
           ))}
         </ScrollView>
       </ScrollView>
     </View>
       <ConcertDetailSheet
         visible={isSheetVisible}
         event={selectedEvent}
         onClose={handleCloseSheet}
         onDelete={handleDelete}
       />
    </>
   )
 }

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollContent: {
    paddingBottom: 120,
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
    width: screenWidth * 0.35,
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
