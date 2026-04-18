import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { UserRole } from './types';
import MainLayout from './layouts/MainLayout';
import Login from './components/Login';
import Dashboard from './modules/Dashboard/Dashboard';
import Transactions from './modules/Transactions/Transactions';
import Reports from './modules/Reports/Reports';
import System from './modules/System/System';
import { AlertTriangle, Key } from 'lucide-react';

const ConfigWarning: React.FC = () => (
  <div className="min-h-screen bg-ink flex items-center justify-center p-4 text-paper">
    <div className="bg-paper p-8 rounded-sm shadow-2xl max-w-md w-full text-center text-ink border-4 border-gold-primary">
      <div className="w-16 h-16 bg-gold-primary/10 text-gold-primary rounded-full flex items-center justify-center mx-auto mb-6">
        <AlertTriangle size={32} />
      </div>
      <h2 className="text-2xl mb-4 font-black uppercase tracking-tighter">Thiếu Cấu Hình Supabase</h2>
      <p className="text-neutral-500 text-sm mb-8 font-medium">
        Vui lòng thiết lập các biến môi trường <strong className="text-ink">VITE_SUPABASE_URL</strong> và <strong className="text-ink">VITE_SUPABASE_ANON_KEY</strong> trong menu <strong>Settings</strong> để ứng dụng có thể hoạt động.
        <br/><span className="text-[10px] text-red-400 font-bold mt-2 inline-block italic underline underline-offset-2">* Lưu ý: Không để dấu gạch chéo (/) ở cuối URL.</span>
      </p>
      <div className="bg-neutral-50 p-4 border border-neutral-100 rounded-sm text-left mb-6">
        <p className="text-[10px] font-black uppercase text-neutral-400 mb-2 flex items-center gap-2">
          <Key size={12} /> Biến cần thiết:
        </p>
        <ul className="text-xs font-mono text-ink space-y-1">
          <li className="flex justify-between"><span>VITE_SUPABASE_URL</span> <span className="text-[10px] text-red-500 font-bold">Chưa có</span></li>
          <li className="flex justify-between"><span>VITE_SUPABASE_ANON_KEY</span> <span className="text-[10px] text-red-500 font-bold">Chưa có</span></li>
        </ul>
      </div>
      <p className="text-[10px] uppercase font-black text-neutral-400 tracking-tighter animate-pulse">
        Sau khi thiết lập, ứng dụng sẽ tự động tải lại.
      </p>
    </div>
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactNode, roles?: UserRole[] }> = ({ children, roles }) => {
  const { user, profile, loading, isConfigured } = useAuth();

  if (!isConfigured) {
    return <ConfigWarning />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-ink flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-gold-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-[10px] uppercase font-black tracking-widest text-gold-primary animate-pulse">Đang kiểm tra hệ thống...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && profile && !roles.includes(profile.role)) {
    // If user is logged in but doesn't have role, and Accountant is restricted from Dashboard
    if (profile.role === 'ACCOUNTANT' && window.location.pathname === '/') {
      return <Navigate to="/reports" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={
            <ProtectedRoute roles={['ADMIN', 'SALES', 'ACCOUNTANT']}>
              <MainLayout />
            </ProtectedRoute>
          }>
            <Route index element={
              <ProtectedRoute roles={['ADMIN', 'SALES']}>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="transactions" element={
              <ProtectedRoute roles={['ADMIN', 'SALES']}>
                <Transactions />
              </ProtectedRoute>
            } />
            <Route path="reports" element={<Reports />} />
            <Route path="system" element={
              <ProtectedRoute roles={['ADMIN', 'SALES']}>
                <System />
              </ProtectedRoute>
            } />
          </Route>
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
};

export default App;
