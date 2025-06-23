// app/auth/login.tsx
import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'

export default function LoginScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      Alert.alert('Error', error.message)
    } else {
      router.replace('/(tabs)/home') 
    }
    setLoading(false)
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login now</Text>
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
        placeholder="Password"
        secureTextEntry
        onChangeText={setPassword}
        value={password}
      />
      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Loading...' : 'Login'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
        <Text style={styles.link}>Forgot your password?</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
        <Text style={styles.link}>Sign up</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    padding: 20, 
    backgroundColor: '#000' },
  title: { 
    fontSize: 28, 
    color: '#fff', 
    marginBottom: 20, 
    textAlign: 'center' },
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
  buttonText: { 
    color: '#fff', 
    fontWeight: 'bold', 
    fontSize: 16 },
  link: { 
    color: '#ccc', 
    textAlign: 'center', 
    marginTop: 6 },
})
