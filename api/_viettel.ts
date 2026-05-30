import { createClient } from '@supabase/supabase-js';
import https from 'https';
import http from 'http';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

// Hàm bóc tách Bearer Token từ Header của phần mềm chính gửi lên
function getBearerToken(req: any) {
  const auth = req.headers.authorization || req.headers.Authorization || '';
  return auth.toString().replace(/^Bearer\\s+/i, '').trim();
}

export function sendMethodNotAllowed(res: any) {
  return res.status(405).json({ errorCode: 'METHOD_NOT_ALLOWED', description: 'Phương thức không được hỗ trợ.' });
}

// Hàm chặn bảo mật: Chỉ tài khoản Admin đăng nhập vào nghiatingold mới có quyền dùng chức năng này
export async function requireAdmin(req: any, res: any) {
  if (!supabaseUrl || !supabaseAnonKey) {
    res.status(500).json({ errorCode: 'SUPABASE_NOT_CONFIGURED', description: 'Hệ thống Server thiếu biến môi trường Supabase.' });
    return null;
  }
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ errorCode: 'AUTH_REQUIRED', description: 'Yêu cầu đăng nhập quản trị viên để thao tác.' });
    return null;
  }

  // Khởi tạo Supabase Client với token của người dùng hiện tại để kiểm tra quyền
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    res.status(401).json({ errorCode: 'INVALID_TOKEN', description: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
    return null;
  }

  return { supabase, user };
}

export function getViettelApiBase(cfg: any): string {
  return String(cfg.api_url || 'https://api-vinvoice.viettel.vn').trim().replace(/\/+$/, '');
}

// Trình trung chuyển HTTP request thuần bằng NodeJS không phụ thuộc Axios bên ngoài
export async function nodeRequest(urlStr: string, options: { method: string; headers?: any; body?: string; timeoutMs?: number }): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const isHttps = url.protocol === 'https:';
    const reqAdapter = isHttps ? https.request : http.request;

    const reqOpts = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: options.method.toUpperCase(),
      headers: options.headers || {},
      timeout: options.timeoutMs || 60000,
    };

    const req = reqAdapter(reqOpts, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => { resolve({ status: res.statusCode || 200, body }); });
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('Kết nối tới hệ thống Viettel vInvoice bị quá thời gian phản hồi (Timeout).')); });
    req.on('error', (err) => { reject(err); });

    if (options.body) req.write(options.body);
    req.end();
  });
}

// Hàm xử lý Đăng nhập bốc Token từ tổng đài Viettel
export async function loginViettel(cfg: any): Promise<{ token: string | null; status: number; error?: string }> {
  const origin = getViettelApiBase(cfg);
  const endpoint = `${origin}/services/auth/login`;
  
  const payload = { username: cfg.username, password: cfg.password };

  const res = await nodeRequest(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });

  if (res.status >= 200 && res.status < 300) {
    try {
      const data = JSON.parse(res.body);
      if (data.access_token) return { token: data.access_token, status: res.status };
      return { token: null, status: res.status, error: data.description || 'Không tìm thấy access_token trong phản hồi.' };
    } catch {
      return { token: null, status: res.status, error: 'Viettel trả về gói tin không đúng định dạng JSON.' };
    }
  }
  return { token: null, status: res.status, error: `Lỗi kết nối Viettel. Mã lỗi HTTP: ${res.status}` };
}

// Hàm build payload truyền dữ liệu cho ngành vàng (tính thuế dựa trên margin/chênh lệch)
export function buildViettelInvoicePayload(cfg: any, payload: any) {
  const uniqueId = `INV-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
  const total = (payload.items || []).reduce((acc: number, item: any) => acc + Number(item.totalAmount || 0), 0);

  const data = {
    generalInfo: {
      invoiceType: '1',
      templateCode: cfg.template_code,
      invoiceSeries: cfg.invoice_series,
      currencyCode: 'VND',
      adjustmentType: '1',
      paymentStatus: true,
      passiveInvoices: false,
    },
    buyerInfo: {
      buyerName: payload.buyerName || '',
      buyerTaxCode: payload.buyerTaxCode || '',
      buyerIdNo: payload.buyerIdNo || '',
      buyerIdType: payload.buyerIdType || '1',
      buyerAddressLine: payload.buyerAddress || '',
      buyerNotGetInvoice: payload.buyerIdNo ? 0 : 1,
    },
    sellerInfo: {
      sellerLegalName: cfg.company_name || '',
      sellerTaxCode: cfg.tax_code,
      sellerAddressLine: cfg.company_address || '',
    },
    payments: [{ paymentMethodName: payload.paymentMethodName || 'TM/CK' }],
    itemInfo: (payload.items || []).map((item: any, index: number) => ({
      lineNumber: index + 1,
      itemCode: item.itemCode || `HH${index + 1}`,
      itemName: item.itemName || '',
      unitName: item.unitName || 'Chỉ',
      unitPrice: Number(item.unitPrice || 0),
      quantity: Number(item.quantity || 1),
      itemTotalAmountWithoutTax: Number(item.totalAmount || 0),
      taxPercentage: item.taxPercentage ?? -1, // -1 tượng trưng cho hàng không chịu thuế / tính thuế trực tiếp trên giá trị tăng thêm của tiệm vàng
      taxAmount: 0,
      itemTotalAmountWithTax: Number(item.totalAmount || 0),
      discount: 0,
      itemDiscount: 0,
      selection: 1,
    })),
    summarizeInfo: {
      sumOfTotalLineAmountWithoutTax: total,
      totalAmountWithoutTax: total,
      totalTaxAmount: 0,
      totalAmountWithTax: total,
      totalAmountWithTaxInWords: numberToVietnameseWords(total) + ' đồng chẵn./.',
    },
  };

  return { transactionUuid: uniqueId, data };
}

function numberToVietnameseWords(num: number): string {
  if (num === 0) return 'Không';
  const units = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];
  const digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  let str = '';
  let unitIdx = 0;

  function chunkToWords(n: number): string {
    let s = '';
    const h = Math.floor(n / 100);
    const t = Math.floor((n % 100) / 10);
    const u = n % 10;
    if (h > 0) s += digits[h] + ' trăm ';
    if (t > 1) s += digits[t] + ' mươi ';
    else if (t === 1) s += 'mười ';
    else if (h > 0 && u > 0) s += 'lẻ ';
    if (u === 5 && t > 0) s += 'lăm';
    else if (u === 1 && t > 1) s += 'mốt';
    else if (u > 0) s += digits[u];
    return s.trim();
  }

  while (num > 0) {
    const chunk = num % 1000;
    if (chunk > 0) {
      str = chunkToWords(chunk) + ' ' + units[unitIdx] + ' ' + str;
    }
    num = Math.floor(num / 1000);
    unitIdx++;
  }
  const finalStr = str.trim().replace(/\s+/g, ' ');
  return finalStr.charAt(0).toUpperCase() + finalStr.slice(1);
}
