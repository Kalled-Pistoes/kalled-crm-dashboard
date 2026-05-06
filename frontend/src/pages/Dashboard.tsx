import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, ReferenceLine,
    PieChart, Pie, Cell
} from 'recharts';
import {
    DollarSign, TrendingUp, Package
} from 'lucide-react';
import KPICard from '../components/KPICard';
import RankingTable from '../components/RankingTable';
import {
    api, formatCurrency, DashboardStats, VendasMes, RankingVendedor, TopSKU, VendasAnoComparativo, Filters, ClienteTop
} from '../lib/api';
import TopClientes from '../components/TopClientes';

const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function Dashboard() {
    const [searchParams] = useSearchParams();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [vendasMes, setVendasMes] = useState<VendasMes[]>([]);
    const [vendasAno, setVendasAno] = useState<VendasAnoComparativo[]>([]);
    const [ranking, setRanking] = useState<RankingVendedor[]>([]);
    const [topSkus, setTopSkus] = useState<TopSKU[]>([]);
    const [topClientes, setTopClientes] = useState<ClienteTop[]>([]);
    const [loading, setLoading] = useState(true);

    const filters: Filters = {
        ano: searchParams.get('ano') || String(new Date().getFullYear()),
        mes: searchParams.get('mes') || undefined,
        grupo: searchParams.get('grupo') || undefined,
    };

    // Dados mockados para o Ranking (já que o backend atual não tem fotos/rank pronto)


    useEffect(() => {
        setLoading(true);
        Promise.all([
            api.getDashboardStats(filters),
            api.getVendasPorMes(filters),
            api.getRanking(filters),
            api.getTopSkus(filters),
            api.getVendasComparativoAnual(),
            api.getClientesTop(filters),
        ])
            .then(([s, vm, r, skus, va, tc]) => {
                setStats(s);
                setVendasMes(vm.slice(-12));
                setRanking(r);
                setTopSkus(skus);
                setVendasAno(va);
                setTopClientes(tc);
            })
            .catch(e => {
                console.error('Erro ao carregar dados do dashboard:', e);
            })
            .finally(() => setLoading(false));
    }, [searchParams]);

    if (loading) return (
        <div className="flex items-center justify-center h-full">
            <div className="w-10 h-10 border-4 border-[#C01717] border-t-transparent rounded-full animate-spin" />
        </div>
    );

    // Cálculo de dados para o Dashboard
    const totalPecas = stats?.totalPecas ?? 0;
    const totalPecasAnterior = stats?.totalPecasAnoAnterior ?? 0;
    const vAtual = stats?.valorTotalVendas ?? 0;
    const vAnterior = stats?.valorTotalVendasAnoAnterior ?? 0;

    const metaMensal = 600000;
    const numMeses = filters.mes ? 1 : 12;
    const metaTotal = metaMensal * numMeses;
    const atingimentoMeta = vAtual ? (vAtual / metaTotal) * 100 : 0;

    // Tendências vs. Ano Anterior
    const trendFaturamento = vAnterior > 0 ? ((vAtual / vAnterior) - 1) * 100 : 0;
    const atingimentoAnterior = vAnterior ? (vAnterior / metaTotal) * 100 : 0;
    const trendAtingimento = atingimentoAnterior > 0 ? ((atingimentoMeta / atingimentoAnterior) - 1) * 100 : 0;

    // Ticket Médio = Faturamento / Peças Vendidas
    const ticketMedio = totalPecas > 0 ? vAtual / totalPecas : 0;
    const ticketMedioAnterior = totalPecasAnterior > 0 ? vAnterior / totalPecasAnterior : 0;
    const trendTicketMedio = ticketMedioAnterior > 0 ? ((ticketMedio / ticketMedioAnterior) - 1) * 100 : 0;

    // Dados do Gráfico de Rosca (Apenas Top 5 SKUs)
    const donutData = topSkus.map(s => ({ name: s.nome, value: s.quantidade }));
    const COLORS = ['#C01717', '#e05050', '#a01414', '#f97316', '#801010'];


    return (
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 lg:h-full lg:overflow-hidden">
            {/* Main Content Area */}
            <div className="flex-1 flex flex-col gap-4 lg:gap-6 overflow-y-auto lg:pr-2">
                {/* KPIs Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-6">
                    <KPICard
                        title="Faturamento"
                        value={formatCurrency(vAtual)}
                        icon={DollarSign}
                        trend={trendFaturamento}
                        variant="purple"
                    />
                    <KPICard
                        title="Atingimento Meta"
                        value={`${atingimentoMeta.toFixed(1)}%`}
                        icon={TrendingUp}
                        trend={trendAtingimento}
                        variant="pink"
                    />
                    <KPICard
                        title="Ticket Médio"
                        value={formatCurrency(ticketMedio)}
                        icon={DollarSign}
                        trend={trendTicketMedio}
                        variant="green"
                    />
                    <KPICard
                        title="Total Peças"
                        value={totalPecas.toLocaleString('pt-BR')}
                        icon={Package}
                        trend={totalPecasAnterior > 0 ? ((totalPecas / totalPecasAnterior) - 1) * 100 : 0}
                        variant="blue"
                    />
                </div>

                {/* Charts: Row 2 */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 lg:min-h-[320px]">
                    <div className="h-[280px] lg:h-full">
                        <TopClientes clientes={topClientes} />
                    </div>

                    <div className="lg:col-span-2 card flex flex-col overflow-hidden h-[280px] lg:h-full">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Evolução Anual Comparativa</h3>
                        </div>
                        <div className="flex-1 min-h-[220px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={vendasAno} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                                    <XAxis
                                        dataKey="ano"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }}
                                    />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={(val) => `R$ ${(val / 1000000).toFixed(1)}M`} />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                        contentStyle={{ backgroundColor: '#111113', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)', color: '#f0f0f0' }}
                                        itemStyle={{ color: '#fff' }}
                                        formatter={(value: any) => [formatCurrency(value), 'Faturamento']}
                                    />
                                    <Bar dataKey="total" radius={[6, 6, 0, 0]} barSize={40}>
                                        {vendasAno.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.ano === filters.ano ? '#C01717' : '#a01414'} fillOpacity={entry.ano === filters.ano ? 1 : 0.55} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Charts: Row 3 */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 lg:h-[280px]">
                    <div className="lg:col-span-2 card flex flex-col overflow-hidden h-[260px] lg:h-full">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Evolução de Vendas ({filters.ano})</h3>
                            <div className="flex gap-4 text-[9px] font-bold uppercase tracking-widest">
                                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#C01717] shadow-[0_0_8px_rgba(192,23,23,0.5)]" /> Faturamento</span>
                                <span className="flex items-center gap-1.5"><div className="w-2 h-0.5 bg-[#f97316]" /> Meta</span>
                            </div>
                        </div>
                        <div className="flex-1 min-h-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={vendasMes} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                                    <XAxis
                                        dataKey="mes"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 9, fill: '#64748b' }}
                                        tickFormatter={(val: string) => {
                                            if (!val) return '';
                                            const parts = val.split('-');
                                            if (parts.length < 2) return val;
                                            return monthNames[parseInt(parts[1]) - 1].substring(0, 3);
                                        }}
                                    />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={(val) => `R$ ${val / 1000}k`} />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                        contentStyle={{ backgroundColor: '#111113', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)', color: '#f0f0f0' }}
                                        itemStyle={{ color: '#fff' }}
                                        labelFormatter={(label: any) => label}
                                        formatter={(value: any) => [formatCurrency(value), 'Vendas (R$)']}
                                    />
                                    <Bar dataKey="total" fill="#C01717" radius={[4, 4, 0, 0]} barSize={20} fillOpacity={0.85} />
                                    <ReferenceLine y={metaMensal} stroke="#f97316" strokeDasharray="3 3" label={{ position: 'right', value: 'Meta', fill: '#f97316', fontSize: 8, fontWeight: 'bold' }} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="h-[260px] lg:h-full">
                        <RankingTable vendedores={ranking.slice(0, 5)} />
                    </div>
                </div>

                {/* Espaçamento inferior */}
                <div className="mb-4" />
            </div>

            {/* Right Sidebar Analysis */}
            <div className="w-full lg:w-80 bg-[#1f1f23]/80 backdrop-blur-3xl border-t lg:border-t-0 lg:border-l border-[#2a2a2a] p-4 lg:p-6 shadow-2xl flex flex-col gap-6 lg:gap-8 lg:overflow-hidden z-10">
                <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#C01717] mb-6 text-center">SKU (Top 5 Qtd)</h3>
                    <div className="h-40 relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={donutData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={45}
                                    outerRadius={65}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {donutData.map((_entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#111113', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)', color: '#f0f0f0' }}
                                    itemStyle={{ color: '#fff' }}
                                    formatter={(value: any) => [Number(value || 0).toLocaleString('pt-BR') + ' un', 'Quantidade']}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
                    <div className="space-y-3">
                        {topSkus.map((item, i) => {
                            const maxVal = topSkus[0]?.quantidade || 1;
                            return (
                                <div key={i}>
                                    <div className="flex justify-between text-[9px] font-bold uppercase mb-1 opacity-80">
                                        <span className="truncate pr-1 max-w-[120px]">{item.nome}</span>
                                        <span className="shrink-0">{item.quantidade.toLocaleString('pt-BR')} un</span>
                                    </div>
                                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-[#a01414] to-[#C01717] rounded-full shadow-[0_0_8px_rgba(192,23,23,0.4)]"
                                            style={{ width: `${(item.quantidade / maxVal) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
