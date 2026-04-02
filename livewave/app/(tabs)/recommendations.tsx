import { StyleSheet, Text, View, ScrollView, Image, Dimensions, RefreshControl, TouchableOpacity, Linking, FlatList } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import React from 'react'
import { Ionicons } from '@expo/vector-icons'
import { useRecommendations } from '../../hooks'
import type { Event, DiscoverArtist } from '../../types/api'

const screenWidth = Dimensions.get('window').width

export default function RecommendationsScreen() {
  const insets = useSafeAreaInsets()
  const {
    loading, refreshing, seedArtist, recommendedEvents, yourEvents,
    trendingArtists, userCity, refresh,
  } = useRecommendations()

  const getSourceColor = (source?: string) => {
    switch(source) {
      case 'festival': return '#e67e22'
      case 'spotify': return '#1DB954'
      default: return '#2d8cf0'
    }
  }

  const getSourceLabel = (source?: string) => {
    switch(source) {
      case 'festival': return 'Festival'
      case 'spotify': return 'Spotify'
      default: return 'Live'
    }
  }

  const openLink = (url?: string) => {
    if (url) Linking.openURL(url)
  }

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
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#b10404" />
        }
      >
        {/* YOUR ARTISTS ON TOUR */}
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

        {/* TRENDING IN YOUR GENRES */}
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

        {/* DISCOVER */}
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
                          <Image source={{ uri: item.image }} style={styles.verticalCardImage} />
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
  header: { paddingHorizontal: 20, marginBottom: 10 },
  title: { color: 'white', fontSize: 34, fontWeight: 'bold' },
  scrollContent: { paddingBottom: 100 },
  section: { marginBottom: 30 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 15, gap: 8 },
  sectionTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  sectionSubtitle: { color: '#888', fontSize: 12, marginTop: 4, marginLeft: 'auto', fontStyle: 'italic' },
  eventCard: { width: 200, height: 140, marginRight: 15, borderRadius: 12, overflow: 'hidden', backgroundColor: '#111' },
  eventImage: { width: '100%', height: '100%', position: 'absolute', opacity: 0.6 },
  eventOverlay: { flex: 1, justifyContent: 'flex-end', padding: 10, backgroundColor: 'rgba(0,0,0,0.3)' },
  eventArtist: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  eventDate: { color: '#b10404', fontSize: 14, fontWeight: '600' },
  eventVenue: { color: '#ccc', fontSize: 12 },
  sourceBadge: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginBottom: 4 },
  sourceBadgeText: { color: 'white', fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  sourceTag: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3 },
  sourceTagText: { color: 'white', fontSize: 8, fontWeight: '700', textTransform: 'uppercase' },
  sourceTagSmall: { paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3 },
  sourceTagSmallText: { color: 'white', fontSize: 8, fontWeight: '700', textTransform: 'uppercase' },
  trendingCard: { width: 140, marginRight: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  trendingImage: { width: '100%', aspectRatio: 1, borderRadius: 8, marginBottom: 8, backgroundColor: '#222' },
  trendingPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  trendingName: { color: 'white', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  trendingMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  trendingGenre: { color: '#888', fontSize: 11, flex: 1 },
  trendingVenue: { color: '#666', fontSize: 10, marginTop: 3, fontStyle: 'italic' },
  verticalCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', marginBottom: 10, borderRadius: 12, padding: 10 },
  verticalCardImage: { width: 60, height: 60, borderRadius: 8, marginRight: 15 },
  verticalCardContent: { flex: 1 },
  emptyText: { color: '#aaa', textAlign: 'center', marginTop: 50 },
})
