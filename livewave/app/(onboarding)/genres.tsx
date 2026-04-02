import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '../lib/supabase'
import { useUser } from '@supabase/auth-helpers-react'

const GENRES = [
  { id: 'rock', name: 'Rock', icon: 'musical-notes' },
  { id: 'pop', name: 'Pop', icon: 'mic' },
  { id: 'indie', name: 'Indie', icon: 'glasses' },
  { id: 'hip-hop', name: 'Hip Hop', icon: 'disc' },
  { id: 'electronic', name: 'Electronic', icon: 'flash' },
  { id: 'techno', name: 'Techno', icon: 'pulse' },
  { id: 'house', name: 'House', icon: 'home' },
  { id: 'jazz', name: 'Jazz', icon: 'wine' },
  { id: 'metal', name: 'Metal', icon: 'skull' },
  { id: 'classical', name: 'Classical', icon: 'rose' },
  { id: 'folk', name: 'Folk', icon: 'leaf' },
  { id: 'r-b', name: 'R&B', icon: 'heart' },
  { id: 'reggae', name: 'Reggae', icon: 'sunny' },
  { id: 'blues', name: 'Blues', icon: 'rainy' },
  { id: 'soul', name: 'Soul', icon: 'flower' },
  { id: 'funk', name: 'Funk', icon: 'color-palette' },
  { id: 'punk', name: 'Punk', icon: 'hammer' },
  { id: 'country', name: 'Country', icon: 'beer' },
  { id: 'k-pop', name: 'K-Pop', icon: 'star' },
  { id: 'latin', name: 'Latin', icon: 'flame' },
  { id: 'flamenco', name: 'Flamenco', icon: 'bonfire' },
]

export default function GenreSelectionScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const user = useUser()
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchSavedGenres()
  }, [user])

  const fetchSavedGenres = async () => {
    if (!user) return
    try {
      const { data } = await supabase
        .from('user_genres')
        .select('genres(slug)') // Join with genres table
        .eq('user_id', user.id)
      
      if (data) {
        // Map slugs back to IDs (assuming slug === id in our local constant GENRES, which they are lowercased)
        // Actually GENRES id is 'rock', 'pop'. Database genre slug likely matches.
        const savedIds = data.map((item: any) => item.genres?.slug).filter(Boolean)
        setSelectedGenres(savedIds)
      }
    } catch (error) {
      console.error('Error fetching saved genres:', error)
    }
  }

  const toggleGenre = (id: string) => {
    if (selectedGenres.includes(id)) {
      setSelectedGenres(selectedGenres.filter((g) => g !== id))
    } else {
      setSelectedGenres([...selectedGenres, id])
    }
  }

  const handleNext = async () => {
    if (selectedGenres.length === 0) {
      Alert.alert('Selection Required', 'Please select at least one genre to continue.')
      return
    }

    if (!user) {
      Alert.alert('Error', 'User not authenticated.')
      return
    }

    setLoading(true)
    try {
      // 1. Get genre UUIDs from the database
      const { data: dbGenres, error: fetchError } = await supabase
        .from('genres')
        .select('id, slug')
        .in('slug', selectedGenres)

      if (fetchError || !dbGenres) {
        throw new Error(fetchError?.message || 'Failed to fetch genres')
      }

      const inserts = dbGenres.map(g => ({
        user_id: user.id,
        genre_id: g.id
      }))

      // Sync with DB
      const { error: insertError } = await supabase
        .from('user_genres')
        .upsert(inserts, { onConflict: 'user_id, genre_id' })

      if (insertError) throw insertError

      // Save successful, proceed to artists
      router.push('/(onboarding)/artists')
    } catch (error) {
      console.error('Error saving genres:', error)
      Alert.alert('Error', 'Failed to save preferences. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#000000', '#1a0505']}
        style={StyleSheet.absoluteFill}
      />
      
      <View style={[styles.header, { marginTop: insets.top + 20 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
             <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>What's your vibe?</Text>
        </View>
        <Text style={styles.subtitle}>Select the genres you love to help us recommend the best concerts for you.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.grid}>
        {GENRES.map((genre) => {
          const isSelected = selectedGenres.includes(genre.id)
          return (
            <TouchableOpacity
              key={genre.id}
              style={[
                styles.card,
                isSelected && styles.cardSelected
              ]}
              onPress={() => toggleGenre(genre.id)}
            >
              <Ionicons 
                name={genre.icon as any} 
                size={32} 
                color={isSelected ? '#fff' : '#b10404'} 
                style={{ marginBottom: 10 }}
              />
              <Text style={[styles.cardText, isSelected && styles.cardTextSelected]}>
                {genre.name}
              </Text>
              {isSelected && (
                <View style={styles.checkIcon}>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleNext}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Saving...' : 'Next'}</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 8 }} />
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
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#aaa',
    lineHeight: 22,
  },
  grid: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: 100,
  },
  card: {
    width: '48%',
    aspectRatio: 1.2,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSelected: {
    backgroundColor: 'rgba(177, 4, 4, 0.2)', // lightly tinted brand color
    borderColor: '#b10404',
  },
  cardText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ccc',
  },
  cardTextSelected: {
    color: '#fff',
  },
  checkIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    backgroundColor: 'transparent', // Gradient fade could be nice here
  },
  button: {
    backgroundColor: '#b10404',
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#b10404',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  backButton: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    marginRight: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  }
})
