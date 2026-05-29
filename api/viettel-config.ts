import { requireAdmin, sendMethodNotAllowed } from './_viettel';

const CONFIG_ID = '00000000-0000-0000-0000-000000000001';

export default async function handler(req: any, res: any) {
  const ctx = await requireAdmin(req, res);
  if (!ctx) return;

  if (req.method === 'GET') {
    const { data, error } = await ctx.supabase
      .from('viettel_einvoice_config')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return res.status(500).json({ errorCode: 'CONFIG_READ_FAILED', description: error.message });
    if (!data) return res.json({ config: null });
    return res.json({ config: { ...data, password: data.password ? '********' : '', _hasPassword: Boolean(data.password) } });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    if (!body.username || !body.tax_code) {
      return res.status(400).json({ errorCode: 'CONFIG_REQUIRED', description: 'Thieu tai khoan hoac ma so thue.' });
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
      api_url: String(body.api_url || 'https://api-vinvoice.viettel.vn').trim().replace(/\/+$/, ''),
      template_code: String(body.template_code || '').trim(),
      invoice_series: String(body.invoice_series || '').trim(),
      is_sandbox: body.is_sandbox === true,
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
