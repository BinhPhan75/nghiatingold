import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { supabase } from './lib/supabase';
import { UserRole } from './types';
import MainLayout from './layouts/MainLayout';
import Login from './components/Login';
import Dashboard from './modules/Dashboard/Dashboard';
import Transactions from './modules/Transactions/Transactions';
import Reports from './modules/Reports/Reports';
import System from './modules/System/System';

const ProtectedRoute: React.FC<{ children: React.ReactNode, roles?: UserRole[] }> = ({ children, roles }) => {
  const { user, profile, loading, isApproved } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-ink flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-gold-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isApproved) {
    return (
      <div className="min-h-screen bg-ink flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-paper p-12 text-center rounded-sm shadow-2xl">
          <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-8 border-4 border-amber-100">
            <span className="text-4xl">⏳</span>
          </div>
          <h1 className="text-2xl text-ink mb-4 font-black uppercase italic">Tài khoản chưa được duyệt</h1>
          <p className="text-sm text-neutral-500 font-medium mb-8 leading-relaxed">
            Chào <strong>{profile?.full_name || user.email}</strong>,<br/>
            Tài khoản của bạn đang trong trạng thái chờ quản trị viên phê duyệt. Vui lòng quay lại sau.
          </p>
          <button 
            onClick={() => supabase.auth.signOut()}
            className="w-full py-4 bg-ink text-white font-black uppercase text-xs tracking-widest hover:bg-gold-primary hover:text-ink transition-all shadow-md"
          >
            Đăng xuất
          </button>
        </div>
      </div>
    );
  }

  if (roles && profile && !roles.includes(profile.role)) {
    return <Navigate to={profile.role === 'ACCOUNTANT' ? "/reports" : "/"} replace />;
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
