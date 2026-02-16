import { StyleSheet, Text, View, ScrollView, Image, Dimensions, RefreshControl, TouchableOpacity, Linking } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import React, { useEffect, useState, useCallback } from 'react'
import { useUser } from '@supabase/auth-helpers-react'
import { supabase } from '../lib/supabase'
import { getRecommendations, RecommendationResponse } from '../lib/recommendations'

const screenWidth = Dimensions.get('window').width

export default function RecommendationsScreen() {
  const insets = useSafeAreaInsets()
  const user = useUser()
  const [loading, setLoading] = useState(true)
  const [recommendations, setRecommendations] = useState<RecommendationResponse | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchRecommendations = useCallback(async () => {
    setLoading(true)
    if (!user) {
      setLoading(false)
      return
    }

    try {
        // 1. Get user events to find a seed
        const { data: userEvents } = await supabase
            .from('user_events')
            .select('event_id')
            .eq('user_id', user.id)

        const eventIds = userEvents?.map((ue: any) => ue.event_id) || []
        
        let seedName = 'Muse'; // Default fallback

        if (eventIds.length > 0) {
             const { data: eventsData } = await supabase
                .from('events')
                .select('artist:artist_id(name)')
                .in('id', eventIds)
            
            if (eventsData && eventsData.length > 0) {
                const randomEvent = eventsData[Math.floor(Math.random() * eventsData.length)];
                const artistData = randomEvent.artist;
                // Supabase might return it as object or array depending on relation
                const artistName = Array.isArray(artistData) ? artistData[0]?.name : (artistData as any)?.name;
                
                if (artistName) {
                    seedName = artistName;
                }
            }
        }

        const recs = await getRecommendations(seedName);
        setRecommendations(recs);

    } catch (error) {
        console.error("Error loading recommendations:", error)
    } finally {
        setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchRecommendations()
  }, [user, fetchRecommendations])

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRecommendations();
    setRefreshing(false);
  }, [fetchRecommendations]);

  const openSpotify = (url?: string) => {
    if (url) Linking.openURL(url);
  };

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={['#000000', '#b10404']}
        locations={[0.6, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, { marginTop: insets.top + 20 }]}>
        <Text style={styles.title}>For You</Text>
        <Text style={styles.subtitle}>
            {recommendations ? `Based on ${recommendations.seed}` : 'Personalized suggestions'}
        </Text>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#b10404" />
        }
      >
        <View style={styles.grid}>
            {recommendations?.recommendations.map((artist) => (
                <TouchableOpacity 
                    key={artist.id} 
                    style={styles.card}
                    onPress={() => openSpotify(artist.external_url)}
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
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  title: {
    color: 'white',
    fontSize: 34,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 5,
    fontStyle: 'italic',
  },
  scrollContent: {
    paddingBottom: 100,
    paddingHorizontal: 15,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: (screenWidth - 45) / 2, // 2 columns with spacing
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
