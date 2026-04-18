import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

export const isSupabaseConfigured = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

// Create a client. If configured is false, it uses dummy values to avoid crashes on startup
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

export const getSupabase = () => {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase configuration missing. Please provide VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
  return supabase;
};
