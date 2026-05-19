import { StyleSheet, Text, View, ScrollView, Image, Dimensions, RefreshControl, TouchableOpacity, Linking, FlatList } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import React, { useState, useEffect } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { useRecommendations } from '../../hooks'
import ConcertDetailSheet from '../../components/ConcertDetailSheet'
import type { Event, DiscoverArtistWithConcerts } from '../../types/api'

const screenWidth = Dimensions.get('window').width

// Skeleton placeholder component
function SkeletonCard({ width, height, style }: { width: number; height: number; style?: any }) {
  const [opacity, setOpacity] = useState(0.3)
  
  React.useEffect(() => {
    const interval = setInterval(() => {
      setOpacity(prev => prev === 0.3 ? 0.6 : 0.3)
    }, 800)
    return () => clearInterval(interval)
  }, [])
  
  return (
    <View style={[{ width, height, backgroundColor: '#333', borderRadius: 12, opacity }, style]} />
  )
}

// Loading skeleton for horizontal scroll section
function SectionSkeleton({ count, cardWidth, cardHeight }: { count: number; cardWidth: number; cardHeight: number }) {
  return (
    <View style={{ flexDirection: 'row', paddingHorizontal: 5, gap: 15 }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} width={cardWidth} height={cardHeight} />
      ))}
    </View>
  )
}

// Loading skeleton for vertical list section
function VerticalListSkeleton({ count }: { count: number }) {
  return (
    <View style={{ paddingHorizontal: 15, gap: 10 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
          <SkeletonCard width={60} height={60} style={{ borderRadius: 8 }} />
          <View style={{ flex: 1, gap: 8 }}>
            <SkeletonCard width={120} height={16} />
            <SkeletonCard width={80} height={12} />
          </View>
        </View>
      ))}
    </View>
  )
}

