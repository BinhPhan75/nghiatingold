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
 * Helper to remove Vietnamese tones/accents for bank memo compatibility
 */
export const removeVietnameseTones = (str: string) => {
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
  str = str.replace(/đ/g, "d");
  str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
  str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
  str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
  str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
  str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
  str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
  str = str.replace(/Đ/g, "D");
  // Some system combine marks
  str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, ""); // ̀ ́ ̃ ̉ ̣  
  str = str.replace(/\u02C6|\u0306|\u031B/g, ""); // ˆ ̆ ̛  
  // Remove special characters that might break bank apps
  return str.replace(/[^a-zA-Z0-9 ]/g, "").toUpperCase();
};

/**
 * Bank Deep Link / Universal Link Generator
 * Using direct Universal Link format (https://qr.vietqr.io/VND/...) 
 * This is more reliable for opening apps directly without browser redirects.
 */
export const getVCBDeepLink = (
  bankId: string,
  accountNo: string,
  amount: number,
  description: string
) => {
  const bid = bankId || '970436'; // Default VCB BIN
  const memo = removeVietnameseTones(description);
  
  // Format: https://qr.vietqr.io/VND/<BANK_BIN>/<ACC_NO>/<AMOUNT>/<DESC>
  // This is a Universal Link that banking apps register to open directly
  return `https://qr.vietqr.io/VND/${bid}/${accountNo}/${amount}/${encodeURIComponent(memo)}`;
};

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};
