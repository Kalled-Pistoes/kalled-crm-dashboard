import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from './_lib/supabase';
import { JWT_SECRET, requireAuth, requireAdmin, getRepresentanteId } from './_lib/auth';
import { applyDateFilter, applyVendasFilters, fetchAllPages, groupBySum, toYearMonth, toYear } from './_lib/filters';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Parse path from URL: /api/auth/login → ['auth', 'login']
    const rawPath = (req.url || '').split('?')[0].replace(/^\/api\//, '').replace(/^\/api$/, '');
    const pathParts = rawPath.split('/').filter(Boolean);
    const [s0, s1, s2] = pathParts;

    try {
        // ── auth/login ──────────────────────────────────────────────────────
        if (s0 === 'auth' && s1 === 'login') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
            const { username, password } = req.body || {};
            if (!username || !password)
                return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
            const { data: user, error } = await supabase
                .from('crm_users').select('*').eq('username', username).single();
            if (error || !user || !await bcrypt.compare(password, user.password_hash))
                return res.status(401).json({ error: 'Usuário ou senha incorretos' });
            const payload = { id: user.id, username: user.username, role: user.role, representante: user.representante };
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
            return res.json({ token, user: payload });
        }

        // ── auth/me ─────────────────────────────────────────────────────────
        if (s0 === 'auth' && s1 === 'me') {
            const user = requireAuth(req, res);
            if (!user) return;
            return res.json(user);
        }

        // ── admin/users ─────────────────────────────────────────────────────
        if (s0 === 'admin' && s1 === 'users' && !s2) {
            const user = requireAuth(req, res);
            if (!user) return;
            if (!requireAdmin(user, res)) return;
            if (req.method === 'GET') {
                const { data, error } = await supabase.from('crm_users')
                    .select('id, username, role, representante, created_at').order('created_at');
                if (error) return res.status(500).json({ error: error.message });
                return res.json(data);
            }
            if (req.method === 'POST') {
                const { username, password, role, representante } = req.body || {};
                if (!username || !password || !role)
                    return res.status(400).json({ error: 'Campos obrigatórios: username, password, role' });
                const passwordHash = await bcrypt.hash(password, 10);
                const { data, error } = await supabase.from('crm_users')
                    .insert({ username, password_hash: passwordHash, role, representante: representante || null })
                    .select('id, username, role, representante, created_at').single();
                if (error) {
                    if (error.code === '23505') return res.status(409).json({ error: 'Usuário já existe' });
                    return res.status(500).json({ error: error.message });
                }
                return res.status(201).json(data);
            }
            return res.status(405).json({ error: 'Method not allowed' });
        }

        // ── admin/users/:id ─────────────────────────────────────────────────
        if (s0 === 'admin' && s1 === 'users' && s2) {
            const user = requireAuth(req, res);
            if (!user) return;
            if (!requireAdmin(user, res)) return;
            const id = s2;
            if (req.method === 'PUT') {
                const { password, role, representante } = req.body || {};
                const updates: any = {};
                if (password) updates.password_hash = await bcrypt.hash(password, 10);
                if (role !== undefined) updates.role = role;
                if (representante !== undefined) updates.representante = representante || null;
                const { data, error } = await supabase.from('crm_users').update(updates).eq('id', id)
                    .select('id, username, role, representante, created_at').single();
                if (error) return res.status(error.code === 'PGRST116' ? 404 : 500).json({ error: error.message });
                return res.json(data);
            }
            if (req.method === 'DELETE') {
                if (id === user.id)
                    return res.status(400).json({ error: 'Não é possível excluir sua própria conta' });
                const { error } = await supabase.from('crm_users').delete().eq('id', id);
                if (error) return res.status(500).json({ error: error.message });
                return res.json({ success: true });
            }
            return res.status(405).json({ error: 'Method not allowed' });
        }

        // ── dashboard/stats ─────────────────────────────────────────────────
        if (s0 === 'dashboard' && s1 === 'stats') {
            const user = requireAuth(req, res);
            if (!user) return;
            const q = req.query as any;
            const repId = await getRepresentanteId(user);
            const currentYear = q.ano || String(new Date().getFullYear());
            const prevYear = String(parseInt(currentYear) - 1);
            const today = new Date();
            const isCurrentYear = currentYear === String(today.getFullYear());
            const hasMonthFilter = !!q.mes;

            let qCurr: any = supabase.from('vendas').select('valor, quantidade');
            qCurr = await applyVendasFilters(supabase, qCurr, q, repId);
            const vendasCurr = await fetchAllPages(qCurr);

            let qPrev: any = supabase.from('vendas').select('valor, quantidade');
            qPrev = await applyVendasFilters(supabase, qPrev, { ...q, ano: prevYear }, repId);
            if (!hasMonthFilter && isCurrentYear) {
                const maxMes = String(today.getMonth() + 1).padStart(2, '0');
                qPrev = qPrev.lte('data', `${prevYear}-${maxMes}-31`);
            }
            const vendasPrev = await fetchAllPages(qPrev);

            const sumValor = (rows: any[]) => rows.reduce((s: number, r: any) => s + (r.valor || 0), 0);
            const sumQtd = (rows: any[]) => rows.reduce((s: number, r: any) => s + (r.quantidade || 0), 0);

            let totalClientes: number, totalReps: number;
            if (repId) {
                const { count: cliCount } = await supabase.from('clientes')
                    .select('id', { count: 'exact', head: true }).eq('representante_id', repId);
                totalClientes = cliCount || 0;
                totalReps = 1;
            } else {
                const { count: cliCount } = await supabase.from('clientes').select('id', { count: 'exact', head: true });
                const { count: repCount } = await supabase.from('representantes').select('id', { count: 'exact', head: true });
                totalClientes = cliCount || 0;
                totalReps = repCount || 0;
            }
            const { count: totalProd } = await supabase.from('produtos').select('id', { count: 'exact', head: true });

            return res.json({
                totalVendas: vendasCurr.length,
                totalClientes,
                totalProdutos: totalProd || 0,
                totalRepresentantes: totalReps,
                valorTotalVendas: sumValor(vendasCurr),
                valorTotalVendasAnoAnterior: sumValor(vendasPrev),
                totalPecas: sumQtd(vendasCurr),
                totalPecasAnoAnterior: sumQtd(vendasPrev),
            });
        }

        // ── vendas ──────────────────────────────────────────────────────────
        if (s0 === 'vendas' && !s1) {
            const user = requireAuth(req, res);
            if (!user) return;
            const repId = await getRepresentanteId(user);
            let q: any = supabase.from('vendas')
                .select('data, valor, quantidade, cliente:cliente_id(nome), produto:produto_id(pn)')
                .order('data', { ascending: false });
            q = await applyVendasFilters(supabase, q, req.query as any, repId);
            const { data, error } = await q.limit(1000);
            if (error) return res.status(500).json({ error: error.message });
            return res.json((data || []).map((r: any) => ({
                data: r.data, cliente: r.cliente?.nome ?? '', codigo: r.produto?.pn ?? '',
                quantidade: r.quantidade || 0, valor: r.valor || 0,
            })));
        }

        if (s0 === 'vendas' && s1 === 'recent') {
            const user = requireAuth(req, res);
            if (!user) return;
            const repId = await getRepresentanteId(user);
            let q: any = supabase.from('vendas')
                .select('data, valor, quantidade, cliente:cliente_id(nome), produto:produto_id(pn)')
                .order('data', { ascending: false }).limit(50);
            if (repId) q = q.eq('representante_id', repId);
            const { data, error } = await q;
            if (error) return res.status(500).json({ error: error.message });
            return res.json((data || []).map((r: any) => ({
                data: r.data, cliente: r.cliente?.nome ?? '', codigo: r.produto?.pn ?? '',
                quantidade: r.quantidade || 0, valor: r.valor || 0,
            })));
        }

        if (s0 === 'vendas' && s1 === 'por-mes') {
            const user = requireAuth(req, res);
            if (!user) return;
            const repId = await getRepresentanteId(user);
            let q: any = supabase.from('vendas').select('data, valor');
            q = await applyVendasFilters(supabase, q, req.query as any, repId);
            const data = await fetchAllPages(q);
            const map = groupBySum(data, (r: any) => toYearMonth(r.data), (r: any) => r.valor || 0);
            return res.json(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([mes, total]) => ({ mes, total })));
        }

        if (s0 === 'vendas' && s1 === 'por-estado') {
            const user = requireAuth(req, res);
            if (!user) return;
            const repId = await getRepresentanteId(user);
            let q: any = supabase.from('vendas')
                .select('valor, cliente:cliente_id(uf, representante:representante_id(estado))');
            q = await applyVendasFilters(supabase, q, req.query as any, repId);
            const data = await fetchAllPages(q);
            const map: Record<string, number> = {};
            for (const r of data) {
                const estado = (r.cliente as any)?.uf || (r.cliente as any)?.representante?.estado || 'Outros';
                map[estado] = (map[estado] || 0) + (r.valor || 0);
            }
            return res.json(Object.entries(map).map(([estado, total]) => ({ estado, total }))
                .sort((a, b) => b.total - a.total).slice(0, 3));
        }

        if (s0 === 'vendas' && s1 === 'ranking') {
            const user = requireAuth(req, res);
            if (!user) return;
            const q = req.query as any;
            const repId = await getRepresentanteId(user);
            let qVR: any = supabase.from('vendas_representantes')
                .select('valor_pedido, representante:representante_id(id, nome, meta_mensal)');
            qVR = applyDateFilter(qVR, q, { defaultCurrentYear: true });
            if (repId) qVR = qVR.eq('representante_id', repId);
            const vendasRep = await fetchAllPages(qVR);
            const numMeses = q.mes ? 1 : new Date().getMonth() + 1;
            const map: Record<string, { nome: string; faturamento: number; metaMensal: number }> = {};
            for (const r of vendasRep) {
                const rep = r.representante as any;
                if (!rep?.nome) continue;
                if (!map[rep.nome]) map[rep.nome] = { nome: rep.nome, faturamento: 0, metaMensal: rep.meta_mensal || 0 };
                map[rep.nome].faturamento += r.valor_pedido || 0;
            }
            return res.json(Object.values(map).map(({ nome, faturamento, metaMensal }) => {
                const meta = metaMensal * numMeses;
                return { nome, faturamento, media: faturamento / numMeses, meta, percentMeta: meta > 0 ? (faturamento / meta) * 100 : 0 };
            }).sort((a, b) => b.faturamento - a.faturamento));
        }

        if (s0 === 'vendas' && s1 === 'top-skus') {
            const user = requireAuth(req, res);
            if (!user) return;
            const repId = await getRepresentanteId(user);
            let q: any = supabase.from('vendas').select('quantidade, produto:produto_id(pn)');
            q = await applyVendasFilters(supabase, q, req.query as any, repId);
            const data = await fetchAllPages(q);
            const map: Record<string, number> = {};
            for (const r of data) {
                const pn = (r.produto as any)?.pn;
                if (pn) map[pn] = (map[pn] || 0) + (r.quantidade || 0);
            }
            return res.json(Object.entries(map).map(([nome, quantidade]) => ({ nome, quantidade }))
                .sort((a, b) => b.quantidade - a.quantidade).slice(0, 5));
        }

        if (s0 === 'vendas' && s1 === 'comparativo-anual') {
            const user = requireAuth(req, res);
            if (!user) return;
            const repId = await getRepresentanteId(user);
            let q: any = supabase.from('vendas').select('data, valor');
            if (repId) q = q.eq('representante_id', repId);
            const data = await fetchAllPages(q);
            const map = groupBySum(data, (r: any) => toYear(r.data), (r: any) => r.valor || 0);
            return res.json(Object.entries(map).map(([ano, total]) => ({ ano, total }))
                .sort((a, b) => a.ano.localeCompare(b.ano)));
        }

        if (s0 === 'vendas' && s1 === 'por-representante') {
            const user = requireAuth(req, res);
            if (!user) return;
            const repId = await getRepresentanteId(user);
            let q: any = supabase.from('vendas_representantes')
                .select('valor_pedido, representante:representante_id(nome, meta_mensal)');
            q = applyDateFilter(q, req.query as any, { defaultCurrentYear: true });
            if (repId) q = q.eq('representante_id', repId);
            const data = await fetchAllPages(q);
            const map: Record<string, { totalVendas: number; meta?: number }> = {};
            for (const r of data) {
                const nome = (r.representante as any)?.nome;
                if (!nome) continue;
                if (!map[nome]) map[nome] = { totalVendas: 0, meta: (r.representante as any)?.meta_mensal };
                map[nome].totalVendas += r.valor_pedido || 0;
            }
            return res.json(Object.entries(map).map(([representante, d]) => ({ representante, ...d })));
        }

        // ── clientes ────────────────────────────────────────────────────────
        if (s0 === 'clientes' && !s1) {
            const user = requireAuth(req, res);
            if (!user) return;
            const repId = await getRepresentanteId(user);
            let qCli: any = supabase.from('clientes')
                .select('nome, status, grupo, desconto, pagamento, prazo, representante:representante_id(nome)');
            if (repId) qCli = qCli.eq('representante_id', repId);
            const { data: clientes, error: cliErr } = await qCli;
            if (cliErr) return res.status(500).json({ error: cliErr.message });
            let qVendas: any = supabase.from('vendas').select('data, cliente:cliente_id(nome)');
            if (repId) qVendas = qVendas.eq('representante_id', repId);
            const vendas = await fetchAllPages(qVendas);
            const ultimaCompraMap: Record<string, string> = {};
            for (const v of vendas) {
                const nome = (v.cliente as any)?.nome;
                if (nome && v.data && (!ultimaCompraMap[nome] || v.data > ultimaCompraMap[nome]))
                    ultimaCompraMap[nome] = v.data;
            }
            const today = new Date();
            return res.json((clientes || []).map((c: any) => {
                const ultimaCompra = ultimaCompraMap[c.nome];
                const diffMonths = ultimaCompra
                    ? (today.getTime() - new Date(`${ultimaCompra}T12:00:00Z`).getTime()) / (1000 * 60 * 60 * 24 * 30.44)
                    : Infinity;
                return {
                    Cliente: c.nome, 'Razão Social': c.nome, Representante: c.representante?.nome ?? '',
                    Status: diffMonths > 4 ? 'Inativo' : 'Ativo',
                    Desconto: c.desconto ?? '', Pagamento: c.pagamento ?? '',
                    Prazo: c.prazo ?? '', ultimaCompra: ultimaCompra || undefined,
                };
            }));
        }

        if (s0 === 'clientes' && s1 === 'top') {
            const user = requireAuth(req, res);
            if (!user) return;
            const repId = await getRepresentanteId(user);
            let q: any = supabase.from('vendas')
                .select('valor, cliente:cliente_id(nome, uf, representante:representante_id(estado))');
            q = await applyVendasFilters(supabase, q, req.query as any, repId);
            const data = await fetchAllPages(q);
            const map: Record<string, { totalVendas: number; valorTotal: number; estado: string }> = {};
            for (const r of data) {
                const nome = (r.cliente as any)?.nome;
                if (!nome) continue;
                if (!map[nome]) map[nome] = {
                    totalVendas: 0, valorTotal: 0,
                    estado: (r.cliente as any)?.uf || (r.cliente as any)?.representante?.estado || '',
                };
                map[nome].totalVendas += 1;
                map[nome].valorTotal += r.valor || 0;
            }
            return res.json(Object.entries(map).map(([nome, d]) => ({ nome, ...d }))
                .sort((a, b) => b.valorTotal - a.valorTotal).slice(0, 5));
        }

        if (s0 === 'clientes' && s1 && s2 === 'vendas-por-mes') {
            const user = requireAuth(req, res);
            if (!user) return;
            const nome = decodeURIComponent(s1);
            const { data: cli } = await supabase.from('clientes').select('id').ilike('nome', nome).single();
            if (!cli) return res.json([]);
            const data = await fetchAllPages(supabase.from('vendas').select('data, valor').eq('cliente_id', cli.id));
            const map = groupBySum(data, (r: any) => toYearMonth(r.data), (r: any) => r.valor || 0);
            return res.json(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([mes, total]) => ({ mes, total })));
        }

        if (s0 === 'clientes' && s1 && s2 === 'itens-nao-comprados') {
            const user = requireAuth(req, res);
            if (!user) return;
            const nome = decodeURIComponent(s1);
            const { data: cli } = await supabase.from('clientes').select('id').ilike('nome', nome).single();
            if (!cli) return res.json({ totalItens: 0, totalComprados: 0, naoComprados: [] });
            const vendas = await fetchAllPages(supabase.from('vendas').select('produto:produto_id(pn)').eq('cliente_id', cli.id));
            const skusComprados = new Set(vendas.map((v: any) => v.produto?.pn).filter(Boolean));
            const { data: produtos, error } = await supabase.from('produtos').select('pn, descricao, linhas, ref_metal_leve, ref_sulloy, ref_ks, ref_apex');
            if (error) return res.status(500).json({ error: error.message });
            const naoComprados = (produtos || []).filter(p => !skusComprados.has(p.pn)).map(p => {
                const refs: Record<string, string> = {};
                if (p.ref_metal_leve) refs['Metal Leve'] = p.ref_metal_leve;
                if (p.ref_sulloy)     refs['Sulloy']     = p.ref_sulloy;
                if (p.ref_ks)         refs['KS']         = p.ref_ks;
                if (p.ref_apex)       refs['Apex']       = p.ref_apex;
                return { pn: p.pn, descricao: p.descricao || '', linhas: p.linhas || [], refs };
            });
            return res.json({ totalItens: (produtos || []).length, totalComprados: skusComprados.size, naoComprados });
        }

        // ── representantes ──────────────────────────────────────────────────
        if (s0 === 'representantes' && !s1) {
            const user = requireAuth(req, res);
            if (!user) return;
            const repId = await getRepresentanteId(user);
            let q: any = supabase.from('representantes').select('nome, estado, meta_mensal');
            if (repId) q = q.eq('id', repId);
            const { data, error } = await q.order('nome');
            if (error) return res.status(500).json({ error: error.message });
            return res.json((data || []).map((r: any) => ({ nome: r.nome, estado: r.estado || '', meta: r.meta_mensal || 0 })));
        }

        if (s0 === 'representantes' && s1 && s2 === 'vendas-por-mes') {
            const user = requireAuth(req, res);
            if (!user) return;
            const nome = user.role === 'representante' && user.representante
                ? user.representante : decodeURIComponent(s1);
            const { data: rep } = await supabase.from('representantes').select('id').ilike('nome', nome).single();
            if (!rep) return res.json([]);
            const data = await fetchAllPages(
                supabase.from('vendas_representantes').select('data, valor_pedido').eq('representante_id', rep.id)
            );
            const map = groupBySum(data, (r: any) => toYearMonth(r.data), (r: any) => r.valor_pedido || 0);
            return res.json(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([mes, total]) => ({ mes, total })));
        }

        if (s0 === 'representantes' && s1 && s2 === 'visitas-por-mes') {
            const user = requireAuth(req, res);
            if (!user) return;
            const nome = user.role === 'representante' && user.representante
                ? user.representante : decodeURIComponent(s1);
            const { data: rep } = await supabase.from('representantes').select('id').ilike('nome', nome).single();
            if (!rep) return res.json([]);
            const { data, error } = await supabase.from('visitas_tecnicas').select('data, custo_visita')
                .eq('representante_id', rep.id).limit(10000);
            if (error) return res.status(500).json({ error: error.message });
            const map = groupBySum(data || [], (r: any) => toYearMonth(r.data), (r: any) => r.custo_visita || 0);
            return res.json(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([mes, custo]) => ({ mes, custo })));
        }

        if (s0 === 'representantes' && s1 && s2 === 'clientes') {
            const user = requireAuth(req, res);
            if (!user) return;
            const nome = user.role === 'representante' && user.representante
                ? user.representante : decodeURIComponent(s1);
            const { data: rep } = await supabase.from('representantes').select('id').ilike('nome', nome).single();
            if (!rep) return res.json([]);
            const { data: clientes } = await supabase.from('clientes').select('id, nome').eq('representante_id', rep.id);
            if (!clientes?.length) return res.json([]);
            const cliIds = clientes.map(c => c.id);
            const vendas = await fetchAllPages(
                supabase.from('vendas').select('data, cliente_id').in('cliente_id', cliIds)
            );
            const ultimaCompraMap: Record<string, string> = {};
            for (const v of vendas) {
                if (v.data && (!ultimaCompraMap[v.cliente_id] || v.data > ultimaCompraMap[v.cliente_id]))
                    ultimaCompraMap[v.cliente_id] = v.data;
            }
            const today = new Date();
            return res.json(clientes.map(c => {
                const ultimaCompra = ultimaCompraMap[c.id] || null;
                const status = ultimaCompra
                    ? ((today.getTime() - new Date(`${ultimaCompra}T12:00:00Z`).getTime()) / (1000 * 60 * 60 * 24 * 30.44) <= 4 ? 'Ativo' : 'Inativo')
                    : 'Inativo';
                return { nome: c.nome, ultimaCompra, status };
            }));
        }

        if (s0 === 'representantes' && s1 && s2 === 'comparativo-mes') {
            const user = requireAuth(req, res);
            if (!user) return;
            const nome = user.role === 'representante' && user.representante
                ? user.representante : decodeURIComponent(s1);
            const mes = String(req.query.mes || '').padStart(2, '0');
            const { data: rep } = await supabase.from('representantes').select('id, meta_mensal').ilike('nome', nome).single();
            if (!rep) return res.json([]);
            const meta = (rep as any).meta_mensal || 0;


            const vendasRep = await fetchAllPages(
                supabase.from('vendas_representantes')
                    .select('data, valor_pedido, cliente_nome')
                    .eq('representante_id', (rep as any).id)
            );

            const totaisMap: Record<string, number> = {};
            const clientesMap: Record<string, Map<string, number>> = {};
            for (const r of vendasRep) {
                if (mes && r.data.substring(5, 7) !== mes) continue;
                const ano = r.data.substring(0, 4);
                totaisMap[ano] = (totaisMap[ano] || 0) + ((r as any).valor_pedido || 0);
                const nomeCliente = ((r as any).cliente_nome || '').trim();
                if (nomeCliente) {
                    if (!clientesMap[ano]) clientesMap[ano] = new Map();
                    clientesMap[ano].set(nomeCliente, (clientesMap[ano].get(nomeCliente) || 0) + ((r as any).valor_pedido || 0));
                }
            }

            return res.json(Object.keys(totaisMap).sort().map(ano => ({
                ano,
                total: totaisMap[ano] || 0,
                meta,
                percentMeta: meta > 0 ? ((totaisMap[ano] || 0) / meta) * 100 : null,
                clientes: Array.from(clientesMap[ano]?.entries() || [])
                    .map(([nome, total]) => ({ nome, total }))
                    .sort((a, b) => b.total - a.total),
            })));
        }

        if (s0 === 'representantes' && s1 && s2 === 'visitas-por-cliente') {
            const user = requireAuth(req, res);
            if (!user) return;
            const nome = user.role === 'representante' && user.representante
                ? user.representante : decodeURIComponent(s1);
            const { data: rep } = await supabase.from('representantes').select('id').ilike('nome', nome).single();
            if (!rep) return res.json([]);
            const { data, error } = await supabase.from('visitas_tecnicas')
                .select('data, custo_visita, cliente:cliente_id(nome)')
                .eq('representante_id', (rep as any).id).limit(10000);
            if (error) return res.status(500).json({ error: error.message });
            const map: Record<string, { custo: number; ultimaVisita: string }> = {};
            for (const v of (data || [])) {
                const cli = (v.cliente as any)?.nome || '';
                if (!cli) continue;
                if (!map[cli]) map[cli] = { custo: 0, ultimaVisita: '' };
                map[cli].custo += v.custo_visita || 0;
                if (v.data && v.data > map[cli].ultimaVisita) map[cli].ultimaVisita = v.data;
            }
            return res.json(Object.entries(map)
                .map(([cliente, d]) => ({ cliente, custo: d.custo, mes: d.ultimaVisita ? d.ultimaVisita.substring(0, 7) : '' }))
                .sort((a, b) => b.custo - a.custo));
        }

        // ── visitas ─────────────────────────────────────────────────────────
        if (s0 === 'visitas' && !s1) {
            const user = requireAuth(req, res);
            if (!user) return;
            const repId = await getRepresentanteId(user);
            let q: any = supabase.from('visitas_tecnicas')
                .select('data, tipo_visita, custo_visita, representante:representante_id(nome), cliente:cliente_id(nome)');
            q = applyDateFilter(q, req.query as any);
            if (repId) q = q.eq('representante_id', repId);
            const { data, error } = await q.order('data', { ascending: false }).limit(10000);
            if (error) return res.status(500).json({ error: error.message });
            return res.json((data || []).map((r: any) => ({
                data: r.data, tipoVisita: r.tipo_visita || '',
                representante: r.representante?.nome ?? '', cliente: r.cliente?.nome ?? '',
                custo: r.custo_visita || 0,
            })));
        }

        return res.status(404).json({ error: 'Rota não encontrada' });
    } catch (e: any) {
        return res.status(500).json({ error: (e as Error).message });
    }
}
