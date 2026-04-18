import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Transaction, Product } from '../../types';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { TrendingUp, TrendingDown, Scale, ShoppingBag, Clock } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import { motion } from 'motion/react';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({
    buyTotal: 0,
    sellTotal: 0,
    buyCount: 0,
    sellCount: 0,
  });
  const [pieData, setPieData] = useState<any[]>([]);
  const [hourlyData, setHourlyData] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .gte('created_at', `${today}T00:00:00`);

    if (transactions) {
      const buy = transactions.filter(t => t.type === 'BUY');
      const sell = transactions.filter(t => t.type === 'SELL');

      setStats({
        buyTotal: buy.reduce((s, t) => s + t.total_amount, 0),
        sellTotal: sell.reduce((s, t) => s + t.total_amount, 0),
        buyCount: buy.length,
        sellCount: sell.length,
      });

      // Pie data: weight by product
      const productMap: Record<string, number> = {};
      transactions.forEach(t => {
        productMap[t.product_name] = (productMap[t.product_name] || 0) + t.total_amount;
      });
      setPieData(Object.entries(productMap).map(([name, value]) => ({ name, value })));

      // Bar data: by hour
      const hourlyMap: Record<number, { hour: string, buy: number, sell: number }> = {};
      for (let i = 8; i <= 20; i++) {
        hourlyMap[i] = { hour: `${i}h`, buy: 0, sell: 0 };
      }
      transactions.forEach(t => {
        const h = new Date(t.created_at).getHours();
        if (hourlyMap[h]) {
          if (t.type === 'BUY') hourlyMap[h].buy += t.total_amount;
          else hourlyMap[h].sell += t.total_amount;
        }
      });
      setHourlyData(Object.values(hourlyMap));
    }

    const { data: pData } = await supabase.from('products').select('*');
    if (pData) setProducts(pData);
  };

  const COLORS = ['#D4AF37', '#141414', '#996515', '#006738', '#4b5563'];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-4xl text-ink">Tổng Quan</h1>
          <p className="text-[10px] uppercase font-black text-neutral-400 tracking-widest mt-2 px-1">Số liệu trực tiếp ngày hôm nay</p>
        </div>
        <div className="flex items-center gap-2 bg-paper px-4 py-2 rounded-sm border border-neutral-100 shadow-sm">
          <Clock className="text-gold-primary" size={16} />
          <span className="text-xs font-bold text-neutral-500">{new Date().toLocaleDateString('vi-VN')}</span>
        </div>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          label="Tổng thu bán ra" 
          value={formatCurrency(stats.sellTotal)} 
          count={stats.sellCount} 
          icon={TrendingUp} 
          color="text-vcb-blue" 
          borderColor="border-vcb-blue"
        />
        <StatCard 
          label="Tổng chi mua vào" 
          value={formatCurrency(stats.buyTotal)} 
          count={stats.buyCount} 
          icon={TrendingDown} 
          color="text-red-600" 
          borderColor="border-red-600"
        />
        <StatCard 
          label="Chênh lệch dòng tiền" 
          value={formatCurrency(stats.sellTotal - stats.buyTotal)} 
          icon={Scale} 
          color={stats.sellTotal - stats.buyTotal >= 0 ? "text-vcb-blue" : "text-red-600"} 
        />
        <StatCard 
          label="Số lượng giao dịch" 
          value={(stats.buyCount + stats.sellCount).toString()} 
          icon={ShoppingBag} 
          color="text-ink" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Real-time Prices Widget */}
        <div className="bg-paper p-6 rounded-sm shadow-sm border border-neutral-100 lg:col-span-1">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl">Bảng giá niêm yết</h3>
            <span className="text-[8px] font-black uppercase text-gold-primary border border-gold-primary px-2 py-0.5">Live</span>
          </div>
          <div className="flex flex-col gap-4">
            {products.map(p => (
              <div key={p.id} className="price-card group">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span>{p.name} ({p.unit})</span>
                    <div className="flex gap-4 mt-2">
                      <div className="flex flex-col">
                        <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-tighter">Mua</p>
                        <p className="font-mono font-black text-sm">{p.buy_price.toLocaleString()}</p>
                      </div>
                      <div className="flex flex-col">
                        <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-tighter">Bán</p>
                        <p className="font-mono font-black text-sm text-gold-dark">{p.sell_price.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Charts */}
        <div className="lg:col-span-2 grid grid-cols-1 gap-8">
          {/* Main Sales Chart */}
          <div className="bg-paper p-6 rounded-sm shadow-sm border border-neutral-100">
            <h3 className="mb-8 italic">Biểu đồ dòng tiền theo giờ</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700}} />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{ borderRadius: '0', border: '1px solid #000', fontWeight: 'bold' }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Bar dataKey="sell" name="Bán ra" fill="#006738" />
                  <Bar dataKey="buy" name="Mua vào" fill="#dc2626" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="bg-paper p-6 rounded-sm shadow-sm border border-neutral-100">
              <h3 className="mb-4 italic">Tỷ trọng mặt hàng</h3>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend iconType="rect" wrapperStyle={{fontSize: '10px', fontWeight: 800, textTransform: 'uppercase'}} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-ink p-8 rounded-sm shadow-xl flex flex-col justify-center items-center text-center text-paper relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 rotate-12 group-hover:rotate-0 transition-transform">
                <Scale size={120} />
              </div>
              <p className="text-[10px] uppercase font-black text-gold-primary tracking-[0.3em] mb-4">Kim Hoàn Pro</p>
              <h4 className="text-2xl mb-4 leading-tight italic">Hệ thống quản lý vàng bạc hiện đại nhất.</h4>
              <button 
                className="bg-gold-primary text-ink py-2 px-8 font-black uppercase text-[10px] tracking-widest hover:bg-paper transition-all"
                onClick={() => window.location.href='/transactions'}
              >
                Giao dịch ngay
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string, value: string, count?: number, icon: any, color: string, borderColor?: string }> = ({ label, value, count, icon: Icon, color, borderColor }) => (
  <motion.div 
    whileHover={{ y: -5 }}
    className={`bg-paper p-6 rounded-sm shadow-sm border ${borderColor || 'border-neutral-100'} group`}
  >
    <div className="flex justify-between items-start mb-4">
      <span className="text-[10px] uppercase font-black text-neutral-400 tracking-widest leading-tight">{label}</span>
      <Icon className={`${color} opacity-40 group-hover:opacity-100 transition-opacity`} size={20} />
    </div>
    <div className="flex flex-col">
      <h3 className={`text-2xl ${color} whitespace-nowrap overflow-hidden text-ellipsis`}>{value}</h3>
      {count !== undefined && (
        <span className="text-[10px] font-bold text-neutral-400 mt-1">{count} lượt giao dịch</span>
      )}
    </div>
  </motion.div>
);

export default Dashboard;
