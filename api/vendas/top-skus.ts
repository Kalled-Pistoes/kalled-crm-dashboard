import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase';
import { requireAuth, getRepresentanteId } from '../_lib/auth';
import { applyVendasFilters } from '../_lib/filters';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const user = requireAuth(req, res);
    if (!user) return;

    try {
        const repId = await getRepresentanteId(user);
        let q = supabase.from('vendas').select('quantidade, produto:produto_id(pn)');
        q = await applyVendasFilters(supabase, q, req.query as any, repId);
        const { data, error } = await q.limit(100000);
        if (error) return res.status(500).json({ error: error.message });

        const map: Record<string, number> = {};
        for (const r of (data || [])) {
            const pn = (r.produto as any)?.pn;
            if (pn) map[pn] = (map[pn] || 0) + (r.quantidade || 0);
        }

        res.json(
            Object.entries(map)
                .map(([nome, quantidade]) => ({ nome, quantidade }))
                .sort((a, b) => b.quantidade - a.quantidade)
                .slice(0, 5)
        );
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
}
