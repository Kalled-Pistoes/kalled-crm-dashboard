import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Lock, Package, AlertCircle, Sun, Moon, Sparkles, User, Mail, Phone, MapPin, FileText } from 'lucide-react';
import { supabase, catalogoConfigured, supabaseUrl, type CatalogoProduto } from '../lib/supabase';

interface Filters {
    buscaGeral: string;
    cod: string;
    ref: string;
    montadora: string;
    veiculo: string;
    motor: string;
    grupo: string;
    lancamentos: boolean;
}

const EMPTY: Filters = { buscaGeral: '', cod: '', ref: '', montadora: '', veiculo: '', motor: '', grupo: '', lancamentos: false };

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

const ESTADOS = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

// ── ProdutoCard ───────────────────────────────────────────────────────────
interface ProdutoCardProps {
    p: CatalogoProduto;
    dark: boolean;
    onOpenImage: () => void;
}

function ProdutoCard({ p, dark, onOpenImage }: ProdutoCardProps) {
    const [expanded, setExpanded] = useState(false);
    const [imgError, setImgError] = useState(false);
    const hasExtras = !!(p.diametro_cilindro || p.sobremedida || p.qtd_pistoes || p.espessura_canaletas || p.pa || p.anel_kalled || p.ref_metal_leve_sulloy || p.ref_anel_kalled);
    const STORAGE_URL = supabaseUrl ? `${supabaseUrl}/storage/v1/object/public/produtos-imagens` : '';
    
    // Normaliza o código para o padrão do Storage: Se começa com P e não tem espaço, adiciona (ex: P2000 -> P 2000)
    const normalizedCod = (p.cod.startsWith('P') && !p.cod.includes(' ')) 
        ? `P ${p.cod.substring(1)}` 
        : p.cod;
    const imageUrl = `${STORAGE_URL}/${encodeURIComponent(normalizedCod)}.png`;

    // Divide veículos e anos separados por '/' e cruza cada par (veiculo[i] <-> ano[i])
    const veiculosList = p.veiculo
        ? p.veiculo.split('/').map((v: string) => v.trim()).filter(Boolean)
        : ['—'];
    const anosList = p.ano_aplicacao
        ? p.ano_aplicacao.split('/').map((a: string) => a.trim()).filter(Boolean)
        : [];

    // Função que separa um intervalo de ano (ex: "2008-2022") em {ini, fim}
    const parseAno = (raw: string) => {
        // Separa por hífen ou en-dash, mas cuidando de não quebrar no primeiro hífen de um ano negativo
        const parts = raw.split(/(?<=\d{4})[-–](?=\d)/);
        return {
            ini: parts[0]?.trim() ?? '—',
            fim: parts.length > 1 ? parts[parts.length - 1].trim() : (parts[0]?.trim() ?? '—'),
        };
    };

    // Monta as linhas da tabela cruzando veículo[i] com ano[i] (ou ano único se só houver um)
    const linhas = veiculosList.map((veiculo, idx) => {
        const anoRaw = anosList[idx] ?? anosList[0] ?? '';
        return { veiculo, ...parseAno(anoRaw) };
    });

    return (
        <div
            className={`relative flex flex-col overflow-hidden rounded-lg border transition-shadow duration-200 hover:shadow-md ${
                dark
                    ? 'bg-[#232328] border-[#333] hover:border-[#555]'
                    : 'bg-white border-[#ddd] hover:border-[#bbb] shadow-sm'
            }`}
        >
            {/* Borda lateral vermelha de destaque */}
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#C01717] rounded-l-lg" />

            {/* Cabeçalho — código + descrição */}
            <div className={`pl-5 pr-4 pt-4 pb-3 border-b ${dark ? 'border-[#333]' : 'border-[#e8e8e8]'}`}>
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-[#C01717] font-black text-xl leading-tight font-mono tracking-wide">
                            {p.cod}
                        </p>
                        <p className={`text-sm font-semibold mt-0.5 ${dark ? 'text-[#c0c0c8]' : 'text-[#444]'}`}>
                            {p.descricao ?? '—'}
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0 pt-0.5">
                        {p.lancamentos && (
                            <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                                dark ? 'bg-green-500/20 text-green-400 border border-green-500/40' : 'bg-green-50 text-green-700 border border-green-300'
                            }`}>
                                <Sparkles className="w-3 h-3" /> Novo
                            </span>
                        )}
                        {p.grupo && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                dark ? 'bg-[#2a2a35] text-[#a0a0b0]' : 'bg-[#eef2f7] text-[#555]'
                            }`}>
                                {p.grupo}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Corpo — imagem placeholder + tabela de aplicações */}
            <div className="pl-5 pr-4 py-4 flex gap-5 items-start">
                {/* Imagem do produto */}
                <div 
                    onClick={onOpenImage}
                    className={`flex-shrink-0 w-24 h-24 rounded-lg flex items-center justify-center border overflow-hidden cursor-pointer hover:opacity-80 transition-opacity ${
                    dark ? 'bg-[#1a1a1e] border-[#333]' : 'bg-[#f5f5f5] border-[#e0e0e0]'
                }`}>
                    {!imgError ? (
                        <img
                            src={imageUrl}
                            alt={p.cod}
                            className="w-full h-full object-cover"
                            onError={() => setImgError(true)}
                        />
                    ) : (
                        <Package className={`w-10 h-10 ${dark ? 'text-[#444]' : 'text-[#ccc]'}`} />
                    )}
                </div>

                {/* Tabela de aplicações */}
                <div className="flex-1 min-w-0 overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr>
                                {p.montadora && (
                                    <th className="text-left text-[10px] font-black uppercase tracking-widest pb-1.5 pr-5 whitespace-nowrap text-[#C01717]">
                                        {p.montadora}
                                    </th>
                                )}
                                <th className={`text-left text-[10px] font-black uppercase tracking-widest pb-1.5 pr-5 whitespace-nowrap ${
                                    dark ? 'text-[#8888aa]' : 'text-[#888]'
                                }`}>Motor</th>
                                <th className={`text-left text-[10px] font-black uppercase tracking-widest pb-1.5 pr-5 whitespace-nowrap ${
                                    dark ? 'text-[#8888aa]' : 'text-[#888]'
                                }`}>Ano Inicial</th>
                                <th className={`text-left text-[10px] font-black uppercase tracking-widest pb-1.5 pr-5 whitespace-nowrap ${
                                    dark ? 'text-[#8888aa]' : 'text-[#888]'
                                }`}>Ano Final</th>
                                {p.combustivel && (
                                    <th className={`text-left text-[10px] font-black uppercase tracking-widest pb-1.5 whitespace-nowrap ${
                                        dark ? 'text-[#8888aa]' : 'text-[#888]'
                                    }`}>Combustível</th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {/* Uma linha por veículo, com o intervalo de anos correspondente */}
                            {linhas.map((linha, idx) => (
                                <tr key={idx} className={`border-t ${dark ? 'border-[#2e2e34]' : 'border-[#e8e8e8]'}`}>
                                    {p.montadora && (
                                        <td className={`py-2 pr-5 font-semibold whitespace-nowrap ${dark ? 'text-[#d0d0d8]' : 'text-[#333]'}`}>
                                            {linha.veiculo}
                                        </td>
                                    )}
                                    <td className={`py-2 pr-5 font-mono text-xs whitespace-nowrap ${dark ? 'text-[#d0d0d8]' : 'text-[#333]'}`}>
                                        {p.motor ?? '—'}
                                    </td>
                                    <td className={`py-2 pr-5 whitespace-nowrap ${dark ? 'text-[#d0d0d8]' : 'text-[#333]'}`}>
                                        {linha.ini}
                                    </td>
                                    <td className={`py-2 pr-5 whitespace-nowrap ${dark ? 'text-[#d0d0d8]' : 'text-[#333]'}`}>
                                        {linha.fim}
                                    </td>
                                    {p.combustivel && (
                                        <td className={`py-2 font-semibold whitespace-nowrap ${dark ? 'text-[#d0d0d8]' : 'text-[#333]'}`}>
                                            {p.combustivel}
                                        </td>
                                    )}
                                </tr>
                            ))}
                            {/* Dados técnicos extras (expansível) */}
                            {hasExtras && expanded && (
                                <tr className={`border-t ${dark ? 'border-[#2e2e34]' : 'border-[#e8e8e8]'}`}>
                                    <td colSpan={5} className="pt-2.5 pb-0">
                                        <div className="flex flex-wrap gap-4">
                                            {p.diametro_cilindro && (
                                                <span className={`text-xs ${dark ? 'text-[#a0a0b0]' : 'text-[#666]'}`}>
                                                    <span className={`font-black uppercase tracking-wide text-[10px] mr-1 ${dark ? 'text-[#666]' : 'text-[#888]'}`}>Diâmetro:</span>
                                                    {Number(p.diametro_cilindro).toFixed(2)} mm
                                                </span>
                                            )}
                                            {p.sobremedida && (
                                                <span className={`text-xs ${dark ? 'text-[#a0a0b0]' : 'text-[#666]'}`}>
                                                    <span className={`font-black uppercase tracking-wide text-[10px] mr-1 ${dark ? 'text-[#666]' : 'text-[#888]'}`}>Sobremedida:</span>
                                                    {p.sobremedida}
                                                </span>
                                            )}
                                            {p.qtd_pistoes && (
                                                <span className={`text-xs ${dark ? 'text-[#a0a0b0]' : 'text-[#666]'}`}>
                                                    <span className={`font-black uppercase tracking-wide text-[10px] mr-1 ${dark ? 'text-[#666]' : 'text-[#888]'}`}>Pistões:</span>
                                                    {p.qtd_pistoes} un
                                                </span>
                                            )}
                                            {p.espessura_canaletas && (
                                                <span className={`text-xs ${dark ? 'text-[#a0a0b0]' : 'text-[#666]'}`}>
                                                    <span className={`font-black uppercase tracking-wide text-[10px] mr-1 ${dark ? 'text-[#666]' : 'text-[#888]'}`}>Canaletas:</span>
                                                    {p.espessura_canaletas}
                                                </span>
                                            )}
                                            {p.medida_haste && (
                                                <span className={`text-xs ${dark ? 'text-[#a0a0b0]' : 'text-[#666]'}`}>
                                                    <span className={`font-black uppercase tracking-wide text-[10px] mr-1 ${dark ? 'text-[#666]' : 'text-[#888]'}`}>Medida Haste:</span>
                                                    {p.medida_haste}
                                                </span>
                                            )}
                                            {p.comprimento_total && (
                                                <span className={`text-xs ${dark ? 'text-[#a0a0b0]' : 'text-[#666]'}`}>
                                                    <span className={`font-black uppercase tracking-wide text-[10px] mr-1 ${dark ? 'text-[#666]' : 'text-[#888]'}`}>Comp. Total:</span>
                                                    {p.comprimento_total}
                                                </span>
                                            )}
                                            {p.pa && (
                                                <span className={`text-xs ${dark ? 'text-[#a0a0b0]' : 'text-[#666]'}`}>
                                                    <span className={`font-black uppercase tracking-wide text-[10px] mr-1 ${dark ? 'text-[#666]' : 'text-[#888]'}`}>PA:</span>
                                                    {p.pa}
                                                </span>
                                            )}
                                            {p.anel_kalled && (
                                                <span className={`text-xs ${dark ? 'text-[#a0a0b0]' : 'text-[#666]'}`}>
                                                    <span className={`font-black uppercase tracking-wide text-[10px] mr-1 ${dark ? 'text-[#666]' : 'text-[#888]'}`}>Anel Kalled:</span>
                                                    {p.anel_kalled}
                                                </span>
                                            )}
                                            {p.ref_metal_leve_sulloy && (
                                                <span className={`text-xs ${dark ? 'text-[#a0a0b0]' : 'text-[#666]'}`}>
                                                    <span className={`font-black uppercase tracking-wide text-[10px] mr-1 ${dark ? 'text-[#666]' : 'text-[#888]'}`}>REF. PISTÃO:</span>
                                                    <span className={`font-mono font-bold px-1.5 py-0.5 rounded ${dark ? 'bg-red-500/15 text-red-400' : 'bg-red-50 text-red-600'}`}>
                                                        {p.ref_metal_leve_sulloy}
                                                    </span>
                                                </span>
                                            )}
                                            {p.ref_anel_kalled && (
                                                <span className={`text-xs ${dark ? 'text-[#a0a0b0]' : 'text-[#666]'}`}>
                                                    <span className={`font-black uppercase tracking-wide text-[10px] mr-1 ${dark ? 'text-[#666]' : 'text-[#888]'}`}>REF. ANEL:</span>
                                                    <span className={`font-mono font-bold px-1.5 py-0.5 rounded ${dark ? 'bg-red-500/15 text-red-400' : 'bg-red-50 text-red-600'}`}>
                                                        {p.ref_anel_kalled}
                                                    </span>
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Rodapé — logo Kalled + refs + botão Ver mais */}
            <div className={`pl-5 pr-4 py-2.5 border-t flex items-center justify-between gap-3 ${
                dark ? 'border-[#333] bg-[#1c1c21]' : 'border-[#e8e8e8] bg-[#f7f8fa]'
            }`}>
                <div className="flex items-center gap-3 min-w-0 overflow-hidden">
                    {/* Logo Kalled */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        <div className={`w-5 h-5 rounded flex items-center justify-center ${
                            dark ? 'bg-[#C01717]/20' : 'bg-[#C01717]/10'
                        }`}>
                            <span className="text-[#C01717] text-[10px] font-black italic">K</span>
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${dark ? 'text-[#777]' : 'text-[#999]'}`}>
                            Kalled
                        </span>
                    </div>

                </div>

                {/* Botão Ver mais */}
                {hasExtras && (
                    <button
                        onClick={() => setExpanded(e => !e)}
                        className="flex-shrink-0 text-white text-xs font-bold px-4 py-1.5 rounded transition-colors duration-150 cursor-pointer"
                        style={{ backgroundColor: expanded ? '#a01212' : '#C01717' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = expanded ? '#800e0e' : '#b01515')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = expanded ? '#a01212' : '#C01717')}
                    >
                        {expanded ? 'Ver menos' : 'Ver mais'}
                    </button>
                )}
            </div>
        </div>
    );
}

// ── ModalImage — gerencia o fallback de imagem no modal ──────────────────
function ModalImage({ product, dark }: { product: CatalogoProduto; dark: boolean }) {
    const [imgError, setImgError] = useState(false);
    const STORAGE_URL = supabaseUrl ? `${supabaseUrl}/storage/v1/object/public/produtos-imagens` : '';
    
    // Normaliza o código para o padrão do Storage (mesma lógica do card)
    const normalizedCod = (product.cod.startsWith('P') && !product.cod.includes(' ')) 
        ? `P ${product.cod.substring(1)}` 
        : product.cod;
    const imageUrl = `${STORAGE_URL}/${encodeURIComponent(normalizedCod)}.png`;
    if (imgError) return <Package className={`w-32 h-32 ${dark ? 'text-[#444]' : 'text-[#ccc]'}`} />;
    return (
        <img
            src={imageUrl}
            alt={product.cod}
            className="max-w-full max-h-full object-contain"
            onError={() => setImgError(true)}
        />
    );
}

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

    const [visitorModal, setVisitorModal] = useState(false);
    const [isReturning, setIsReturning] = useState(false);
    const [visitorData, setVisitorData] = useState({ nome: '', email: '', telefone: '', estado: '', cnpj: '' });
    const [savingVisitor, setSavingVisitor] = useState(false);

    const [showImageModal, setShowImageModal] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<CatalogoProduto | null>(null);

    useEffect(() => {
        if (!localStorage.getItem('kalled_visitante_id')) {
            setVisitorModal(true);
        }
    }, []);

    useEffect(() => {
        if (!catalogoConfigured) return;
        async function loadOptions() {
            const [m, g] = await Promise.all([
                supabase.from('catalogo_produtos').select('montadora').not('montadora', 'is', null).limit(10000),
                supabase.from('catalogo_produtos').select('grupo').not('grupo', 'is', null).limit(10000),
            ]);
            
            const individualMontadoras = new Set<string>();
            (m.data || []).forEach((r: any) => {
                if (r.montadora) {
                    const parts = r.montadora.split(/[\s,/;\-+]+/).map((s: string) => s.trim()).filter(Boolean);
                    parts.forEach((part: string) => {
                        const lower = part.toLowerCase();
                        if (lower === 'motors') return; // ignora a palavra "motors" para evitar poluir o menu (ex: de "Kia Motors")
                        
                        let normalized = part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
                        if (lower === 'gm') {
                            normalized = 'GM';
                        } else if (lower === 'vw') {
                            normalized = 'VW';
                        } else if (lower === 'mwm') {
                            normalized = 'MWM';
                        } else if (lower === 'fpt') {
                            normalized = 'FPT';
                        } else if (lower === 'citroen' || lower === 'citroën') {
                            normalized = 'Citroën';
                        }
                        individualMontadoras.add(normalized);
                    });
                }
            });

            const uniq = (arr: string[]) => [...new Set(arr)].sort((a, b) => a.localeCompare(b, 'pt', { sensitivity: 'base' }));
            setMontadoras(uniq(Array.from(individualMontadoras)));
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
            let query = supabase.from('catalogo_produtos').select('*').order('cod').limit(5000);
            
            if (filters.buscaGeral.trim()) {
                const bg = filters.buscaGeral.trim();
                query = query.or(`cod.ilike.%${bg}%,ref_metal_leve_sulloy.ilike.%${bg}%,ref_anel_kalled.ilike.%${bg}%,montadora.ilike.%${bg}%,veiculo.ilike.%${bg}%,motor.ilike.%${bg}%`);
            }
            
            if (filters.cod.trim())     query = query.ilike('cod', `%${filters.cod.trim()}%`);
            if (ref)                    query = query.or(`ref_metal_leve_sulloy.ilike.%${ref}%,ref_anel_kalled.ilike.%${ref}%`);
            if (filters.montadora) {
                if (filters.montadora === 'Citroën') {
                    query = query.or('montadora.ilike.%Citroën%,montadora.ilike.%Citroen%');
                } else {
                    query = query.ilike('montadora', `%${filters.montadora}%`);
                }
            }
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
    async function handleSearchLancamentos() {
        setFilters({ ...EMPTY, lancamentos: true });
        setLoading(true); setError('');
        try {
            const { data, error: err } = await supabase.from('catalogo_produtos').select('*').eq('lancamentos', true).order('cod').limit(5000);
            if (err) throw err;
            setResults(data || []);
        } catch { setError('Erro ao consultar o catálogo. Verifique sua conexão.'); }
        finally { setLoading(false); setSearched(true); }
    }

    function handleClear() { setFilters(EMPTY); setResults([]); setSearched(false); setError(''); }
    const set = (k: keyof Filters, v: string) => setFilters((p: Filters) => ({ ...p, [k]: v }));

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let v = e.target.value.replace(/\D/g, '');
        if (v.length > 11) v = v.slice(0, 11);
        if (v.length > 2) v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
        if (v.length > 10) v = `${v.slice(0, 10)}-${v.slice(10)}`;
        setVisitorData(p => ({ ...p, telefone: v }));
    };

    const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let v = e.target.value.replace(/\D/g, '');
        if (v.length > 14) v = v.slice(0, 14);
        if (v.length > 12) {
            v = `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8, 12)}-${v.slice(12)}`;
        } else if (v.length > 8) {
            v = `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5, 8)}/${v.slice(8)}`;
        } else if (v.length > 5) {
            v = `${v.slice(0, 2)}.${v.slice(2, 5)}.${v.slice(5)}`;
        } else if (v.length > 2) {
            v = `${v.slice(0, 2)}.${v.slice(2)}`;
        }
        setVisitorData(p => ({ ...p, cnpj: v }));
    };

    async function handleVisitorSubmit(e: FormEvent) {
        e.preventDefault();
        setSavingVisitor(true);
        try {
            const phoneClean = visitorData.telefone.replace(/\D/g, '');
            const cnpjClean = visitorData.cnpj ? visitorData.cnpj.replace(/\D/g, '') : null;
            
            if (isReturning) {
                const { data, error: err } = await supabase.from('visitantes_catalogo')
                    .select('id')
                    .eq('telefone', phoneClean)
                    .single();
                
                if (err || !data) {
                    alert('Cadastro não encontrado com este telefone. Por favor, preencha o formulário completo.');
                    setIsReturning(false);
                    return;
                }
                localStorage.setItem('kalled_visitante_id', data.id);
                setVisitorModal(false);
                return;
            }

            const { data, error: err } = await supabase.from('visitantes_catalogo').insert([{
                ...visitorData,
                telefone: phoneClean,
                cnpj: cnpjClean || null
            }]).select().single();
            
            if (err) {
                if (err.code === '23505') {
                    const { data: existing } = await supabase.from('visitantes_catalogo')
                        .select('id')
                        .eq('telefone', phoneClean)
                        .single();
                        
                    if (existing) {
                        localStorage.setItem('kalled_visitante_id', existing.id);
                        setVisitorModal(false);
                        return;
                    }
                }
                throw err;
            }
            localStorage.setItem('kalled_visitante_id', data.id);
            setVisitorModal(false);
        } catch (err: any) {
            alert('Erro ao processar identificação: ' + err.message);
        } finally {
            setSavingVisitor(false);
        }
    }

    // Shared input/select class
    const inputCls = `w-full rounded-lg px-4 py-3 text-base outline-none transition-all ${t.input(dark)}`;
    const selectBg = dark ? '#18181b' : '#ffffff';

    return (
        <div className={`min-h-screen flex flex-col ${t.page(dark)}`} style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            {visitorModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className={`${t.card(dark)} w-full max-w-md p-6 sm:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto`}>
                        <div className="absolute top-0 left-0 w-full h-1 bg-[#C01717]" />
                        
                        <div className="text-center mb-6">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#C01717]/10 mb-4">
                                <span className="text-4xl font-black text-[#C01717] italic">K</span>
                            </div>
                            <h2 className="text-2xl font-black mb-2">
                                {isReturning ? 'Bem-vindo de volta!' : 'Bem-vindo ao Catálogo'}
                            </h2>
                            <p className={`text-sm ${t.muted(dark)}`}>
                                {isReturning ? 'Digite seu telefone para acessar.' : 'Por favor, identifique-se para continuar.'}
                            </p>
                        </div>

                        <form onSubmit={handleVisitorSubmit} className="space-y-4">
                            {!isReturning && (
                                <>
                                    <div>
                                        <label className={`block mb-1.5 ${t.label(dark)}`}>Nome Completo</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <User className={`w-5 h-5 ${t.muted(dark)}`} />
                                            </div>
                                            <input required type="text" value={visitorData.nome} onChange={e => setVisitorData(p => ({ ...p, nome: e.target.value }))}
                                                placeholder="Seu nome" className={`${inputCls} pl-10`} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className={`block mb-1.5 ${t.label(dark)}`}>E-mail</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <Mail className={`w-5 h-5 ${t.muted(dark)}`} />
                                            </div>
                                            <input required type="email" value={visitorData.email} onChange={e => setVisitorData(p => ({ ...p, email: e.target.value }))}
                                                placeholder="seu@email.com" className={`${inputCls} pl-10`} />
                                        </div>
                                    </div>
                                </>
                            )}
                            
                            <div>
                                <label className={`block mb-1.5 ${t.label(dark)}`}>WhatsApp</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Phone className={`w-5 h-5 ${t.muted(dark)}`} />
                                    </div>
                                    <input required type="tel" value={visitorData.telefone} onChange={handlePhoneChange}
                                        placeholder="(11) 99999-9999" minLength={14} maxLength={15} className={`${inputCls} pl-10`} />
                                </div>
                            </div>

                            {!isReturning && (
                                <>
                                    <div>
                                        <label className={`block mb-1.5 ${t.label(dark)}`}>Estado</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <MapPin className={`w-5 h-5 ${t.muted(dark)}`} />
                                            </div>
                                            <select required value={visitorData.estado} onChange={e => setVisitorData(p => ({ ...p, estado: e.target.value }))}
                                                className={`${inputCls} pl-10 appearance-none`} style={{ backgroundColor: selectBg }}>
                                                <option value="">Selecione...</option>
                                                {ESTADOS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className={`block mb-1.5 ${t.label(dark)}`}>CNPJ (Opcional)</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <FileText className={`w-5 h-5 ${t.muted(dark)}`} />
                                            </div>
                                            <input type="text" value={visitorData.cnpj} onChange={handleCnpjChange}
                                                placeholder="00.000.000/0000-00" className={`${inputCls} pl-10`} />
                                        </div>
                                    </div>
                                </>
                            )}

                            <button
                                type="submit"
                                disabled={savingVisitor || !catalogoConfigured}
                                className="w-full mt-5 bg-[#C01717] hover:bg-[#a01212] disabled:opacity-50 text-white font-bold text-base py-3 px-4 rounded-lg transition-all active:scale-95 shadow-lg shadow-[#C01717]/20"
                            >
                                {savingVisitor ? 'Processando...' : (isReturning ? 'Entrar' : 'Acessar Catálogo')}
                            </button>

                            <div className="text-center mt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsReturning(!isReturning)}
                                    className={`text-sm font-medium transition-colors ${dark ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'}`}
                                >
                                    {isReturning ? (
                                        <span>Novo por aqui? <span className="text-[#C01717] underline underline-offset-4">Criar cadastro</span></span>
                                    ) : (
                                        <span>Já tem cadastro? <span className="text-[#C01717] underline underline-offset-4">Clique aqui para entrar</span></span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Header ───────────────────────────────────────────────── */}
            <header className={`border-b ${t.header(dark)} px-4 sm:px-8 py-3 flex items-center justify-between sticky top-0 z-20`}>
                <div className="flex items-center gap-4">
                    <img
                        src={dark ? '/Kalled%20White.png' : '/logo-kalled.png'}
                        alt="Kalled Pistões"
                        className="h-12 sm:h-20 object-contain"
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
                        {/* Seção 0 — Busca Geral */}
                        <div className={`mb-5 pb-5 border-b ${t.divider(dark)}`}>
                            <p className={`text-xs font-black uppercase tracking-widest mb-3 ${t.muted(dark)}`}>Busca Geral</p>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search className={`w-5 h-5 ${t.muted(dark)}`} />
                                </div>
                                <input type="text" value={filters.buscaGeral} onChange={e => set('buscaGeral', e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); handleSearch(e as unknown as React.FormEvent); } }}
                                    enterKeyHint="search"
                                    placeholder="Digite montadora, código, veículo, motor ou concorrência..." className={`${inputCls} pl-10`} />
                            </div>
                        </div>

                        {/* Seção 1 — Identificação do Produto */}
                        <div className={`mb-1 pb-1`}>
                            <p className={`text-xs font-black uppercase tracking-widest mb-3 ${t.muted(dark)}`}>Identificação do Produto</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className={`block mb-1.5 ${t.label(dark)}`}>Nº do Produto / Código</label>
                                    <input type="text" value={filters.cod} onChange={e => set('cod', e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); handleSearch(e as unknown as React.FormEvent); } }}
                                        enterKeyHint="search"
                                        placeholder="Ex: P2110" className={inputCls} />
                                </div>
                                <div>
                                    <label className={`block mb-1.5 ${t.label(dark)}`}>Código de Referência de Concorrente</label>
                                    <input type="text" value={filters.ref} onChange={e => set('ref', e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); handleSearch(e as unknown as React.FormEvent); } }}
                                        enterKeyHint="search"
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
                                        onKeyDown={e => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); handleSearch(e as unknown as React.FormEvent); } }}
                                        enterKeyHint="search"
                                        placeholder="Ex: Gol, Palio, Uno..." className={inputCls} />
                                </div>
                                <div>
                                    <label className={`block mb-1.5 ${t.label(dark)}`}>Motor</label>
                                    <input type="text" value={filters.motor} onChange={e => set('motor', e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); handleSearch(e as unknown as React.FormEvent); } }}
                                        enterKeyHint="search"
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
                                    disabled={loading || !catalogoConfigured}
                                    onClick={handleSearchLancamentos}
                                    className={`flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg border-2 text-base font-semibold transition-all active:scale-95 disabled:opacity-50 ${
                                        dark 
                                            ? 'border-green-500/50 bg-green-500/10 text-green-500 hover:bg-green-500/20' 
                                            : 'border-green-500 bg-green-50 text-green-600 hover:bg-green-100'
                                    }`}>
                                    <Sparkles className="w-5 h-5 flex-shrink-0" />
                                    Ver Lançamentos
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
                        <div className="flex items-center justify-between mb-5">
                            <p className={`text-sm font-semibold italic ${t.muted(dark)}`}>
                                <span className="not-italic text-[#C01717] font-black text-base">{results.length}</span>
                                {' '}produto{results.length !== 1 ? 's' : ''} encontrado{results.length !== 1 ? 's' : ''}
                                {results.length === 5000 ? ' — mostrando os primeiros 5000' : ''}
                            </p>
                        </div>

                        {/* Cards — layout estilo catálogo web */}
                        <div className="flex flex-col gap-4">
                            {results.map(p => (
                                <ProdutoCard 
                                    key={p.id} 
                                    p={p} 
                                    dark={dark} 
                                    onOpenImage={() => {
                                        setSelectedProduct(p);
                                        setShowImageModal(true);
                                    }}
                                />
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

            {/* Modal de Imagem */}
            {showImageModal && selectedProduct && (
                <div 
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
                    onClick={() => setShowImageModal(false)}
                >
                    <div 
                        className="relative max-w-4xl w-full flex flex-col items-center"
                        onClick={e => e.stopPropagation()}
                    >
                        <button 
                            onClick={() => setShowImageModal(false)}
                            className="absolute -top-12 right-0 text-white hover:text-[#C01717] transition-colors p-2"
                        >
                            <X className="w-8 h-8" />
                        </button>
                        
                        <div className={`p-6 rounded-2xl ${dark ? 'bg-[#232328]' : 'bg-white'} shadow-2xl overflow-hidden border ${dark ? 'border-[#333]' : 'border-zinc-200'}`}>
                            <div className={`aspect-square w-full max-w-[500px] flex items-center justify-center rounded-xl border overflow-hidden ${dark ? 'bg-[#1a1a1e] border-[#333]' : 'bg-[#f5f5f5] border-[#e0e0e0]'}`}>
                                <ModalImage product={selectedProduct} dark={dark} />
                            </div>
                            
                            <div className="mt-6 text-center">
                                <span className="inline-block px-3 py-1 rounded-full bg-[#C01717]/10 text-[#C01717] text-xs font-black uppercase tracking-widest mb-2">
                                    Cód. Kalled
                                </span>
                                <h3 className="text-3xl font-black text-[#C01717] font-mono leading-none">{selectedProduct.cod}</h3>
                                <div className={`w-12 h-1 bg-[#C01717] mx-auto my-4 rounded-full`}></div>
                                <p className={`text-lg font-semibold ${dark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                                    {selectedProduct.descricao}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
