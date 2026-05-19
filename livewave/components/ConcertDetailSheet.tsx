import React from 'react'
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Share,
  Linking,
  ScrollView,
  SafeAreaView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import Modal from 'react-native-modal'

interface Event {
  id: string
  artistName?: string
  name?: string
  artistImageUrl?: string | null
  image?: string
  date: string | null
  venue?: string
  city?: string
  country?: string
  externalUrl?: string | null
  url?: string
  source?: 'ticketmaster' | 'festival' | 'spotify' | null
}

interface ConcertDetailSheetProps {
  visible: boolean
  event?: Event | null
  events?: Event[] | null
  onClose: () => void
  onDelete?: (id: string) => void
}

export default function ConcertDetailSheet({
  visible,
  event,
  events,
  onClose,
  onDelete,
}: ConcertDetailSheetProps) {
  // Usar events (array) o convertir event single a array
  const allEvents = events || (event ? [event] : [])
  const firstEvent = allEvents[0]
  
  if (!firstEvent) return null

  const artistName = firstEvent.artistName || firstEvent.name || 'Artista'
  const artistImageUrl = firstEvent.artistImageUrl || firstEvent.image

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return {
      day: date.getDate().toString().padStart(2, '0'),
      month: date
        .toLocaleString('es-ES', { month: 'short' })
        .toUpperCase()
        .replace('.', ''),
    }
  }

  const handleOpenUrl = (url?: string) => {
    if (url) {
      Linking.openURL(url)
    }
  }

  const handleDelete = () => {
    Alert.alert(
      'Borrar concierto',
      '¿Estás seguro de que quieres eliminar este concierto de tu lista?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: async () => {
            if (onDelete && event) {
              await onDelete(event.id)
            }
          },
        },
      ]
    )
  }

  const handleShare = async () => {
    try {
      const shareText = `${artistName} - ${allEvents.length} fecha${allEvents.length > 1 ? 's' : ''} disponible${allEvents.length > 1 ? 's' : ''}`

      await Share.share({
        message: shareText,
        url: allEvents[0]?.url || undefined,
      })
    } catch {
      Alert.alert('Error', 'No se pudo compartir el concierto')
    }
  }

  const handleOverflow = () => {
    const options = [
      { text: 'Compartir', onPress: handleShare },
      ...(event ? [{ text: 'Borrar concierto', style: 'destructive' as const, onPress: handleDelete }] : []),
      { text: 'Cancelar', style: 'cancel' as const },
    ]
    Alert.alert('Más opciones', '', options)
  }

  return (
    <Modal
      isVisible={visible}
      onBackdropPress={onClose}
      onSwipeComplete={onClose}
      swipeDirection={['down']}
      style={styles.modal}
      animationIn="slideInUp"
      animationOut="slideOutDown"
      animationInTiming={300}
      animationOutTiming={300}
      backdropTransitionInTiming={300}
      backdropTransitionOutTiming={300}
      propagateSwipe
    >
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} bounces={false}>
          {/* Image Section with Overlay Header */}
          <View style={styles.imageSection}>
            <Image
              source={{
                uri: artistImageUrl || 'https://via.placeholder.com/400x500?text=Sin+imagen',
              }}
              style={styles.image}
              resizeMode="cover"
            />

            {/* Bottom gradient overlay */}
            <LinearGradient
              colors={['transparent', 'rgba(10,10,10,0.8)', '#0a0a0a']}
              style={styles.bottomGradient}
            />

            {/* Grabber Handle - positioned over image */}
            <View style={styles.handleOverlay}>
              <View style={styles.handleIndicator} />
            </View>

            {/* Header Buttons - positioned over image */}
            <View style={styles.header}>
              <TouchableOpacity 
                onPress={onClose} 
                style={styles.headerButton}
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="arrow-back" size={22} color="white" />
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                onPress={handleOverflow} 
                style={styles.headerButton}
                activeOpacity={0.7}
              >
                <View style={styles.iconCircle}>
                  <Ionicons name="ellipsis-horizontal" size={22} color="white" />
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Event Info Section */}
          <View style={styles.infoSection}>
            <Text style={styles.artistName}>{artistName}</Text>
            
            <Text style={styles.subtitle}>World tour 2025</Text>
            
            {firstEvent.city && (
              <View style={styles.locationRow}>
                <Text style={styles.location}>{firstEvent.city}</Text>
                <Ionicons name="location-outline" size={16} color="#888" style={{ marginLeft: 4 }} />
              </View>
            )}
          </View>

          {/* Event Cards Grid */}
          <View style={styles.cardsContainer}>
            {allEvents.map((evt, index) => {
              const dateInfo = evt.date ? formatDate(evt.date) : null
              const locationText = [evt.city, evt.venue].filter(Boolean).join(', ')
              
              return (
                <TouchableOpacity
                  key={evt.id || index}
                  style={styles.eventCard}
                  onPress={() => handleOpenUrl(evt.url)}
                  activeOpacity={0.8}
                >
                  <View style={styles.cardContent}>
                    {/* Date Badge — only show if date is known */}
                    {dateInfo && (
                      <View style={styles.dateBadge}>
                        <Text style={styles.dateDay}>{dateInfo.day}</Text>
                        <Text style={styles.dateMonth}>{dateInfo.month}</Text>
                      </View>
                    )}
                    
                    {/* Location Info */}
                    <View style={styles.cardInfo}>
                      {evt.source === 'festival' && (
                        <Text style={styles.festivalBadge}>FESTIVAL</Text>
                      )}
                      <Text style={styles.cardLocation} numberOfLines={2}>
                        {locationText || 'Ubicación por confirmar'}
                      </Text>
                    </View>
                  </View>
                  
                  {/* Ticket Button */}
                  {evt.source === 'festival' ? (
                    <View style={styles.festivalButton}>
                      <Text style={styles.festivalButtonText}>Ver festival</Text>
                    </View>
                  ) : (
                    <View style={styles.ticketButton}>
                      <Ionicons name="ticket-outline" size={20} color="white" />
                    </View>
                  )}
                </TouchableOpacity>
              )
            })}
          </View>

          {/* Bottom padding */}
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modal: {
    margin: 0,
    justifyContent: 'flex-end',
  },
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    marginTop: '0%',
    overflow: 'hidden',
  },
  handleOverlay: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 5,
  },
  handleIndicator: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 2,
  },
  content: {
    flexGrow: 1,
    backgroundColor: '#0a0a0a',
  },
  imageSection: {
    position: 'relative',
    width: '100%',
    height: 380,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 50,
  },
  header: {
    position: 'absolute',
    top: 28,
    left: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  headerButton: {
    padding: 4,
  },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoSection: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  artistName: {
    color: 'white',
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 6,
    lineHeight: 36,
  },
  subtitle: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  location: {
    color: '#888',
    fontSize: 15,
    fontWeight: '400',
  },
  cardsContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  eventCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  dateBadge: {
    backgroundColor: '#b10404',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 50,
  },
  dateDay: {
    color: 'white',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 24,
  },
  dateMonth: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardInfo: {
    flex: 1,
  },
  cardLocation: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  ticketButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#b10404',
    alignItems: 'center',
    justifyContent: 'center',
  },
  festivalBadge: {
    color: '#e67e22',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 2,
  },
  festivalButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e67e22',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  festivalButtonText: {
    color: 'white',
    fontSize: 8,
    fontWeight: '700',
    textAlign: 'center',
  },
})
