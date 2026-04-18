import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Product, Transaction, SystemConfig } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { Camera, QrCode, CreditCard, Send, CheckCircle2, Search, ArrowLeftRight, X, XCircle } from 'lucide-react';
import QRScanner from '../../components/QRScanner';
import { parseCCCD, getVietQRUrl, getVCBDeepLink, formatCurrency } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const Transactions: React.FC = () => {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get('type') === 'BUY' ? 'BUY' : 'SELL';
  const [type, setType] = useState<'BUY' | 'SELL'>(initialType);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [config, setConfig] = useState<SystemConfig | null>(null);
  
  // Form State
  const [customerName, setCustomerName] = useState('');
  const [customerCCCD, setCustomerCCCD] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerBank, setCustomerBank] = useState('970436'); // Default VCB
  const [customerAccount, setCustomerAccount] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [customPrice, setCustomPrice] = useState<number>(0);
  const [showScanner, setShowScanner] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [qrUrl, setQrUrl] = useState('');
  const [lastError, setLastError] = useState<any>(null);

  useEffect(() => {
    const searchType = searchParams.get('type');
    if (searchType === 'BUY' || searchType === 'SELL') {
      setType(searchType);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchProducts();
    fetchConfig();
  }, []);

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*');
    if (data) setProducts(data);
  };

  const fetchConfig = async () => {
    const { data } = await supabase.from('system_config').select('*').single();
    if (data) setConfig(data);
  };

  useEffect(() => {
    if (selectedProduct) {
      setCustomPrice(type === 'BUY' ? selectedProduct.buy_price : selectedProduct.sell_price);
    } else {
      setCustomPrice(0);
    }
  }, [selectedProduct, type]);

  const currentPrice = customPrice;
  const totalAmount = currentPrice * quantity;

  const handleScan = (data: string | any) => {
    if (!data) return;
    
    console.log("Dữ liệu quét được:", data);
    
    // Case 1: Data is an object from AI analysis
    if (typeof data === 'object' && data.id && data.name) {
      setCustomerName(data.name);
      setCustomerCCCD(data.id);
      if (data.address) setCustomerAddress(data.address);
      setShowScanner(false);
      setLastError(null);
      return;
    }

    // Case 2: Data is a string from QR scan
    if (typeof data === 'string') {
      const info = parseCCCD(data);
      if (info) {
        setCustomerName(info.name);
        setCustomerCCCD(info.id);
        if (info.address) setCustomerAddress(info.address);
        setShowScanner(false);
        setLastError(null);
      } else {
        console.warn("Mã QR không đúng định dạng CCCD chuẩn:", data);
        const parts = data.split('|');
        if (parts.length > 2) {
          alert(`Dữ liệu quét được: "${data.substring(0, 30)}..." không khớp định dạng CCCD chuẩn. Vui lòng thử lại với thẻ CCCD gắn chip mới nhất.`);
        } else {
          alert("Không nhận diện được nội dung CCCD. Vui lòng đảm bảo bạn đang quét mã QR ở góc trên cùng bên phải của thẻ CCCD gắn chip.");
        }
      }
    }
  };

  const handleSubmit = async () => {
    if (!selectedProduct || !customerName || !customerCCCD) {
      alert("Vui lòng nhập đầy đủ thông tin");
      return;
    }

    const transaction: Partial<Transaction> = {
      type,
      customer_name: customerName,
      customer_cccd: customerCCCD,
      dia_chi: customerAddress,
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      quantity,
      unit: selectedProduct.unit,
      price_per_unit: currentPrice,
      total_amount: totalAmount,
      created_by: profile?.id,
    };

    setLastError(null);
    const { error } = await supabase.from('transactions').insert([transaction]);

    if (!error) {
      if (type === 'SELL') {
        const desc = `${customerName} ${customerCCCD} ${selectedProduct.name} x ${quantity} ${selectedProduct.unit}`;
        if (config && config.bank_id && config.account_no && config.account_holder) {
          const url = getVietQRUrl(config.bank_id, config.account_no, config.account_holder, totalAmount, desc);
          setQrUrl(url);
          setShowQR(true);
        } else {
          alert("Lỗi: Thông tin ngân hàng của cửa hàng chưa đầy đủ.");
        }
      } else {
        // Mode: BUY (Store buys from customer, Store pays customer)
        const memo = `NGHIATIN GOLD - [MUA VANG] - ${customerName}`;
        if (customerAccount) {
          setIsPaying(true);
          const deepLink = getVCBDeepLink(customerBank, customerAccount, totalAmount, memo);
          const imageUrl = getVietQRUrl(customerBank, customerAccount, customerName, totalAmount, memo);
          
          setQrUrl(imageUrl);
          
          // Direct redirection to preserve user gesture policy
          window.location.href = deepLink;
          
          // Still show success/fallback pane in background
          setTimeout(() => {
            setIsPaying(false);
            setShowSuccess(true);
          }, 800);
        } else {
          window.location.href = `vietcombank://`; 
          setShowSuccess(true);
        }
      }
    } else {
      setLastError(error);
      alert("Đã có lỗi xảy ra khi lưu giao dịch: " + (error.message || "Kiểm tra quyền truy cập database"));
    }
  };

  const resetForm = () => {
    setCustomerName('');
    setCustomerCCCD('');
    setCustomerAddress('');
    setCustomerAccount('');
    setQuantity(1);
    setSelectedProduct(null);
    setShowSuccess(false);
    setShowQR(false);
  };

  const { user } = useAuth();
  const currentUserEmail = user?.email;

  return (
    <div className="flex flex-col gap-6">
      {lastError && (
        <div className="bg-red-900/90 text-white p-6 rounded-sm text-xs font-mono mb-6 flex justify-between items-start backdrop-blur-sm border-l-4 border-red-500 shadow-xl">
          <div className="overflow-x-auto w-full">
            <p className="font-bold mb-3 text-sm flex items-center gap-2">
              <XCircle size={16} /> CẢNH BÁO LỖI HỆ THỐNG (TRANSACTION ERROR):
            </p>
            <div className="bg-black/30 p-4 rounded mb-4 border border-white/10">
              <pre className="whitespace-pre-wrap">{JSON.stringify(lastError, null, 2)}</pre>
            </div>
            <div className="bg-white/10 p-4 rounded text-red-100">
              <p className="font-bold mb-2 uppercase text-[10px] tracking-widest">Hướng dẫn khắc phục:</p>
              <ul className="list-disc ml-4 space-y-1">
                <li>Bước 1: Copy nội dung file <strong>supabase-setup.sql</strong> trong mã nguồn.</li>
                <li>Bước 2: Dán và chạy (Run) trong mục <strong>SQL Editor</strong> của Supabase Dashboard.</li>
                <li>Bước 3: Tải lại trang này (F5) và thử lại.</li>
              </ul>
              <p className="mt-4 italic text-[10px]">Tài khoản đang đăng nhập: <span className="font-bold text-white">{currentUserEmail}</span></p>
            </div>
          </div>
          <button onClick={() => setLastError(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors ml-4 focus:outline-none">
            <X size={20} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Transaction Control */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="transaction-pane"
      >
        <div className="flex bg-neutral-100 p-1 rounded-sm">
          <button 
            onClick={() => { setType('SELL'); setSelectedProduct(null); }}
            className={`btn-toggle ${type === 'SELL' ? 'active' : ''}`}
          >
            BÁN VÀNG
          </button>
          <button 
            onClick={() => { setType('BUY'); setSelectedProduct(null); }}
            className={`btn-toggle ${type === 'BUY' ? 'active' : ''}`}
          >
            MUA VÀNG
          </button>
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex justify-between items-end">
            <h3 className="text-2xl m-0">{type === 'SELL' ? 'Khách mua' : 'Mua của khách'}</h3>
            <button 
              onClick={() => setShowScanner(true)}
              className="flex items-center gap-2 text-[10px] font-black uppercase text-gold-dark border border-gold-primary/30 py-2 px-3 hover:bg-gold-primary hover:text-ink transition-all"
            >
              <Camera size={16} /> Quét CCCD
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="input-field">
              <label>Họ tên khách hàng</label>
              <input 
                type="text" 
                value={customerName} 
                onChange={(e) => setCustomerName(e.target.value)} 
                placeholder="Nguyễn Văn A" 
              />
            </div>
            <div className="input-field">
              <label>Số CCCD</label>
              <input 
                type="text" 
                value={customerCCCD} 
                onChange={(e) => setCustomerCCCD(e.target.value)} 
                placeholder="012345678912" 
              />
            </div>
          </div>

          {type === 'BUY' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="input-field">
                <label>Ngân hàng khách</label>
                <select value={customerBank} onChange={(e) => setCustomerBank(e.target.value)}>
                  <option value="970436">Vietcombank</option>
                  <option value="970415">VietinBank</option>
                  <option value="970418">BIDV</option>
                  <option value="970405">Agribank</option>
                  <option value="970422">MB Bank</option>
                  <option value="970423">TPBank</option>
                  <option value="970441">VIB</option>
                </select>
              </div>
              <div className="input-field">
                <label>Số tài khoản khách</label>
                <input 
                  type="text" 
                  value={customerAccount} 
                  onChange={(e) => setCustomerAccount(e.target.value)} 
                  placeholder="Để tự động điền vào app" 
                />
              </div>
            </div>
          )}

          <div className="input-field">
            <label>Địa chỉ</label>
            <input 
              type="text" 
              value={customerAddress} 
              onChange={(e) => setCustomerAddress(e.target.value)} 
              placeholder="Nơi thường trú" 
            />
          </div>

          <div className="input-field">
            <label>Mặt hàng gold</label>
            <select 
              className="w-full"
              value={selectedProduct?.id || ''} 
              onChange={(e) => {
                const p = products.find(x => x.id === e.target.value);
                setSelectedProduct(p || null);
              }}
            >
              <option value="">-- Chọn loại vàng --</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="input-field">
              <label>Số lượng ({selectedProduct?.unit || 'đơn vị'})</label>
              <input 
                type="number" 
                step="0.01" 
                value={quantity} 
                onChange={(e) => setQuantity(Number(e.target.value))} 
              />
            </div>
            <div className="input-field">
              <label>Đơn giá điều chỉnh (VND/{selectedProduct?.unit || 'đơn vị'})</label>
              <input 
                type="number"
                value={customPrice}
                className="font-mono font-bold text-lg bg-neutral-50 focus:bg-white"
                onChange={(e) => setCustomPrice(Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 pt-6 border-t border-neutral-100">
          <div className="flex justify-between items-center mb-6">
            <span className="text-[10px] uppercase font-black text-neutral-400">Tổng thanh toán</span>
            <span className="text-4xl font-black text-ink">{formatCurrency(totalAmount)}</span>
          </div>

          <button 
            onClick={handleSubmit}
            className={`vcb-btn w-full flex items-center justify-center gap-3 ${type === 'BUY' ? 'bg-ink' : ''}`}
          >
            {type === 'SELL' ? (
              <><QrCode size={20} /> Tạo mã thanh toán QR</>
            ) : (
              <><Send size={20} /> Thanh toán qua Vietcombank</>
            )}
          </button>
        </div>
      </motion.div>

      {/* Side Status / Result Pane */}
      <div className="relative">
        <AnimatePresence mode="wait">
          {showQR ? (
            <motion.div 
              key="qr"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white p-8 rounded-sm shadow-xl flex flex-col items-center text-center"
            >
              <h3 className="mb-4">Mã thanh toán VietQR</h3>
              <div className="bg-white p-2 border border-neutral-100 shadow-inner mb-6 ring-4 ring-neutral-50">
                <img 
                  src={qrUrl} 
                  alt="VietQR" 
                  className="w-72 h-auto" 
                  referrerPolicy="no-referrer" 
                />
              </div>
              
              <div className="w-full bg-neutral-50 p-4 rounded-sm border border-neutral-100 mb-6 text-left">
                <p className="text-[10px] uppercase font-black text-neutral-400 mb-2 tracking-widest">Nội dung chuyển khoản</p>
                <div className="flex justify-between items-center gap-4">
                  <span className="font-mono font-bold text-sm text-ink break-all">
                    {customerName} {customerCCCD} {selectedProduct?.name} x {quantity} {selectedProduct?.unit}
                  </span>
                  <button 
                    onClick={() => {
                      const desc = `${customerName} ${customerCCCD} ${selectedProduct?.name} x ${quantity} ${selectedProduct?.unit}`;
                      navigator.clipboard.writeText(desc);
                      alert("Đã sao chép nội dung!");
                    }}
                    className="shrink-0 p-2 hover:bg-neutral-200 rounded-full transition-colors"
                    title="Sao chép nội dung"
                  >
                    <CreditCard size={14} className="text-neutral-400" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 w-full mb-8">
                <div className="text-left">
                  <p className="text-[9px] uppercase font-black text-neutral-400 mb-1 tracking-tight">Chủ tài khoản</p>
                  <p className="text-xs font-bold">{config?.account_holder}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] uppercase font-black text-neutral-400 mb-1 tracking-tight">Số tài khoản</p>
                  <p className="text-xs font-bold">{config?.account_no}</p>
                </div>
              </div>
              
              <button 
                onClick={resetForm} 
                className="bg-ink text-paper w-full py-4 font-black uppercase text-xs tracking-widest hover:bg-gold-primary hover:text-ink transition-all shadow-lg mb-3"
              >
                Xác nhận đã nhận tiền
              </button>

              <button 
                onClick={() => {
                  if (config) {
                    const desc = `${customerName} ${customerCCCD} ${selectedProduct?.name} x ${quantity} ${selectedProduct?.unit}`;
                    window.location.href = getVCBDeepLink(config.bank_id, config.account_no, totalAmount, desc);
                  }
                }}
                className="w-full py-3 bg-vcb-blue text-white font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-ink transition-all"
              >
                <Send size={14} /> Mở App Vietcombank
              </button>
            </motion.div>
          ) : showSuccess ? (
            <motion.div 
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-8 rounded-sm shadow-xl flex flex-col items-center text-center border-t-8 border-vcb-blue"
            >
              <div className="w-16 h-16 bg-vcb-blue/10 rounded-full flex items-center justify-center mb-6">
                <CheckCircle2 size={32} className="text-vcb-blue" />
              </div>
              <h3 className="text-2xl mb-2 italic">Giao dịch đã ghi nhận</h3>
              <p className="text-xs text-neutral-500 mb-6 font-medium">Hệ thống đã cố gắng mở App ngân hàng. Nếu App chưa mở, vui lòng quét mã bên dưới hoặc bấm nút mở App.</p>
              
              <div className="bg-white p-2 border border-neutral-100 shadow-sm mb-6">
                <img 
                  src={qrUrl} 
                  alt="VietQR Fallback" 
                  className="w-56 h-auto" 
                  referrerPolicy="no-referrer" 
                />
              </div>

              <div className="flex flex-col gap-3 w-full">
                <button 
                  onClick={() => {
                    const memo = `NGHIATIN GOLD - [MUA VANG] - ${customerName}`;
                    window.location.href = getVCBDeepLink(customerBank, customerAccount, totalAmount, memo);
                  }}
                  className="w-full py-4 bg-vcb-blue text-white font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 hover:bg-ink transition-all shadow-md"
                >
                  <Send size={18} /> Thử mở lại App Ngân Hàng
                </button>
                <button 
                  onClick={resetForm}
                  className="w-full py-3 border border-neutral-200 text-neutral-400 font-black uppercase text-[10px] tracking-widest hover:border-ink hover:text-ink transition-all"
                >
                  Hoàn thành & Quay lại
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="hidden lg:flex flex-col items-center justify-center h-full text-neutral-300 gap-4"
            >
              <ArrowLeftRight size={80} strokeWidth={1} />
              <p className="font-black uppercase tracking-widest text-xs">Vui lòng nhập thông tin giao dịch</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {showScanner && (
        <QRScanner 
          onScan={handleScan} 
          onClose={() => setShowScanner(false)} 
        />
      )}

      {/* Payment Loading Overlay */}
      <AnimatePresence>
        {isPaying && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink/80 backdrop-blur-md z-[100] flex flex-col items-center justify-center text-paper"
          >
            <div className="w-24 h-24 border-t-2 border-gold-primary rounded-full animate-spin mb-8"></div>
            <h2 className="text-2xl italic mb-2">Đang kết nối...</h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gold-primary">Chuẩn bị mở App Vietcombank</p>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
};

export default Transactions;
