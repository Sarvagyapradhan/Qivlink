import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, userId } = req.body || {};
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://wjjvobqwnnlzxsovjovx.supabase.co';
    const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_SERVICE_KEY;

    if (!serviceKey) {
      return res.status(200).json({ success: false, message: 'Service key not configured on server' });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    let targetId = userId;
    if (!targetId && email) {
      const { data } = await admin.auth.admin.listUsers();
      const found = data?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (found) targetId = found.id;
    }

    if (targetId) {
      await admin.auth.admin.updateUserById(targetId, { email_confirm: true });
      return res.status(200).json({ success: true, confirmed: true });
    }

    return res.status(200).json({ success: false, message: 'User not found' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
