import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Transaction, Product } from '../../types';
import { Search, Filter, Download, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';

const Reports: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter State
  const today = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [productId, setProductId] = useState('');
  const [customerCCCD, setCustomerCCCD] = useState('');

  useEffect(() => {
    fetchProducts();
    fetchTransactions();
  }, []);

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*');
    if (data) setProducts(data);
  };

  const fetchTransactions = async () => {
    setLoading(true);
    let query = supabase
      .from('transactions')
      .select('*, salesperson:profiles!created_by(email, full_name)')
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59`)
      .order('created_at', { ascending: false });

    if (productId) query = query.eq('product_id', productId);
    if (customerCCCD) query = query.ilike('customer_cccd', `%${customerCCCD}%`);

    const { data, error } = await query;

    if (!error && data) {
      setTransactions(data);
    }
    setLoading(false);
  };

  const totalBuy = transactions
    .filter(t => t.type === 'BUY')
    .reduce((sum, t) => sum + t.total_amount, 0);

  const totalSell = transactions
    .filter(t => t.type === 'SELL')
    .reduce((sum, t) => sum + t.total_amount, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-end mb-4">
        <div>
          <h1 className="text-4xl text-ink">Báo Cáo</h1>
          <p className="text-[10px] uppercase font-black text-neutral-400 tracking-widest mt-2 px-1">Truy xuất & Đối soát</p>
        </div>
        <button 
          onClick={fetchTransactions}
          className="bg-ink text-paper py-3 px-6 font-black uppercase text-xs tracking-widest flex items-center gap-2 hover:bg-gold-primary hover:text-ink transition-all shadow-lg"
        >
          <Search size={16} /> Lọc kết quả
        </button>
      </div>

      {/* Filters Pane */}
      <div className="bg-paper p-6 rounded-sm shadow-sm border border-neutral-100 grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="input-field">
          <label>Từ ngày</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div className="input-field">
          <label>Đến ngày</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        <div className="input-field">
          <label>Loại vàng</label>
          <select value={productId} onChange={e => setProductId(e.target.value)}>
            <option value="">Tất cả mặt hàng</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="input-field">
          <label>Số CCCD khách hàng</label>
          <input 
            type="text" 
            placeholder="Tìm theo CCCD..." 
            value={customerCCCD}
            onChange={e => setCustomerCCCD(e.target.value)}
          />
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-paper p-6 border-l-4 border-red-500 shadow-sm flex justify-between items-center">
          <div>
            <p className="text-[10px] uppercase font-black text-neutral-400 mb-1 tracking-widest">Tổng chi mua vào</p>
            <h3 className="text-2xl text-red-600">{formatCurrency(totalBuy)}</h3>
          </div>
          <ArrowDownCircle className="text-red-100" size={48} />
        </div>
        <div className="bg-paper p-6 border-l-4 border-vcb-blue shadow-sm flex justify-between items-center">
          <div>
            <p className="text-[10px] uppercase font-black text-neutral-400 mb-1 tracking-widest">Tổng thu bán ra</p>
            <h3 className="text-2xl text-vcb-blue">{formatCurrency(totalSell)}</h3>
          </div>
          <ArrowUpCircle className="text-green-100" size={48} />
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-paper rounded-sm shadow-sm border border-neutral-100 overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center bg-neutral-50 px-4 md:px-6">
          <span className="text-[10px] font-black uppercase text-neutral-400 italic">Dữ liệu chi tiết: {transactions.length} giao dịch</span>
          <button className="flex items-center gap-2 text-[10px] font-black uppercase text-ink hover:text-gold-primary">
            <Download size={14} /> <span className="hidden sm:inline">Xuất CSV</span>
          </button>
        </div>
        
        <div className="text-[10px] md:hidden px-4 py-2 bg-yellow-50 text-gold-dark border-b border-yellow-100 font-bold italic">
          &larr; Vuốt sang trái/phải để xem đầy đủ bảng &rarr;
        </div>

        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-ink text-paper">
                <th className="p-4 font-black uppercase text-[10px] tracking-widest text-center">Ngày/Giờ</th>
                <th className="p-4 font-black uppercase text-[10px] tracking-widest text-center">Loại GD</th>
                <th className="p-4 font-black uppercase text-[10px] tracking-widest">Đối tác (Khách hàng)</th>
                <th className="p-4 font-black uppercase text-[10px] tracking-widest">Chi tiết mặt hàng</th>
                <th className="p-4 font-black uppercase text-[10px] tracking-widest">Nhân viên</th>
                <th className="p-4 font-black uppercase text-[10px] tracking-widest text-right">Tổng thanh toán</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center font-bold text-neutral-300 italic">Đang tải dữ liệu...</td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center font-bold text-neutral-300 italic">Không tìm thấy giao dịch nào</td>
                </tr>
              ) : (
                transactions.map(t => (
                  <tr key={t.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="p-4 font-mono text-center">
                      <div className="font-bold text-ink text-[11px]">{new Date(t.created_at).toLocaleDateString('vi-VN')}</div>
                      <div className="text-neutral-400 text-[10px]">{new Date(t.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-sm ${t.type === 'BUY' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-vcb-blue'}`}>
                        {t.type === 'BUY' ? 'MUA VÀO' : 'BÁN RA'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="text-[9px] text-neutral-400 font-black uppercase mb-1">
                        {t.type === 'BUY' ? 'Người bán (Khách)' : 'Người mua (Khách)'}
                      </div>
                      <div className="text-sm font-bold uppercase truncate max-w-[180px]">{t.customer_name}</div>
                      <div className="text-[10px] font-mono text-neutral-400">{t.customer_cccd}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-bold italic text-ink text-sm">{t.product_name}</div>
                      <div className="text-[9px] text-neutral-400 flex items-center gap-1">
                        SL: <span className="font-bold text-ink">{t.quantity} {t.unit}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-xs font-bold text-ink">{t.salesperson?.full_name || 'Hệ thống'}</div>
                      <div className="text-[9px] text-neutral-400 truncate max-w-[120px]">{t.salesperson?.email || 'N/A'}</div>
                    </td>
                    <td className="p-4 font-mono font-black text-right text-sm">
                      <div className="text-[9px] text-neutral-400 mb-0.5">Đơn giá: {formatCurrency(t.price_per_unit)}</div>
                      <div className="text-ink">{formatCurrency(t.total_amount)}</div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Reports;
