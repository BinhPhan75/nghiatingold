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

// ── Network Helper ────────────────────────────────────────────────────────────
export function nodeRequest(
  urlStr: string,
  options: { method: string; headers: Record<string, string>; body?: string; timeoutMs?: number }
): Promise<{ status: number; body: string }> {
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

// ── Safe JSON Parse ───────────────────────────────────────────────────────────
/**
 * Safely parse JSON — trả về object nếu hợp lệ, null nếu không phải JSON.
 * Ngăn lỗi "Unexpected token 'A', 'A server e...' is not valid JSON"
 * khi Vercel/server trả về HTML hoặc plain text thay vì JSON.
 */
export function safeJsonParse(body: string): any | null {
  if (!body || !body.trim()) return null;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

// ── Viettel URL Helpers ───────────────────────────────────────────────────────
export function getViettelOrigin(cfg: any): string {
  let origin = (cfg.api_url || 'https://api-vinvoice.viettel.vn').toString().trim().replace(/\/+$|\s+/g, '');
  if (cfg.is_sandbox && (!cfg.api_url || origin === 'https://api-vinvoice.viettel.vn')) {
    origin = 'https://api-sandbox-vinvoice.viettel.vn';
  }
  try { return new URL(origin).origin; }
  catch { return origin; }
}

export function getViettelApiBase(cfg: any): string {
  const raw = (cfg.api_url || 'https://api-vinvoice.viettel.vn').toString().trim().replace(/\/+$/, '');
  const origin = getViettelOrigin(cfg);
  try {
    const parsed = new URL(raw);
    if (parsed.pathname.includes('/services/einvoiceapplication/api')) {
      return `${parsed.origin}${parsed.pathname.split('/services/einvoiceapplication/api')[0]}/services/einvoiceapplication/api`;
    }
  } catch {}
  return `${origin}/services/einvoiceapplication/api`;
}

// ── Viettel Auth ──────────────────────────────────────────────────────────────
export function extractViettelAccessToken(data: any): string {
  if (!data || typeof data !== 'object') return '';
  return (
    data.access_token || data.accessToken || data.token || data.jwt ||
    data?.data?.access_token || data?.data?.token ||
    data?.result?.access_token || data?.result?.token || ''
  );
}

export async function loginViettel(cfg: any): Promise<{ token: string; status: number; message: string }> {
  const loginRes = await nodeRequest(`${getViettelOrigin(cfg)}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });

// ── Số tiền bằng chữ ─────────────────────────────────────────────────────────
export function numberToVietnameseWords(amount: number): string {
  if (amount === 0) return 'Khong dong';
  const units = ['', 'nghin', 'trieu', 'ty'];
  const digits = ['khong', 'mot', 'hai', 'ba', 'bon', 'nam', 'sau', 'bay', 'tam', 'chin'];
  const readThree = (n: number) => {
    const h = Math.floor(n / 100), t = Math.floor((n % 100) / 10), o = n % 10;
    let r = '';
    if (h > 0) r += `${digits[h]} tram `;
    if (t > 1) {
      r += `${digits[t]} muoi `;
      if (o > 0) r += `${o === 5 ? 'lam' : digits[o]} `;
    } else if (t === 1) {
      r += 'muoi ';
      if (o > 0) r += `${o === 5 ? 'lam' : digits[o]} `;
    } else if (o > 0 && h > 0) r += `le ${digits[o]} `;
    else if (o > 0) r += `${digits[o]} `;
    return r.trim();
  };
  let n = Math.round(amount);
  const parts: string[] = [];
  let unitIndex = 0;
  while (n > 0) {
    const chunk = n % 1000;
    if (chunk > 0) parts.unshift(readThree(chunk) + (units[unitIndex] ? ` ${units[unitIndex]}` : ''));
    n = Math.floor(n / 1000);
    unitIndex++;
  }
  return { token: null, status: res.status, error: `Lỗi kết nối Viettel. Mã lỗi HTTP: ${res.status}` };
}

// ── Build Invoice Payload ─────────────────────────────────────────────────────
export function buildViettelInvoicePayload(cfg: any, payload: any) {
  const transactionUuid = crypto.randomUUID();
  const total = Number(payload.totalAmount || 0);
  return {
    transactionUuid,
    data: {
      generalInvoiceInfo: {
        invoiceType: payload.invoiceType || '1',
        templateCode: payload.templateCode || cfg.template_code || '',
        invoiceSeries: payload.invoiceSeries || cfg.invoice_series || '',
        invoiceIssuedDate: payload.invoiceIssuedDate || Date.now(),
        currencyCode: 'VND',
        adjustmentType: '1',
        paymentStatus: true,
        cusGetInvoiceRight: true,
        transactionUuid,
        supplierTaxCode: cfg.tax_code,
      },
      buyerInfo: {
        buyerName: payload.buyerName || '',
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
        unitName: item.unitName || 'Cai',
        unitPrice: Number(item.unitPrice || 0),
        quantity: Number(item.quantity || 1),
        itemTotalAmountWithoutTax: Number(item.totalAmount || 0),
        taxPercentage: item.taxPercentage ?? 0,
        taxAmount: item.taxAmount ?? 0,
        itemTotalAmountWithTax: Number(item.totalAmount || 0),
        discount: item.discount ?? 0,
        itemDiscount: item.itemDiscount ?? 0,
        selection: item.selection ?? 1,
      })),
      summarizeInfo: {
        sumOfTotalLineAmountWithoutTax: total,
        totalAmountWithoutTax: total,
        totalTaxAmount: 0,
        totalAmountWithTax: total,
        totalAmountWithTaxInWords: numberToVietnameseWords(total),
        discountAmount: payload.discountAmount || 0,
      },
      taxBreakdowns: [{ taxPercentage: 0, taxableAmount: total, taxAmount: 0 }],
    },
  };

  return { transactionUuid: uniqueId, data };
}

export function sendMethodNotAllowed(res: any) {
  return res.status(405).json({ errorCode: 'METHOD_NOT_ALLOWED', description: 'Method not allowed.' });
}
