import React, { useState, useMemo } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ImageBackground,
  StyleSheet,
  ScrollView,
  Dimensions
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { supabase } from '../lib/supabase'
import slugify from 'slugify'

// import { LinearGradient } from 'expo-linear-gradient'

const screenWidth = Dimensions.get('window').width

export default function SearchScreen() {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [selectedArtist, setSelectedArtist] = useState<any | null>(null)
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedCountry, setSelectedCountry] = useState<string>('all')
  const [selectedCity, setSelectedCity] = useState<string>('all')

  const insets = useSafeAreaInsets()

  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      const venue = event._embedded?.venues?.[0]
      const country = venue?.country?.name || ''
      const city = venue?.city?.name || ''
      const countryMatch = selectedCountry === 'all' || country === selectedCountry
      const cityMatch = selectedCity === 'all' || city === selectedCity
      return countryMatch && cityMatch
    })
  }, [events, selectedCountry, selectedCity])

  const countries = useMemo(() => {
    const countrySet = new Set<string>()
    events.forEach(event => {
      const country = event._embedded?.venues?.[0]?.country?.name
      if (country) countrySet.add(country)
    })
    return Array.from(countrySet).sort()
  }, [events])

  const cities = useMemo(() => {
    const citySet = new Set<string>()
    events.forEach(event => {
      const venue = event._embedded?.venues?.[0]
      const country = venue?.country?.name || ''
      const city = venue?.city?.name || ''
      if ((selectedCountry === 'all' || country === selectedCountry) && city) {
        citySet.add(city)
      }
    })
    return Array.from(citySet).sort()
  }, [events, selectedCountry])

  const handleSearchChange = async (query: string) => {
    setQuery(query)
    if (query.length < 2) {
      setSuggestions([])
      return
    }
    try {
      const response = await fetch(`http://localhost:8082/suggest?keyword=${encodeURIComponent(query)}`)
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      const data = await response.json()
      setSuggestions(data?._embedded?.attractions || [])
    } catch (err) {
      console.error('Error fetching suggestions', err)
      setSuggestions([])
    }
  }

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  const fetchAllEvents = async (artistName: string) => {
    let allEvents: any[] = []
    let page = 0
    let hasMorePages = true
    const maxPages = 3
    const pageSize = 50
    const delayBetweenRequests = 500
    setLoading(true)
    try {
      while (hasMorePages && page < maxPages) {
        if (page > 0) await sleep(delayBetweenRequests)
        const response = await fetch(`http://localhost:8082/events?keyword=${encodeURIComponent(artistName)}&page=${page}&size=${pageSize}`)
        if (!response.ok) {
          if (response.status === 429) {
            await sleep(2000)
            const retryResponse = await fetch(`http://localhost:8082/events?keyword=${encodeURIComponent(artistName)}&page=${page}&size=${pageSize}`)
            if (!retryResponse.ok) break
            const retryData = await retryResponse.json()
            allEvents.push(...(retryData?._embedded?.events || []))
            page++
            hasMorePages = page < (retryData.page?.totalPages || 1) && page < maxPages
          } else {
            break
          }
        } else {
          const data = await response.json()
          allEvents.push(...(data?._embedded?.events || []))
          page++
          hasMorePages = page < (data.page?.totalPages || 1) && page < maxPages
        }
      }
      const deduped = Array.from(new Map(allEvents.map(e => [`${e.id}-${e.dates?.start?.localDate}`, e])).values())
      return deduped
    } catch (err) {
      console.error('Error fetching events', err)
      return allEvents
    } finally {
      setLoading(false)
    }
  }

  const selectArtist = async (artist: any) => {
    setSelectedArtist(artist)
    setSuggestions([])
    setQuery(artist.name)

    const allEvents = await fetchAllEvents(artist.name)
    setEvents(allEvents)
  }

  const addToCalendar = async (event: any) => {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    console.error('No se pudo obtener el usuario:', userError)
    return
  }

  const artistName = event._embedded?.attractions?.[0]?.name
  const artistSlug = slugify(artistName, { lower: true })

