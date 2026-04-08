import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import XLSX from 'xlsx';
import JSZip from 'jszip';
import { supabase } from './_lib/supabase';
import { JWT_SECRET, requireAuth, requireAdmin, getRepresentanteId } from './_lib/auth';
import { applyDateFilter, applyVendasFilters, fetchAllPages, groupBySum, toYearMonth, toYear } from './_lib/filters';

export const config = {
    api: { bodyParser: { sizeLimit: '20mb' } },
    maxDuration: 60,
};

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

        // ── sync ────────────────────────────────────────────────────────────
        if (s0 === 'sync') {
            if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
            const user = requireAuth(req, res);
            if (!user) return;
            if (!requireAdmin(user, res)) return;

            const { vendas: vendasB64, catalogo: catalogoB64 } = req.body || {};
            if (!vendasB64 && !catalogoB64) return res.status(400).json({ error: 'Envie ao menos um arquivo Excel (vendas ou catálogo)' });

            // ── helpers ──────────────────────────────────────────────────
            const parseCurrency = (v: any): number => {
                if (typeof v === 'number') return v;
                if (!v) return 0;
                const n = parseFloat(String(v).replace('R$', '').trim().replace(/\./g, '').replace(',', '.'));
                return isNaN(n) ? 0 : n;
            };
            const parseDate = (v: any): string => {
                if (!v) return '';
                if (typeof v === 'number') return new Date(Math.round((v - 25569) * 86400 * 1000)).toISOString().split('T')[0];
                const s = String(v).trim();
                const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
                if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
                const d = new Date(s); return isNaN(d.getTime()) ? s : d.toISOString().split('T')[0];
            };
            const getVal = (row: any, ...keys: string[]): any => {
                for (const k of keys) {
                    if (row[k] !== undefined) return row[k];
                    const lk = k.toLowerCase();
                    for (const rk in row) if (rk.toLowerCase() === lk) return row[rk];
                }
            };
            const getSheet = (wb: any, name: string): any[] => {
                const s = wb.Sheets[name]; return s ? XLSX.utils.sheet_to_json(s) : [];
            };
            const upsertBatch = async (table: string, rows: any[], col: string) => {
                for (let i = 0; i < rows.length; i += 500) {
                    const { error } = await supabase.from(table).upsert(rows.slice(i, i+500), { onConflict: col });
                    if (error) throw new Error(`[${table}] ${error.message}`);
                }
                return rows.length;
            };
            const insertBatch = async (table: string, rows: any[]) => {
                for (let i = 0; i < rows.length; i += 500) {
                    const { error } = await supabase.from(table).insert(rows.slice(i, i+500));
                    if (error) throw new Error(`[${table}] ${error.message}`);
                }
                return rows.length;
            };

            // ── parse Excel ──────────────────────────────────────────────
            // Problema: xlsx tem ZIP com "data descriptor" (compressedSize=0 no header local)
            // E o EOCD está corrompido/ausente. Solução: varrer headers locais manualmente,
            // localizar o data descriptor real via verificação matemática e patchear o buffer.
            const readXlsx = async (b64: string): Promise<any> => {
                const raw = Buffer.from(b64, 'base64');

                // Tentativa 1: leitura direta
                try { return XLSX.read(new Uint8Array(raw), { type: 'array' }); } catch {}

                // Tentativa 2: patchear headers locais com data descriptors reais
                const fixBuf = Buffer.from(raw);
                let pos = 0;
                while (pos + 30 <= fixBuf.length) {
                    if (fixBuf.readUInt32LE(pos) !== 0x04034B50) { pos++; continue; }
                    const fnLen = fixBuf.readUInt16LE(pos + 26);
                    const exLen = fixBuf.readUInt16LE(pos + 28);
                    const dataStart = pos + 30 + fnLen + exLen;
                    const localCompSz = fixBuf.readUInt32LE(pos + 18);
                    if (localCompSz === 0) {
                        // Busca data descriptor PK\x07\x08; verifica: (i - dataStart) == compSz no descriptor
                        let fixed = false;
                        for (let i = dataStart + 4; i + 16 <= fixBuf.length; i++) {
                            if (fixBuf.readUInt32LE(i) === 0x08074B50) {
                                const ddCompSz   = fixBuf.readUInt32LE(i + 8);
                                const ddUncompSz = fixBuf.readUInt32LE(i + 12);
                                if (i - dataStart === ddCompSz) {
                                    fixBuf.writeUInt32LE(ddCompSz,   pos + 18);
                                    fixBuf.writeUInt32LE(ddUncompSz, pos + 22);
                                    pos = i + 16; fixed = true; break;
                                }
                            }
                        }
                        if (!fixed) { pos = dataStart; }
                    } else {
                        pos = dataStart + localCompSz;
                        if (pos + 4 <= fixBuf.length && fixBuf.readUInt32LE(pos) === 0x08074B50) pos += 16;
                    }
                }
                try { return XLSX.read(new Uint8Array(fixBuf), { type: 'array' }); } catch {}

                // Tentativa 3: JSZip re-zip (funciona se EOCD estiver presente)
                let errFinal = 'todas as tentativas falharam';
                try {
                    const jz = await JSZip.loadAsync(raw);
                    const clean = new JSZip();
                    await Promise.all(Object.keys(jz.files).map(async name => {
                        const f = jz.files[name];
                        if (f.dir) { clean.folder(name); }
                        else { clean.file(name, await f.async('uint8array'), { compression: 'DEFLATE' }); }
                    }));
                    return XLSX.read(await clean.generateAsync({ type: 'uint8array' }), { type: 'array' });
                } catch (e: any) { errFinal = e.message; }

                throw new Error(`Não foi possível ler o arquivo Excel (${raw.length} bytes): ${errFinal}. Tente abrir no Excel e fazer "Salvar Como" para gerar uma cópia limpa.`);
            };
            // ── preview (não salva nada, apenas mostra o que foi lido) ───────
            if (s1 === 'preview') {
                const wbPrev = await readXlsx(vendasB64);
                const preview: Record<string, any[]> = {};
                for (const sheet of ['Metas Representantes','Clientes','Cross','Vendas','Vendas Representantes','Visitas Tecnicas']) {
                    preview[sheet] = getSheet(wbPrev, sheet).slice(0, 5);
                }
                const counts: Record<string, number> = {};
                for (const sheet of Object.keys(preview)) counts[sheet] = getSheet(wbPrev, sheet).length;
                return res.json({ sheets: Object.keys(wbPrev.Sheets), counts, preview });
            }

            let repsCount = 0, cliCount = 0, prodCount = 0, vendasCount = 0, vrCount = 0, visitasCount = 0;

            if (vendasB64) {
            const wb = await readXlsx(vendasB64);
            const rawMetas     = getSheet(wb, 'Metas Representantes');
            const rawClientes  = getSheet(wb, 'Clientes');
            const rawCross     = getSheet(wb, 'Cross');
            const rawVendas    = getSheet(wb, 'Vendas');
            const rawVendasRep = getSheet(wb, 'Vendas Representantes');
            const rawVisitas   = getSheet(wb, 'Visitas Tecnicas');

            // ── representantes ───────────────────────────────────────────
            const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
            const repEstadoMap = new Map<string, string>();
            for (const r of rawMetas) {
                const n = String(getVal(r,'Vendedor','vendedor')||'').trim();
                const e = String(getVal(r,'Estado','estado')||'').trim();
                if (n && e) repEstadoMap.set(normalize(n), e);
            }
            const repsRows = rawMetas.map((r:any) => ({
                nome: String(getVal(r,'Vendedor','vendedor')||'').trim(),
                estado: String(getVal(r,'Estado','estado')||'').trim()||null,
                meta_mensal: parseCurrency(getVal(r,'Meta','meta'))||null,
                updated_at: new Date().toISOString(),
            })).filter((r:any) => r.nome);
            repsCount = await upsertBatch('representantes', repsRows, 'nome');
            const { data: repsData } = await supabase.from('representantes').select('id, nome');
            const repMap = new Map<string,string>((repsData||[]).map((r:any)=>[r.nome,r.id]));

            // ── clientes ─────────────────────────────────────────────────
            const cliRows = rawClientes.map((r:any) => {
                const nome = String(getVal(r,'Cliente','cliente','Razão Social')||'').trim();
                const repNome = String(getVal(r,'Representante','representante')||'').trim();
                return {
                    nome, uf: repEstadoMap.get(normalize(repNome))||null,
                    status:    String(getVal(r,'Status','status')||'').trim()||null,
                    grupo:     String(getVal(r,'Grupo','grupo')||'').trim()||null,
                    desconto:  String(getVal(r,'Desconto','desconto')||'').trim()||null,
                    pagamento: String(getVal(r,'Pagamento','pagamento')||'').trim()||null,
                    prazo:     String(getVal(r,'Prazo','prazo')||'').trim()||null,
                    representante_id: repMap.get(repNome)||null,
                    updated_at: new Date().toISOString(),
                };
            }).filter((c:any)=>c.nome);
            cliCount = await upsertBatch('clientes', cliRows, 'nome');
            const { data: cliData } = await supabase.from('clientes').select('id, nome');
            const cliMap = new Map<string,string>((cliData||[]).map((c:any)=>[c.nome,c.id]));
            const normNome = (s:string) => s.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]/g,' ').replace(/\s+/g,' ').trim();
            const cliMapNorm = new Map<string,string>();
            for (const [n,id] of cliMap) cliMapNorm.set(normNome(n), id);
            const findCliId = (n:string) => cliMap.get(n) || cliMapNorm.get(normNome(n)) || null;

            // ── produtos ─────────────────────────────────────────────────
            const prodRows = rawCross.map((r:any) => {
                const pn = String(getVal(r,'PN','pn')||'').trim();
                if (!pn) return null;
                const toRef = (v:any) => v && String(v).trim()!=='N/A' && String(v).trim()!=='' ? String(v).trim() : null;
                const rl = toRef(getVal(r,'Metal Leve')), rs = toRef(getVal(r,'Sulloy')), rk = toRef(getVal(r,'KS')), ra = toRef(getVal(r,'Apex'));
                const linhas = [...(rl?['Metal Leve']:[]), ...(rs?['Sulloy']:[]), ...(rk?['KS']:[]), ...(ra?['Apex']:[])];
                return { pn, descricao: String(getVal(r,'Descrição','Descricao','descricao')||'').trim()||null, linhas, ref_metal_leve:rl, ref_sulloy:rs, ref_ks:rk, ref_apex:ra };
            }).filter(Boolean);
            prodCount = await upsertBatch('produtos', prodRows as any[], 'pn');
            const { data: prodData } = await supabase.from('produtos').select('id, pn');
            const prodMap = new Map<string,string>((prodData||[]).map((p:any)=>[p.pn,p.id]));

            // ── truncate transacionais ────────────────────────────────────
            for (const t of ['vendas','vendas_representantes','visitas_tecnicas']) {
                const { error } = await supabase.from(t).delete().neq('id','00000000-0000-0000-0000-000000000000');
                if (error) throw new Error(`Truncate ${t}: ${error.message}`);
            }

            // ── vendas ────────────────────────────────────────────────────
            const vendasRows = rawVendas.map((r:any) => {
                const data = parseDate(getVal(r,'Data','data'));
                const cliente = String(getVal(r,'Cliente','cliente')||'').trim();
                const sku = String(getVal(r,'Código (SKU)','Codigo','codigo','PN','pn')||'').trim();
                if (!data||!cliente) return null;
                const repNome = rawClientes.find((c:any)=>String(getVal(c,'Cliente','cliente')||'').trim()===cliente);
                const repId = repNome ? repMap.get(String(getVal(repNome,'Representante','representante')||'').trim()) : undefined;
                return { data, cliente_id: findCliId(cliente), produto_id: prodMap.get(sku)||null, quantidade: parseCurrency(getVal(r,'Quantidade','quantidade'))||null, valor: parseCurrency(getVal(r,'Valor','valor'))||null, representante_id: repId||null };
            }).filter(Boolean);
            vendasCount = await insertBatch('vendas', vendasRows as any[]);

            // ── vendas_representantes ─────────────────────────────────────
            const vrRows = rawVendasRep.map((r:any) => {
                const data = parseDate(getVal(r,'Data','data'));
                const vendedor = String(getVal(r,'Vendedor','vendedor')||'').trim();
                const cliente = String(getVal(r,'Cliente','cliente')||'').trim();
                if (!data||!vendedor) return null;
                return { data, representante_id: repMap.get(vendedor)||null, cliente_id: findCliId(cliente), cliente_nome: cliente||null, valor_pedido: parseCurrency(getVal(r,'Valor do Pedido',' Valor do Pedido ','Valor','valor'))||null };
            }).filter(Boolean);
            vrCount = await insertBatch('vendas_representantes', vrRows as any[]);

            // ── visitas ───────────────────────────────────────────────────
            const visitasRows = rawVisitas.map((r:any) => {
                const data = parseDate(getVal(r,'Data','data'));
                const rep = String(getVal(r,'Representante','representante','Vendedor','vendedor')||'').trim();
                const cliente = String(getVal(r,'Cliente','cliente')||'').trim();
                if (!data||!rep) return null;
                return { data, tipo_visita: String(getVal(r,'Tipo de Visita','tipo de visita')||'').trim()||null, representante_id: repMap.get(rep)||null, cliente_id: findCliId(cliente), custo_visita: parseCurrency(getVal(r,'Custo da Visita (R$)','Custo da Visita','custo da visita (r$)','custo da visita'))||0 };
            }).filter(Boolean);
            visitasCount = await insertBatch('visitas_tecnicas', visitasRows as any[]);

            } // fim if (vendasB64)

            // ── catálogo (opcional) ───────────────────────────────────────
            let catalogoCount = 0;
            if (catalogoB64) {
                const wbCat = await readXlsx(catalogoB64);
                const sheetCat = wbCat.Sheets[wbCat.SheetNames[0]];
                const rawCat: any[] = XLSX.utils.sheet_to_json(sheetCat, { range: 1, raw: false, defval: null });
                const catRows = rawCat.map((r:any) => {
                    const cod = String(r['CÓD']||r['COD']||r['Cód']||'').trim();
                    if (!cod) return null;
                    const cl = (v:any) => v ? String(v).trim().replace(/\r\n/g,' / ').replace(/\n/g,' / ')||null : null;
                    const cn = (v:any) => { const n = parseFloat(v); return isNaN(n)?null:n; };
                    const lancRaw = cl(r['LANÇAMENTOS']||r['LANÇAMENTO']||r['Lançamentos']||r['Lançamento']||r['lancamentos']||r['lancamento']||r['LANCAMENTOS']||r['LANCAMENTO']);
                    const lancamentos = lancRaw ? !['nao','não','n','false','0','no',''].includes(lancRaw.toLowerCase().trim()) : false;
                    return { cod, pa: cl(r['PA']), descricao: cl(r['DESCRIÇÃO']), grupo: cl(r['Grupo']||r['GRUPO']), montadora: cl(r['MONTADORA']), veiculo: cl(r['VEICULO']||r['VEÍCULO']), ano_aplicacao: cl(r['ANO DE APLICAÇÃO']), motor: cl(r['MOTOR']), sobremedida: cl(r['SOBREMEDIDA']), qtd_pistoes: cn(r['QUANTIDADE DE PISTÕES'])!==null?Math.round(cn(r['QUANTIDADE DE PISTÕES'])!):null, diametro_cilindro: cn(r['DIAMETRO DO CILINDRO']), ref_metal_leve_sulloy: cl(r['CÓD REF METAL LEVE / SULOY']||r['CÓD REF METAL LEVE / SULLOY']), ref_anel_kalled: cl(r['REF ANEL KALLED']), lancamentos, updated_at: new Date().toISOString() };
                }).filter(Boolean);
                const { error: delCat } = await supabase.from('catalogo_produtos').delete().neq('id','00000000-0000-0000-0000-000000000000');
                if (delCat) throw new Error(`Truncate catalogo_produtos: ${delCat.message}`);
                catalogoCount = await insertBatch('catalogo_produtos', catRows as any[]);
            }

            return res.json({ success: true, counts: { representantes: repsCount, clientes: cliCount, produtos: prodCount, vendas: vendasCount, vendas_representantes: vrCount, visitas: visitasCount, catalogo: catalogoCount } });
        }

        return res.status(404).json({ error: 'Rota não encontrada' });
    } catch (e: any) {
        return res.status(500).json({ error: (e as Error).message });
    }
}
