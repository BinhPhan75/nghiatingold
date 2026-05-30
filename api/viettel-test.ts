import { loginViettel, requireAdmin, sendMethodNotAllowed } from './_viettel.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return sendMethodNotAllowed(res);
  const ctx = await requireAdmin(req, res);
  if (!ctx) return;

  const { data: cfg, error } = await ctx.supabase
    .from('viettel_einvoice_config')
    .select('*')
    .eq('id', '00000000-0000-0000-0000-000000000001')
    .maybeSingle();

  if (error) return res.status(500).json({ success: false, message: error.message });
  if (!cfg || !cfg.username || !cfg.password) {
    return res.status(400).json({ success: false, message: 'Dữ liệu cấu hình trống hoặc chưa được thiết lập.' });
  }

  try {
    const auth = await loginViettel(cfg);
    if (auth.token) {
      return res.json({
        success: true,
        message: `Kết nối Viettel vInvoice thành công!\nTài khoản: ${cfg.username}\nMã số thuế: ${cfg.tax_code}\nMôi trường: ${cfg.is_sandbox ? 'Thử nghiệm (Sandbox)' : 'Chính thức (Production)'}`,
      });
    }
    return res.status(401).json({ success: false, message: auth.error || 'Xác thực tài khoản với Viettel không thành công.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: `Lỗi đường truyền mạng hệ thống: ${err.message}` });
  }
}
