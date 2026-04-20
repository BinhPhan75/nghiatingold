import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, RefreshCw, QrCode, Upload, Zap, Sparkles, XCircle } from 'lucide-react';
import { analyzeCCCDImage } from '../services/geminiService';

interface QRScannerProps {
  onScan: (data: string | object) => void;
  onClose: () => void;
  paused?: boolean;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScan, onClose, paused = false }) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const [isScanningFile, setIsScanningFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const startScanner = async () => {
      try {
        const html5QrCode = new Html5Qrcode('reader');
        scannerRef.current = html5QrCode;

        const config = { 
          fps: 30, 
          qrbox: { width: 320, height: 320 },
          aspectRatio: 1.0,
          formatsToSupport: [ 
            Html5QrcodeSupportedFormats.QR_CODE, 
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.DATA_MATRIX,
            Html5QrcodeSupportedFormats.AZTEC
          ]
        };

        await html5QrCode.start(
          { facingMode: "environment" }, 
          config, 
          (decodedText) => {
            if (!paused && !isProcessing) {
              onScan(decodedText);
            }
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

  const handleManualCapture = async () => {
    if (!scannerRef.current || !scannerRef.current.isScanning || paused) return;
    
    setIsProcessing(true);
    try {
      const video = document.querySelector('#reader video') as HTMLVideoElement;
      if (!video) throw new Error("Video element not found");

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.drawImage(video, 0, 0);
      const base64Image = canvas.toDataURL('image/jpeg', 0.8);

      // 1. Try QR first on this frame
      try {
        const qrResult = await scannerRef.current.scanFile(new File([await (await fetch(base64Image)).blob()], "capture.jpg"), true);
        onScan(qrResult);
        setIsProcessing(false);
        return;
      } catch (e) {
        // No QR found in frame, move to AI
      }

      // 2. AI Analysis
      const info = await analyzeCCCDImage(base64Image);
      if (info) {
        onScan(info);
      } else {
        setError("AI không thể nhận diện được thông tin. Vui lòng chụp rõ nét hơn, đủ ánh sáng và không bị lóa.");
      }
    } catch (err) {
      console.error("Capture Analysis Error:", err);
      alert("Lỗi khi xử lý hình ảnh. Vui lòng thử lại.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsScanningFile(true);
    try {
      const html5QrCode = new Html5Qrcode('reader', false);
      const result = await html5QrCode.scanFile(file, true);
      onScan(result);
    } catch (err) {
      // If QR fails on file, try AI
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        const info = await analyzeCCCDImage(base64);
        if (info) {
          onScan(info);
        } else {
          alert("Không tìm thấy mã QR trong ảnh. AI cũng không thể nhận diện được thông tin.");
        }
      };
      reader.readAsDataURL(file);
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
          <div id="reader" className="w-full h-full"></div>
          
          {(isInitializing || isScanningFile || isProcessing) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black/60 backdrop-blur-sm z-10">
              <RefreshCw className="animate-spin mb-4 text-gold-primary" size={32} />
              <p className="text-[10px] uppercase font-black tracking-widest text-center px-8">
                {isScanningFile ? 'Đang phân tích file ảnh...' : isProcessing ? 'AI đang nhận diện thông tin...' : 'Đang khởi động camera...'}
              </p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 text-white bg-red-900/40 backdrop-blur-md z-20">
              <XCircle className="mb-4 text-red-500" size={48} />
              <p className="text-xs font-bold leading-relaxed px-4">{error}</p>
              <div className="flex gap-2 mt-6">
                <button 
                  onClick={() => setError(null)}
                  className="bg-gold-primary text-ink py-2 px-6 font-black uppercase text-[10px] tracking-widest hover:brightness-110 active:scale-95 transition-all"
                >
                  Thử lại
                </button>
                <button 
                  onClick={() => window.location.reload()}
                  className="bg-white/10 text-white py-2 px-6 font-black uppercase text-[10px] tracking-widest hover:bg-white/20 transition-all"
                >
                  Tải lại trang
                </button>
              </div>
            </div>
          )}

          {/* Overlay corner marks & SHUTTER BUTTON */}
          {!isInitializing && !error && (
            <>
              <div className="absolute inset-0 pointer-events-none opacity-50 z-0">
                <div className="absolute top-8 left-8 w-12 h-12 border-t-4 border-l-4 border-gold-primary"></div>
                <div className="absolute top-8 right-8 w-12 h-12 border-t-4 border-r-4 border-gold-primary"></div>
                <div className="absolute bottom-16 left-8 w-12 h-12 border-b-4 border-l-4 border-gold-primary"></div>
                <div className="absolute bottom-16 right-8 w-12 h-12 border-b-4 border-r-4 border-gold-primary"></div>
                <div className="absolute top-1/2 left-0 w-full h-[1px] bg-gold-primary/30 animate-pulse"></div>
              </div>
              
              <div className="absolute bottom-10 inset-x-0 flex justify-center z-10">
                <button 
                  onClick={handleManualCapture}
                  className="group relative flex items-center justify-center"
                >
                  <div className="absolute inset-0 bg-white/20 rounded-full blur-md group-hover:bg-gold-primary/30 transition-all duration-300"></div>
                  <div className="bg-white p-4 rounded-full shadow-2xl ring-8 ring-white/10 active:scale-90 transition-transform">
                    <Zap size={24} className="text-ink fill-ink" />
                  </div>
                  <p className="absolute -bottom-6 text-[8px] font-black uppercase tracking-widest text-white whitespace-nowrap opacity-60">Chụp & AI Phân Tích</p>
                </button>
              </div>
            </>
          )}
        </div>
        
        {!(isInitializing || error) && (
          <div className="p-4 bg-neutral-50 border-t border-neutral-100 italic flex justify-between items-center px-6">
            <p className="text-[10px] text-ink font-medium leading-relaxed max-w-[180px]">
              Đưa CCCD vào khung hình rồi nhấn nút chụp để AI phân tích.
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
