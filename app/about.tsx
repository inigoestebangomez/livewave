import { StyleSheet, Text, View } from 'react-native'
import React from 'react'

export default function About() {
  return (
    <View style={styles.constainer}>
      <Text>About</Text>
    </View>
  )
}

const styles = StyleSheet.create({
    constainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    }
})