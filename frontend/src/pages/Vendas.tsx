import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Calendar } from 'lucide-react';
import { api, Venda, formatCurrency, formatDate, Filters } from '../lib/api';

export default function Vendas() {
    const [searchParams] = useSearchParams();
    const [vendas, setVendas] = useState<Venda[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');

    const filters: Filters = {
        ano: searchParams.get('ano') || '2024',
        mes: searchParams.get('mes') || undefined,
    };

    useEffect(() => {
        setLoading(true);
        api.getVendas(filters)
            .then(setVendas)
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [searchParams]);

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return vendas.filter(v => {
            const matchSearch = !q || v.cliente.toLowerCase().includes(q) || v.codigo.toLowerCase().includes(q);
            const matchInicio = !dataInicio || v.data >= dataInicio;
            const matchFim = !dataFim || v.data <= dataFim;
            return matchSearch && matchInicio && matchFim;
        });
    }, [vendas, search, dataInicio, dataFim]);

    const totalFiltrado = useMemo(() =>
        filtered.reduce((acc, v) => acc + v.valor, 0), [filtered]);

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    if (error) return (
        <div className="card border-rose-500/30 text-center py-12">
            <p className="text-rose-400">{error}</p>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Vendas</h1>
                    <p className="text-slate-500 text-sm mt-1 font-medium">{vendas.length.toLocaleString('pt-BR')} registros no total</p>
                </div>
                <div className="flex gap-3">
                    <div className="card-premium py-2 sm:py-3 px-4 sm:px-5 border-emerald-500/20 shadow-emerald-500/5">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Filtrado</p>
                        <p className="text-base sm:text-lg font-bold text-emerald-400">{formatCurrency(totalFiltrado)}</p>
                    </div>
                    <div className="card-premium py-2 sm:py-3 px-4 sm:px-5 border-brand-500/20 shadow-brand-500/5">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Registros</p>
                        <p className="text-base sm:text-lg font-bold text-brand-400">{filtered.length.toLocaleString('pt-BR')}</p>
                    </div>
                </div>
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[160px] max-w-sm group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-brand-400 transition-colors" />
                    <input
                        className="input pl-9"
                        placeholder="Buscar cliente ou código..."
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
                {(search || dataInicio || dataFim) && (
                    <button
                        className="bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                        onClick={() => { setSearch(''); setDataInicio(''); setDataFim(''); }}
                    >
                        Limpar filtros
                    </button>
                )}
            </div>

            {/* Tabela */}
            <div className="card-premium p-0 overflow-hidden shadow-2xl">
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
                            {filtered.slice(0, 500).map((v, i) => (
                                <tr key={i} className="hover:bg-white/5 transition-colors group">
                                    <td className="px-6 py-4 text-slate-400 whitespace-nowrap">{formatDate(v.data)}</td>
                                    <td className="px-4 py-4 text-white font-medium max-w-[220px] truncate group-hover:text-brand-300 transition-colors">{v.cliente}</td>
                                    <td className="px-4 py-4 text-slate-500 font-mono text-xs tracking-tighter">{v.codigo}</td>
                                    <td className="px-4 py-4 text-right text-slate-400">{v.quantidade}</td>
                                    <td className="px-6 py-4 text-right text-emerald-400 font-bold whitespace-nowrap">{formatCurrency(v.valor)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filtered.length > 500 && (
                        <div className="px-6 py-4 text-center text-[10px] font-bold text-slate-600 border-t border-white/5 uppercase tracking-[0.2em] bg-white/5">
                            Exibindo 500 de {filtered.length.toLocaleString('pt-BR')} registros. Refine a busca para ver mais.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
