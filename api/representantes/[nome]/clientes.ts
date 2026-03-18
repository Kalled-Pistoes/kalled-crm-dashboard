import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase';
import { requireAuth } from '../../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const user = requireAuth(req, res);
    if (!user) return;

    try {
        const nome = user.role === 'representante' && user.representante
            ? user.representante
            : decodeURIComponent(String(req.query.nome));

        const { data: rep } = await supabase.from('representantes').select('id').ilike('nome', nome).single();
        if (!rep) return res.json([]);

        // Clientes deste representante
        const { data: clientes } = await supabase.from('clientes')
            .select('id, nome')
            .eq('representante_id', rep.id);

        if (!clientes?.length) return res.json([]);

        // Última compra por cliente
        const cliIds = clientes.map(c => c.id);
        const { data: vendas } = await supabase.from('vendas')
            .select('data, cliente_id')
            .in('cliente_id', cliIds)
            .limit(100000);

        const ultimaCompraMap: Record<string, string> = {};
        for (const v of (vendas || [])) {
            if (v.data && (!ultimaCompraMap[v.cliente_id] || v.data > ultimaCompraMap[v.cliente_id])) {
                ultimaCompraMap[v.cliente_id] = v.data;
            }
        }

        const today = new Date();
        res.json(clientes.map(c => {
            const ultimaCompra = ultimaCompraMap[c.id] || null;
            let status = 'Inativo';
            if (ultimaCompra) {
                const diffMonths = (today.getTime() - new Date(`${ultimaCompra}T12:00:00Z`).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
                status = diffMonths <= 4 ? 'Ativo' : 'Inativo';
            }
            return { nome: c.nome, ultimaCompra, status };
        }));
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
}
