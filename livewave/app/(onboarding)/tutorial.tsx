import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useUser } from '@supabase/auth-helpers-react';
import Toast from 'react-native-toast-message';

const { width } = Dimensions.get('window');

const slides = [
  {
    key: 'home',
    title: 'Your Next Show',
    text: 'Keep track of your upcoming concerts right from the Home screen. We will let you know how many days are left!',
    icon: 'home-outline' as const,
  },
  {
    key: 'search',
    title: 'Discover Bands',
    text: 'Search for any artist or festival on the planet. Add them directly to your calendar with one tap.',
    icon: 'search-outline' as const,
  },
  {
    key: 'calendar',
    title: 'My Concerts',
    text: 'Your beautifully organized concert calendar. Export events to your phone or share them with friends!',
    icon: 'calendar-outline' as const,
  },
  {
    key: 'foryou',
    title: 'For You',
    text: 'Get personalized concert recommendations based on the genres and artists you just selected.',
    icon: 'heart-outline' as const,
  }
];

export default function TutorialScreen() {
  const router = useRouter();
  const user = useUser();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleScroll = (event: any) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / width);
    setCurrentIndex(index);
  };

  const finishOnboarding = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ has_onboarded: true })
        .eq('id', user.id);
        
      if (error) throw error;
      
      router.replace('/(tabs)/home');
    } catch (e: any) {
       console.error(e);
       Toast.show({ type: 'error', text1: 'Error saving profile' });
    } finally {
       setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.content}>
        
        <ScrollView 
            horizontal 
            pagingEnabled 
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
        >
            {slides.map((slide) => (
                <View style={styles.slide} key={slide.key}>
                    <View style={styles.iconContainer}>
                        <Ionicons name={slide.icon} size={100} color="#b10404" />
                    </View>
                    <Text style={styles.title}>{slide.title}</Text>
                    <Text style={styles.text}>{slide.text}</Text>
                </View>
            ))}
        </ScrollView>

        <View style={styles.footer}>
            <View style={styles.pagination}>
                {slides.map((_, index) => (
                    <View 
                        key={index} 
                        style={[
                            styles.dot, 
                            currentIndex === index && styles.activeDot
                        ]} 
                    />
                ))}
            </View>

            <TouchableOpacity 
                style={[styles.button, currentIndex !== slides.length - 1 && {opacity: 0.5}]} 
                onPress={finishOnboarding}
                disabled={currentIndex !== slides.length - 1 || loading}
            >
                <Text style={styles.buttonText}>
                    {loading ? 'Starting...' : "Let's Rock"}
                </Text>
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
  },
  slide: {
    width,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  iconContainer: {
    marginBottom: 50,
    backgroundColor: 'rgba(177, 4, 4, 0.15)',
    padding: 40,
    borderRadius: 100,
  },
  title: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  text: {
    color: '#aaa',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  footer: {
    padding: 30,
    paddingBottom: 50,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 40,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#333',
    marginHorizontal: 5,
  },
  activeDot: {
    backgroundColor: '#b10404',
    width: 24,
  },
  button: {
    backgroundColor: '#b10404',
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  }
});
