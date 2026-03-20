import jwt from 'jsonwebtoken';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './supabase';

const JWT_SECRET = process.env.JWT_SECRET || 'crm-kalled-local-2025';

export interface AuthUser {
    id: string;
    username: string;
    role: string;
    representante: string | null;
}

export function verifyToken(req: VercelRequest): AuthUser | null {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return null;
    try {
        return jwt.verify(auth.slice(7), JWT_SECRET) as AuthUser;
    } catch {
        return null;
    }
}

export function requireAuth(req: VercelRequest, res: VercelResponse): AuthUser | null {
    const user = verifyToken(req);
    if (!user) {
        res.status(401).json({ error: 'Token de acesso necessário' });
        return null;
    }
    return user;
}

export function requireAdmin(user: AuthUser, res: VercelResponse): boolean {
    if (user.role !== 'admin') {
        res.status(403).json({ error: 'Acesso restrito ao administrador' });
        return false;
    }
    return true;
}

// Retorna o UUID do representante no Supabase, ou undefined se admin
export async function getRepresentanteId(user: AuthUser): Promise<string | undefined> {
    if (user.role !== 'representante' || !user.representante) return undefined;
    const { data } = await supabase
        .from('representantes')
        .select('id')
        .eq('nome', user.representante)
        .single();
    return data?.id;
}

export { JWT_SECRET };
