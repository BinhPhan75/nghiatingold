import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Product, Transaction, SystemConfig, Bank } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { Camera, QrCode, CreditCard, Send, CheckCircle2, Search, ArrowLeftRight, X, XCircle } from 'lucide-react';
import QRScanner from '../../components/QRScanner';
import { parseCCCD, getVietQRUrl, formatCurrency, removeVietnameseTones } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const Transactions: React.FC = () => {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get('type') === 'BUY' ? 'BUY' : 'SELL';
  const [type, setType] = useState<'BUY' | 'SELL'>(initialType);
  const [products, setProducts] = useState<Product[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [config, setConfig] = useState<SystemConfig | null>(null);
  
  // Form State
  const [customerName, setCustomerName] = useState('');
  const [customerCCCD, setCustomerCCCD] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerBankId, setCustomerBankId] = useState('');
  const [customerAccountNo, setCustomerAccountNo] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [customPrice, setCustomPrice] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [showScanner, setShowScanner] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [qrUrl, setQrUrl] = useState('');
  const [lastError, setLastError] = useState<any>(null);

  // Handheld Scanner Support
  const scanBuffer = React.useRef<string>('');
  const lastKeyTime = React.useRef<number>(0);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignore if in diagnostic or specific contexts where we don't want to steal focus
      if (showScanner || showSuccess || showQR) return;
      
      // Scanners usually send keys very fast (< 30ms)
      const now = Date.now();
      const isFast = now - lastKeyTime.current < 50;
      lastKeyTime.current = now;

      if (e.key === 'Enter') {
        const data = scanBuffer.current.trim();
        if (data.includes('|') && data.split('|').length >= 6) {
          e.preventDefault();
          const info = parseCCCD(data);
          if (info) {
            setCustomerName(info.name);
            setCustomerCCCD(info.id);
            if (info.address) setCustomerAddress(info.address);
            scanBuffer.current = '';
            // Optional: visual feedback
            const notification = document.createElement('div');
            notification.className = 'fixed bottom-4 right-4 bg-ink text-gold-primary px-6 py-3 rounded-sm shadow-2xl z-50 font-black uppercase text-[10px] tracking-widest animate-in fade-in slide-in-from-bottom-4';
            notification.innerText = 'Đã nhận dạng CCCD từ máy quét';
            document.body.appendChild(notification);
            setTimeout(() => notification.remove(), 3000);
          }
        }
        scanBuffer.current = '';
      } else if (e.key.length === 1) {
        if (!isFast && scanBuffer.current.length > 0) {
          // If it was slow, reset buffer because it's manual typing
          scanBuffer.current = e.key;
        } else {
          scanBuffer.current += e.key;
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [showScanner, showSuccess, showQR]);

  useEffect(() => {
    const searchType = searchParams.get('type');
    if (searchType === 'BUY' || searchType === 'SELL') {
      setType(searchType);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchProducts();
    fetchConfig();
    fetchBanks();
  }, []);

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*');
    if (data) setProducts(data);
  };

  const fetchConfig = async () => {
    const { data } = await supabase.from('system_config').select('*').limit(1);
    if (data && data.length > 0) setConfig(data[0]);
  };

  const fetchBanks = async () => {
    const { data } = await supabase.from('banks').select('*').order('short_name');
    if (data) setBanks(data);
  };

  useEffect(() => {
    if (selectedProduct) {
      setCustomPrice(type === 'BUY' ? selectedProduct.buy_price : selectedProduct.sell_price);
    } else {
      setCustomPrice(0);
    }
  }, [selectedProduct, type]);

  const currentPrice = customPrice;
  const subtotal = currentPrice * quantity;
  const totalAmount = Math.max(0, subtotal - discount);

  useEffect(() => {
    // Default: transferAmount = totalAmount, cashAmount = 0
    setTransferAmount(totalAmount - cashAmount);
  }, [totalAmount]);

  const handleCashChange = (val: number) => {
    setCashAmount(val);
    setTransferAmount(Math.max(0, totalAmount - val));
  };

  const handleTransferChange = (val: number) => {
    setTransferAmount(val);
    setCashAmount(Math.max(0, totalAmount - val));
  };

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

    const transaction: Omit<Transaction, 'id'> = {
      type,
      customer_name: customerName,
      customer_cccd: customerCCCD,
      dia_chi: customerAddress,
      customer_bank_id: type === 'BUY' ? customerBankId : undefined,
      customer_account_no: type === 'BUY' ? customerAccountNo : undefined,
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      quantity,
      unit: selectedProduct.unit,
      price_per_unit: currentPrice,
      total_amount: totalAmount,
      chiet_khau: discount,
      tien_mat: cashAmount,
      chuyen_khoan: transferAmount,
      created_at: new Date().toISOString(),
      created_by: profile?.id || 'anonymous',
    };

    setLastError(null);
    try {
      const { error } = await supabase.from('transactions').insert([transaction]);
      if (error) throw error;
      
      if (type === 'SELL') {
        const desc = removeVietnameseTones(`${customerName} ${customerCCCD} ${selectedProduct.name} x ${quantity} ${selectedProduct.unit}`);
        if (config && config.bank_id && config.account_no && config.account_holder) {
          const url = getVietQRUrl(config.bank_id, config.account_no, config.account_holder, transferAmount || totalAmount, desc);
          setQrUrl(url);
          setShowQR(true);
        } else {
          alert("Lỗi: Thông tin ngân hàng của cửa hàng chưa đầy đủ.");
        }
      } else {
        // For BUY transactions, generate QR for the SHOP to pay CUSTOMER
        if (transferAmount > 0 && customerBankId && customerAccountNo) {
          const bank = banks.find(b => b.id === customerBankId);
          if (bank) {
            const desc = removeVietnameseTones(`NGHIA TIN THANH TOAN TIEN MUA ${quantity} ${selectedProduct.unit} ${selectedProduct.name} ${customerName} ${customerCCCD}`);
            const url = getVietQRUrl(bank.bin, customerAccountNo, customerName, transferAmount, desc);
            setQrUrl(url);
            setShowQR(true);
          } else {
            setShowSuccess(true);
          }
        } else {
          setShowSuccess(true);
        }
      }
    } catch (error: any) {
      setLastError(error);
      alert("Đã có lỗi xảy ra khi lưu giao dịch: " + (error.message || "Kiểm tra quyền truy cập database"));
    }
  };

  const resetForm = () => {
    setCustomerName('');
    setCustomerCCCD('');
    setCustomerAddress('');
    setQuantity(1);
    setDiscount(0);
    setCashAmount(0);
    setTransferAmount(0);
    setSelectedProduct(null);
    setShowSuccess(false);
    setShowQR(false);
  };

  const { user } = useAuth();
  const currentUserEmail = user?.email;

  const formatNumberWithSeparator = (val: number) => {
    return new Intl.NumberFormat('vi-VN').format(val);
  };

  const parseNumberFromSeparator = (val: string) => {
    return Number(val.replace(/\./g, ''));
  };

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
                <li>Bước 1: Kiểm tra kết nối Internet.</li>
                <li>Bước 2: Đảm bảo bảng <strong>transactions</strong> đã được cấu hình Policy trên Supabase.</li>
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
            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center gap-1 px-2 py-1 bg-neutral-100 rounded-sm text-[8px] font-black text-neutral-400 uppercase tracking-tighter" title="Hệ thống tự động nhận diện máy quét cổng USB/Bluetooth">
                <QrCode size={10} /> Máy quét cầm tay SẴN SÀNG
              </div>
              <button 
                onClick={() => setShowScanner(true)}
                className="flex items-center gap-2 text-[10px] font-black uppercase text-gold-dark border border-gold-primary/30 py-2 px-3 hover:bg-gold-primary hover:text-ink transition-all"
              >
                <Camera size={16} /> Quét CCCD
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          <div className="input-field">
            <label>Địa chỉ</label>
            <input 
              type="text" 
              value={customerAddress} 
              onChange={(e) => setCustomerAddress(e.target.value)} 
              placeholder="Nơi thường trú" 
            />
          </div>

          {type === 'BUY' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="input-field">
                <label>Ngân hàng nhận (của khách)</label>
                <select 
                  value={customerBankId}
                  onChange={(e) => setCustomerBankId(e.target.value)}
                >
                  <option value="">-- Chọn ngân hàng --</option>
                  {banks.map(bank => (
                    <option key={bank.id} value={bank.id}>{bank.short_name} - {bank.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="input-field">
                <label>Số tài khoản khách hàng</label>
                <input 
                  type="text" 
                  value={customerAccountNo}
                  onChange={(e) => setCustomerAccountNo(e.target.value)}
                  placeholder="Nhập số tài khoản"
                />
              </div>
            </div>
          )}

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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <label>Chiết khấu (VND)</label>
              <input 
                type="text"
                value={formatNumberWithSeparator(discount)}
                className="font-mono font-bold text-neutral-600"
                onChange={(e) => setDiscount(parseNumberFromSeparator(e.target.value))}
              />
            </div>
            <div className="input-field">
              <label>Đơn giá điều chỉnh (VND/{selectedProduct?.unit || 'đơn vị'})</label>
              <input 
                type="text"
                value={formatNumberWithSeparator(customPrice)}
                className="font-mono font-bold text-lg bg-neutral-50 focus:bg-white"
                onChange={(e) => setCustomPrice(parseNumberFromSeparator(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-dashed border-neutral-200">
            <div className="input-field">
              <label className="text-vcb-green font-bold uppercase text-[9px]">Chuyển khoản (VND)</label>
              <input 
                type="text"
                value={formatNumberWithSeparator(transferAmount)}
                className="bg-vcb-blue/5 border-vcb-blue/20"
                onChange={(e) => handleTransferChange(parseNumberFromSeparator(e.target.value))}
              />
            </div>
            <div className="input-field">
              <label className="text-orange-600 font-bold uppercase text-[9px]">Tiền mặt (VND)</label>
              <input 
                type="text"
                value={formatNumberWithSeparator(cashAmount)}
                className="bg-orange-50 border-orange-200"
                onChange={(e) => handleCashChange(parseNumberFromSeparator(e.target.value))}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 pt-6 border-t border-neutral-100">
          <div className="flex flex-col gap-2 mb-6">
            <div className="flex justify-between items-center text-neutral-400">
              <span className="text-[10px] uppercase font-black">Thành tiền</span>
              <span className="text-lg font-bold">{formatCurrency(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between items-center text-red-400 italic">
                <span className="text-[10px] uppercase font-black">Chiết khấu (-)</span>
                <span className="text-lg font-bold">-{formatCurrency(discount)}</span>
              </div>
            )}
            <div className="flex justify-between items-center mt-2 pt-2 border-t border-neutral-50">
              <span className="text-[10px] uppercase font-black text-neutral-400">Cần thanh toán</span>
              <span className="text-4xl font-black text-ink">{formatCurrency(totalAmount)}</span>
            </div>
          </div>

          <button 
            onClick={handleSubmit}
            className={`vcb-btn w-full flex items-center justify-center gap-3 ${type === 'BUY' ? 'bg-ink' : ''}`}
          >
            {type === 'SELL' ? (
              <><QrCode size={20} /> Tạo mã thanh toán QR</>
            ) : (
              <><CheckCircle2 size={20} /> Xác nhận & Lưu giao dịch</>
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
              <h3 className="mb-4">{type === 'SELL' ? 'Mã thanh toán VietQR' : 'QR Thanh toán cho khách'}</h3>
              <div className="bg-white p-2 border border-neutral-100 shadow-inner mb-6 ring-4 ring-neutral-50">
                <img 
                  src={qrUrl} 
                  alt="VietQR" 
                  className="w-72 h-auto" 
                  referrerPolicy="no-referrer" 
                />
              </div>
              
              <div className="w-full bg-neutral-50 p-4 rounded-sm border border-neutral-100 mb-6 text-left">
                <p className="text-[10px] uppercase font-black text-neutral-400 mb-2 tracking-widest">Nội dung chuyển khoản (Không dấu)</p>
                <div className="flex justify-between items-center gap-4">
                  <span className="font-mono font-bold text-sm text-ink break-all">
                    {type === 'SELL' 
                      ? removeVietnameseTones(`${customerName} ${customerCCCD} ${selectedProduct?.name} x ${quantity} ${selectedProduct?.unit}`)
                      : removeVietnameseTones(`NGHIA TIN THANH TOAN TIEN MUA ${quantity} ${selectedProduct?.unit} ${selectedProduct?.name} ${customerName} ${customerCCCD}`)
                    }
                  </span>
                  <button 
                    onClick={() => {
                      const desc = type === 'SELL' 
                        ? removeVietnameseTones(`${customerName} ${customerCCCD} ${selectedProduct?.name} x ${quantity} ${selectedProduct?.unit}`)
                        : removeVietnameseTones(`NGHIA TIN THANH TOAN TIEN MUA ${quantity} ${selectedProduct?.unit} ${selectedProduct?.name} ${customerName} ${customerCCCD}`);
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
                  <p className="text-[9px] uppercase font-black text-neutral-400 mb-1 tracking-tight">Người nhận</p>
                  <p className="text-xs font-bold">{type === 'SELL' ? config?.account_holder : customerName}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] uppercase font-black text-neutral-400 mb-1 tracking-tight">Số tiền {type === 'SELL' ? 'CK' : 'Thanh toán'}</p>
                  <p className="text-xs font-bold">{formatCurrency(transferAmount || totalAmount)}</p>
                </div>
              </div>
              
              <button 
                onClick={resetForm} 
                className="bg-ink text-paper w-full py-4 font-black uppercase text-xs tracking-widest hover:bg-gold-primary hover:text-ink transition-all shadow-lg"
              >
                {type === 'SELL' ? 'Xác nhận đã nhận tiền' : 'Xác nhận đã chuyển tiền'}
              </button>
            </motion.div>
          ) : showSuccess ? (
            <motion.div 
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-12 rounded-sm shadow-xl flex flex-col items-center text-center border-t-8 border-green-500"
            >
              <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-6">
                <CheckCircle2 size={40} className="text-green-500" />
              </div>
              <h3 className="text-2xl mb-2 italic">Giao dịch thành công</h3>
              <p className="text-xs text-neutral-500 mb-8 font-medium leading-relaxed">
                Hệ thống đã ghi nhận giao dịch của bạn.
                <br />
                <strong>Tiền mặt:</strong> {formatCurrency(cashAmount)}
                <br />
                <strong>Chuyển khoản:</strong> {formatCurrency(transferAmount)}
              </p>
              
              <button 
                onClick={resetForm}
                className="w-full py-4 bg-ink text-white font-black uppercase text-xs tracking-widest hover:bg-gold-primary hover:text-ink transition-all shadow-md"
              >
                Tiếp tục giao dịch
              </button>
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
      </div>
    </div>
  );
};

export default Transactions;
