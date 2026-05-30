import { buildViettelInvoicePayload, getViettelApiBase, loginViettel, nodeRequest, requireAdmin, sendMethodNotAllowed } from './_viettel.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return sendMethodNotAllowed(res);
  const ctx = await requireAdmin(req, res);
  if (!ctx) return;

  const { mode, payload } = req.body || {};
  if (!payload) return res.status(400).json({ errorCode: 'PAYLOAD_REQUIRED', description: 'Thiếu dữ liệu chi tiết đơn hàng.' });
  if (mode !== 'preview' && mode !== 'draft') {
    return res.status(400).json({ errorCode: 'MODE_REQUIRED', description: 'Chế độ (mode) bắt buộc là preview hoặc draft.' });
  }

  const { data: cfg, error } = await ctx.supabase
    .from('viettel_einvoice_config')
    .select('*')
    .eq('id', '00000000-0000-0000-0000-000000000001')
    .maybeSingle();

  if (error) return res.status(500).json({ errorCode: 'CONFIG_READ_FAILED', description: error.message });
  if (!cfg) return res.status(400).json({ errorCode: 'NO_CONFIG', description: 'Vui lòng hoàn thành Cấu hình Viettel trước khi lập hóa đơn.' });

  // Thực hiện login lấy cookie session của Viettel
  const auth = await loginViettel(cfg);
  if (!auth.token) {
    return res.status(401).json({ errorCode: 'VIETTEL_AUTH_FAILED', description: auth.error || 'Đăng nhập cổng hóa đơn Viettel thất bại.' });
  }

  const built = buildViettelInvoicePayload(cfg, payload);
  const apiBase = getViettelApiBase(cfg);

  // Chọn endpoint chuẩn tùy vào nhu cầu xem trước hay lưu nháp
  const endpoint = mode === 'preview'
    ? `${apiBase}/InvoiceAPI/InvoiceWS/createInvoiceDraftPreview/${encodeURIComponent(cfg.tax_code)}`
    : `${apiBase}/InvoiceAPI/InvoiceWS/createOrUpdateInvoiceDraft/${encodeURIComponent(cfg.tax_code)}`;

  try {
    const response = await nodeRequest(endpoint, {
      method: 'POST',
      headers: { Cookie: `access_token=${auth.token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(built.data),
      timeoutMs: 75000,
    });

    let data: any = {};
    try { data = JSON.parse(response.body || '{}'); } catch {
      return res.status(502).json({ errorCode: 'INVALID_JSON', description: 'Phản hồi từ Viettel không đúng cấu trúc chuẩn.' });
    }

    if (response.status >= 200 && response.status < 300) {
      const ok = !data.errorCode || ['', '0', 'SUCCESS'].includes(String(data.errorCode));
      if (ok) return res.json({ ...data, mode, transactionUuid: built.transactionUuid });
      return res.status(422).json({ errorCode: data.errorCode, description: data.description || 'Dữ liệu bị Viettel từ chối.', raw: data });
    }
    return res.status(response.status).json({ errorCode: `HTTP_${response.status}`, description: `Lỗi kết nối Viettel (${response.status})` });
  } catch (err: any) {
    return res.status(500).json({ errorCode: 'SERVER_ERROR', description: err.message });
  }
}
