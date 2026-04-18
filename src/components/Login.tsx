import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useNavigate, Navigate } from 'react-router-dom';
import { Briefcase, LogIn, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
  const [identifier, setIdentifier] = useState(''); // Email or Username
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  if (!isSupabaseConfigured) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Try custom username/password from profiles table first
      const { error: loginError } = await login(identifier, password);
      
      if (!loginError) {
        navigate('/');
        return;
      }

      // 2. Fallback to Supabase Auth if the custom login failed
      // This is for users who registered via standard email/password
      const loginEmail = identifier.includes('@') ? identifier : 
                         (identifier.toLowerCase() === 'admin' ? 'binhphan.070582@gmail.com' : identifier);

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      if (!authError && authData.session) {
        navigate('/');
        return;
      }

      // If both fail, show the most relevant error
      // If the identifier was an email, show auth error, otherwise show custom login error
      if (identifier.includes('@') && authError) {
        setError(authError.message);
      } else {
        setError(loginError.message || 'Thông tin đăng nhập không chính xác');
      }
      
    } catch (err: any) {
      console.error("Login unexpected error:", err);
      setError('Đã có lỗi xảy ra hoặc database chưa được cấu hình đúng. Vui lòng kiểm tra mục Hệ Thống.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-paper rounded-sm p-8 shadow-2xl"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gold-primary flex items-center justify-center rounded-sm mb-4">
            <Briefcase className="text-ink" size={32} />
          </div>
          <h1 className="text-3xl text-ink">Đăng nhập</h1>
          <p className="text-[10px] uppercase font-black text-neutral-400 tracking-[0.2em] mt-2">Hệ Thống NGHIATIN GOLD</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-sm flex items-center gap-3 mb-6 border border-red-100 italic text-sm">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div className="input-field">
            <label htmlFor="identifier">Tên đăng nhập / Email</label>
            <input 
              id="identifier"
              name="identifier"
              type="text" 
              value={identifier} 
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Nhập username hoặc bphan@store.vn"
              required
              disabled={loading}
              autoComplete="username"
            />
          </div>

          <div className="input-field">
            <label htmlFor="password">Mật khẩu</label>
            <input 
              id="password"
              name="password"
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="mt-4 bg-ink text-paper p-4 font-black uppercase tracking-widest hover:bg-gold-primary hover:text-ink transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? 'Đang xử lý...' : (
              <>
                Vào hệ thống <LogIn size={18} />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-neutral-100 text-center">
          <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">
            &copy; 2026 NGHIATIN GOLD. All Rights Reserved.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
