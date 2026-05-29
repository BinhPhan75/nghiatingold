import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import https from 'https';
import http from 'http';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

// ── Auth Helpers ─────────────────────────────────────────────────────────────
function getBearerToken(req: any) {
  const auth = req.headers.authorization || req.headers.Authorization || '';
  return auth.toString().replace(/^Bearer\s+/i, '').trim();
}

function getUserSupabase(token: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function requireAdmin(req: any, res: any) {
  if (!supabaseUrl || !supabaseAnonKey) {
    res.status(500).json({ errorCode: 'SUPABASE_NOT_CONFIGURED', description: 'Server missing Supabase env vars.' });
    return null;
  }
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ errorCode: 'AUTH_REQUIRED', description: 'Missing Authorization bearer token.' });
    return null;
  }
  const supabase = getUserSupabase(token);
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) {
    res.status(401).json({ errorCode: 'INVALID_TOKEN', description: 'Invalid login session.' });
    return null;
  }
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id,email,role,status')
    .eq('id', authData.user.id)
    .single();
  const isAdminEmail = authData.user.email?.toLowerCase() === 'binhphan.070582@gmail.com';
  if (profileError || (!isAdminEmail && profile?.role !== 'ADMIN')) {
    res.status(403).json({ errorCode: 'ADMIN_ONLY', description: 'Only ADMIN users can use Viettel e-invoice APIs.' });
    return null;
  }
  return { supabase, user: authData.user, profile };
}

