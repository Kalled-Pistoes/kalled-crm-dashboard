import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, Calendar, TrendingUp, UserCheck, AlertTriangle, Clock, ArrowRight, Filter, Sparkles } from 'lucide-react';
import { api, Venda, formatCurrency, formatDate, Filters } from '../lib/api';

// Funções utilitárias seguras para datas sem distorção de fuso horário
function parseDate(dateStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
}

function diffInDays(dateStr1: string, dateStr2: string): number {
    const d1 = parseDate(dateStr1);
    const d2 = parseDate(dateStr2);
    return Math.floor((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
}

function addDays(dateStr: string, days: number): string {
    const d = parseDate(dateStr);
    d.setDate(d.getDate() + Math.round(days));
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

interface ClientePredict {
    nome: string;
    totalComprado: number;
    totalPedidos: number;
    intervaloMedioMeses: number;
    diasInatividade: number;
    ultimaCompraDate: string;
    proximaCompraEstimada: string;
    statusInatividade: 'ativo' | '3m' | '6m' | '9m' | '1a' | '2a+';
}

export default function Vendas() {
    const [searchParams] = useSearchParams();
    const [vendas, setVendas] = useState<Venda[]>([]);
    const [historicoVendas, setHistoricoVendas] = useState<Venda[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingPredict, setLoadingPredict] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Filtros de Transações
    const [search, setSearch] = useState('');
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');
    const [valorFilter, setValorFilter] = useState<'all' | 'premium' | 'media' | 'varejo'>('all');
    
    // Controle de Abas
    const [activeTab, setActiveTab] = useState<'transacoes' | 'predict'>('transacoes');

    // Filtros da aba Predict
    const [searchPredict, setSearchPredict] = useState('');
    const [filtroInatividade, setFiltroInatividade] = useState<'all' | 'ativo' | '3m' | '6m' | '9m' | '1a' | '2a+'>('all');

    const filters: Filters = {
        ano: searchParams.get('ano') || String(new Date().getFullYear()),
        mes: searchParams.get('mes') || undefined,
    };

    // Carregamento inicial de vendas baseadas na URL (Transações)
    useEffect(() => {
        setLoading(true);
        api.getVendas(filters)
            .then(setVendas)
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [searchParams]);

    // Carrega o histórico completo de transações apenas ao entrar no Predict pela primeira vez
    useEffect(() => {
        if (activeTab === 'predict' && historicoVendas.length === 0) {
            setLoadingPredict(true);
            api.getVendas({ ano: undefined, mes: undefined }) // sem filtros para trazer o histórico total
                .then(setHistoricoVendas)
                .catch(e => console.error("Erro ao carregar histórico:", e))
                .finally(() => setLoadingPredict(false));
        }
    }, [activeTab, historicoVendas.length]);

    // Clientes de Destaque identificados dinamicamente para atalhos rápidos
    const clientesDestaque = useMemo(() => {
        const faturamentos: Record<string, number> = {};
        vendas.forEach(v => {
            faturamentos[v.cliente] = (faturamentos[v.cliente] || 0) + v.valor;
        });
        return Object.entries(faturamentos)
            .map(([nome, valor]) => ({ nome, valor }))
            .sort((a, b) => b.valor - a.valor)
            .slice(0, 5); // top 5 maiores clientes
    }, [vendas]);

    // Função para aplicar filtro rápido de cliente em destaque
    const aplicarFiltroDestaque = (cliente: string, especialJan2024 = false) => {
        setSearch(cliente);
        setValorFilter('all');
        if (especialJan2024) {
            setDataInicio('2024-01-01');
            setDataFim('2024-01-31');
        } else {
            setDataInicio('');
            setDataFim('');
        }
    };

    // Filtros aplicados na aba de Transações
    const filteredTransacoes = useMemo(() => {
        const q = search.toLowerCase();
        return vendas.filter(v => {
            const matchSearch = !q || v.cliente.toLowerCase().includes(q) || v.codigo.toLowerCase().includes(q);
            const matchInicio = !dataInicio || v.data >= dataInicio;
            const matchFim = !dataFim || v.data <= dataFim;
            const matchValor =
                valorFilter === 'all' ? true :
                valorFilter === 'premium' ? v.valor > 30000 :
                valorFilter === 'media' ? (v.valor >= 5000 && v.valor <= 30000) :
                v.valor < 5000;

            return matchSearch && matchInicio && matchFim && matchValor;
        });
    }, [vendas, search, dataInicio, dataFim, valorFilter]);

    // Faturamento total do filtro atual
    const totalFiltrado = useMemo(() =>
        filteredTransacoes.reduce((acc, v) => acc + v.valor, 0), [filteredTransacoes]);

    // Estatísticas das faixas financeiras baseadas no lote de vendas atual (para os cards clicáveis)
    const statsFaixas = useMemo(() => {
        let total = 0;
        let countTotal = 0;
        let premium = 0;
        let countPremium = 0;
        let media = 0;
        let countMedia = 0;
        let varejo = 0;
        let countVarejo = 0;

        vendas.forEach(v => {
            total += v.valor;
            countTotal++;
            if (v.valor > 30000) {
                premium += v.valor;
                countPremium++;
            } else if (v.valor >= 5000) {
                media += v.valor;
                countMedia++;
            } else {
                varejo += v.valor;
                countVarejo++;
            }
        });

        return {
            total, countTotal,
            premium, countPremium,
            media, countMedia,
            varejo, countVarejo
        };
    }, [vendas]);

    // Processamento do Predict Comercial com base no histórico completo
    const clientesPredict = useMemo(() => {
        if (historicoVendas.length === 0) return [];

        // Agrupar transações por cliente
        const grupos: Record<string, Venda[]> = {};
        historicoVendas.forEach(v => {
            if (!grupos[v.cliente]) grupos[v.cliente] = [];
            grupos[v.cliente].push(v);
        });

        // Ponto de referência inteligente
        const maxData = historicoVendas.reduce((max, v) => v.data > max ? v.data : max, '');
        // Se a data máxima for recente (sistema atual), usa 'hoje', se for histórica de 2024, usa a data máxima
        const dataReferenciaStr = maxData && new Date(maxData) > new Date('2025-01-01') 
            ? new Date().toISOString().split('T')[0] 
            : maxData;

        return Object.entries(grupos).map(([clienteNome, compras]) => {
            const totalComprado = compras.reduce((acc, v) => acc + v.valor, 0);
            
            // Datas distintas de compra
            const datasDistintas = Array.from(new Set(compras.map(v => v.data))).sort();
            const totalPedidos = datasDistintas.length;
            const ultimaCompraDate = datasDistintas[datasDistintas.length - 1];

            // Intervalo médio em dias
            let intervaloMedioDias = 0;
            if (totalPedidos > 1) {
                const diffs = [];
                for (let i = 1; i < datasDistintas.length; i++) {
                    diffs.push(diffInDays(datasDistintas[i], datasDistintas[i - 1]));
                }
                intervaloMedioDias = diffs.reduce((a, b) => a + b, 0) / diffs.length;
            }

            const intervaloMedioMeses = intervaloMedioDias > 0 ? (intervaloMedioDias / 30.4) : 0;
            const diasInatividade = diffInDays(dataReferenciaStr, ultimaCompraDate);

            // Previsão de próxima compra
            let proximaCompraEstimada = '';
            if (intervaloMedioDias > 0) {
                proximaCompraEstimada = addDays(ultimaCompraDate, intervaloMedioDias);
            }

            // Atribuição de Marcadores de Inatividade
            let statusInatividade: ClientePredict['statusInatividade'] = 'ativo';
            // Se inativo por tempo suficiente ou ciclo médio estendido
            if (diasInatividade > 730) {
                statusInatividade = '2a+';
            } else if (diasInatividade > 365) {
                statusInatividade = '1a';
            } else if (diasInatividade > 270) {
                statusInatividade = '9m';
            } else if (diasInatividade > 180) {
                statusInatividade = '6m';
            } else if (diasInatividade > 90) {
                statusInatividade = '3m';
            } else if (intervaloMedioDias > 0 && diasInatividade > (intervaloMedioDias * 1.2)) {
                // Se passou 20% do prazo esperado de re-compra, marca como inativo leve (3 meses ou ativo a depender)
                statusInatividade = diasInatividade > 60 ? '3m' : 'ativo';
            }

            return {
                nome: clienteNome,
                totalComprado,
                totalPedidos,
                intervaloMedioMeses,
                diasInatividade,
                ultimaCompraDate,
                proximaCompraEstimada,
                statusInatividade
            };
        });
    }, [historicoVendas]);

    // Filtragem dos clientes na aba Predict
    const filteredPredict = useMemo(() => {
        const q = searchPredict.toLowerCase();
        return clientesPredict.filter(c => {
            const matchSearch = !q || c.nome.toLowerCase().includes(q);
            const matchStatus = filtroInatividade === 'all' || c.statusInatividade === filtroInatividade;
            return matchSearch && matchStatus;
        });
    }, [clientesPredict, searchPredict, filtroInatividade]);

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-[#C01717] border-t-transparent rounded-full animate-spin" />
        </div>
    );

    if (error) return (
        <div className="card-premium border-rose-500/30 text-center py-12">
            <p className="text-rose-400 font-medium">{error}</p>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                        Vendas
                        <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
                    </h1>
                    <p className="text-slate-500 text-sm mt-1 font-medium">Painel inteligente de faturamento e comportamento comercial.</p>
                </div>

                {/* Abas Premium */}
                <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 max-w-fit">
                    <button
                        onClick={() => setActiveTab('transacoes')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                            activeTab === 'transacoes'
                                ? 'bg-[#C01717] text-white shadow-lg'
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        Transações
                    </button>
                    <button
                        onClick={() => setActiveTab('predict')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                            activeTab === 'predict'
                                ? 'bg-[#C01717] text-white shadow-lg'
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <span>Predict Comercial</span>
                        <span className="bg-white/25 px-1 py-0.5 rounded text-[8px] font-extrabold uppercase animate-pulse">NOVO</span>
                    </button>
                </div>
            </div>

            {/* TAB 1: TRANSAÇÕES */}
            {activeTab === 'transacoes' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                    
                    {/* Cards interativos que funcionam como filtros de faixa de valor */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Faturamento Geral */}
                        <div 
                            onClick={() => setValorFilter('all')}
                            className={`card-premium cursor-pointer py-4 px-5 transition-all border-l-4 ${
                                valorFilter === 'all' 
                                    ? 'bg-white/10 border-slate-400 shadow-xl' 
                                    : 'border-transparent hover:bg-white/5'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Faturamento Total</span>
                                <Filter className={`w-3.5 h-3.5 ${valorFilter === 'all' ? 'text-white' : 'text-slate-600'}`} />
                            </div>
                            <p className="text-xl font-black text-white">{formatCurrency(totalFiltrado)}</p>
                            <p className="text-xs text-slate-500 mt-1 font-medium">{filteredTransacoes.length} transações filtradas</p>
                        </div>

                        {/* Vendas Premium (> 30k) */}
                        <div 
                            onClick={() => setValorFilter(valorFilter === 'premium' ? 'all' : 'premium')}
                            className={`card-premium cursor-pointer py-4 px-5 transition-all border-l-4 ${
                                valorFilter === 'premium' 
                                    ? 'bg-emerald-500/10 border-emerald-500 shadow-lg shadow-emerald-500/5' 
                                    : 'border-transparent hover:bg-white/5'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Premium (&gt; R$ 30K)</span>
                                <TrendingUp className={`w-3.5 h-3.5 ${valorFilter === 'premium' ? 'text-emerald-400' : 'text-slate-600'}`} />
                            </div>
                            <p className="text-xl font-black text-emerald-400">{formatCurrency(statsFaixas.premium)}</p>
                            <p className="text-xs text-slate-500 mt-1 font-medium">{statsFaixas.countPremium} vendas de grande porte</p>
                        </div>

                        {/* Vendas Médias (5k - 30k) */}
                        <div 
                            onClick={() => setValorFilter(valorFilter === 'media' ? 'all' : 'media')}
                            className={`card-premium cursor-pointer py-4 px-5 transition-all border-l-4 ${
                                valorFilter === 'media' 
                                    ? 'bg-amber-500/10 border-amber-500 shadow-lg shadow-amber-500/5' 
                                    : 'border-transparent hover:bg-white/5'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Médias (R$ 5K - R$ 30K)</span>
                                <Clock className={`w-3.5 h-3.5 ${valorFilter === 'media' ? 'text-amber-400' : 'text-slate-600'}`} />
                            </div>
                            <p className="text-xl font-black text-amber-400">{formatCurrency(statsFaixas.media)}</p>
                            <p className="text-xs text-slate-500 mt-1 font-medium">{statsFaixas.countMedia} vendas recorrentes</p>
                        </div>

                        {/* Vendas Recorrentes / Varejo (< 5k) */}
                        <div 
                            onClick={() => setValorFilter(valorFilter === 'varejo' ? 'all' : 'varejo')}
                            className={`card-premium cursor-pointer py-4 px-5 transition-all border-l-4 ${
                                valorFilter === 'varejo' 
                                    ? 'bg-rose-500/10 border-rose-500 shadow-lg shadow-rose-500/5' 
                                    : 'border-transparent hover:bg-white/5'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Varejo (&lt; R$ 5K)</span>
                                <UserCheck className={`w-3.5 h-3.5 ${valorFilter === 'varejo' ? 'text-rose-400' : 'text-slate-600'}`} />
                            </div>
                            <p className="text-xl font-black text-rose-400">{formatCurrency(statsFaixas.varejo)}</p>
                            <p className="text-xs text-slate-500 mt-1 font-medium">{statsFaixas.countVarejo} transações fracionadas</p>
                        </div>
                    </div>

                    {/* Destaques e Atalhos Rápidos (Seção com click rápido para facilitar a filtragem) */}
                    <div className="card-premium py-3.5 px-5 bg-white/5 border-white/10 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest bg-white/5 px-2.5 py-1 rounded-md border border-white/5">Atalhos Dinâmicos:</span>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => aplicarFiltroDestaque('GERAL PARTS', true)}
                                    className="px-2.5 py-1 text-[10px] font-bold text-amber-300 hover:text-white bg-amber-500/10 hover:bg-amber-500/30 border border-amber-500/20 rounded transition-all cursor-pointer flex items-center gap-1"
                                    title="Filtrar GERAL PARTS em Janeiro/2024"
                                >
                                    <span>Geral Parts (Jan/2024)</span>
                                </button>
                                {clientesDestaque.map(c => (
                                    <button
                                        key={c.nome}
                                        onClick={() => aplicarFiltroDestaque(c.nome, false)}
                                        className="px-2.5 py-1 text-[10px] font-bold text-slate-300 hover:text-white bg-white/5 hover:bg-white/15 border border-white/10 rounded transition-all cursor-pointer truncate max-w-[150px]"
                                        title={`Filtrar vendas de ${c.nome}`}
                                    >
                                        {c.nome.split(' ')[0]}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Atalhos Rápidos de Calendário */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => { setDataInicio('2024-01-01'); setDataFim('2024-12-31'); }}
                                className="px-2.5 py-1 text-[10px] font-bold text-slate-400 hover:text-white bg-black/30 hover:bg-white/5 rounded border border-white/5 transition-all cursor-pointer"
                            >
                                Ano 2024
                            </button>
                            <button
                                onClick={() => { setDataInicio('2024-01-01'); setDataFim('2024-01-31'); }}
                                className="px-2.5 py-1 text-[10px] font-bold text-slate-400 hover:text-white bg-black/30 hover:bg-white/5 rounded border border-white/5 transition-all cursor-pointer"
                            >
                                Janeiro 2024
                            </button>
                        </div>
                    </div>

                    {/* Filtros */}
                    <div className="flex flex-wrap gap-3">
                        <div className="relative flex-1 min-w-[160px] max-w-sm group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-[#e05050] transition-colors" />
                            <input
                                className="input pl-9"
                                placeholder="Buscar por cliente ou código..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 backdrop-blur-md">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-slate-500" />
                                <input
                                    type="date"
                                    className="bg-transparent border-none text-slate-200 text-sm focus:outline-none focus:ring-0 w-auto"
                                    value={dataInicio}
                                    onChange={e => setDataInicio(e.target.value)}
                                />
                            </div>
                            <span className="text-slate-600 text-xs font-bold uppercase">até</span>
                            <input
                                type="date"
                                className="bg-transparent border-none text-slate-200 text-sm focus:outline-none focus:ring-0 w-auto"
                                value={dataFim}
                                onChange={e => setDataFim(e.target.value)}
                            />
                        </div>
                        {(search || dataInicio || dataFim || valorFilter !== 'all') && (
                            <button
                                className="bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                                onClick={() => { setSearch(''); setDataInicio(''); setDataFim(''); setValorFilter('all'); }}
                            >
                                Limpar filtros
                            </button>
                        )}
                    </div>

                    {/* Tabela de Transações */}
                    <div className="card-premium p-0 overflow-hidden shadow-2xl border border-white/10">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-white/5 border-b border-white/10 text-slate-500">
                                    <tr>
                                        <th className="text-left text-[10px] font-bold uppercase tracking-wider px-6 py-4">Data</th>
                                        <th className="text-left text-[10px] font-bold uppercase tracking-wider px-4 py-4">Cliente</th>
                                        <th className="text-left text-[10px] font-bold uppercase tracking-wider px-4 py-4">Código</th>
                                        <th className="text-right text-[10px] font-bold uppercase tracking-wider px-4 py-4">Qtd</th>
                                        <th className="text-right text-[10px] font-bold uppercase tracking-wider px-6 py-4">Valor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {filteredTransacoes.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-medium">Nenhum registro encontrado para a combinação de filtros.</td>
                                        </tr>
                                    ) : (
                                        filteredTransacoes.slice(0, 500).map((v, i) => (
                                            <tr key={i} className="hover:bg-white/5 transition-colors group">
                                                <td className="px-6 py-4 text-slate-400 whitespace-nowrap">{formatDate(v.data)}</td>
                                                <td className="px-4 py-4 text-white font-medium max-w-[280px] truncate group-hover:text-[#f87171] transition-colors">{v.cliente}</td>
                                                <td className="px-4 py-4 text-slate-500 font-mono text-xs tracking-tighter">{v.codigo}</td>
                                                <td className="px-4 py-4 text-right text-slate-400">{v.quantidade}</td>
                                                <td className="px-6 py-4 text-right text-emerald-400 font-bold whitespace-nowrap">{formatCurrency(v.valor)}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                            {filteredTransacoes.length > 500 && (
                                <div className="px-6 py-4 text-center text-[10px] font-bold text-slate-600 border-t border-white/5 uppercase tracking-[0.2em] bg-white/5">
                                    Exibindo 500 de {filteredTransacoes.length.toLocaleString('pt-BR')} registros. Refine os filtros para ver mais.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: PREDICT COMERCIAL */}
            {activeTab === 'predict' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                    
                    {/* Filtros da aba de Predição */}
                    <div className="flex flex-wrap gap-3 items-center justify-between">
                        <div className="relative flex-1 min-w-[200px] max-w-sm group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-[#e05050] transition-colors" />
                            <input
                                className="input pl-9"
                                placeholder="Buscar cliente no predict..."
                                value={searchPredict}
                                onChange={e => setSearchPredict(e.target.value)}
                            />
                        </div>

                        {/* Segmentação Comercial (Marcadores) */}
                        <div className="flex flex-wrap gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
                            {([
                                { id: 'all', label: 'Todos' },
                                { id: 'ativo', label: 'Ciclo Ativo' },
                                { id: '3m', label: '+3 Meses' },
                                { id: '6m', label: '+6 Meses' },
                                { id: '9m', label: '+9 Meses' },
                                { id: '1a', label: '+1 Ano' },
                                { id: '2a+', label: '+2 Anos' }
                            ] as const).map(opt => (
                                <button
                                    key={opt.id}
                                    onClick={() => setFiltroInatividade(opt.id)}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                                        filtroInatividade === opt.id
                                            ? 'bg-white/15 text-white'
                                            : 'text-slate-500 hover:text-slate-300'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {loadingPredict ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <div className="w-8 h-8 border-2 border-[#C01717] border-t-transparent rounded-full animate-spin" />
                            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Calculando Ciclos & Predições Comerciais...</p>
                        </div>
                    ) : (
                        <div className="card-premium p-0 overflow-hidden shadow-2xl border border-white/10">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-white/5 border-b border-white/10 text-slate-500">
                                        <tr>
                                            <th className="text-left text-[10px] font-bold uppercase tracking-wider px-6 py-4">Cliente</th>
                                            <th className="text-center text-[10px] font-bold uppercase tracking-wider px-4 py-4">Status de Inatividade</th>
                                            <th className="text-right text-[10px] font-bold uppercase tracking-wider px-4 py-4">Frequência Média</th>
                                            <th className="text-right text-[10px] font-bold uppercase tracking-wider px-4 py-4">Volume Médio / Compra</th>
                                            <th className="text-center text-[10px] font-bold uppercase tracking-wider px-4 py-4">Última Compra</th>
                                            <th className="text-center text-[10px] font-bold uppercase tracking-wider px-4 py-4">Próxima Prevista</th>
                                            <th className="text-right text-[10px] font-bold uppercase tracking-wider px-6 py-4">Ação</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {filteredPredict.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="px-6 py-12 text-center text-slate-500 font-medium">Nenhum cliente atende a estes filtros de predição.</td>
                                            </tr>
                                        ) : (
                                            filteredPredict.map((c, i) => {
                                                // Badges estilizados baseados na inatividade
                                                const getBadge = (status: ClientePredict['statusInatividade']) => {
                                                    switch (status) {
                                                        case 'ativo':
                                                            return (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                                                                    <UserCheck className="w-3 h-3" />
                                                                    No Prazo
                                                                </span>
                                                            );
                                                        case '3m':
                                                            return (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-yellow-500/10 text-yellow-400 border border-yellow-500/25 animate-pulse-slow">
                                                                    <Clock className="w-3 h-3" />
                                                                    +3 Meses Inativo
                                                                </span>
                                                            );
                                                        case '6m':
                                                            return (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-orange-500/10 text-orange-400 border border-orange-500/25 animate-pulse-slow">
                                                                    <Clock className="w-3 h-3" />
                                                                    +6 Meses Inativo
                                                                </span>
                                                            );
                                                        case '9m':
                                                            return (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-[#e05050]/10 text-[#f87171] border border-[#e05050]/25">
                                                                    <Clock className="w-3 h-3" />
                                                                    +9 Meses Inativo
                                                                </span>
                                                            );
                                                        case '1a':
                                                            return (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-red-600/15 text-red-400 border border-red-500/25">
                                                                    <AlertTriangle className="w-3 h-3" />
                                                                    +1 Ano Inativo
                                                                </span>
                                                            );
                                                        case '2a+':
                                                            return (
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-rose-950/20 text-rose-500 border border-rose-500/25">
                                                                    <AlertTriangle className="w-3 h-3" />
                                                                    +2 Anos Churn
                                                                </span>
                                                            );
                                                    }
                                                };

                                                return (
                                                    <tr key={i} className="hover:bg-white/5 transition-colors group">
                                                        {/* Nome do cliente */}
                                                        <td className="px-6 py-4 font-bold text-white max-w-[240px] truncate group-hover:text-[#f87171] transition-colors">{c.nome}</td>
                                                        
                                                        {/* Badge de inatividade */}
                                                        <td className="px-4 py-4 text-center whitespace-nowrap">{getBadge(c.statusInatividade)}</td>
                                                        
                                                        {/* Frequência Média em Meses */}
                                                        <td className="px-4 py-4 text-right text-slate-300 font-medium">
                                                            {c.intervaloMedioMeses > 0 ? (
                                                                <span>de {c.intervaloMedioMeses.toFixed(1)} em {c.intervaloMedioMeses.toFixed(1)} meses</span>
                                                            ) : (
                                                                <span className="text-slate-500 text-xs italic">Compra única</span>
                                                            )}
                                                        </td>
                                                        
                                                        {/* Volume Médio por Compra */}
                                                        <td className="px-4 py-4 text-right text-emerald-400 font-bold">
                                                            {formatCurrency(c.totalComprado / c.totalPedidos)}
                                                        </td>
                                                        
                                                        {/* Data da Última Compra */}
                                                        <td className="px-4 py-4 text-center text-slate-400 whitespace-nowrap">{formatDate(c.ultimaCompraDate)}</td>
                                                        
                                                        {/* Data Prevista de Re-compra */}
                                                        <td className="px-4 py-4 text-center whitespace-nowrap">
                                                            {c.proximaCompraEstimada ? (
                                                                <span className={c.diasInatividade > (c.intervaloMedioMeses * 30.4) ? "text-rose-400/80 font-bold" : "text-emerald-400/80 font-bold"}>
                                                                    {formatDate(c.proximaCompraEstimada)}
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-600 text-xs italic">—</span>
                                                            )}
                                                        </td>
                                                        
                                                        {/* Ação: link inteligente para clientes tab=itens */}
                                                        <td className="px-6 py-4 text-right whitespace-nowrap">
                                                            <Link
                                                                to={`/clientes?cliente=${encodeURIComponent(c.nome)}&tab=itens`}
                                                                className="inline-flex items-center gap-1 bg-[#C01717]/10 hover:bg-[#C01717] text-[#f87171] hover:text-white border border-[#C01717]/25 hover:border-transparent rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                                                            >
                                                                <span>Oportunidades</span>
                                                                <ArrowRight className="w-3.5 h-3.5" />
                                                            </Link>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
