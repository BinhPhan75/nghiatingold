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
  // 970436 is the BIN for Vietcombank if not provided
  const bid = bankId || '970436';
  const template = 'compact2'; 
  const encodedDesc = encodeURIComponent(description);
  const encodedName = encodeURIComponent(accountName);
  
  return `https://img.vietqr.io/image/${bid}-${accountNo}-${template}.png?amount=${amount}&addInfo=${encodedDesc}&accountName=${encodedName}`;
};

/**
 * Bank Deep Link / Universal Link Generator
 * Using VietQR standard Universal Link which most VN bank apps intercept
 */
export const getVCBDeepLink = (
  bankId: string,
  accountNo: string,
  amount: number,
  description: string
) => {
  const bid = bankId || '970436';
  const encodedDesc = encodeURIComponent(description);
  
  // Format: https://qr.vietqr.io/VND/<BANK_BIN>/<ACC_NO>/<AMOUNT>/<DESC>
  // This URL is standard and recognized by VCB Digibank and other apps
  return `https://qr.vietqr.io/VND/${bid}/${accountNo}/${amount}/${encodedDesc}`;
};

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};
