import { buildViettelInvoicePayload, getViettelApiBase, loginViettel, nodeRequest, requireAdmin, sendMethodNotAllowed } from './_viettel.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return sendMethodNotAllowed(res);
  const ctx = await requireAdmin(req, res);
  if (!ctx) return;

  const { mode, payload } = req.body || {};
  if (!payload) return res.status(400).json({ errorCode: 'PAYLOAD_REQUIRED', description: 'Thieu du lieu hoa don.' });
  if (mode !== 'preview' && mode !== 'draft') {
    return res.status(400).json({ errorCode: 'MODE_REQUIRED', description: 'mode phai la preview hoac draft.' });
  }

  const { data: cfg, error } = await ctx.supabase
    .from('viettel_einvoice_config')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return res.status(500).json({ errorCode: 'CONFIG_READ_FAILED', description: error.message });
  if (!cfg) return res.status(400).json({ errorCode: 'NO_CONFIG', description: 'Chua co cau hinh Viettel.' });
  if (!cfg.company_name) return res.status(400).json({ errorCode: 'SELLER_LEGAL_NAME_REQUIRED', description: 'Vui long nhap Ten doanh nghiep trong Cau hinh hoa don dien tu.' });

  const auth = await loginViettel(cfg);
  if (!auth.token) {
    if (auth.status === 401 || auth.status === 403) return res.status(401).json({ errorCode: 'AUTH_FAILED', description: 'Dang nhap Viettel that bai. Vui long kiem tra username/password.' });
    return res.status(502).json({ errorCode: 'TOKEN_FAILED', description: `Dang nhap Viettel khong tra ve access_token (HTTP ${auth.status}). ${auth.message}`.trim() });
  }

  const built = buildViettelInvoicePayload(cfg, payload);
  const apiBase = getViettelApiBase(cfg);
  const endpoint = mode === 'preview'
    ? `${apiBase}/InvoiceAPI/InvoiceUtilsWS/createInvoiceDraftPreview/${encodeURIComponent(cfg.tax_code)}`
    : `${apiBase}/InvoiceAPI/InvoiceWS/createOrUpdateInvoiceDraft/${encodeURIComponent(cfg.tax_code)}`;

  const response = await nodeRequest(endpoint, {
    method: 'POST',
    headers: { Cookie: `access_token=${auth.token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(built.data),
    timeoutMs: 75000,
  });
  if (response.status === 401 || response.status === 403) {
    return res.status(401).json({ errorCode: 'AUTH_FAILED', description: 'Xac thuc Viettel that bai.' });
  }

  let data: any = {};
  try { data = JSON.parse(response.body || '{}'); }
  catch {
    return res.status(response.status >= 400 ? response.status : 502).json({
      errorCode: 'INVALID_RESPONSE',
      description: response.body?.substring(0, 500) || 'Viettel tra ve du lieu khong phai JSON.',
    });
  }

  if (response.status >= 200 && response.status < 300) {
    const ok = !data.errorCode || ['', '0', 'SUCCESS'].includes(String(data.errorCode));
    if (ok) return res.json({ ...data, mode, transactionUuid: built.transactionUuid });
    return res.status(422).json({ errorCode: data.errorCode, description: data.description || 'Viettel tu choi du lieu hoa don.', raw: data });
  }

  return res.status(response.status).json({
    errorCode: data.errorCode || `HTTP_${response.status}`,
    description: data.description || data.message || response.body?.substring(0, 500),
    raw: data,
  });
}
