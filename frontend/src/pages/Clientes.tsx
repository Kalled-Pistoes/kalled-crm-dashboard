import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api, Cliente, ClienteVendasMes, ItensNaoComprados, formatCurrency, formatMonthLabel } from '../lib/api';

function ChartTooltipContent({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 shadow-xl">
            <p className="text-xs text-slate-400 mb-1">{label}</p>
            <p className="text-sm font-bold text-white">{formatCurrency(payload[0].value)}</p>
        </div>
    );
}

export default function Clientes() {
    const [searchParams] = useSearchParams();
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [filtroRep, setFiltroRep] = useState('');
    const [filtroStatus, setFiltroStatus] = useState('');

    useEffect(() => {
        api.getClientes()
            .then(setClientes)
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    const representantes = useMemo(() => {
        const set = new Set(clientes.map(c => c.Representante ?? '').filter(Boolean));
        return Array.from(set).sort();
    }, [clientes]);

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return clientes.filter(c => {
            const nome = (c.Cliente ?? c['Razão Social'] ?? '').toLowerCase();
            const matchSearch = !q || nome.includes(q);
            const matchRep = !filtroRep || c.Representante === filtroRep;
            const matchStatus = !filtroStatus || (c.Status ?? '').toLowerCase() === filtroStatus;
            return matchSearch && matchRep && matchStatus;
        });
    }, [clientes, search, filtroRep, filtroStatus]);

    const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);

    // Auto-select client from URL param (e.g. navigated from Visitas)
    useEffect(() => {
        const param = searchParams.get('cliente');
        if (!param || clientes.length === 0) return;
        const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
        const found = clientes.find(c => norm(c.Cliente ?? c['Razão Social'] ?? '') === norm(param));
        if (found) setSelectedCliente(found);
    }, [clientes]);

    const [activeTab, setActiveTab] = useState<'info' | 'historico' | 'itens'>('info');
    const [clienteVendas, setClienteVendas] = useState<ClienteVendasMes[]>([]);
    const [itensData, setItensData] = useState<ItensNaoComprados | null>(null);
    const [loadingVendas, setLoadingVendas] = useState(false);
    const [loadingItens, setLoadingItens] = useState(false);
    const [filtroLinha, setFiltroLinha] = useState('');
    const [searchPN, setSearchPN] = useState('');

    useEffect(() => {
        setActiveTab('info');
        setClienteVendas([]);
        setItensData(null);
        setFiltroLinha('');
        setSearchPN('');
    }, [selectedCliente?.Cliente]);

    const handleTabChange = (tab: 'info' | 'historico' | 'itens') => {
        setActiveTab(tab);
        const nome = selectedCliente?.Cliente ?? selectedCliente?.['Razão Social'] ?? '';
        if (!nome) return;
        if (tab === 'historico' && clienteVendas.length === 0) {
            setLoadingVendas(true);
            api.getClienteVendasPorMes(nome).then(setClienteVendas).finally(() => setLoadingVendas(false));
        }
        if (tab === 'itens' && !itensData) {
            setLoadingItens(true);
            api.getClienteItensNaoComprados(nome).then(setItensData).finally(() => setLoadingItens(false));
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    if (error) return (
        <div className="card-premium border-rose-500/30 text-center py-12">
            <p className="text-rose-400 font-medium">{error}</p>
        </div>
    );

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'Nunca comprou';
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Clientes</h1>
                    <p className="text-slate-500 text-sm mt-1 font-medium">{clientes.length} clientes cadastrados</p>
                </div>
                <div className="flex items-center gap-2 bg-brand-500/10 border border-brand-500/20 rounded-xl px-4 py-2 backdrop-blur-md">
                    <Users className="w-4 h-4 text-brand-400" />
                    <span className="text-brand-300 font-bold">{filtered.length}</span>
                    <span className="text-slate-400 text-sm font-medium">exibidos</span>
                </div>
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[160px] max-w-sm group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-brand-400 transition-colors" />
                    <input
                        className="input pl-9"
                        placeholder="Buscar cliente..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <select
                    className="input max-w-[200px] cursor-pointer flex-1 min-w-[140px]"
                    value={filtroRep}
                    onChange={e => setFiltroRep(e.target.value)}
                >
                    <option value="" className="bg-slate-900">Todos os rep.</option>
                    {representantes.map(r => (
                        <option key={r} value={r} className="bg-slate-900">{r}</option>
                    ))}
                </select>
                <div className="flex rounded-lg border border-white/10 overflow-hidden">
                    {[{ label: 'Todos', value: '' }, { label: 'Ativo', value: 'ativo' }, { label: 'Inativo', value: 'inativo' }].map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => setFiltroStatus(opt.value)}
                            className={`px-3 sm:px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                                filtroStatus === opt.value
                                    ? opt.value === 'ativo'
                                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                        : opt.value === 'inativo'
                                            ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                                            : 'bg-white/10 text-white'
                                    : 'bg-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5'
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Layout Master-Detail */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:h-[820px]">
                {/* Master List */}
                <div className="card-premium p-0 flex flex-col h-[400px] lg:h-full overflow-hidden border border-white/10 shadow-2xl">
                    <div className="p-4 border-b border-white/5 bg-white/5">
                        <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Lista de Clientes</h2>
                    </div>
                    <div className="flex-1 overflow-y-auto overflow-x-hidden">
                        {filtered.length === 0 ? (
                            <div className="text-slate-500 text-center p-6 text-sm">Nenhum cliente encontrado.</div>
                        ) : (
                            <div className="divide-y divide-white/5">
                                {filtered.slice(0, 300).map((c, i) => {
                                    const nome = c.Cliente ?? c['Razão Social'] ?? '—';
                                    const status = c.Status ?? '';
                                    const isSelected = selectedCliente?.Cliente === c.Cliente;
                                    const isActive = status.toLowerCase() === 'ativo';

                                    return (
                                        <div
                                            key={i}
                                            onClick={() => setSelectedCliente(c)}
                                            className={`p-4 cursor-pointer transition-all border-l-2 ${isSelected ? 'bg-white/10 border-brand-500' : 'hover:bg-white/5 border-transparent'} group`}
                                        >
                                            <div className="flex justify-between items-start gap-2">
                                                <div className="min-w-0">
                                                    <h3 className={`text-sm font-semibold truncate ${isSelected ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>{nome}</h3>
                                                    <p className="text-xs text-slate-500 truncate mt-0.5">{c.Representante || 'Sem Representante'}</p>
                                                </div>
                                                <span className={`flex-shrink-0 animate-pulse-slow inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${isActive
                                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                    : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                                    }`}>
                                                    {isActive ? 'Ativo' : 'Inativo'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    {filtered.length > 300 && (
                        <div className="p-3 text-center text-[10px] font-bold text-slate-500 border-t border-white/5 bg-black/20 uppercase">
                            Exibindo os primeiros 300 resultados
                        </div>
                    )}
                </div>

                {/* Detail Panel */}
                <div className="lg:col-span-2 min-h-[400px] lg:h-full">
                    {selectedCliente ? (
                        <div className="card-premium min-h-[400px] lg:h-full flex flex-col relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                            {/* Decorative background glow */}
                            <div className={`absolute -top-32 -right-32 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none ${selectedCliente.Status?.toLowerCase() === 'ativo' ? 'bg-emerald-500' : 'bg-rose-500'}`} />

                            {/* Header */}
                            <div className="px-4 sm:px-8 pt-6 sm:pt-8 pb-4 relative z-10">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className={`inline-flex items-center px-3 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide border ${selectedCliente.Status?.toLowerCase() === 'ativo'
                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                                        : 'bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.2)]'
                                        }`}>
                                        {selectedCliente.Status?.toLowerCase() === 'ativo' ? 'Cliente Ativo' : 'Cliente Inativo'}
                                    </span>
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-1 tracking-tight">
                                    {selectedCliente.Cliente || selectedCliente['Razão Social'] || 'Sem Nome'}
                                </h2>
                                <p className="text-slate-400 text-sm font-medium">Documento Fiscal / Razão Social: {selectedCliente['Razão Social'] || selectedCliente.Cliente}</p>
                            </div>

                            {/* Tabs */}
                            <div className="px-4 sm:px-8 flex gap-1 border-b border-white/5 relative z-10 overflow-x-auto">
                                {([
                                    { id: 'info' as const, label: 'Informações' },
                                    { id: 'historico' as const, label: 'Histórico de Compras' },
                                    { id: 'itens' as const, label: 'Itens Não Comprados' },
                                ]).map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => handleTabChange(tab.id)}
                                        className={`px-4 py-3 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border-b-2 -mb-px ${activeTab === tab.id
                                            ? 'text-brand-400 border-brand-400'
                                            : 'text-slate-500 border-transparent hover:text-slate-300'
                                            }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            {/* Tab Content */}
                            <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-4 sm:py-6 relative z-10">
                                {activeTab === 'info' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider border-b border-white/10 pb-2">Comercial</h3>
                                            <div>
                                                <p className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Representante</p>
                                                <p className="text-slate-200 text-sm font-medium">{selectedCliente.Representante || 'Não definido'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Última Compra</p>
                                                <p className="text-slate-200 text-sm font-medium">{formatDate(selectedCliente.ultimaCompra)}</p>
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider border-b border-white/10 pb-2">Condições de Faturamento</h3>
                                            <div>
                                                <p className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Desconto Padrão</p>
                                                <p className="text-slate-200 text-sm font-medium">{selectedCliente.Desconto || 'Não aplicado'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Forma de Pagamento</p>
                                                <p className="text-slate-200 text-sm font-medium">{selectedCliente.Pagamento || 'Padrão'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Prazo Médio</p>
                                                <p className="text-slate-200 text-sm font-medium">{selectedCliente.Prazo || 'À vista'}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'historico' && (
                                    <div>
                                        {loadingVendas ? (
                                            <div className="flex items-center justify-center py-16">
                                                <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                                            </div>
                                        ) : clienteVendas.length === 0 ? (
                                            <div className="text-center py-16 text-slate-500 text-sm">Nenhuma compra registrada.</div>
                                        ) : (
                                            <div>
                                                <div className="flex items-center justify-between mb-4">
                                                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{clienteVendas.length} meses com compras</p>
                                                    <p className="text-xs text-slate-500 font-medium">Total acumulado: <span className="text-white font-bold">{formatCurrency(clienteVendas.reduce((a, b) => a + b.total, 0))}</span></p>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <div style={{ minWidth: Math.max(560, clienteVendas.length * 55) }}>
                                                        <ResponsiveContainer width="100%" height={300}>
                                                            <BarChart data={clienteVendas.map(v => ({ ...v, label: formatMonthLabel(v.mes) }))} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                                                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                                                                <YAxis tickFormatter={v => `R$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
                                                                <Tooltip content={<ChartTooltipContent />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                                                                <Bar dataKey="total" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                                            </BarChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'itens' && (
                                    <div>
                                        {loadingItens ? (
                                            <div className="flex items-center justify-center py-16">
                                                <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                                            </div>
                                        ) : !itensData ? (
                                            <div className="text-center py-16 text-slate-500 text-sm">Sem dados.</div>
                                        ) : (
                                            <div>
                                                {/* Stats */}
                                                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-5">
                                                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 text-center">
                                                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">Comprados</p>
                                                        <p className="text-xl font-bold text-emerald-400">{itensData.totalComprados}</p>
                                                    </div>
                                                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2 text-center">
                                                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">Não comprados</p>
                                                        <p className="text-xl font-bold text-rose-400">{itensData.naoComprados.length}</p>
                                                    </div>
                                                    <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-center">
                                                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">Total catálogo</p>
                                                        <p className="text-xl font-bold text-white">{itensData.totalItens}</p>
                                                    </div>
                                                    <div className="bg-brand-500/10 border border-brand-500/20 rounded-lg px-3 py-2 text-center">
                                                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">Cobertura</p>
                                                        <p className="text-xl font-bold text-brand-400">{itensData.totalItens > 0 ? Math.round(itensData.totalComprados / itensData.totalItens * 100) : 0}%</p>
                                                    </div>
                                                </div>

                                                {/* Filters */}
                                                <div className="flex gap-2 mb-4">
                                                    <div className="relative flex-1 max-w-[200px] group">
                                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 group-focus-within:text-brand-400 transition-colors" />
                                                        <input
                                                            className="input pl-8 text-xs py-1.5"
                                                            placeholder="Buscar PN..."
                                                            value={searchPN}
                                                            onChange={e => setSearchPN(e.target.value)}
                                                        />
                                                    </div>
                                                    <div className="flex rounded-lg border border-white/10 overflow-hidden">
                                                        {(['', 'Metal Leve', 'Sulloy', 'KS', 'Apex'] as const).map(linha => (
                                                            <button
                                                                key={linha}
                                                                onClick={() => setFiltroLinha(linha)}
                                                                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${filtroLinha === linha ? 'bg-white/15 text-white' : 'bg-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                                                            >
                                                                {linha || 'Todos'}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* List */}
                                                {(() => {
                                                    const visibles = itensData.naoComprados.filter(item => {
                                                        const matchPN = !searchPN || item.pn.toLowerCase().includes(searchPN.toLowerCase());
                                                        const matchLinha = !filtroLinha || item.linhas.includes(filtroLinha);
                                                        return matchPN && matchLinha;
                                                    });
                                                    return (
                                                        <>
                                                            <div className="grid grid-cols-2 gap-1.5 max-h-[280px] overflow-y-auto pr-1">
                                                                {visibles.map(item => (
                                                                    <div key={item.pn} title={item.descricao || item.pn} className="flex flex-col bg-white/5 border border-white/5 rounded-lg px-3 py-2 gap-1 cursor-default hover:bg-white/10 hover:border-white/10 transition-colors">
                                                                        <div className="flex items-center justify-between gap-2">
                                                                            <span className="text-xs font-mono font-bold text-slate-200 truncate">{item.pn}</span>
                                                                            {!filtroLinha && (
                                                                                <div className="flex gap-1 flex-shrink-0">
                                                                                    {item.linhas.map(l => (
                                                                                        <span key={l} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-brand-500/15 text-brand-400 border border-brand-500/20">
                                                                                            {l === 'Metal Leve' ? 'ML' : l}
                                                                                        </span>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        {filtroLinha && item.refs[filtroLinha] && (
                                                                            <div className="flex items-center gap-1.5">
                                                                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{filtroLinha === 'Metal Leve' ? 'ML' : filtroLinha}</span>
                                                                                <span className="text-[10px] font-mono font-bold text-amber-400">{item.refs[filtroLinha]}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <p className="text-xs text-slate-600 mt-2 text-center">{visibles.length} itens exibidos</p>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Buttons */}
                            <div className="px-4 sm:px-8 py-4 border-t border-white/5 flex gap-3 relative z-10">
                                <button className="btn-primary opacity-50 cursor-not-allowed" disabled>
                                    Ver Histórico de Pedidos
                                </button>
                                <button className="btn-ghost opacity-50 cursor-not-allowed" disabled>
                                    Editar Cadastro
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="card-premium h-full flex flex-col items-center justify-center text-center border border-white/5 bg-transparent shadow-none">
                            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
                                <Users className="w-10 h-10 text-slate-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-300 mb-2">Nenhum cliente selecionado</h3>
                            <p className="text-slate-500 max-w-sm">
                                Selecione um cliente na lista à esquerda para visualizar todos os detalhes, status e histórico financeiro.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
