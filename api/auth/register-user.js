import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body || {};
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://wjjvobqwnnlzxsovjovx.supabase.co';
    const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY;

    if (!serviceKey) {
      return res.status(200).json({ success: false, fallback: true });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const cleanEmail = (email || '').trim().toLowerCase();
    const { data, error } = await admin.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ success: true, user: data.user });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
