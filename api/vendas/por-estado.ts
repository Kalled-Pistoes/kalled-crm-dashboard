import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase';
import { requireAuth, getRepresentanteId } from '../_lib/auth';
import { applyVendasFilters } from '../_lib/filters';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const user = requireAuth(req, res);
    if (!user) return;

    try {
        const repId = await getRepresentanteId(user);
        // Busca vendas com o estado do representante via cliente
        let q = supabase.from('vendas')
            .select('valor, cliente:cliente_id(representante:representante_id(estado))');
        q = await applyVendasFilters(supabase, q, req.query as any, repId);
        const { data, error } = await q.limit(100000);
        if (error) return res.status(500).json({ error: error.message });

        const map: Record<string, number> = {};
        for (const r of (data || [])) {
            const estado = (r.cliente as any)?.representante?.estado || 'Desconhecido';
            map[estado] = (map[estado] || 0) + (r.valor || 0);
        }

        res.json(
            Object.entries(map)
                .map(([estado, total]) => ({ estado, total }))
                .sort((a, b) => b.total - a.total)
                .slice(0, 3)
        );
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
}
