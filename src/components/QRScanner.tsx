import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Camera, RefreshCw, Upload, Zap, Loader2, Sparkles } from 'lucide-react';
import { analyzeCCCDImage } from '../services/geminiService';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startCamera = useCallback(async () => {
    setIsInitializing(true);
    setError(null);
    try {
      // Base constraints - environment camera is a MUST for CCCD
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsInitializing(false);
      }
    } catch (err: any) {
      console.error("Camera primary access failed:", err);
      // Fallback 1: Simple constraints
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsInitializing(false);
        }
      } catch (retryErr) {
        // Final Failure: Provide actionable advice for iFrame and Permission blocks
        const isIframe = window.self !== window.top;
        let errMsg = "Không thể mở máy ảnh. ";
        if (isIframe) {
          errMsg += "Môi trường xem thử (Iframe) có thể đang chặn camera. Hãy nhấn 'Mở Trong Tab Mới' bên dưới.";
        } else {
          errMsg += "Vui lòng cho phép quyền truy cập Camera trong cài đặt trình duyệt của bạn.";
        }
        setError(errMsg);
        setIsInitializing(false);
      }
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      const stream = videoRef.current?.srcObject as MediaStream;
      stream?.getTracks().forEach(track => track.stop());
    };
  }, [startCamera]);

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current || isProcessing) return;
    
    setIsProcessing(true);
    // Visual flash feedback
    const flash = document.createElement('div');
    flash.className = 'absolute inset-0 bg-white z-[60] animate-flash-fast';
    videoRef.current.parentElement?.appendChild(flash);
    setTimeout(() => flash.remove(), 300);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) return;

      // Precision Crop: Extract exactly what's visible in the 1.586 UI container
      const containerAspect = 1.586;
      const videoAspect = video.videoWidth / video.videoHeight;
      
      let sWidth, sHeight, sx, sy;

      if (videoAspect > containerAspect) {
        // Video is wider than UI - crop sides
        sHeight = video.videoHeight;
        sWidth = sHeight * containerAspect;
        sx = (video.videoWidth - sWidth) / 2;
        sy = 0;
      } else {
        // Video is taller than UI - crop top/bottom
        sWidth = video.videoWidth;
        sHeight = sWidth / containerAspect;
        sx = 0;
        sy = (video.videoHeight - sHeight) / 2;
      }

      // Target high-res for AI analysis (around 1200px width is ideal)
      canvas.width = 1268; // 1.586 * 800
      canvas.height = 800;
      
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      
      context.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);

      const base64Image = canvas.toDataURL('image/jpeg', 0.9);
      
      // AI Analysis
      const info = await analyzeCCCDImage(base64Image);
      if (info && (info.id || info.name)) {
        onScan(info);
      } else {
        alert("AI không thể đọc được. Hãy:\n1. Đưa thẻ lại gần hơn\n2. Giữ thẻ phẳng, không bị lóa đèn\n3. Tránh để ngón tay che mất thông tin trên thẻ.");
      }
    } catch (err) {
      console.error("Capture Analysis Error:", err);
      alert("Lỗi phần cứng hoặc AI. Vui lòng tải lại trang hoặc dùng tính năng tải ảnh.");
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
      const info = await analyzeCCCDImage(base64);
      if (info) {
        onScan(info);
      } else {
        alert("AI không thể nhận diện được thông tin từ ảnh tải lên.");
      }
      setIsScanningFile(false);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-sm w-full max-w-md overflow-hidden relative shadow-2xl border-2 border-gold-primary/30">
        <div className="p-4 border-b flex justify-between items-center bg-ink text-paper text-sm">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-gold-primary animate-pulse" />
            <h3 className="font-black text-[10px] uppercase tracking-[0.2em] m-0">Quét thông tin CCCD AI</h3>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => window.open(window.location.href, '_blank')}
              className="hover:text-gold-primary transition-colors p-2 bg-white/5 rounded border border-white/10 flex items-center gap-2 text-[8px] font-black uppercase"
              title="Mở trong tab mới để camera ổn định hơn"
            >
              <Zap size={12} className="text-gold-primary" /> Mở tab mới
            </button>
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
                {isScanningFile ? 'Đang phân tích file ảnh...' : isProcessing ? 'AI đang nhận diện thông tin...' : 'Đang khởi động camera...'}
              </p>
            </div>
          )}

        {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 text-white bg-red-950/90 backdrop-blur-md z-20">
              <div className="bg-white/10 p-4 rounded-full mb-6 ring-4 ring-white/5">
                <Camera size={48} className="text-red-400" />
              </div>
              <h4 className="text-sm font-black uppercase tracking-widest mb-3">Quyền truy cập bị từ chối</h4>
              <p className="text-[11px] leading-6 font-medium text-red-100 max-w-[280px] mb-8">
                Trình duyệt đang chặn quyền truy cập máy ảnh. Vui lòng nhấn vào biểu tượng <strong className="text-white">Ổ khóa</strong> hoặc <strong className="text-white">Cài đặt</strong> trên thanh địa chỉ và chọn <strong className="text-white">"Cho phép" (Allow)</strong> máy ảnh, sau đó nhấn nút thử lại bên dưới.
              </p>
              <div className="flex flex-col gap-3 w-full max-w-[200px]">
                <button 
                  onClick={startCamera}
                  className="bg-red-500 text-white py-3 px-6 font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all"
                >
                  Thử lại camera
                </button>
                <button 
                  onClick={() => window.open(window.location.href, '_blank')}
                  className="bg-white/10 text-white py-3 px-6 font-black uppercase text-[10px] tracking-widest border border-white/20 active:scale-95 transition-all"
                >
                  Mở trong tab mới
                </button>
              </div>
            </div>
          )}

          {/* Overlay frame marks */}
          {!isInitializing && !error && (
            <>
              <div className="absolute inset-0 pointer-events-none opacity-50 z-0">
                <div className="absolute top-4 left-4 w-12 h-12 border-t-4 border-l-4 border-gold-primary"></div>
                <div className="absolute top-4 right-4 w-12 h-12 border-t-4 border-r-4 border-gold-primary"></div>
                <div className="absolute bottom-4 left-4 w-12 h-12 border-b-4 border-l-4 border-gold-primary"></div>
                <div className="absolute bottom-4 right-4 w-12 h-12 border-b-4 border-r-4 border-gold-primary"></div>
                <div className="absolute top-1/2 left-0 w-full h-[1px] bg-gold-primary/30 animate-pulse"></div>
              </div>
              
              <div className="absolute bottom-6 inset-x-0 flex justify-center z-10">
                <button 
                  onClick={handleCapture}
                  disabled={isProcessing}
                  className="group relative flex items-center justify-center"
                >
                  <div className="absolute inset-0 bg-white/20 rounded-full blur-md group-hover:bg-gold-primary/30 transition-all duration-300"></div>
                  <div className="bg-white p-4 rounded-full shadow-2xl ring-8 ring-white/10 active:scale-95 transition-transform">
                    <Zap size={24} className="text-ink fill-ink" />
                  </div>
                  <p className="absolute -bottom-6 text-[8px] font-black uppercase tracking-widest text-white whitespace-nowrap opacity-60">Nhấn Để Chụp & Phân Tích</p>
                </button>
              </div>
            </>
          )}
        </div>
        
        {!(isInitializing || error) && (
          <div className="p-4 bg-neutral-50 border-t border-neutral-100 italic flex justify-between items-center px-6">
            <p className="text-[9px] text-ink font-bold leading-relaxed max-w-[200px]">
              MẸO: Giữ thẻ phẳng, đủ ánh sáng và TRÁNH BỊ LÓA ĐÈN trên mặt thẻ để AI nhận diện chính xác nhất.
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
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default QRScanner;
