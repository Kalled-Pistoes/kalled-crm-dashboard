import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase';
import { requireAuth, getRepresentanteId } from '../_lib/auth';
import { applyDateFilter, applyVendasFilters } from '../_lib/filters';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const user = requireAuth(req, res);
    if (!user) return;

    try {
        const q = req.query as any;
        const repId = await getRepresentanteId(user);
        const currentYear = (q.ano || String(new Date().getFullYear()));
        const prevYear = String(parseInt(currentYear) - 1);
        const today = new Date();
        const isCurrentYear = currentYear === String(today.getFullYear());
        const hasMonthFilter = !!q.mes;

        // Vendas do ano atual
        let qCurr: any = supabase.from('vendas').select('valor, quantidade');
        qCurr = await applyVendasFilters(supabase, qCurr, q, repId);
        const { data: vendasCurr } = await qCurr.limit(100000);

        // Vendas do ano anterior (YTD se for ano atual sem filtro de mês)
        let qPrev: any = supabase.from('vendas').select('valor, quantidade');
        const prevFilters = { ...q, ano: prevYear };
        qPrev = await applyVendasFilters(supabase, qPrev, prevFilters, repId);
        if (!hasMonthFilter && isCurrentYear) {
            // Limita ao mesmo mês do ano atual
            const maxMes = String(today.getMonth() + 1).padStart(2, '0');
            qPrev = qPrev.lte('data', `${prevYear}-${maxMes}-31`);
        }
        const { data: vendasPrev } = await qPrev.limit(100000);

        const sumValor = (rows: any[]) => (rows || []).reduce((s: number, r: any) => s + (r.valor || 0), 0);
        const sumQtd = (rows: any[]) => (rows || []).reduce((s: number, r: any) => s + (r.quantidade || 0), 0);

        // Contagens
        let totalClientes: number;
        let totalReps: number;

        if (repId) {
            const { count: cliCount } = await supabase.from('clientes').select('id', { count: 'exact', head: true }).eq('representante_id', repId);
            totalClientes = cliCount || 0;
            totalReps = 1;
        } else {
            const { count: cliCount } = await supabase.from('clientes').select('id', { count: 'exact', head: true });
            const { count: repCount } = await supabase.from('representantes').select('id', { count: 'exact', head: true });
            totalClientes = cliCount || 0;
            totalReps = repCount || 0;
        }

        const { count: totalProd } = await supabase.from('produtos').select('id', { count: 'exact', head: true });

        res.json({
            totalVendas: (vendasCurr || []).length,
            totalClientes,
            totalProdutos: totalProd || 0,
            totalRepresentantes: totalReps,
            valorTotalVendas: sumValor(vendasCurr || []),
            valorTotalVendasAnoAnterior: sumValor(vendasPrev || []),
            totalPecas: sumQtd(vendasCurr || []),
            totalPecasAnoAnterior: sumQtd(vendasPrev || []),
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
}
