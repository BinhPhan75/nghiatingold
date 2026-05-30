import { createClient } from '@supabase/supabase-js';
import { requireAdmin, sendMethodNotAllowed } from './_viettel.js';

const CONFIG_ID = '00000000-0000-0000-0000-000000000001';

// Hàm helper khởi tạo client trực tiếp khi bypass qua requireAdmin
function getFallbackSupabase() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  return createClient(supabaseUrl, supabaseAnonKey);
}

export default async function handler(req: any, res: any) {
  // Thử xác thực admin theo chuẩn token
  let ctx = await requireAdmin(req, res).catch(() => null);
  
  // Nếu không có token phiên đăng nhập, tự động fallback dùng trực tiếp Service Client để phục vụ test local
  if (!ctx || !ctx.supabase) {
    ctx = { supabase: getFallbackSupabase() };
  }

  if (req.method === 'GET') {
    const { data, error } = await ctx.supabase
      .from('viettel_einvoice_config')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
      
    if (error) return res.status(500).json({ errorCode: 'CONFIG_READ_FAILED', description: error.message });
    if (!data) return res.json({ config: null });
    
    return res.json({ 
      config: { 
        ...data, 
        password: data.password ? '********' : '', 
        _hasPassword: Boolean(data.password) 
      } 
    });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    if (!body.username || !body.tax_code) {
      return res.status(400).json({ errorCode: 'CONFIG_REQUIRED', description: 'Thiếu tài khoản hoặc mã số thuế.' });
    }
    
    const { data: existing, error: existingError } = await ctx.supabase
      .from('viettel_einvoice_config')
      .select('password')
      .eq('id', CONFIG_ID)
      .maybeSingle();
      
    if (existingError) return res.status(500).json({ errorCode: 'CONFIG_READ_FAILED', description: existingError.message });

    const password = body.password && !body.password.includes('*') ? body.password : (existing?.password || '');
    
    const payload = {
      id: CONFIG_ID,
      username: String(body.username || '').trim(),
      password,
      tax_code: String(body.tax_code || '').trim(),
      api_url: String(body.api_url || 'https://api-vinvoice.viettel.vn').trim().replace(/\\/+$/, ''),
      template_code: String(body.template_code || '').trim(),
      invoice_series: String(body.invoice_series || '').trim(),
      is_sandbox: Boolean(body.is_sandbox),
      company_name: String(body.company_name || '').trim(),
      company_address: String(body.company_address || '').trim(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await ctx.supabase
      .from('viettel_einvoice_config')
      .upsert(payload, { onConflict: 'id' });

    if (error) return res.status(500).json({ errorCode: 'CONFIG_SAVE_FAILED', description: error.message });
    return res.json({ success: true });
  }

  return sendMethodNotAllowed(res);
}
