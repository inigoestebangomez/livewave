// app/auth/register.tsx
import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import * as AppleAuthentication from 'expo-apple-authentication'
import * as WebBrowser from 'expo-web-browser'
import { Ionicons } from '@expo/vector-icons'

WebBrowser.maybeCompleteAuthSession()

export default function RegisterScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRegister = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
      },
    })

    if (error) {
      Alert.alert('Error', error.message)
    } else {
      Alert.alert('Verifica tu correo', 'Hemos enviado un email de confirmación')
      router.push('/(auth)/login')
    }

    setLoading(false)
  }

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
              const { data: profile } = await supabase.from('profiles').select('has_onboarded').eq('id', sessionData.user.id).single()
              if (profile && profile.has_onboarded) {
                 router.replace('/(tabs)/home')
              } else {
                 router.replace('/(onboarding)/location')
              }
          }
        }
      }
    } catch (error: any) {
      Alert.alert('Google Sign Up Error', error.message)
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
        if (error) throw error
        if (data.user) {
            const { data: profile } = await supabase.from('profiles').select('has_onboarded').eq('id', data.user.id).single()
            if (profile && profile.has_onboarded) {
               router.replace('/(tabs)/home')
            } else {
               router.replace('/(onboarding)/location')
            }
        }
      } else {
        throw new Error('No identity token provided by Apple.')
      }
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
         Alert.alert('Apple Sign Up Error', e.message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Join us</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        onChangeText={setEmail}
        value={email}
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Name"
        autoCapitalize="none"
        onChangeText={setName}
        value={email}
        keyboardType="name-phone-pad"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        onChangeText={setPassword}
        value={password}
      />
      <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Registrando...' : 'Signup'}</Text>
      </TouchableOpacity>

      <View style={styles.dividerContainer}>
        <View style={styles.divider} />
        <Text style={styles.dividerText}>OR</Text>
        <View style={styles.divider} />
      </View>

      <TouchableOpacity style={styles.socialButton} onPress={handleGoogleLogin} disabled={loading}>
        <Ionicons name="logo-google" size={20} color="#fff" />
        <Text style={styles.socialButtonText}>Continue with Google</Text>
      </TouchableOpacity>

      {Platform.OS === 'ios' && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
          cornerRadius={8}
          style={styles.appleButton}
          onPress={handleAppleLogin}
        />
      )}

      <TouchableOpacity style={{ marginTop: 20 }} onPress={() => router.push('/(auth)/login')}>
        <Text style={styles.link}>Login</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#000' },
  title: { fontSize: 28, color: '#fff', marginBottom: 20, textAlign: 'center' },
  input: {
    backgroundColor: '#1a1a1a',
    color: '#fff',
    padding: 14,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  button: {
    backgroundColor: '#b10404',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#333',
  },
  dividerText: {
    color: '#666',
    marginHorizontal: 10,
    fontWeight: 'bold',
  },
  socialButton: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  socialButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 10,
  },
  appleButton: {
    width: '100%',
    height: 52,
    marginBottom: 12,
  },
  link: { color: '#ccc', textAlign: 'center', marginTop: 6 },
})
