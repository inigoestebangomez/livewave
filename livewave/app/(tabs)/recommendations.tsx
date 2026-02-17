import { StyleSheet, Text, View, ScrollView, Image, Dimensions, RefreshControl, TouchableOpacity, Linking, FlatList } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import React, { useEffect, useState, useCallback } from 'react'
import { useUser } from '@supabase/auth-helpers-react'
import { supabase } from '../lib/supabase'
import { getRecommendations, getEventsForArtist, RecommendationResponse, Event } from '../lib/api'
import { Ionicons } from '@expo/vector-icons'

const screenWidth = Dimensions.get('window').width

export default function RecommendationsScreen() {
  const insets = useSafeAreaInsets()
  const user = useUser()
  const [loading, setLoading] = useState(true)
  const [recommendations, setRecommendations] = useState<RecommendationResponse | null>(null)
  const [yourEvents, setYourEvents] = useState<Event[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    if (!user) {
      setLoading(false)
      return
    }

    try {
        // A. GET FOLLOWED ARTISTS & EVENTS (Your Artists)
        const { data: follows } = await supabase
            .from('user_follows')
            .select('artist:artists(name)')
            .eq('user_id', user.id)
            .limit(50) // Fetch more to get variety
        
        const allFollowedNames = follows?.map((f: any) => f.artist?.name).filter(Boolean) || []
        
        // Pick 5 random artists to check for events (to avoid spamming API)
        const namesForEvents = allFollowedNames.sort(() => 0.5 - Math.random()).slice(0, 5)
        
        let allYourEvents: Event[] = []

        // Fetch events for each followed artist (parallel)
        if (namesForEvents.length > 0) {
            const promises = namesForEvents.map(name => getEventsForArtist(name))
            const results = await Promise.all(promises)
            const eventsFlat = results.flat().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            // Dedup events by ID
            allYourEvents = Array.from(new Map(eventsFlat.map(item => [item.id, item])).values())
        }
        setYourEvents(allYourEvents)


        // B. GET RECOMMENDATIONS (Discover)
        let seedName: string | null = null;
        
        // 1. Try to use a random followed artist as seed
        if (allFollowedNames.length > 0) {
            seedName = allFollowedNames[Math.floor(Math.random() * allFollowedNames.length)]
        } 
        
        // 2. Fallback to user events if no follows
        if (!seedName) {
              const { data: userEvents } = await supabase
                .from('user_events')
                .select('event_id')
                .eq('user_id', user.id)
                .limit(5)
              
              if (userEvents && userEvents.length > 0) {
                 const eventIds = userEvents.map((ue: any) => ue.event_id)
                 const { data: eventsData } = await supabase
                    .from('events')
                    .select('artist:artist_id(name)')
                    .in('id', eventIds)
                    .limit(5)
                 
                 // Pick random event artist
                 if (eventsData && eventsData.length > 0) {
                      const randomEvent = eventsData[Math.floor(Math.random() * eventsData.length)]
                      if (randomEvent.artist && !Array.isArray(randomEvent.artist)) {
                          seedName = (randomEvent.artist as any).name
                      }
                 }
              }
        }

        // 3. Fallback to User Genres
        if (!seedName) {
            const { data: userGenres } = await supabase
                .from('user_genres')
                .select('genre')
                .eq('user_id', user.id)
            
            if (userGenres && userGenres.length > 0) {
                const randomGenre = userGenres[Math.floor(Math.random() * userGenres.length)].genre
                // We need to find an artist for this genre to use as seed. 
                // For now, let's use a mapping or a generic search if possible.
                // Simpler hack: Use a popular artist for that genre (hardcoded list for now or search API)
                // Let's rely on api.ts to handle "Genre" seeds if we modify it, or just pick a safe fallback based on genre.
                if (randomGenre === 'rock') seedName = 'Foo Fighters';
                else if (randomGenre === 'pop') seedName = 'Dua Lipa';
                else if (randomGenre === 'hip-hop') seedName = 'Kendrick Lamar';
                else if (randomGenre === 'electronic') seedName = 'Daft Punk';
                else if (randomGenre === 'metal') seedName = 'Metallica';
                else seedName = 'Coldplay'; // Ultimate fallback if gender unknown
            } else {
                 seedName = 'Coldplay'; // No data at all
            }
        }

        if (seedName) {
             const recs = await getRecommendations(seedName);
             setRecommendations(recs);
        }

    } catch (error) {
        console.error("Error loading data:", error)
    } finally {
        setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchData()
  }, [user, fetchData])

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const openLink = (url?: string) => {
    if (url) Linking.openURL(url);
  };

  const renderEventCard = ({ item }: { item: Event }) => (
    <TouchableOpacity style={styles.eventCard} onPress={() => openLink(item.url)}>
        <Image 
            source={{ uri: item.image || 'https://via.placeholder.com/150' }} 
            style={styles.eventImage} 
        />
        <View style={styles.eventOverlay}>
            <Text style={styles.eventArtist}>{item.artistName}</Text>
            <Text style={styles.eventDate}>
                {new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </Text>
            <Text style={styles.eventVenue} numberOfLines={1}>{item.venue}, {item.city}</Text>
        </View>
    </TouchableOpacity>
  )

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={['#000000', '#b10404']}
        locations={[0.6, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, { marginTop: insets.top + 20 }]}>
        <Text style={styles.title}>For You</Text>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#b10404" />
        }
      >
        {/* SECTION: YOUR ARTISTS' CONCERTS */}
        {yourEvents.length > 0 && (
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Ionicons name="heart" size={18} color="#b10404" />
                    <Text style={styles.sectionTitle}>Your Artists On Tour</Text>
                </View>
                <FlatList
                    data={yourEvents}
                    horizontal
                    renderItem={renderEventCard}
                    keyExtractor={(item) => item.id}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 5 }}
                />
            </View>
        )}

        {/* SECTION: DISCOVER */}
        <View style={styles.section}>
            <View style={styles.sectionHeader}>
                <Ionicons name="compass" size={18} color="#b10404" />
                <Text style={styles.sectionTitle}>Discover</Text>
                <Text style={styles.sectionSubtitle}>
                    {recommendations ? `Because you like ${recommendations.seed}` : 'Similar to your taste'}
                </Text>
            </View>
            
            <View style={styles.grid}>
                {recommendations?.recommendations.map((artist) => (
                    <TouchableOpacity 
                        key={artist.id} 
                        style={styles.card}
                        onPress={() => openLink(artist.external_url)}
                    >
                        <Image
                            source={{ uri: artist.image || 'https://via.placeholder.com/300x300?text=Artist' }}
                            style={styles.artistImage}
                        />
                        <Text style={styles.artistName} numberOfLines={1}>{artist.name}</Text>
                        {artist.genres && artist.genres.length > 0 && (
                            <Text style={styles.genreText} numberOfLines={1}>{artist.genres[0]}</Text>
                        )}
                    </TouchableOpacity>
                ))}
            </View>
             {(!recommendations || recommendations.recommendations.length === 0) && !loading && (
                 <Text style={styles.emptyText}>No recommendations found.</Text>
            )}
        </View>

      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  title: {
    color: 'white',
    fontSize: 34,
    fontWeight: 'bold',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  section: {
    marginBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15,
    gap: 8,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  sectionSubtitle: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 'auto', 
    fontStyle: 'italic',
  },
  // Horizontal Event Card
  eventCard: {
    width: 200,
    height: 140,
    marginRight: 15,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  eventImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    opacity: 0.6,
  },
  eventOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  eventArtist: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  eventDate: {
    color: '#b10404',
    fontSize: 14,
    fontWeight: '600',
  },
  eventVenue: {
    color: '#ccc',
    fontSize: 12,
  },
  // Discover Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
  },
  card: {
    width: (screenWidth - 45) / 2, 
    marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 10,
    alignItems: 'center',
  },
  artistImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    marginBottom: 10,
  },
  artistName: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 4,
  },
  genreText: {
    color: '#aaa',
    fontSize: 12,
    textAlign: 'center',
  },
  emptyText: {
    color: '#aaa',
    textAlign: 'center',
    marginTop: 50,
  }
})
