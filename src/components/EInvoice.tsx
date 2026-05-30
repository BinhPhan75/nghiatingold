import React, { useState, useEffect } from 'react';
import { FileText, Settings, CheckCircle, XCircle, AlertCircle, Save, RefreshCw, Send, Eye, EyeOff, Loader2, Building2, FileCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ViettelConfig {
  id?: string;
  username: string;
  password: string;
  tax_code: string;
  api_url: string;
  template_code: string;
  invoice_series: string;
  is_sandbox: boolean;
  company_name: string;
  company_address: string;
  _hasPassword?: boolean;
  updated_at?: string;
}

const DEFAULT_CONFIG: ViettelConfig = {
  username: '',
  password: '',
  tax_code: '',
  api_url: 'https://api-vinvoice.viettel.vn',
  template_code: '',
  invoice_series: '',
  is_sandbox: true,
  company_name: '',
  company_address: '',
};

type Tab = 'config' | 'invoice';

export default function EInvoice() {
  const [activeTab, setActiveTab] = useState<Tab>('config');
  const [config, setConfig] = useState<ViettelConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Trạng thái kiểm tra kết nối
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Trạng thái tạo hóa đơn
  const [previewingInvoice, setPreviewingInvoice] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [invoiceResult, setInvoiceResult] = useState<{
    success: boolean;
    message: string;
    raw?: any;
  } | null>(null);

  // Dữ liệu mẫu hóa đơn (Có thể binding từ giỏ hàng / đơn hàng thực tế của SmartShop)
  const [invoicePayload, setInvoicePayload] = useState({
    buyerName: 'Nguyễn Văn A',
    buyerTaxCode: '',
    buyerPhone: '0901234567',
    buyerEmail: 'nguyenvana@gmail.com',
    buyerAddress: '123 Đường Lê Lợi, Đà Nẵng',
    paymentMethodName: 'TM/CK',
    items: [
      {
        itemName: 'Nhẫn vàng 9999 Nghĩa Tín',
        unitName: 'Chỉ',
        unitPrice: 8500000,
        quantity: 1,
        totalAmount: 8500000,
        taxPercentage: -1, // Không chịu thuế hoặc theo phương pháp trực tiếp tính trên giá trị gia tăng
        taxAmount: 0,
      }
    ]
  });

  // Hàm bổ trợ lấy token đăng nhập để gửi lên API bảo mật
  const getAuthHeaders = () => {
    // Tìm token supabase lưu ở localStorage (nếu có) để vượt qua bộ lọc requireAdmin ở backend
    const sbKey = Object.keys(localStorage).find(el => el.startsWith('sb-') && el.endsWith('-auth-token'));
    let token = '';
    if (sbKey) {
      try {
        const obj = JSON.parse(localStorage.getItem(sbKey) || '{}');
        token = obj.access_token || '';
      } catch (e) {
        console.error(e);
      }
    }
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  // Tải cấu hình từ database khi vào trang
  const fetchConfig = () => {
    setLoading(true);
    setTestResult(null);
    
    fetch('/api/viettel-config', {
      headers: getAuthHeaders()
    })
      .then((res) => res.json())
      .then((data) => {
        if (data && data.config) {
          setConfig({
            ...DEFAULT_CONFIG,
            ...data.config,
            // Nếu backend thông báo đã có mật khẩu trong DB, hiển thị chuỗi giả lập
            password: data.config._hasPassword ? '********' : '',
            _hasPassword: data.config._hasPassword
          });
        }
      })
      .catch((err) => {
        console.error('Lỗi tải cấu hình Viettel:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  // Lưu thông tin cấu hình vào database
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/viettel-config', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(config),
      });

      const data = await res.json();
      if (res.ok) {
        alert('Lưu cấu hình kết nối Viettel thành công!');
        fetchConfig(); // Re-load lại data mới nhất
      } else {
        alert(`Lỗi: ${data.description || 'Không thể lưu cấu hình'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Đã xảy ra lỗi kết nối khi lưu cấu hình.');
    } finally {
      setSaving(false);
    }
  };

  // Kiểm tra kết nối tới máy chủ Viettel (Test Connection)
  const handleTestConnection = async () => {
    if (!config.username || !config.tax_code) {
      alert('Vui lòng điền Tên đăng nhập và Mã số thuế trước khi kiểm tra!');
      return;
    }
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/viettel-test', {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      const data = await res.json();
      setTestResult({
        success: res.ok && data.success,
        message: data.message || data.description || 'Không nhận được phản hồi hợp lệ từ server.'
      });
    } catch (err) {
      console.error(err);
      setTestResult({
        success: false,
        message: 'Lỗi kết nối API kiểm tra. Vui lòng kiểm tra lại mạng hoặc log server.'
      });
    } finally {
      setTesting(false);
    }
  };

  // Gửi lập hóa đơn nháp hoặc Xem trước hóa đơn
  const submitInvoice = async (mode: 'preview' | 'draft') => {
    if (mode === 'preview') setPreviewingInvoice(true);
    else setCreatingInvoice(true);
    setInvoiceResult(null);

    try {
      const res = await fetch('/api/viettel-invoice', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          mode,
          payload: invoicePayload
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setInvoiceResult({
          success: true,
          message: mode === 'preview' 
            ? `Tạo bản xem trước thành công! Mã giao dịch: ${data.transactionUuid || 'N/A'}`
            : `Đã phát hành hóa đơn nháp lên hệ thống Viettel! Số hóa đơn tạm tính: ${data.invoiceNo || 'Chờ cấp sổ'}`,
          raw: data
        });
      } else {
        setInvoiceResult({
          success: false,
          message: data.description || 'Viettel từ chối xử lý dữ liệu hóa đơn.',
          raw: data
        });
      }
    } catch (err) {
      console.error(err);
      setInvoiceResult({
        success: false,
        message: 'Lỗi kết nối hệ thống hóa đơn backend.'
      });
    } finally {
      setPreviewingInvoice(false);
      setCreatingInvoice(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4 md:p-6 space-y-6 text-zinc-100">
      {/* Tiêu đề góc quản lý */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-black bg-gradient-to-r from-gold-400 to-amber-200 bg-clip-text text-transparent flex items-center gap-2">
            <Building2 className="text-gold-500" /> HÓA ĐƠN ĐIỆN TỬ VIETTEL VINVOICE
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Quản lý tích hợp kết nối hệ thống phát hành hóa đơn tự động cho NghiaTinGold
          </p>
        </div>

        {/* Các tab chuyển đổi */}
        <div className="flex bg-zinc-900 border border-zinc-800 p-1 rounded-xl">
          <button onClick={() => setActiveTab('config')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'config' ? 'bg-gold-500 text-luxury-black shadow-md' : 'text-zinc-400 hover:text-zinc-200'}`}>
            <Settings size={16} /> Cấu hình hệ thống
          </button>
          <button onClick={() => setActiveTab('invoice')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${activeTab === 'invoice' ? 'bg-gold-500 text-luxury-black shadow-md' : 'text-zinc-400 hover:text-zinc-200'}`}>
            <FileText size={16} /> Thử nghiệm xuất hóa đơn
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-20 gap-3 text-zinc-400">
            <Loader2 className="animate-spin text-gold-500" size={36} />
            <p className="text-sm font-medium">Đang tải dữ liệu cấu hình viettel_einvoice_config...</p>
          </motion.div>
        ) : (
          <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
            
            {/* TAB 1: CẤU HÌNH KẾT NỐI */}
            {activeTab === 'config' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <form onSubmit={handleSaveConfig} className="lg:col-span-2 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-6">
                  <div className="border-b border-zinc-800 pb-3 flex justify-between items-center">
                    <h3 className="text-base font-bold text-zinc-200 flex items-center gap-2">
                      Thông tin kết nối API tài khoản
                    </h3>
                    <span className={`text-xs px-2 py-1 rounded-md font-bold ${config.is_sandbox ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                      {config.is_sandbox ? 'Môi trường Thử nghiệm (Sandbox)' : 'Môi trường Thực tế (Production)'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Mã số thuế doanh nghiệp</label>
                      <input type="text" required value={config.tax_code} onChange={e => setConfig({ ...config, tax_code: e.target.value })}
                        placeholder="Ví dụ: 0312345678" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-gold-500 focus:ring-1 focus:ring-gold-500 outline-none transition-all" />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Tên đăng nhập hệ thống (Username)</label>
                      <input type="text" required value={config.username} onChange={e => setConfig({ ...config, username: e.target.value })}
                        placeholder="Thường trùng với mã số thuế" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-gold-500 focus:ring-1 focus:ring-gold-500 outline-none transition-all" />
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Mật khẩu API (Password)</label>
                      <div className="relative">
                        <input type={showPassword ? 'text' : 'password'} value={config.password} onChange={e => setConfig({ ...config, password: e.target.value })}
                          placeholder={config._hasPassword ? '******** (Đã lưu mật khẩu cũ)' : 'Nhập mật khẩu hóa đơn điện tử'} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-4 pr-12 py-3 text-sm focus:border-gold-500 focus:ring-1 focus:ring-gold-500 outline-none transition-all" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors">
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Đường dẫn máy chủ API Viettel (Base URL)</label>
                      <input type="url" required value={config.api_url} onChange={e => setConfig({ ...config, api_url: e.target.value })}
                        placeholder="https://api-vinvoice.viettel.vn" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-gold-500 focus:ring-1 focus:ring-gold-500 outline-none transition-all" />
                    </div>
                  </div>

                  <div className="border-b border-zinc-800 pt-2 pb-3">
                    <h3 className="text-base font-bold text-zinc-200">Thông tin hiển thị trên mẫu hóa đơn</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Mẫu số hóa đơn (Template Code)</label>
                      <input type="text" required value={config.template_code} onChange={e => setConfig({ ...config, template_code: e.target.value })}
                        placeholder="Ví dụ: 1GTKT0/001 hoặc 1/001" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-gold-500 focus:ring-1 focus:ring-gold-500 outline-none transition-all" />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Ký hiệu hóa đơn (Invoice Series)</label>
                      <input type="text" required value={config.invoice_series} onChange={e => setConfig({ ...config, invoice_series: e.target.value })}
                        placeholder="Ví dụ: C26TAA" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-gold-500 focus:ring-1 focus:ring-gold-500 outline-none transition-all" />
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Tên đơn vị bán hàng (Company Name)</label>
                      <input type="text" required value={config.company_name} onChange={e => setConfig({ ...config, company_name: e.target.value })}
                        placeholder="Công ty TNHH Vàng Bạc Đá Quý Nghĩa Tín" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-gold-500 focus:ring-1 focus:ring-gold-500 outline-none transition-all" />
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Địa chỉ doanh nghiệp (Company Address)</label>
                      <input type="text" required value={config.company_address} onChange={e => setConfig({ ...config, company_address: e.target.value })}
                        placeholder="Địa chỉ đăng ký kinh doanh hiển thị trên hóa đơn" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-gold-500 focus:ring-1 focus:ring-gold-500 outline-none transition-all" />
                    </div>

                    <div className="md:col-span-2 bg-zinc-950 p-4 border border-zinc-800 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-zinc-300">Chế độ kiểm thử (Sandbox)</p>
                        <p className="text-xs text-zinc-500 mt-0.5">Bật tùy chọn này để không phát hành hóa đơn thật, tránh ảnh hưởng báo cáo thuế.</p>
                      </div>
                      <input type="checkbox" checked={config.is_sandbox} onChange={e => setConfig({ ...config, is_sandbox: e.target.checked })}
                        className="w-5 h-5 rounded text-gold-500 focus:ring-gold-500 bg-zinc-900 border-zinc-700 accent-gold-500 cursor-pointer" />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-2 border-t border-zinc-800">
                    <button type="button" onClick={handleTestConnection} disabled={testing || saving}
                      className="flex items-center gap-2 px-5 py-2.5 border border-zinc-700 font-bold text-sm rounded-xl hover:bg-zinc-800 transition-colors disabled:opacity-50">
                      {testing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                      Kiểm tra kết nối
                    </button>
                    <button type="submit" disabled={saving || testing}
                      className="flex items-center gap-2 px-6 py-2.5 bg-gold-500 text-luxury-black font-bold text-sm rounded-xl hover:bg-gold-400 transition-all shadow-md disabled:opacity-50">
                      {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                      Lưu cấu hình
                    </button>
                  </div>
                </form>

                {/* Kết quả kiểm thử kết nối */}
                <div className="space-y-4">
                  <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-2xl space-y-3">
                    <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wide">Trạng thái vận hành</h4>
                    {testResult ? (
                      <div className={`p-4 border rounded-xl space-y-2 ${testResult.success ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/5 border-rose-500/20 text-rose-400'}`}>
                        <div className="flex items-start gap-2.5">
                          {testResult.success ? <CheckCircle className="shrink-0 mt-0.5" size={18} /> : <XCircle className="shrink-0 mt-0.5" size={18} />}
                          <div className="text-xs font-medium leading-relaxed">
                            <p className="font-bold mb-1 text-sm">{testResult.success ? 'KẾT NỐI THÀNH CÔNG' : 'LỖI KẾT NỐI'}</p>
                            {testResult.message}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-500 flex items-center gap-2">
                        <AlertCircle size={16} /> Chưa có dữ liệu kiểm thử kết nối gần đây. Hãy nhấn nút "Kiểm tra kết nối".
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: THỬ NGHIỆM XUẤT HÓA ĐƠN */}
            {activeTab === 'invoice' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  {/* Form thông tin hóa đơn giả lập */}
                  <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-2xl space-y-4">
                    <h3 className="text-base font-bold text-zinc-200 border-b border-zinc-800 pb-2 flex items-center gap-2">
                      <FileCheck className="text-gold-500" /> Dữ liệu hóa đơn thử nghiệm
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-zinc-500">Tên người mua hàng</label>
                        <input type="text" value={invoicePayload.buyerName} onChange={e => setInvoicePayload({...invoicePayload, buyerName: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-zinc-500">Mã số thuế người mua (nếu có)</label>
                        <input type="text" value={invoicePayload.buyerTaxCode} onChange={e => setInvoicePayload({...invoicePayload, buyerTaxCode: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm" placeholder="Để trống nếu là khách lẻ" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-zinc-500">Số điện thoại</label>
                        <input type="text" value={invoicePayload.buyerPhone} onChange={e => setInvoicePayload({...invoicePayload, buyerPhone: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-zinc-500">Email nhận hóa đơn</label>
                        <input type="email" value={invoicePayload.buyerEmail} onChange={e => setInvoicePayload({...invoicePayload, buyerEmail: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm" />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <label className="text-xs font-bold text-zinc-500">Địa chỉ người mua</label>
                        <input type="text" value={invoicePayload.buyerAddress} onChange={e => setInvoicePayload({...invoicePayload, buyerAddress: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm" />
                      </div>
                    </div>

                    {/* Chi tiết mặt hàng */}
                    <div className="pt-3">
                      <p className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-2">Thông tin mặt hàng vàng bạc/trang sức</p>
                      <div className="overflow-x-auto border border-zinc-800 rounded-xl bg-zinc-950">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-zinc-900 border-b border-zinc-800 text-zinc-400 font-bold">
                              <th className="p-3">Tên sản phẩm</th>
                              <th className="p-3">ĐVT</th>
                              <th className="p-3 text-right">Đơn giá</th>
                              <th className="p-3 text-center">SL</th>
                              <th className="p-3 text-right">Thành tiền</th>
                            </tr>
                          </thead>
                          <tbody>
                            {invoicePayload.items.map((item, idx) => (
                              <tr key={idx} className="border-b border-zinc-900 last:border-none">
                                <td className="p-3 font-semibold text-zinc-200">{item.itemName}</td>
                                <td className="p-3 text-zinc-400">{item.unitName}</td>
                                <td className="p-3 text-right text-zinc-300">{item.unitPrice.toLocaleString()} đ</td>
                                <td className="p-3 text-center font-bold text-zinc-200">{item.quantity}</td>
                                <td className="p-3 text-right font-bold text-gold-400">{item.totalAmount.toLocaleString()} đ</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Thanh điều hướng thao tác hành động */}
                  <div className="flex flex-wrap items-center justify-end gap-3 bg-zinc-900/30 p-4 border border-zinc-800 rounded-2xl">
                    <button onClick={() => submitInvoice('preview')} disabled={previewingInvoice || creatingInvoice}
                      className="flex items-center gap-2 px-6 py-3 bg-zinc-800 border border-zinc-700 text-zinc-200 font-bold text-sm rounded-xl hover:bg-zinc-700 transition-all disabled:opacity-50">
                      {previewingInvoice ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
                      Xem trước hóa đơn
                    </button>

                    <button onClick={() => submitInvoice('draft')} disabled={previewingInvoice || creatingInvoice}
                      className="flex items-center gap-2 px-6 py-3 bg-gold-500 text-luxury-black font-bold text-sm rounded-xl hover:bg-gold-400 transition-all shadow-lg shadow-gold-500/10 disabled:opacity-50">
                      {creatingInvoice ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                      Lập hóa đơn nháp
                    </button>
                  </div>
                </div>

                {/* Khối hiển thị kết quả phát hành hóa đơn */}
                <div className="space-y-4">
                  <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-2xl space-y-4">
                    <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wide border-b border-zinc-800 pb-2">Kết quả xử lý từ Viettel</h4>
                    
                    {invoiceResult ? (
                      <div className={`p-4 border rounded-xl space-y-3 text-xs ${invoiceResult.success ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/5 border-rose-500/20 text-rose-400'}`}>
                        <div className="flex items-start gap-2">
                          {invoiceResult.success ? <CheckCircle className="shrink-0 mt-0.5" size={16} /> : <XCircle className="shrink-0 mt-0.5" size={16} />}
                          <p className="font-bold text-sm">{invoiceResult.success ? 'PHÁT HÀNH THÀNH CÔNG' : 'THẤT BẠI'}</p>
                        </div>
                        <p className="leading-relaxed text-zinc-300">{invoiceResult.message}</p>
                        
                        {invoiceResult.raw && (
                          <div className="pt-2">
                            <p className="font-bold text-zinc-400 mb-1">Dữ liệu gốc phản hồi (RAW JSON):</p>
                            <pre className="p-2.5 bg-zinc-950 border border-zinc-850 rounded-lg text-[10px] text-zinc-400 overflow-x-auto max-h-48 font-mono">
                              {JSON.stringify(invoiceResult.raw, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-500 flex items-center gap-2">
                        <AlertCircle size={16} /> Chưa thực hiện lệnh phát hành. Hãy chọn một hành động ở mục bên cạnh.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
