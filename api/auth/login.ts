import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../_lib/supabase';
import { JWT_SECRET } from '../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { username, password } = req.body || {};
    if (!username || !password)
        return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });

    const { data: user, error } = await supabase
        .from('crm_users')
        .select('*')
        .eq('username', username)
        .single();

    if (error || !user || !await bcrypt.compare(password, user.password_hash))
        return res.status(401).json({ error: 'Usuário ou senha incorretos' });

    const payload = {
        id: user.id,
        username: user.username,
        role: user.role,
        representante: user.representante,
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
    return res.json({ token, user: payload });
}
