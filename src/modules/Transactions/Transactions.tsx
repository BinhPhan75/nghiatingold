import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Product, Transaction, SystemConfig } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { Camera, QrCode, CreditCard, Send, CheckCircle2, Search, ArrowLeftRight } from 'lucide-react';
import QRScanner from '../../components/QRScanner';
import { parseCCCD, getVietQRUrl, getVCBDeepLink, formatCurrency } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const Transactions: React.FC = () => {
  const { profile } = useAuth();
  const [type, setType] = useState<'BUY' | 'SELL'>('SELL');
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [config, setConfig] = useState<SystemConfig | null>(null);
  
  // Form State
  const [customerName, setCustomerName] = useState('');
  const [customerCCCD, setCustomerCCCD] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [showScanner, setShowScanner] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [qrUrl, setQrUrl] = useState('');

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

  const currentPrice = selectedProduct 
    ? (type === 'BUY' ? selectedProduct.buy_price : selectedProduct.sell_price) 
    : 0;
  
  const totalAmount = currentPrice * quantity;

  const handleScan = (data: string) => {
    const info = parseCCCD(data);
    if (info) {
      setCustomerName(info.name);
      setCustomerCCCD(info.id);
      setShowScanner(false);
    } else {
      alert("Mã QR không đúng định dạng CCCD");
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
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      quantity,
      unit: selectedProduct.unit,
      price_per_unit: currentPrice,
      total_amount: totalAmount,
      created_by: profile?.id,
    };

    const { error } = await supabase.from('transactions').insert([transaction]);

    if (!error) {
      if (type === 'SELL') {
        const desc = `${customerName} ${customerCCCD} THANH TOAN TIEN MUA ${quantity} ${selectedProduct.unit} ${selectedProduct.name}`;
        if (config) {
          const url = getVietQRUrl(config.bank_id, config.account_no, config.account_holder, totalAmount, desc);
          setQrUrl(url);
          setShowQR(true);
        }
      } else {
        // Mode: BUY (Customer sells to us, we pay them)
        const desc = `CHUYEN TIEN MUA ${quantity} ${selectedProduct.unit} ${selectedProduct.name} CHO KH ${customerName} ${customerCCCD}`;
        // Redirect to VCB app
        window.location.href = getVCBDeepLink(desc);
        setShowSuccess(true);
      }
    } else {
      alert("Đã có lỗi xảy ra khi lưu giao dịch");
    }
  };

  const resetForm = () => {
    setCustomerName('');
    setCustomerCCCD('');
    setQuantity(1);
    setSelectedProduct(null);
    setShowSuccess(false);
    setShowQR(false);
  };

  return (
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
              <label>Đơn giá hiện tại</label>
              <div className="h-[52px] border border-neutral-200 bg-neutral-50 flex items-center px-3 font-mono font-bold text-lg">
                {formatCurrency(currentPrice)}
              </div>
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
              <div className="bg-white p-4 border border-neutral-100 shadow-inner mb-6">
                <img src={qrUrl} alt="VietQR" className="w-64 h-64" referrerPolicy="no-referrer" />
              </div>
              <p className="text-sm font-bold mb-1">{config?.account_holder}</p>
              <p className="text-xs text-neutral-500 mb-6 font-medium">{config?.bank_name}: {config?.account_no}</p>
              
              <button onClick={resetForm} className="text-[10px] font-black uppercase text-ink underline underline-offset-4">Xong giao dịch</button>
            </motion.div>
          ) : showSuccess ? (
            <motion.div 
              key="success"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-green-600 text-white p-12 rounded-sm shadow-xl flex flex-col items-center text-center"
            >
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-6">
                <CheckCircle2 size={40} />
              </div>
              <h3 className="text-3xl text-white mb-2">Thành công</h3>
              <p className="mb-8 opacity-90 font-medium">Đã chuyển thông tin tới app Vietcombank và lưu giao dịch.</p>
              <button 
                onClick={resetForm}
                className="bg-white text-green-600 py-3 px-8 font-black uppercase text-xs tracking-widest rounded-sm hover:bg-neutral-100 transition-all"
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
  );
};

export default Transactions;
