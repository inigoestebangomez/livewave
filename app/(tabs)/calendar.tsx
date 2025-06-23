import { supabase } from '../lib/supabase'
import { useEffect, useState, useCallback } from 'react'
import { Text, View, StyleSheet, FlatList  } from 'react-native'
import { useUser } from '@supabase/auth-helpers-react'
import { LinearGradient } from 'expo-linear-gradient'
import { Calendar, LocaleConfig } from 'react-native-calendars'

LocaleConfig.locales['es'] = {
  monthNames: [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ],
  monthNamesShort: [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
  ],
  dayNames: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'],
  dayNamesShort: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
  today: 'Hoy',
  firstDay: 1
}
LocaleConfig.defaultLocale = 'es'

export default function CalendarScreen() {
  const user = useUser()
  const [markedDates, setMarkedDates] = useState({})
  const [loading, setLoading] = useState(false)

  const fetchUserEvents = useCallback(async () => {
    setLoading(true)
    type Event = {
      date: string
    }

    type UserEvent = {
      event_id: number
      events: Event[]
    }

    const { data, error } = await supabase
      .from('user_events')
      .select('event_id, events(*)')
      .eq('user_id', user?.id)

    if (error) {
      console.error(error)
      return
    }

    const marks: Record<string, any> = {}
    ;(data as UserEvent[]).forEach(d => {
 
      if (Array.isArray(d.events) && d.events.length > 0) {
        const date = new Date(d.events[0].date).toISOString().split('T')[0]
        marks[date] = {
          marked: true,
          dotColor: '#b10404',
          customStyles: {
            container: { backgroundColor: '#b10404', borderRadius: 10 },
            text: { color: 'white', fontWeight: 'bold' }
          }
        }
      }
    })

    setMarkedDates(marks)
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (user) fetchUserEvents()
  }, [user, fetchUserEvents])

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
            colors={['#000000', '#b10404']}
            locations={[0.6, 1]}
            style={StyleSheet.absoluteFill}/>
    <View style={styles.container}>
      <Text style={styles.title}>Calendario de conciertos</Text>
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
    </View>
  </View>
  )
}


const styles = StyleSheet.create({
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
    overflow: 'hidden'
  }
})