import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase';
import { requireAuth } from '../../_lib/auth';
import { groupBySum, toYearMonth } from '../../_lib/filters';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const user = requireAuth(req, res);
    if (!user) return;

    try {
        // Reps só podem ver seus próprios dados
        const nome = user.role === 'representante' && user.representante
            ? user.representante
            : decodeURIComponent(String(req.query.nome));

        const { data: rep } = await supabase.from('representantes').select('id').ilike('nome', nome).single();
        if (!rep) return res.json([]);

        const { data, error } = await supabase.from('vendas_representantes')
            .select('data, valor_pedido')
            .eq('representante_id', rep.id)
            .limit(100000);
        if (error) return res.status(500).json({ error: error.message });

        const map = groupBySum(data || [], r => toYearMonth(r.data), r => r.valor_pedido || 0);
        res.json(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([mes, total]) => ({ mes, total })));
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
}
