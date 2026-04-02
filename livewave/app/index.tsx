import { ImageBackground, StyleSheet,Text, TouchableOpacity, View, Alert, Platform } from "react-native";
import { Link, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import * as AppleAuthentication from 'expo-apple-authentication'
import * as WebBrowser from 'expo-web-browser'

WebBrowser.maybeCompleteAuthSession()

export default function Home() {

const router = useRouter();
const [checkingSession, setCheckingSession] = useState(true)
const [loading, setLoading] = useState(false)

useEffect(() => {
  const checkSession = async () => {
    const { data } = await supabase.auth.getSession()
    if (data?.session) {
      // Check if user has onboarded
      const { data: profile } = await supabase
        .from('profiles')
        .select('has_onboarded')
        .eq('id', data.session.user.id)
        .single()
        
      if (profile && profile.has_onboarded) {
         router.replace('/(tabs)/home')
      } else {
         router.replace('/(onboarding)/location')
      }
    } else {
      setCheckingSession(false) 
    }
  }
  checkSession()
}, [router])

const handleGoogleLogin = async () => {
  try {
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'livewave://google-auth',
        skipBrowserRedirect: true,
      },
    })
    if (error) throw error
    
    const res = await WebBrowser.openAuthSessionAsync(data.url, 'livewave://google-auth')
    if (res.type === 'success') {
      const urlStr = res.url.replace('#', '?');
      const queryString = urlStr.split('?')[1] || '';
      const params = Object.fromEntries(queryString.split('&').map(p => p.split('=')));
      const access_token = params.access_token;
      const refresh_token = params.refresh_token;
        if (access_token && refresh_token) {
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token })
          if (sessionError) throw sessionError
          
          if (sessionData.user) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('has_onboarded')
                .eq('id', sessionData.user.id)
                .single()
              
              if (profile && profile.has_onboarded) {
                 router.replace('/(tabs)/home')
              } else {
                 router.replace('/(onboarding)/location')
              }
          }
        }
    }
  } catch (error: any) {
    Alert.alert('Google Auth Error', error.message)
  } finally {
    setLoading(false)
  }
}

const handleAppleLogin = async () => {
  try {
    setLoading(true)
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    })
    if (credential.identityToken) {
      const { error, data } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      })
      if (data.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('has_onboarded')
            .eq('id', data.user.id)
            .single()
          
          if (profile && profile.has_onboarded) {
             router.replace('/(tabs)/home')
          } else {
             router.replace('/(onboarding)/location')
          }
      }
      throw new Error('No identity token provided by Apple.')
    }
  } catch (e: any) {
    if (e.code !== 'ERR_REQUEST_CANCELED') {
       Alert.alert('Apple Auth Error', e.message)
    }
  } finally {
    setLoading(false)
  }
}

if (checkingSession) return null

  return (
    <ImageBackground 
      source={require('../assets/images/Gemini_Generated_Image_i3fsxii3fsxii3fs.jpeg')}
      style={styles.container}>
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
      
      <View style={styles.logoContainer}>
        <Text style={styles.logoText}>Live</Text>
        <Text style={styles.logoText}>Wave</Text>
      </View>

      <View style={styles.sloganContainer}>
        <Text style={styles.whiteText}>Live.</Text>
        <Text style={styles.whiteText}>Music.</Text>
        <Text style={styles.redText}>Planned.</Text>
      </View>

      <View style={styles.signUpContainer}>
      {Platform.OS === 'ios' && (
        <TouchableOpacity style={styles.iconWrapper} onPress={handleAppleLogin} disabled={loading}>
          <Ionicons name="logo-apple" size={20} color="white" />
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.iconWrapper} onPress={handleGoogleLogin} disabled={loading}>
        <Ionicons name="logo-google" size={20} color="white" />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.signUpButton}
        >
        <Link href="/(auth)/register" style={styles.signUpText}>Get Started</Link>
      </TouchableOpacity>
    </View>

      <View style={styles.memberLink}>
        <Link href={"/(auth)/login"} style={styles.linkMemberLink}>Already a member?</Link>
      </View>
      </SafeAreaView>
      </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    position: 'relative',
    resizeMode: 'cover',
  },
  logoContainer: {
    marginTop: 40,
    marginLeft: 20,
    backgroundColor: '#b10404',
    borderRadius: 100,
    width: 200,
    height: 200,
  },
  logoText: {
    color: 'white',
    fontSize: 64,
    fontWeight: 'bold',
  },
  sloganContainer: {
    position: 'absolute',
    bottom: 110,
    marginEnd: 50,
    marginBottom: 20,
    marginLeft: 20,
    flexDirection: 'column',
    alignItems: 'flex-start',

  },
  whiteText: {
    color: 'white',
    fontSize: 52,
    fontWeight: 'bold',
  },
  redText: {
    color: 'rgb(204, 2, 2)',
    fontSize: 52,
    fontWeight: 'bold',
  },
  signUpContainer: {
  position: "absolute",
  bottom: 70,
  left: 20,
  right: 20,
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
},
iconWrapper: {
  backgroundColor: "rgb(179, 179, 179)",
  width: 40,
  height: 40,
  borderRadius: 20,
  justifyContent: "center",
  alignItems: "center",
},
signUpButton: {
  flex: 1,
  height: 40,
  borderRadius: 30,
  backgroundColor: "rgb(177, 4, 4)",
  justifyContent: "center",
  alignItems: "center",
},
signUpText: {
  color: "white",
  fontSize: 14,
  fontWeight: "bold",
},
memberLink: {
  position: "absolute",
  bottom: 30,
  flex: 1,
  justifyContent: "center",
  alignItems: "center",
  width: '100%',
},
linkMemberLink: {
  color: "rgba(208, 208, 208, 0.86)",
  fontSize: 14,
}
});