// Usa la imagen de selectedArtist si está disponible, si no, usa la del evento
const artistImages = selectedArtist?.images || event._embedded?.attractions?.[0]?.images || []
const sortedImages = artistImages.sort((a: any, b: any) => (b.width || 0) - (a.width || 0))
const imageUrl = sortedImages[0]?.url || ''

  // Upsert del artista con imagen incluida
  const { data: artist, error: artistError } = await supabase
    .from('artists')
    .upsert(
      {
        name: artistName,
        slug: artistSlug,
        image_url: imageUrl,
      },
      {
        onConflict: 'slug',
      }
    )
    .select()
    .single()

  if (artistError) {
    console.error('Error inserting artist:', artistError)
    return
  }

  // Crear o actualizar el evento
  const externalUrl = event.url || ''
  const date = event.dates?.start?.dateTime || event.dates?.start?.localDate
  const venue = event._embedded?.venues?.[0]?.name || ''
  const city = event._embedded?.venues?.[0]?.city?.name || ''
  const country = event._embedded?.venues?.[0]?.country?.name || ''

  const { data: newEvent, error: eventError } = await supabase
    .from('events')
    .upsert(
      {
        artist_id: artist.id,
        city,
        country,
        venue,
        date,
        external_url: externalUrl,
      },
      {
        onConflict: 'artist_id,date,venue',
      }
    )
    .select()
    .single()

  if (eventError) {
    console.error('Error inserting event:', eventError)
    return
  }

  // Asociar evento con el usuario
  const { error: relError } = await supabase
    .from('user_events')
    .upsert(
      { user_id: user.id, event_id: newEvent.id },
      { onConflict: 'user_id,event_id' }
    )

  if (relError) {
    console.error('Error saving to user_events:', relError)
  } else {
    console.log('✅ Evento añadido al calendario')
  }
}


  const clearSearch = () => {
    setQuery('')
    setSuggestions([])
    setSelectedArtist(null)
    setEvents([])
    setSelectedCountry('all')
    setSelectedCity('all')
  }

  return (
    <ImageBackground
      source={require('../../assets/images/Gemini_Generated_Image_d0p2vyd0p2vyd0p2.jpeg')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={[styles.overlay, { paddingTop: insets.top + 20 }]}>
        <View style={styles.searchContainer}>
          <TextInput
            placeholder="Search..."
            placeholderTextColor="#ccc"
            style={styles.input}
            value={query}
            onChangeText={handleSearchChange}
          />
          {(selectedArtist || query.length > 0) && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
              <Ionicons name="close-circle" size={30} color="#ccc" />
            </TouchableOpacity>
          )}
        </View>

        {!selectedArtist && suggestions.length > 0 && (
          <FlatList
            data={suggestions}
            keyExtractor={(item, index) => `${item.id}-${item.dates?.start?.localDate || index}`}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => selectArtist(item)} style={styles.suggestionItem}>
                <View style={styles.suggestionContent}>
                  {item.images?.[0]?.url && (
                    <Image 
                      source={{ uri: item.images[0].url }} 
                      style={styles.suggestionImage}
                    />
                  )}
                  <View>
                    <Text style={styles.suggestionText}>{item.name}</Text>
                    <Text style={styles.suggestionSubtext}>
                      {item.classifications?.[0]?.genre?.name || 'Artista'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
            style={styles.suggestionsList}
            contentContainerStyle={{paddingBottom: 120}}
          />
        )}

        {selectedArtist && (
          <View style={styles.eventsContainer}>
            <View style={styles.artistHeader}>
              <Image
                source={{ uri: selectedArtist?.images?.[0]?.url }}
                style={styles.artistImage}
                resizeMode="cover"
              />
              <Text style={styles.artistTitle}>{selectedArtist.name}</Text>
              {loading && (
                <Text style={styles.loadingText}>Loading events...</Text>
              )}
            </View>

            {events.length > 0 && (
              <View style={styles.filtersContainer}>
                <View style={styles.filterHeader}>
                  <Text style={styles.filtersTitle}>Filters</Text>
                  <Text style={styles.eventCount}>
                    {filteredEvents.length} of {events.length} events
                  </Text>
                </View>
                
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
                  <TouchableOpacity 
                    style={[styles.filterButton, selectedCountry === 'all' && styles.filterButtonActive]}
                    onPress={() => {
                      setSelectedCountry('all')
                      setSelectedCity('all')
                    }}
                  >
                    <Text style={[styles.filterText, selectedCountry === 'all' && styles.filterTextActive]}>
                      All countries
                    </Text>
                  </TouchableOpacity>
                  
                  {countries.map(country => (
                    <TouchableOpacity 
                      key={country}
                      style={[styles.filterButton, selectedCountry === country && styles.filterButtonActive]}
                      onPress={() => {
                        setSelectedCountry(country)
                        setSelectedCity('all')
                      }}
                    >
                      <Text style={[styles.filterText, selectedCountry === country && styles.filterTextActive]}>
                        {country}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {cities.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
                    <TouchableOpacity 
                      style={[styles.filterButton, selectedCity === 'all' && styles.filterButtonActive]}
                      onPress={() => setSelectedCity('all')}
                    >
                      <Text style={[styles.filterText, selectedCity === 'all' && styles.filterTextActive]}>
                        All cities
                      </Text>
                    </TouchableOpacity>
                    
                    {cities.map(city => (
                      <TouchableOpacity 
                        key={city}
                        style={[styles.filterButton, selectedCity === city && styles.filterButtonActive]}
                        onPress={() => setSelectedCity(city)}
                      >
                        <Text style={[styles.filterText, selectedCity === city && styles.filterTextActive]}>
                          {city}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}

            {filteredEvents.length > 0 ? (
              <FlatList
                data={filteredEvents}
                keyExtractor={(item, index) => `${item.id}-${item.dates?.start?.localDate || index}`}
                renderItem={({ item }) => (
                  <View style={styles.card}>
                    <View style={styles.cardContent}>
                      <Text style={styles.cardTitle}>{item.name}</Text>
                      <Text style={styles.cardSubtitle}>
                        {item.dates?.start?.localDate} - {item._embedded?.venues?.[0]?.name}
                      </Text>
                      <Text style={styles.cardLocation}>
                        {item._embedded?.venues?.[0]?.city?.name}, {item._embedded?.venues?.[0]?.country?.name}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.calendarButton}
                      onPress={() => addToCalendar(item)}>
                      <Ionicons name="calendar-outline" size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>
                )}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 120 }}
                style={styles.eventsList}
              />
              
            ) : !loading && selectedArtist && events.length > 0 ? (
              <View style={styles.noEventsContainer}>
                <Text style={styles.noEventsText}>
                  No events at this location
                </Text>
              </View>
            ) : !loading && selectedArtist ? (
              <View style={styles.noEventsContainer}>
                <Text style={styles.noEventsText}>
                  Ooops! {selectedArtist.name} has no upcoming shows...
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </View>
    </ImageBackground>
  )
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 20
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(24, 24, 24, 0.6)',
    color: '#fff',
    padding: 20,
    borderRadius: 30,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(34, 34, 34, 0.2)',
  },
  clearButton: {
    marginLeft: 10,
    padding: 5,
  },
  suggestionsList: {
    maxHeight: 500,
  },
  suggestionItem: {
    backgroundColor: 'rgba(24, 24, 24, 0.85)',
    padding: 15,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(34, 34, 34, 0.2)',
  },
  suggestionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  suggestionImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
  },
  suggestionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  suggestionSubtext: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 2,
  },
  artistHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  artistImage: {
    width: screenWidth * 0.9,
    height: 220,
    borderRadius: 10,
    marginBottom: 15,
  },
  artistTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  loadingText: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 10,
    fontStyle: 'italic',
  },
  card: {
    backgroundColor: 'rgba(24, 24, 24, 0.85)',
    padding: 20,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(34, 34, 34, 0.2)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  cardContent: {
    flex: 1,
    marginRight: 15,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  cardSubtitle: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 4,
  },
  cardLocation: {
    color: '#aaa',
    fontSize: 12,
  },
  calendarButton: {
    backgroundColor: '#b10404',
    padding: 12,
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },
  noEventsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noEventsText: {
    color: '#ccc',
    fontSize: 16,
    textAlign: 'center',
  },
  // gradientOverlay: {
  //   position: 'absolute',
  //   bottom: 0,
  //   left: 0,
  //   right: 0,
  //   height: 100,
  //   zIndex: 10,
  //   borderRadius: 30,
  // },
  eventsContainer: {
    flex: 1,
    marginBottom: 70
  },
  eventsList: {
    flex: 1,
  },
  filtersContainer: {
    marginBottom: 15,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  filtersTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  eventCount: {
    color: '#ccc',
    fontSize: 14,
  },
  filterRow: {
    marginBottom: 8,
  },
  filterButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  filterButtonActive: {
    backgroundColor: '#b10404',
    borderColor: '#b10404',
  },
  filterText: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
})