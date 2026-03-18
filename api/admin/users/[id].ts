import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { supabase } from '../../_lib/supabase';
import { requireAuth, requireAdmin } from '../../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const user = requireAuth(req, res);
    if (!user) return;
    if (!requireAdmin(user, res)) return;

    const id = String(req.query.id);

    if (req.method === 'PUT') {
        const { password, role, representante } = req.body || {};
        const updates: any = {};
        if (password) updates.password_hash = await bcrypt.hash(password, 10);
        if (role !== undefined) updates.role = role;
        if (representante !== undefined) updates.representante = representante || null;

        const { data, error } = await supabase
            .from('crm_users')
            .update(updates)
            .eq('id', id)
            .select('id, username, role, representante, created_at')
            .single();

        if (error) return res.status(error.code === 'PGRST116' ? 404 : 500).json({ error: error.message });
        return res.json(data);
    }

    if (req.method === 'DELETE') {
        if (id === user.id)
            return res.status(400).json({ error: 'Não é possível excluir sua própria conta' });

        const { error } = await supabase.from('crm_users').delete().eq('id', id);
        if (error) return res.status(500).json({ error: error.message });
        return res.json({ success: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
}
