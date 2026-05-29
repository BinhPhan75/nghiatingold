import type { VercelRequest, VercelResponse } from '@vercel/node';
import https from 'https';
import http from 'http';
import { Pool } from 'pg';

// ── DB Pool ─────────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
});

// ── Helpers ──────────────────────────────────────────────────────────────────
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
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode || 0, body: data }));
      }
    );
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS viettel_einvoice_config (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username      TEXT NOT NULL DEFAULT '',
      password      TEXT NOT NULL DEFAULT '',
      tax_code      TEXT NOT NULL DEFAULT '',
      api_url       TEXT NOT NULL DEFAULT 'https://api-vinvoice.viettel.vn',
      template_code TEXT NOT NULL DEFAULT '',
      invoice_series TEXT NOT NULL DEFAULT '',
      is_sandbox    BOOLEAN NOT NULL DEFAULT TRUE,
      company_name  TEXT NOT NULL DEFAULT '',
      company_address TEXT NOT NULL DEFAULT '',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getConfig() {
  await ensureTable();
  const r = await pool.query('SELECT * FROM viettel_einvoice_config ORDER BY updated_at DESC LIMIT 1');
  return r.rows[0] || null;
}

async function getToken(cfg: any): Promise<string> {
  const origin = (cfg.api_url || 'https://api-vinvoice.viettel.vn').replace(/\/+$/, '');
  const r = await nodeRequest(`${origin}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ username: cfg.username, password: cfg.password }),
    timeoutMs: 10000,
  });
  if (r.status !== 200) throw new Error(`Đăng nhập Viettel thất bại (HTTP ${r.status})`);
  const d = JSON.parse(r.body || '{}');
  const token = d.access_token || d.token || '';
  if (!token) throw new Error('Không nhận được token từ Viettel');
  return token;
}

function numToWords(amount: number): string {
  if (amount === 0) return 'Không đồng';
  const units = ['', 'nghìn', 'triệu', 'tỷ'];
  const digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  const r3 = (n: number): string => {
    const h = Math.floor(n / 100), t = Math.floor((n % 100) / 10), o = n % 10;
    let r = '';
    if (h > 0) r += digits[h] + ' trăm ';
    if (t > 1) { r += digits[t] + ' mươi '; if (o > 0) r += (o === 5 ? 'lăm' : digits[o]) + ' '; }
    else if (t === 1) { r += 'mười '; if (o > 0) r += (o === 5 ? 'lăm' : digits[o]) + ' '; }
    else if (o > 0 && h > 0) r += 'lẻ ' + digits[o] + ' ';
    else if (o > 0) r += digits[o] + ' ';
    return r.trim();
  };
  let n = Math.round(amount);
  const parts: string[] = [];
  let ui = 0;
  while (n > 0) {
    const c = n % 1000;
    if (c > 0) parts.unshift(r3(c) + (units[ui] ? ' ' + units[ui] : ''));
    n = Math.floor(n / 1000);
    ui++;
  }
  const rs = parts.join(' ').trim();
  return rs.charAt(0).toUpperCase() + rs.slice(1) + ' đồng';
}

function buildPayload(cfg: any, invoiceData: any) {
  const uuid = (() => {
    try { return (crypto as any).randomUUID(); }
    catch { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16); }); }
  })();

  const {
    buyerName = '', buyerIdNo = '', buyerAddress = '',
    itemName = '', itemCode = 'HH', unitName = 'Cái',
    unitPrice = 0, quantity = 1, taxPercent = 0,
    paymentMethod = 'TM/CK',
  } = invoiceData;

  const subtotal = Math.round(unitPrice * quantity);
  const taxAmount = Math.round(subtotal * taxPercent / 100);
  const total = subtotal + taxAmount;

  return {
    uuid,
    payload: {
      generalInvoiceInfo: {
        invoiceType: '2',
        templateCode: cfg.template_code || '',
        invoiceSeries: cfg.invoice_series || '',
        invoiceIssuedDate: Date.now(),
        currencyCode: 'VND',
        adjustmentType: '1',
        paymentStatus: true,
        cusGetInvoiceRight: false,
        transactionUuid: uuid,
        supplierTaxCode: cfg.tax_code,
      },
      buyerInfo: {
        buyerName,
        buyerIdNo,
        buyerIdType: buyerIdNo ? '1' : undefined,
        buyerAddressLine: buyerAddress,
        buyerNotGetInvoice: buyerIdNo ? 0 : 1,
      },
      sellerInfo: { sellerTaxCode: cfg.tax_code },
      payments: [{ paymentMethodName: paymentMethod }],
      itemInfo: [{
        lineNumber: 1,
        itemCode,
        itemName,
        unitName,
        unitPrice,
        quantity,
        itemTotalAmountWithoutTax: subtotal,
        taxPercentage: taxPercent,
        taxAmount,
        itemTotalAmountWithTax: total,
        discount: 0,
        itemDiscount: 0,
        selection: 1,
      }],
      summarizeInfo: {
        sumOfTotalLineAmountWithoutTax: subtotal,
        totalAmountWithoutTax: subtotal,
        totalTaxAmount: taxAmount,
        totalAmountWithTax: total,
        totalAmountWithTaxInWords: numToWords(total),
        discountAmount: 0,
      },
      taxBreakdowns: [{ taxPercentage: taxPercent, taxableAmount: subtotal, taxAmount }],
    },
  };
}

// ── Main Handler ─────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = (req.query.action as string) || '';

  // GET /api/viettel?action=config
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

  // POST /api/viettel?action=config
  if (req.method === 'POST' && action === 'config') {
    const { username, password, tax_code, api_url, template_code, invoice_series, is_sandbox, company_name, company_address } = req.body || {};
    if (!username || !tax_code) return res.status(400).json({ error: 'Thiếu username hoặc mã số thuế' });
    try {
      await ensureTable();
      const existing = await pool.query('SELECT password FROM viettel_einvoice_config ORDER BY updated_at DESC LIMIT 1');
      const finalPwd = (password && !password.startsWith('•')) ? password : (existing.rows[0]?.password || '');
      const fixedId = '00000000-0000-0000-0000-000000000001';
      await pool.query(`
        INSERT INTO viettel_einvoice_config (id,username,password,tax_code,api_url,template_code,invoice_series,is_sandbox,company_name,company_address,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
        ON CONFLICT (id) DO UPDATE SET
          username=EXCLUDED.username, password=EXCLUDED.password, tax_code=EXCLUDED.tax_code,
          api_url=EXCLUDED.api_url, template_code=EXCLUDED.template_code,
          invoice_series=EXCLUDED.invoice_series, is_sandbox=EXCLUDED.is_sandbox,
          company_name=EXCLUDED.company_name, company_address=EXCLUDED.company_address,
          updated_at=NOW()
      `, [fixedId, username.trim(), finalPwd, tax_code.trim(),
          (api_url || 'https://api-vinvoice.viettel.vn').trim().replace(/\/+$/, ''),
          (template_code || '').trim(), (invoice_series || '').trim(),
          is_sandbox !== false, (company_name || '').trim(), (company_address || '').trim()]);
      return res.json({ success: true });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  // POST /api/viettel?action=test
  if (req.method === 'POST' && action === 'test') {
    try {
      const cfg = await getConfig();
      if (!cfg?.username) return res.json({ success: false, message: 'Chưa có cấu hình Viettel' });
      const token = await getToken(cfg);
      return res.json({
        success: true,
        message: `Kết nối thành công! Tài khoản: ${cfg.username} | MST: ${cfg.tax_code} | ${cfg.is_sandbox ? 'Sandbox' : 'Production'}`,
        hasToken: Boolean(token),
      });
    } catch (e: any) {
      return res.json({ success: false, message: e.message });
    }
  }

  // POST /api/viettel?action=preview  — Xem trước PDF (không lưu)
  if (req.method === 'POST' && action === 'preview') {
    try {
      const cfg = await getConfig();
      if (!cfg?.username) return res.status(400).json({ error: 'Chưa có cấu hình Viettel' });
      const token = await getToken(cfg);
      const origin = cfg.api_url.replace(/\/+$/, '');
      const { uuid, payload } = buildPayload(cfg, req.body || {});
      const authHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cookie': `access_token=${token}`,
      };

      const r = await nodeRequest(
        `${origin}/InvoiceAPI/InvoiceUtilsWS/createInvoiceDraftPreview/${cfg.tax_code}`,
        { method: 'POST', headers: authHeaders, body: JSON.stringify(payload), timeoutMs: 30000 }
      );

      if (r.status >= 200 && r.status < 300) {
        // Server trả về base64 PDF
        try {
          const d = JSON.parse(r.body);
          if (d.fileToBytes || d.pdfData || d.data) {
            const base64 = d.fileToBytes || d.pdfData || d.data;
            return res.json({ success: true, pdfBase64: base64, uuid });
          }
          return res.json({ success: true, raw: d, uuid });
        } catch {
          // Body là binary/base64 thẳng
          return res.json({ success: true, pdfBase64: Buffer.from(r.body).toString('base64'), uuid });
        }
      }
      return res.status(r.status).json({ error: `HTTP ${r.status}`, body: r.body.substring(0, 300) });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  // POST /api/viettel?action=create  — Tạo hóa đơn nháp
  if (req.method === 'POST' && action === 'create') {
    try {
      const cfg = await getConfig();
      if (!cfg?.username) return res.status(400).json({ error: 'Chưa có cấu hình Viettel' });
      const token = await getToken(cfg);
      const origin = cfg.api_url.replace(/\/+$/, '');
      const { uuid, payload } = buildPayload(cfg, req.body || {});
      const authHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cookie': `access_token=${token}`,
      };

      const endpoints = [
        `${origin}/InvoiceAPI/InvoiceWS/createOrUpdateInvoiceDraft/${cfg.tax_code}`,
        `${origin}/InvoiceAPI/InvoiceWS/createInvoiceDraft/${cfg.tax_code}`,
      ];

      const log: string[] = [];
      for (const ep of endpoints) {
        const r = await nodeRequest(ep, { method: 'POST', headers: authHeaders, body: JSON.stringify(payload), timeoutMs: 75000 });
        const short = ep.replace(origin, '');
        log.push(`POST ${short} → ${r.status}`);
        if (r.status === 404 || r.status === 405) continue;
        if (r.status === 401 || r.status === 403) return res.status(401).json({ error: 'Xác thực thất bại', log });
        if (r.status >= 200 && r.status < 300) {
          const d = JSON.parse(r.body || '{}');
          const ok = !d.errorCode || ['', '0', 'SUCCESS'].includes(String(d.errorCode));
          if (ok) return res.json({ success: true, invoiceNo: d.result?.invoiceNo, transactionUuid: uuid, result: d.result, log });
          return res.status(422).json({ error: d.description || 'Viettel từ chối', errorCode: d.errorCode, log });
        }
        return res.status(r.status).json({ error: r.body.substring(0, 300), log });
      }
      return res.status(500).json({ error: `Không kết nối được. Log: ${log.join(' | ')}` });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(400).json({ error: 'action không hợp lệ. Dùng: config, test, preview, create' });
}
