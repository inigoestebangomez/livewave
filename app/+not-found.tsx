import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { Link } from 'expo-router'

export default function CustomNotFound() {
  return (
    <View style={styles.container}>
      <Text>CustomNotFound</Text>
      <Link href="/">Back Home</Link>
    </View>
  )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    }
})