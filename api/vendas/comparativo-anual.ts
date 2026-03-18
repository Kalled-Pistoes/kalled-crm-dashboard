import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase';
import { requireAuth, getRepresentanteId } from '../_lib/auth';
import { groupBySum, toYear } from '../_lib/filters';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const user = requireAuth(req, res);
    if (!user) return;

    try {
        const repId = await getRepresentanteId(user);
        let q = supabase.from('vendas').select('data, valor');
        if (repId) q = q.eq('representante_id', repId);
        const { data, error } = await q.limit(100000);
        if (error) return res.status(500).json({ error: error.message });

        const map = groupBySum(data || [], r => toYear(r.data), r => r.valor || 0);
        res.json(
            Object.entries(map)
                .map(([ano, total]) => ({ ano, total }))
                .sort((a, b) => a.ano.localeCompare(b.ano))
        );
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
}
