import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase';
import { requireAuth, getRepresentanteId } from '../_lib/auth';
import { applyDateFilter } from '../_lib/filters';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const user = requireAuth(req, res);
    if (!user) return;

    try {
        const repId = await getRepresentanteId(user);
        let q = supabase.from('visitas_tecnicas')
            .select('data, tipo_visita, custo_visita, representante:representante_id(nome), cliente:cliente_id(nome)');
        q = applyDateFilter(q, req.query as any);
        if (repId) q = q.eq('representante_id', repId);
        const { data, error } = await q.order('data', { ascending: false }).limit(10000);
        if (error) return res.status(500).json({ error: error.message });

        res.json((data || []).map((r: any) => ({
            data: r.data,
            tipoVisita: r.tipo_visita || '',
            representante: r.representante?.nome ?? '',
            cliente: r.cliente?.nome ?? '',
            custo: r.custo_visita || 0,
        })));
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
}
