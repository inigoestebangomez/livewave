import React, { useState, useEffect, useRef } from 'react'
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  RefreshControl
} from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { supabase } from '../lib/supabase'
import { useUser } from '@supabase/auth-helpers-react'
import slugify from 'slugify'
import { searchSpotifyArtists, Artist } from '../lib/api'

export default function ArtistSelectionScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const user = useUser()
  
  const [visibleArtists, setVisibleArtists] = useState<Artist[]>([])
  const [artistPool, setArtistPool] = useState<Artist[]>([])
  const [followedArtists, setFollowedArtists] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [initializing, setInitializing] = useState(true)

  // Search State
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Artist[]>([])

  // Refresh State
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true)
    await initialize()
    setRefreshing(false)
  }, [user])

  useEffect(() => {
    initialize()
  }, [user])

  // Debounced Search Effect
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.length >= 2) {
        // setLoading(true) // Don't block whole UI, maybe local spinner?
        try {
          const results = await searchSpotifyArtists(query)
          setSearchResults(results)
        } catch (err) {
          console.error('Search error:', err)
        } 
      } else {
        setSearchResults([])
      }
    }, 500)

    return () => clearTimeout(delayDebounceFn)
  }, [query])

  const initialize = async () => {
    if (!user) return

    try {
      // 1. Fetch User Genres
      const { data: userGenres } = await supabase
        .from('user_genres')
        .select('genres(slug)')
        .eq('user_id', user.id)
      
      const genres = userGenres?.map((ug: any) => ug.genres?.slug) || ['pop', 'rock', 'indie'] 
      
      // 2. Fetch User Follows (to mark as selected)
      const { data: userFollows } = await supabase
        .from('user_follows')
        .select('artists(name, id)')
        .eq('user_id', user.id)

      const existingFollows = new Set<string>()
      userFollows?.forEach((item: any) => {
          if (item.artists?.name) existingFollows.add(item.artists.name)
      })
      setFollowedArtists(existingFollows)

      // 3. Fetch Artists for these genres (Try multiple to get enough results)
      const allArtists: Artist[] = []
      
      // Fetch for top 5 random genres (since limit is 10 per query)
      const shuffledGenres = genres.sort(() => 0.5 - Math.random()).slice(0, 5)
      console.log('🎸 [Artists] Fetching for genres:', shuffledGenres);
      for (const g of shuffledGenres) {
          // Add random offset (0-40) to get different artists on each refresh
          const randomOffset = Math.floor(Math.random() * 40);
          const res = await searchSpotifyArtists(`genre:${g}`, randomOffset)
          console.log(`   - Genre ${g} (offset ${randomOffset}): Found ${res.length} artists`);
          allArtists.push(...res)
      }
      
      // Fallback if empty
      if (allArtists.length < 20) {
          const randomOffset = Math.floor(Math.random() * 20);
          const popular = await searchSpotifyArtists('year:2024', randomOffset)
          allArtists.push(...popular)
      }

      // Dedupe by ID
      const uniqueArtists = Array.from(new Map(allArtists.map(a => [a.id, a])).values())
      
      // Filter out artists that are already followed? Or just keep them randomly sorted?
      // User complaint: "sugiere artistas que ya tengo seleccionados". 
      // Let's filter them out from the "Suggestions" pool so we show NEW things, 
      // UNLESS the pool becomes too small.
      // actually, seeing what you follow is good confirmation.
      
      const shuffledArtists = uniqueArtists.sort(() => 0.5 - Math.random())
      
      // Increased to 24 to show more options initially
      const initialVisible = shuffledArtists.slice(0, 24)
      const initialPool = shuffledArtists.slice(24)
      
      setVisibleArtists(initialVisible)
      setArtistPool(initialPool)
      
    } catch (error) {
      console.error('Error initializing artists:', error)
      Alert.alert('Error', 'Could not load artists.')
    } finally {
      setLoading(false)
      setInitializing(false)
    }
  }

  const handleSelectArtist = async (selectedArtist: Artist, index?: number) => {
    const isFollowing = followedArtists.has(selectedArtist.name)
    const newFollows = new Set(followedArtists)
    
    if (isFollowing) {
        // Toggle OFF
        newFollows.delete(selectedArtist.name)
        setFollowedArtists(newFollows)
        removeFollowFromDB(selectedArtist)
    } else {
        // Toggle ON
        newFollows.add(selectedArtist.name)
        setFollowedArtists(newFollows)
        
        // Clear search if it was a search result
        if (query.length > 0) {
           setQuery('')
           setSearchResults([])
        }
        
        saveFollowToDB(selectedArtist)

        // For grid logic: If we just selected one from the grid, maybe we DON'T replace it immediately
        // so the user sees the checkmark state? 
        // User feedback: "appears duplicates... I pressed twice". 
        // If we replace it immediately, they can't unselect it easily.
        // Let's REMOVE the "replaceArtistInGrid" logic for now. 
        // It's less confusing if the grid stays stable and just updates state.
    }
  }

  // const replaceArtistInGrid = ... (Removed to prevent confusion/jumping content)

  const saveFollowToDB = async (artist: Artist) => {
      try {
        if (!user) return
        const slug = slugify(artist.name, { lower: true })
        
        // Upsert Artist
        const { data: dbArtist, error: artistError } = await supabase
            .from('artists')
            .upsert({ 
                name: artist.name, 
                slug, 
                image_url: artist.image || '' 
            }, { onConflict: 'slug' })
            .select()
            .single()
        
        if (artistError) throw artistError

        // Insert Follow
        const { error: followError } = await supabase
            .from('user_follows')
            .upsert({ user_id: user.id, artist_id: dbArtist.id }, { onConflict: 'user_id, artist_id' })

        if (followError) throw followError

      } catch (err) {
          console.error('Error saving follow:', err)
      }
  }

  const removeFollowFromDB = async (artist: Artist) => {
      try {
          if (!user) return
          // We need the artist ID. If we only have the Spotify object, we might not have our DB UUID.
          // But we can look it up by slug.
          const slug = slugify(artist.name, { lower: true })
          
          const { data: dbArtist } = await supabase
            .from('artists')
            .select('id')
            .eq('slug', slug)
            .single()
            
          if (dbArtist) {
              const { error } = await supabase
                .from('user_follows')
                .delete()
                .match({ user_id: user.id, artist_id: dbArtist.id })
                
              if (error) console.error('Error removing follow:', error)
          }
      } catch (err) {
          console.error('Error removing follow:', err)
      }
  }

  const fetchMoreArtists = async () => {
      console.log('Fetching more artists...')
      const more = await searchSpotifyArtists(`year:2025`) 
      setArtistPool(prev => [...prev, ...more])
  }

  const handleFinish = () => {
    // Save successful, proceed to tutorial
    router.push('/(onboarding)/tutorial')
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#000000', '#1a0505']}
        style={StyleSheet.absoluteFill}
      />
      
      <View style={[styles.header, { marginTop: insets.top + 20 }]}>
        <View style={styles.topRow}>
             <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                 <Ionicons name="arrow-back" size={24} color="#fff" />
             </TouchableOpacity>
        </View>
        <Text style={styles.title}>Pick your favorites</Text>
        <Text style={styles.subtitle}>Tap an artist to follow. Search for specific ones below.</Text>
        
        {/* RE-ADDED SEARCH BAR */}
        <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#888" style={{ marginRight: 10 }} />
            <TextInput 
                placeholder="Search specific artists..." 
                placeholderTextColor="#666" 
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
            />
            {query.length > 0 && (
                <TouchableOpacity onPress={() => { setQuery(''); setSearchResults([]) }}>
                    <Ionicons name="close-circle" size={20} color="#888" />
                </TouchableOpacity>
            )}
        </View>
        
        {/* SEARCH RESULTS DROPDOWN */}
        {searchResults.length > 0 && (
            <View style={styles.searchResults}>
                {searchResults.slice(0, 3).map(artist => (
                    <TouchableOpacity 
                        key={artist.id} 
                        style={styles.searchResultItem}
                        onPress={() => handleSelectArtist(artist)}
                    >
                        <Image source={{ uri: artist.image }} style={styles.smallImage} />
                        <Text style={styles.resultName}>{artist.name}</Text>
                        <Ionicons name="add" size={20} color="#fff" />
                    </TouchableOpacity>
                ))}
            </View>
        )}

      </View>

      {initializing ? (
          <View style={styles.center}>
              <ActivityIndicator size="large" color="#b10404" />
          </View>
      ) : (
          <ScrollView 
            contentContainerStyle={styles.grid}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor="#b10404"
                    title="Shuffling..."
                    titleColor="#fff"
                />
            }
          >
              {visibleArtists.map((artist, index) => {
                  const isSelected = followedArtists.has(artist.name)
                  return (
                    <TouchableOpacity 
                        key={`${artist.id}-${index}`} 
                        style={[styles.card, isSelected && styles.cardSelected]}
                        onPress={() => handleSelectArtist(artist, index)}
                        activeOpacity={0.7}
                    >
                        <Image 
                            source={{ uri: artist.image }} 
                            style={styles.image}
                            contentFit="cover"
                            transition={200}
                        />
                        <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.9)']}
                            style={styles.gradient}
                        />
                        <Text style={styles.artistName} numberOfLines={1}>{artist.name}</Text>
                        
                        <View style={styles.overlayIcon}>
                            <Ionicons 
                                name={isSelected ? "checkmark-circle" : "add-circle"} 
                                size={28} 
                                color={isSelected ? "#b10404" : "rgba(255,255,255,0.8)"} 
                            />
                        </View>
                    </TouchableOpacity>
                  )
              })}
          </ScrollView>
      )}
      
      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
          <TouchableOpacity style={styles.finishButton} onPress={handleFinish}>
              <Text style={styles.finishButtonText}>Start Exploring</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 10,
    zIndex: 10 
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15
  },
  backButton: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    alignSelf: 'flex-start'
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#aaa',
    lineHeight: 20,
    marginBottom: 15
  },
  searchBar: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  searchResults: {
      position: 'absolute',
      top: 180, 
      left: 20,
      right: 20,
      backgroundColor: '#222',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#444',
      zIndex: 100, 
      padding: 5
  },
  searchResultItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 10,
      borderBottomWidth: 1,
      borderBottomColor: '#333'
  },
  smallImage: {
      width: 30,
      height: 30,
      borderRadius: 15,
      marginRight: 10
  },
  resultName: {
      color: '#fff',
      flex: 1,
      fontWeight: '600'
  },
  center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center'
  },
  grid: {
      paddingHorizontal: 20,
      paddingBottom: 120, // Space for footer
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
  },
  card: {
      width: '48%', // 2 columns like Genres
      aspectRatio: 1, // Square
      marginBottom: 15,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: '#222',
      borderWidth: 2,
      borderColor: 'transparent',
  },
  cardSelected: {
      borderColor: '#b10404',
  },
  image: {
      width: '100%',
      height: '100%',
  },
  gradient: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: '60%',
  },
  artistName: {
      position: 'absolute',
      bottom: 12,
      left: 10,
      right: 10,
      color: '#fff',
      fontWeight: 'bold',
      fontSize: 16,
      textShadowColor: 'rgba(0,0,0,0.8)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4
  },
  overlayIcon: {
      position: 'absolute',
      top: 8,
      right: 8,
  },
  footer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      alignItems: 'center',
      paddingHorizontal: 30,
      zIndex: 20
  },
  finishButton: {
      backgroundColor: '#b10404',
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 32,
      borderRadius: 30,
      shadowColor: '#b10404',
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.5,
      shadowRadius: 10,
      elevation: 5
  },
  finishButtonText: {
      color: '#fff',
      fontSize: 18,
      fontWeight: 'bold',
      marginRight: 10
  }
})
