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
    // Standard: NUMBER|OLD_NUMBER|NAME|DOB|GENDER|ADDRESS|ISSUE_DATE
    let parts = cleanData.split('|');
    
    // We need at least the ID and Name. 
    // Usually part 0 is ID, part 2 is Name.
    if (parts.length < 3) {
      console.warn("QR Data format too short:", parts.length);
      return null;
    }

    const cccdId = parts[0]?.trim();
    // In newer cards (Căn cước), if they don't have an old ID, parts[1] might be empty.
    // The format still follows the pipe structure.
    const cccdName = parts[2]?.trim();
    
    if (!cccdId || !cccdName) return null;

    // Check if ID is likely a 12-digit number (standard)
    if (!/^\d{12}$/.test(cccdId)) {
      console.warn("Extracted ID does not look like a 12-digit CCCD:", cccdId);
    }

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
 * CRC16-CCITT (False) implementation for VietQR/EMVCo
 */
const crc16 = (str: string): string => {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
    }
    crc &= 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
};

const formatTag = (id: string, value: string): string => {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
};

/**
 * Generate standard EMVCo VietQR string (000201...)
 */
export const generateEMVCoQR = (
  bankId: string,
  accountNo: string,
  amount: number,
  description: string
) => {
  const bid = bankId || '970436';
  const memo = removeVietnameseTones(description);

  // Merchant Account Info (Tag 38)
  const guid = formatTag('00', 'A000000727'); // Napas
  const bankInfo = formatTag('01', bid);
  const accNo = formatTag('02', accountNo);
  const merchantAccount = formatTag('38', guid + bankInfo + accNo);

  // Transaction Info
  const payload = [
    formatTag('00', '01'), // Payload Indicator
    formatTag('01', '12'), // Point of Initiation: Dynamic
    merchantAccount,
    formatTag('53', '704'), // Currency: VND
    formatTag('54', amount.toString()),
    formatTag('58', 'VN'), // Country code
    formatTag('62', formatTag('08', memo)), // Additional data (Memo)
  ].join('');

  const finalStr = payload + '6304';
  const checksum = crc16(finalStr);
  
  return finalStr + checksum;
};

/**
 * Bank Deep Link / Universal Link Generator
 * Using direct Napas Universal Link (v2/pay) with EMVCo payload
 * This is the gold standard for opening bank apps with pre-filled data.
 */
export const getVCBDeepLink = (
  bankId: string,
  accountNo: string,
  amount: number,
  description: string
) => {
  const emvco = generateEMVCoQR(bankId, accountNo, amount, description);
  // Using qr.napas.com.vn Universal Link service for v2 payload redirection
  return `https://qr.napas.com.vn/v2/pay?tag=00&data=${encodeURIComponent(emvco)}`;
};

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};
