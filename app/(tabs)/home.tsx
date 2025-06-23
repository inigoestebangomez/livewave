import { StyleSheet, Text, View, ScrollView, Image, Dimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import React from 'react'

const screenWidth = Dimensions.get('window').width

export default function LoggedHome() {
  useSafeAreaInsets()
  const username = 'Iñigo'

  return (
    <View style={{ flex: 1 }}>

      <LinearGradient
        colors={['#000000', '#b10404']}
        locations={[0.6, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.container}>
        <View style={styles.greetingContainer}>
          <Text style={styles.greetingText}>Hola {username}!</Text>
        </View>

        <View style={styles.eventCard}>
          <Image
            source={{
              uri: 'https://www.hellpress.com/wp-content/uploads/2025/03/a-day-to-remember-2024.jpg',
            }}
            style={styles.eventImage}
          />
          <Text style={styles.eventTitle}>A Day to Remember</Text>
          <Text style={styles.eventDate}>19 Junio 2025 - Barcelona</Text>
        </View>
        <View style={styles.upcomingContainer}>
          <Text style={styles.upcomingTitle}>Upcoming</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.upcomingScroll}>
          {[1, 2, 3, 4, 5].map((_, i) => (
            <View key={i} style={styles.artistContainer}>
              <Image
                source={{ uri: '' }}
                style={styles.artistImage}
              />
              <Text style={[styles.eventDate, styles.artistTitle]}>Artista {i + 1}</Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    position: 'relative',
    resizeMode: 'cover',
  },
  greetingContainer: {
    marginTop: 30,
    marginLeft: 20,
  },
  greetingText: {
    color: 'white',
    fontSize: 40,
    fontWeight: 'bold',
  },
  eventCard: {
    marginTop: 20,
    padding: 16,
  },
  eventImage: {
    width: '100%',
    resizeMode: 'cover',
    height: 300,
    borderRadius: 20,
    marginBottom: 10,
  },
  eventTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  eventDate: {
    color: '#aaa',
    fontSize: 14,
  },
  upcomingContainer: {
    marginTop: 10,
    marginLeft: 20,
    marginBottom: 10,
  },
  upcomingTitle: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'regular',
  },
  upcomingScroll: {
    marginLeft: 10,
  },
  artistContainer: {
    marginRight: 16,
    justifyContent: 'flex-start'
  },
  artistImage: {
    backgroundColor: '#222',
    width: screenWidth * 0.42,
    height: screenWidth * 0.42,
    borderRadius: 12,
    marginBottom: 8,
  },
  artistTitle: {
    bottom: 0,
    paddingLeft: 5
  }
})
