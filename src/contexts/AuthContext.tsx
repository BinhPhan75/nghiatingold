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
  login: (username: string, pass: string) => Promise<{ error: any }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    const initAuth = async () => {
      try {
        // 1. Check for official Supabase session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
          setLoading(false);
          return;
        }

        // 2. Check for local session
        const localSessionId = localStorage.getItem('nghiatin_session_id');
        if (localSessionId) {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', localSessionId)
            .single();
          
          if (!error && data) {
            setProfile(data);
            setUser({ id: data.id, email: data.email, local: true });
          } else {
            localStorage.removeItem('nghiatin_session_id');
          }
        }
      } catch (err) {
        console.error("Auth init error:", err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Fallback loading safety: Force stop loading after 5 seconds
    const safetyTimeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
      } else {
        // Only clear if not a local session
        if (!localStorage.getItem('nghiatin_session_id')) {
          setUser(null);
          setProfile(null);
        }
      }
      setLoading(false);
    });

    return () => {
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const login = async (username: string, pass: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .eq('pw', pass)
        .single();
      
      if (error) {
        console.error("Login attempt error:", error);
        
        // 1. Invalid API Key / URL
        if (error.message?.includes('Invalid API key') || error.message?.includes('apikey')) {
          return { error: { message: 'API Key (Anon Key) không hợp lệ. Vui lòng kiểm tra lại trong menu Settings.' } };
        }
        
        // 2. Table not found
        if (error.code === 'PGRST116' && error.message?.includes('not found')) {
          return { error: { message: 'Tên đăng nhập hoặc mật khẩu không đúng' } };
        }
        
        if (error.code === '42P01' || error.message?.includes('relation "profiles" does not exist')) {
          return { error: { message: 'Cơ sở dữ liệu chưa được khởi tạo. Vui lòng copy và chạy SQL script trong file supabase-setup.sql.' } };
        }

        // 3. RLS or Generic permission error
        if (error.message?.includes('permission denied')) {
          return { error: { message: 'Quyền truy cập bị từ chối. Hãy đảm bảo bạn đã chạy đúng SQL setup.' } };
        }

        return { error: { message: error.message || 'Lỗi kết nối cơ sở dữ liệu' } };
      }

      if (!data) return { error: { message: 'Tên đăng nhập hoặc mật khẩu không đúng' } };

      setProfile(data);
      setUser({ id: data.id, email: data.email, local: true });
      localStorage.setItem('nghiatin_session_id', data.id);
      return { error: null };
    } catch (err: any) {
      console.error("Critical login error:", err);
      // More descriptive error for generic network failures
      const msg = err.message || '';
      if (msg.includes('Failed to fetch')) return { error: { message: 'Không thể kết nối tới Supabase. Kiểm tra internet hoặc URL trong Settings.' } };
      return { error: { message: msg || 'Lỗi hệ thống không xác định' } };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('nghiatin_session_id');
    setUser(null);
    setProfile(null);
  };

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
    login,
    logout,
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
