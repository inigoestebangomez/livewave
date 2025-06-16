import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { useLocalSearchParams } from 'expo-router'

export default function ProductDetail() {

    const { id } = useLocalSearchParams();
  return (
    <View style={styles.container}>
      <Text>Details about products with ID { id }</Text>
    </View>
  )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 20
    }
})