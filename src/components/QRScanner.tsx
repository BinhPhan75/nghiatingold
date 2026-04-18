import React, { useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X } from 'lucide-react';

interface QRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScan, onClose }) => {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      'reader',
      { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      },
      /* verbose= */ false
    );

    scanner.render(
      (decodedText) => {
        onScan(decodedText);
        scanner.clear();
      },
      (error) => {
        // Handle scan error (usually just "not found")
      }
    );

    return () => {
      scanner.clear().catch(err => console.error("Failed to clear scanner", err));
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-white rounded-lg w-full max-w-md overflow-hidden relative">
        <div className="p-4 border-b flex justify-between items-center bg-ink text-paper">
          <h3 className="font-black text-sm uppercase tracking-widest m-0">Quét mã QR CCCD</h3>
          <button onClick={onClose} className="hover:text-gold-primary transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div id="reader" className="w-full"></div>
        
        <div className="p-4 text-center text-xs text-neutral-500 font-medium">
          Vui lòng hướng camera vào mã QR trên thẻ CCCD
        </div>
      </div>
    </div>
  );
};

export default QRScanner;
