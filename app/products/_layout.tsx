import { Slot } from "expo-router";
import { View, Text, StyleSheet } from "react-native";

export default function ProductsLayout() {
  return (
    <View style={styles.container}>
        <View style={styles.discountedProducts}>
            <Text>Discounted Products</Text>
        </View>
        <Slot />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
    discountedProducts: {
        padding: 20,
        backgroundColor: "orange",
        alignItems: 'center',
    },
});