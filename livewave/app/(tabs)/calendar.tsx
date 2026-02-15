import { supabase } from '../lib/supabase'
import { useEffect, useState, useCallback } from 'react'
import { Text, View, StyleSheet, DeviceEventEmitter, ScrollView, TouchableOpacity } from 'react-native'
import { useUser } from '@supabase/auth-helpers-react'
import { LinearGradient } from 'expo-linear-gradient'
import { Calendar, LocaleConfig } from 'react-native-calendars'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { addToNativeCalendar } from '../lib/calendar-export'
import { Platform } from 'react-native'

// ... imports remain the same

export default function CalendarScreen() {
  const user = useUser()
  const [markedDates, setMarkedDates] = useState({})
  const [loading, setLoading] = useState(false)
  const [agendaEvents, setAgendaEvents] = useState<any[]>([])

  const handleExport = async (event: any) => {
    await addToNativeCalendar(event);
  }

  const fetchUserEvents = useCallback(async () => {
    // ... (fetchUserEvents implementation remains the same)
    setLoading(true)
    if (!user) {
      setLoading(false)
      return
    }

    // 1. Obtener los event_id de user_events para el usuario
    const { data: userEvents, error: ueError } = await supabase
      .from('user_events')
      .select('event_id')
      .eq('user_id', user.id)

    if (ueError) {
      console.error('Error user_events:', ueError)
      setLoading(false)
      return
    }

    const eventIds = userEvents?.map((ue: any) => ue.event_id) || []

    if (eventIds.length === 0) {
      setMarkedDates({})
      setAgendaEvents([])
      setLoading(false)
      return
    }

    // 2. Obtener los eventos con esos IDs (ahora pedimos más campos)
    const { data: events, error: evError } = await supabase
      .from('events')
      .select('id,date,venue,city,country,artist_id,artist:artist_id(name),external_url')
      .in('id', eventIds)

    if (evError) {
      console.error('Error events:', evError)
      setLoading(false)
      return
    }

    // 3. Marcar las fechas en el calendario
    const marks: Record<string, any> = {}
    events.forEach((event: any) => {
      if (!event.date) return
      const date = new Date(event.date).toISOString().split('T')[0]
      marks[date] = {
        marked: true,
        dotColor: '#b10404',
        customStyles: {
          container: { backgroundColor: '#b10404', borderRadius: 10 },
          text: { color: 'white', fontWeight: 'bold' }
        }
      }
    })

    setMarkedDates(marks)
    setAgendaEvents(
      events
        .filter((e: any) => !!e.date)
        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
    )
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (user) fetchUserEvents()
  }, [user, fetchUserEvents])

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('refreshEvents', fetchUserEvents)
    return () => sub.remove()
  }, [fetchUserEvents])

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <LinearGradient
          colors={['#000000', '#b10404']}
          locations={[0.6, 1]}
          style={styles.safeArea}
        >
          <View style={styles.container}>
            <Calendar
              markingType={'custom'}
              markedDates={markedDates}
              theme={{
                backgroundColor: '#000',
                calendarBackground: '#000',
                textSectionTitleColor: '#fff',
                dayTextColor: '#fff',
                monthTextColor: '#fff',
                arrowColor: '#fff',
                todayTextColor: '#b10404',
                textDisabledColor: '#444',
              }}
              style={styles.calendar}
            />
            {agendaEvents.length === 0 && (
              <Text style={styles.noEvents}>No added shows</Text>
            )}
          <ScrollView contentContainerStyle={styles.scrollContent}
                      style={styles.scrollView}
                      showsVerticalScrollIndicator={false}>
            {agendaEvents.map((event: any) => (
              <View key={event.id} style={styles.agendaItem}>
                <View style={{flex: 1}}>
                  <Text style={styles.agendaDate}>
                    {new Date(event.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                  </Text>
                  <Text style={styles.agendaArtist}>{event.artist?.name || 'Unknown artist'}</Text>
                  <Text style={styles.agendaVenue}>
                    {event.venue} - {event.city}, {event.country}
                  </Text>
                </View>
                <TouchableOpacity 
                  onPress={() => handleExport(event)}
                  style={styles.exportButton}>
                  <Ionicons name="share-outline" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
        </LinearGradient>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    width: '100%',
    height: '100%',
    position: 'relative',
    resizeMode: 'cover',
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center'
  },
  calendar: {
    borderRadius: 10,
    overflow: 'hidden',
    marginLeft: 20,
    marginRight: 20,
    marginBottom: 20,
    marginTop: 30,
  },
  scrollView: {
    maxHeight: '48%',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  agendaTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 10,
    textAlign: 'center'
  },
  noEvents: {
    color: '#ccc',
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic'
  },
  agendaItem: {
    backgroundColor: 'rgba(24,24,24,0.85)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    marginHorizontal: 10,
    marginLeft: 20,
    marginRight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  exportButton: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    marginLeft: 10
  },
  agendaDate: {
    color: '#b10404',
    fontWeight: 'bold',
    fontSize: 16
  },
  agendaArtist: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  agendaVenue: {
    color: '#ccc',
    fontSize: 14
  }
})