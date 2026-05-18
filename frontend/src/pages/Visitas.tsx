import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Search, CheckCircle2, Calendar, PlayCircle, XCircle, AlertCircle, HelpCircle, 
    ChevronRight, ArrowLeft, Building, User, DollarSign, Target, Briefcase, TrendingUp 
} from 'lucide-react';
import { api, Visita, formatDate } from '../lib/api';


const STATUS_CONFIG: Record<string, { 
    label: string; 
    color: string; 
    bg: string; 
    border: string; 
    borderActive: string;
    ringActive: string;
    text: string; 
    icon: any; 
}> = {
    'concluida': { label: 'Concluída', color: '#10b981', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', borderActive: 'border-emerald-500', ringActive: 'ring-1 ring-emerald-500/30', text: 'text-emerald-400', icon: CheckCircle2 },
    'concluido': { label: 'Concluido', color: '#10b981', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', borderActive: 'border-emerald-500', ringActive: 'ring-1 ring-emerald-500/30', text: 'text-emerald-400', icon: CheckCircle2 },
    'realizada': { label: 'Realizada', color: '#10b981', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', borderActive: 'border-emerald-500', ringActive: 'ring-1 ring-emerald-500/30', text: 'text-emerald-400', icon: CheckCircle2 },
    'realizado': { label: 'Realizado', color: '#10b981', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', borderActive: 'border-emerald-500', ringActive: 'ring-1 ring-emerald-500/30', text: 'text-emerald-400', icon: CheckCircle2 },
    'agendada': { label: 'Agendada', color: '#0ea5e9', bg: 'bg-sky-500/10', border: 'border-sky-500/20', borderActive: 'border-sky-500', ringActive: 'ring-1 ring-sky-500/30', text: 'text-sky-400', icon: Calendar },
    'agendado': { label: 'Agendado', color: '#0ea5e9', bg: 'bg-sky-500/10', border: 'border-sky-500/20', borderActive: 'border-sky-500', ringActive: 'ring-1 ring-sky-500/30', text: 'text-sky-400', icon: Calendar },
    'em andamento': { label: 'Em Andamento', color: '#f59e0b', bg: 'bg-amber-500/10', border: 'border-amber-500/20', borderActive: 'border-amber-500', ringActive: 'ring-1 ring-amber-500/30', text: 'text-amber-400', icon: PlayCircle },
    'planejada': { label: 'Planejada', color: '#6366f1', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', borderActive: 'border-indigo-500', ringActive: 'ring-1 ring-indigo-500/30', text: 'text-indigo-400', icon: Calendar },
    'planejado': { label: 'Planejado', color: '#6366f1', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', borderActive: 'border-indigo-500', ringActive: 'ring-1 ring-indigo-500/30', text: 'text-indigo-400', icon: Calendar },
    'cancelada': { label: 'Cancelada', color: '#ef4444', bg: 'bg-rose-500/10', border: 'border-rose-500/20', borderActive: 'border-rose-500', ringActive: 'ring-1 ring-rose-500/30', text: 'text-rose-400', icon: XCircle },
    'cancelado': { label: 'Cancelado', color: '#ef4444', bg: 'bg-rose-500/10', border: 'border-rose-500/20', borderActive: 'border-rose-500', ringActive: 'ring-1 ring-rose-500/30', text: 'text-rose-400', icon: XCircle },
    'pendente': { label: 'Pendente', color: '#a855f7', bg: 'bg-purple-500/10', border: 'border-purple-500/20', borderActive: 'border-purple-500', ringActive: 'ring-1 ring-purple-500/30', text: 'text-purple-400', icon: AlertCircle },
    'nao especificado': { label: 'Não Especificado', color: '#6b7280', bg: 'bg-slate-500/10', border: 'border-slate-500/20', borderActive: 'border-slate-500', ringActive: 'ring-1 ring-slate-500/30', text: 'text-slate-400', icon: HelpCircle },
};

function getStatusStyle(status: string) {
    const key = (status || '').trim().toLowerCase();
    if (!key) return STATUS_CONFIG['nao especificado'];
    
    for (const [k, config] of Object.entries(STATUS_CONFIG)) {
        if (key === k || key.includes(k)) {
            return config;
        }
    }
    
    return {
        label: status,
        color: '#6b7280',
        bg: 'bg-slate-500/10',
        border: 'border-slate-500/20',
        borderActive: 'border-slate-500',
        ringActive: 'ring-1 ring-slate-500/30',
        text: 'text-slate-400',
        icon: HelpCircle
    };
}

export default function Visitas() {
    const navigate = useNavigate();

    const [visitas, setVisitas] = useState<Visita[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [filtroRep, setFiltroRep] = useState('');
    const [filtroTipo, setFiltroTipo] = useState('');
    const [selectedVisita, setSelectedVisita] = useState<Visita | null>(null);


    useEffect(() => {
        setLoading(true);
        api.getVisitas()
            .then(setVisitas)
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

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



    // Auto-seleciona a primeira visita no desktop quando os dados carregam ou mudam de filtro
    useEffect(() => {
        if (filtered.length > 0) {
            const exists = filtered.some(v => v.id === selectedVisita?.id);
            if (!exists) {
                if (window.innerWidth >= 768) {
                    setSelectedVisita(filtered[0]);
                } else {
                    setSelectedVisita(null);
                }
            }
        } else {
            setSelectedVisita(null);
        }
    }, [filtered]);

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-[#C01717] border-t-transparent rounded-full animate-spin" />
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
                    <div className="card-premium py-2 sm:py-3 px-4 sm:px-5 border-[#C01717]/20 shadow-none">
                        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Visitas</p>
                        <p className="text-base sm:text-lg font-bold text-[#e05050]">{filtered.length.toLocaleString('pt-BR')}</p>
                    </div>
                </div>
            </div>

            {/* Filtros */}
            <div className={`flex flex-wrap gap-3 ${selectedVisita ? 'hidden md:flex' : 'flex'}`}>
                <div className="relative flex-1 min-w-[160px] max-w-sm group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-[#e05050] transition-colors" />
                    <input
                        id="input-search-visita"
                        className="input pl-9"
                        placeholder="Buscar cliente ou representante..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <select
                    id="select-filtro-representante"
                    className="input max-w-[200px] cursor-pointer"
                    value={filtroRep}
                    onChange={e => setFiltroRep(e.target.value)}
                >
                    <option value="" className="bg-[#111113]">Todos os representantes</option>
                    {representantes.map(r => <option key={r} value={r} className="bg-[#111113]">{r}</option>)}
                </select>
                <select
                    id="select-filtro-tipo"
                    className="input max-w-[180px] cursor-pointer"
                    value={filtroTipo}
                    onChange={e => setFiltroTipo(e.target.value)}
                >
                    <option value="" className="bg-[#111113]">Todos os tipos</option>
                    {tipos.map(t => <option key={t} value={t} className="bg-[#111113]">{t}</option>)}
                </select>
            </div>

            {/* Split Layout Container */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                
                {/* LISTA DE VISITAS (Esquerda) */}
                <div className={`md:col-span-5 space-y-3 ${selectedVisita ? 'hidden md:block' : 'block'}`}>
                    <div className="flex items-center justify-between px-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Lista de Visitas ({filtered.length})
                        </span>
                        {filtered.length > 300 && (
                            <span className="text-[9px] text-slate-500 font-medium">Mostrando 300</span>
                        )}
                    </div>
                    
                    <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/5 hover:scrollbar-thumb-white/10 scrollbar-track-transparent">
                        {filtered.length === 0 ? (
                            <div className="card border-slate-800 text-center py-12 bg-white/5">
                                <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                                <p className="text-slate-400 font-medium">Nenhuma visita encontrada</p>
                                <p className="text-slate-600 text-xs mt-1">Experimente mudar os termos de busca ou filtros.</p>
                            </div>
                        ) : (
                            filtered.slice(0, 300).map((v, i) => {
                                const isSelected = selectedVisita?.id === v.id;
                                const style = getStatusStyle(v.status);
                                const StatusIcon = style.icon;
                                
                                return (
                                    <button
                                        key={v.id}
                                        id={`visit-item-${i}`}
                                        onClick={() => setSelectedVisita(v)}
                                        className={`w-full text-left p-4 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col gap-2 group relative overflow-hidden focus:outline-none focus:ring-1 focus:ring-[#C01717]/40 ${
                                            isSelected 
                                                ? 'bg-gradient-to-r from-white/10 to-white/5 border-white/20 shadow-lg shadow-[#C01717]/5' 
                                                : 'bg-white/5 hover:bg-white/10 border-white/5 hover:border-white/10'
                                        }`}
                                    >
                                        {/* Indicador de Selecionado */}
                                        {isSelected && (
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#C01717]" />
                                        )}
                                        
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                {formatDate(v.data)}
                                            </span>
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${style.bg} ${style.text} ${style.border}`}>
                                                <StatusIcon className="w-2.5 h-2.5" />
                                                {style.label}
                                            </span>
                                        </div>
                                        
                                        <div>
                                            <h3 className={`font-semibold text-sm transition-colors ${
                                                isSelected ? 'text-[#f87171]' : 'text-white group-hover:text-[#f87171]'
                                            }`}>
                                                {v.cliente || 'Sem Cliente'}
                                            </h3>
                                            <p className="text-slate-400 text-xs mt-0.5 font-medium flex items-center gap-1">
                                                <User className="w-3 h-3 text-slate-500" />
                                                {v.representante}
                                            </p>
                                        </div>

                                        <div className="flex items-center justify-between border-t border-white/5 pt-2 mt-1">
                                            <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                                {v.tipoVisita || '—'}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                {v.custo > 0 && (
                                                    <span className="text-xs font-bold text-amber-400">
                                                        {formatCurrency(v.custo)}
                                                    </span>
                                                )}
                                                <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${
                                                    isSelected ? 'translate-x-0.5 text-white' : 'group-hover:translate-x-0.5 group-hover:text-slate-300'
                                                }`} />
                                            </div>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* DETALHES DA VISITA (Direita) */}
                <div className={`md:col-span-7 ${selectedVisita ? 'block' : 'hidden md:block'}`}>
                    {selectedVisita ? (
                        <div className="sticky top-6 space-y-4">
                            
                            {/* Botão voltar no mobile */}
                            <button
                                id="btn-back-to-list"
                                onClick={() => setSelectedVisita(null)}
                                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors cursor-pointer text-xs font-bold uppercase tracking-wider mb-4 md:hidden py-2 px-3 rounded-lg bg-white/5 border border-white/5"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Voltar para Lista
                            </button>

                            {/* Card Premium de Detalhes */}
                            <div className="card-premium overflow-hidden border-t-2 border-t-[#C01717] bg-gradient-to-b from-white/5 to-transparent relative shadow-2xl p-6 sm:p-8 space-y-6">
                                
                                {/* Top Banner / Badge de Status */}
                                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white font-bold text-lg shadow-inner">
                                            <Building className="w-6 h-6 text-[#e05050]" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                Visita Técnica • {formatDate(selectedVisita.data)}
                                            </span>
                                            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-0.5">
                                                {selectedVisita.cliente || 'Cliente não especificado'}
                                            </h2>
                                        </div>
                                    </div>
                                    
                                    {/* Status Badge */}
                                    {(() => {
                                        const style = getStatusStyle(selectedVisita.status);
                                        const StatusIcon = style.icon;
                                        return (
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${style.bg} ${style.text} ${style.border}`}>
                                                <StatusIcon className="w-3.5 h-3.5" />
                                                {style.label}
                                            </span>
                                        );
                                    })()}
                                </div>

                                {/* Módulos em Grid (Dados Rápidos) */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    
                                    <div className="p-4 rounded-xl border border-white/5 bg-white/5 flex flex-col gap-1">
                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Custo da Visita</span>
                                        <span className="text-base font-bold text-amber-400 flex items-center gap-1 mt-1">
                                            <DollarSign className="w-4 h-4 text-amber-500" />
                                            {selectedVisita.custo > 0 ? formatCurrency(selectedVisita.custo) : 'R$ 0'}
                                        </span>
                                    </div>
                                    
                                    <div className="p-4 rounded-xl border border-white/5 bg-white/5 flex flex-col gap-1">
                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Potencial de Compra</span>
                                        <span className="text-base font-bold text-emerald-400 flex items-center gap-1 mt-1">
                                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                                            {selectedVisita.potencialCompra > 0 ? formatCurrency(selectedVisita.potencialCompra) : '—'}
                                        </span>
                                    </div>
                                    
                                    <div className="p-4 rounded-xl border border-white/5 bg-white/5 flex flex-col gap-1">
                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Tipo de Visita</span>
                                        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider mt-1 px-2 py-0.5 rounded border border-[#C01717]/20 bg-[#C01717]/10 text-center truncate">
                                            {selectedVisita.tipoVisita || 'Não Especificado'}
                                        </span>
                                    </div>
                                    
                                </div>

                                {/* Pessoas Envolvidas */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-white/5 pt-5">
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                            <User className="w-3.5 h-3.5 text-slate-500" /> Representante Comercial
                                        </span>
                                        <p className="text-sm font-semibold text-white pl-4.5">
                                            {selectedVisita.representante || '—'}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                            <Briefcase className="w-3.5 h-3.5 text-slate-500" /> Responsável Técnico
                                        </span>
                                        <p className="text-sm font-semibold text-white pl-4.5">
                                            {selectedVisita.responsavelVisita || '—'}
                                        </p>
                                    </div>
                                </div>

                                {/* Objetivos e Metas */}
                                <div className="space-y-2 border-t border-white/5 pt-5">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                        <Target className="w-3.5 h-3.5 text-[#e05050]" /> Objetivos, Metas e Observações
                                    </span>
                                    <div className="p-5 rounded-xl border border-white/5 bg-white/5 relative overflow-hidden">
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#C01717]/50" />
                                        <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap font-medium">
                                            {selectedVisita.objetivosMetas || 'Nenhum objetivo ou meta foi registrado para esta visita técnica.'}
                                        </p>
                                    </div>
                                </div>

                                {/* Footer do Card / Atalho para Ficha do Cliente */}
                                {selectedVisita.cliente && (
                                    <div className="border-t border-white/5 pt-5 flex justify-end">
                                        <button
                                            id="btn-view-client-details"
                                            onClick={() => navigate(`/clientes?cliente=${encodeURIComponent(selectedVisita.cliente)}`)}
                                            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#C01717] hover:bg-[#e05050] text-white text-xs font-bold uppercase tracking-wider transition-all duration-200 shadow-lg shadow-[#C01717]/10 flex items-center justify-center gap-2 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#C01717]/30"
                                        >
                                            Ver Ficha Completa do Cliente
                                            <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                                        </button>
                                    </div>
                                )}

                            </div>
                        </div>
                    ) : (
                        /* Placeholder de Seleção de Visita */
                        <div className="sticky top-6 card-premium border-dashed border-white/10 p-12 text-center flex flex-col items-center justify-center h-[400px] bg-gradient-to-b from-white/[0.02] to-transparent shadow-none">
                            <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 mb-4 animate-pulse">
                                <Calendar className="w-8 h-8 text-slate-400" />
                            </div>
                            <h3 className="text-base font-bold text-white tracking-wide uppercase">Detalhes da Visita</h3>
                            <p className="text-slate-400 text-sm max-w-sm mt-2 font-medium leading-relaxed">
                                Selecione uma visita técnica na lista à esquerda para carregar as informações detalhadas, custos, metas e objetivos.
                            </p>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
