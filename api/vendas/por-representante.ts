import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase';
import { requireAuth, getRepresentanteId } from '../_lib/auth';
import { applyDateFilter } from '../_lib/filters';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const user = requireAuth(req, res);
    if (!user) return;

    try {
        const repId = await getRepresentanteId(user);
        let q = supabase.from('vendas_representantes')
            .select('valor_pedido, representante:representante_id(nome, meta_mensal)');
        q = applyDateFilter(q, req.query as any, { defaultCurrentYear: true });
        if (repId) q = q.eq('representante_id', repId);
        const { data, error } = await q.limit(100000);
        if (error) return res.status(500).json({ error: error.message });

        const map: Record<string, { totalVendas: number; meta?: number }> = {};
        for (const r of (data || [])) {
            const nome = (r.representante as any)?.nome;
            if (!nome) continue;
            if (!map[nome]) map[nome] = { totalVendas: 0, meta: (r.representante as any)?.meta_mensal };
            map[nome].totalVendas += r.valor_pedido || 0;
        }

        res.json(Object.entries(map).map(([representante, d]) => ({ representante, ...d })));
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
}
