import { StyleSheet, Text, View, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native'
import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import * as Location from 'expo-location'
import Slider from '@react-native-community/slider'
import { Ionicons } from '@expo/vector-icons'

export default function User() {
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [radius, setRadius] = useState(50)
  const [location, setLocation] = useState<{ lat: number, long: number } | null>(null)
  const [address, setAddress] = useState<string | null>(null)

  useEffect(() => {
    fetchProfile()
  }, [])

  async function fetchProfile() {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('profiles')
        .select('radius_km, location_latitude, location_longitude')
        .eq('id', user.id)
        .single()

      if (error) throw error

      if (data) {
        setRadius(data.radius_km || 50)
        if (data.location_latitude && data.location_longitude) {
          setLocation({ lat: data.location_latitude, long: data.location_longitude })
          await reverseGeocode(data.location_latitude, data.location_longitude)
        }
      }
    } catch (error) {
      console.log('Error fetching profile:', error)
    } finally {
      setLoading(false)
    }
  }

  async function reverseGeocode(lat: number, long: number) {
    try {
      const result = await Location.reverseGeocodeAsync({ latitude: lat, longitude: long })
      if (result.length > 0) {
        const { city, region, country } = result[0]
        setAddress(`${city || region}, ${country}`)
      } else {
        setAddress(`${lat.toFixed(4)}, ${long.toFixed(4)}`)
      }
    } catch (e) {
      setAddress(`${lat.toFixed(4)}, ${long.toFixed(4)}`)
    }
  }

  async function updateLocation() {
    setUpdating(true)
    try {
      let { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow location access to find concerts near you.')
        return
      }

      const loc = await Location.getCurrentPositionAsync({})
      setLocation({ lat: loc.coords.latitude, long: loc.coords.longitude })
      
      await reverseGeocode(loc.coords.latitude, loc.coords.longitude)
      
      await saveProfile({ 
        location_latitude: loc.coords.latitude, 
        location_longitude: loc.coords.longitude 
      })

    } catch (error) {
      Alert.alert('Error', 'Could not fetch location')
    } finally {
      setUpdating(false)
    }
  }

  async function saveProfile(updates: any) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user logged in')

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)

      if (error) throw error
    } catch (error) {
      console.error(error)
      Alert.alert('Error', 'Could not save profile')
    }
  }

  const handleRadiusChange = (value: number) => {
    setRadius(value)
  }

  const handleRadiusSlidingComplete = async (value: number) => {
    await saveProfile({ radius_km: value })
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#e91e63" />
      </View>
    )
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Concert Preferences</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <Ionicons name="location-sharp" size={24} color="#e91e63" />
          <Text style={styles.cardTitle}>My Location</Text>
        </View>
        
        <Text style={styles.locationText}>
          {address ? `📍 ${address}` : 'No location set'}
        </Text>

        <TouchableOpacity 
          style={styles.button} 
          onPress={updateLocation}
          disabled={updating}
        >
          {updating ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>Update Current Location</Text>
          )}
        </TouchableOpacity>
        <Text style={styles.hint}>Used to verify which concerts are near you.</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <Ionicons name="map-outline" size={24} color="#e91e63" />
          <Text style={styles.cardTitle}>Search Radius</Text>
        </View>
        
        <Text style={styles.radiusValue}>{radius} km</Text>
        
        <Slider
          style={{width: '100%', height: 40}}
          minimumValue={10}
          maximumValue={500}
          step={5}
          value={radius}
          onValueChange={handleRadiusChange}
          onSlidingComplete={handleRadiusSlidingComplete}
          minimumTrackTintColor="#e91e63"
          maximumTrackTintColor="#000000"
          thumbTintColor="#e91e63"
        />
        <Text style={styles.hint}>We'll notify you about concerts within this distance.</Text>
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>How it works</Text>
        <Text style={styles.infoText}>
          Every time your favorite artists announce a new tour, we'll check if it falls within your set radius.
        </Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5'
  },
  container: {
    padding: 20,
    paddingTop: 60,
    minHeight: '100%',
    backgroundColor: '#f5f5f5',
    gap: 20
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    gap: 15
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333'
  },
  locationText: {
    fontSize: 16,
    color: '#666',
    marginLeft: 34,
    marginBottom: 5
  },
  radiusValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginVertical: 10
  },
  button: {
    backgroundColor: '#e91e63',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600'
  },
  hint: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center'
  },
  infoSection: {
    marginTop: 20,
    padding: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20
  }
})