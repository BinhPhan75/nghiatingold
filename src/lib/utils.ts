/**
 * Vietnamese CCCD QR Parser
 * Format: CCCD_NUMBER|OLD_CCCD|FULL_NAME|DOB(DDMMYYYY)|GENDER|ADDRESS|ISSUE_DATE(DDMMYYYY)
 */
export interface CCCDInfo {
  id: string;
  name: string;
  dob: string;
  gender: string;
  address: string;
}

export const parseCCCD = (qrData: string): CCCDInfo | null => {
  if (!qrData) return null;
  try {
    // Basic hygiene: remove potential whitespace
    const cleanData = qrData.trim();
    const parts = cleanData.split('|');
    
    // Vietnamese CCCD format usually has 7 parts
    if (parts.length < 6) return null;

    return {
      id: parts[0],
      name: parts[2],
      dob: parts[3],
      gender: parts[4],
      address: parts[5],
    };
  } catch (e) {
    console.error("Error parsing CCCD QR", e);
    return null;
  }
};

/**
 * VietQR Image Generator
 */
export const getVietQRUrl = (
  bankId: string, 
  accountNo: string, 
  accountName: string, 
  amount: number, 
  description: string
) => {
  const template = 'qr_only'; // or 'compact', 'compact2'
  const encodedDesc = encodeURIComponent(description);
  const encodedName = encodeURIComponent(accountName);
  
  return `https://img.vietqr.io/image/${bankId}-${accountNo}-${template}.png?amount=${amount}&addInfo=${encodedDesc}&accountName=${encodedName}`;
};

/**
 * Bank Deep Link Generator (Vietcombank)
 * Note: Actual deep linking for VCB often requires specific SDK or web payment gateway.
 * For this app, we'll provide a formatted string for copy or a generic app open if possible.
 */
export const getVCBDeepLink = (description: string) => {
  // Mobile app scheme for VCB (generalized)
  // In many cases, it's just 'vietcombank://' to open the app.
  return `vietcombank://`;
};

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};
