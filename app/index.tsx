import { ImageBackground, StyleSheet,Text, TouchableOpacity, View } from "react-native";
import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";

export default function Home() {
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
      <View style={styles.iconWrapper}>
        <Link href={"https://www.apple.com/ios/app-store/"}>
          <Ionicons name="logo-apple" size={20} color="white" />
        </Link>
      </View>

      <View style={styles.iconWrapper}>
        <Link href={"https://play.google.com/store"}>
          <Ionicons name="logo-google" size={20} color="white" />
        </Link>
      </View>
      <TouchableOpacity
        style={styles.signUpButton}
        >
        <Link href="/register" style={styles.signUpText}>Get Started</Link>
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
    backgroundColor: 'rgb(177, 4, 4)',
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