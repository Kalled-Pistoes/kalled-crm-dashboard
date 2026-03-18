import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase';
import { requireAuth, getRepresentanteId } from '../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const user = requireAuth(req, res);
    if (!user) return;

    try {
        const repId = await getRepresentanteId(user);

        // Busca clientes
        let qCli: any = supabase.from('clientes')
            .select('nome, status, grupo, desconto, pagamento, prazo, representante:representante_id(nome)');
        if (repId) qCli = qCli.eq('representante_id', repId);
        const { data: clientes, error: cliErr } = await qCli;
        if (cliErr) return res.status(500).json({ error: cliErr.message });

        // Busca última compra por cliente (via vendas)
        let qVendas: any = supabase.from('vendas')
            .select('data, cliente:cliente_id(nome)');
        if (repId) qVendas = qVendas.eq('representante_id', repId);
        const { data: vendas } = await qVendas.limit(100000);

        // Mapa de última compra
        const ultimaCompraMap: Record<string, string> = {};
        for (const v of (vendas || [])) {
            const nome = (v.cliente as any)?.nome;
            if (nome && v.data && (!ultimaCompraMap[nome] || v.data > ultimaCompraMap[nome])) {
                ultimaCompraMap[nome] = v.data;
            }
        }

        const today = new Date();
        res.json((clientes || []).map((c: any) => {
            const ultimaCompra = ultimaCompraMap[c.nome];
            let status = c.status || '';
            if (ultimaCompra) {
                const diffMonths = (today.getTime() - new Date(`${ultimaCompra}T12:00:00Z`).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
                status = diffMonths > 4 ? 'Inativo' : 'Ativo';
            } else {
                status = 'Inativo';
            }
            return {
                Cliente: c.nome,
                'Razão Social': c.nome,
                Representante: c.representante?.nome ?? '',
                Status: status,
                Desconto: c.desconto ?? '',
                Pagamento: c.pagamento ?? '',
                Prazo: c.prazo ?? '',
                ultimaCompra: ultimaCompra || undefined,
            };
        }));
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
}
