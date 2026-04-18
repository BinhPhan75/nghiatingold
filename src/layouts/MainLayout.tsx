import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ArrowLeftRight, FileBarChart, Settings, LogOut, Briefcase } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const { profile, isAdmin, isSales, isAccountant } = useAuth();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard', roles: ['ADMIN', 'SALES'] },
    { to: '/transactions', icon: ArrowLeftRight, label: 'Giao dịch', roles: ['ADMIN', 'SALES'] },
    { to: '/reports', icon: FileBarChart, label: 'Báo cáo', roles: ['ADMIN', 'SALES', 'ACCOUNTANT'] },
    { to: '/system', icon: Settings, label: 'Hệ thống', roles: ['ADMIN', 'SALES'] },
  ];

  const filteredNavItems = navItems.filter(item => 
    profile?.role && item.roles.includes(profile.role)
  );

  return (
    <div className="flex min-h-screen bg-ink overflow-hidden text-ink">
      {/* Sidebar navigation */}
      <nav className="w-20 md:w-24 border-r border-gold-primary/20 flex flex-col items-center py-8 gap-8 shrink-0">
        <div className="w-12 h-12 bg-gold-primary flex items-center justify-center rounded-sm mb-4">
          <Briefcase className="text-ink" size={24} />
        </div>

        <div className="flex flex-col gap-4">
          {filteredNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={item.label}
              className={({ isActive }) => `nav-item-bold ${isActive ? 'active' : ''}`}
            >
              <item.icon size={20} />
            </NavLink>
          ))}
        </div>

        <button 
          onClick={handleLogout}
          className="mt-auto nav-item-bold border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white"
          title="Đăng xuất"
        >
          <LogOut size={20} />
        </button>
      </nav>

      {/* Main content area */}
      <main className="flex-1 overflow-y-auto bg-gray-bg text-ink relative">
        {/* Top Header */}
        <header className="h-16 px-8 flex items-center justify-between bg-paper border-b border-neutral-100 shadow-sm sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-xl m-0 tracking-tight text-ink lowercase font-black">
              Kim Hoàn <span className="text-gold-dark italic">Pro</span>
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] uppercase font-black text-neutral-400 leading-none mb-1">Cửa hàng gold</p>
              <p className="text-sm font-bold leading-none">{profile?.full_name}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-gold-primary/10 border border-gold-primary flex items-center justify-center font-black text-gold-dark">
              {profile?.full_name?.charAt(0) || 'U'}
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <div className="p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
