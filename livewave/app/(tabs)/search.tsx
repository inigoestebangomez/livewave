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
  Dimensions,
  Animated
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSearchArtist } from '../../hooks'

const screenWidth = Dimensions.get('window').width
const screenHeight = Dimensions.get('window').height

const normalizeCountry = (name: string): string => {
  const n = name.trim()
  if (['Spain', 'Espana', 'España'].includes(n)) return 'España'
  if (['Germany', 'Deutschland', 'Alemania'].includes(n)) return 'Deutschland'
  if (['France', 'Francia'].includes(n)) return 'France'
  return n
}

export default function SearchScreen() {
  const {
    query, suggestions, selectedArtist, events, loading, showAdded,
    handleSearchChange, selectArtist, addToCalendar, clearSearch,
  } = useSearchArtist()

  const [isFocused, setIsFocused] = useState(false)
  const [selectedCountry, setSelectedCountry] = useState('all')
  const [selectedCity, setSelectedCity] = useState('all')
  const insets = useSafeAreaInsets()

  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      const venue = event._embedded?.venues?.[0]
      const country = normalizeCountry(venue?.country?.name || '')
      const city = venue?.city?.name || ''
      const countryMatch = selectedCountry === 'all' || country === selectedCountry
      const cityMatch = selectedCity === 'all' || city === selectedCity
      return countryMatch && cityMatch
    })
  }, [events, selectedCountry, selectedCity])

  const countries = useMemo(() => {
    const countrySet = new Set<string>()
    events.forEach(event => {
      const raw = event._embedded?.venues?.[0]?.country?.name
      if (raw) countrySet.add(normalizeCountry(raw))
    })
    return Array.from(countrySet).sort()
  }, [events])

  const cities = useMemo(() => {
    const citySet = new Set<string>()
    events.forEach(event => {
      const venue = event._embedded?.venues?.[0]
      const country = normalizeCountry(venue?.country?.name || '')
      const city = venue?.city?.name || ''
      if ((selectedCountry === 'all' || country === selectedCountry) && city) {
        citySet.add(city)
      }
    })
    return Array.from(citySet).sort()
  }, [events, selectedCountry])

  const onClearSearch = () => {
    clearSearch()
    setSelectedCountry('all')
    setSelectedCity('all')
  }

  const scrollY = React.useRef(new Animated.Value(0)).current
  const searchAnim = React.useRef(new Animated.Value(0)).current

  React.useEffect(() => {
    Animated.spring(searchAnim, {
      toValue: (isFocused || query.length > 0 || selectedArtist) ? 1 : 0,
      useNativeDriver: true,
      bounciness: 4,
    }).start()
  }, [isFocused, query, selectedArtist])

  const searchTranslateY = searchAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [screenHeight * 0.3, 0]
  })

  const headerHeight = 220
  const minHeaderHeight = 80

  const imageScale = scrollY.interpolate({
    inputRange: [-headerHeight, 0, headerHeight],
    outputRange: [1.5, 1, 0.3],
    extrapolate: 'clamp'
  })

  const imageTranslateY = scrollY.interpolate({
    inputRange: [-headerHeight, 0, headerHeight],
    outputRange: [0, 0, -headerHeight/2],
    extrapolate: 'clamp'
  })

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, headerHeight - minHeaderHeight],
    outputRange: [1, 0],
    extrapolate: 'clamp'
  })

  const renderHeader = () => (
    <Animated.View style={[styles.artistHeader, { 
        opacity: headerOpacity,
        transform: [{ translateY: imageTranslateY }, { scale: imageScale }] 
    }]}>
        <Image
          source={{ uri: selectedArtist?.images?.[0]?.url }}
          style={styles.artistImage}
          resizeMode="cover"
        />
        <Text style={styles.artistTitle}>{selectedArtist?.name}</Text>
        {loading && <Text style={styles.loadingText}>Loading events...</Text>}
    </Animated.View>
  )

  const renderFilters = () => (
    <View style={styles.filtersContainer}>
      <View style={styles.filterHeader}>
        <Text style={styles.filtersTitle}>Filters</Text>
        <Text style={styles.eventCount}>{filteredEvents.length} of {events.length} events</Text>
      </View>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        <TouchableOpacity 
          style={[styles.filterButton, selectedCountry === 'all' && styles.filterButtonActive]}
          onPress={() => { setSelectedCountry('all'); setSelectedCity('all') }}
        >
          <Text style={[styles.filterText, selectedCountry === 'all' && styles.filterTextActive]}>All countries</Text>
        </TouchableOpacity>
        {countries.map(country => (
          <TouchableOpacity 
            key={country}
            style={[styles.filterButton, selectedCountry === country && styles.filterButtonActive]}
            onPress={() => { setSelectedCountry(country); setSelectedCity('all') }}
          >
            <Text style={[styles.filterText, selectedCountry === country && styles.filterTextActive]}>{country}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {cities.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          <TouchableOpacity 
            style={[styles.filterButton, selectedCity === 'all' && styles.filterButtonActive]}
            onPress={() => setSelectedCity('all')}
          >
            <Text style={[styles.filterText, selectedCity === 'all' && styles.filterTextActive]}>All cities</Text>
          </TouchableOpacity>
          {cities.map(city => (
            <TouchableOpacity 
              key={city}
              style={[styles.filterButton, selectedCity === city && styles.filterButtonActive]}
              onPress={() => setSelectedCity(city)}
            >
              <Text style={[styles.filterText, selectedCity === city && styles.filterTextActive]}>{city}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  )

  return (
    <ImageBackground
      source={require('../../assets/images/Gemini_Generated_Image_d0p2vyd0p2vyd0p2.jpeg')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={[styles.overlay, { paddingTop: insets.top + 20 }]}>
        <Animated.View style={[styles.searchContainer, { transform: [{ translateY: searchTranslateY }] }]}>
          <TextInput
            placeholder="Search..."
            placeholderTextColor="#ccc"
            style={styles.input}
            value={query}
            onChangeText={handleSearchChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />
          {(selectedArtist || query.length > 0) && (
            <TouchableOpacity onPress={onClearSearch} style={styles.clearButton}>
              <Ionicons name="close-circle" size={30} color="#ccc" />
            </TouchableOpacity>
          )}
        </Animated.View>

        {!selectedArtist && suggestions.length > 0 && (
          <FlatList
            data={suggestions}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => selectArtist(item)} style={styles.suggestionItem}>
                <View style={styles.suggestionContent}>
                  {item.images?.[0]?.url && (
                    <Image source={{ uri: item.images[0].url }} style={styles.suggestionImage} />
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
          <Animated.FlatList
            data={filteredEvents}
            keyExtractor={(item, index) => `${item.id}-${item.dates?.start?.localDate || index}`}
            ListHeaderComponent={() => (
              <View>
                  {renderHeader()}
                  {events.length > 0 && renderFilters()}
                  {!loading && filteredEvents.length === 0 && (
                    <View style={styles.noEventsContainer}>
                      <Text style={styles.noEventsText}>
                        {events.length > 0 ? "No events at this location" : `Ooops! ${selectedArtist.name} has no upcoming shows...`}
                      </Text>
                    </View>
                  )}
              </View>
            )}
            contentContainerStyle={{ paddingBottom: 120, paddingTop: 0 }}
            scrollEventThrottle={16}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: false }
            )}
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
                <TouchableOpacity style={styles.calendarButton} onPress={() => addToCalendar(item)}>
                  <Ionicons name="calendar-outline" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
          />
        )}
      </View>

      {showAdded && (
        <View style={styles.addedShowContainer}>
          <Text style={styles.addedShow}>Show added!</Text>
        </View>
      )}
    </ImageBackground>
  )
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', padding: 20 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 30, marginTop: 20 },
  input: { flex: 1, backgroundColor: 'rgba(24, 24, 24, 0.6)', color: '#fff', padding: 20, borderRadius: 30, fontSize: 16, borderWidth: 1, borderColor: 'rgba(34, 34, 34, 0.2)' },
  clearButton: { marginLeft: 10, padding: 5 },
  suggestionsList: { maxHeight: 500 },
  suggestionItem: { backgroundColor: 'rgba(24, 24, 24, 0.85)', padding: 15, marginBottom: 8, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(34, 34, 34, 0.2)' },
  suggestionContent: { flexDirection: 'row', alignItems: 'center' },
  suggestionImage: { width: 60, height: 60, borderRadius: 30, marginRight: 12 },
  suggestionText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  suggestionSubtext: { color: '#ccc', fontSize: 14, marginTop: 2 },
  artistHeader: { alignItems: 'center', marginBottom: 20 },
  artistImage: { width: screenWidth * 0.9, height: 220, borderRadius: 10, marginBottom: 15 },
  artistTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold', textAlign: 'center' },
  loadingText: { color: '#ccc', fontSize: 14, marginTop: 10, fontStyle: 'italic' },
  card: { backgroundColor: 'rgba(24, 24, 24, 0.85)', padding: 20, marginBottom: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(34, 34, 34, 0.2)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  cardContent: { flex: 1, marginRight: 15 },
  cardTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  cardSubtitle: { color: '#ccc', fontSize: 14, marginBottom: 4 },
  cardLocation: { color: '#aaa', fontSize: 12 },
  calendarButton: { backgroundColor: '#b10404', padding: 12, width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end' },
  noEventsContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  noEventsText: { color: '#ccc', fontSize: 16, textAlign: 'center' },
  filtersContainer: { marginBottom: 15 },
  filterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  filtersTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  eventCount: { color: '#ccc', fontSize: 14 },
  filterRow: { marginBottom: 8 },
  filterButton: { backgroundColor: 'rgba(255, 255, 255, 0.1)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)' },
  filterButtonActive: { backgroundColor: '#b10404', borderColor: '#b10404' },
  filterText: { color: '#ccc', fontSize: 14, fontWeight: '500' },
  filterTextActive: { color: '#fff', fontWeight: '600' },
  addedShowContainer: { position: 'absolute', bottom: 140, left: 0, right: 0, zIndex: 100, alignItems: 'center' },
  addedShow: { backgroundColor: '#b10404', color: '#fff', padding: 12, borderRadius: 20, fontWeight: 'bold', fontSize: 16 },
})
