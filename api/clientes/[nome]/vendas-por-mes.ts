import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase';
import { requireAuth } from '../../_lib/auth';
import { groupBySum, toYearMonth } from '../../_lib/filters';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const user = requireAuth(req, res);
    if (!user) return;

    try {
        const nome = decodeURIComponent(String(req.query.nome));

        // Busca ID do cliente
        const { data: cli } = await supabase.from('clientes').select('id').ilike('nome', nome).single();
        if (!cli) return res.json([]);

        const { data, error } = await supabase.from('vendas')
            .select('data, valor')
            .eq('cliente_id', cli.id)
            .limit(100000);
        if (error) return res.status(500).json({ error: error.message });

        const map = groupBySum(data || [], r => toYearMonth(r.data), r => r.valor || 0);
        res.json(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([mes, total]) => ({ mes, total })));
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
}
