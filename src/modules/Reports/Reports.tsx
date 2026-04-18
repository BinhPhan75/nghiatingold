import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Transaction, Product } from '../../types';
import { Search, Filter, Download, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';

import { useAuth } from '../../contexts/AuthContext';

const Reports: React.FC = () => {
  const { profile, isAdmin, loading: authLoading } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastError, setLastError] = useState<any>(null);
  const [dbStatus, setDbStatus] = useState<{ connected: boolean; message: string }>({ 
    connected: true, message: '' 
  });

  // Filter State - Use local date for better UX in Vietnam (UTC+7)
  const getLocalDate = () => {
    const now = new Date();
    const vnTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    return vnTime.toISOString().split('T')[0];
  };

  const localToday = getLocalDate();
  const [startDate, setStartDate] = useState(localToday);
  const [endDate, setEndDate] = useState(localToday);
  const [productId, setProductId] = useState('');
  const [customerCCCD, setCustomerCCCD] = useState('');

  useEffect(() => {
    fetchProducts();
    fetchTransactions();
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const { error } = await supabase.from('transactions').select('count', { count: 'exact', head: true });
      if (error) throw error;
      setDbStatus({ connected: true, message: '' });
    } catch (err: any) {
      setDbStatus({ 
        connected: false, 
        message: err.message || 'Không thể kết nối tới cơ sở dữ liệu.' 
      });
      setLastError(err);
    }
  };

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

    try {
      const { data, error } = await query;
      if (error) throw error;
      setTransactions(data || []);
      setLastError(null);
    } catch (err: any) {
      console.error("Fetch Transactions Error:", err);
      setLastError(err);
    } finally {
      setLoading(false);
    }
  };

  const totalBuy = transactions
    .filter(t => t.type === 'BUY')
    .reduce((sum, t) => sum + t.total_amount, 0);

  const totalSell = transactions
    .filter(t => t.type === 'SELL')
    .reduce((sum, t) => sum + t.total_amount, 0);

  const totalCashAcross = transactions.reduce((sum, t) => sum + (t.tien_mat || 0), 0);
  const totalTransferAcross = transactions.reduce((sum, t) => sum + (t.chuyen_khoan || 0), 0);

  const handleExport = () => {
    if (transactions.length === 0) {
      alert("Không có dữ liệu để xuất.");
      return;
    }

    const headers = [
      "Thời gian",
      "Loại GD",
      "Khách hàng",
      "CCCD",
      "Địa chỉ",
      "Mặt hàng",
      "Số lượng",
      "Đơn vị",
      "Đơn giá",
      "Tổng tiền",
      "Tiền mặt",
      "Chuyển khoản",
      "Nhân viên"
    ];

    const rows = transactions.map(t => [
      new Date(t.created_at).toLocaleString('vi-VN'),
      t.type === 'BUY' ? "MUA VÀO" : "BÁN RA",
      t.customer_name,
      `'${t.customer_cccd}`, // Prefix with ' to avoid Excel numeric formatting
      t.dia_chi || "",
      t.product_name,
      t.quantity,
      t.unit,
      t.price_per_unit,
      t.total_amount,
      t.tien_mat || 0,
      t.chuyen_khoan || 0,
      t.salesperson?.full_name || "Hệ thống"
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `bao_cao_giao_dich_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center p-20 italic text-neutral-400 font-bold">
        Đang xác thực quyền hạn...
      </div>
    );
  }

  const currentUserEmail = profile?.email;

  return (
    <div className="flex flex-col gap-6">
      {/* Error & Diagnostic Panel */}
      {lastError && (
        <div className="bg-red-50 border-l-4 border-red-500 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <Filter className="text-red-500 shrink-0 mt-1" size={24} />
            <div className="flex-1">
              <h3 className="text-red-800 font-black uppercase text-xs tracking-widest mb-2">Lỗi truy xuất dữ liệu</h3>
              <p className="text-sm text-red-700 mb-4 font-medium">
                {lastError.message || 'Có lỗi xảy ra khi tải báo cáo.'}
              </p>
              
              {lastError.code === '42P01' ? (
                <div className="bg-white/50 p-4 rounded border border-red-100 mb-4">
                  <p className="font-bold text-xs text-red-800 uppercase mb-2">Nguyên nhân: Thiếu bảng giao dịch</p>
                  <p className="text-xs text-red-700">Database của bạn chưa có bảng <strong>transactions</strong>. Vui lòng chạy script cài đặt trong mục Hệ Thống.</p>
                </div>
              ) : lastError.message?.includes('relationship') ? (
                <div className="bg-white/50 p-4 rounded border border-red-100 mb-4">
                  <p className="font-bold text-xs text-red-800 uppercase mb-2">Lỗi quan hệ database (Relationship Error)</p>
                  <p className="text-[11px] text-red-700 mb-3">PostgREST không tìm thấy liên kết giữa bảng giao dịch và thông tin nhân viên. Bạn cần chạy lệnh SQL sau để sửa:</p>
                  <div className="bg-black text-[10px] p-3 font-mono text-green-400 select-all whitespace-pre overflow-x-auto">
{`ALTER TABLE transactions 
DROP CONSTRAINT IF EXISTS transactions_created_by_fkey;

ALTER TABLE transactions 
ADD CONSTRAINT transactions_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES profiles(id);`}
                  </div>
                </div>
              ) : (lastError.code === 'PGRST301' || lastError.message?.includes('JWT')) ? (
                <div className="bg-white/50 p-4 rounded border border-red-100 mb-4">
                  <p className="font-bold text-xs text-red-800 uppercase mb-2">Nguyên nhân: Hết hạn phiên làm việc</p>
                  <p className="text-xs text-red-700">Vui lòng đăng xuất và đăng nhập lại để làm mới quyền truy cập.</p>
                </div>
              ) : (lastError.message?.includes('permission denied') || !dbStatus.connected) && (
                <div className="bg-white/50 p-4 rounded border border-red-100 mb-4">
                  <p className="font-bold text-xs text-red-800 uppercase mb-2 text-center py-2 bg-red-100 mb-3">Chẩn đoán lỗi RLS (Quyền truy cập)</p>
                  <div className="space-y-3 text-[11px] text-red-900 leading-relaxed font-medium">
                    <p>Hệ thống không thể đọc dữ liệu báo cáo. Điều này thường do <strong>Row Level Security (RLS)</strong> chưa được cấu hình cho tài khoản của bạn.</p>
                    <div className="bg-white p-2 border border-red-200 font-mono text-[10px]">
                      Email hiện tại: <span className="font-bold select-all underline text-blue-600">{currentUserEmail || 'n/a'}</span>
                    </div>
                    <p>Để khắc phục:</p>
                    <ol className="list-decimal ml-4 space-y-1">
                      <li>Vào mục <strong>Hệ Thống</strong> &rarr; <strong>Kiểm Tra Kết Nối</strong></li>
                      <li>Copy email ở trên dán vào file <strong>supabase-setup.sql</strong></li>
                      <li>Chạy SQL script đó trong trang quản trị Supabase</li>
                    </ol>
                  </div>
                </div>
              )}
              
              <button 
                onClick={() => { setLastError(null); fetchTransactions(); }}
                className="text-[10px] font-black uppercase text-red-600 underline underline-offset-4"
              >
                Thử lại ngay
              </button>
            </div>
          </div>
        </div>
      )}

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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-paper p-4 border-l-4 border-red-500 shadow-sm">
          <p className="text-[10px] uppercase font-black text-neutral-400 mb-1 tracking-widest flex items-center gap-1">
            <ArrowDownCircle size={10} /> Chi mua vào
          </p>
          <h3 className="text-xl font-bold text-ink">{formatCurrency(totalBuy)}</h3>
        </div>
        <div className="bg-paper p-4 border-l-4 border-vcb-blue shadow-sm">
          <p className="text-[10px] uppercase font-black text-neutral-400 mb-1 tracking-widest flex items-center gap-1">
            <ArrowUpCircle size={10} /> Thu bán ra
          </p>
          <h3 className="text-xl font-bold text-ink">{formatCurrency(totalSell)}</h3>
        </div>
        <div className="bg-paper p-4 border-l-4 border-orange-500 shadow-sm">
          <p className="text-[10px] uppercase font-black text-neutral-400 mb-1 tracking-widest">Tổng tiền mặt</p>
          <h3 className="text-xl font-bold text-ink">{formatCurrency(totalCashAcross)}</h3>
        </div>
        <div className="bg-paper p-4 border-l-4 border-green-600 shadow-sm">
          <p className="text-[10px] uppercase font-black text-neutral-400 mb-1 tracking-widest">Tổng chuyển khoản</p>
          <h3 className="text-xl font-bold text-ink">{formatCurrency(totalTransferAcross)}</h3>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-paper rounded-sm shadow-sm border border-neutral-100 overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center bg-neutral-50 px-4 md:px-6">
          <span className="text-[10px] font-black uppercase text-neutral-400 italic">Dữ liệu chi tiết: {transactions.length} giao dịch</span>
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 text-[10px] font-black uppercase text-ink hover:text-gold-primary"
          >
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
                <th className="p-4 font-black uppercase text-[10px] tracking-widest text-center">Thời gian</th>
                <th className="p-4 font-black uppercase text-[10px] tracking-widest text-center">Loại GD</th>
                <th className="p-4 font-black uppercase text-[10px] tracking-widest">Khách hàng & Địa chỉ</th>
                <th className="p-4 font-black uppercase text-[10px] tracking-widest">Mặt hàng</th>
                <th className="p-4 font-black uppercase text-[10px] tracking-widest">Người thực hiện</th>
                <th className="p-4 font-black uppercase text-[10px] tracking-widest text-right">Thành tiền</th>
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
                      <div className="text-[10px] font-mono text-neutral-400 mb-1">{t.customer_cccd}</div>
                      {t.dia_chi && (
                        <div className="text-[9px] text-neutral-500 italic truncate max-w-[200px] leading-tight" title={t.dia_chi}>
                          Đ/C: {t.dia_chi}
                        </div>
                      )}
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
