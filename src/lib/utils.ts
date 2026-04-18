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
    // Basic hygiene: remove potential whitespace and non-printable characters
    const cleanData = qrData.trim().replace(/[\x00-\x1F\x7F-\x9F]/g, "");
    
    // Vietnamese CCCD format usually uses '|' as separator. 
    let parts = cleanData.split('|');
    
    // If fewer than 6 parts, it's likely not a valid CCCD format we recognize.
    if (parts.length < 6) {
      console.warn("QR Data format unrecognized. Expected at least 6 parts, got:", parts.length);
      return null;
    }

    // Ensure we don't return empty values
    const cccdId = parts[0]?.trim();
    const cccdName = parts[2]?.trim();
    
    if (!cccdId || !cccdName) return null;

    return {
      id: cccdId,
      name: cccdName,
      dob: parts[3]?.trim() || '',
      gender: parts[4]?.trim() || '',
      address: parts[5]?.trim() || '',
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
