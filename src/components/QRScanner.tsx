import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Camera, RefreshCw, Upload, Zap, Loader2, Sparkles, CheckCircle2, ChevronRight, CornerDownRight, QrCode } from 'lucide-react';
import { analyzeCCCDImage, CCCDAnalysisResult } from '../services/geminiService';
import jsQR from 'jsqr';
import { parseCCCD } from '../lib/utils';

interface QRScannerProps {
  onScan: (data: string | object) => void;
  onClose: () => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScan, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isScanningFile, setIsScanningFile] = useState(false);
  const [scannedData, setScannedData] = useState<CCCDAnalysisResult | null>(null);
  const [showBackPrompt, setShowBackPrompt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFinishEarly = useCallback(() => {
    if (scannedData) {
      onScan(scannedData);
    }
  }, [scannedData, onScan]);

  const processResult = useCallback((result: CCCDAnalysisResult) => {
    // Basic validation
    if (!result.id && !result.name) return;

    if ((result.cardType === 'NEW' && result.side === 'BACK') || result.cardType === 'ELECTRONIC' || result.cardType === 'OLD' || result.side === 'ALL') {
      onScan(result);
    } else if (result.cardType === 'NEW' && result.side === 'FRONT') {
      setScannedData(result);
      setShowBackPrompt(true);
    } else {
      onScan(result);
    }
  }, [onScan]);

  const startCamera = useCallback(async () => {
    setIsInitializing(true);
    setError(null);
    
    // Check if getUserMedia is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("Trình duyệt này không hỗ trợ truy cập máy ảnh.");
      setIsInitializing(false);
      return;
    }

    const tryStream = async (constraints: MediaStreamConstraints) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Important: explicitly call play() for some mobile browsers
          await videoRef.current.play().catch(e => console.warn("Auto-play failed:", e));
          setIsInitializing(false);
          return true;
        }
      } catch (err) {
        console.warn("Stream attempt failed:", constraints, err);
        return false;
      }
      return false;
    };

    // Attempt 1: High-res back camera
    let success = await tryStream({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      }
    });

    // Attempt 2: Standard-res back camera
    if (!success) {
      success = await tryStream({
        video: {
          facingMode: 'environment', // strict but standard
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
    }

    // Attempt 3: Any camera
    if (!success) {
      success = await tryStream({ video: true });
    }

    if (!success) {
      const isIframe = window.self !== window.top;
      let errMsg = "Không thể khởi động máy ảnh. ";
      
      if (isIframe) {
        errMsg += "Trình xem thử có thể đang chặn quyền truy cập Camera. Vui lòng nhấn nút 'Mở Trong Tab Mới' (icon mũi tên ở góc phải trên) hoặc chọn 'Open in new tab' để sử dụng đầy đủ tính năng.";
      } else {
        errMsg += "Vui lòng kiểm tra quyền truy cập Camera trong cài đặt trình duyệt hoặc đổi sang trình duyệt khác (Safari/Chrome).";
      }
      
      setError(errMsg);
      setIsInitializing(false);
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [startCamera]);

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current || isProcessing) return;
    
    setIsProcessing(true);
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context || video.videoWidth === 0) return;

      const containerAspect = 1.586;
      const videoAspect = video.videoWidth / video.videoHeight;
      
      let sWidth, sHeight, sx, sy;

      if (videoAspect > containerAspect) {
        sHeight = video.videoHeight;
        sWidth = sHeight * containerAspect;
        sx = (video.videoWidth - sWidth) / 2;
        sy = 0;
      } else {
        sWidth = video.videoWidth;
        sHeight = sWidth / containerAspect;
        sx = 0;
        sy = (video.videoHeight - sHeight) / 2;
      }

      canvas.width = 1600;
      canvas.height = 1000;
      context.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, 1600, 1000);

      const base64Image = canvas.toDataURL('image/jpeg', 0.9);
      const info = await analyzeCCCDImage(base64Image);
      
      if (info) {
        processResult(info);
      } else {
        alert("AI không thể nhận diện. Hãy thử lại với ảnh rõ nét hơn.");
      }
    } catch (err) {
      console.error("Capture Error:", err);
      alert("Đã xảy ra lỗi khi phân tích ảnh.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsScanningFile(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      try {
        const info = await analyzeCCCDImage(base64);
        if (info) {
          processResult(info);
        } else {
          alert("AI không thể nhận diện được thông tin từ ảnh tải lên.");
        }
      } catch (err: any) {
        console.error("Upload Scan Error:", err);
        alert(err?.message || "Lỗi khi phân tích ảnh tải lên.");
      } finally {
        setIsScanningFile(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-sm w-full max-w-sm overflow-hidden relative shadow-2xl border-2 border-gold-primary/30">
        <div className="p-4 border-b flex justify-between items-center bg-ink text-paper text-sm">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-gold-primary animate-pulse" />
            <h3 className="font-black text-[10px] uppercase tracking-[0.2em] m-0">
              {showBackPrompt ? 'Quét Mã QR Mặt Sau' : 'Quét thông tin CCCD AI'}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="hover:text-gold-primary transition-colors p-1">
              <X size={24} />
            </button>
          </div>
        </div>
        
        <div className="relative aspect-[1.586/1] bg-black overflow-hidden shadow-inner border-y border-gold-primary/20">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          
          {(isInitializing || isScanningFile || isProcessing) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-black/60 backdrop-blur-sm z-10">
              <Loader2 className="animate-spin mb-4 text-gold-primary" size={32} />
              <p className="text-[10px] uppercase font-black tracking-widest text-center px-8">
                {isScanningFile ? 'Đang phân tích file ảnh...' : isProcessing ? 'AI đang nhận diện...' : 'Đang khởi động camera...'}
              </p>
            </div>
          )}

          {showBackPrompt && !isProcessing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-white bg-ink/80 backdrop-blur-md z-30 animate-in fade-in duration-300">
               <div className="bg-gold-primary/20 p-4 rounded-full mb-4 ring-4 ring-gold-primary/10">
                 <CheckCircle2 size={40} className="text-gold-primary" />
               </div>
               <h4 className="text-sm font-black uppercase tracking-widest mb-2">Đã nhận diện mặt trước</h4>
               <p className="text-[10px] leading-tight font-medium text-neutral-300 text-center mb-6">
                 Đây là thẻ Căn cước mẫu mới. Vui lòng lật <strong className="text-white">mặt sau</strong> và hướng camera vào <strong className="text-white">Mã QR</strong> để lấy đầy đủ thông tin địa chỉ và các dữ liệu khác.
               </p>
               <div className="flex flex-col gap-3 w-full">
                 <button 
                  onClick={() => setShowBackPrompt(false)}
                  className="bg-gold-primary text-ink py-3 px-6 font-black uppercase text-[10px] tracking-widest shadow-lg flex items-center justify-center gap-2"
                 >
                   Quét Mã QR ngay <ChevronRight size={14} />
                 </button>
                 <button 
                   onClick={handleFinishEarly}
                   className="bg-white/10 text-white py-3 px-6 font-black uppercase text-[10px] tracking-widest border border-white/20"
                 >
                   Không, tôi sẽ tự nhập địa chỉ
                 </button>
               </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 text-white bg-red-950/90 backdrop-blur-md z-20">
              <div className="bg-white/10 p-4 rounded-full mb-6 ring-4 ring-white/5">
                <Camera size={24} className="text-red-400" />
              </div>
              <h4 className="text-sm font-black uppercase tracking-widest mb-3">Lỗi Camera</h4>
              <p className="text-[10px] leading-tight font-medium text-red-100 mb-6">
                {error}
              </p>
              <button 
                onClick={startCamera}
                className="bg-red-500 text-white py-3 px-6 font-black uppercase text-[10px] tracking-widest shadow-lg"
              >
                Thử lại ngay
              </button>
            </div>
          )}

          {!isInitializing && !error && !showBackPrompt && (
            <>
              <div className="absolute inset-0 pointer-events-none z-0 opacity-40">
                <div className="absolute top-4 left-4 w-12 h-12 border-t-4 border-l-4 border-gold-primary transition-all"></div>
                <div className="absolute top-4 right-4 w-12 h-12 border-t-4 border-r-4 border-gold-primary transition-all"></div>
                <div className="absolute bottom-4 left-4 w-12 h-12 border-b-4 border-l-4 border-gold-primary transition-all"></div>
                <div className="absolute bottom-4 right-4 w-12 h-12 border-b-4 border-r-4 border-gold-primary transition-all"></div>
              </div>
              
              <div className="absolute bottom-6 inset-x-0 flex justify-center z-10">
                <button 
                  onClick={handleCapture}
                  disabled={isProcessing}
                  className="group relative flex items-center justify-center"
                >
                  <div className="absolute inset-0 bg-gold-primary/20 rounded-full scale-125 blur-md animate-pulse"></div>
                  <div className="w-16 h-16 bg-gold-primary rounded-full flex items-center justify-center shadow-2xl relative z-10 border-4 border-paper group-active:scale-90 transition-transform">
                    <Camera size={28} className="text-ink" />
                  </div>
                  <p className="absolute -bottom-8 text-[8px] font-black uppercase tracking-widest text-white whitespace-nowrap opacity-80 bg-ink/50 px-2 py-0.5 rounded shadow-sm">
                    {scannedData ? 'CHỤP MÃ QR MẶT SAU' : 'CHỤP MẶT TRƯỚC'}
                  </p>
                </button>
              </div>
            </>
          )}
        </div>
        
        {!isInitializing && (
          <div className="p-4 bg-neutral-50 border-t border-neutral-100 flex flex-col gap-3">
            <div className="flex justify-between items-center italic">
              <p className="text-[9px] text-ink font-bold leading-tight max-w-[200px]">
                {error ? 'Bạn có thể chọn tải ảnh chụp sẵn từ thư viện nếu không thể mở camera.' : 
                 showBackPrompt ? 'Vui lòng lật mặt sau và chụp Mã QR để lấy đủ thông tin.' : 
                 'Giữ thẻ phẳng, đủ ánh sáng và tránh bị lóa đèn để AI nhận diện tốt nhất.'}
              </p>
              <div className="flex gap-2">
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-paper border border-ink/10 p-2.5 rounded shadow-sm text-ink hover:bg-gold-primary transition-all flex items-center gap-2 text-[9px] font-black uppercase tracking-widest"
                >
                  <Upload size={14} /> Tải ảnh
                </button>
              </div>
            </div>
            
            {scannedData && (
              <div className="flex items-center gap-2 py-2 px-3 bg-green-50 border border-green-100 rounded-sm">
                 <div className="flex-1">
                   <p className="text-[8px] font-black uppercase text-green-600 mb-0.5">Tiến độ quét</p>
                   <p className="text-[10px] font-bold text-ink truncate">{scannedData.name}</p>
                 </div>
                 <div className="flex items-center gap-1 text-[8px] font-black text-green-600">
                    <CheckCircle2 size={12} /> CẦN QUÉT QR MẶT SAU
                 </div>
              </div>
            )}
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default QRScanner;
