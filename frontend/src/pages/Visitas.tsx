import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { api, Visita, formatCurrency, formatDate, Filters } from '../lib/api';

export default function Visitas() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [visitas, setVisitas] = useState<Visita[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [filtroRep, setFiltroRep] = useState('');
    const [filtroTipo, setFiltroTipo] = useState('');

    const filters: Filters = {
        ano: searchParams.get('ano') || String(new Date().getFullYear()),
        mes: searchParams.get('mes') || undefined,
        linha: searchParams.get('linha') || undefined,
    };

    useEffect(() => {
        setLoading(true);
        api.getVisitas(filters)
            .then(setVisitas)
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [searchParams]);

    const representantes = useMemo(() => {
        const set = new Set(visitas.map(v => v.representante).filter(Boolean));
        return Array.from(set).sort();
    }, [visitas]);

    const tipos = useMemo(() => {
        const set = new Set(visitas.map(v => v.tipoVisita).filter(Boolean));
        return Array.from(set).sort();
    }, [visitas]);

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return visitas.filter(v => {
            const matchSearch = !q || v.cliente.toLowerCase().includes(q) || v.representante.toLowerCase().includes(q);
            const matchRep = !filtroRep || v.representante === filtroRep;
            const matchTipo = !filtroTipo || v.tipoVisita === filtroTipo;
            return matchSearch && matchRep && matchTipo;
        });
    }, [visitas, search, filtroRep, filtroTipo]);

    const custoTotal = useMemo(() => filtered.reduce((acc, v) => acc + v.custo, 0), [filtered]);

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
                    <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Visitas Técnicas</h1>
                    <p className="text-slate-500 text-sm mt-1 font-medium">{visitas.length.toLocaleString('pt-BR')} visitas registradas</p>
                </div>
                <div className="flex gap-3">
                    <div className="card-premium py-2 sm:py-3 px-4 sm:px-5 border-amber-500/20 shadow-amber-500/5">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Custo Filtrado</p>
                        <p className="text-base sm:text-lg font-bold text-amber-400">{formatCurrency(custoTotal)}</p>
                    </div>
                    <div className="card-premium py-2 sm:py-3 px-4 sm:px-5 border-brand-500/20 shadow-brand-500/5">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Visitas</p>
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
                        placeholder="Buscar cliente ou representante..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <select
                    className="input max-w-[200px] cursor-pointer"
                    value={filtroRep}
                    onChange={e => setFiltroRep(e.target.value)}
                >
                    <option value="" className="bg-slate-900">Todos os representantes</option>
                    {representantes.map(r => <option key={r} value={r} className="bg-slate-900">{r}</option>)}
                </select>
                <select
                    className="input max-w-[180px] cursor-pointer"
                    value={filtroTipo}
                    onChange={e => setFiltroTipo(e.target.value)}
                >
                    <option value="" className="bg-slate-900">Todos os tipos</option>
                    {tipos.map(t => <option key={t} value={t} className="bg-slate-900">{t}</option>)}
                </select>
            </div>

            {/* Tabela */}
            <div className="card-premium p-0 overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-white/5 border-b border-white/10 text-slate-500">
                            <tr>
                                <th className="text-left text-[10px] font-bold uppercase tracking-wider px-6 py-4">Data</th>
                                <th className="text-left text-[10px] font-bold uppercase tracking-wider px-4 py-4">Tipo</th>
                                <th className="text-left text-[10px] font-bold uppercase tracking-wider px-4 py-4">Representante</th>
                                <th className="text-left text-[10px] font-bold uppercase tracking-wider px-4 py-4">Cliente</th>
                                <th className="text-right text-[10px] font-bold uppercase tracking-wider px-6 py-4">Custo</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filtered.slice(0, 300).map((v, i) => (
                                <tr key={i} className="hover:bg-white/5 transition-colors group">
                                    <td className="px-6 py-4 text-slate-400 whitespace-nowrap">{formatDate(v.data)}</td>
                                    <td className="px-4 py-4">
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border bg-brand-500/10 text-brand-400 border-brand-500/20">{v.tipoVisita || '—'}</span>
                                    </td>
                                    <td className="px-4 py-4 text-white font-medium group-hover:text-brand-300 transition-colors">{v.representante || '—'}</td>
                                    <td className="px-4 py-4 max-w-[200px]">
                                        {v.cliente
                                            ? <button onClick={() => navigate(`/clientes?cliente=${encodeURIComponent(v.cliente)}`)} className="text-slate-400 hover:text-brand-400 transition-colors text-left truncate w-full font-medium cursor-pointer underline-offset-2 hover:underline">{v.cliente}</button>
                                            : <span className="text-slate-600">—</span>}
                                    </td>
                                    <td className="px-6 py-4 text-right text-amber-400 font-bold whitespace-nowrap">
                                        {v.custo > 0 ? formatCurrency(v.custo) : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filtered.length > 300 && (
                        <div className="px-6 py-4 text-center text-[10px] font-bold text-slate-600 border-t border-white/5 uppercase tracking-[0.2em] bg-white/5">
                            Exibindo 300 de {filtered.length.toLocaleString('pt-BR')} registros técnicos.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
