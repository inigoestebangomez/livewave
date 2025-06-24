import { Slot } from "expo-router";
import { SessionContextProvider } from '@supabase/auth-helpers-react'
import { supabase } from './lib/supabase'

export default function RootLayout() {
  return (
    <SessionContextProvider supabaseClient={supabase}>
      <Slot />
    </SessionContextProvider>
  )
}