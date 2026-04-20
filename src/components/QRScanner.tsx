import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, RefreshCw, Upload, Zap, Sparkles, XCircle, FlipHorizontal } from 'lucide-react';
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
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [cameras, setCameras] = useState<any[]>([]);
  const [currentCameraIdx, setCurrentCameraIdx] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const startScanner = async (idx?: number) => {
    setIsInitializing(true);
    setError(null);

    try {
      if (scannerRef.current) {
        await stopScanner();
      }

      const html5QrCode = new Html5Qrcode('reader');
      scannerRef.current = html5QrCode;

      // Filter for back cameras only
      const allDevices = await Html5Qrcode.getCameras();
      const backCameras = allDevices.filter(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('rear') ||
        device.label.toLowerCase().includes('environment') ||
        device.label.toLowerCase().includes('sau') ||
        // If no labels, we'll have to take them all but the first one is often front
        allDevices.length > 1
      );
      
      const targetCameras = backCameras.length > 0 ? backCameras : allDevices;
      setCameras(targetCameras);

      const cameraIdx = idx !== undefined ? idx : currentCameraIdx;
      
      let cameraConfig: any = { facingMode: "environment" };
      if (targetCameras.length > 0) {
        const selectedId = targetCameras[cameraIdx % targetCameras.length].id;
        cameraConfig = { deviceId: { exact: selectedId } };
      }

      const config = { 
        fps: 25, 
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          // Standard CCCD ratio ~1.58
          const boxWidth = Math.floor(viewfinderWidth * 0.9);
          const boxHeight = Math.floor(boxWidth / 1.58);
          // Safety cap
          const finalHeight = Math.min(boxHeight, viewfinderHeight * 0.8);
          return { width: boxWidth, height: finalHeight };
        },
        aspectRatio: 1.333333,
        videoConstraints: {
          facingMode: { exact: "environment" }, // FORCE BACK CAMERA
          width: { ideal: 1920, min: 640 },
          height: { ideal: 1080, min: 480 }
        }
      };

      try {
        await html5QrCode.start(
          { facingMode: { exact: "environment" } }, 
          config, 
          (decodedText) => {
            if (!paused && !isProcessing) {
              if (navigator.vibrate) navigator.vibrate(50);
              onScan(decodedText);
            }
          },
          () => { }
        );
      } catch (err) {
        // Fallback to non-exact environment if exact fails
        await html5QrCode.start(
          { facingMode: "environment" }, 
          config, 
          (decodedText) => {
            if (!paused && !isProcessing) {
              if (navigator.vibrate) navigator.vibrate(50);
              onScan(decodedText);
            }
          },
          () => { }
        );
      }

      setIsInitializing(false);
      
      // Check capabilities for torch
      try {
        const video = document.querySelector('#reader video') as HTMLVideoElement;
        const track = (video?.srcObject as MediaStream)?.getVideoTracks()[0];
        const capabilities: any = track?.getCapabilities();
        setHasTorch(!!capabilities?.torch);
      } catch (e) {
        setHasTorch(false);
      }
    } catch (err: any) {
      console.error("Scanner start error:", err);
      setError("Không thể mở camera. Hãy cấp quyền hoặc dùng 'Tải ảnh'.");
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    startScanner();
    return () => {
      stopScanner();
    };
  }, []);

  const switchCamera = () => {
    if (cameras.length < 2) return;
    const nextIdx = (currentCameraIdx + 1) % cameras.length;
    setCurrentCameraIdx(nextIdx);
    startScanner(nextIdx);
  };

  const toggleTorch = async () => {
    if (!hasTorch) return;
    try {
      const video = document.querySelector('#reader video') as HTMLVideoElement;
      const track = (video?.srcObject as MediaStream)?.getVideoTracks()[0];
      if (track) {
        const newState = !torchOn;
        await track.applyConstraints({
          //@ts-ignore
          advanced: [{ torch: newState }]
        });
        setTorchOn(newState);
      }
    } catch (e) {
      console.error("Torch error:", e);
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
      const base64Image = canvas.toDataURL('image/jpeg', 0.9);

      // AI Analysis only for manual capture as per user intent
      const result = await analyzeCCCDImage(base64Image);
      if (result) {
        if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
        onScan(result);
      } else {
        setError("AI không nhận diện được. Hãy giữ thẻ phẳng, rõ nét và chụp lại.");
      }
    } catch (e) {
      console.error("Capture Analysis Error:", e);
      setError("Lỗi xử lý ảnh. Vui lòng thử lại.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        const info = await analyzeCCCDImage(base64);
        if (info) {
          onScan(info);
        } else {
          setError("Không bóc tách được thông tin từ file này.");
        }
        setIsProcessing(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError("Lỗi khi đọc file.");
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-2 md:p-4 backdrop-blur-md">
      <div className="bg-paper rounded-sm w-full max-w-lg overflow-hidden relative shadow-[0_0_100px_rgba(0,0,0,0.5)] border border-white/10 flex flex-col">
        {/* Header */}
        <div className="p-4 bg-ink text-paper flex justify-between items-center border-b border-gold-primary/20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gold-primary/20 rounded-full flex items-center justify-center text-gold-primary border border-gold-primary/30">
              <Camera size={16} />
            </div>
            <div>
              <h3 className="font-black text-[11px] uppercase tracking-[0.25em] leading-none m-0">CCCD Smart Scanner</h3>
              <p className="text-[8px] text-paper/40 uppercase tracking-widest mt-1">Phòng Lab AI NGHIATIN</p>
            </div>
          </div>
          <button onClick={onClose} className="text-paper/60 hover:text-gold-primary transition-all p-2 -mr-2 bg-white/5 rounded-full">
            <X size={20} />
          </button>
        </div>
        
        {/* Viewfinder */}
        <div className="relative aspect-[3/4] md:aspect-[4/3] bg-black overflow-hidden group">
          <div id="reader" className="w-full h-full [&>video]:object-cover"></div>
          
          {/* Diagnostic Overlay */}
          {(isInitializing || isProcessing) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-ink/80 backdrop-blur-xl z-30">
              <div className="relative">
                <RefreshCw className="animate-spin mb-6 text-gold-primary" size={64} strokeWidth={1} />
                <Sparkles className="absolute -top-2 -right-2 text-gold-primary animate-pulse" size={24} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gold-primary text-center px-12 leading-relaxed">
                {isInitializing ? 'Đang hiệu chuẩn ống kính...' : 'AI đang bóc tách thực thể...'}
              </p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-10 bg-red-950/90 backdrop-blur-2xl z-40 text-white">
              <XCircle className="mb-6 text-red-500 animate-bounce" size={64} strokeWidth={1.5} />
              <h4 className="text-lg font-black mb-3 uppercase tracking-wider">Lỗi Nhận Diện</h4>
              <p className="text-[12px] leading-relaxed opacity-70 mb-10 max-w-xs">{error}</p>
              <div className="flex flex-col gap-3 w-full">
                <button 
                  onClick={() => startScanner()}
                  className="bg-gold-primary text-ink py-4 px-10 font-bold uppercase text-[11px] tracking-[0.2em] shadow-2xl active:scale-95 transition-all"
                >
                  Thử lại ngay
                </button>
                <button 
                  onClick={onClose}
                  className="bg-white/5 py-4 px-10 font-bold uppercase text-[11px] tracking-[0.2em] border border-white/10 hover:bg-white/10 transition-all"
                >
                  Thoát
                </button>
              </div>
            </div>
          )}

          {/* Framing UI */}
          {!isInitializing && !error && (
            <>
              <div className="absolute inset-0 pointer-events-none z-10 p-10">
                <div className="w-full h-full border border-white/20 relative rounded-xl">
                  {/* Aspect ratio guide for CCCD */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-20">
                     <div className="w-[85%] aspect-[1.58] border-2 border-white rounded-lg"></div>
                  </div>
                  
                  <div className="absolute top-0 left-0 w-12 h-12 border-t-8 border-l-8 border-gold-primary rounded-tl-xl"></div>
                  <div className="absolute top-0 right-0 w-12 h-12 border-t-8 border-r-8 border-gold-primary rounded-tr-xl"></div>
                  <div className="absolute bottom-0 left-0 w-12 h-12 border-b-8 border-l-8 border-gold-primary rounded-bl-xl"></div>
                  <div className="absolute bottom-0 right-0 w-12 h-12 border-b-8 border-r-8 border-gold-primary rounded-br-xl"></div>
                  
                  {/* Laser Line */}
                  <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-gold-primary to-transparent shadow-[0_0_20px_#D4AF37] animate-[scanner_3s_ease-in-out_infinite]"></div>
                </div>
              </div>

              {/* Toolbar */}
              <div className="absolute top-6 right-6 flex flex-col gap-4 z-20">
                {cameras.length > 1 && (
                  <button 
                    onClick={switchCamera}
                    className="bg-ink/40 backdrop-blur-xl text-white w-12 h-12 flex items-center justify-center rounded-full border border-white/20 hover:bg-gold-primary hover:text-ink transition-all shadow-2xl"
                    title="Đổi ống kính"
                  >
                    <FlipHorizontal size={24} />
                  </button>
                )}
                {hasTorch && (
                  <button 
                    onClick={toggleTorch}
                    className={`w-12 h-12 flex items-center justify-center rounded-full border transition-all shadow-2xl ${torchOn ? 'bg-gold-primary text-ink border-gold-primary' : 'bg-ink/40 backdrop-blur-xl text-white border-white/20'}`}
                    title="Bật đèn Flash"
                  >
                    <Zap size={24} fill={torchOn ? "currentColor" : "none"} />
                  </button>
                )}
              </div>

              {/* Shutter Button Section */}
              <div className="absolute bottom-8 inset-x-0 flex flex-col items-center gap-4 z-20">
                 <button 
                  onClick={handleManualCapture}
                  className="group relative"
                >
                  <div className="absolute inset-0 bg-gold-primary/20 rounded-full blur-2xl group-hover:bg-gold-primary/40 transition-all"></div>
                  <div className="bg-white w-20 h-20 rounded-full shadow-[0_0_40px_rgba(255,255,255,0.4)] flex items-center justify-center ring-8 ring-white/10 active:scale-90 transition-all border-4 border-ink">
                    <Sparkles size={32} className="text-ink" />
                  </div>
                </button>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">Chụp Để AI Phân Tích</p>
              </div>
            </>
          )}
        </div>
        
        {/* Footer info */}
        <div className="p-6 bg-paper grid grid-cols-2 gap-4">
          <button 
             onClick={() => fileInputRef.current?.click()}
             className="col-span-2 bg-neutral-100 py-4 px-6 font-black uppercase text-[11px] tracking-widest hover:bg-gold-primary hover:text-ink transition-all flex items-center justify-center gap-3 border border-ink/5"
          >
            <Upload size={16} /> Tải ảnh thẻ gốc
          </button>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
          
          <div className="col-span-2 flex items-center gap-3 opacity-40">
            <div className="flex-1 h-[1px] bg-ink"></div>
            <span className="text-[8px] font-black uppercase tracking-widest">NGHIATIN Lab AI v2.4</span>
            <div className="flex-1 h-[1px] bg-ink"></div>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes scanner {
          0% { top: 5%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 95%; opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default QRScanner;
