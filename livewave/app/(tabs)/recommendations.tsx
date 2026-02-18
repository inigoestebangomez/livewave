import { StyleSheet, Text, View, ScrollView, Image, Dimensions, RefreshControl, TouchableOpacity, Linking, FlatList } from 'react-native'
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import React, { useEffect, useState, useCallback } from 'react'
import { useUser } from '@supabase/auth-helpers-react'
import { supabase } from '../lib/supabase'
import { getEventsForArtist, getConcertRecommendations, Event } from '../lib/api'
import { Ionicons } from '@expo/vector-icons'

const screenWidth = Dimensions.get('window').width

export default function RecommendationsScreen() {
  const insets = useSafeAreaInsets()
  const user = useUser()
  
  useEffect(() => {
      console.log('🚀 [Recommendations] Component Mounted (New Version)');
  }, []);

  const [loading, setLoading] = useState(true)
  const [seedArtist, setSeedArtist] = useState<string | null>(null)
  const [recommendedEvents, setRecommendedEvents] = useState<Event[]>([])
  const [yourEvents, setYourEvents] = useState<Event[]>([])
  const [userCity, setUserCity] = useState<string | undefined>(undefined);
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
        // 1. Get User Location from Profile
        let locationCity: string | undefined = undefined;
        let userLatLong: string | undefined = undefined;
        let userRadius = 50; 

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('location, location_latitude, location_longitude, radius_km') // Correct column names
            .eq('id', user.id)
            .single()
        
        console.log(`👤 [Recommendations] User ID: ${user.id}`);
        // console.log(`👤 Profile:`, profile); // Reduce noise
        if (profileError) console.error(`❌ [Recommendations] Profile Fetch Error:`, profileError);
        
        if (profile) {
            if (profile.radius_km) {
                userRadius = profile.radius_km;
            }

            // Priority 1: Lat/Long (Most accurate)
            if (profile.location_latitude && profile.location_longitude) {
                userLatLong = `${profile.location_latitude},${profile.location_longitude}`;
                setUserCity('My Location'); // Fallback name for UI
                console.log(`📍 Using Coords: ${userLatLong} (Radius: ${userRadius}km)`);
            }
            
            // Priority 2: City String (if available in a text column, currently 'location' is hex so we likely skip this unless we add a specific city column)
            // For now, reverse geocoding on every load is expensive. We rely on LatLong.
        }

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
                // Manual mapping for common genres to popular artists for seeding
                if (randomGenre === 'rock') seedName = 'Muse'; // Changed to Muse as FF might be too generic
                else if (randomGenre === 'pop') seedName = 'Dua Lipa';
                else if (randomGenre === 'hip-hop') seedName = 'Kendrick Lamar';
                else if (randomGenre === 'electronic') seedName = 'Daft Punk';
                else if (randomGenre === 'metal') seedName = 'Metallica';
                else seedName = 'Coldplay'; 
            } else {
                 seedName = 'Coldplay'; // No data at all
            }
        }

        if (seedName) {
             setSeedArtist(seedName);
             console.log(`Getting Concert Recs for ${seedName} in ${locationCity || 'Anywhere'}`);
             
             // call new API using local variables to avoid stale state
             const response = await getConcertRecommendations(seedName, locationCity, userLatLong, userRadius);
             
             if (response && response.events) {
                 // Dedup: Create map by Event ID
                 const uniqueEventsMap = new Map();
                 response.events.forEach((item: Event) => {
                     // Check if an event with this ID exists
                     if (!uniqueEventsMap.has(item.id)) {
                         // Optional: Check if we already have an event for this artist on this date?
                         // For now, ID dedup is enough to stop exact duplicates.
                         uniqueEventsMap.set(item.id, item);
                     }
                 });
                 setRecommendedEvents(Array.from(uniqueEventsMap.values()));
             } else {
                 setRecommendedEvents([]);
             }
        }

    } catch (error) {
        console.error("Error loading data:", error)
    } finally {
        setLoading(false)
    }
  }, [user])

  useFocusEffect(
    useCallback(() => {
      console.log('🚀 [Recommendations] Screen Focused - Refreshing Data');
      fetchData();
    }, [fetchData])
  );

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
                <View style={{flex: 1}}>
                    <Text style={styles.sectionTitle}>Discover</Text>
                     {/* Debug / Info Location */}
                     {userCity && <Text style={{color:'#666', fontSize: 10}}>Near {userCity}</Text>}
                </View>
                <Text style={styles.sectionSubtitle}>
                    {seedArtist ? `Because you like ${seedArtist}` : 'Similar to your taste'}
                </Text>
            </View>
            
            {/* NEW: Vertical List for Better Visibility */}
            {recommendedEvents.length > 0 ? (
                <View style={{ paddingHorizontal: 15 }}>
                  {recommendedEvents.map((item) => (
                    <TouchableOpacity 
                        key={item.id} 
                        style={styles.verticalCard} 
                        onPress={() => openLink(item.url)}
                    >
                        <Image 
                            source={{ uri: item.image || 'https://via.placeholder.com/150' }} 
                            style={styles.verticalCardImage} 
                        />
                        <View style={styles.verticalCardContent}>
                            <Text style={styles.eventArtist}>{item.artistName}</Text>
                            <Text style={styles.eventDate}>
                                {new Date(item.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                            </Text>
                            <Text style={styles.eventVenue} numberOfLines={1}>{item.venue}, {item.city}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#666" />
                    </TouchableOpacity>
                  ))}
                </View>
            ) : (
                 <Text style={styles.emptyText}>
                    {seedArtist ? `No concerts found for similar artists.` : 'No recommendations found.'}
                 </Text>
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

  // Vertical Card
  verticalCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.05)',
      marginBottom: 10,
      borderRadius: 12,
      padding: 10,
  },
  verticalCardImage: {
      width: 60,
      height: 60,
      borderRadius: 8,
      marginRight: 15,
  },
  verticalCardContent: {
      flex: 1,
  },

  emptyText: {
    color: '#aaa',
    textAlign: 'center',
    marginTop: 50,
  }
})



