import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Profile, UserRole } from '../types';

interface AuthContextType {
  user: any | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  isAccountant: boolean;
  isSales: boolean;
  isConfigured: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let mounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    const setupAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          setUser(session?.user ?? null);
          if (session?.user) {
            await fetchProfile(session.user.id);
          }
        }
      } catch (err) {
        console.error("Auth initialization error:", err);
      } finally {
        if (mounted) setLoading(false);
      }

      const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (mounted) {
          setUser(session?.user ?? null);
          if (session?.user) {
            await fetchProfile(session.user.id);
          } else {
            setProfile(null);
          }
          setLoading(false);
        }
      });
      subscription = data.subscription;
    };

    setupAuth();

    return () => {
      mounted = false;
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .single();

      if (!error && data) {
        setProfile(data);
      }
    } catch (err) {
      console.error("Profile fetch error:", err);
    }
  };

  const role = profile?.role?.toUpperCase();
  const isAdminEmail = user?.email?.toLowerCase() === 'binhphan.070582@gmail.com';

  const value = {
    user,
    profile,
    loading,
    isAdmin: role === 'ADMIN' || isAdminEmail,
    isAccountant: role === 'ACCOUNTANT',
    isSales: role === 'SALES' || (!role && !isAdminEmail),
    isConfigured: isSupabaseConfigured,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
