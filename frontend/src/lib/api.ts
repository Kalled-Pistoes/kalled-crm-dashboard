const API_BASE = import.meta.env.VITE_API_URL || window.location.origin;

function authHeader(): Record<string, string> {
    const t = localStorage.getItem('crm_token');
    return t ? { Authorization: `Bearer ${t}` } : {};
}

async function fetchJson<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${API_BASE}${path}`);
    if (params) {
        Object.entries(params).forEach(([key, value]) => {
            if (value) url.searchParams.append(key, value);
        });
    }
    const res = await fetch(url.toString(), { headers: authHeader() });
    if (!res.ok) throw new Error(`Erro ao buscar ${path}: ${res.statusText}`);
    return res.json();
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface Filters {
    ano?: string;
    mes?: string;
    linha?: string;
    grupo?: string;
}

// ... existing interfaces ... (they stay the same)
export interface DashboardStats {
    totalVendas: number;
    totalClientes: number;
    totalProdutos: number;
    totalRepresentantes: number;
    valorTotalVendas: number;
    valorTotalVendasAnoAnterior: number;
    totalPecas: number;
    totalPecasAnoAnterior: number;
}

export interface Venda {
    data: string;
    cliente: string;
    codigo: string;
    quantidade: number;
    valor: number;
}

export interface Cliente {
    Cliente?: string;
    'Razão Social'?: string;
    Representante?: string;
    Status?: string;
    Desconto?: string;
    Pagamento?: string;
    Prazo?: string;
    ultimaCompra?: string;
}

export interface Representante {
    nome: string;
    estado: string;
    meta: number;
}

export interface RankingVendedor {
    nome: string;
    faturamento: number;
    media: number;
    meta: number;
    percentMeta: number;
}

export interface TopSKU {
    nome: string;
    quantidade: number;
}

export interface ClienteTop {
    nome: string;
    totalVendas: number;
    valorTotal: number;
    estado: string;
}

export interface VendasMes {
    mes: string;
    total: number;
}

export interface VendasEstado {
    estado: string;
    total: number;
}

export interface VendasAnoComparativo {
    ano: string;
    total: number;
}

export interface ClienteVendasMes {
    mes: string;
    total: number;
}

export interface ItemNaoComprado {
    pn: string;
    descricao: string;
    linhas: string[];
    refs: Record<string, string>;
}

export interface ItensNaoComprados {
    totalItens: number;
    totalComprados: number;
    naoComprados: ItemNaoComprado[];
}

export interface Visita {
    data: string;
    tipoVisita: string;
    responsavelVisita: string;
    representante: string;
    cliente: string;
    status: string;
    objetivosMetas: string;
    potencialCompra: number;
    custo: number;
}

export interface RepresentanteVendas {
    representante: string;
    totalVendas: number;
    meta?: number;
}

export interface RepVisitasMes {
    mes: string;
    custo: number;
}

export interface RepresentanteCliente {
    nome: string;
    ultimaCompra: string | null;
    status: string;
}

export interface RepresentanteVisitaCliente {
    cliente: string;
    custo: number;
    mes: string;
}

export interface ComparativoClienteItem {
    nome: string;
    total: number;
}

export interface ComparativoAnoData {
    ano: string;
    total: number;
    meta: number;
    percentMeta: number | null;
    clientes: ComparativoClienteItem[];
}

// ── Funções de API ────────────────────────────────────────────────────────────

export const api = {
    getDashboardStats: (filters?: Filters) => fetchJson<DashboardStats>('/api/dashboard/stats', filters as any),
    getVendas: (filters?: Filters) => fetchJson<Venda[]>('/api/vendas', filters as any),
    getVendasRecentes: (filters?: Filters) => fetchJson<Venda[]>('/api/vendas/recent', filters as any),
    getVendasPorMes: (filters?: Filters) => fetchJson<VendasMes[]>('/api/vendas/por-mes', filters as any),
    getVendasPorEstado: (filters?: Filters) => fetchJson<VendasEstado[]>('/api/vendas/por-estado', filters as any),
    getRanking: (filters?: Filters) => fetchJson<RankingVendedor[]>('/api/vendas/ranking', filters as any),
    getVendasPorRepresentante: (filters?: Filters) => fetchJson<RepresentanteVendas[]>('/api/vendas/por-representante', filters as any),
    getClientes: () => fetchJson<Cliente[]>('/api/clientes'),
    getClienteVendasPorMes: (nome: string) => fetchJson<ClienteVendasMes[]>(`/api/clientes/${encodeURIComponent(nome)}/vendas-por-mes`),
    getClienteItensNaoComprados: (nome: string) => fetchJson<ItensNaoComprados>(`/api/clientes/${encodeURIComponent(nome)}/itens-nao-comprados`),
    getClientesTop: (filters?: Filters) => fetchJson<ClienteTop[]>('/api/clientes/top', filters as any),
    getRepresentantes: () => fetchJson<Representante[]>('/api/representantes'),
    getRepresentanteVendasPorMes: (nome: string) => fetchJson<ClienteVendasMes[]>(`/api/representantes/${encodeURIComponent(nome)}/vendas-por-mes`),
    getRepresentanteVisitasPorMes: (nome: string) => fetchJson<RepVisitasMes[]>(`/api/representantes/${encodeURIComponent(nome)}/visitas-por-mes`),
    getRepresentanteClientes: (nome: string) => fetchJson<RepresentanteCliente[]>(`/api/representantes/${encodeURIComponent(nome)}/clientes`),
    getRepresentanteVisitasPorCliente: (nome: string) => fetchJson<RepresentanteVisitaCliente[]>(`/api/representantes/${encodeURIComponent(nome)}/visitas-por-cliente`),
    getRepresentanteComparativoMes: (nome: string, mes: string) => fetchJson<ComparativoAnoData[]>(`/api/representantes/${encodeURIComponent(nome)}/comparativo-mes?mes=${mes}`),
    getRepresentanteClientesPeriodo: (nome: string, params: { mes?: string; ano?: string }) => fetchJson<string[]>(`/api/representantes/${encodeURIComponent(nome)}/clientes-periodo`, params as any),
    getVisitas: (filters?: Filters) => fetchJson<Visita[]>('/api/visitas', filters as any),
    getTopSkus: (filters?: Filters) => fetchJson<TopSKU[]>('/api/vendas/top-skus', filters as any),
    getVendasComparativoAnual: () => fetchJson<VendasAnoComparativo[]>('/api/vendas/comparativo-anual'),
};

// ── Formatadores ──────────────────────────────────────────────────────────────

export function formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
}

export function formatDate(dateStr: string): string {
    if (!dateStr) return '—';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
}

export function formatMonthLabel(mes: string): string {
    if (!mes) return '';
    const [year, month] = mes.split('-');
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
        'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${months[parseInt(month) - 1]}/${year.slice(2)}`;
}
