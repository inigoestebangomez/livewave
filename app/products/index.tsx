import { StyleSheet, Text, View } from 'react-native'
import React from 'react'
import { Link } from 'expo-router'

export default function ProductList() {
  return (
    <View style={styles.container}>
      <Text>ProductList</Text>
      <Link href="/products/1">Product 1</Link>
      <Link href="/products/2">Product 2</Link>
      <Link href="/products/3">Product 3</Link>

      <Link href="/products/best-sellers/playstation-5">Play Station (Best Sellers)</Link>
      <Link href="/products/deals/black-friday/playstation-5">Play Station (Deals)</Link>
      <Link href="/products/search/playstation-5">Play Station (Search)</Link>
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