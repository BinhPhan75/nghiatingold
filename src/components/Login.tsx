import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useNavigate, Navigate } from 'react-router-dom';
import { Briefcase, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
  const [emailOrUser, setEmailOrUser] = useState('');
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
      // 1. Try custom login first
      const { error: customError } = await login(emailOrUser.trim(), password);
      
      if (!customError) {
        navigate('/');
        return;
      }

      // 2. Try Supabase Auth fallback
      const loginEmail = emailOrUser.includes('@') ? emailOrUser.trim() : 
                        (emailOrUser.toLowerCase() === 'admin' ? 'binhphan.070582@gmail.com' : emailOrUser.trim());

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      if (!authError && data.session) {
        navigate('/');
      } else {
        // Show specific database error if found
        if (customError.message?.includes('column') || customError.message?.includes('relation')) {
          setError(`Lỗi Cấu Hình Database: ${customError.message}. Hãy đăng nhập với admin/220785 và vào mục Chẩn đoán.`);
        } else {
          setError('Tên đăng nhập hoặc mật khẩu không đúng.');
        }
      }
    } catch (err: any) {
      console.error("Login unexpected error:", err);
      setError('Đã có lỗi hệ thống xảy ra. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center p-4 font-sans antialiased text-white">
      <div className="w-full max-w-md bg-white rounded-sm p-8 shadow-2xl text-[#0F0F0F]">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-[#D4AF37] flex items-center justify-center rounded-sm mb-4">
            <Briefcase className="text-[#0F0F0F]" size={32} />
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tighter text-[#0F0F0F]">Đăng nhập</h1>
          <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-[0.2em] mt-2 italic">Hệ Thống NGHIATIN GOLD</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-sm flex items-start gap-3 mb-6 border border-red-100 text-sm">
            <AlertCircle className="mt-0.5 shrink-0" size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <div className="p-3 bg-neutral-50 border border-neutral-100 rounded-sm mb-2 text-center">
            <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest mb-1">Mặc định hệ thống:</p>
            <p className="text-xs font-mono text-neutral-600">User: <span className="font-bold text-[#0F0F0F]">admin</span> | Pass: <span className="font-bold text-[#0F0F0F]">220785</span></p>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-black text-neutral-400 tracking-wider">Tên đăng nhập / Email</label>
            <input 
              type="text" 
              value={emailOrUser} 
              onChange={(e) => setEmailOrUser(e.target.value)}
              placeholder="admin hoặc email..."
              required
              className="p-3 border border-neutral-200 text-lg font-bold outline-none focus:border-[#0F0F0F] transition-colors text-[#0F0F0F]"
              disabled={loading}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-black text-neutral-400 tracking-wider">Mật khẩu</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="p-3 border border-neutral-200 text-lg font-bold outline-none focus:border-[#0F0F0F] transition-colors text-[#0F0F0F]"
              disabled={loading}
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="mt-4 bg-[#0F0F0F] text-white p-4 font-black uppercase tracking-widest hover:bg-[#D4AF37] hover:text-[#0F0F0F] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? 'Đang xác thực...' : (
              <>
                Vào hệ thống <LogIn size={18} />
              </>
            )}
          </button>
        </form>

        <div className="mt-10 pt-6 border-t border-neutral-100 text-center">
          <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">
            &copy; 2026 NGHIATIN GOLD. Hệ thống nội bộ.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
