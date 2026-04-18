import React, { useState, useRef } from 'react';
import { Camera, Scan, CreditCard, User, Weight, ChevronRight, CheckCircle2, QrCode } from 'lucide-react';
import { motion } from 'motion/react';
import { scanCCCD, CCCDInfo } from '../services/geminiService';
import { generateVietQR } from '../services/vietQRService';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, updateDoc, doc, increment, getDocs, query, where } from 'firebase/firestore';

export function BuySell() {
  const [step, setStep] = useState(1);
  const [txType, setTxType] = useState<'buy' | 'sell'>('sell');
  const [goldType, setGoldType] = useState('Vàng 9999');
  const [weight, setWeight] = useState('');
  const [unit, setUnit] = useState('chi');
  const [price, setPrice] = useState(0);
  const [customer, setCustomer] = useState<CCCDInfo | null>(null);
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [qrUrl, setQrUrl] = useState('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = async () => {
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      setScanning(false);
    }
  };

  const captureAndScan = async () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg');
        const base64 = dataUrl.split(',')[1];
        
        // Stop stream
        const stream = videoRef.current.srcObject as MediaStream;
        stream?.getTracks().forEach(track => track.stop());
        
        setScanning(false);
        setSubmitting(true);
        const info = await scanCCCD(base64);
        setCustomer(info);
        setSubmitting(false);
      }
    }
  };

  const handleTransaction = async () => {
    setSubmitting(true);
    try {
      const totalAmount = parseFloat(weight) * price;
      
      // 1. Record Transaction
      const txData = {
        type: txType,
        goldType,
        weight: parseFloat(weight),
        unit,
        totalPrice: totalAmount,
        customerID: customer?.id || 'Unknown',
        customerName: customer?.fullName || 'Anonymous',
        customerAddress: customer?.address || '',
        createdAt: serverTimestamp(),
        paymentMethod: txType === 'sell' ? 'transfer' : 'cash',
        status: 'completed'
      };
      
      await addDoc(collection(db, 'transactions'), txData);

      // 2. Update Inventory
      const inventoryQuery = query(collection(db, 'inventory'), where('goldType', '==', goldType));
      const inventorySnapshot = await getDocs(inventoryQuery);
      const changeAmount = txType === 'sell' ? -parseFloat(weight) : parseFloat(weight);
      
      if (!inventorySnapshot.empty) {
        const inventoryDoc = inventorySnapshot.docs[0];
        await updateDoc(doc(db, 'inventory', inventoryDoc.id), {
          totalWeight: increment(changeAmount)
        });
      } else {
        await addDoc(collection(db, 'inventory'), {
          goldType,
          totalWeight: changeAmount,
          unit
        });
      }

      // 3. Generate Payment QR if Selling
      if (txType === 'sell') {
        const qr = generateVietQR(
          totalAmount,
          "0011000123456", // Mock Vietcombank Account
          "CỬA HÀNG VÀNG NGHIATIN GOLD",
          `Thanh toan mua ${goldType} ${weight} ${unit}`
        );
        setQrUrl(qr);
        setStep(4);
      } else {
        setStep(4);
      }
    } catch (error) {
      console.error("Transaction failed:", error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-12">
      <div className="hero-header border-b border-white/10 pb-6 flex items-center justify-between">
        <div>
          <h1 className="text-8xl font-black uppercase text-paper tracking-tighter">Hợp Đồng<br/><span className="text-gold-primary">Giao Dịch</span></h1>
          <p className="text-white/20 uppercase tracking-[0.4em] font-black text-[10px] mt-4">Transaction Hub & ID Verification</p>
        </div>
        <div className="flex gap-1 border border-white/10 p-1">
          <button 
            onClick={() => setTxType('sell')}
            className={`px-8 py-3 font-black text-xs tracking-widest uppercase transition-all ${txType === 'sell' ? 'bg-gold-primary text-ink' : 'text-white/40'}`}
          >
            Bán ra
          </button>
          <button 
            onClick={() => setTxType('buy')}
            className={`px-8 py-3 font-black text-xs tracking-widest uppercase transition-all ${txType === 'buy' ? 'bg-gold-primary text-ink' : 'text-white/40'}`}
          >
            Mua vào
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-start">
        {/* Left Side: Step Content */}
        <div className="lg:col-span-2 space-y-8">
          <div className="transaction-pane">
            {step === 1 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <h3 className="text-2xl font-black uppercase tracking-tight text-ink border-b border-neutral-100 pb-4">Chi tiết mặt hàng</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="input-field">
                    <label>Loại vàng</label>
                    <select 
                      value={goldType}
                      onChange={(e) => setGoldType(e.target.value)}
                    >
                      <option>Vàng 9999</option>
                      <option>Vàng SJC</option>
                      <option>Vàng 24K</option>
                      <option>Vàng 18K</option>
                    </select>
                  </div>
                  <div className="input-field">
                    <label>Đơn vị</label>
                    <select 
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                    >
                      <option>Chỉ</option>
                      <option>Lượng</option>
                      <option>Gram</option>
                    </select>
                  </div>
                </div>
                <div className="input-field">
                  <label>Trọng lượng</label>
                  <input 
                    type="number"
                    placeholder="0.00"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="text-4xl"
                  />
                </div>
                <div className="input-field">
                  <label>Đơn giá hiện hành (VNĐ)</label>
                  <input 
                    type="number"
                    placeholder="Cập nhật giá theo thị trường"
                    onChange={(e) => setPrice(parseFloat(e.target.value))}
                  />
                </div>
                <button 
                  disabled={!weight || !price}
                  onClick={() => setStep(2)}
                  className="w-full bg-ink text-paper py-5 font-black uppercase tracking-widest disabled:opacity-20 transition-all hover:bg-neutral-800"
                >
                  Xác thực khách hàng →
                </button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 text-center py-4">
                <h3 className="text-2xl font-black uppercase tracking-tight text-ink">Quét nhận diện AI</h3>
                
                {scanning ? (
                  <div className="relative aspect-video rounded-none overflow-hidden border-2 border-ink">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    <div className="absolute inset-0 border-[16px] border-ink/40 pointer-events-none"></div>
                    <button 
                      onClick={captureAndScan}
                      className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-ink text-paper p-5 rounded-none shadow-2xl hover:scale-105 transition-transform"
                    >
                      <Camera size={24} />
                    </button>
                  </div>
                ) : submitting ? (
                  <div className="py-20 space-y-4">
                    <div className="w-12 h-12 border-4 border-ink border-t-gold-primary rounded-full animate-spin mx-auto"></div>
                    <p className="text-ink font-black uppercase tracking-widest text-xs">AI PROCESSING OCR...</p>
                  </div>
                ) : customer ? (
                  <div className="text-left space-y-6 bg-neutral-50 p-6 border border-neutral-100">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-ink flex items-center justify-center text-paper">
                        <User size={32} />
                      </div>
                      <div>
                        <h4 className="font-black text-2xl uppercase tracking-tighter leading-none">{customer.fullName}</h4>
                        <p className="text-xs text-neutral-400 font-bold uppercase tracking-widest mt-1">ID: {customer.id}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 text-sm border-t border-neutral-200 pt-6">
                      <div className="input-field">
                        <label>Địa chỉ thường trú</label>
                        <p className="font-bold text-lg">{customer.address}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setCustomer(null)}
                      className="text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-ink underline"
                    >
                      RE-SCAN CARD
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={startCamera}
                    className="w-full border-2 border-dashed border-neutral-200 rounded-none py-24 flex flex-col items-center gap-4 hover:border-gold-primary hover:bg-gold-primary/5 transition-all text-neutral-300 group"
                  >
                    <Scan size={64} className="group-hover:text-gold-primary transition-colors" />
                    <span className="font-black uppercase tracking-widest text-xs">Place CCCD Card in Viewport</span>
                  </button>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => setStep(1)} className="py-4 font-black uppercase tracking-widest text-xs border border-neutral-200 hover:bg-neutral-50">Back</button>
                  <button 
                    disabled={!customer}
                    onClick={() => setStep(3)}
                    className="bg-ink text-paper py-4 font-black uppercase tracking-widest text-xs disabled:opacity-20"
                  >
                    Continue
                  </button>
                </div>
                <canvas ref={canvasRef} className="hidden" />
              </motion.div>
            )}

            {step === 3 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                 <h3 className="text-2xl font-black uppercase tracking-tight text-ink text-center">Xác nhận giao dịch</h3>
                
                <div className="space-y-4 bg-neutral-50 p-6 border border-neutral-100">
                  <div className="flex justify-between items-center border-b border-neutral-200 pb-3">
                    <span className="text-neutral-400 uppercase text-[10px] font-black tracking-widest">Khách hàng</span>
                    <span className="font-black text-lg uppercase">{customer?.fullName}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-neutral-200 pb-3">
                    <span className="text-neutral-400 uppercase text-[10px] font-black tracking-widest">Sản phẩm</span>
                    <span className="font-black text-lg uppercase">{goldType} - {weight} {unit}</span>
                  </div>
                  <div className="text-center pt-6">
                    <span className="text-neutral-400 uppercase text-[10px] font-black tracking-widest block mb-1">Thanh toán cuối cùng</span>
                    <span className="text-6xl font-black text-ink tracking-tighter">
                      {(parseFloat(weight) * price).toLocaleString()}
                      <span className="text-sm ml-2 font-black uppercase tracking-widest opacity-30">VNĐ</span>
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => setStep(2)} className="py-4 font-black uppercase tracking-widest text-xs border border-neutral-200">Back</button>
                  <button 
                    onClick={handleTransaction}
                    disabled={submitting}
                    className="bg-gold-primary text-ink py-4 font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                  >
                    {submitting ? <div className="w-5 h-5 border-2 border-ink border-t-white rounded-full animate-spin"></div> : <CreditCard size={18} />}
                    PROCESS TRANSACTION
                  </button>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-10 py-10">
                <div className="w-24 h-24 bg-gold-primary text-ink flex items-center justify-center mx-auto">
                  <CheckCircle2 size={48} />
                </div>
                <div>
                  <h3 className="text-6xl text-ink font-black tracking-tighter uppercase">COMPLETED</h3>
                  <p className="text-neutral-400 uppercase tracking-[0.4em] font-black text-[10px] mt-2">SECURE LEDGER ENTRY SUCCESSFUL</p>
                </div>

                {qrUrl && (
                  <div className="p-10 bg-white border-2 border-neutral-100 inline-block mx-auto shadow-2xl">
                    <p className="text-neutral-400 font-black uppercase tracking-widest text-[9px] mb-6">VietQR Payment Gateway</p>
                    <img src={qrUrl} alt="Payment QR" className="w-64 h-64 mx-auto" />
                    <div className="mt-8 space-y-1">
                      <p className="text-ink font-black text-2xl tracking-tighter">VIETCOMBANK</p>
                      <p className="text-neutral-400 text-[10px] font-black tracking-widest uppercase">Verified Merchant Account</p>
                    </div>
                  </div>
                )}

                <button 
                  onClick={() => {
                    setStep(1);
                    setWeight('');
                    setCustomer(null);
                    setQrUrl('');
                  }}
                  className="w-full bg-ink text-paper py-5 font-black uppercase tracking-widest hover:bg-neutral-800 transition-all"
                >
                  NEW TRANSACTION
                </button>
              </motion.div>
            )}
          </div>
        </div>

        {/* Right Side: Process Info & Reports */}
        <div className="space-y-8">
          <div className="cccd-box border-dashed">
            <Scan size={32} className="mx-auto mb-4 text-gold-primary" />
            <strong className="text-gold-primary uppercase font-black tracking-widest text-xs block mb-2">QUÉT CCCD TỰ ĐỘNG</strong>
            <p className="text-white/40 text-[10px] uppercase font-black tracking-widest leading-relaxed">
              Vui lòng đặt thẻ căn cước trước camera.<br/>AI sẽ tự động điền thông tin vào hợp đồng.
            </p>
          </div>

          <div className="bg-white/5 p-6 border-l-2 border-gold-primary space-y-4">
             <div className="flex items-center gap-3">
               <QrCode size={20} className="text-gold-primary" />
               <h4 className="font-black text-xs uppercase tracking-widest">Thanh toán thông minh</h4>
             </div>
             <p className="text-[10px] text-white/40 leading-relaxed uppercase font-bold tracking-wider">
               Tự động tạo mã VietQR theo chuẩn Napas.<br/>Hỗ trợ mở trực tiếp App Vietcombank qua DeepLink.
             </p>
          </div>

          <div className="pt-10 border-t border-white/10 space-y-6">
             <h3 className="text-xs font-black uppercase tracking-widest text-gold-primary">Thống kê hôm nay</h3>
             <div className="space-y-4">
                <div className="flex justify-between items-end">
                   <span className="text-[10px] font-black uppercase text-white/40">Tổng GD</span>
                   <span className="text-2xl font-black">128</span>
                </div>
                <div className="flex justify-between items-end">
                   <span className="text-[10px] font-black uppercase text-white/40">Sản lượng</span>
                   <span className="text-2xl font-black">45.2 <span className="text-[10px] opacity-20 italic">chỉ</span></span>
                </div>
                <div className="flex justify-between items-end text-gold-primary">
                   <span className="text-[10px] font-black uppercase opacity-60">Doanh thu</span>
                   <span className="text-3xl font-black italic tracking-tighter leading-none underline decoration-2">12.5B</span>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>

  );
}
