import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ImageBackground,
  StyleSheet
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'

export default function SearchScreen() {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [selectedArtist, setSelectedArtist] = useState<any | null>(null)
  const [events, setEvents] = useState<any[]>([])

  const handleSearchChange = async (query: string) => {
    setQuery(query)
    if (query.length < 2) {
      setSuggestions([])
      return
    }

    try {
    
      const response = await fetch(`http://localhost:8082/suggest?keyword=${encodeURIComponent(query)}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      const artists = data?._embedded?.attractions || []
      setSuggestions(artists)
    } catch (err) {
      console.error('Error fetching suggestions', err)
      setSuggestions([])
    }
  }

  const selectArtist = async (artist: any) => {
    setSelectedArtist(artist)
    setSuggestions([])
    setQuery(artist.name)

    try {
      const response = await fetch(`http://localhost:8082/events?keyword=${encodeURIComponent(artist.name)}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      const items = data?._embedded?.events || []
      setEvents(items)
    } catch (err) {
      console.error('Error fetching events', err)
      setEvents([])
    }
  }

  const addToCalendar = async (event: any) => {
    console.log('Guardar en calendario:', event.name)
    // Aquí irá integración con expo-calendar
  }

  const clearSearch = () => {
    setQuery('')
    setSuggestions([])
    setSelectedArtist(null)
    setEvents([])
  }

  return (
    <ImageBackground
      source={require('../../assets/images/Gemini_Generated_Image_d0p2vyd0p2vyd0p2.jpeg')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <View style={styles.searchContainer}>
          <TextInput
            placeholder="Busca artistas..."
            placeholderTextColor="#ccc"
            style={styles.input}
            value={query}
            onChangeText={handleSearchChange}
          />
          {(selectedArtist || query.length > 0) && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
              <Ionicons name="close-circle" size={24} color="#ccc" />
            </TouchableOpacity>
          )}
        </View>

        {!selectedArtist && suggestions.length > 0 && (
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.id}
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
          />
        )}

        {selectedArtist && (
          <>
            <View style={styles.artistHeader}>
              <Image
                source={{ uri: selectedArtist?.images?.[0]?.url }}
                style={styles.artistImage}
                resizeMode="cover"
              />
              <Text style={styles.artistTitle}>{selectedArtist.name}</Text>
            </View>

            {events.length > 0 ? (
              <FlatList
                data={events}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    <Text style={styles.cardSubtitle}>
                      {item.dates?.start?.localDate} - {item._embedded?.venues?.[0]?.name}
                    </Text>
                    <Text style={styles.cardLocation}>
                      {item._embedded?.venues?.[0]?.city?.name}, {item._embedded?.venues?.[0]?.country?.name}
                    </Text>
                    <TouchableOpacity
                      style={styles.calendarButton}
                      onPress={() => addToCalendar(item)}
                    >
                      <Ionicons name="calendar-outline" size={18} color="#fff" />
                      <Text style={styles.calendarText}>Guardar en calendario</Text>
                    </TouchableOpacity>
                  </View>
                )}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <View style={styles.noEventsContainer}>
                <Text style={styles.noEventsText}>
                  No se encontraron eventos para {selectedArtist.name}
                </Text>
              </View>
            )}
          </>
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
    paddingTop: 60,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#fff',
    padding: 15,
    borderRadius: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  clearButton: {
    marginLeft: 10,
    padding: 5,
  },
  suggestionsList: {
    maxHeight: 300,
  },
  suggestionItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 15,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  suggestionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  suggestionImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 15,
  },
  artistTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 20,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
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
    marginBottom: 12,
  },
  calendarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 8,
    justifyContent: 'center',
  },
  calendarText: {
    color: '#fff',
    marginLeft: 8,
    fontWeight: '600',
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
})