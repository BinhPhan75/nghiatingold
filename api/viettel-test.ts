import { createClient } from '@supabase/supabase-js';
import https from 'https';
import { URL } from 'url';

const CONFIG_ID = '00000000-0000-0000-0000-000000000001';

function nodeRequest(urlStr: string, options: any = {}): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const reqOpts = {
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: 15000,
    };
    const req = https.request(url, reqOpts, (resResponse) => {
      let data = '';
      resResponse.on('data', (chunk) => data += chunk);
      resResponse.on('end', () => resolve({ status: resResponse.statusCode || 200, body: data }));
    });
    req.on('error', (err) => reject(err));
    if (options.body) req.write(options.body);
    req.end();
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  const supabase = createClient(url, anonKey);

  try {
    const { data: cfg, error } = await supabase
      .from('viettel_einvoice_config')
      .select('*')
      .eq('id', CONFIG_ID)
      .maybeSingle();

    if (error || !cfg) {
      return res.status(400).json({ success: false, message: 'Chưa cấu hình tài khoản hệ thống.' });
    }

    const baseUrl = (cfg.api_url || 'https://api-vinvoice.viettel.vn').replace(/\/+$/, '');
    const loginRes = await nodeRequest(`${baseUrl}/InvoiceAPI/InvoiceWS/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ username: cfg.username, password: cfg.password }),
    });

    const data = JSON.parse(loginRes.body || '{}');
    if (loginRes.status === 200 && data.token) {
      return res.json({
        success: true,
        message: `Đã kết nối mượt mà đến Viettel vInvoice! Hệ thống ghi nhận MST doanh nghiệp: ${cfg.tax_code}`,
      });
    }

    return res.status(401).json({ success: false, message: data.description || 'Tài khoản hoặc mật khẩu kết nối Viettel không khớp.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
