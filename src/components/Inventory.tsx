import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Package, ShieldCheck, AlertTriangle, TrendingUp, Search } from 'lucide-react';

export function InventoryView() {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'inventory'), orderBy('goldType', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="space-y-12">
      <div className="hero-header border-b border-white/10 pb-6 flex items-center justify-between">
        <div>
          <h1 className="text-8xl font-black uppercase tracking-tighter">Kho<br/><span className="text-gold-primary">Lưu Trữ</span></h1>
          <p className="text-white/20 uppercase tracking-[0.4em] font-black text-[10px] mt-4">Current Assets & Physical Inventory</p>
        </div>
        <div className="text-right">
          <p className="text-gold-primary text-xs font-black uppercase tracking-widest mb-1">Total Vault Value</p>
          <p className="text-4xl font-black tracking-tighter">~1,540.2B <span className="text-sm opacity-20 uppercase font-black tracking-widest">VNĐ</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {items.length === 0 ? (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-white/10">
            <Package size={48} className="mx-auto mb-4 text-white/10" />
            <p className="text-white/20 font-black uppercase tracking-widest">Vault is currently empty</p>
          </div>
        ) : items.map((item: any) => (
          <div key={item.id} className="border-l-4 border-gold-primary bg-white/5 p-8 space-y-4 hover:bg-white/10 transition-colors">
            <div className="flex justify-between items-start">
              <h3 className="text-2xl font-black uppercase tracking-tighter">{item.goldType}</h3>
              <div className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest border ${
                item.totalWeight < 10 ? 'border-red-500 text-red-500' : 'border-gold-primary/30 text-gold-primary/60'
              }`}>
                {item.totalWeight < 10 ? 'Low Stock' : 'Optimized'}
              </div>
            </div>
            
            <div className="flex items-baseline gap-2 pt-4">
              <span className="text-5xl font-black tracking-tighter">{item.totalWeight}</span>
              <span className="text-xs font-black uppercase text-white/20 tracking-widest">{item.unit || 'chỉ'}</span>
            </div>

            <div className="pt-4 border-t border-white/10 flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-white/20">
              <span>Last Movement</span>
              <span>Today 14:20</span>
            </div>
          </div>
        ))}
      </div>

      {items.some((i: any) => i.totalWeight < 10) && (
        <div className="bg-red-500/10 border-l-4 border-red-500 p-6 flex items-center gap-4">
          <AlertTriangle className="text-red-500" />
          <div>
            <p className="text-red-500 font-black uppercase text-xs tracking-widest">Stock Alert Triggered</p>
            <p className="text-white/40 text-[10px] uppercase font-bold tracking-wider">Automated replenishment suggested for items marked 'Low Stock'</p>
          </div>
        </div>
      )}
    </div>

  );
}
