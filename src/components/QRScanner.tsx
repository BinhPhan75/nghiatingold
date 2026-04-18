import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, RefreshCw } from 'lucide-react';

interface QRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScan, onClose }) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

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

        // Try to start with back camera by default
        await html5QrCode.start(
          { facingMode: "environment" }, 
          config, 
          (decodedText) => {
            onScan(decodedText);
            stopScanner();
          },
          (errorMessage) => {
            // Keep scanning, silent errors for "QR not found in frame"
          }
        );
        setIsInitializing(false);
      } catch (err: any) {
        console.error("Camera start error:", err);
        setError("Không thể truy cập máy ảnh. Vui lòng cấp quyền camera trong cài đặt trình duyệt.");
        setIsInitializing(false);
      }
    };

    startScanner();

    return () => {
      stopScanner();
    };
  }, [onScan]);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-sm w-full max-w-md overflow-hidden relative shadow-2xl border-2 border-gold-primary/30">
        <div className="p-4 border-b flex justify-between items-center bg-ink text-paper">
          <div className="flex items-center gap-2">
            <Camera size={18} className="text-gold-primary" />
            <h3 className="font-black text-xs uppercase tracking-[0.2em] m-0">Máy Quét CCCD AI</h3>
          </div>
          <button onClick={onClose} className="hover:text-gold-primary transition-colors p-1">
            <X size={24} />
          </button>
        </div>
        
        <div className="relative aspect-square bg-black overflow-hidden">
          <div id="reader" className="w-full h-full"></div>
          
          {isInitializing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black">
              <RefreshCw className="animate-spin mb-4 text-gold-primary" size={32} />
              <p className="text-[10px] uppercase font-black tracking-widest">Đang khởi động camera...</p>
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
          {!isInitializing && !error && (
            <div className="absolute inset-0 pointer-events-none opacity-50">
              <div className="absolute top-8 left-8 w-12 h-12 border-t-4 border-l-4 border-gold-primary"></div>
              <div className="absolute top-8 right-8 w-12 h-12 border-t-4 border-r-4 border-gold-primary"></div>
              <div className="absolute bottom-16 left-8 w-12 h-12 border-b-4 border-l-4 border-gold-primary"></div>
              <div className="absolute bottom-16 right-8 w-12 h-12 border-b-4 border-r-4 border-gold-primary"></div>
              
              <div className="absolute top-1/2 left-0 w-full h-[1px] bg-gold-primary/30 animate-pulse"></div>
            </div>
          )}
        </div>
        
        <div className="p-6 text-center bg-neutral-50 border-t border-neutral-100 italic">
          <p className="text-[11px] text-ink font-medium leading-relaxed">
            Vui lòng đưa mã QR trên CCCD vào khung hình để hệ thống tự động nhận diện thông tin.
          </p>
        </div>
      </div>
    </div>
  );
};

export default QRScanner;
