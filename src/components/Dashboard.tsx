import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, Cell, PieChart, Pie 
} from 'recharts';
import { TrendingUp, TrendingDown, Users, Package, Wallet, Clock } from 'lucide-react';
import { format } from 'date-fns';

export function Dashboard({ setActiveTab }: { setActiveTab: (t: string) => void }) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    buyCount: 0,
    sellCount: 0,
    totalWeight: 0
  });

  useEffect(() => {
    const q = query(collection(db, 'transactions'), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setTransactions(docs);

      let revenue = 0;
      let buys = 0;
      let sells = 0;
      let weight = 0;

      docs.forEach((tx: any) => {
        if (tx.type === 'sell') {
          revenue += tx.totalPrice || 0;
          sells++;
        } else {
          buys++;
        }
        weight += tx.weight || 0;
      });

      setStats({
        totalRevenue: revenue,
        buyCount: buys,
        sellCount: sells,
        totalWeight: weight
      });
    });

    return () => unsubscribe();
  }, []);

  const chartData = [
    { name: 'Thứ 2', val: 4000 },
    { name: 'Thứ 3', val: 3000 },
    { name: 'Thứ 4', val: 2000 },
    { name: 'Thứ 5', val: 2780 },
    { name: 'Thứ 6', val: 1890 },
    { name: 'Thứ 7', val: 2390 },
    { name: 'CN', val: 3490 },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between hero-header">
        <div>
          <h1 className="text-8xl font-black uppercase tracking-tighter">Thị Trường<br/><span className="text-gold-primary">Hôm Nay</span></h1>
          <p className="text-white/20 uppercase tracking-[0.4em] font-bold text-[10px] mt-4">Jewelry Live Statistics</p>
        </div>
        <button 
          onClick={() => setActiveTab('buysell')}
          className="bg-gold-primary px-8 py-4 rounded-none text-ink font-black hover:scale-105 transition-transform uppercase tracking-widest text-sm"
        >
          MUA & BÁN
        </button>
      </div>

      {/* Stats Grid - Bold Minimal */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Doanh thu bán ra', value: stats.totalRevenue.toLocaleString(), unit: 'đ' },
          { label: 'Giao dịch Bán', value: stats.sellCount, unit: 'TX' },
          { label: 'Giao dịch Mua', value: stats.buyCount, unit: 'TX' },
          { label: 'Sản lượng', value: stats.totalWeight.toFixed(2), unit: 'chỉ' }
        ].map((stat, i) => (
          <div key={i} className="border-l-2 border-white/10 p-6 bg-white/5 space-y-2">
            <p className="text-gold-primary text-[10px] font-black uppercase tracking-widest">{stat.label}</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-3xl font-black">{stat.value}</h3>
              <span className="text-[10px] opacity-40 font-bold uppercase">{stat.unit}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Revenue Chart */}
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <h3 className="text-xl font-black uppercase tracking-widest">Xu hướng kinh doanh</h3>
            <select className="bg-ink border border-white/10 text-white/40 text-[10px] font-black p-2 outline-none uppercase">
              <option>WEEKLY VIEW</option>
              <option>MONTHLY VIEW</option>
            </select>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="0" stroke="#ffffff0a" vertical={false} />
                <XAxis dataKey="name" stroke="#ffffff20" fontSize={10} axisLine={false} tickLine={false} fontWeight="bold" />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#000', border: '1px solid #D4AF37', borderRadius: '0' }}
                  itemStyle={{ color: '#D4AF37', fontSize: '12px', fontWeight: '900' }}
                />
                <Area type="stepAfter" dataKey="val" stroke="#D4AF37" fillOpacity={0.1} fill="#D4AF37" strokeWidth={4} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Transactions - List View */}
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <h3 className="text-xl font-black uppercase tracking-widest">Giao dịch gần nhất</h3>
            <span className="text-[10px] text-white/20 uppercase font-black tracking-widest">Real-time Feed</span>
          </div>
          <div className="divide-y divide-white/10">
            {transactions.length === 0 ? (
              <div className="py-20 text-center text-white/10 font-black uppercase tracking-widest">No Active Sessions</div>
            ) : transactions.map((tx: any, i) => (
              <div key={i} className="flex items-center justify-between py-5 group cursor-pointer hover:bg-white/5 transition-colors px-4">
                <div className="flex items-center gap-6">
                  <div className={`w-3 h-3 rounded-none ${tx.type === 'sell' ? 'bg-gold-primary' : 'bg-white/20'}`}></div>
                  <div>
                    <h4 className="font-black text-sm uppercase tracking-tight">{tx.goldType}</h4>
                    <p className="text-[9px] text-white/20 font-black uppercase tracking-widest">
                      {tx.txType === 'buy' ? 'MUA VÀO' : 'BÁN RA'} • {tx.weight} {tx.unit}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-lg">{(tx.totalPrice || 0).toLocaleString()} <span className="text-[8px] opacity-40">VNĐ</span></p>
                  <p className="text-[9px] text-white/20 font-black uppercase tracking-tighter">
                    {tx.createdAt?.toDate ? format(tx.createdAt.toDate(), 'HH:mm') : 'PENDING'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
