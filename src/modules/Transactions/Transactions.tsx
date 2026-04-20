import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Product, Transaction, SystemConfig, Bank } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { Camera, QrCode, CreditCard, Send, CheckCircle2, Search, ArrowLeftRight, X, XCircle, UserPlus } from 'lucide-react';
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
  
  // Cart State
  interface CartItem {
    id: string;
    product: Product;
    quantity: number;
    pricePerUnit: number;
  }
  const [cart, setCart] = useState<CartItem[]>([]);
  
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
  const [submitting, setSubmitting] = useState(false);
  const [isWaitingForBackScan, setIsWaitingForBackScan] = useState(false);

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
        if (data.length > 5) { // Minimum length for any useful data
          e.preventDefault();
          const info = parseCCCD(data);
          
          if (info) {
            setCustomerName(info.name);
            setCustomerCCCD(info.id);
            if (info.address) {
              setCustomerAddress(info.address);
              setIsWaitingForBackScan(false);
            }
            
            // Success Feedback
            const notification = document.createElement('div');
            notification.className = 'fixed bottom-4 left-4 bg-ink text-gold-primary px-6 py-3 rounded-sm shadow-2xl z-50 font-black uppercase text-[10px] tracking-widest animate-in fade-in slide-in-from-bottom-4 flex items-center gap-3 border-l-4 border-gold-primary';
            notification.innerHTML = `<span class="bg-gold-primary text-ink rounded-full p-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></span> Đã nhận dạng ${data.includes('|') ? 'Căn cước' : 'Dữ liệu'} thành công`;
            document.body.appendChild(notification);
            setTimeout(() => notification.remove(), 3000);
          } else {
            // If it's just a 12 digit number, maybe it's just the ID part (front barcode of new card)
            if (/^\d{12}$/.test(data)) {
              setCustomerCCCD(data);
              setIsWaitingForBackScan(true); // Likely new card front
              const notification = document.createElement('div');
              notification.className = 'fixed bottom-4 left-4 bg-ink text-paper px-6 py-3 rounded-sm shadow-2xl z-50 font-black uppercase text-[10px] tracking-widest animate-in fade-in slide-in-from-bottom-4 border-l-4 border-blue-400';
              notification.innerText = 'Đã nhận Số thẻ. Vui lòng quét MẶT SAU để lấy địa chỉ.';
              document.body.appendChild(notification);
              setTimeout(() => notification.remove(), 4000);
            }
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
  
  const cartSubtotal = cart.reduce((sum, item) => sum + (item.pricePerUnit * item.quantity), 0);
  const totalAmount = Math.max(0, cartSubtotal - discount);

  useEffect(() => {
    // Default: transferAmount = totalAmount - cashAmount
    setTransferAmount(Math.max(0, totalAmount - cashAmount));
  }, [totalAmount, cashAmount]);

  const addToCart = () => {
    if (!selectedProduct || quantity <= 0 || customPrice <= 0) {
      alert("Vui lòng chọn loại vàng, số lượng và đơn giá hợp lệ");
      return;
    }
    const newItem: CartItem = {
      id: Math.random().toString(36).substr(2, 9),
      product: selectedProduct,
      quantity,
      pricePerUnit: customPrice
    };
    setCart([...cart, newItem]);
    // Reset item selection for next one
    setSelectedProduct(null);
    setQuantity(1);
    setCustomPrice(0);
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

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
      
      if (data.address) {
        setCustomerAddress(data.address);
        setIsWaitingForBackScan(false);
      } else if (data.cardType === 'NEW') {
        setIsWaitingForBackScan(true);
        // Alert user
        const notification = document.createElement('div');
        notification.className = 'fixed bottom-4 left-4 bg-gold-primary text-ink px-6 py-3 rounded-sm shadow-2xl z-50 font-black uppercase text-[10px] tracking-widest border-2 border-ink animate-bounce';
        notification.innerText = 'THẺ MẪU MỚI: VUI LÒNG CHỤP MẶT SAU ĐỂ LẤY ĐỊA CHỈ';
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
      } else {
        setIsWaitingForBackScan(false);
      }

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
        if (info.address) {
          setCustomerAddress(info.address);
          setIsWaitingForBackScan(false);
        }
        setShowScanner(false);
        setLastError(null);
      } else {
        // Fallback or retry
        console.warn("Mã QR không đúng định dạng CCCD chuẩn:", data);
        const parts = data.split('|');
        if (parts.length > 2) {
          alert(`Dữ liệu quét được không khớp định dạng CCCD chuẩn. Vui lòng thử lại với thẻ CCCD gắn chip mới nhất.`);
        } 
      }
    }
  };

  const handleSubmit = async () => {
    if (submitting) {
      alert("Giao dịch đã được ghi nhận vào hệ thống. Vui lòng không bấm liên tiếp.");
      return;
    }

    if (cart.length === 0) {
      alert("Vui lòng thêm ít nhất một mặt hàng vào danh sách");
      return;
    }

    if (!customerName || !customerCCCD) {
      alert("Vui lòng nhập đầy đủ thông tin khách hàng");
      return;
    }

    setSubmitting(true);
    
    // Distribute payment proportionally with rounding adjustment for last item
    let distributedDiscount = 0;
    let distributedCash = 0;
    let distributedTransfer = 0;

    const itemsCount = cart.length;
    const transactions: Omit<Transaction, 'id'>[] = cart.map((item, index) => {
      const isLast = index === itemsCount - 1;
      const itemSubtotal = item.pricePerUnit * item.quantity;
      const weight = itemSubtotal / cartSubtotal;
      
      // Proportional distribution
      let itemDiscount = isLast ? (discount - distributedDiscount) : Math.round(discount * weight);
      let itemCash = isLast ? (cashAmount - distributedCash) : Math.round(cashAmount * weight);
      let itemTransfer = isLast ? (transferAmount - distributedTransfer) : Math.round(transferAmount * weight);

      distributedDiscount += itemDiscount;
      distributedCash += itemCash;
      distributedTransfer += itemTransfer;

      const itemTotal = itemSubtotal - itemDiscount;
      
      return {
        type,
        customer_name: customerName,
        customer_cccd: customerCCCD,
        dia_chi: customerAddress,
        customer_bank_id: type === 'BUY' ? customerBankId : undefined,
        customer_account_no: type === 'BUY' ? customerAccountNo : undefined,
        product_id: item.product.id,
        product_name: item.product.name,
        quantity: item.quantity,
        unit: item.product.unit,
        price_per_unit: item.pricePerUnit,
        total_amount: itemTotal,
        chiet_khau: itemDiscount,
        tien_mat: itemCash,
        chuyen_khoan: itemTransfer,
        created_at: new Date().toISOString(),
        created_by: profile?.id || 'anonymous',
      };
    });

    setLastError(null);
    try {
      const { error } = await supabase.from('transactions').insert(transactions);
      if (error) throw error;
      
      const itemsSummary = cart.map(item => `${item.product.name} x ${item.quantity} ${item.product.unit}`).join(', ');
      
      if (type === 'SELL') {
        const desc = removeVietnameseTones(`${customerName} ${customerCCCD} ${itemsSummary}`);
        if (config && config.bank_id && config.account_no && config.account_holder) {
          const url = getVietQRUrl(config.bank_id, config.account_no, config.account_holder, transferAmount || totalAmount, desc);
          setQrUrl(url);
          setShowQR(true);
        } else {
          alert("Lỗi: Thông tin ngân hàng của cửa hàng chưa đầy đủ.");
          setSubmitting(false);
        }
      } else {
        // For BUY transactions
        if (transferAmount > 0 && customerBankId && customerAccountNo) {
          const bank = banks.find(b => b.id === customerBankId);
          if (bank) {
            const desc = removeVietnameseTones(`NGHIA TIN THANH TOAN TIEN MUA ${itemsSummary} ${customerName} ${customerCCCD}`);
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
      setSubmitting(false);
      setLastError(error);
      alert("Đã có lỗi xảy ra khi lưu giao dịch: " + (error.message || "Kiểm tra quyền truy cập database"));
    }
  };

  const resetForm = () => {
    setCustomerName('');
    setCustomerCCCD('');
    setCustomerAddress('');
    setCart([]);
    setQuantity(1);
    setDiscount(0);
    setCashAmount(0);
    setTransferAmount(0);
    setSelectedProduct(null);
    setShowSuccess(false);
    setShowQR(false);
    setSubmitting(false);
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

          <div className="input-field relative">
            <label>Địa chỉ</label>
            <div className="relative">
              <input 
                type="text" 
                value={customerAddress} 
                onChange={(e) => {
                  setCustomerAddress(e.target.value);
                  if (e.target.value.length > 3) setIsWaitingForBackScan(false);
                }} 
                placeholder="Nơi thường trú" 
                className={isWaitingForBackScan ? 'ring-2 ring-gold-primary ring-inset pr-10' : ''}
              />
              {isWaitingForBackScan && (
                <div 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gold-dark animate-pulse"
                  title="Vui lòng quét mặt sau để lấy địa chỉ"
                >
                  <QrCode size={18} />
                </div>
              )}
            </div>
            {isWaitingForBackScan && (
              <motion.p 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[9px] text-gold-dark font-black uppercase mt-1 tracking-widest flex justify-between items-center bg-gold-primary/10 px-2 py-1 rounded-sm border border-gold-primary/20"
              >
                <span>&rarr; Đã nhận diện thẻ mới. Vui lòng quét MẶT SAU để lấy ĐỊA CHỈ</span>
                <button 
                  onClick={() => setIsWaitingForBackScan(false)}
                  className="text-[8px] underline decoration-dotted underline-offset-2 hover:text-ink"
                >
                  Bỏ qua
                </button>
              </motion.p>
            )}
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

          <div className="bg-paper border border-neutral-100 p-4 rounded-sm">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-4 border-b border-neutral-50 pb-2">Danh sách mặt hàng ({cart.length})</h4>
            <div className="flex flex-col gap-3 max-h-60 overflow-y-auto pr-2">
              {cart.length === 0 ? (
                <div className="text-center py-8 text-neutral-300 italic text-[10px] font-black uppercase tracking-widest">Chưa có sản phẩm nào được thêm</div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="flex justify-between items-center group bg-neutral-50 p-3 border-l-2 border-gold-primary">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-ink">{item.product.name}</span>
                      <span className="text-[10px] text-neutral-500">{item.quantity} {item.product.unit} x {formatCurrency(item.pricePerUnit)}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-black text-ink">{formatCurrency(item.pricePerUnit * item.quantity)}</span>
                      <button 
                        onClick={() => removeFromCart(item.id)}
                        className="text-neutral-300 hover:text-red-500 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="p-5 border-2 border-gold-primary/20 bg-gold-primary/5 rounded-sm relative">
            <div className="absolute -top-3 left-4 bg-gold-primary text-ink px-3 py-1 font-black text-[9px] uppercase tracking-widest">Thêm sản phẩm mới</div>
            <div className="flex flex-col gap-4">
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
                  <label>Đơn giá điều chỉnh (VND/{selectedProduct?.unit || 'đơn vị'})</label>
                  <input 
                    type="text"
                    value={formatNumberWithSeparator(customPrice)}
                    className="font-mono font-bold text-lg bg-neutral-50 focus:bg-white"
                    onChange={(e) => setCustomPrice(parseNumberFromSeparator(e.target.value))}
                  />
                </div>
              </div>

              <button 
                onClick={addToCart}
                className="bg-ink text-paper py-3 font-black uppercase text-[10px] tracking-widest hover:bg-gold-dark transition-all flex items-center justify-center gap-2"
              >
                <UserPlus size={14} /> Thêm vào danh sách
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="input-field">
              <label>Chiết khấu tổng (VND)</label>
              <input 
                type="text"
                value={formatNumberWithSeparator(discount)}
                className="font-mono font-bold text-neutral-600"
                onChange={(e) => setDiscount(parseNumberFromSeparator(e.target.value))}
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
              <span className="text-[10px] uppercase font-black">Tạm tính ({cart.length} mặt hàng)</span>
              <span className="text-lg font-bold">{formatCurrency(cartSubtotal)}</span>
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
            disabled={submitting}
            className={`vcb-btn w-full flex items-center justify-center gap-3 ${type === 'BUY' ? 'bg-ink' : ''} ${submitting ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {submitting ? (
              <><Send className="animate-pulse" size={20} /> ĐANG LƯU HỆ THỐNG...</>
            ) : type === 'SELL' ? (
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
                      ? removeVietnameseTones(`${customerName} ${customerCCCD} ${cart.map(item => `${item.product.name} x ${item.quantity} ${item.product.unit}`).join(', ')}`)
                      : removeVietnameseTones(`NGHIA TIN THANH TOAN TIEN MUA ${cart.map(item => `${item.product.name} x ${item.quantity} ${item.product.unit}`).join(', ')} ${customerName} ${customerCCCD}`)
                    }
                  </span>
                  <button 
                    onClick={() => {
                      const desc = type === 'SELL' 
                        ? removeVietnameseTones(`${customerName} ${customerCCCD} ${cart.map(item => `${item.product.name} x ${item.quantity} ${item.product.unit}`).join(', ')}`)
                        : removeVietnameseTones(`NGHIA TIN THANH TOAN TIEN MUA ${cart.map(item => `${item.product.name} x ${item.quantity} ${item.product.unit}`).join(', ')} ${customerName} ${customerCCCD}`);
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
