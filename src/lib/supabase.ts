import { createClient, SupabaseClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL || '';
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = !!(rawUrl && rawKey);

// Sanitize URL: remove trailing slash if present
const supabaseUrl = rawUrl.trim().replace(/\/$/, '') || 'https://placeholder.supabase.co';
const supabaseKey = rawKey.trim() || 'placeholder-key';

// Create a client. If configured is false, it uses dummy values to avoid crashes on startup
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

export const getSupabase = () => {
  if (!isSupabaseConfigured) {
    throw new Error('Cấu hình Supabase bị thiếu. Vui lòng thiết lập VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY trong Settings.');
  }
  return supabase;
};
