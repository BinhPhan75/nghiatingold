import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Briefcase, LogIn, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

const Login: React.FC = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    // Map 'admin' username to 'binhphan.070582@gmail.com'
    const loginEmail = email.toLowerCase() === 'admin' ? 'binhphan.070582@gmail.com' : email;

    if (isRegister) {
      const { data, error: registerError } = await supabase.auth.signUp({
        email: loginEmail,
        password,
        options: {
          data: {
            full_name: fullName,
          }
        }
      });

      if (registerError) {
        setError(registerError.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        // Create profile
        const { error: profileError } = await supabase.from('profiles').insert({
          id: data.user.id,
          email: data.user.email!,
          full_name: fullName,
          status: 'PENDING',
          role: 'SALES'
        });

        if (profileError) {
          console.error("Profile creation error:", profileError);
          setError("Lỗi tạo hồ sơ người dùng: " + profileError.message);
          setLoading(false);
          // Try to clean up auth user if profile fails (optional/risky depending on requirements)
          return;
        }

        setSuccess('Đăng ký thành công! Vui lòng chờ quản trị viên phê duyệt tài khoản.');
        setIsRegister(false);
      }
    } else {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      if (authError) {
        setError('Thông tin đăng nhập không chính xác');
      } else {
        navigate('/');
      }
    }
    setLoading(false);
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
          <h1 className="text-3xl text-ink">{isRegister ? 'Đăng ký' : 'Đăng nhập'}</h1>
          <p className="text-[10px] uppercase font-black text-neutral-400 tracking-[0.2em] mt-2">Hệ Thống NGHIATIN GOLD</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-sm flex items-center gap-3 mb-6 border border-red-100 italic text-sm">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="bg-green-50 text-green-600 p-4 rounded-sm flex items-center gap-3 mb-6 border border-green-100 italic text-sm">
            <Briefcase size={18} />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleAuth} className="flex flex-col gap-4">
          {isRegister && (
            <div className="input-field">
              <label htmlFor="fullName">Họ và tên</label>
              <input 
                id="fullName"
                type="text" 
                value={fullName} 
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nguyễn Văn A"
                required={isRegister}
                disabled={loading}
              />
            </div>
          )}

          <div className="input-field">
            <label htmlFor="email">Email đăng nhập</label>
            <input 
              id="email"
              name="email"
              type="text" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@gmail.com"
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
                {isRegister ? 'Đăng ký ngay' : 'Vào hệ thống'} <LogIn size={18} />
              </>
            )}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button 
            onClick={() => setIsRegister(!isRegister)}
            className="text-xs text-neutral-500 hover:text-ink font-bold uppercase tracking-tighter"
          >
            {isRegister ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký tại đây'}
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-neutral-100 text-center">
          <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">
            &copy; 2026 BINHPHAN. All Rights Reserved.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
