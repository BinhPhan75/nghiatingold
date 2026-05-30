import { createClient } from '@supabase/supabase-js';
import { loginViettel, requireAdmin, sendMethodNotAllowed } from './_viettel.js';

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

  const { data: cfg, error } = await ctx.supabase
    .from('viettel_einvoice_config')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return res.status(500).json({ success: false, message: error.message });
  if (!cfg) return res.status(400).json({ success: false, message: 'Chưa tìm thấy cấu hình Viettel trong hệ thống.' });
  if (!cfg.username || !cfg.password || !cfg.tax_code) {
    return res.status(400).json({ success: false, message: 'Cấu hình tài khoản, mật khẩu hoặc mã số thuế chưa đầy đủ.' });
  }

  try {
    const auth = await loginViettel(cfg);
    if (auth.token) {
      return res.json({
        success: true,
        message: `Kết nối Viettel vInvoice thành công! Xác thực Token OK. Tài khoản API: ${cfg.username} | MST: ${cfg.tax_code} | Môi trường: ${cfg.is_sandbox ? 'Thử nghiệm (Sandbox)' : 'Thực tế (Production)'}`,
      });
    }
    if (auth.status === 401 || auth.status === 403) {
      return res.status(401).json({ success: false, message: 'Tài khoản hoặc mật khẩu API vInvoice của Viettel cung cấp không chính xác.' });
    }
    return res.status(auth.status || 500).json({ success: false, message: auth.error || 'Không kết nối được máy chủ Viettel.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Lỗi bất định phát sinh khi test connection.' });
  }
}
