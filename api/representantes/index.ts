import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase';
import { requireAuth, getRepresentanteId } from '../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const user = requireAuth(req, res);
    if (!user) return;

    try {
        const repId = await getRepresentanteId(user);
        let q = supabase.from('representantes').select('nome, estado, meta_mensal');
        if (repId) q = q.eq('id', repId);
        const { data, error } = await q.order('nome');
        if (error) return res.status(500).json({ error: error.message });

        res.json((data || []).map((r: any) => ({
            nome: r.nome,
            estado: r.estado || '',
            meta: r.meta_mensal || 0,
        })));
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
}
