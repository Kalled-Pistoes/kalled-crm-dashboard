import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Lock, ChevronRight, Package, AlertCircle, Sun, Moon, Sparkles } from 'lucide-react';
import { supabase, catalogoConfigured, type CatalogoProduto } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Filters {
    cod: string;
    ref: string;
    montadora: string;
    veiculo: string;
    motor: string;
    grupo: string;
    lancamentos: boolean;
}

const EMPTY: Filters = { cod: '', ref: '', montadora: '', veiculo: '', motor: '', grupo: '', lancamentos: false };

function useTheme() {
    const [dark, setDark] = useState<boolean>(() => {
        const saved = localStorage.getItem('catalogo_theme');
        return saved ? saved === 'dark' : false;
    });
    const toggle = () => setDark((d: boolean) => {
        localStorage.setItem('catalogo_theme', !d ? 'dark' : 'light');
        return !d;
    });
    return { dark, toggle };
}

// ── Tokens de cor por tema ─────────────────────────────────────────────────
const t = {
    page:       (d: boolean) => d ? 'bg-[#18181b] text-[#f0f0f0]' : 'bg-[#f0f0f0] text-[#1a1a1a]',
    header:     (d: boolean) => d ? 'bg-[#1f1f23] border-[#333]' : 'bg-white border-[#d0d0d0]',
    card:       (d: boolean) => d ? 'bg-[#232328] border border-[#333] rounded-xl' : 'bg-white border border-[#d0d0d0] rounded-xl shadow-sm',
    label:      (d: boolean) => d ? 'text-[#a0a0a8] font-bold text-sm uppercase tracking-wider' : 'text-[#555] font-bold text-sm uppercase tracking-wider',
    input:      (d: boolean) => d
        ? 'bg-[#18181b] border-2 border-[#444] text-[#f0f0f0] placeholder-[#666] focus:border-[#C01717] focus:bg-[#1a1a1e]'
        : 'bg-white border-2 border-[#ccc] text-[#1a1a1a] placeholder-[#aaa] focus:border-[#C01717] focus:bg-white',
    thead:      (d: boolean) => d ? 'bg-[#2a2a30] text-[#b0b0b8]' : 'bg-[#2a2a2e] text-white',
    rowEven:    (d: boolean) => d ? 'bg-[#232328]' : 'bg-white',
    rowOdd:     (d: boolean) => d ? 'bg-[#1f1f24]' : 'bg-[#f8f8f8]',
    rowHover:   (d: boolean) => d ? 'hover:bg-[#2d2d35]' : 'hover:bg-[#ffeaea]',
    cell:       (d: boolean) => d ? 'text-[#d0d0d8] border-b border-[#2e2e34]' : 'text-[#333] border-b border-[#e8e8e8]',
    badge:      (d: boolean) => d
        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
        : 'bg-amber-50 text-amber-700 border border-amber-300',
    divider:    (d: boolean) => d ? 'border-[#333]' : 'border-[#d0d0d0]',
    muted:      (d: boolean) => d ? 'text-[#666]' : 'text-[#888]',
    cod:        (d: boolean) => d ? 'text-[#e05050] font-bold font-mono' : 'text-[#C01717] font-bold font-mono',
    toggleBg:   (d: boolean) => d ? 'bg-[#2a2a30] hover:bg-[#333] text-[#d0d0d8]' : 'bg-[#e8e8e8] hover:bg-[#ddd] text-[#555]',
};

