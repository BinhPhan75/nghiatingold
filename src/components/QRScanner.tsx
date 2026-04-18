import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, RefreshCw, QrCode, Upload } from 'lucide-react';

interface QRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScan, onClose }) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [scannedResult, setScannedResult] = useState<string | null>(null);

  const [isScanningFile, setIsScanningFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const startScanner = async () => {
      try {
        const html5QrCode = new Html5Qrcode('reader');
        scannerRef.current = html5QrCode;

        const config = { 
          fps: 15, 
          qrbox: { width: 280, height: 280 },
          aspectRatio: 1.0
        };

        await html5QrCode.start(
          { facingMode: "environment" }, 
          config, 
          (decodedText) => {
            setScannedResult(decodedText);
          },
          (errorMessage) => { }
        );
        setIsInitializing(false);
      } catch (err: any) {
        console.error("Camera start error:", err);
        setError("Không thể truy cập máy ảnh trực tiếp. Vui lòng sử dụng tính năng 'Tải ảnh lên'.");
        setIsInitializing(false);
      }
    };

    startScanner();

    return () => {
      stopScanner();
    };
  }, []);

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
        console.error("Stop error:", err);
      }
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsScanningFile(true);
    try {
      const html5QrCode = new Html5Qrcode('reader', false);
      const result = await html5QrCode.scanFile(file, true);
      setScannedResult(result);
    } catch (err) {
      console.error("File scan error:", err);
      alert("Không tìm thấy mã QR trong ảnh này. Vui lòng chụp rõ mã QR ở góc thẻ CCCD.");
    } finally {
      setIsScanningFile(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-sm w-full max-w-md overflow-hidden relative shadow-2xl border-2 border-gold-primary/30">
        <div className="p-4 border-b flex justify-between items-center bg-ink text-paper text-sm">
          <div className="flex items-center gap-2">
            <Camera size={18} className="text-gold-primary" />
            <h3 className="font-black text-xs uppercase tracking-[0.2em] m-0">Máy Quét CCCD AI</h3>
          </div>
          <button onClick={onClose} className="hover:text-gold-primary transition-colors p-1">
            <X size={24} />
          </button>
        </div>
        
        <div className="relative aspect-square bg-black overflow-hidden shadow-inner">
          <div id="reader" className={`w-full h-full ${scannedResult ? 'hidden' : ''}`}></div>
          
          {(isInitializing || isScanningFile) && !scannedResult && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black/60 backdrop-blur-sm z-10">
              <RefreshCw className="animate-spin mb-4 text-gold-primary" size={32} />
              <p className="text-[10px] uppercase font-black tracking-widest">
                {isScanningFile ? 'Đang phân tích hình ảnh...' : 'Đang khởi động camera...'}
              </p>
            </div>
          )}

          {scannedResult && (
            <div className="absolute inset-0 bg-white p-8 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 border-4 border-white shadow-xl">
                <QrCode size={32} />
              </div>
              <h4 className="text-xl font-black uppercase tracking-widest mb-2 text-ink">Đã Đọc Mã QR</h4>
              <p className="text-xs text-neutral-400 mb-8 font-medium italic">Hệ thống đã nhận diện được thông tin từ thẻ CCCD.</p>
              
              <div className="bg-neutral-50 w-full p-4 rounded-sm mb-10 text-left border border-neutral-100 overflow-hidden relative shadow-inner">
                <div className="absolute top-0 right-0 p-1 bg-gold-primary/10 text-gold-dark text-[8px] font-black uppercase tracking-tighter px-2">Xác thực hồ sơ</div>
                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1.5 opacity-60">Dữ liệu thô (Scanner Output):</p>
                <p className="text-[11px] font-mono break-all line-clamp-3 text-ink leading-relaxed bg-white/50 p-2 border border-neutral-100 italic">{scannedResult}</p>
              </div>

              <div className="flex flex-col gap-4 w-full">
                <button 
                  onClick={() => onScan(scannedResult)}
                  className="bg-ink text-paper py-5 px-6 font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl hover:bg-gold-primary hover:text-ink transition-all active:scale-95"
                >
                  Lưu & Sử dụng thông tin
                </button>
                <button 
                  onClick={() => setScannedResult(null)}
                  className="text-[10px] font-black uppercase text-neutral-400 hover:text-ink transition-colors tracking-widest flex items-center justify-center gap-2"
                >
                  <RefreshCw size={12} /> Quét mã khác
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 text-white bg-red-900/40 backdrop-blur-md">
              <X className="mb-4 text-red-500" size={48} />
              <p className="text-xs font-bold leading-relaxed">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="mt-6 bg-white text-ink py-2 px-6 font-black uppercase text-[10px] tracking-widest"
              >
                Tải lại trang
              </button>
            </div>
          )}

          {/* Overlay corner marks */}
          {!isInitializing && !error && !scannedResult && (
            <div className="absolute inset-0 pointer-events-none opacity-50">
              <div className="absolute top-8 left-8 w-12 h-12 border-t-4 border-l-4 border-gold-primary"></div>
              <div className="absolute top-8 right-8 w-12 h-12 border-t-4 border-r-4 border-gold-primary"></div>
              <div className="absolute bottom-16 left-8 w-12 h-12 border-b-4 border-l-4 border-gold-primary"></div>
              <div className="absolute bottom-16 right-8 w-12 h-12 border-b-4 border-r-4 border-gold-primary"></div>
              
              <div className="absolute top-1/2 left-0 w-full h-[1px] bg-gold-primary/30 animate-pulse"></div>
            </div>
          )}
        </div>
        
        {!scannedResult && (
          <div className="p-4 bg-neutral-50 border-t border-neutral-100 italic flex justify-between items-center px-6">
            <p className="text-[10px] text-ink font-medium leading-relaxed max-w-[180px]">
              Vui lòng đưa mã QR vào khung hình hoặc tải lên ảnh chụp rõ nét.
            </p>
            <div className="flex gap-2">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept="image/*" 
                className="hidden" 
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="bg-paper border border-ink/10 p-2.5 rounded shadow-sm text-ink hover:bg-gold-primary transition-all flex items-center gap-2 text-[9px] font-black uppercase tracking-widest"
                title="Tải ảnh CCCD"
              >
                <Upload size={14} /> Tải ảnh
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QRScanner;
