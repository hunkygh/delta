import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://eewzlwfmbhtoyeltxtaj.supabase.co';
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVld3psd2ZtYmh0b3llbHR4dGFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMzU5ODgsImV4cCI6MjA4NzkxMTk4OH0.F_Naj8cofo1g7YpKKvo_zYGzdEhW4c61h5sw51wOtKI';

// SINGLE shared Supabase client for the entire app
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'delta-auth-token'
  }
});

export default supabase;
