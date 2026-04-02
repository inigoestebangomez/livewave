import { StyleSheet, Text, View, ScrollView, Image, Dimensions, RefreshControl, TouchableOpacity, Linking, FlatList } from 'react-native'
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import React, { useEffect, useState, useCallback } from 'react'
import { useUser } from '@supabase/auth-helpers-react'
import { supabase } from '../lib/supabase'
import { getEventsForArtist, getConcertRecommendations, getDiscoverArtists, Event, DiscoverArtist } from '../lib/api'
import { Ionicons } from '@expo/vector-icons'

const screenWidth = Dimensions.get('window').width

// Derive a human-readable city label from GPS coordinates using known bounding boxes.
// Falls back to "Near you" if the location is unknown.
const getCityLabel = (lat: number, lng: number): string => {
  // Spain
  if (lat > 41.2 && lat < 41.6 && lng > 1.9 && lng < 2.4) return 'Barcelona';
  if (lat > 40.2 && lat < 40.7 && lng > -3.9 && lng < -3.4) return 'Madrid';
  if (lat > 37.3 && lat < 37.5 && lng > -6.1 && lng < -5.8) return 'Sevilla';
  if (lat > 39.3 && lat < 39.6 && lng > -0.5 && lng < -0.2) return 'Valencia';
  if (lat > 43.2 && lat < 43.4 && lng > -2.9 && lng < -2.7) return 'Bilbao';
  if (lat > 36.6 && lat < 36.9 && lng > -4.6 && lng < -4.3) return 'Málaga';
  if (lat > 41.6 && lat < 41.8 && lng > 2.7 && lng < 3.0) return 'Girona';
  // Spain generic
  if (lat > 36.0 && lat < 44.0 && lng > -9.5 && lng < 4.5) return 'España';
  // Europe
  if (lat > 48.7 && lat < 48.95 && lng > 2.2 && lng < 2.5) return 'Paris';
  if (lat > 51.4 && lat < 51.6 && lng > -0.2 && lng < 0.1) return 'London';
  if (lat > 52.4 && lat < 52.6 && lng > 13.2 && lng < 13.6) return 'Berlin';
  return 'Near you';
};

