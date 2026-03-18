import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase';
import { requireAuth, getRepresentanteId } from '../_lib/auth';
import { applyVendasFilters } from '../_lib/filters';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const user = requireAuth(req, res);
    if (!user) return;

    try {
        const repId = await getRepresentanteId(user);
        let q = supabase.from('vendas')
            .select('valor, cliente:cliente_id(nome, representante:representante_id(estado))');
        q = await applyVendasFilters(supabase, q, req.query as any, repId);
        const { data, error } = await q.limit(100000);
        if (error) return res.status(500).json({ error: error.message });

        const map: Record<string, { totalVendas: number; valorTotal: number; estado: string }> = {};
        for (const r of (data || [])) {
            const nome = (r.cliente as any)?.nome;
            if (!nome) continue;
            if (!map[nome]) map[nome] = {
                totalVendas: 0, valorTotal: 0,
                estado: (r.cliente as any)?.representante?.estado || 'Desconhecido'
            };
            map[nome].totalVendas += 1;
            map[nome].valorTotal += r.valor || 0;
        }

        res.json(
            Object.entries(map)
                .map(([nome, d]) => ({ nome, ...d }))
                .sort((a, b) => b.valorTotal - a.valorTotal)
                .slice(0, 5)
        );
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
}
