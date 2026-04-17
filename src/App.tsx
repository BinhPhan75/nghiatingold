/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  History, 
  Settings, 
  TrendingUp, 
  Package, 
  Scan,
  LogOut,
  User as UserIcon,
  Search,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
  Camera,
  CreditCard,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from './firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  serverTimestamp, 
  limit,
  doc,
  updateDoc,
  increment,
  getDoc,
  getDocs
} from 'firebase/firestore';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';

// Views
import { Dashboard } from './components/Dashboard';
import { BuySell } from './components/BuySell';
import { TransactionHistory } from './components/TransactionHistory';
import { InventoryView } from './components/Inventory';
import { PriceManager } from './components/PriceManager';
import { Reports } from './components/Reports';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = () => signOut(auth);

  useEffect(() => {
    const seedData = async () => {
      const pricesSnap = await getDocs(collection(db, 'gold_prices'));
      if (pricesSnap.empty) {
        const initialPrices = [
          { type: 'Vàng 9999', buyPrice: 7450000, sellPrice: 7650000, updatedAt: serverTimestamp() },
          { type: 'Vàng SJC', buyPrice: 7800000, sellPrice: 8000000, updatedAt: serverTimestamp() },
          { type: 'Vàng 18K', buyPrice: 5200000, sellPrice: 5500000, updatedAt: serverTimestamp() },
        ];
        for (const p of initialPrices) {
          await addDoc(collection(db, 'gold_prices'), p);
        }
      }
    };
    if (user) seedData();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-ink flex items-center justify-center">
        <div className="w-16 h-16 border-t-2 border-gold-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-ink flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-12 max-w-2xl w-full text-center space-y-12"
        >
          <div className="space-y-4">
            <h1 className="text-9xl font-black text-white tracking-[-0.08em] leading-none uppercase">
              GOLD<br/><span className="text-gold-primary">SYSTEM</span>
            </h1>
            <p className="text-white/40 uppercase tracking-[0.4em] text-xs font-bold font-serif italic">Kim Hoàn Pro Management</p>
          </div>
          
          <button 
            onClick={handleLogin}
            className="w-full bg-gold-primary py-6 rounded-none text-ink font-black text-xl uppercase tracking-widest hover:brightness-110 transition-all flex items-center justify-center gap-4"
          >
            <UserIcon size={24} />
            LOGIN TO SYSTEM
          </button>
        </motion.div>
      </div>
    );
  }

  const menuItems = [
    { id: 'dashboard', label: 'TX', icon: LayoutDashboard },
    { id: 'buysell', label: 'IN', icon: ShoppingCart },
    { id: 'history', label: 'H', icon: History },
    { id: 'inventory', label: 'K', icon: Package },
    { id: 'prices', label: 'P', icon: TrendingUp },
    { id: 'reports', label: 'R', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-ink flex text-paper font-sans overflow-hidden">
      {/* Aside Sidebar - Bold Minimalist */}
      <aside className="w-20 border-r border-gold-primary/20 flex flex-col items-center py-8 gap-10 shrink-0">
        <div className="text-3xl font-black text-gold-primary mb-6">G.</div>

        <div className="flex-1 flex flex-col gap-4">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`nav-item-bold ${activeTab === item.id ? 'active' : ''}`}
              title={item.label}
            >
              <span className="text-[10px]">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-6 items-center">
          <img src={user.photoURL} alt="User" className="w-10 h-10 rounded-none border border-gold-primary/30" />
          <button 
            onClick={handleLogout}
            className="text-white/20 hover:text-red-500 transition-colors"
          >
            <LogOut size={20} />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-screen overflow-y-auto">
        <div className="p-10 max-w-[1400px] mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'dashboard' && <Dashboard setActiveTab={setActiveTab} />}
              {activeTab === 'buysell' && <BuySell />}
              {activeTab === 'history' && <TransactionHistory />}
              {activeTab === 'inventory' && <InventoryView />}
              {activeTab === 'prices' && <PriceManager />}
              {activeTab === 'reports' && <Reports />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}


