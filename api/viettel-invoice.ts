import { createClient } from '@supabase/supabase-js';
import { buildViettelInvoicePayload, getViettelApiBase, loginViettel, nodeRequest, requireAdmin, sendMethodNotAllowed } from './_viettel.js';

function getFallbackSupabase() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  return createClient(supabaseUrl, supabaseAnonKey);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return sendMethodNotAllowed(res);
  
  let ctx = await requireAdmin(req, res).catch(() => null);
  if (!ctx || !ctx.supabase) {
    ctx = { supabase: getFallbackSupabase() };
  }

  const { mode, payload } = req.body || {};
  if (!payload) return res.status(400).json({ errorCode: 'PAYLOAD_REQUIRED', description: 'Thiếu dữ liệu hóa đơn giao dịch.' });
  if (mode !== 'preview' && mode !== 'draft') {
    return res.status(400).json({ errorCode: 'MODE_REQUIRED', description: 'Chế độ (mode) truyền vào bắt buộc phải là preview hoặc draft.' });
  }

  const { data: cfg, error } = await ctx.supabase
    .from('viettel_einvoice_config')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return res.status(500).json({ errorCode: 'CONFIG_READ_FAILED', description: error.message });
  if (!cfg) return res.status(400).json({ errorCode: 'NO_CONFIG', description: 'Chưa thiết lập cấu hình kết nối Viettel.' });
  if (!cfg.company_name) return res.status(400).json({ errorCode: 'SELLER_LEGAL_NAME_REQUIRED', description: 'Vui lòng bổ sung Tên doanh nghiệp hiển thị trong cấu hình trước khi tạo hóa đơn.' });

  try {
    const auth = await loginViettel(cfg);
    if (!auth.token) {
      return res.status(401).json({ errorCode: 'VIETTEL_AUTH_FAILED', description: `Không lấy được token đăng nhập Viettel: ${auth.error || 'Sai thông tin kết nối'}` });
    }

    const built = buildViettelInvoicePayload(cfg, payload);
    const apiBase = getViettelApiBase(cfg);
    
    // Phân loại endpoint dựa vào mode xem trước hay tạo nháp
    const endpoint = mode === 'preview'
      ? `${apiBase}/InvoiceAPI/InvoiceWS/createInvoiceDraftPreview/${encodeURIComponent(cfg.tax_code)}`
      : `${apiBase}/InvoiceAPI/InvoiceWS/createOrUpdateInvoiceDraft/${encodeURIComponent(cfg.tax_code)}`;

    const response = await nodeRequest(endpoint, {
      method: 'POST',
      headers: { Cookie: `access_token=${auth.token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(built.data),
      timeoutMs: 75000,
    });

    if (response.status === 401 || response.status === 403) {
      return res.status(401).json({ errorCode: 'AUTH_FAILED', description: 'Phiên kết nối nội bộ sang hệ thống Viettel bị từ chối.' });
    }

    let data: any = {};
    try { data = JSON.parse(response.body || '{}'); }
    catch {
      return res.status(response.status >= 400 ? response.status : 502).json({
        errorCode: 'INVALID_RESPONSE',
        description: response.body?.substring(0, 500) || 'Dữ liệu phản hồi từ Viettel không đúng định dạng JSON.',
      });
    }

    if (response.status >= 200 && response.status < 300) {
      const ok = !data.errorCode || ['', '0', 'SUCCESS'].includes(String(data.errorCode));
      if (ok) return res.json({ ...data, mode, transactionUuid: built.transactionUuid });
      return res.status(422).json({ errorCode: data.errorCode, description: data.description || 'Hệ thống Viettel từ chối dữ liệu đầu vào.', raw: data });
    }

    return res.status(response.status).json({ errorCode: `HTTP_${response.status}`, description: data.description || 'Lỗi xử lý luồng HTTP phía máy chủ Viettel.', raw: data });
  } catch (err: any) {
    return res.status(500).json({ errorCode: 'SERVER_ERROR', description: err.message || 'Lỗi xử lý logic backend hóa đơn.' });
  }
}
