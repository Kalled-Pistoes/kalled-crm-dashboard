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
        const mes = String(req.query.mes || '').padStart(2, '0');

        const { data: rep } = await supabase.from('representantes')
            .select('id, meta_mensal')
            .ilike('nome', nome)
            .single();
        if (!rep) return res.json([]);

        const meta = rep.meta_mensal || 0;

        // Totais por ano (vendas_representantes)
        let qVR = supabase.from('vendas_representantes')
            .select('data, valor_pedido')
            .eq('representante_id', rep.id)
            .limit(100000);
        const { data: vendasRep } = await qVR;

        const totaisMap: Record<string, number> = {};
        for (const r of (vendasRep || [])) {
            if (mes && r.data.substring(5, 7) !== mes) continue;
            const ano = r.data.substring(0, 4);
            totaisMap[ano] = (totaisMap[ano] || 0) + (r.valor_pedido || 0);
        }

        // Clientes do representante
        const { data: clientes } = await supabase.from('clientes')
            .select('id, nome')
            .eq('representante_id', rep.id);
        const cliIds = (clientes || []).map(c => c.id);
        const cliNomeMap: Record<string, string> = {};
        for (const c of (clientes || [])) cliNomeMap[c.id] = c.nome;

        // Vendas dos clientes do rep por ano
        let qVendas: any = supabase.from('vendas')
            .select('data, valor, cliente_id')
            .in('cliente_id', cliIds.length > 0 ? cliIds : ['00000000-0000-0000-0000-000000000000'])
            .limit(100000);
        const { data: vendas } = await qVendas;

        const clientesMap: Record<string, Map<string, number>> = {};
        for (const v of (vendas || [])) {
            if (mes && v.data.substring(5, 7) !== mes) continue;
            const ano = v.data.substring(0, 4);
            const nomeCliente = cliNomeMap[v.cliente_id] || '';
            if (!nomeCliente) continue;
            if (!clientesMap[ano]) clientesMap[ano] = new Map();
            clientesMap[ano].set(nomeCliente, (clientesMap[ano].get(nomeCliente) || 0) + (v.valor || 0));
        }

        const anos = new Set([...Object.keys(totaisMap), ...Object.keys(clientesMap)]);
        res.json(Array.from(anos).sort().map(ano => ({
            ano,
            total: totaisMap[ano] || 0,
            meta,
            percentMeta: meta > 0 ? ((totaisMap[ano] || 0) / meta) * 100 : null,
            clientes: Array.from(clientesMap[ano]?.entries() || [])
                .map(([nome, total]) => ({ nome, total }))
                .sort((a, b) => b.total - a.total),
        })));
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
}
