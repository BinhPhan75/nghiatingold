import { getViettelOrigin, loginViettel, requireAdmin, sendMethodNotAllowed } from './_viettel';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return sendMethodNotAllowed(res);
  const ctx = await requireAdmin(req, res);
  if (!ctx) return;

  const { data: cfg, error } = await ctx.supabase
    .from('viettel_einvoice_config')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return res.status(500).json({ success: false, message: error.message });
  if (!cfg) return res.status(400).json({ success: false, message: 'Chua co cau hinh Viettel.' });
  if (!cfg.username || !cfg.password || !cfg.tax_code) {
    return res.status(400).json({ success: false, message: 'Cau hinh chua day du tai khoan, mat khau hoac ma so thue.' });
  }

  try {
    const auth = await loginViettel(cfg);
    if (auth.token) {
      return res.json({
        success: true,
        message: `Ket noi Viettel vInvoice thanh cong. Xac thuc Token OK. Tai khoan: ${cfg.username} | MST: ${cfg.tax_code} | Moi truong: Production`,
      });
    }
    if (auth.status === 401 || auth.status === 403) {
      return res.status(401).json({ success: false, message: `Sai tai khoan hoac mat khau (HTTP ${auth.status}).` });
    }
    return res.status(502).json({ success: false, message: `Dang nhap khong tra ve access_token (HTTP ${auth.status}). ${auth.message}`.trim() });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: `Khong ket noi duoc ${getViettelOrigin(cfg)}: ${err.message}` });
  }
}
