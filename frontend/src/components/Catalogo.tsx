import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Lock, ChevronRight, Package, AlertCircle } from 'lucide-react';
import { supabase, catalogoConfigured, type CatalogoProduto } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Filters {
    cod: string;
    montadora: string;
    veiculo: string;
    motor: string;
    grupo: string;
}

const EMPTY_FILTERS: Filters = { cod: '', montadora: '', veiculo: '', motor: '', grupo: '' };

export default function Catalogo() {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
    const [results, setResults] = useState<CatalogoProduto[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [montadoras, setMontadoras] = useState<string[]>([]);
    const [grupos, setGrupos] = useState<string[]>([]);
    const [optionsLoaded, setOptionsLoaded] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!catalogoConfigured) return;
        async function loadOptions() {
            const [m, g] = await Promise.all([
                supabase.from('catalogo_produtos').select('montadora').not('montadora', 'is', null),
                supabase.from('catalogo_produtos').select('grupo').not('grupo', 'is', null),
            ]);
            const uniq = (arr: string[]) => [...new Set(arr)].sort();
            setMontadoras(uniq((m.data || []).map((r: any) => r.montadora).filter(Boolean)));
            setGrupos(uniq((g.data || []).map((r: any) => r.grupo).filter(Boolean)));
            setOptionsLoaded(true);
        }
        loadOptions();
    }, []);

    async function handleSearch(e: FormEvent) {
        e.preventDefault();
        const hasFilter = Object.values(filters).some(v => v.trim() !== '');
        if (!hasFilter) return;

        setLoading(true);
        setError('');
        try {
            let query = supabase
                .from('catalogo_produtos')
                .select('*')
                .order('cod')
                .limit(100);

            if (filters.cod.trim())       query = query.ilike('cod', `%${filters.cod.trim()}%`);
            if (filters.montadora)        query = query.eq('montadora', filters.montadora);
            if (filters.veiculo.trim())   query = query.ilike('veiculo', `%${filters.veiculo.trim()}%`);
            if (filters.motor.trim())     query = query.ilike('motor', `%${filters.motor.trim()}%`);
            if (filters.grupo)            query = query.eq('grupo', filters.grupo);

            const { data, error: err } = await query;
            if (err) throw err;
            setResults(data || []);
        } catch {
            setError('Erro ao consultar catálogo. Verifique sua conexão.');
        } finally {
            setLoading(false);
            setSearched(true);
        }
    }

    function handleClear() {
        setFilters(EMPTY_FILTERS);
        setResults([]);
        setSearched(false);
        setError('');
    }

    const setField = (k: keyof Filters, v: string) =>
        setFilters(prev => ({ ...prev, [k]: v }));

    return (
        <div className="min-h-screen bg-pbi-bg text-pbi-text flex flex-col">
            {/* Background glow */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-[15%] -left-[10%] w-[45%] h-[45%] bg-red-700/8 blur-[140px] rounded-full" />
                <div className="absolute top-[30%] -right-[5%] w-[30%] h-[30%] bg-brand-500/8 blur-[120px] rounded-full" />
            </div>

            {/* Header */}
            <header className="glass-header border-b border-white/8 flex items-center justify-between px-4 sm:px-8 py-3 z-10 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <img
                        src="/logo-kalled.png"
                        alt="Kalled Pistões"
                        className="h-9 sm:h-11 object-contain"
                        onError={e => {
                            e.currentTarget.style.display = 'none';
                            const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
                            if (fb) fb.style.display = 'flex';
                        }}
                    />
                    {/* Fallback text logo */}
                    <div className="hidden items-center gap-1.5">
                        <span className="text-2xl font-black text-red-500 italic leading-none">K</span>
                        <div className="leading-tight">
                            <p className="text-sm font-black tracking-widest text-white uppercase">Kalled</p>
                            <p className="text-[9px] font-semibold tracking-[0.3em] text-slate-400 uppercase">Pistões</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {user && (
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="hidden sm:flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 font-medium transition-colors"
                        >
                            Dashboard
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    )}
                    <button
                        onClick={() => navigate('/login')}
                        className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg transition-all"
                    >
                        <Lock className="w-3 h-3" />
                        <span className="hidden sm:inline">Área Restrita</span>
                    </button>
                </div>
            </header>

            {/* Content */}
            <div className="flex-1 flex flex-col z-10">
                <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-6">
                    <div className="text-center mb-8">
                        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-2">
                            Consulta de Catálogo
                        </h1>
                        <p className="text-slate-400 text-sm">
                            Encontre o produto certo para o seu veículo
                        </p>
                    </div>

                    {/* Search Card */}
                    <div className="card">
                        {!catalogoConfigured && (
                            <div className="flex items-center gap-2 text-amber-400 text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-4">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                Catálogo não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.
                            </div>
                        )}

                        <form onSubmit={handleSearch}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                        Código do Produto
                                    </label>
                                    <input
                                        type="text"
                                        value={filters.cod}
                                        onChange={e => setField('cod', e.target.value)}
                                        placeholder="Ex: P2000"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:ring-1 focus:ring-red-500/50 focus:border-red-500/30 transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                        Montadora
                                    </label>
                                    <select
                                        value={filters.montadora}
                                        onChange={e => setField('montadora', e.target.value)}
                                        disabled={catalogoConfigured && !optionsLoaded}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-red-500/50 focus:border-red-500/30 transition-all appearance-none cursor-pointer disabled:opacity-50"
                                    >
                                        <option value="" className="bg-slate-900">Todas</option>
                                        {montadoras.map(m => (
                                            <option key={m} value={m} className="bg-slate-900">{m}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                        Veículo / Modelo
                                    </label>
                                    <input
                                        type="text"
                                        value={filters.veiculo}
                                        onChange={e => setField('veiculo', e.target.value)}
                                        placeholder="Ex: Gol, Palio, Uno..."
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:ring-1 focus:ring-red-500/50 focus:border-red-500/30 transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                        Motor
                                    </label>
                                    <input
                                        type="text"
                                        value={filters.motor}
                                        onChange={e => setField('motor', e.target.value)}
                                        placeholder="Ex: 1.0 8V, EA111..."
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:ring-1 focus:ring-red-500/50 focus:border-red-500/30 transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                        Grupo / Tipo
                                    </label>
                                    <select
                                        value={filters.grupo}
                                        onChange={e => setField('grupo', e.target.value)}
                                        disabled={catalogoConfigured && !optionsLoaded}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-red-500/50 focus:border-red-500/30 transition-all appearance-none cursor-pointer disabled:opacity-50"
                                    >
                                        <option value="" className="bg-slate-900">Todos</option>
                                        {grupos.map(g => (
                                            <option key={g} value={g} className="bg-slate-900">{g}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex items-end gap-2">
                                    <button
                                        type="submit"
                                        disabled={loading || !catalogoConfigured}
                                        className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 disabled:bg-red-600/40 text-white font-semibold py-2.5 rounded-xl text-sm transition-all active:scale-95"
                                    >
                                        <Search className="w-4 h-4" />
                                        {loading ? 'Pesquisando...' : 'Pesquisar'}
                                    </button>
                                    {searched && (
                                        <button
                                            type="button"
                                            onClick={handleClear}
                                            className="p-2.5 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
                                            title="Limpar"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Results */}
                <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 pb-10">
                    {error && (
                        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    {!searched && !loading && (
                        <div className="text-center py-16 text-slate-600">
                            <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p className="text-sm">Use os filtros acima para pesquisar no catálogo</p>
                        </div>
                    )}

                    {searched && !loading && results.length === 0 && (
                        <div className="text-center py-16">
                            <Search className="w-10 h-10 mx-auto mb-3 text-slate-600 opacity-30" />
                            <p className="text-sm font-medium text-slate-400">Nenhum produto encontrado</p>
                            <p className="text-xs text-slate-600 mt-1">Tente ajustar os filtros da pesquisa</p>
                        </div>
                    )}

                    {searched && results.length > 0 && (
                        <>
                            <p className="text-xs text-slate-500 mb-3">
                                {results.length} resultado{results.length !== 1 ? 's' : ''} encontrado{results.length !== 1 ? 's' : ''}
                                {results.length === 100 ? ' — mostrando os primeiros 100' : ''}
                            </p>

                            {/* Desktop Table */}
                            <div className="hidden sm:block card p-0 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b border-white/10">
                                                <th className="text-left px-4 py-3 font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Código</th>
                                                <th className="text-left px-4 py-3 font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">PA</th>
                                                <th className="text-left px-4 py-3 font-bold text-slate-400 uppercase tracking-wider">Descrição</th>
                                                <th className="text-left px-4 py-3 font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Grupo</th>
                                                <th className="text-left px-4 py-3 font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Montadora</th>
                                                <th className="text-left px-4 py-3 font-bold text-slate-400 uppercase tracking-wider">Veículo</th>
                                                <th className="text-left px-4 py-3 font-bold text-slate-400 uppercase tracking-wider">Motor</th>
                                                <th className="text-left px-4 py-3 font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Ano</th>
                                                <th className="text-left px-4 py-3 font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Sobremedida</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {results.map((p, i) => (
                                                <tr
                                                    key={p.id}
                                                    className={`border-b border-white/5 hover:bg-white/5 transition-colors ${i % 2 !== 0 ? 'bg-white/2' : ''}`}
                                                >
                                                    <td className="px-4 py-3 font-mono font-bold text-red-400 whitespace-nowrap">{p.cod}</td>
                                                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{p.pa ?? '—'}</td>
                                                    <td className="px-4 py-3 text-white">{p.descricao ?? '—'}</td>
                                                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{p.grupo ?? '—'}</td>
                                                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{p.montadora ?? '—'}</td>
                                                    <td className="px-4 py-3 text-slate-300 max-w-[140px]">{p.veiculo ?? '—'}</td>
                                                    <td className="px-4 py-3 text-slate-300 max-w-[180px]">{p.motor ?? '—'}</td>
                                                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{p.ano_aplicacao ?? '—'}</td>
                                                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{p.sobremedida ?? '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Mobile Cards */}
                            <div className="sm:hidden space-y-3">
                                {results.map(p => (
                                    <div key={p.id} className="card p-4">
                                        <div className="flex items-start justify-between gap-2 mb-3">
                                            <div>
                                                <span className="font-mono font-bold text-red-400 text-base">{p.cod}</span>
                                                {p.pa && <span className="ml-2 text-xs text-slate-500">{p.pa}</span>}
                                            </div>
                                            {p.grupo && (
                                                <span className="text-[10px] font-bold bg-white/10 text-slate-300 px-2 py-0.5 rounded-md whitespace-nowrap">
                                                    {p.grupo}
                                                </span>
                                            )}
                                        </div>
                                        {p.descricao && (
                                            <p className="text-sm font-medium text-white mb-3">{p.descricao}</p>
                                        )}
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                                            {p.montadora && (
                                                <div>
                                                    <span className="text-slate-500 uppercase tracking-wide text-[10px]">Montadora</span>
                                                    <p className="text-slate-300 font-medium mt-0.5">{p.montadora}</p>
                                                </div>
                                            )}
                                            {p.veiculo && (
                                                <div>
                                                    <span className="text-slate-500 uppercase tracking-wide text-[10px]">Veículo</span>
                                                    <p className="text-slate-300 font-medium mt-0.5">{p.veiculo}</p>
                                                </div>
                                            )}
                                            {p.motor && (
                                                <div className="col-span-2">
                                                    <span className="text-slate-500 uppercase tracking-wide text-[10px]">Motor</span>
                                                    <p className="text-slate-300 font-medium mt-0.5">{p.motor}</p>
                                                </div>
                                            )}
                                            {p.ano_aplicacao && (
                                                <div>
                                                    <span className="text-slate-500 uppercase tracking-wide text-[10px]">Ano</span>
                                                    <p className="text-slate-300 font-medium mt-0.5">{p.ano_aplicacao}</p>
                                                </div>
                                            )}
                                            {p.sobremedida && (
                                                <div>
                                                    <span className="text-slate-500 uppercase tracking-wide text-[10px]">Sobremedida</span>
                                                    <p className="text-slate-300 font-medium mt-0.5">{p.sobremedida}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Footer */}
            <footer className="border-t border-white/8 py-4 px-6 text-center z-10">
                <p className="text-[11px] text-slate-600">
                    © {new Date().getFullYear()} Kalled Pistões · Todos os direitos reservados
                </p>
            </footer>
        </div>
    );
}
