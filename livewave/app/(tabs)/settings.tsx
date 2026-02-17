import { StyleSheet, Text, View, ScrollView, Image, TouchableOpacity, TextInput, Alert, ActivityIndicator, Switch, Appearance } from 'react-native'
import React, { useEffect, useState } from 'react'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import * as Location from 'expo-location'
import Slider from '@react-native-community/slider'
import { supabase } from '../lib/supabase'
import { useRouter } from 'expo-router'
import Toast from 'react-native-toast-message'

export default function Settings() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  
  // Profile Data
  const [name, setName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [radius, setRadius] = useState(50)
  const [address, setAddress] = useState<string | null>(null)
  
  // Settings
  const [themeMode, setThemeMode] = useState<'dark' | 'light' | 'auto'>('dark')

  useEffect(() => {
    fetchProfile()
  }, [])

  async function fetchProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/(auth)/login')
        return
      }
      setUserId(user.id)

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') throw error // PGRST116 is no rows returned

      if (data) {
        setName(data.name || '')
        setAvatarUrl(data.avatar_url)
        setRadius(data.radius_km || 50)
        
        if (data.location_latitude && data.location_longitude) {
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
       setAddress('Location set')
     }
  }

  async function updateLocation() {
    try {
      setSaving(true)
      let { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Toast.show({
          type: 'error',
          text1: 'Permission needed',
          text2: 'Allow location access to find concerts near you.'
        })
        return
      }

      const loc = await Location.getCurrentPositionAsync({})
      await reverseGeocode(loc.coords.latitude, loc.coords.longitude)
      await updateProfile({
        location_latitude: loc.coords.latitude,
        location_longitude: loc.coords.longitude
      })
      Toast.show({
        type: 'success',
        text1: 'Location updated!'
      })
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Could not update location'
      })
    } finally {
      setSaving(false)
    }
  }

  async function pickImage() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      })

      if (!result.canceled) {
        uploadAvatar(result.assets[0].uri)
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Could not pick image'
      })
    }
  }

  async function uploadAvatar(uri: string) {
    try {
      setSaving(true)
      if (!userId) return

      const response = await fetch(uri)
      const blob = await response.blob()
      const arrayBuffer = await new Response(blob).arrayBuffer()
      
      const fileExt = uri.split('.').pop()?.toLowerCase() ?? 'jpeg'
      const fileName = `${userId}/${Date.now()}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, arrayBuffer, {
          contentType: `image/${fileExt}`,
          upsert: true
        })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      setAvatarUrl(publicUrl)
      await updateProfile({ avatar_url: publicUrl })
      Toast.show({
        type: 'success',
        text1: 'Avatar updated!'
      })

    } catch (error) {
      console.log(error)
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Could not upload image'
      })
    } finally {
      setSaving(false)
    }
  }

  async function updateProfile(updates: any) {
    if (!userId) return
    const { error } = await supabase.from('profiles').update(updates).eq('id', userId)
    if (error) {
      console.error(error)
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to save changes'
      })
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.replace('/(auth)/login')
  }

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
         <LinearGradient colors={['#000000', '#1a0000']} style={StyleSheet.absoluteFill} />
         <ActivityIndicator color="#b10404" size="large" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
       <LinearGradient
        colors={['#000000', '#1a0000']}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20, paddingBottom: 100 }]}>
        
        {/* Header */}
        <Text style={styles.headerTitle}>Settings</Text>

        {/* Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <View style={styles.card}>
            <View style={styles.avatarRow}>
              <TouchableOpacity onPress={pickImage} style={styles.avatarContainer}>
                <Image 
                  source={{ uri: avatarUrl || 'https://via.placeholder.com/150?text=user' }} 
                  style={styles.avatar} 
                />
                <View style={styles.editBadge}>
                   <Ionicons name="camera" size={16} color="white" />
                </View>
              </TouchableOpacity>
              
              <View style={styles.infoCol}>
                 <Text style={styles.label}>Display Name</Text>
                 <TextInput 
                   style={styles.input}
                   value={name}
                   onChangeText={setName}
                   onEndEditing={() => updateProfile({ name })}
                   placeholder="Your Name"
                   placeholderTextColor="#666"
                 />
              </View>
            </View>
          </View>
        </View>

        {/* Location Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Concert Preferences</Text>
          <View style={styles.card}>
            <View style={styles.rowBetween}>
               <View style={styles.row}>
                 <Ionicons name="musical-notes" size={20} color="#b10404" />
                 <Text style={styles.settingLabel}>Music Preferences</Text>
               </View>
               <TouchableOpacity onPress={() => router.push('/onboarding/genres')}>
                 <Text style={styles.actionLink}>Edit</Text>
               </TouchableOpacity>
            </View>
            <Text style={styles.valueText}>Genres, Artists</Text>

            <View style={styles.divider} />

            <View style={styles.rowBetween}>
               <View style={styles.row}>
                 <Ionicons name="location" size={20} color="#b10404" />
                 <Text style={styles.settingLabel}>My Location</Text>
               </View>
               <TouchableOpacity onPress={updateLocation} disabled={saving}>
                 <Text style={styles.actionLink}>{saving ? 'Updating...' : 'Update'}</Text>
               </TouchableOpacity>
            </View>
            <Text style={styles.valueText}>{address || 'Not set'}</Text>

            <View style={styles.divider} />

            <View style={styles.rowBetween}>
               <View style={styles.row}>
                 <Ionicons name="map" size={20} color="#b10404" />
                 <Text style={styles.settingLabel}>Search Radius</Text>
               </View>
               <Text style={styles.highlightText}>{radius} km</Text>
            </View>
            <Slider
              style={{width: '100%', height: 40, marginTop: 10}}
              minimumValue={10}
              maximumValue={500}
              step={10}
              value={radius}
              onValueChange={setRadius}
              onSlidingComplete={(val) => updateProfile({ radius_km: val })}
              minimumTrackTintColor="#b10404"
              maximumTrackTintColor="#333"
              thumbTintColor="#b10404"
            />
          </View>
        </View>

        {/* Appearance Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <View style={styles.card}>
             <View style={styles.themeRow}>
                {['Light', 'Dark', 'Auto'].map((mode) => (
                  <TouchableOpacity 
                    key={mode} 
                    style={[styles.themeBtn, themeMode === mode.toLowerCase() && styles.themeBtnActive]}
                    onPress={() => setThemeMode(mode.toLowerCase() as any)}
                  >
                    <Text style={[styles.themeText, themeMode === mode.toLowerCase() && styles.themeTextActive]}>
                      {mode}
                    </Text>
                  </TouchableOpacity>
                ))}
             </View>
          </View>
        </View>

        {/* Account Actions */}
        <View style={styles.section}>
           <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
             <Text style={styles.signOutText}>Sign Out</Text>
           </TouchableOpacity>
           
           <TouchableOpacity style={styles.deleteBtn} onPress={() => Toast.show({ type: 'info', text1: 'Coming soon', text2: 'Delete Account feature is under development.' })}>
             <Text style={styles.deleteText}>Delete Account</Text>
           </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  headerTitle: {
    color: 'white',
    fontSize: 34,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    color: '#888',
    fontSize: 13,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 10,
    marginLeft: 5,
  },
  card: {
    backgroundColor: 'rgba(30,30,30, 0.9)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#333',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#b10404',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1e1e1e',
  },
  infoCol: {
    flex: 1,
  },
  label: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
  input: {
    color: 'white',
    fontSize: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
    paddingVertical: 4,
    fontWeight: '500',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  settingLabel: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  actionLink: {
    color: '#b10404',
    fontSize: 14,
    fontWeight: '600',
  },
  valueText: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 5,
    marginLeft: 30,
  },
  divider: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 15,
  },
  highlightText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  themeRow: {
    flexDirection: 'row',
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 2,
  },
  themeBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  themeBtnActive: {
    backgroundColor: '#333',
  },
  themeText: {
    color: '#666',
    fontWeight: '500',
    fontSize: 14,
  },
  themeTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  signOutBtn: {
    backgroundColor: '#b10404',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 15,
  },
  signOutText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  deleteBtn: {
    alignItems: 'center',
    padding: 10,
  },
  deleteText: {
    color: '#666',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
})