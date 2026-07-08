import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Users, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api, Cliente, ClienteVendasMes, ItensNaoComprados, formatCurrency, formatMonthLabel } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

function getStatusBadgeLabel(c: Cliente) {
    const status = c.Status ?? '';
    const isActive = status.toLowerCase() === 'ativo';
    if (isActive) return 'Ativo';
    
    if (!c.ultimaCompra) return 'Inativo (Sem compras)';
    
    const today = new Date();
    const lastDate = new Date(`${c.ultimaCompra}T12:00:00Z`);
    const diffMs = today.getTime() - lastDate.getTime();
    const diffMonths = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.44));
    
    if (diffMonths <= 0) return 'Inativo (< 1 mês)';
    return `Inativo (${diffMonths} ${diffMonths === 1 ? 'mês' : 'meses'})`;
}

function ChartTooltipContent({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-[#111113] border border-white/10 rounded-lg px-3 py-2 shadow-xl">
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
    const [ordem, setOrdem] = useState<'asc' | 'desc'>('asc');

    const { isAdmin } = useAuth();

    // Novos estados para o modal e edição de clientes
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [repsList, setRepsList] = useState<{ id?: string; nome: string }[]>([]);
    const [editFormData, setEditFormData] = useState({
        status: '',
        grupo: '',
        desconto: '',
        pagamento: '',
        prazo: '',
        representante_id: ''
    });
    const [updating, setUpdating] = useState(false);

    // Estados para unificação (mesclar) de clientes
    const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
    const [mergeSearch, setMergeSearch] = useState('');
    const [selectedDuplicates, setSelectedDuplicates] = useState<Cliente[]>([]);
    const [merging, setMerging] = useState(false);

    useEffect(() => {
        api.getClientes()
            .then(setClientes)
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));

        api.getRepresentantes()
            .then(setRepsList)
            .catch(console.error);
    }, []);

    const representantes = useMemo(() => {
        const set = new Set(clientes.map(c => c.Representante ?? '').filter(Boolean));
        return Array.from(set).sort();
    }, [clientes]);

    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        const res = clientes.filter(c => {
            const nome = (c.Cliente ?? c['Razão Social'] ?? '').toLowerCase();
            const matchSearch = !q || nome.includes(q);
            const matchRep = !filtroRep || c.Representante === filtroRep;
            const matchStatus = !filtroStatus || (c.Status ?? '').toLowerCase() === filtroStatus;
            return matchSearch && matchRep && matchStatus;
        });

        return res.sort((a, b) => {
            const nomeA = a.Cliente ?? a['Razão Social'] ?? '';
            const nomeB = b.Cliente ?? b['Razão Social'] ?? '';
            if (ordem === 'asc') {
                return nomeA.localeCompare(nomeB, 'pt-BR', { sensitivity: 'base' });
            } else {
                return nomeB.localeCompare(nomeA, 'pt-BR', { sensitivity: 'base' });
            }
        });
    }, [clientes, search, filtroRep, filtroStatus, ordem]);

    const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);

    // Auto-select client from URL param (e.g. navigated from Visitas)
    useEffect(() => {
        const param = searchParams.get('cliente');
        if (!param || clientes.length === 0) return;
        const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
        const found = clientes.find(c => norm(c.Cliente ?? c['Razão Social'] ?? '') === norm(param));
        if (found) {
            setSelectedCliente(found);
            const tabParam = searchParams.get('tab');
            if (tabParam === 'itens') {
                setActiveTab('itens');
                const nome = found.Cliente ?? found['Razão Social'] ?? '';
                if (nome) {
                    setLoadingItens(true);
                    api.getClienteItensNaoComprados(nome)
                        .then(setItensData)
                        .finally(() => setLoadingItens(false));
                }
            }
        }
    }, [clientes]);

    const [activeTab, setActiveTab] = useState<'info' | 'historico' | 'itens'>('info');
    const [clienteVendas, setClienteVendas] = useState<ClienteVendasMes[]>([]);
    const [itensData, setItensData] = useState<ItensNaoComprados | null>(null);
    const [loadingVendas, setLoadingVendas] = useState(false);
    const [loadingItens, setLoadingItens] = useState(false);
    const [filtroLinha, setFiltroLinha] = useState('');
    const [searchPN, setSearchPN] = useState('');

    useEffect(() => {
        const tabParam = searchParams.get('tab');
        if (tabParam !== 'itens') {
            setActiveTab('info');
            setItensData(null);
        }
        setClienteVendas([]);
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

    const exportToExcel = () => {
        if (!itensData || !selectedCliente) return;
        const nomeCliente = selectedCliente.Cliente ?? selectedCliente['Razão Social'] ?? 'cliente';
        
        const visibles = itensData.naoComprados.filter(item => {
            const matchPN = !searchPN || item.pn.toLowerCase().includes(searchPN.toLowerCase());
            const matchLinha = !filtroLinha || item.linhas.includes(filtroLinha);
            return matchPN && matchLinha;
        });

        const headers = ['Código Kalled (PN)', 'Descrição', 'Metal Leve (ML)', 'Sulloy', 'KS', 'Apex', 'Sintech (ST)'];
        const rows = visibles.map(item => [
            item.pn,
            item.descricao.replace(/;/g, ' '),
            item.refs['Metal Leve'] || '',
            item.refs['Sulloy'] || '',
            item.refs['KS'] || '',
            item.refs['Apex'] || '',
            item.refs['Sintech'] || '',
        ]);

        const csvContent = [
            headers.join(';'),
            ...rows.map(r => r.join(';'))
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `Itens_Nao_Comprados_${nomeCliente.replace(/\s+/g, '_')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportToTXT = () => {
        if (!itensData || !selectedCliente) return;
        const nomeCliente = selectedCliente.Cliente ?? selectedCliente['Razão Social'] ?? 'cliente';
        
        const visibles = itensData.naoComprados.filter(item => {
            const matchPN = !searchPN || item.pn.toLowerCase().includes(searchPN.toLowerCase());
            const matchLinha = !filtroLinha || item.linhas.includes(filtroLinha);
            return matchPN && matchLinha;
        });

        let txtContent = `ITENS NÃO COMPRADOS - CLIENTE: ${nomeCliente.toUpperCase()}\n`;
        txtContent += `Data de geração: ${new Date().toLocaleDateString('pt-BR')}\n`;
        txtContent += `Total de itens não comprados: ${visibles.length}\n`;
        txtContent += `================================================================================\n\n`;

        visibles.forEach((item, index) => {
            txtContent += `${String(index + 1).padStart(3, '0')}. CÓDIGO KALLED: ${item.pn}\n`;
            txtContent += `     Descrição: ${item.descricao || 'Sem descrição'}\n`;
            
            const refs = [];
            if (item.refs['Metal Leve']) refs.push(`Metal Leve (ML): ${item.refs['Metal Leve']}`);
            if (item.refs['Sulloy']) refs.push(`Sulloy: ${item.refs['Sulloy']}`);
            if (item.refs['KS']) refs.push(`KS: ${item.refs['KS']}`);
            if (item.refs['Apex']) refs.push(`Apex: ${item.refs['Apex']}`);
            if (item.refs['Sintech']) refs.push(`Sintech (ST): ${item.refs['Sintech']}`);
            
            txtContent += `     Conversões: ${refs.length > 0 ? refs.join(' | ') : 'Nenhuma conversão cadastrada'}\n`;
            txtContent += `--------------------------------------------------------------------------------\n`;
        });

        const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `Itens_Nao_Comprados_${nomeCliente.replace(/\s+/g, '_')}.txt`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleOpenEditModal = () => {
        if (!selectedCliente) return;
        setEditFormData({
            status: selectedCliente.status || '',
            grupo: selectedCliente.Grupo || '',
            desconto: selectedCliente.Desconto || '',
            pagamento: selectedCliente.Pagamento || '',
            prazo: selectedCliente.Prazo || '',
            representante_id: selectedCliente.representante_id || ''
        });
        setIsEditModalOpen(true);
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCliente || !selectedCliente.id) return;
        setUpdating(true);
        try {
            const updated = await api.updateCliente(selectedCliente.id, {
                status: editFormData.status,
                grupo: editFormData.grupo,
                desconto: editFormData.desconto,
                pagamento: editFormData.pagamento,
                prazo: editFormData.prazo,
                representante_id: editFormData.representante_id || undefined
            });
            
            // Atualiza a lista de clientes localmente
            setClientes(prev => prev.map(c => c.id === selectedCliente.id ? { ...c, ...updated } : c));
            // Atualiza o cliente selecionado
            setSelectedCliente(prev => prev ? { ...prev, ...updated } : null);
            setIsEditModalOpen(false);
        } catch (e: any) {
            alert(`Erro ao atualizar cadastro: ${e.message}`);
        } finally {
            setUpdating(false);
        }
    };

    const handleOpenMergeModal = () => {
        setSelectedDuplicates([]);
        setMergeSearch('');
        setIsMergeModalOpen(true);
    };

    const mergeCandidates = useMemo(() => {
        if (!selectedCliente) return [];
        const q = mergeSearch.toLowerCase();
        return clientes.filter(c => {
            if (c.id === selectedCliente.id) return false;
            if (selectedDuplicates.some(d => d.id === c.id)) return false;
            const name = (c.Cliente ?? c['Razão Social'] ?? '').toLowerCase();
            return !q || name.includes(q);
        }).slice(0, 10);
    }, [clientes, selectedCliente, mergeSearch, selectedDuplicates]);

    const handleAddDuplicate = (c: Cliente) => {
        setSelectedDuplicates(prev => [...prev, c]);
        setMergeSearch('');
    };

    const handleRemoveDuplicate = (id: string) => {
        setSelectedDuplicates(prev => prev.filter(c => c.id !== id));
    };

    const handleConfirmMerge = async () => {
        if (!selectedCliente || !selectedCliente.id || selectedDuplicates.length === 0) return;
        
        const confirmMsg = `Tem certeza que deseja mesclar os ${selectedDuplicates.length} clientes selecionados em "${selectedCliente.Cliente}"?\n\nEsta ação moverá todo o histórico de vendas/visitas e excluirá os outros cadastros permanentemente.`;
        if (!window.confirm(confirmMsg)) return;
        
        setMerging(true);
        try {
            await api.mergeClientes(selectedCliente.id, selectedDuplicates.map(d => d.id as string));
            
            // Remove localmente os clientes mesclados
            const duplicateIds = selectedDuplicates.map(d => d.id);
            setClientes(prev => prev.filter(c => !duplicateIds.includes(c.id)));
            
            // Limpa dados carregados do cliente para forçar recarga (já que agora ele tem novas vendas/visitas)
            setClienteVendas([]);
            setItensData(null);
            
            // Se estiver na aba historico ou itens, recarrega
            const nome = selectedCliente.Cliente ?? selectedCliente['Razão Social'] ?? '';
            if (activeTab === 'historico') {
                setLoadingVendas(true);
                api.getClienteVendasPorMes(nome).then(setClienteVendas).finally(() => setLoadingVendas(false));
            } else if (activeTab === 'itens') {
                setLoadingItens(true);
                api.getClienteItensNaoComprados(nome).then(setItensData).finally(() => setLoadingItens(false));
            }

            alert('Clientes unificados com sucesso!');
            setIsMergeModalOpen(false);
        } catch (e: any) {
            alert(`Erro ao unificar clientes: ${e.message}`);
        } finally {
            setMerging(false);
        }
    };

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
                <div className="flex items-center gap-2 bg-[#C01717]/10 border border-[#C01717]/20 rounded-xl px-4 py-2 backdrop-blur-md">
                    <Users className="w-4 h-4 text-[#e05050]" />
                    <span className="text-[#f87171] font-bold">{filtered.length}</span>
                    <span className="text-slate-400 text-sm font-medium">exibidos</span>
                </div>
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[160px] max-w-sm group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-[#e05050] transition-colors" />
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
                    <option value="" className="bg-[#111113]">Todos os rep.</option>
                    {representantes.map(r => (
                        <option key={r} value={r} className="bg-[#111113]">{r}</option>
                    ))}
                </select>
                <select
                    className="input max-w-[150px] cursor-pointer flex-1 min-w-[120px]"
                    value={ordem}
                    onChange={e => setOrdem(e.target.value as 'asc' | 'desc')}
                >
                    <option value="asc" className="bg-[#111113]">Ordem A-Z</option>
                    <option value="desc" className="bg-[#111113]">Ordem Z-A</option>
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:h-[calc(100vh-180px)]">
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
                                            className={`p-4 cursor-pointer transition-all border-l-2 ${isSelected ? 'bg-white/10 border-[#C01717]' : 'hover:bg-white/5 border-transparent'} group`}
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
                                                    {getStatusBadgeLabel(c)}
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
                            <div className="px-4 sm:px-8 pt-6 sm:pt-8 pb-4 relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                        <span className={`inline-flex items-center px-3 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide border ${selectedCliente.Status?.toLowerCase() === 'ativo'
                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.2)]'
                                            }`}>
                                            {selectedCliente.Status?.toLowerCase() === 'ativo' ? 'Cliente Ativo' : `Cliente ${getStatusBadgeLabel(selectedCliente)}`}
                                        </span>
                                        {selectedCliente.editado_manualmente && (
                                            <span className="inline-flex items-center px-3 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide border bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.2)] animate-pulse-slow">
                                                Editado via Front-end
                                            </span>
                                        )}
                                    </div>
                                    <h2 className="text-2xl font-bold text-white mb-1 tracking-tight truncate max-w-full">
                                        {selectedCliente.Cliente || selectedCliente['Razão Social'] || 'Sem Nome'}
                                    </h2>
                                    <p className="text-slate-400 text-sm font-medium truncate max-w-full">Documento Fiscal / Razão Social: {selectedCliente['Razão Social'] || selectedCliente.Cliente}</p>
                                </div>
                                <div className="flex-shrink-0 flex gap-2">
                                    {isAdmin && (
                                        <button 
                                            onClick={handleOpenMergeModal}
                                            className="w-full md:w-auto bg-amber-500/10 hover:bg-amber-500/25 text-amber-400 hover:text-white border border-amber-500/30 hover:border-amber-500/55 rounded-xl px-4 py-2 text-xs font-bold transition-all duration-200 cursor-pointer shadow-lg flex items-center justify-center gap-1.5"
                                        >
                                            Unificar Cadastros
                                        </button>
                                    )}
                                    <button 
                                        onClick={handleOpenEditModal}
                                        className="w-full md:w-auto bg-[#C01717]/10 hover:bg-[#C01717]/25 text-[#e05050] hover:text-white border border-[#C01717]/30 hover:border-[#C01717]/55 rounded-xl px-4 py-2 text-xs font-bold transition-all duration-200 cursor-pointer shadow-lg shadow-[#C01717]/5 flex items-center justify-center gap-1.5"
                                    >
                                        Editar Cadastro
                                    </button>
                                </div>
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
                                            ? 'text-[#e05050] border-[#e05050]'
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
                                                <div className="w-6 h-6 border-2 border-[#C01717] border-t-transparent rounded-full animate-spin" />
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
                                                                <Bar dataKey="total" fill="#C01717" radius={[4, 4, 0, 0]} />
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
                                                <div className="w-6 h-6 border-2 border-[#C01717] border-t-transparent rounded-full animate-spin" />
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
                                                    <div className="bg-[#C01717]/10 border border-[#C01717]/20 rounded-lg px-3 py-2 text-center">
                                                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">Cobertura</p>
                                                        <p className="text-xl font-bold text-[#e05050]">{itensData.totalItens > 0 ? Math.round(itensData.totalComprados / itensData.totalItens * 100) : 0}%</p>
                                                    </div>
                                                </div>
                                                    
                                                {/* Filters and Exports */}
                                                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 mb-4 bg-white/5 p-3 rounded-lg border border-white/5">
                                                    <div className="flex flex-wrap items-center gap-2 flex-1">
                                                        <div className="relative min-w-[140px] flex-1 max-w-[200px] group">
                                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 group-focus-within:text-[#e05050] transition-colors" />
                                                            <input
                                                                className="input pl-8 text-xs py-1.5"
                                                                placeholder="Buscar PN..."
                                                                value={searchPN}
                                                                onChange={e => setSearchPN(e.target.value)}
                                                            />
                                                        </div>
                                                        <div className="flex flex-wrap rounded-lg border border-white/10 overflow-hidden bg-black/20">
                                                            {(['', 'Metal Leve', 'Sulloy', 'KS', 'Apex', 'Sintech'] as const).map(linha => (
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
                                                    
                                                    {/* Export actions */}
                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                        <button 
                                                            onClick={exportToTXT}
                                                            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-755 hover:text-white border border-slate-700/50 hover:border-slate-600 rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-300 transition-all cursor-pointer"
                                                            title="Exportar como TXT formatado para enviar por WhatsApp ou Email"
                                                        >
                                                            <Download className="w-3.5 h-3.5 text-slate-400" />
                                                            <span>Exportar TXT</span>
                                                        </button>
                                                        <button 
                                                            onClick={exportToExcel}
                                                            className="flex items-center gap-1.5 bg-emerald-600/10 hover:bg-emerald-600/20 hover:text-white active:bg-emerald-600/30 border border-emerald-500/20 hover:border-emerald-500/30 rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400 transition-all cursor-pointer"
                                                            title="Exportar como planilha Excel / CSV"
                                                        >
                                                            <Download className="w-3.5 h-3.5 text-emerald-400" />
                                                            <span>Exportar Excel</span>
                                                        </button>
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
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-1">
                                                                {visibles.map(item => (
                                                                    <div key={item.pn} title={item.descricao || item.pn} className="flex flex-col bg-white/5 border border-white/5 rounded-lg px-3 py-2.5 gap-1.5 cursor-default hover:bg-white/10 hover:border-white/10 transition-colors">
                                                                        <div className="flex items-start justify-between gap-2">
                                                                            <span className="text-xs font-mono font-bold text-white truncate">{item.pn}</span>
                                                                            <div className="flex gap-1 flex-shrink-0">
                                                                                {item.linhas.map(l => (
                                                                                    <span key={l} className="text-[8px] font-bold px-1 py-0.5 rounded bg-white/5 text-slate-400 border border-white/5">
                                                                                        {l === 'Metal Leve' ? 'ML' : l === 'Sintech' ? 'ST' : l}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                        
                                                                        <p className="text-[10px] text-slate-400 line-clamp-1 italic leading-tight">{item.descricao || 'Sem descrição cadastrada'}</p>
                                                                        
                                                                        {filtroLinha ? (
                                                                            item.refs[filtroLinha] && (
                                                                                <div className="flex items-center gap-1.5 mt-0.5 pt-1.5 border-t border-white/5">
                                                                                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{filtroLinha === 'Metal Leve' ? 'ML' : filtroLinha === 'Sintech' ? 'ST' : filtroLinha}:</span>
                                                                                    <span className="text-[10px] font-mono font-bold text-[#e05050] bg-[#C01717]/10 px-1.5 py-0.5 rounded border border-[#C01717]/20">{item.refs[filtroLinha]}</span>
                                                                                </div>
                                                                            )
                                                                        ) : (
                                                                            <div className="flex flex-wrap gap-x-2 gap-y-1 mt-0.5 pt-1.5 border-t border-white/5">
                                                                                {item.linhas.map(l => (
                                                                                    <div key={l} className="flex items-center gap-1 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                                                                                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">{l === 'Metal Leve' ? 'ML' : l === 'Sintech' ? 'ST' : l}:</span>
                                                                                        <span className="text-[9px] font-mono font-bold text-amber-400/90">{item.refs[l]}</span>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-3 px-1">
                                                                <span>Exibindo {visibles.length} de {itensData.naoComprados.length} itens não comprados</span>
                                                                <span>Fabricante: {filtroLinha || 'Todos'}</span>
                                                            </div>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                )}
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

            {/* Modal de Edição */}
            {isEditModalOpen && selectedCliente && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="w-full max-w-lg bg-[#111113] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Editar Cadastro</h3>
                                <p className="text-xs text-slate-400 truncate max-w-[320px] mt-0.5">{selectedCliente.Cliente}</p>
                            </div>
                            <button 
                                onClick={() => setIsEditModalOpen(false)}
                                className="text-slate-400 hover:text-white transition-colors cursor-pointer text-xs font-bold bg-white/5 px-2.5 py-1 rounded-md border border-white/10"
                            >
                                Fechar
                            </button>
                        </div>

                        {/* Modal Form */}
                        <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Status</label>
                                    <select
                                        className="input w-full cursor-pointer bg-[#111113]"
                                        value={editFormData.status}
                                        onChange={e => setEditFormData(prev => ({ ...prev, status: e.target.value }))}
                                    >
                                        <option value="" className="bg-[#111113]">Automático (Última compra)</option>
                                        <option value="Ativo" className="bg-[#111113]">Ativo (Forçado)</option>
                                        <option value="Inativo" className="bg-[#111113]">Inativo (Forçado)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Grupo de Cliente</label>
                                    <input
                                        type="text"
                                        className="input w-full"
                                        placeholder="Ex: VIP, Varejo"
                                        value={editFormData.grupo}
                                        onChange={e => setEditFormData(prev => ({ ...prev, grupo: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Desconto Padrão</label>
                                    <input
                                        type="text"
                                        className="input w-full"
                                        placeholder="Ex: 10%, 15+5%"
                                        value={editFormData.desconto}
                                        onChange={e => setEditFormData(prev => ({ ...prev, desconto: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Prazo Médio</label>
                                    <input
                                        type="text"
                                        className="input w-full"
                                        placeholder="Ex: 30 dias, À vista"
                                        value={editFormData.prazo}
                                        onChange={e => setEditFormData(prev => ({ ...prev, prazo: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Forma de Pagamento</label>
                                <input
                                    type="text"
                                    className="input w-full"
                                    placeholder="Ex: Boleto Bancário, Cartão de Crédito"
                                    value={editFormData.pagamento}
                                    onChange={e => setEditFormData(prev => ({ ...prev, pagamento: e.target.value }))}
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Representante Responsável</label>
                                <select
                                    className="input w-full cursor-pointer bg-[#111113]"
                                    value={editFormData.representante_id}
                                    onChange={e => setEditFormData(prev => ({ ...prev, representante_id: e.target.value }))}
                                >
                                    <option value="" className="bg-[#111113]">Nenhum representante associado</option>
                                    {repsList.map(r => (
                                        <option key={r.id} value={r.id} className="bg-[#111113]">{r.nome}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Actions */}
                            <div className="pt-4 border-t border-white/5 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="btn-ghost text-xs px-5"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={updating}
                                    className="bg-[#C01717] hover:bg-[#a01313] text-white text-xs font-bold uppercase tracking-wider rounded-xl px-6 py-2.5 shadow-lg shadow-[#C01717]/20 border border-[#C01717]/10 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {updating ? (
                                        <>
                                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            <span>Salvando...</span>
                                        </>
                                    ) : (
                                        <span>Salvar Alterações</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Unificação (Mesclar) */}
            {isMergeModalOpen && selectedCliente && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-lg bg-[#111113] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Unificar Cadastros</h3>
                                <p className="text-xs text-amber-400 font-semibold mt-0.5">Destino: {selectedCliente.Cliente}</p>
                            </div>
                            <button 
                                onClick={() => setIsMergeModalOpen(false)}
                                className="text-slate-400 hover:text-white transition-colors cursor-pointer text-xs font-bold bg-white/5 px-2.5 py-1 rounded-md border border-white/10"
                            >
                                Fechar
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-4">
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-xs text-amber-400 space-y-1">
                                <p className="font-bold uppercase tracking-wider">⚠️ Atenção</p>
                                <p>Esta ação irá transferir permanentemente todas as vendas e visitas dos clientes duplicados selecionados para o cadastro de <strong>{selectedCliente.Cliente}</strong>.</p>
                                <p>Após a conclusão, as contas duplicadas serão excluídas.</p>
                            </div>

                            {/* Duplicados Selecionados */}
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Clientes Duplicados Selecionados ({selectedDuplicates.length})</label>
                                {selectedDuplicates.length === 0 ? (
                                    <p className="text-slate-500 text-xs italic">Nenhum cliente selecionado ainda. Busque-os abaixo.</p>
                                ) : (
                                    <div className="space-y-2 max-h-[120px] overflow-y-auto pr-1">
                                        {selectedDuplicates.map(d => (
                                            <div key={d.id} className="flex justify-between items-center bg-white/5 px-3 py-2 rounded-lg border border-white/5">
                                                <div className="min-w-0">
                                                    <p className="text-xs font-semibold text-slate-300 truncate">{d.Cliente}</p>
                                                    <p className="text-[10px] text-slate-500 truncate">{d.Representante || 'Sem Representante'}</p>
                                                </div>
                                                <button
                                                    onClick={() => handleRemoveDuplicate(d.id as string)}
                                                    className="text-rose-400 hover:text-rose-300 text-xs font-bold px-2 py-1 cursor-pointer"
                                                >
                                                    Remover
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Busca de Duplicados */}
                            <div className="space-y-2 relative">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Buscar cadastros duplicados</label>
                                <input
                                    type="text"
                                    className="input w-full"
                                    placeholder="Digite o nome do duplicado..."
                                    value={mergeSearch}
                                    onChange={e => setMergeSearch(e.target.value)}
                                />
                                {mergeSearch.trim() && mergeCandidates.length > 0 && (
                                    <div className="absolute left-0 right-0 mt-1 bg-[#18181b] border border-white/10 rounded-lg shadow-xl z-20 max-h-[160px] overflow-y-auto divide-y divide-white/5">
                                        {mergeCandidates.map(c => (
                                            <div
                                                key={c.id}
                                                onClick={() => handleAddDuplicate(c)}
                                                className="p-3 cursor-pointer hover:bg-white/5 transition-colors text-left"
                                            >
                                                <p className="text-xs font-semibold text-slate-300">{c.Cliente}</p>
                                                <p className="text-[10px] text-slate-500">{c.Representante || 'Sem Representante'}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {mergeSearch.trim() && mergeCandidates.length === 0 && (
                                    <div className="absolute left-0 right-0 mt-1 bg-[#18181b] border border-white/10 rounded-lg p-3 text-xs text-slate-500 italic">
                                        Nenhum candidato encontrado.
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="pt-4 border-t border-white/5 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsMergeModalOpen(false)}
                                    className="px-4 py-2 rounded-xl border border-white/10 text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    disabled={merging || selectedDuplicates.length === 0}
                                    onClick={handleConfirmMerge}
                                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold text-xs transition-all flex items-center gap-1.5"
                                >
                                    {merging ? 'Unificando...' : 'Confirmar Unificação'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
