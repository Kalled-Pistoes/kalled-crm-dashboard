import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, Users, TrendingUp, Target, DollarSign, Calendar, X } from 'lucide-react';
import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, ReferenceLine, LabelList,
} from 'recharts';
import {
    api, Representante, ClienteVendasMes, RepVisitasMes,
    RepresentanteCliente, RepresentanteVisitaCliente, ComparativoAnoData,
    formatCurrency, formatDate, formatMonthLabel,
} from '../lib/api';

const MESES_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function ChartTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 shadow-xl">
            <p className="text-xs text-slate-400 mb-1">{label}</p>
            {payload.map((p: any) => (
                <p key={p.dataKey} className="text-sm font-bold" style={{ color: p.color }}>
                    {p.name}: {formatCurrency(Number(p.value))}
                </p>
            ))}
        </div>
    );
}

function ComparativoTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload as ComparativoAnoData;
    return (
        <div className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 shadow-xl min-w-[160px]">
            <p className="text-xs font-bold text-white mb-1">{label}</p>
            <p className="text-sm font-bold text-brand-400">{formatCurrency(d.total)}</p>
            {d.percentMeta !== null && (
                <p className={`text-xs font-bold mt-0.5 ${d.percentMeta >= 100 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {d.percentMeta >= 100 ? '+' : ''}{(d.percentMeta - 100).toFixed(1)}% da meta
                </p>
            )}
            {d.meta > 0 && (
                <p className="text-xs text-slate-500 mt-0.5">Meta: {formatCurrency(d.meta)}</p>
            )}
        </div>
    );
}

export default function Representantes() {
    const [searchParams] = useSearchParams();
    const mesFiltro = searchParams.get('mes') || '';

    const [representantes, setRepresentantes] = useState<Representante[]>([]);
    const [selectedRep, setSelectedRep] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [vendasMes, setVendasMes] = useState<ClienteVendasMes[]>([]);
    const [visitasMes, setVisitasMes] = useState<RepVisitasMes[]>([]);
    const [clientes, setClientes] = useState<RepresentanteCliente[]>([]);
    const [visitasCliente, setVisitasCliente] = useState<RepresentanteVisitaCliente[]>([]);
    const [comparativoData, setComparativoData] = useState<ComparativoAnoData[]>([]);
    const [loadingComparativo, setLoadingComparativo] = useState(false);
    const [selectedPeriodo, setSelectedPeriodo] = useState<{ type: 'mes' | 'ano'; value: string } | null>(null);
    const [clientesAtivos, setClientesAtivos] = useState<Set<string>>(new Set());
    const [loadingPeriodo, setLoadingPeriodo] = useState(false);

    useEffect(() => {
        api.getRepresentantes()
            .then(r => {
                setRepresentantes(r);
                if (r.length > 0) setSelectedRep(r[0].nome);
            })
            .catch(e => console.error(e))
            .finally(() => setLoading(false));
    }, []);

    // Carrega dados normais
    useEffect(() => {
        if (!selectedRep) return;
        setLoadingDetail(true);
        Promise.all([
            api.getRepresentanteVendasPorMes(selectedRep),
            api.getRepresentanteVisitasPorMes(selectedRep),
            api.getRepresentanteClientes(selectedRep),
            api.getRepresentanteVisitasPorCliente(selectedRep),
        ])
            .then(([vm, vsm, cl, vc]) => {
                setVendasMes(vm);
                setVisitasMes(vsm);
                setClientes(cl);
                setVisitasCliente(vc);
            })
            .catch(e => console.error(e))
            .finally(() => setLoadingDetail(false));
    }, [selectedRep]);

    // Carrega comparativo quando há filtro de mês
    useEffect(() => {
        if (!selectedRep || !mesFiltro) { setComparativoData([]); return; }
        setLoadingComparativo(true);
        api.getRepresentanteComparativoMes(selectedRep, mesFiltro)
            .then(setComparativoData)
            .catch(e => console.error(e))
            .finally(() => setLoadingComparativo(false));
    }, [selectedRep, mesFiltro]);

    // Fetch clients who bought in the selected period
    useEffect(() => {
        if (!selectedPeriodo || !selectedRep) { setClientesAtivos(new Set()); return; }
        setLoadingPeriodo(true);
        const params = selectedPeriodo.type === 'mes' ? { mes: selectedPeriodo.value } : { ano: selectedPeriodo.value };
        api.getRepresentanteClientesPeriodo(selectedRep, params)
            .then(names => setClientesAtivos(new Set(names.map(n => n.trim().toLowerCase()))))
            .catch(e => console.error(e))
            .finally(() => setLoadingPeriodo(false));
    }, [selectedPeriodo, selectedRep]);

    useEffect(() => { setSelectedPeriodo(null); }, [selectedRep]);

    const repInfo = representantes.find(r => r.nome === selectedRep);
    const meta = repInfo?.meta ?? 0;

    const combinedMesData = useMemo(() => {
        const map: Record<string, { pedido: number; visita: number }> = {};
        vendasMes.forEach(v => { if (!map[v.mes]) map[v.mes] = { pedido: 0, visita: 0 }; map[v.mes].pedido = v.total; });
        visitasMes.forEach(v => { if (!map[v.mes]) map[v.mes] = { pedido: 0, visita: 0 }; map[v.mes].visita = v.custo; });
        return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([mes, d]) => ({ mes, label: formatMonthLabel(mes), ...d }));
    }, [vendasMes, visitasMes]);

    const mediaAnualData = useMemo(() => {
        const anoMap: Record<string, number[]> = {};
        vendasMes.forEach(v => {
            const ano = v.mes.substring(0, 4);
            if (!anoMap[ano]) anoMap[ano] = [];
            anoMap[ano].push(v.total);
        });
        return Object.entries(anoMap).sort(([a], [b]) => a.localeCompare(b))
            .map(([ano, totals]) => ({ ano, media: totals.reduce((s, v) => s + v, 0) / 12, meta }));
    }, [vendasMes, meta]);

    const nomeMes = mesFiltro ? (MESES_FULL[parseInt(mesFiltro) - 1] ?? mesFiltro) : '';

    const periodoLabel = selectedPeriodo
        ? selectedPeriodo.type === 'mes' ? formatMonthLabel(selectedPeriodo.value) : selectedPeriodo.value
        : null;

    const handleBarClick = (data: any) => {
        if (!data?.activePayload?.[0]) return;
        const mes = data.activePayload[0].payload.mes;
        setSelectedPeriodo(prev => prev?.type === 'mes' && prev.value === mes ? null : { type: 'mes', value: mes });
    };

    const handleLineClick = (data: any) => {
        if (!data?.activePayload?.[0]) return;
        const ano = data.activePayload[0].payload.ano;
        setSelectedPeriodo(prev => prev?.type === 'ano' && prev.value === ano ? null : { type: 'ano', value: ano });
    };

    const isClienteAtivo = (nome: string): boolean | null => {
        if (!selectedPeriodo) return null;
        return clientesAtivos.has(nome.trim().toLowerCase());
    };

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    // ── Header comum ──────────────────────────────────────────────────────────
    const header = (
        <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Vendedor:</span>
                <div className="relative">
                    <select
                        value={selectedRep}
                        onChange={e => setSelectedRep(e.target.value)}
                        className="appearance-none bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 pr-10 text-sm font-bold text-white focus:outline-none focus:border-brand-500/50 cursor-pointer max-w-[400px] truncate"
                    >
                        {representantes.map(r => (
                            <option key={r.nome} value={r.nome} className="bg-slate-900">{r.nome}</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
                {nomeMes && (
                    <div className="flex items-center gap-2 bg-brand-500/10 border border-brand-500/20 rounded-xl px-3 py-2">
                        <Calendar className="w-3.5 h-3.5 text-brand-400" />
                        <span className="text-sm font-bold text-brand-300">{nomeMes} — Comparativo Anual</span>
                    </div>
                )}
            </div>
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5">
                <Users className="w-4 h-4 text-brand-400" />
                <span className="text-sm font-bold text-slate-400">N° de Clientes:</span>
                <span className="text-sm font-black text-white">{clientes.length}</span>
            </div>
        </div>
    );

    // ── Visão de Comparativo Anual (quando mês está filtrado) ─────────────────
    if (mesFiltro) {
        const metaComparativo = comparativoData[0]?.meta ?? 0;

        return (
            <div className="space-y-6">
                {header}

                {loadingComparativo ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : comparativoData.length === 0 ? (
                    <div className="card-premium text-center py-16">
                        <p className="text-slate-500 text-sm">Nenhuma venda registrada para {nomeMes} neste representante.</p>
                    </div>
                ) : (
                    <>
                        {/* Gráfico comparativo */}
                        <div className="card-premium">
                            <div className="flex items-center gap-2 mb-6">
                                <TrendingUp className="w-4 h-4 text-brand-400" />
                                <h2 className="text-sm font-semibold text-white">
                                    Vendas em <span className="text-brand-300">{nomeMes}</span> por Ano
                                </h2>
                                {metaComparativo > 0 && (
                                    <span className="ml-auto text-xs font-bold text-slate-500">
                                        Meta mensal: <span className="text-pink-400">{formatCurrency(metaComparativo)}</span>
                                    </span>
                                )}
                            </div>
                            <ResponsiveContainer width="100%" height={260}>
                                <BarChart
                                    data={comparativoData.map(d => ({
                                        ...d,
                                        fill: d.percentMeta === null ? '#334155' : d.percentMeta >= 100 ? '#10b981' : '#6366f1',
                                    }))}
                                    margin={{ left: 0, right: 16, top: 28 }}
                                    barCategoryGap="40%"
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                    <XAxis dataKey="ano" tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }} axisLine={false} tickLine={false} />
                                    <YAxis
                                        tick={{ fill: '#64748b', fontSize: 9 }}
                                        axisLine={false}
                                        tickLine={false}
                                        tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`}
                                        width={48}
                                        domain={[0, (dataMax: number) => Math.ceil(Math.max(dataMax, metaComparativo) * 1.15 / 1000) * 1000]}
                                    />
                                    <Tooltip content={<ComparativoTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                                    {metaComparativo > 0 && (
                                        <ReferenceLine
                                            y={metaComparativo}
                                            stroke="#ec4899"
                                            strokeDasharray="5 4"
                                            strokeWidth={1.5}
                                            label={{ value: `Meta: ${formatCurrency(metaComparativo)}`, fill: '#ec4899', fontSize: 10, position: 'insideTopRight' }}
                                        />
                                    )}
                                    <Bar dataKey="total" fill="fill" radius={[6, 6, 0, 0]} maxBarSize={80}>
                                        <LabelList
                                            dataKey="total"
                                            position="top"
                                            formatter={(v: any) => Number(v) > 0 ? `R$${(Number(v) / 1000).toFixed(0)}k` : ''}
                                            style={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }}
                                        />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                            <div className="flex gap-6 mt-3 justify-center">
                                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Acima da meta
                                </div>
                                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    <div className="w-2.5 h-2.5 rounded-full bg-brand-500" /> Abaixo da meta
                                </div>
                                {metaComparativo > 0 && (
                                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                        <div className="w-4 border-t-2 border-dashed border-pink-500" /> Meta mensal
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Cards por ano */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {comparativoData.map(d => {
                                const acimaMeta = d.percentMeta !== null && d.percentMeta >= 100;
                                const diff = d.percentMeta !== null ? d.percentMeta - 100 : null;
                                return (
                                    <div key={d.ano} className={`card-premium flex flex-col gap-3 border-t-2 ${acimaMeta ? 'border-t-emerald-500/60' : 'border-t-brand-500/40'}`}>
                                        {/* Ano + mês */}
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{nomeMes}</p>
                                            <span className="text-lg font-black text-white">{d.ano}</span>
                                        </div>

                                        {/* Valor */}
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Total vendido</p>
                                            <p className={`text-xl font-black ${acimaMeta ? 'text-emerald-400' : 'text-white'}`}>
                                                {formatCurrency(d.total)}
                                            </p>
                                        </div>

                                        {/* vs Meta */}
                                        {d.meta > 0 && (
                                            <div className="bg-white/5 border border-white/5 rounded-xl p-3">
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">vs Meta ({formatCurrency(d.meta)})</p>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full ${acimaMeta ? 'bg-emerald-500' : 'bg-brand-500'}`}
                                                            style={{ width: `${Math.min(d.percentMeta ?? 0, 100)}%` }}
                                                        />
                                                    </div>
                                                    <span className={`text-xs font-black whitespace-nowrap ${acimaMeta ? 'text-emerald-400' : diff !== null && diff < -30 ? 'text-rose-400' : 'text-amber-400'}`}>
                                                        {diff !== null ? `${diff >= 0 ? '+' : ''}${diff.toFixed(0)}%` : '—'}
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Clientes */}
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                                                Clientes ({d.clientes.length})
                                            </p>
                                            <ul className="space-y-1 max-h-[200px] overflow-y-auto pr-1">
                                                {d.clientes.map(c => (
                                                    <li key={c.nome} title={c.nome} className="flex items-center justify-between gap-2 bg-white/5 rounded px-2 py-1.5 hover:bg-white/10 transition-colors">
                                                        <span className="text-xs text-slate-300 truncate min-w-0">{c.nome}</span>
                                                        <span className="text-xs font-bold text-brand-400 whitespace-nowrap flex-shrink-0">{formatCurrency(c.total)}</span>
                                                    </li>
                                                ))}
                                                {d.clientes.length === 0 && (
                                                    <li className="text-xs text-slate-600 italic px-2 py-1">Nenhum cliente</li>
                                                )}
                                            </ul>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        );
    }

    // ── Visão normal (sem filtro de mês) ──────────────────────────────────────
    return (
        <div className="space-y-6">
            {header}

            {loadingDetail ? (
                <div className="flex items-center justify-center h-64">
                    <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
                <>
                    {/* Charts */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="card-premium">
                            <div className="flex items-center gap-2 mb-4">
                                <TrendingUp className="w-4 h-4 text-brand-400" />
                                <h2 className="text-sm font-semibold text-white">Vendas</h2>
                            </div>
                            <div className="overflow-x-auto">
                                <div style={{ minWidth: Math.max(500, combinedMesData.length * 52) }}>
                                    <ResponsiveContainer width="100%" height={220}>
                                        <BarChart data={combinedMesData} margin={{ left: 0, right: 8 }} barCategoryGap="30%" onClick={handleBarClick} style={{ cursor: 'pointer' }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                            <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 9, fontWeight: 600 }} axisLine={false} tickLine={false} />
                                            <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} width={44} />
                                            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                                            <Bar dataKey="pedido" name="Pedido" fill="#6366f1" radius={[3, 3, 0, 0]} />
                                            <Bar dataKey="visita" name="Visita Técnica" fill="#ec4899" radius={[3, 3, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            <div className="flex gap-6 mt-3 justify-center">
                                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    <div className="w-2.5 h-2.5 rounded-full bg-brand-500" /> Pedido
                                </div>
                                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    <div className="w-2.5 h-2.5 rounded-full bg-pink-500" /> Visita Técnica
                                </div>
                            </div>
                        </div>

                        <div className="card-premium">
                            <div className="flex items-center gap-2 mb-4">
                                <Target className="w-4 h-4 text-brand-400" />
                                <h2 className="text-sm font-semibold text-white">Média de Venda Geral</h2>
                            </div>
                            <ResponsiveContainer width="100%" height={220}>
                                <LineChart data={mediaAnualData} margin={{ left: 0, right: 16 }} onClick={handleLineClick} style={{ cursor: 'pointer' }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                    <XAxis dataKey="ano" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} width={44} />
                                    <Tooltip content={<ChartTooltip />} />
                                    <Line type="monotone" dataKey="meta" name="Linha de Meta" stroke="#ec4899" strokeWidth={2} strokeDasharray="5 4" dot={false} />
                                    <Line type="monotone" dataKey="media" name="Média de Vendas" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 4, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                                </LineChart>
                            </ResponsiveContainer>
                            <div className="flex gap-6 mt-3 justify-center">
                                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    <div className="w-4 border-t-2 border-dashed border-pink-500" /> Linha de Meta
                                </div>
                                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    <div className="w-2.5 h-2.5 rounded-full bg-brand-500" /> Média de Vendas
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tables */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="card-premium">
                            <div className="flex items-center gap-2 mb-4">
                                <Users className="w-4 h-4 text-brand-400" />
                                <h2 className="text-sm font-semibold text-white">Clientes</h2>
                                {periodoLabel ? (
                                    <div className="ml-auto flex items-center gap-2 bg-brand-500/15 border border-brand-500/30 rounded-lg px-2.5 py-1">
                                        <Calendar className="w-3 h-3 text-brand-400" />
                                        <span className="text-xs font-bold text-brand-300">{periodoLabel}</span>
                                        <span className="text-xs text-slate-400">— {loadingPeriodo ? '...' : clientesAtivos.size} compraram</span>
                                        <button onClick={() => setSelectedPeriodo(null)} className="text-slate-500 hover:text-slate-300 transition-colors ml-1">
                                        <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ) : (
                                    <span className="ml-auto text-[10px] text-slate-600">Clique no gráfico para filtrar</span>
                                )}
                            </div>
                            <div className="overflow-auto max-h-[300px]">
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-[#0f172a] z-10">
                                        <tr>
                                            <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 pb-3 pr-4">Cliente</th>
                                            <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 pb-3 pr-4">Ultima Compra</th>
                                            <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 pb-3">Status Cliente</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {clientes.map((c, i) => {
                                            const ativo = isClienteAtivo(c.nome);
                                            return (
                                            <tr key={i} className={`transition-all ${selectedPeriodo ? (ativo ? 'ring-1 ring-emerald-500/30 bg-emerald-500/5' : 'opacity-30') : 'hover:bg-white/5'}`}>
                                                <td className="py-2.5 pr-4 text-xs truncate max-w-[160px]">
                                                    <div className="flex items-center gap-2">
                                                        {selectedPeriodo && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${ativo ? 'bg-emerald-400' : 'bg-slate-600'}`} />}
                                                        <span className={ativo === true ? 'text-white font-bold' : 'text-slate-300 font-medium'}>{c.nome}</span>
                                                    </div>
                                                </td>
                                                <td className="py-2.5 pr-4 text-slate-400 text-xs whitespace-nowrap">{c.ultimaCompra ? formatDate(c.ultimaCompra) : '—'}</td>
                                                <td className="py-2.5">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.status === 'Ativo' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'}`}>
                                                        {c.status} {c.status === 'Inativo' && c.ultimaCompra ? '(6+ meses)' : ''}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                        })}
                                        {clientes.length === 0 && (
                                            <tr><td colSpan={3} className="py-8 text-center text-slate-600 text-xs">Nenhum cliente encontrado</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="card-premium">
                            <div className="flex items-center gap-2 mb-4">
                                <DollarSign className="w-4 h-4 text-brand-400" />
                                <h2 className="text-sm font-semibold text-white">Custo de Visitas por Cliente</h2>
                            </div>
                            <div className="overflow-auto max-h-[300px]">
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-[#0f172a] z-10">
                                        <tr>
                                            <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 pb-3 pr-4">Cliente</th>
                                            <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 pb-3 pr-4">Custo</th>
                                            <th className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 pb-3">Mês</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {visitasCliente.map((v, i) => (
                                            <tr key={i} className="hover:bg-white/5 transition-colors">
                                                <td className="py-2.5 pr-4 text-slate-300 font-medium text-xs truncate max-w-[160px]">{v.cliente}</td>
                                                <td className="py-2.5 pr-4 text-amber-400 font-bold text-xs whitespace-nowrap">{formatCurrency(v.custo)}</td>
                                                <td className="py-2.5 text-slate-400 text-xs">{v.mes ? formatMonthLabel(v.mes) : '—'}</td>
                                            </tr>
                                        ))}
                                        {visitasCliente.length === 0 && (
                                            <tr><td colSpan={3} className="py-8 text-center text-slate-600 text-xs">Nenhuma visita registrada</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