export default function RecommendationsScreen() {
  const insets = useSafeAreaInsets()
  const user = useUser()
  
  useEffect(() => {
      console.log('🚀 [Recommendations] Component Mounted (Festival Engine v2)');
  }, []);

  const [loading, setLoading] = useState(true)
  const [seedArtist, setSeedArtist] = useState<string | null>(null)
  const [recommendedEvents, setRecommendedEvents] = useState<Event[]>([])
  const [yourEvents, setYourEvents] = useState<Event[]>([])
  const [trendingArtists, setTrendingArtists] = useState<DiscoverArtist[]>([])
  const [userCity, setUserCity] = useState<string | undefined>(undefined);
  const [userGenreSlugs, setUserGenreSlugs] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    if (!user) {
      setLoading(false)
      return
    }

    try {
        // 0. GET USER GENRES (needed for festival engine)
        const { data: userGenresData } = await supabase
            .from('user_genres')
            .select('genres(slug)')
            .eq('user_id', user.id)
        
        const genreSlugs = userGenresData?.map((ug: any) => ug.genres?.slug).filter(Boolean) || [];
        setUserGenreSlugs(genreSlugs);
        console.log(`🎵 [Recommendations] User Genres: ${genreSlugs.join(', ')}`);

        let locationCity: string | undefined = undefined;
        let userLatLong: string | undefined = undefined;
        let userRadius = 50; 

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('location, location_latitude, location_longitude, radius_km')
            .eq('id', user.id)
            .single()
        
        if (profileError) console.error(`❌ [Recommendations] Profile Fetch Error:`, profileError);
        
        if (profile) {
            if (profile.radius_km) userRadius = profile.radius_km;
            // profile.location is a PostGIS WKB binary blob — never use it for display or filtering.
            // Use only the parsed lat/lng columns.
            if (profile.location_latitude && profile.location_longitude) {
                userLatLong = `${profile.location_latitude},${profile.location_longitude}`;
                // Derive a human-readable label from coordinates
                // Barcelona area: lat ~41.4, lng ~2.18
                const lat = parseFloat(profile.location_latitude);
                const lng = parseFloat(profile.location_longitude);
                const label = getCityLabel(lat, lng);
                setUserCity(label);
            }
        }

        // A. GET FOLLOWED ARTISTS & EVENTS (Your Artists)
        const { data: follows } = await supabase
            .from('user_follows')
            .select('artist:artists(name)')
            .eq('user_id', user.id)
            .limit(50)
        
        const allFollowedNames = follows?.map((f: any) => f.artist?.name).filter(Boolean) || []
        
        // Pick 15 random artists to check for events to maximize the chances of finding nearby tours
        const namesForEvents = allFollowedNames.sort(() => 0.5 - Math.random()).slice(0, 15)
        
        let allYourEvents: Event[] = []

        if (namesForEvents.length > 0) {
            const promises = namesForEvents.map(name => getEventsForArtist(name, userLatLong, 2000))
            const results = await Promise.all(promises)
            const eventsFlat = results.flat().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            allYourEvents = Array.from(new Map(eventsFlat.map(item => [item.id, item])).values())
        }
        setYourEvents(allYourEvents)

        let seedName: string | null = null;
        
        // 1. Try to use a random followed artist as seed
        if (allFollowedNames.length > 0) {
            seedName = allFollowedNames[Math.floor(Math.random() * allFollowedNames.length)]
        } 
        
        // 2. Fallback to user events
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
            if (genreSlugs.length > 0) {
                const randomGenre = genreSlugs[Math.floor(Math.random() * genreSlugs.length)]
                if (randomGenre === 'rock') seedName = 'Muse';
                else if (randomGenre === 'pop') seedName = 'Dua Lipa';
                else if (randomGenre === 'hip-hop') seedName = 'Kendrick Lamar';
                else if (randomGenre === 'electronic') seedName = 'Daft Punk';
                else if (randomGenre === 'metal') seedName = 'Metallica';
                else if (randomGenre === 'indie') seedName = 'Tame Impala';
                else if (randomGenre === 'techno') seedName = 'Amelie Lens';
                else seedName = 'Coldplay'; 
            } else {
                 seedName = 'Coldplay';
            }
        }

        // C. FETCH CONCERT RECOMMENDATIONS (merged: TM + Festival)
        if (seedName) {
             setSeedArtist(seedName);
             console.log(`🎯 Getting Concert Recs for ${seedName} with genres: ${genreSlugs.join(',')}`);
             
             const response = await getConcertRecommendations(seedName, locationCity, userLatLong, userRadius, genreSlugs);
             
             if (response && response.events && response.events.length > 0) {
                 const uniqueEventsMap = new Map();
                 response.events.forEach((item: Event) => {
                     if (!uniqueEventsMap.has(item.artistName)) {
                         uniqueEventsMap.set(item.artistName, item);
                     }
                 });
                 setRecommendedEvents(Array.from(uniqueEventsMap.values()));
                 if (response.sources) {
                     console.log(`📊 Sources: TM=${response.sources.ticketmaster}, Festival=${response.sources.festival}`);
                 }
             } else {
                 setRecommendedEvents([]);
             }
        }

        // D. FETCH TRENDING ARTISTS (festival-discovery engine)
        if (genreSlugs.length > 0) {
            const discovered = await getDiscoverArtists(genreSlugs, userLatLong, userRadius);
            setTrendingArtists(discovered.slice(0, 15));
            console.log(`🎪 [Recommendations] Trending Artists: ${discovered.length}`);
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

  // Source badge color
  const getSourceColor = (source?: string) => {
    switch(source) {
      case 'festival': return '#e67e22';
      case 'spotify': return '#1DB954';
      default: return '#2d8cf0';
    }
  };

  const getSourceLabel = (source?: string) => {
    switch(source) {
      case 'festival': return 'Festival';
      case 'spotify': return 'Spotify';
      default: return 'Live';
    }
  };

  const renderEventCard = ({ item }: { item: Event }) => (
    <TouchableOpacity style={styles.eventCard} onPress={() => openLink(item.url)}>
        <Image 
            source={{ uri: item.image || 'https://via.placeholder.com/150' }} 
            style={styles.eventImage} 
        />
        <View style={styles.eventOverlay}>
            {item.source && item.source !== 'ticketmaster' && (
              <View style={[styles.sourceBadge, { backgroundColor: getSourceColor(item.source) }]}>
                <Text style={styles.sourceBadgeText}>{getSourceLabel(item.source)}</Text>
              </View>
            )}
            <Text style={styles.eventArtist}>{item.artistName}</Text>
            {item.date && (
              <Text style={styles.eventDate}>
                  {new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </Text>
            )}
            <Text style={styles.eventVenue} numberOfLines={1}>{item.venue}{item.city ? `, ${item.city}` : ''}</Text>
        </View>
    </TouchableOpacity>
  )

  const renderTrendingCard = ({ item }: { item: DiscoverArtist }) => (
    <TouchableOpacity style={styles.trendingCard} onPress={() => openLink(item.url)}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.trendingImage} />
        ) : (
          <View style={[styles.trendingImage, styles.trendingPlaceholder]}>
            <Ionicons name="musical-note" size={24} color="#b10404" />
          </View>
        )}
        <Text style={styles.trendingName} numberOfLines={1}>{item.artistName || item.name}</Text>
        <View style={styles.trendingMeta}>
          <View style={[styles.sourceTag, { backgroundColor: getSourceColor(item.source) }]}>
            <Text style={styles.sourceTagText}>{getSourceLabel(item.source)}</Text>
          </View>
          {item.genre && <Text style={styles.trendingGenre} numberOfLines={1}>{item.genre}</Text>}
        </View>
        {item.venue && <Text style={styles.trendingVenue} numberOfLines={1}>{item.venue}</Text>}
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

        {/* SECTION: TRENDING IN YOUR GENRES (Festival + Spotify Discovery) */}
        {trendingArtists.length > 0 && (
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Ionicons name="trending-up" size={18} color="#e67e22" />
                    <View style={{flex: 1}}>
                        <Text style={styles.sectionTitle}>Trending in Your Genres</Text>
                        <Text style={{color:'#888', fontSize: 11, marginTop: 2}}>
                            From {trendingArtists.filter(a => a.source === 'festival').length} festivals + Spotify
                        </Text>
                    </View>
                </View>
                <FlatList
                    data={trendingArtists}
                    horizontal
                    renderItem={renderTrendingCard}
                    keyExtractor={(item) => item.id}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 15 }}
                />
            </View>
        )}

        {/* SECTION: DISCOVER (Merged: TM + Festival) */}
        <View style={styles.section}>
            <View style={styles.sectionHeader}>
                <Ionicons name="compass" size={18} color="#b10404" />
                <View style={{flex: 1}}>
                    <Text style={styles.sectionTitle}>Discover</Text>
                     {userCity && <Text style={{color:'#666', fontSize: 10}}>Near {userCity}</Text>}
                </View>
                <Text style={styles.sectionSubtitle}>
                    {seedArtist ? `Inspired by ${seedArtist}` : 'Similar to your taste'}
                </Text>
            </View>
            
            {recommendedEvents.length > 0 ? (
                <View style={{ paddingHorizontal: 15 }}>
                  {recommendedEvents.map((item) => (
                    <TouchableOpacity 
                        key={item.id} 
                        style={styles.verticalCard} 
                        onPress={() => openLink(item.url)}
                    >
                        {item.image ? (
                          <Image 
                              source={{ uri: item.image }} 
                              style={styles.verticalCardImage} 
                          />
                        ) : (
                          <View style={[styles.verticalCardImage, { backgroundColor: '#222', justifyContent: 'center', alignItems: 'center' }]}>
                            <Ionicons name="musical-note" size={20} color="#b10404" />
                          </View>
                        )}
                        <View style={styles.verticalCardContent}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={styles.eventArtist}>{item.artistName}</Text>
                              {item.source && item.source !== 'ticketmaster' && (
                                <View style={[styles.sourceTagSmall, { backgroundColor: getSourceColor(item.source) }]}>
                                  <Text style={styles.sourceTagSmallText}>{getSourceLabel(item.source)}</Text>
                                </View>
                              )}
                            </View>
                            {item.date && (
                              <Text style={styles.eventDate}>
                                  {new Date(item.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                              </Text>
                            )}
                            <Text style={styles.eventVenue} numberOfLines={1}>
                              {item.venue}{item.city ? `, ${item.city}` : ''}
                            </Text>
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

  // Source badge
  sourceBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  sourceBadgeText: {
    color: 'white',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  sourceTag: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  sourceTagText: {
    color: 'white',
    fontSize: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  sourceTagSmall: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  sourceTagSmallText: {
    color: 'white',
    fontSize: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
  },

  // Trending Card (horizontal scroll)
  trendingCard: {
    width: 140,
    marginRight: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  trendingImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#222',
  },
  trendingPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendingName: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  trendingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  trendingGenre: {
    color: '#888',
    fontSize: 11,
    flex: 1,
  },
  trendingVenue: {
    color: '#666',
    fontSize: 10,
    marginTop: 3,
    fontStyle: 'italic',
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
