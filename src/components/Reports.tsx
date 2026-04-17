import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, PieChart, Pie, Legend, LineChart, Line
} from 'recharts';
import { Calendar, Download, Filter, TrendingUp } from 'lucide-react';

export function Reports() {
  const [data, setData] = useState<any[]>([]);
  const [goldTypeData, setGoldTypeData] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'transactions'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
      
      // Group by gold type
      const types: any = {};
      txs.forEach((tx: any) => {
        if (!types[tx.goldType]) types[tx.goldType] = 0;
        types[tx.goldType] += tx.totalPrice || 0;
      });
      
      setGoldTypeData(Object.entries(types).map(([name, value]) => ({ name, value })));
      setData(txs);
    });
    return () => unsubscribe();
  }, []);

  const COLORS = ['#D4AF37', '#745b1e', '#ecdcb9', '#ffffff', '#222222'];

  return (
    <div className="space-y-12">
      <div className="hero-header border-b border-white/10 pb-6 flex items-center justify-between">
        <div>
          <h1 className="text-8xl font-black uppercase tracking-tighter">Phân Tích<br/><span className="text-gold-primary">Thị Phần</span></h1>
          <p className="text-white/20 uppercase tracking-[0.4em] font-black text-[10px] mt-4">Revenue Breakdown & Performance Analytics</p>
        </div>
        <button className="bg-white/5 border border-white/10 px-8 py-4 rounded-none flex items-center gap-2 hover:bg-white/10 transition-all font-black uppercase text-[10px] tracking-widest text-white/40">
          <Download size={18} />
          GENERATE RECAP
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Doanh thu theo mặt hàng */}
        <div className="lg:col-span-1 space-y-8">
           <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <h3 className="text-xl font-black uppercase tracking-widest">Cơ cấu danh mục</h3>
            <span className="text-[10px] text-white/20 uppercase font-black tracking-widest">Pie Distribution</span>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={goldTypeData}
                  innerRadius={70}
                  outerRadius={90}
                  paddingAngle={0}
                  dataKey="value"
                  stroke="none"
                >
                  {goldTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                   contentStyle={{ backgroundColor: '#000', border: '1px solid #D4AF37', borderRadius: '0' }}
                   itemStyle={{ color: '#D4AF37', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
            {goldTypeData.map((item, i) => (
              <div key={i} className="flex justify-between items-center border-l-2 p-4 bg-white/5" style={{ borderLeftColor: COLORS[i % COLORS.length] }}>
                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-black text-white/20">{String(i+1).padStart(2, '0')}</span>
                  <span className="text-sm font-black uppercase tracking-tighter">{item.name}</span>
                </div>
                <span className="font-black text-gold-primary">{(item.value / 1000000).toFixed(1)}M</span>
              </div>
            ))}
          </div>
        </div>

        {/* Biểu đồ doanh thu thời gian */}
        <div className="lg:col-span-2 space-y-8">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <h3 className="text-xl font-black uppercase tracking-widest">Biến động doanh thu</h3>
            <div className="flex gap-1">
              <button className="px-6 py-2 border border-gold-primary text-[9px] font-black uppercase tracking-widest bg-gold-primary text-ink">ACTIVE</button>
              <button className="px-6 py-2 border border-white/10 text-[9px] font-black uppercase tracking-widest text-white/40">PAST</button>
            </div>
          </div>
          <div className="h-[450px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={goldTypeData}>
                <CartesianGrid strokeDasharray="0" stroke="#ffffff0a" vertical={false} />
                <XAxis dataKey="name" stroke="#ffffff20" fontSize={10} axisLine={false} tickLine={false} fontWeight="bold" />
                <YAxis hide />
                <Tooltip 
                  cursor={{ fill: '#ffffff05' }}
                  contentStyle={{ backgroundColor: '#000', border: '1px solid #D4AF37', borderRadius: '0' }}
                  itemStyle={{ color: '#D4AF37', fontSize: '12px', fontWeight: '900' }}
                />
                <Bar dataKey="value" fill="#D4AF37" radius={0} barSize={60}>
                  {goldTypeData.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>

  );
}
