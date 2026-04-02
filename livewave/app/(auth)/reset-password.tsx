import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'

export default function ResetPasswordScreen() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleUpdatePassword = async () => {
    if (!password) {
      Alert.alert('Error', 'Please enter a valid password.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({
      password: password
    })

    if (error) {
      Alert.alert('Error updating password', error.message)
    } else {
      Alert.alert('Success', 'Password has been updated.')
      router.replace('/(auth)/login')
    }
    setLoading(false)
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>New Password</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter new password"
        secureTextEntry
        onChangeText={setPassword}
        value={password}
      />
      <TouchableOpacity style={styles.button} onPress={handleUpdatePassword} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Saving...' : 'Update Password'}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#000' },
  title: { fontSize: 24, color: '#fff', marginBottom: 20, textAlign: 'center' },
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
  },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
})