// ── Network Helper ────────────────────────────────────────────────────────────
function nodeRequest(
  urlStr: string,
  options: { method: string; headers: Record<string, string>; body?: string; timeoutMs?: number }
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: options.method,
        headers: options.headers,
        timeout: options.timeoutMs || 12000,
      },
      (response) => {
        let data = '';
        response.on('data', (chunk) => (data += chunk));
        response.on('end', () => resolve({ status: response.statusCode || 0, body: data }));
      }
    );
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.on('error', reject);
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
function safeJsonParse(body: string): any | null {
  if (!body || !body.trim()) return null;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

// ── Viettel URL Helpers ───────────────────────────────────────────────────────
function getViettelOrigin(cfg: any): string {
  let origin = (cfg.api_url || 'https://api-vinvoice.viettel.vn').toString().trim().replace(/\/+$|\s+/g, '');
  if (cfg.is_sandbox && (!cfg.api_url || origin === 'https://api-vinvoice.viettel.vn')) {
    origin = 'https://api-sandbox-vinvoice.viettel.vn';
  }
  try { return new URL(origin).origin; }
  catch { return origin; }
}

function getViettelApiBase(cfg: any): string {
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
function extractViettelAccessToken(data: any): string {
  if (!data || typeof data !== 'object') return '';
  return (
    data.access_token || data.accessToken || data.token || data.jwt ||
    data?.data?.access_token || data?.data?.token ||
    data?.result?.access_token || data?.result?.token || ''
  );
}

async function loginViettel(cfg: any): Promise<{ token: string; status: number; message: string }> {
  const loginRes = await nodeRequest(`${getViettelOrigin(cfg)}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username: cfg.username, password: cfg.password }),
    timeoutMs: 15000,
  });
  // Use safeJsonParse — Viettel đôi khi trả HTML khi lỗi, không phải JSON
  const data = safeJsonParse(loginRes.body) ?? {};
  const token = extractViettelAccessToken(data);
  const message = data.description || data.message || data.error || loginRes.body?.substring(0, 200) || '';
  return { token, status: loginRes.status, message };
}

// ── Số tiền bằng chữ ─────────────────────────────────────────────────────────
function numberToVietnameseWords(amount: number): string {
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
  const rs = parts.join(' ').trim();
  return `${rs.charAt(0).toUpperCase()}${rs.slice(1)} dong`;
}

// ── Build Invoice Payload ─────────────────────────────────────────────────────
function buildViettelInvoicePayload(cfg: any, payload: any) {
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
}

// ── DB Helpers ────────────────────────────────────────────────────────────────
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
});

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS viettel_einvoice_config (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username        TEXT NOT NULL DEFAULT '',
      password        TEXT NOT NULL DEFAULT '',
      tax_code        TEXT NOT NULL DEFAULT '',
      api_url         TEXT NOT NULL DEFAULT 'https://api-vinvoice.viettel.vn',
      template_code   TEXT NOT NULL DEFAULT '',
      invoice_series  TEXT NOT NULL DEFAULT '',
      is_sandbox      BOOLEAN NOT NULL DEFAULT TRUE,
      company_name    TEXT NOT NULL DEFAULT '',
      company_address TEXT NOT NULL DEFAULT '',
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getConfig() {
  await ensureTable();
  const r = await pool.query('SELECT * FROM viettel_einvoice_config ORDER BY updated_at DESC LIMIT 1');
  return r.rows[0] || null;
}

// ── Main Handler ──────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = (req.query.action as string) || '';

  // ── GET config ───────────────────────────────────────────────────────────
  if (req.method === 'GET' && action === 'config') {
    try {
      const cfg = await getConfig();
      if (!cfg) return res.json({ config: null });
      return res.json({
        config: {
          ...cfg,
          password: cfg.password ? '••••••••' : '',
          _hasPassword: Boolean(cfg.password),
        },
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── POST config ──────────────────────────────────────────────────────────
  if (req.method === 'POST' && action === 'config') {
    const {
      username, password, tax_code, api_url,
      template_code, invoice_series, is_sandbox,
      company_name, company_address,
    } = req.body || {};
    if (!username || !tax_code) {
      return res.status(400).json({ error: 'Thiếu username hoặc mã số thuế' });
    }
    try {
      await ensureTable();
      const existing = await pool.query(
        'SELECT password FROM viettel_einvoice_config ORDER BY updated_at DESC LIMIT 1'
      );
      const finalPwd =
        password && !password.startsWith('•')
          ? password
          : existing.rows[0]?.password || '';
      const fixedId = '00000000-0000-0000-0000-000000000001';
      await pool.query(
        `INSERT INTO viettel_einvoice_config
          (id,username,password,tax_code,api_url,template_code,invoice_series,is_sandbox,company_name,company_address,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
         ON CONFLICT (id) DO UPDATE SET
           username=EXCLUDED.username, password=EXCLUDED.password, tax_code=EXCLUDED.tax_code,
           api_url=EXCLUDED.api_url, template_code=EXCLUDED.template_code,
           invoice_series=EXCLUDED.invoice_series, is_sandbox=EXCLUDED.is_sandbox,
           company_name=EXCLUDED.company_name, company_address=EXCLUDED.company_address,
           updated_at=NOW()`,
        [
          fixedId,
          username.trim(),
          finalPwd,
          tax_code.trim(),
          (api_url || 'https://api-vinvoice.viettel.vn').trim().replace(/\/+$/, ''),
          (template_code || '').trim(),
          (invoice_series || '').trim(),
          is_sandbox !== false,
          (company_name || '').trim(),
          (company_address || '').trim(),
        ]
      );
      return res.json({ success: true });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── POST test ────────────────────────────────────────────────────────────
  if (req.method === 'POST' && action === 'test') {
    try {
      const cfg = await getConfig();
      if (!cfg?.username) {
        return res.json({ success: false, message: 'Chưa có cấu hình Viettel' });
      }
      const { token, status, message } = await loginViettel(cfg);
      if (!token) {
        return res.json({
          success: false,
          message: `Đăng nhập thất bại (HTTP ${status}): ${message}`,
        });
      }
      return res.json({
        success: true,
        message: `Kết nối thành công! Tài khoản: ${cfg.username} | MST: ${cfg.tax_code} | ${cfg.is_sandbox ? 'Sandbox' : 'Production'}`,
        hasToken: true,
      });
    } catch (e: any) {
      return res.json({ success: false, message: e.message });
    }
  }

  // ── POST preview — Xem trước PDF (không lưu) ─────────────────────────────
  if (req.method === 'POST' && action === 'preview') {
    try {
      const cfg = await getConfig();
      if (!cfg?.username) {
        return res.status(400).json({ error: 'Chưa có cấu hình Viettel' });
      }

      const { token, status: loginStatus, message: loginMsg } = await loginViettel(cfg);
      if (!token) {
        return res.status(401).json({
          error: `Đăng nhập Viettel thất bại (HTTP ${loginStatus}): ${loginMsg}`,
        });
      }

      const apiBase = getViettelApiBase(cfg);
      const { transactionUuid, data: invoiceData } = buildViettelInvoicePayload(cfg, req.body || {});
      const authHeaders = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Cookie: `access_token=${token}`,
        Authorization: `Bearer ${token}`,
      };

      const r = await nodeRequest(
        `${apiBase}/InvoiceUtilsWS/createInvoiceDraftPreview/${cfg.tax_code}`,
        { method: 'POST', headers: authHeaders, body: JSON.stringify(invoiceData), timeoutMs: 30000 }
      );

      if (r.status >= 200 && r.status < 300) {
        // safeJsonParse — tránh crash nếu server trả về HTML/text
        const d = safeJsonParse(r.body);
        if (d) {
          const base64 = d.fileToBytes || d.pdfData || d.data || d.fileData || null;
          if (base64) {
            return res.json({ success: true, pdfBase64: base64, uuid: transactionUuid });
          }
          return res.json({ success: true, raw: d, uuid: transactionUuid });
        }
        // Body là raw binary/base64 thẳng
        return res.json({
          success: true,
          pdfBase64: Buffer.from(r.body, 'binary').toString('base64'),
          uuid: transactionUuid,
        });
      }

      return res.status(r.status).json({
        error: `HTTP ${r.status}`,
        body: r.body.substring(0, 300),
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── POST create — Tạo hóa đơn nháp ─────────────────────────────────────
  if (req.method === 'POST' && action === 'create') {
    try {
      const cfg = await getConfig();
      if (!cfg?.username) {
        return res.status(400).json({ error: 'Chưa có cấu hình Viettel' });
      }

      const { token, status: loginStatus, message: loginMsg } = await loginViettel(cfg);
      if (!token) {
        return res.status(401).json({
          error: `Đăng nhập Viettel thất bại (HTTP ${loginStatus}): ${loginMsg}`,
        });
      }

      const apiBase = getViettelApiBase(cfg);
      const { transactionUuid, data: invoiceData } = buildViettelInvoicePayload(cfg, req.body || {});
      const authHeaders = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Cookie: `access_token=${token}`,
        Authorization: `Bearer ${token}`,
      };

      const endpoints = [
        `${apiBase}/InvoiceWS/createOrUpdateInvoiceDraft/${cfg.tax_code}`,
        `${apiBase}/InvoiceWS/createInvoiceDraft/${cfg.tax_code}`,
      ];

      const log: string[] = [];
      for (const ep of endpoints) {
        const r = await nodeRequest(ep, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(invoiceData),
          timeoutMs: 75000,
        });
        const short = ep.replace(apiBase, '');
        log.push(`POST ${short} → ${r.status}`);

        if (r.status === 404 || r.status === 405) continue;
        if (r.status === 401 || r.status === 403) {
          return res.status(401).json({ error: 'Xác thực thất bại', log });
        }

        if (r.status >= 200 && r.status < 300) {
          // safeJsonParse — tránh "Unexpected token 'A'" khi Viettel trả HTML lỗi
          const d = safeJsonParse(r.body);
          if (!d) {
            return res.status(502).json({
              error: `Viettel trả về phản hồi không hợp lệ (không phải JSON): ${r.body.substring(0, 200)}`,
              log,
            });
          }
          const ok = !d.errorCode || ['', '0', 'SUCCESS'].includes(String(d.errorCode));
          if (ok) {
            return res.json({
              success: true,
              invoiceNo: d.result?.invoiceNo || d.invoiceNo,
              transactionUuid,
              result: d.result || d,
              log,
            });
          }
          return res.status(422).json({
            error: d.description || d.message || 'Viettel từ chối',
            errorCode: d.errorCode,
            log,
          });
        }

        // Non-2xx — trả lỗi ngay, kèm body để debug
        return res.status(r.status).json({
          error: r.body.substring(0, 300),
          log,
        });
      }

      return res.status(500).json({
        error: `Không kết nối được tới Viettel. Log: ${log.join(' | ')}`,
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── Fallback ─────────────────────────────────────────────────────────────
  return res.status(400).json({
    error: 'action không hợp lệ. Dùng: config, test, preview, create',
  });
}