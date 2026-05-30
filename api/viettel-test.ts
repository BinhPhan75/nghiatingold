import { createClient } from '@supabase/supabase-js';
import https from 'https';
import { URL } from 'url';

const CONFIG_ID = '00000000-0000-0000-0000-000000000001';

function getBearerToken(req: any): string {
  const auth = req.headers.authorization || req.headers.Authorization || '';
  return auth.toString().replace(/^Bearer\s+/i, '').trim();
}

function getSupabase(req: any) {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  const token = getBearerToken(req);
  if (token) {
    return createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return createClient(url, anonKey);
}

function nodeRequest(urlStr: string, options: any = {}): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: options.method || 'POST',
        headers: options.headers || {},
        timeout: 15000,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode || 0, body: data }));
      }
    );
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  const supabase = getSupabase(req);

  try {
    // Lấy config từ Supabase (có Bearer token → bypass RLS)
    const { data: cfg, error } = await supabase
      .from('viettel_einvoice_config')
      .select('*')
      .eq('id', CONFIG_ID)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ success: false, message: `Lỗi đọc cấu hình: ${error.message}` });
    }
    if (!cfg || !cfg.username || !cfg.password) {
      return res.status(400).json({ success: false, message: 'Chưa có cấu hình Viettel. Vui lòng lưu cấu hình trước.' });
    }

    const baseUrl = (cfg.api_url || 'https://api-vinvoice.viettel.vn').replace(/\/+$/, '');

    // Gọi /auth/login — endpoint đã xác nhận hoạt động
    const loginRes = await nodeRequest(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ username: cfg.username, password: cfg.password }),
    });

    // safeJsonParse: tránh crash nếu server trả HTML
    let data: any = {};
    try { data = JSON.parse(loginRes.body || '{}'); } catch { data = {}; }

    const token = data.access_token || data.token || data.accessToken || '';

    if (loginRes.status === 200 && token) {
      return res.json({
        success: true,
        message: `Kết nối Viettel vInvoice thành công! MST: ${cfg.tax_code}`,
      });
    }

    const errMsg = data.description || data.message || data.error || `HTTP ${loginRes.status}`;
    return res.status(401).json({
      success: false,
      message: `Sai tài khoản hoặc mật khẩu Viettel: ${errMsg}`,
    });

  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