export default function RecommendationsScreen() {
  const insets = useSafeAreaInsets()
  const {
    loading, refreshing, seedArtist, recommendedEvents, yourArtistsOnTour,
    discoverArtists, userCity, refresh,
    artistsOnTourLoading, discoverLoading, concertsLoading,
  } = useRecommendations()
  
  const [selectedArtistEvents, setSelectedArtistEvents] = useState<Event[] | null>(null)
  const [isSheetVisible, setIsSheetVisible] = useState(false)

  const openLink = (url?: string) => {
    if (url) Linking.openURL(url)
  }

  const handleArtistPress = (events: Event[]) => {
    setSelectedArtistEvents(events)
    setIsSheetVisible(true)
  }

  const handleCloseSheet = () => {
    setIsSheetVisible(false)
    setSelectedArtistEvents(null)
  }

  // Render card for artist on tour
  const renderArtistOnTourCard = ({ item }: { item: { artistName: string; events: Event[]; eventCount: number; nextEvent: Event } }) => (
    <TouchableOpacity style={styles.eventCard} onPress={() => handleArtistPress(item.events)}>
        <Image 
            source={{ uri: item.nextEvent.image || 'https://via.placeholder.com/150' }} 
            style={styles.eventImage} 
        />
        <View style={styles.eventOverlay}>
            <Text style={styles.eventArtist}>{item.artistName}</Text>
            {item.eventCount > 1 ? (
              <Text style={styles.eventDate}>{item.eventCount} upcoming dates</Text>
            ) : item.nextEvent.date ? (
              <Text style={styles.eventDate}>
                  {new Date(item.nextEvent.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </Text>
            ) : null}
            <Text style={styles.eventVenue} numberOfLines={1}>
              {item.nextEvent.city || item.nextEvent.venue || ''}
            </Text>
        </View>
    </TouchableOpacity>
  )

  // Render card for discover artists (similar with concerts)
  const renderDiscoverCard = ({ item }: { item: DiscoverArtistWithConcerts }) => (
    <TouchableOpacity style={styles.discoverCard} onPress={() => handleArtistPress(item.events)}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.discoverImage} />
        ) : (
          <View style={[styles.discoverImage, styles.discoverPlaceholder]}>
            <Ionicons name="musical-note" size={24} color="#b10404" />
          </View>
        )}
        <Text style={styles.discoverName} numberOfLines={1}>{item.artistName}</Text>
        <View style={styles.discoverMeta}>
          {/* Only show match score when we have real similarity data from Last.fm */}
          {item.match > 0 && (
            <View style={styles.matchBadge}>
              <Text style={styles.matchBadgeText}>{(item.match * 100).toFixed(0)}% match</Text>
            </View>
          )}
        </View>
        {item.eventCount > 0 && (
          <Text style={styles.discoverEvents} numberOfLines={1}>
            {item.eventCount} upcoming {item.eventCount === 1 ? 'show' : 'shows'}
          </Text>
        )}
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
        {/* YOUR ARTISTS ON TOUR - Always show section, empty state when no concerts */}
        <View style={styles.section}>
            <View style={styles.sectionHeader}>
                <Ionicons name="heart" size={18} color="#b10404" />
                <View style={{flex: 1}}>
                    <Text style={styles.sectionTitle}>Your Artists On Tour</Text>
                    {!artistsOnTourLoading && yourArtistsOnTour.length > 0 && (
                        <Text style={{color:'#888', fontSize: 11, marginTop: 2}}>
                            {yourArtistsOnTour.length} of your artists have upcoming shows
                        </Text>
                    )}
                </View>
            </View>
            {artistsOnTourLoading ? (
                <SectionSkeleton count={3} cardWidth={200} cardHeight={140} />
            ) : yourArtistsOnTour.length > 0 ? (
                <FlatList
                    data={yourArtistsOnTour}
                    horizontal
                    renderItem={renderArtistOnTourCard}
                    keyExtractor={(item) => item.artistName}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 5 }}
                />
            ) : (
                <View style={styles.emptySection}>
                    <Ionicons name="calendar-outline" size={48} color="#444" />
                    <Text style={styles.emptyTitle}>No Upcoming Shows</Text>
                    <Text style={styles.emptySubtitle}>
                        None of your followed artists have announced concerts yet.{'\n'}
                        Check back later or discover new artists below!
                    </Text>
                </View>
            )}
        </View>

        {/* DISCOVER - Artistas similares que REALMENTE tienen conciertos */}
        {(discoverArtists.length > 0 || discoverLoading) && (
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Ionicons name="compass" size={18} color="#e67e22" />
                    <View style={{flex: 1}}>
                        <Text style={styles.sectionTitle}>Discover More Artists</Text>
                        {!discoverLoading && discoverArtists.length > 0 && (
                            <Text style={{color:'#888', fontSize: 11, marginTop: 2}}>
                                {discoverArtists.length} artists with upcoming shows
                            </Text>
                        )}
                    </View>
                </View>
                {discoverLoading ? (
                    <SectionSkeleton count={4} cardWidth={140} cardHeight={180} />
                ) : (
                    <FlatList
                        data={discoverArtists}
                        horizontal
                        renderItem={renderDiscoverCard}
                        keyExtractor={(item) => item.id}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 15 }}
                    />
                )}
            </View>
        )}

        {/* RECOMMENDED CONCERTS */}
        <View style={styles.section}>
            <View style={styles.sectionHeader}>
                <Ionicons name="ticket" size={18} color="#b10404" />
                <View style={{flex: 1}}>
                    <Text style={styles.sectionTitle}>Recommended Concerts</Text>
                    {userCity && !concertsLoading && <Text style={{color:'#666', fontSize: 10}}>Near {userCity}</Text>}
                </View>
                {!concertsLoading && (
                    <Text style={styles.sectionSubtitle}>
                        Based on your music & location
                    </Text>
                )}
            </View>

            {concertsLoading ? (
                <VerticalListSkeleton count={4} />
            ) : recommendedEvents.length > 0 ? (
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
                            <Text style={styles.eventArtist}>{item.artistName}</Text>
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
                     No upcoming concerts found near you.
                 </Text>
            )}
        </View>

      </ScrollView>
      
      <ConcertDetailSheet
        visible={isSheetVisible}
        events={selectedArtistEvents}
        onClose={handleCloseSheet}
      />
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
  
  // Artist on Tour Card
  eventCard: { width: 200, height: 140, marginRight: 15, borderRadius: 12, overflow: 'hidden', backgroundColor: '#111' },
  eventImage: { width: '100%', height: '100%', position: 'absolute', opacity: 0.6 },
  eventOverlay: { flex: 1, justifyContent: 'flex-end', padding: 10, backgroundColor: 'rgba(0,0,0,0.3)' },
  eventArtist: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  eventDate: { color: '#b10404', fontSize: 14, fontWeight: '600' },
  eventVenue: { color: '#ccc', fontSize: 12 },
  
  // Discover Card
  discoverCard: { width: 140, marginRight: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  discoverImage: { width: '100%', aspectRatio: 1, borderRadius: 8, marginBottom: 8, backgroundColor: '#222' },
  discoverPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  discoverName: { color: 'white', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  discoverMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  matchBadge: { backgroundColor: '#e67e22', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3 },
  matchBadgeText: { color: 'white', fontSize: 8, fontWeight: '700' },
  discoverEvents: { color: '#888', fontSize: 10, marginTop: 3, fontStyle: 'italic' },
  
  // Vertical List
  verticalCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', marginBottom: 10, borderRadius: 12, padding: 10 },
  verticalCardImage: { width: 60, height: 60, borderRadius: 8, marginRight: 15 },
  verticalCardContent: { flex: 1 },
  emptyText: { color: '#aaa', textAlign: 'center', marginTop: 50, paddingHorizontal: 20 },
  
  // Empty Section
  emptySection: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  emptyTitle: { color: '#666', fontSize: 18, fontWeight: 'bold', marginTop: 16 },
  emptySubtitle: { color: '#444', fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
})
