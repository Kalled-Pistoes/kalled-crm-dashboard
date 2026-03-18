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

        const { data, error } = await supabase.from('visitas_tecnicas')
            .select('data, custo_visita, cliente:cliente_id(nome)')
            .eq('representante_id', rep.id)
            .limit(10000);
        if (error) return res.status(500).json({ error: error.message });

        const map: Record<string, { custo: number; ultimaVisita: string }> = {};
        for (const v of (data || [])) {
            const cli = (v.cliente as any)?.nome || '';
            if (!cli) continue;
            if (!map[cli]) map[cli] = { custo: 0, ultimaVisita: '' };
            map[cli].custo += v.custo_visita || 0;
            if (v.data && v.data > map[cli].ultimaVisita) map[cli].ultimaVisita = v.data;
        }

        res.json(
            Object.entries(map)
                .map(([cliente, d]) => ({ cliente, custo: d.custo, mes: d.ultimaVisita ? d.ultimaVisita.substring(0, 7) : '' }))
                .sort((a, b) => b.custo - a.custo)
        );
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
}