export default function Catalogo() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { dark, toggle } = useTheme();

    const [filters, setFilters] = useState<Filters>(EMPTY);
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
        const hasFilter = filters.lancamentos || Object.entries(filters).some(([k, v]) => k !== 'lancamentos' && String(v).trim() !== '');
        if (!hasFilter) return;
        setLoading(true); setError('');
        try {
            let query = supabase.from('catalogo_produtos').select('*').order('cod').limit(200);
            if (filters.cod.trim())     query = query.ilike('cod', `%${filters.cod.trim()}%`);
            if (filters.ref.trim())     query = query.or(`ref_metal_leve_sulloy.ilike.%${filters.ref.trim()}%,ref_anel_kalled.ilike.%${filters.ref.trim()}%`);
            if (filters.montadora)      query = query.eq('montadora', filters.montadora);
            if (filters.veiculo.trim()) query = query.ilike('veiculo', `%${filters.veiculo.trim()}%`);
            if (filters.motor.trim())   query = query.ilike('motor', `%${filters.motor.trim()}%`);
            if (filters.grupo)          query = query.eq('grupo', filters.grupo);
            if (filters.lancamentos)    query = query.eq('lancamentos', true);
            const { data, error: err } = await query;
            if (err) throw err;
            setResults(data || []);
        } catch { setError('Erro ao consultar o catálogo. Verifique sua conexão.'); }
        finally { setLoading(false); setSearched(true); }
    }

    function handleClear() { setFilters(EMPTY); setResults([]); setSearched(false); setError(''); }
    const set = (k: keyof Filters, v: string) => setFilters((p: Filters) => ({ ...p, [k]: v }));

    // Shared input/select class
    const inputCls = `w-full rounded-lg px-4 py-3 text-base outline-none transition-all ${t.input(dark)}`;
    const selectBg = dark ? '#18181b' : '#ffffff';

    return (
        <div className={`min-h-screen flex flex-col ${t.page(dark)}`} style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

            {/* ── Header ───────────────────────────────────────────────── */}
            <header className={`border-b ${t.header(dark)} px-4 sm:px-8 py-3 flex items-center justify-between sticky top-0 z-20`}>
                <div className="flex items-center gap-4">
                    <img
                        src="/logo-kalled.png"
                        alt="Kalled Pistões"
                        className="h-10 sm:h-12 object-contain"
                        onError={e => {
                            e.currentTarget.style.display = 'none';
                            const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
                            if (fb) fb.style.removeProperty('display');
                        }}
                    />
                    <div className="hidden items-center gap-2">
                        <span className="text-3xl font-black text-[#C01717] italic">K</span>
                        <div>
                            <p className="text-base font-black tracking-widest uppercase leading-none">Kalled</p>
                            <p className="text-[10px] font-semibold tracking-[0.3em] opacity-50 uppercase">Pistões</p>
                        </div>
                    </div>
                    <div className={`hidden sm:block border-l pl-4 ${t.divider(dark)}`}>
                        <p className="text-xs font-semibold opacity-50 uppercase tracking-wider">Catálogo de Produtos</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                    {/* Modo claro/escuro */}
                    <button
                        onClick={toggle}
                        title={dark ? 'Modo Claro' : 'Modo Escuro'}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all border ${t.divider(dark)} ${t.toggleBg(dark)}`}
                    >
                        {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        <span className="hidden sm:inline">{dark ? 'Modo Claro' : 'Modo Escuro'}</span>
                    </button>

                    {user && (
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="hidden sm:flex items-center gap-1 text-sm font-semibold text-[#C01717] hover:opacity-80 transition-opacity"
                        >
                            Dashboard <ChevronRight className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        onClick={() => navigate('/login')}
                        className={`flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-lg border transition-all ${t.divider(dark)} ${t.toggleBg(dark)}`}
                    >
                        <Lock className="w-4 h-4" />
                        <span className="hidden sm:inline">Área Restrita</span>
                    </button>
                </div>
            </header>

            {/* ── Conteúdo ─────────────────────────────────────────────── */}
            <div className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 py-8">

                {/* Título */}
                <div className="mb-7">
                    <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-[#C01717]">
                        Consulta de Catálogo
                    </h1>
                    <p className={`mt-1 text-base ${t.muted(dark)}`}>
                        Encontre o produto certo para o seu veículo
                    </p>
                </div>

                {/* ── Painel de Filtros ─────────────────────────────────── */}
                <div className={`${t.card(dark)} p-6 mb-7`}>
                    {!catalogoConfigured && (
                        <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-5">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            Catálogo não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.
                        </div>
                    )}

                    <form onSubmit={handleSearch}>
                        {/* Linha 1 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-5">
                            <div>
                                <label className={`block mb-2 ${t.label(dark)}`}>Nº do Produto / Código</label>
                                <input
                                    type="text"
                                    value={filters.cod}
                                    onChange={e => set('cod', e.target.value)}
                                    placeholder="Ex: P2110"
                                    className={inputCls}
                                />
                            </div>
                            <div>
                                <label className={`block mb-2 ${t.label(dark)}`}>Código de Referência</label>
                                <input
                                    type="text"
                                    value={filters.ref}
                                    onChange={e => set('ref', e.target.value)}
                                    placeholder="Ex: ML1234, 123456..."
                                    className={inputCls}
                                />
                                <p className={`mt-1 text-xs ${t.muted(dark)}`}>Busca em todas as referências de concorrentes</p>
                            </div>
                            <div>
                                <label className={`block mb-2 ${t.label(dark)}`}>Montadora</label>
                                <select
                                    value={filters.montadora}
                                    onChange={e => set('montadora', e.target.value)}
                                    disabled={catalogoConfigured && !optionsLoaded}
                                    className={`${inputCls} cursor-pointer disabled:opacity-50`}
                                    style={{ backgroundColor: selectBg }}
                                >
                                    <option value="">Todas as Montadoras</option>
                                    {montadoras.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={`block mb-2 ${t.label(dark)}`}>Veículo / Modelo</label>
                                <input
                                    type="text"
                                    value={filters.veiculo}
                                    onChange={e => set('veiculo', e.target.value)}
                                    placeholder="Ex: Gol, Palio, Uno..."
                                    className={inputCls}
                                />
                            </div>
                        </div>

                        {/* Linha 2 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-6">
                            <div>
                                <label className={`block mb-2 ${t.label(dark)}`}>Motor</label>
                                <input
                                    type="text"
                                    value={filters.motor}
                                    onChange={e => set('motor', e.target.value)}
                                    placeholder="Ex: 1.0 8V, EA111..."
                                    className={inputCls}
                                />
                            </div>
                            <div>
                                <label className={`block mb-2 ${t.label(dark)}`}>Grupo / Tipo</label>
                                <select
                                    value={filters.grupo}
                                    onChange={e => set('grupo', e.target.value)}
                                    disabled={catalogoConfigured && !optionsLoaded}
                                    className={`${inputCls} cursor-pointer disabled:opacity-50`}
                                    style={{ backgroundColor: selectBg }}
                                >
                                    <option value="">Todos os Grupos</option>
                                    {grupos.map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                            </div>
                            {/* Toggle lançamentos */}
                            <div className="flex items-end pb-1">
                                <button
                                    type="button"
                                    onClick={() => setFilters(p => ({ ...p, lancamentos: !p.lancamentos }))}
                                    className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg border-2 text-base font-semibold transition-all ${
                                        filters.lancamentos
                                            ? 'border-amber-500 bg-amber-500/10 text-amber-600'
                                            : `border-2 ${dark ? 'border-[#444] text-[#888]' : 'border-[#ccc] text-[#888]'}`
                                    }`}
                                >
                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                        filters.lancamentos ? 'bg-amber-500 border-amber-500' : dark ? 'border-[#555]' : 'border-[#bbb]'
                                    }`}>
                                        {filters.lancamentos && <span className="text-white text-xs font-black">✓</span>}
                                    </div>
                                    <Sparkles className={`w-4 h-4 flex-shrink-0 ${filters.lancamentos ? 'text-amber-500' : ''}`} />
                                    Apenas Lançamentos
                                </button>
                            </div>
                        </div>

                        {/* Botões */}
                        <div className={`flex gap-3 pt-5 border-t ${t.divider(dark)}`}>
                            <button
                                type="submit"
                                disabled={loading || !catalogoConfigured}
                                className="flex items-center justify-center gap-2 bg-[#C01717] hover:bg-[#a01212] disabled:opacity-50 text-white font-bold text-base py-3 px-8 rounded-lg transition-all active:scale-95 min-w-[160px]"
                            >
                                <Search className="w-5 h-5" />
                                {loading ? 'Pesquisando...' : 'Pesquisar'}
                            </button>
                            {searched && (
                                <button
                                    type="button"
                                    onClick={handleClear}
                                    className={`flex items-center gap-2 font-semibold text-base py-3 px-5 rounded-lg border-2 transition-all ${
                                        dark ? 'border-[#444] text-[#aaa] hover:bg-[#2a2a2e]' : 'border-[#ccc] text-[#666] hover:bg-[#f0f0f0]'
                                    }`}
                                >
                                    <X className="w-5 h-5" />
                                    Limpar
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                {/* ── Resultados ───────────────────────────────────────── */}
                {error && (
                    <div className="flex items-center gap-3 text-red-700 bg-red-50 border border-red-200 rounded-xl px-5 py-4 mb-5 text-base">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        {error}
                    </div>
                )}

                {!searched && !loading && (
                    <div className={`text-center py-20 ${t.muted(dark)}`}>
                        <Package className="w-16 h-16 mx-auto mb-4 opacity-20" />
                        <p className="text-lg font-medium opacity-60">Use os filtros acima para pesquisar no catálogo</p>
                        <p className="text-sm mt-1 opacity-40">Preencha ao menos um campo e clique em Pesquisar</p>
                    </div>
                )}

                {loading && (
                    <div className={`text-center py-20 ${t.muted(dark)}`}>
                        <div className="inline-block w-10 h-10 border-4 border-[#C01717] border-t-transparent rounded-full animate-spin mb-4" />
                        <p className="text-lg font-medium">Pesquisando...</p>
                    </div>
                )}

                {searched && !loading && results.length === 0 && (
                    <div className={`text-center py-20 ${t.muted(dark)}`}>
                        <Search className="w-14 h-14 mx-auto mb-4 opacity-20" />
                        <p className="text-lg font-semibold">Nenhum produto encontrado</p>
                        <p className="text-sm mt-1 opacity-60">Tente ajustar os filtros da pesquisa</p>
                    </div>
                )}

                {searched && !loading && results.length > 0 && (
                    <>
                        <div className="flex items-center justify-between mb-4">
                            <p className={`text-base font-semibold ${t.muted(dark)}`}>
                                <span className="text-[#C01717] font-black text-lg">{results.length}</span>
                                {' '}resultado{results.length !== 1 ? 's' : ''} encontrado{results.length !== 1 ? 's' : ''}
                                {results.length === 200 ? ' — mostrando os primeiros 200' : ''}
                            </p>
                        </div>

                        {/* Desktop Table */}
                        <div className={`hidden sm:block ${t.card(dark)} overflow-hidden p-0`}>
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse" style={{ fontSize: '15px' }}>
                                    <thead>
                                        <tr className={t.thead(dark)}>
                                            {['Código','PA','Descrição','Grupo','Montadora','Veículo','Motor','Ano','Sobremedida','Ref. Concorrente','Lançamento'].map(h => (
                                                <th key={h} className="text-left px-4 py-4 font-bold uppercase tracking-wider text-sm whitespace-nowrap first:pl-5 last:pr-5">
                                                    {h}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {results.map((p, i) => (
                                            <tr key={p.id} className={`transition-colors ${i % 2 === 0 ? t.rowEven(dark) : t.rowOdd(dark)} ${t.rowHover(dark)}`}>
                                                <td className={`px-4 py-4 first:pl-5 whitespace-nowrap ${t.cell(dark)} ${t.cod(dark)} text-base`}>{p.cod}</td>
                                                <td className={`px-4 py-4 whitespace-nowrap ${t.cell(dark)}`}>{p.pa ?? '—'}</td>
                                                <td className={`px-4 py-4 ${t.cell(dark)} font-medium`}>{p.descricao ?? '—'}</td>
                                                <td className={`px-4 py-4 whitespace-nowrap ${t.cell(dark)}`}>{p.grupo ?? '—'}</td>
                                                <td className={`px-4 py-4 whitespace-nowrap ${t.cell(dark)} font-semibold`}>{p.montadora ?? '—'}</td>
                                                <td className={`px-4 py-4 max-w-[160px] ${t.cell(dark)}`}>{p.veiculo ?? '—'}</td>
                                                <td className={`px-4 py-4 max-w-[200px] ${t.cell(dark)}`}>{p.motor ?? '—'}</td>
                                                <td className={`px-4 py-4 whitespace-nowrap ${t.cell(dark)}`}>{p.ano_aplicacao ?? '—'}</td>
                                                <td className={`px-4 py-4 whitespace-nowrap ${t.cell(dark)}`}>{p.sobremedida ?? '—'}</td>
                                                <td className={`px-4 py-4 max-w-[180px] ${t.cell(dark)}`}>
                                                    {(p.ref_metal_leve_sulloy || p.ref_anel_kalled) ? (
                                                        <div className="space-y-0.5">
                                                            {p.ref_metal_leve_sulloy && <span className={`block text-xs font-mono ${dark ? 'text-sky-300' : 'text-sky-700'}`}>{p.ref_metal_leve_sulloy}</span>}
                                                            {p.ref_anel_kalled && <span className={`block text-xs font-mono ${dark ? 'text-violet-300' : 'text-violet-700'}`}>{p.ref_anel_kalled}</span>}
                                                        </div>
                                                    ) : '—'}
                                                </td>
                                                <td className={`px-4 py-4 last:pr-5 whitespace-nowrap ${t.cell(dark)}`}>
                                                    {p.lancamentos && (
                                                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${t.badge(dark)}`}>
                                                            <Sparkles className="w-3 h-3" /> Novo
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Mobile Cards */}
                        <div className="sm:hidden space-y-4">
                            {results.map(p => (
                                <div key={p.id} className={`${t.card(dark)} p-5`}>
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <div>
                                            <span className={`text-xl ${t.cod(dark)}`}>{p.cod}</span>
                                            {p.pa && <span className={`ml-2 text-sm ${t.muted(dark)}`}>{p.pa}</span>}
                                        </div>
                                        <div className="flex flex-col items-end gap-1.5">
                                            {p.grupo && (
                                                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${dark ? 'bg-[#333] text-[#ccc]' : 'bg-[#e8e8e8] text-[#555]'}`}>
                                                    {p.grupo}
                                                </span>
                                            )}
                                            {p.lancamentos && (
                                                <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${t.badge(dark)}`}>
                                                    <Sparkles className="w-3 h-3" /> Novo
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {p.descricao && <p className="text-base font-semibold mb-4">{p.descricao}</p>}
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                        {[
                                            { label: 'Montadora', val: p.montadora },
                                            { label: 'Veículo', val: p.veiculo },
                                            { label: 'Ano', val: p.ano_aplicacao },
                                            { label: 'Sobremedida', val: p.sobremedida },
                                        ].filter(r => r.val).map(r => (
                                            <div key={r.label}>
                                                <p className={`text-xs font-bold uppercase tracking-wider mb-0.5 ${t.muted(dark)}`}>{r.label}</p>
                                                <p className="text-base font-medium">{r.val}</p>
                                            </div>
                                        ))}
                                        {p.motor && (
                                            <div className="col-span-2">
                                                <p className={`text-xs font-bold uppercase tracking-wider mb-0.5 ${t.muted(dark)}`}>Motor</p>
                                                <p className="text-base font-medium">{p.motor}</p>
                                            </div>
                                        )}
                                        {(p.ref_metal_leve_sulloy || p.ref_anel_kalled) && (
                                            <div className="col-span-2">
                                                <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${t.muted(dark)}`}>Ref. Concorrente</p>
                                                <div className="space-y-0.5">
                                                    {p.ref_metal_leve_sulloy && <p className={`text-sm font-mono ${dark ? 'text-sky-300' : 'text-sky-700'}`}>{p.ref_metal_leve_sulloy}</p>}
                                                    {p.ref_anel_kalled && <p className={`text-sm font-mono ${dark ? 'text-violet-300' : 'text-violet-700'}`}>{p.ref_anel_kalled}</p>}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* ── Footer ───────────────────────────────────────────────── */}
            <footer className={`border-t ${t.divider(dark)} py-5 px-6 text-center mt-8`}>
                <p className={`text-sm ${t.muted(dark)}`}>
                    © {new Date().getFullYear()} Kalled Pistões · Todos os direitos reservados
                </p>
            </footer>
        </div>
    );
}
