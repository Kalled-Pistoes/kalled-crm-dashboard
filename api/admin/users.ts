import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { supabase } from '../_lib/supabase';
import { requireAuth, requireAdmin } from '../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const user = requireAuth(req, res);
    if (!user) return;
    if (!requireAdmin(user, res)) return;

    if (req.method === 'GET') {
        const { data, error } = await supabase
            .from('crm_users')
            .select('id, username, role, representante, created_at')
            .order('created_at');
        if (error) return res.status(500).json({ error: error.message });
        return res.json(data);
    }

    if (req.method === 'POST') {
        const { username, password, role, representante } = req.body || {};
        if (!username || !password || !role)
            return res.status(400).json({ error: 'Campos obrigatórios: username, password, role' });

        const passwordHash = await bcrypt.hash(password, 10);
        const { data, error } = await supabase
            .from('crm_users')
            .insert({ username, password_hash: passwordHash, role, representante: representante || null })
            .select('id, username, role, representante, created_at')
            .single();

        if (error) {
            if (error.code === '23505') return res.status(409).json({ error: 'Usuário já existe' });
            return res.status(500).json({ error: error.message });
        }
        return res.status(201).json(data);
    }

    res.status(405).json({ error: 'Method not allowed' });
}
