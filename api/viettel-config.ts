import { createClient } from '@supabase/supabase-js';

const CONFIG_ID = '00000000-0000-0000-0000-000000000001';

// Hàm bóc tách Token từ Header theo chuẩn phần mềm chính
function getBearerToken(req: any): string {
  const auth = req.headers.authorization || req.headers.Authorization || '';
  return auth.toString().replace(/^Bearer\s+/i, '').trim();
}

// Hàm khởi tạo Supabase Client
function getSupabase(req: any) {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  const token = getBearerToken(req);
  
  // Nếu có token user, tạo client theo quyền user, ngược lại tạo client ẩn danh phục vụ local/fallback
  if (token) {
    return createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return createClient(url, anonKey);
}

export default async function handler(req: any, res: any) {
  const supabase = getSupabase(req);

  // Cấu hình CORS để Frontend gọi không bị chặn
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ── XỬ LÝ LỆNH GET ────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('viettel_einvoice_config')
        .select('*')
        .eq('id', CONFIG_ID)
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
    } catch (err: any) {
      return res.status(500).json({ errorCode: 'SERVER_ERROR', description: err.message });
    }
  }

  // ── XỬ LÝ LỆNH POST ───────────────────────────────────────────────────────
  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      if (!body.username || !body.tax_code) {
        return res.status(400).json({ errorCode: 'CONFIG_REQUIRED', description: 'Thiếu thông tin tài khoản hoặc mã số thuế.' });
      }

      const { data: existing } = await supabase
        .from('viettel_einvoice_config')
        .select('password')
        .eq('id', CONFIG_ID)
        .maybeSingle();

      const password = body.password && !body.password.includes('*') ? body.password : (existing?.password || '');

      const payload = {
        id: CONFIG_ID,
        username: String(body.username || '').trim(),
        password,
        tax_code: String(body.tax_code || '').trim(),
        api_url: String(body.api_url || 'https://api-vinvoice.viettel.vn').trim().replace(/\/+$/, ''),
        template_code: String(body.template_code || '').trim(),
        invoice_series: String(body.invoice_series || '').trim(),
        is_sandbox: Boolean(body.is_sandbox),
        company_name: String(body.company_name || '').trim(),
        company_address: String(body.company_address || '').trim(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('viettel_einvoice_config').upsert(payload, { onConflict: 'id' });

      if (error) return res.status(500).json({ errorCode: 'CONFIG_SAVE_FAILED', description: error.message });
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ errorCode: 'SERVER_ERROR', description: err.message });
    }
  }

  return res.status(405).json({ errorCode: 'METHOD_NOT_ALLOWED' });
}
