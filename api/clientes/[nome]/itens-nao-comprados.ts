import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../_lib/supabase';
import { requireAuth } from '../../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const user = requireAuth(req, res);
    if (!user) return;

    try {
        const nome = decodeURIComponent(String(req.query.nome));

        // Busca ID do cliente
        const { data: cli } = await supabase.from('clientes').select('id').ilike('nome', nome).single();
        if (!cli) return res.json({ totalItens: 0, totalComprados: 0, naoComprados: [] });

        // SKUs que o cliente já comprou
        const { data: vendas } = await supabase.from('vendas')
            .select('produto:produto_id(pn)')
            .eq('cliente_id', cli.id)
            .limit(100000);

        const skusComprados = new Set((vendas || []).map((v: any) => v.produto?.pn).filter(Boolean));

        // Todos os produtos
        const { data: produtos, error } = await supabase.from('produtos')
            .select('pn, descricao, linhas');
        if (error) return res.status(500).json({ error: error.message });

        const naoComprados = (produtos || [])
            .filter(p => !skusComprados.has(p.pn))
            .map(p => {
                const refs: Record<string, string> = {};
                for (const linha of (p.linhas || [])) refs[linha] = linha;
                return { pn: p.pn, descricao: p.descricao || '', linhas: p.linhas || [], refs };
            });

        res.json({
            totalItens: (produtos || []).length,
            totalComprados: skusComprados.size,
            naoComprados,
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
}
