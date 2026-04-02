import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LocationScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const requestLocation = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log('Location permission status:', status);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
      // Proceed to genres regardless of true/false to avoid hard blocks
      router.push('/(onboarding)/genres');
    }
  };

  const skipLocation = () => {
    router.push('/(onboarding)/genres');
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#000000', '#2a0000']}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.content}>
        <View style={styles.iconContainer}>
            <Ionicons name="location-outline" size={80} color="#b10404" />
        </View>

        <Text style={styles.title}>Never miss a show</Text>
        <Text style={styles.description}>
          We use your location to find the best concerts happening near you. It helps us personalize your Discover feed!
        </Text>

        <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.button} onPress={requestLocation} disabled={loading}>
                <Text style={styles.buttonText}>{loading ? 'Loading...' : 'Enable Location'}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.skipButton} onPress={skipLocation}>
                <Text style={styles.skipText}>Not now</Text>
            </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  iconContainer: {
    backgroundColor: 'rgba(177, 4, 4, 0.1)',
    padding: 30,
    borderRadius: 100,
    marginBottom: 40,
  },
  title: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  description: {
    color: '#aaa',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 50,
  },
  buttonContainer: {
    width: '100%',
    position: 'absolute',
    bottom: 50,
  },
  button: {
    backgroundColor: '#b10404',
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  skipButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  skipText: {
    color: '#888',
    fontSize: 16,
  }
});
