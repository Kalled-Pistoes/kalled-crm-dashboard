import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase';
import { requireAuth, getRepresentanteId } from '../_lib/auth';
import { applyDateFilter } from '../_lib/filters';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const user = requireAuth(req, res);
    if (!user) return;

    try {
        const q = req.query as any;
        const repId = await getRepresentanteId(user);

        // Busca vendas_representantes com nome do rep e meta
        let qVR: any = supabase.from('vendas_representantes')
            .select('valor_pedido, representante:representante_id(id, nome, meta_mensal)');
        qVR = applyDateFilter(qVR, q, { defaultCurrentYear: true });
        if (repId) qVR = qVR.eq('representante_id', repId);
        const { data: vendasRep, error } = await qVR.limit(100000);
        if (error) return res.status(500).json({ error: error.message });

        const numMeses = q.mes ? 1 : new Date().getMonth() + 1;

        // Agrupa por representante
        const map: Record<string, { nome: string; faturamento: number; metaMensal: number }> = {};
        for (const r of (vendasRep || [])) {
            const rep = (r.representante as any);
            if (!rep?.nome) continue;
            if (!map[rep.nome]) map[rep.nome] = { nome: rep.nome, faturamento: 0, metaMensal: rep.meta_mensal || 0 };
            map[rep.nome].faturamento += r.valor_pedido || 0;
        }

        const ranking = Object.values(map).map(({ nome, faturamento, metaMensal }) => {
            const meta = metaMensal * numMeses;
            return {
                nome,
                faturamento,
                media: faturamento / numMeses,
                meta,
                percentMeta: meta > 0 ? (faturamento / meta) * 100 : 0,
            };
        }).sort((a, b) => b.faturamento - a.faturamento);

        res.json(ranking);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
}
