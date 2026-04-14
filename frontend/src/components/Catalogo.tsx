import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Lock, Package, AlertCircle, Sun, Moon, Sparkles } from 'lucide-react';
import { supabase, catalogoConfigured, type CatalogoProduto } from '../lib/supabase';

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
        ? 'bg-green-500/20 text-green-400 border border-green-500/40'
        : 'bg-green-50 text-green-700 border border-green-300',
    divider:    (d: boolean) => d ? 'border-[#333]' : 'border-[#d0d0d0]',
    muted:      (d: boolean) => d ? 'text-[#666]' : 'text-[#888]',
    cod:        (d: boolean) => d ? 'text-[#e05050] font-bold font-mono' : 'text-[#C01717] font-bold font-mono',
    toggleBg:   (d: boolean) => d ? 'bg-[#2a2a30] hover:bg-[#333] text-[#d0d0d8]' : 'bg-[#e8e8e8] hover:bg-[#ddd] text-[#555]',
};

export default function Catalogo() {
    const navigate = useNavigate();
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
            const ref = filters.ref.trim();
            if (ref && ref.length < 3) {
                setError('Digite ao menos 3 caracteres para buscar por código de referência.');
                setLoading(false);
                return;
            }
            let query = supabase.from('catalogo_produtos').select('*').order('cod').limit(200);
            if (filters.cod.trim())     query = query.ilike('cod', `%${filters.cod.trim()}%`);
            if (ref)                    query = query.or(`ref_metal_leve_sulloy.ilike.%${ref}%,ref_anel_kalled.ilike.%${ref}%`);
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
                        src={dark ? '/Kalled White.png' : '/logo-kalled.png'}
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
                        {/* Seção 1 — Identificação do Produto */}
                        <div className={`mb-1 pb-1`}>
                            <p className={`text-xs font-black uppercase tracking-widest mb-3 ${t.muted(dark)}`}>Identificação do Produto</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className={`block mb-1.5 ${t.label(dark)}`}>Nº do Produto / Código</label>
                                    <input type="text" value={filters.cod} onChange={e => set('cod', e.target.value)}
                                        placeholder="Ex: P2110" className={inputCls} />
                                </div>
                                <div>
                                    <label className={`block mb-1.5 ${t.label(dark)}`}>Código de Referência de Concorrente</label>
                                    <input type="text" value={filters.ref} onChange={e => set('ref', e.target.value)}
                                        placeholder="Ex: 4950, ML1234..." className={inputCls} />
                                </div>
                            </div>
                        </div>

                        {/* Divisor */}
                        <div className={`border-t my-5 ${t.divider(dark)}`} />

                        {/* Seção 2 — Dados do Veículo */}
                        <div className="mb-1">
                            <p className={`text-xs font-black uppercase tracking-widest mb-3 ${t.muted(dark)}`}>Dados do Veículo</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className={`block mb-1.5 ${t.label(dark)}`}>Montadora</label>
                                    <select value={filters.montadora} onChange={e => set('montadora', e.target.value)}
                                        disabled={catalogoConfigured && !optionsLoaded}
                                        className={`${inputCls} cursor-pointer disabled:opacity-50`} style={{ backgroundColor: selectBg }}>
                                        <option value="">Todas</option>
                                        {montadoras.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={`block mb-1.5 ${t.label(dark)}`}>Veículo / Modelo</label>
                                    <input type="text" value={filters.veiculo} onChange={e => set('veiculo', e.target.value)}
                                        placeholder="Ex: Gol, Palio, Uno..." className={inputCls} />
                                </div>
                                <div>
                                    <label className={`block mb-1.5 ${t.label(dark)}`}>Motor</label>
                                    <input type="text" value={filters.motor} onChange={e => set('motor', e.target.value)}
                                        placeholder="Ex: 1.0 8V, EA111..." className={inputCls} />
                                </div>
                            </div>
                        </div>

                        {/* Divisor */}
                        <div className={`border-t my-5 ${t.divider(dark)}`} />

                        {/* Seção 3 — Tipo + Lançamentos */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-1">
                            <div>
                                <label className={`block mb-1.5 ${t.label(dark)}`}>Grupo / Tipo</label>
                                <select value={filters.grupo} onChange={e => set('grupo', e.target.value)}
                                    disabled={catalogoConfigured && !optionsLoaded}
                                    className={`${inputCls} cursor-pointer disabled:opacity-50`} style={{ backgroundColor: selectBg }}>
                                    <option value="">Todos os Grupos</option>
                                    {grupos.map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                            </div>
                            <div className="flex items-end">
                                <button type="button"
                                    onClick={() => setFilters((p: Filters) => ({ ...p, lancamentos: !p.lancamentos }))}
                                    className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg border-2 text-base font-semibold transition-all ${
                                        filters.lancamentos
                                            ? 'border-green-500 bg-green-500/10 text-green-600'
                                            : `${dark ? 'border-[#444] text-[#888]' : 'border-[#ccc] text-[#888]'}`
                                    }`}>
                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                        filters.lancamentos ? 'bg-green-500 border-green-500' : dark ? 'border-[#555]' : 'border-[#bbb]'
                                    }`}>
                                        {filters.lancamentos && <span className="text-white text-xs font-black">✓</span>}
                                    </div>
                                    <Sparkles className={`w-4 h-4 flex-shrink-0 ${filters.lancamentos ? 'text-green-500' : ''}`} />
                                    Apenas Lançamentos
                                </button>
                            </div>
                        </div>

                        {/* Botões */}
                        <div className={`flex gap-3 pt-5 mt-4 border-t ${t.divider(dark)}`}>
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

                        {/* Cards — desktop e mobile unificados */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                            {results.map(p => (
                                <div key={p.id} className={`${t.card(dark)} flex flex-col overflow-hidden`}>
                                    {/* Cabeçalho vermelho */}
                                    <div className="bg-[#C01717] px-5 py-4 flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-white/70 text-xs font-bold uppercase tracking-wider mb-0.5">Código</p>
                                            <p className="text-white font-black text-2xl leading-tight font-mono">{p.cod}</p>
                                            {p.pa && <p className="text-white/60 text-xs font-mono mt-0.5">{p.pa}</p>}
                                        </div>
                                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                            {p.lancamentos && (
                                                <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${t.badge(dark)}`}>
                                                    <Sparkles className="w-3 h-3" /> Novo
                                                </span>
                                            )}
                                            {p.grupo && (
                                                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white/20 text-white">
                                                    {p.grupo}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Descrição */}
                                    <div className={`px-5 py-3 border-b ${t.divider(dark)}`}>
                                        <p className="text-base font-bold leading-snug">
                                            {p.descricao ?? '—'}
                                        </p>
                                    </div>

                                    {/* Dados do veículo */}
                                    <div className="px-5 py-4 flex-1 grid grid-cols-2 gap-x-4 gap-y-3">
                                        {p.montadora && (
                                            <div>
                                                <p className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${t.muted(dark)}`}>Montadora</p>
                                                <p className="text-base font-semibold">{p.montadora}</p>
                                            </div>
                                        )}
                                        {p.veiculo && (
                                            <div>
                                                <p className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${t.muted(dark)}`}>Veículo</p>
                                                <p className="text-base font-semibold">{p.veiculo}</p>
                                            </div>
                                        )}
                                        {p.ano_aplicacao && (
                                            <div>
                                                <p className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${t.muted(dark)}`}>Ano</p>
                                                <p className="text-base font-semibold">{p.ano_aplicacao}</p>
                                            </div>
                                        )}
                                        {p.sobremedida && (
                                            <div>
                                                <p className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${t.muted(dark)}`}>Sobremedida</p>
                                                <p className="text-base font-semibold">{p.sobremedida}</p>
                                            </div>
                                        )}
                                        {p.motor && (
                                            <div className="col-span-2">
                                                <p className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${t.muted(dark)}`}>Motor</p>
                                                <p className="text-base font-semibold">{p.motor}</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Referências de concorrentes — rodapé */}
                                    {(p.ref_metal_leve_sulloy || p.ref_anel_kalled) && (
                                        <div className={`px-5 py-3 border-t ${t.divider(dark)} ${dark ? 'bg-[#1a1a1e]' : 'bg-[#f5f5f5]'}`}>
                                            <p className={`text-[10px] font-black uppercase tracking-widest mb-1.5 ${t.muted(dark)}`}>Ref. Concorrente</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {p.ref_metal_leve_sulloy && (
                                                    <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${dark ? 'bg-sky-500/15 text-sky-300' : 'bg-sky-100 text-sky-700'}`}>
                                                        {p.ref_metal_leve_sulloy}
                                                    </span>
                                                )}
                                                {p.ref_anel_kalled && (
                                                    <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${dark ? 'bg-violet-500/15 text-violet-300' : 'bg-violet-100 text-violet-700'}`}>
                                                        {p.ref_anel_kalled}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
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
