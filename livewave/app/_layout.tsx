import { Slot } from "expo-router";
import { View } from "react-native";
import { SessionContextProvider } from '@supabase/auth-helpers-react'
import { supabase } from './lib/supabase'
import Toast, { BaseToast, ErrorToast, InfoToast } from 'react-native-toast-message'

/* -- Custom Toast Configuration for Premium Look -- */
const toastConfig = {
  success: (props: any) => (
    <BaseToast
      {...props}
      style={{ 
        borderLeftColor: '#b10404', 
        backgroundColor: '#1C1C1E', // iOS Dark Gray
        borderRadius: 25, // Pill shape
        borderLeftWidth: 0, 
        height: 50,
        width: '90%',
        shadowColor: "#000",
        shadowOffset: {
          width: 0,
          height: 4,
        },
        shadowOpacity: 0.30,
        shadowRadius: 4.65,
        elevation: 8,
      }}
      contentContainerStyle={{ paddingHorizontal: 20 }}
      text1Style={{
        fontSize: 15,
        fontWeight: '600',
        color: 'white'
      }}
      text2Style={{
        fontSize: 13,
        color: '#aaa'
      }}
      renderLeadingIcon={() => (
         <View style={{ justifyContent: 'center', paddingLeft: 15 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#b10404' }} />
         </View>
      )}
    />
  ),
  error: (props: any) => (
    <ErrorToast
      {...props}
      style={{ 
        borderLeftColor: 'red', 
        backgroundColor: '#1C1C1E',
        borderRadius: 25,
        borderLeftWidth: 0,
        height: 50,
        width: '90%',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
      }}
      contentContainerStyle={{ paddingHorizontal: 20 }}
      text1Style={{ fontSize: 15, fontWeight: '600', color: 'white' }}
      text2Style={{ fontSize: 13, color: '#aaa' }}
      renderLeadingIcon={() => (
        <View style={{ justifyContent: 'center', paddingLeft: 15 }}>
           <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: 'red' }} />
        </View>
     )}
    />
  ),
  info: (props: any) => (
    <InfoToast
      {...props}
      style={{ 
        borderLeftColor: '#2f95dc', 
        backgroundColor: '#1C1C1E',
        borderRadius: 25,
        borderLeftWidth: 0,
        height: 50,
        width: '90%',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
      }}
      contentContainerStyle={{ paddingHorizontal: 20 }}
      text1Style={{ fontSize: 15, fontWeight: '600', color: 'white' }}
      text2Style={{ fontSize: 13, color: '#aaa' }}
      renderLeadingIcon={() => (
        <View style={{ justifyContent: 'center', paddingLeft: 15 }}>
           <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#2f95dc' }} />
        </View>
     )}
    />
  )
};

export default function RootLayout() {
  return (
    <SessionContextProvider supabaseClient={supabase}>
      <Slot />
      <Toast config={toastConfig} topOffset={65} />
    </SessionContextProvider>
  )
}