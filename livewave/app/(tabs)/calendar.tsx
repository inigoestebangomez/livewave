import { supabase } from '../lib/supabase'
import { useState, useCallback, useEffect } from 'react'
import { Text, View, StyleSheet, DeviceEventEmitter, ScrollView, TouchableOpacity, Image, Animated, Platform, Share } from 'react-native'
import { useUser } from '@supabase/auth-helpers-react'
import { LinearGradient } from 'expo-linear-gradient'
import { Calendar } from 'react-native-calendars'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { addToNativeCalendar } from '../lib/calendar-export'
import { Swipeable } from 'react-native-gesture-handler'
import Toast from 'react-native-toast-message'
import { useUserEvents } from '../../hooks'
import type { EventWithArtist } from '../../types/supabase'

const EventCard = ({ event, onPress, onExport, onShare, onDelete }: {
  event: EventWithArtist
  onPress: (e: EventWithArtist) => void
  onExport: (e: EventWithArtist) => void
  onShare: (e: EventWithArtist) => void
  onDelete: (id: string) => void
}) => {
  const isPast = new Date(event.date).getTime() < new Date().setHours(0,0,0,0)

  const renderRightActions = (_progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    })

    return (
      <View style={styles.actionsContainer}>
        <TouchableOpacity onPress={() => onDelete(event.id)} style={[styles.actionButton, styles.deleteAction]}>
            <Animated.View style={{ transform: [{ scale }], alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="trash-outline" size={24} color="white" />
                <Text style={styles.deleteText}>Delete</Text>
            </Animated.View>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={[styles.eventCardWrapper, isPast && { opacity: 0.4 }]}>
        <Swipeable renderRightActions={renderRightActions} containerStyle={styles.swipeable}>
        <TouchableOpacity style={styles.agendaItem} onPress={() => onPress(event)} activeOpacity={0.7}>
            <Image 
                source={{ uri: event.artist?.image_url || 'https://via.placeholder.com/150' }} 
                style={styles.artistImage} 
            />
            <View style={styles.eventInfo}>
                <Text style={[styles.agendaDate, isPast && { color: '#888' }]}>
                    {new Date(event.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </Text>
                <Text style={styles.agendaArtist} numberOfLines={1}>{event.artist?.name || 'Unknown Artist'}</Text>
                <Text style={styles.agendaVenue} numberOfLines={1}>
                    {event.venue} • {event.city}
                </Text>
            </View>
            
            <View style={styles.cardActionsContainer}>
                <TouchableOpacity onPress={() => onExport(event)} style={styles.exportButton}>
                    <Ionicons name="calendar-outline" size={24} color={isPast ? "#666" : "#b10404"} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => onShare(event)} style={styles.exportButton}>
                    <Ionicons name={Platform.OS === 'ios' ? 'share-outline' : 'share-social-outline'} size={24} color={isPast ? "#666" : "#b10404"} />
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
        </Swipeable>
    </View>
  )
}

export default function CalendarScreen() {
  const user = useUser()
  const { events: agendaEvents, refresh } = useUserEvents()
  const [markedDates, setMarkedDates] = useState<Record<string, unknown>>({})
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined)

  const handleCardPress = (event: EventWithArtist) => {
    setSelectedDate(new Date(event.date).toISOString().split('T')[0])
  }

  const handleExport = async (event: EventWithArtist) => {
    await addToNativeCalendar(event)
  }

  const handleShare = async (event: EventWithArtist) => {
    try {
      const artistName = event.artist?.name || 'Unknown Artist'
      const dateStr = new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      const message = `Come see ${artistName} live on ${dateStr} at ${event.venue}, ${event.city}! 🎸`
      const url = event.external_url || 'https://livewave.app'
      
      await Share.share({
        message: Platform.OS === 'android' ? `${message}\n${url}` : message,
        url: Platform.OS === 'ios' ? url : undefined,
      })
    } catch (error: unknown) {
      if (error instanceof Error) console.error(error.message)
    }
  }

  const handleDelete = async (eventId: string) => {
    if (!user) return

    const { error } = await supabase
        .from('user_events')
        .delete()
        .eq('user_id', user.id)
        .eq('event_id', eventId)

    if (error) {
        console.error('Error deleting event:', error)
        Toast.show({ type: 'error', text1: 'Error', text2: 'Could not delete event' })
    } else {
        Toast.show({ type: 'success', text1: 'Event deleted' })
        DeviceEventEmitter.emit('refreshEvents')
        refresh()
    }
  }

  useEffect(() => {
    const marks: Record<string, unknown> = {}
    const todayStr = new Date().toISOString().split('T')[0]
    marks[todayStr] = {
      customStyles: {
        container: { backgroundColor: 'rgba(255, 255, 255, 0.15)', borderRadius: 8 },
        text: { color: 'white', fontWeight: 'bold' },
      }
    }

    agendaEvents.forEach((event) => {
      if (!event.date) return
      const eventDateObj = new Date(event.date)
      const todayObj = new Date()
      todayObj.setHours(0,0,0,0)
      const isPast = eventDateObj.getTime() < todayObj.getTime()
      const date = eventDateObj.toISOString().split('T')[0]
      const isSelected = date === selectedDate

      marks[date] = {
        marked: !isPast,
        dotColor: isSelected ? 'white' : '#b10404',
        customStyles: {
          container: { 
            backgroundColor: isSelected ? 'white' : (isPast ? 'transparent' : '#b10404'), 
            borderRadius: 8, 
            elevation: isPast ? 0 : 5,
            borderWidth: isPast ? 1 : 0,
            borderColor: isPast ? 'rgba(255,255,255,0.2)' : 'transparent',
            transform: isSelected ? [{ scale: 1.25 }] : []
          },
          text: { 
            color: isSelected ? '#b10404' : (isPast ? '#888' : 'white'), 
            fontWeight: 'bold' 
          }
        }
      }
    })

    setMarkedDates(marks)
  }, [agendaEvents, selectedDate])

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <LinearGradient
        colors={['#1a0000', '#000000']}
        locations={[0, 0.8]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.container}>
             <Text style={styles.headerTitle}>My Concerts</Text>
            
            <View style={styles.calendarContainer}>
                <Calendar
                key={selectedDate}
                current={selectedDate}
                markingType={'custom'}
                markedDates={markedDates as Record<string, { marked?: boolean; dotColor?: string; customStyles?: Record<string, unknown> }>}
                firstDay={1}
                theme={{
                    backgroundColor: 'transparent',
                    calendarBackground: 'transparent',
                    textSectionTitleColor: '#888',
                    selectedDayBackgroundColor: '#b10404',
                    selectedDayTextColor: '#ffffff',
                    todayTextColor: '#ffffff',
                    dayTextColor: '#ffffff',
                    textDisabledColor: '#333333',
                    dotColor: '#b10404',
                    selectedDotColor: '#ffffff',
                    arrowColor: '#ffffff',
                    monthTextColor: '#ffffff',
                    indicatorColor: '#b10404',
                    textDayFontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
                    textMonthFontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
                    textDayHeaderFontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
                    textDayFontWeight: '400',
                    textMonthFontWeight: 'bold',
                    textDayHeaderFontWeight: '600',
                    textDayFontSize: 15,
                    textMonthFontSize: 18,
                    textDayHeaderFontSize: 13
                }}
                style={styles.calendar}
                enableSwipeMonths={true}
                />
            </View>

            <View style={styles.divider} />

            {agendaEvents.length === 0 && (
              <View style={styles.emptyState}>
                  <Ionicons name="musical-notes-outline" size={48} color="#333" />
                  <Text style={styles.noEvents}>No concerts saved yet.</Text>
                  <Text style={styles.subNoEvents}>Explore recommendations to find shows!</Text>
              </View>
            )}

            <ScrollView 
                contentContainerStyle={styles.scrollContent}
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
            >
            {agendaEvents.map((event) => (
                <EventCard 
                    key={event.id} 
                    event={event} 
                    onPress={handleCardPress}
                    onExport={handleExport}
                    onShare={handleShare}
                    onDelete={handleDelete}
                />
            ))}
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: 'white', paddingHorizontal: 20, marginBottom: 15 },
  calendarContainer: { marginHorizontal: 15, borderRadius: 16, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  calendar: { paddingBottom: 5 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 15, marginHorizontal: 20 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 100, paddingHorizontal: 15 },
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 30, opacity: 0.7 },
  noEvents: { color: '#888', fontSize: 18, marginTop: 10, fontWeight: '600' },
  subNoEvents: { color: '#555', marginTop: 5 },
  eventCardWrapper: { marginBottom: 12 },
  swipeable: { borderRadius: 12, overflow: 'hidden' },
  agendaItem: { backgroundColor: 'rgba(30,30,30,0.6)', flexDirection: 'row', alignItems: 'center', padding: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  artistImage: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#333' },
  eventInfo: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  agendaDate: { color: '#b10404', fontWeight: '700', fontSize: 12, textTransform: 'uppercase', marginBottom: 2 },
  agendaArtist: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  agendaVenue: { color: '#999', fontSize: 13, marginTop: 2 },
  exportButton: { padding: 8 },
  cardActionsContainer: { flexDirection: 'row', alignItems: 'center' },
  actionsContainer: { flexDirection: 'row', width: 80, height: '100%' },
  actionButton: { justifyContent: 'center', alignItems: 'center', width: 80, height: '100%' },
  deleteAction: { backgroundColor: '#b10404' },
  deleteText: { color: 'white', fontSize: 10, fontWeight: 'bold', marginTop: 5 },
})
