import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Briefcase, LogIn, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Map 'admin' username to 'binhphan.070582@gmail.com' as Supabase requires email
    const loginEmail = email.toLowerCase() === 'admin' ? 'binhphan.070582@gmail.com' : email;

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    });

    if (authError) {
      if (authError.message.includes('Invalid login credentials') && email.toLowerCase() === 'admin' && password === '220785') {
        setError('Tài khoản ADMIN chưa được khởi tạo trong Supabase. Vui lòng tạo tài khoản binhphan.070582@gmail.com với mật khẩu 220785 trong Supabase Dashboard.');
      } else {
        setError('Thông tin đăng nhập không chính xác');
      }
      setLoading(false);
    } else {
      navigate('/');
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
          <p className="text-[10px] uppercase font-black text-neutral-400 tracking-[0.2em] mt-2">Hệ Thống Kim Hoàn Pro</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-sm flex items-center gap-3 mb-6 border border-red-100 italic text-sm">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div className="input-field">
            <label>Email đăng nhập</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              placeholder="binhphan.070582@gmail.com"
              required
            />
          </div>

          <div className="input-field">
            <label>Mật khẩu</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
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
            &copy; 2026 Kim Hoan Pro. All Rights Reserved.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
