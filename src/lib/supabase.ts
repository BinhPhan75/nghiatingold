import { createClient, SupabaseClient } from '@supabase/supabase-js';

const getSupabase = (): SupabaseClient => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Supabase configuration missing. Please provide VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables.');
  }

  return createClient(url, key);
};

// Lazy-initialized proxy to prevent crash on module load
export const supabase = new Proxy({} as SupabaseClient, {
  get: (target, prop) => {
    const instance = getSupabase();
    const value = (instance as any)[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  }
});

export const isSupabaseConfigured = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
