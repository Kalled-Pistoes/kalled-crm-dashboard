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
            .select('data, valor, quantidade, cliente:cliente_id(nome), produto:produto_id(pn)')
            .order('data', { ascending: false });

        q = await applyVendasFilters(supabase, q, req.query as any, repId);
        const { data, error } = await q.limit(5000);
        if (error) return res.status(500).json({ error: error.message });

        res.json((data || []).map((r: any) => ({
            data: r.data,
            cliente: r.cliente?.nome ?? '',
            codigo: r.produto?.pn ?? '',
            quantidade: r.quantidade || 0,
            valor: r.valor || 0,
        })));
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
}
