import { useEffect, useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Gauge, Search, Calendar, TrendingUp, UserCheck, Clock, ArrowRight, Filter, Sparkles, PhoneCall, SlidersHorizontal } from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { api, Venda, formatCurrency, formatDate, Filters } from '../lib/api';

// Utilitários adicionais para Forecasting baseados em meses civis (sem distorções)
function addMonths(mesStr: string, diff: number): string {
    const [year, month] = mesStr.split('-').map(Number);
    const date = new Date(year, month - 1 + diff, 1);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

function diffInMonthsCivil(mes1: string, mes2: string): number {
    const [y1, m1] = mes1.split('-').map(Number);
    const [y2, m2] = mes2.split('-').map(Number);
    return (y1 - y2) * 12 + (m1 - m2);
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function average(values: number[]): number {
    return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function stdDev(values: number[]): number {
    if (values.length < 2) return 0;
    const avg = average(values);
    return Math.sqrt(average(values.map(value => Math.pow(value - avg, 2))));
}

function calcularProbabilidadeRealista(
    cicloMeses: number,
    inatividadeMeses: number,
    consistenciaCiclo: number,
    mesesComCompra: number,
    ticketMedio: number,
): { percent: number; label: 'alta' | 'media' | 'baixa'; atrasoMeses: number; acao: ClientePredict['acaoRecomendada'] } {
    if (mesesComCompra === 0) return { percent: 0, label: 'baixa', atrasoMeses: 0, acao: 'observar' };

    if (mesesComCompra === 1 || cicloMeses <= 0) {
        const base = inatividadeMeses <= 1 ? 42 : inatividadeMeses <= 3 ? 28 : 12;
        let percent = clamp(Math.round(base + Math.min(ticketMedio / 2500, 12)), 5, 55);
        if (inatividadeMeses > 6) {
            const decay = Math.exp(-(inatividadeMeses - 6) / 3);
            percent = Math.round(percent * decay);
        }
        const finalPercent = clamp(percent, 0, 96);
        return {
            percent: finalPercent,
            label: finalPercent >= 45 ? 'media' : 'baixa',
            atrasoMeses: 0,
            acao: finalPercent >= 45 ? 'monitorar' : 'observar',
        };
    }

    const atrasoMeses = inatividadeMeses - cicloMeses;
    const cicloNormalizado = clamp(cicloMeses, 1, 18);
    const janelaCompra = 1 / (1 + Math.exp(-(atrasoMeses + 0.35) / Math.max(0.9, cicloNormalizado * 0.28)));
    const recenciaPenalty = inatividadeMeses > cicloMeses * 2.4 ? Math.min(35, (inatividadeMeses - cicloMeses * 2.4) * 3) : 0;
    const valorBoost = Math.min(10, Math.log10(Math.max(ticketMedio, 1)) * 2);
    let percent = clamp(Math.round((janelaCompra * 74) + (consistenciaCiclo * 16) + valorBoost - recenciaPenalty), 0, 96);

    if (inatividadeMeses > 0) {
        const limiteInatividade = Math.max(6, cicloMeses * 2.5);
        if (inatividadeMeses > limiteInatividade) {
            const excesso = inatividadeMeses - limiteInatividade;
            const decay = Math.exp(-excesso / 4);
            percent = Math.round(percent * decay);
        }
    }
    percent = clamp(percent, 0, 96);
    const label = percent >= 70 ? 'alta' : percent >= 40 ? 'media' : 'baixa';

    let acao: ClientePredict['acaoRecomendada'] = 'observar';
    if (label === 'alta' && atrasoMeses >= -0.5) acao = 'acionar';
    else if (label === 'media') acao = 'monitorar';
    else if (inatividadeMeses >= Math.max(6, cicloMeses * 2)) acao = 'reativar';

    return { percent, label, atrasoMeses, acao };
}

interface ClientePredict {
    nome: string;
    totalComprado: number;
    totalPedidos: number;
    faturamentoMedioMensal: number;
    cicloMedioMeses: number;
    inatividadeMeses: number;
    ultimaCompraDate: string;
    probabilidade: number;
    probabilidadeLabel: 'alta' | 'media' | 'baixa';
    statusInatividade: 'ativo' | '3m' | '6m' | '9m' | '1a' | '2a+';
    valorForecast: number;
    atrasoMeses: number;
    confiancaCiclo: number;
    ticketMedioPedido: number;
    mesesComCompra: number;
    proximaCompraMes: string;
    acaoRecomendada: 'acionar' | 'monitorar' | 'reativar' | 'observar';
    prioridadeScore: number;
    segmentoValor: 'estrategico' | 'recorrente' | 'desenvolver' | 'baixo';
}

export default function Vendas() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [vendas, setVendas] = useState<Venda[]>([]);
    const [historicoVendas, setHistoricoVendas] = useState<Venda[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingPredict, setLoadingPredict] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Filtros de Transações
    const [search, setSearch] = useState('');
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');
    const [valorFilter, setValorFilter] = useState<'all' | 'premium' | 'media' | 'varejo'>('all');
    
    // Controle de Abas sincronizado com a URL (?tab=...)
    const activeTab = (searchParams.get('tab') as 'transacoes' | 'predict') || 'transacoes';
    const setActiveTab = (tab: 'transacoes' | 'predict') => {
        const newParams = new URLSearchParams(searchParams);
        newParams.set('tab', tab);
        setSearchParams(newParams);
    };

    // Cliente selecionado para a gaveta de detalhes (Distinct Sum)
    const [selectedClienteNome, setSelectedClienteNome] = useState<string | null>(null);

    // Resetar cliente selecionado quando qualquer filtro de busca ou data muda
    useEffect(() => {
        setSelectedClienteNome(null);
    }, [search, dataInicio, dataFim, valorFilter]);

    // Filtros da aba Predict
    const [searchPredict, setSearchPredict] = useState('');
    const [filtroInatividade, setFiltroInatividade] = useState<'all' | 'ativo' | '3m' | '6m' | '9m' | '1a' | '2a+'>('all');
    const [filtroProbabilidade, setFiltroProbabilidade] = useState<'all' | 'alta' | 'media' | 'baixa'>('all');
    const [filtroAcao, setFiltroAcao] = useState<'all' | ClientePredict['acaoRecomendada']>('all');
    const [ordenacaoPredict, setOrdenacaoPredict] = useState<'prioridade' | 'probabilidade' | 'valor' | 'atraso'>('prioridade');

    const filters: Filters = {
        ano: searchParams.get('ano') || String(new Date().getFullYear()),
        mes: searchParams.get('mes') || undefined,
    };

    // Carregamento inicial de vendas baseadas na URL (Transações) - carrega apenas se a aba transações estiver ativa
    useEffect(() => {
        if (activeTab === 'transacoes') {
            setLoading(true);
            api.getVendas(filters)
                .then(setVendas)
                .catch(e => setError(e.message))
                .finally(() => setLoading(false));
        }
    }, [searchParams, activeTab]);

    // Carrega o histórico COMPLETO de transações (todos os anos) ao entrar no Predict pela primeira vez.
    // Usa endpoint dedicado /api/vendas/historico que usa fetchAllPages sem limite de 1000 linhas.
    useEffect(() => {
        if (activeTab === 'predict' && historicoVendas.length === 0) {
            setLoadingPredict(true);
            api.getVendasHistorico()
                .then(data => setHistoricoVendas(data as Venda[]))
                .catch(e => console.error("Erro ao carregar histórico completo:", e))
                .finally(() => setLoadingPredict(false));
        }
    }, [activeTab, historicoVendas.length]);



    // Transações filtradas temporariamente por período e busca
    const transacoesPeriodo = useMemo(() => {
        const q = search.toLowerCase();
        return vendas.filter(v => {
            const matchSearch = !q || v.cliente.toLowerCase().includes(q) || v.codigo.toLowerCase().includes(q);
            const matchInicio = !dataInicio || v.data >= dataInicio;
            const matchFim = !dataFim || v.data <= dataFim;
            return matchSearch && matchInicio && matchFim;
        });
    }, [vendas, search, dataInicio, dataFim]);

    // Agrupamento completo dos clientes e seus faturamentos acumulados no período ativo (Distinct Sum temporário)
    const clientesAgregadosPeriodo = useMemo(() => {
        const cache: Record<string, { cliente: string; valorTotal: number; transacoesCount: number; ultimaData: string }> = {};
        
        transacoesPeriodo.forEach(v => {
            if (!cache[v.cliente]) {
                cache[v.cliente] = {
                    cliente: v.cliente,
                    valorTotal: 0,
                    transacoesCount: 0,
                    ultimaData: v.data
                };
            }
            cache[v.cliente].valorTotal += v.valor;
            cache[v.cliente].transacoesCount += 1;
            if (v.data > cache[v.cliente].ultimaData) {
                cache[v.cliente].ultimaData = v.data;
            }
        });

        return Object.values(cache);
    }, [transacoesPeriodo]);

    // Estatísticas das faixas financeiras baseadas no faturamento acumulado por cliente no período selecionado
    const statsFaixas = useMemo(() => {
        let total = 0;
        let countTotal = 0;
        let premium = 0;
        let countPremium = 0;
        let media = 0;
        let countMedia = 0;
        let varejo = 0;
        let countVarejo = 0;

        clientesAgregadosPeriodo.forEach(c => {
            total += c.valorTotal;
            countTotal++;
            if (c.valorTotal > 30000) {
                premium += c.valorTotal;
                countPremium++;
            } else if (c.valorTotal >= 5000) {
                media += c.valorTotal;
                countMedia++;
            } else {
                varejo += c.valorTotal;
                countVarejo++;
            }
        });

        return {
            total, countTotal,
            premium, countPremium,
            media, countMedia,
            varejo, countVarejo
        };
    }, [clientesAgregadosPeriodo]);

    // Lista de clientes agregados filtrada pelo filtro de faixa de valor acumulado
    const clientesAgregados = useMemo(() => {
        return clientesAgregadosPeriodo
            .filter(c => {
                if (valorFilter === 'all') return true;
                if (valorFilter === 'premium') return c.valorTotal > 30000;
                if (valorFilter === 'media') return c.valorTotal >= 5000 && c.valorTotal <= 30000;
                return c.valorTotal < 5000;
            })
            .sort((a, b) => b.valorTotal - a.valorTotal);
    }, [clientesAgregadosPeriodo, valorFilter]);

    // Transações detalhadas do cliente selecionado no período correspondente
    const transacoesDoClienteSelecionado = useMemo(() => {
        if (!selectedClienteNome) return [];
        return transacoesPeriodo.filter(v => v.cliente === selectedClienteNome);
    }, [transacoesPeriodo, selectedClienteNome]);

    // Faturamento total somando apenas os clientes que atendem ao filtro ativo
    const totalFiltrado = useMemo(() =>
        clientesAgregados.reduce((acc, c) => acc + c.valorTotal, 0), [clientesAgregados]);

    // Processamento do Predict Comercial com base no histórico completo
    const predictData = useMemo(() => {
        if (historicoVendas.length === 0) return {
            clientes: [],
            forecastTotal: 0,
            forecastPessimista: 0,
            forecastMedio: 0,
            forecastOtimista: 0,
            historicoGrafico: [],
            contatosQuentes: [],
            ultimoMesConsolidadoLabel: '',
            mesForecastLabel: '',
            frequenciaMediaGeral: 0
        };

        // 1. Ponto de Referência Temporal Baseado no Mês Corrente (Maio de 2026)
        const mesForecast = new Date().toISOString().substring(0, 7); // '2026-05' baseado na data do sistema
        const ultimoConsolidado = addMonths(mesForecast, -1); // '2026-04'

        // Separar vendas históricas (antes do mês de forecast) e vendas do mês atual
        const historicoConsolidado = historicoVendas.filter(v => v.data < `${mesForecast}-01`);
        const comprasMesAtual = historicoVendas.filter(v => v.data >= `${mesForecast}-01` && v.data < `${mesForecast}-32`);

        // Agrupar compras por cliente no histórico consolidado (até 30/04/2026)
        const gruposConsolidado: Record<string, Venda[]> = {};
        historicoConsolidado.forEach(v => {
            if (!gruposConsolidado[v.cliente]) gruposConsolidado[v.cliente] = [];
            gruposConsolidado[v.cliente].push(v);
        });

        // Agrupar compras por cliente no mês atual (Maio/2026)
        const gruposMesAtual: Record<string, Venda[]> = {};
        comprasMesAtual.forEach(v => {
            if (!gruposMesAtual[v.cliente]) gruposMesAtual[v.cliente] = [];
            gruposMesAtual[v.cliente].push(v);
        });

        // Obter lista única de todos os clientes históricos e do mês atual
        const todosClientesNomes = Array.from(new Set([
            ...Object.keys(gruposConsolidado),
            ...Object.keys(gruposMesAtual)
        ]));

        // Mapear cada cliente com ciclos de recompra, inatividade e compras no mês corrente
        const clientesCalculados = todosClientesNomes.map(nome => {
            const comprasHistoricas = gruposConsolidado[nome] || [];
            const comprasMesAtualCliente = gruposMesAtual[nome] || [];
            
            const faturamentoRealMes = comprasMesAtualCliente.reduce((acc, v) => acc + v.valor, 0);
            
            let totalCompradoConsolidado = 0;
            let faturamentoMedioMensal = 0;
            let cicloMedioMeses = 0;
            let inatividadeMeses = 0;
            let ultimaCompraDateBeforeMay = '';
            let confiancaCiclo = 0;
            let ticketMedioPedido = 0;
            let mesesComCompra = 0;
            let proximaCompraMes = '';
            let atrasoMeses = 0;
            let acaoRecomendada: ClientePredict['acaoRecomendada'] = 'observar';
            let segmentoValor: ClientePredict['segmentoValor'] = 'baixo';
            
            if (comprasHistoricas.length > 0) {
                totalCompradoConsolidado = comprasHistoricas.reduce((acc, v) => acc + v.valor, 0);
                
                // Datas civis distintas de compra (YYYY-MM)
                const mesesAtivosSet = new Set(comprasHistoricas.map(v => v.data.substring(0, 7)));
                const mesesAtivos = mesesAtivosSet.size;
                const mesesAtivosSorted = Array.from(mesesAtivosSet).sort();
                mesesComCompra = mesesAtivos;
                
                faturamentoMedioMensal = mesesAtivos > 0 ? (totalCompradoConsolidado / mesesAtivos) : 0;
                ticketMedioPedido = comprasHistoricas.length > 0 ? totalCompradoConsolidado / comprasHistoricas.length : 0;
                
                const datasSorted = comprasHistoricas.map(v => v.data).sort();
                ultimaCompraDateBeforeMay = datasSorted[datasSorted.length - 1];
                const primeiraCompraDate = datasSorted[0];
                
                // Período total em meses civis no relacionamento consolidado (até o início do mês de forecast)
                const periodoTotalMeses = Math.max(1, diffInMonthsCivil(mesForecast, primeiraCompraDate.substring(0, 7)));
                
                // Ciclo médio em meses civis
                cicloMedioMeses = mesesAtivos > 0 ? (periodoTotalMeses / mesesAtivos) : 0;
                const intervalosReais = mesesAtivosSorted
                    .slice(1)
                    .map((mes, idx) => diffInMonthsCivil(mes, mesesAtivosSorted[idx]))
                    .filter(intervalo => intervalo > 0);
                if (intervalosReais.length > 0) {
                    const cicloMediano = median(intervalosReais);
                    const cicloMedia = average(intervalosReais);
                    cicloMedioMeses = clamp((cicloMediano * 0.65) + (cicloMedia * 0.35), 1, 48);
                    confiancaCiclo = clamp(1 - (stdDev(intervalosReais) / Math.max(cicloMedia, 1)), 0.15, 0.95);
                } else {
                    cicloMedioMeses = 0;
                    confiancaCiclo = mesesAtivos >= 2 ? 0.35 : 0.2;
                }
                
                // Inatividade em meses civis em relação ao mês de forecast
                inatividadeMeses = diffInMonthsCivil(mesForecast, ultimaCompraDateBeforeMay.substring(0, 7));
                proximaCompraMes = cicloMedioMeses > 0 ? addMonths(ultimaCompraDateBeforeMay.substring(0, 7), Math.round(cicloMedioMeses)) : '';
            } else {
                // Cliente novo que só comprou no mês de forecast
                faturamentoMedioMensal = faturamentoRealMes;
                ticketMedioPedido = comprasMesAtualCliente.length > 0 ? faturamentoRealMes / comprasMesAtualCliente.length : 0;
                mesesComCompra = faturamentoRealMes > 0 ? 1 : 0;
                confiancaCiclo = 0.15;
                inatividadeMeses = 0;
            }

            if (faturamentoMedioMensal >= 30000) segmentoValor = 'estrategico';
            else if (faturamentoMedioMensal >= 8000) segmentoValor = 'recorrente';
            else if (faturamentoMedioMensal >= 2500) segmentoValor = 'desenvolver';

            // Cálculo híbrido de probabilidade e forecast
            let probabilidade = 0;
            let probabilidadeLabel: 'alta' | 'media' | 'baixa' = 'baixa';
            let valorForecast = 0;
            let statusInatividade: ClientePredict['statusInatividade'] = 'ativo';
            let ultimaCompraDate = '';

            if (faturamentoRealMes > 0) {
                // Cliente já comprou em Maio de 2026 (faturamento 100% real integrado no forecast)
                inatividadeMeses = 0;
                probabilidade = 100;
                probabilidadeLabel = 'alta';
                valorForecast = faturamentoRealMes;
                statusInatividade = 'ativo';
                ultimaCompraDate = comprasMesAtualCliente.map(v => v.data).sort().pop() || '';
                acaoRecomendada = 'observar';
                atrasoMeses = 0;
            } else {
                // Cliente ainda não comprou em Maio de 2026 (projeção baseada em ciclo histórico)
                ultimaCompraDate = ultimaCompraDateBeforeMay;
                const probInfo = calcularProbabilidadeRealista(cicloMedioMeses, inatividadeMeses, confiancaCiclo, mesesComCompra, ticketMedioPedido);
                probabilidade = probInfo.percent;
                probabilidadeLabel = probInfo.label;
                atrasoMeses = probInfo.atrasoMeses;
                acaoRecomendada = probInfo.acao;
                valorForecast = faturamentoMedioMensal * (probabilidade / 100) * clamp(0.65 + confiancaCiclo * 0.5, 0.7, 1.12);

                // Classificação de status de inatividade
                if (inatividadeMeses >= 24) {
                    statusInatividade = '2a+';
                } else if (inatividadeMeses >= 12) {
                    statusInatividade = '1a';
                } else if (inatividadeMeses >= 9) {
                    statusInatividade = '9m';
                } else if (inatividadeMeses >= 6) {
                    statusInatividade = '6m';
                } else if (inatividadeMeses >= 2) {
                    statusInatividade = '3m';
                } else {
                    statusInatividade = 'ativo';
                }
            }

            const prioridadeScore = Math.round(
                (probabilidade * 0.42)
                + (clamp(faturamentoMedioMensal / 1000, 0, 35) * 0.85)
                + (clamp(atrasoMeses, 0, 8) * 3)
                + (confiancaCiclo * 12)
            );

            return {
                nome,
                totalComprado: totalCompradoConsolidado + faturamentoRealMes,
                totalPedidos: comprasHistoricas.length + comprasMesAtualCliente.length,
                faturamentoMedioMensal,
                cicloMedioMeses,
                inatividadeMeses,
                ultimaCompraDate,
                probabilidade,
                probabilidadeLabel,
                statusInatividade,
                valorForecast,
                atrasoMeses,
                confiancaCiclo,
                ticketMedioPedido,
                mesesComCompra,
                proximaCompraMes,
                acaoRecomendada,
                prioridadeScore,
                segmentoValor
            };
        });

        // Calcular os três cenários de forecast de faturamento (bottom-up)
        let forecastPessimista = 0;
        let forecastMedio = 0;
        let forecastOtimista = 0;

        clientesCalculados.forEach(c => {
            // Se o cliente já realizou compras no mês de forecast, esse valor real é fixado em todos os cenários
            const jaComprou = c.ultimaCompraDate && c.ultimaCompraDate.substring(0, 7) === mesForecast;
            if (jaComprou) {
                forecastPessimista += c.valorForecast;
                forecastMedio += c.valorForecast;
                forecastOtimista += c.valorForecast;
            } else {
                // Cenário Pessimista: foca apenas em alta e média probabilidade com ajuste conservador
                if (c.probabilidadeLabel === 'alta') {
                    forecastPessimista += c.valorForecast * 0.85;
                } else if (c.probabilidadeLabel === 'media') {
                    forecastPessimista += c.valorForecast * 0.40;
                }

                // Cenário Médio (Plausível/Realista): usa o novo modelo estatístico com decaimento por inatividade
                forecastMedio += c.valorForecast;

                // Cenário Otimista: assume maior taxa de conversão e reativação (+35%)
                forecastOtimista += c.valorForecast * 1.35;
            }
        });

        // Tradução e formatação
        const MESES_ABR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const formatMesAno = (mesStr: string): string => {
            const [ano, mes] = mesStr.split('-');
            const mesIdx = parseInt(mes, 10) - 1;
            const anoCurto = ano.substring(2);
            return `${MESES_ABR[mesIdx]}/${anoCurto}`;
        };

        // Construir série histórica mensal com range DINÂMICO baseado no histórico real.
        const primeiroMesGlobal = historicoVendas.length > 0
            ? historicoVendas.reduce((min, v) => v.data < min ? v.data : min, historicoVendas[0].data).substring(0, 7)
            : addMonths(mesForecast, -12);

        const totalMesesHistorico = diffInMonthsCivil(mesForecast, primeiroMesGlobal);
        const mesesExibir = Math.min(totalMesesHistorico, 24);
        const inicioGrafico = addMonths(mesForecast, -mesesExibir);

        const mesesGrafico: string[] = [];
        for (let i = -mesesExibir; i < 0; i++) {
            mesesGrafico.push(addMonths(mesForecast, i));
        }
        mesesGrafico.push(mesForecast);
        const mesesGraficoFiltrados = mesesGrafico.filter(m => m >= inicioGrafico);

        const historicoGrafico = mesesGraficoFiltrados.map(mes => {
            const real = historicoVendas
                .filter(v => v.data.startsWith(mes))
                .reduce((acc, v) => acc + v.valor, 0);

            let forecastPessimistaVal: number | undefined = undefined;
            let forecastMedioVal: number | undefined = undefined;
            let forecastOtimistaVal: number | undefined = undefined;

            if (mes === mesForecast) {
                forecastPessimistaVal = forecastPessimista;
                forecastMedioVal = forecastMedio;
                forecastOtimistaVal = forecastOtimista;
            } else if (mes === ultimoConsolidado) {
                // Conecta o final do gráfico real ao início de cada linha de forecast
                forecastPessimistaVal = real;
                forecastMedioVal = real;
                forecastOtimistaVal = real;
            }

            return {
                mes: formatMesAno(mes),
                real: real > 0 || mes !== mesForecast ? real : undefined,
                forecastPessimista: forecastPessimistaVal,
                forecastMedio: forecastMedioVal,
                forecastOtimista: forecastOtimistaVal
            };
        });

        const contatosQuentes = clientesCalculados
            .filter(c => c.acaoRecomendada === 'acionar' && c.inatividadeMeses > 0)
            .sort((a, b) => b.prioridadeScore - a.prioridadeScore)
            .slice(0, 5);

        const clientesRecorrentes = clientesCalculados.filter(c => c.cicloMedioMeses > 0);
        const frequenciaMediaGeral = clientesRecorrentes.length > 0
            ? (clientesRecorrentes.reduce((acc, c) => acc + c.cicloMedioMeses, 0) / clientesRecorrentes.length)
            : 0;

        return {
            clientes: clientesCalculados,
            forecastTotal: forecastMedio,
            forecastPessimista,
            forecastMedio,
            forecastOtimista,
            historicoGrafico,
            contatosQuentes,
            ultimoMesConsolidadoLabel: formatMesAno(ultimoConsolidado),
            mesForecastLabel: formatMesAno(mesForecast),
            frequenciaMediaGeral
        };
    }, [historicoVendas]);

    // Filtragem dos clientes na aba Predict baseada nos novos dados calculados
    const filteredPredict = useMemo(() => {
        const q = searchPredict.toLowerCase();
        const { clientes } = predictData;
        return clientes.filter(c => {
            const matchSearch = !q || c.nome.toLowerCase().includes(q);
            const matchStatus = filtroInatividade === 'all' || c.statusInatividade === filtroInatividade;
            const matchProbabilidade = filtroProbabilidade === 'all' || c.probabilidadeLabel === filtroProbabilidade;
            const matchAcao = filtroAcao === 'all' || c.acaoRecomendada === filtroAcao;
            return matchSearch && matchStatus && matchProbabilidade && matchAcao;
        }).sort((a, b) => {
            if (ordenacaoPredict === 'probabilidade') return b.probabilidade - a.probabilidade;
            if (ordenacaoPredict === 'valor') return b.faturamentoMedioMensal - a.faturamentoMedioMensal;
            if (ordenacaoPredict === 'atraso') return b.atrasoMeses - a.atrasoMeses;
            return b.prioridadeScore - a.prioridadeScore;
        });
    }, [predictData, searchPredict, filtroInatividade, filtroProbabilidade, filtroAcao, ordenacaoPredict]);

    const predictResumo = useMemo(() => {
        const clientes = predictData.clientes;
        const acionaveis = clientes.filter(c => c.acaoRecomendada === 'acionar');
        const reativar = clientes.filter(c => c.acaoRecomendada === 'reativar');
        const pipelinePonderado = clientes.reduce((sum, c) => sum + c.valorForecast, 0);
        const confiancaMedia = clientes.length > 0
            ? clientes.reduce((sum, c) => sum + c.confiancaCiclo, 0) / clientes.length
            : 0;

        return {
            acionaveis: acionaveis.length,
            reativar: reativar.length,
            pipelinePonderado,
            confiancaMedia,
        };
    }, [predictData]);

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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                        Vendas
                        <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
                    </h1>
                    <p className="text-slate-500 text-sm mt-1 font-medium">Painel inteligente de faturamento e comportamento comercial.</p>
                </div>

                {/* Abas Premium */}
                <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 max-w-fit">
                    <button
                        onClick={() => setActiveTab('transacoes')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                            activeTab === 'transacoes'
                                ? 'bg-[#C01717] text-white shadow-lg'
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        Transações
                    </button>
                    <button
                        onClick={() => setActiveTab('predict')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                            activeTab === 'predict'
                                ? 'bg-[#C01717] text-white shadow-lg'
                                : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <span>Predict Comercial</span>
                        <span className="bg-white/25 px-1 py-0.5 rounded text-[8px] font-extrabold uppercase animate-pulse">NOVO</span>
                    </button>
                </div>
            </div>

            {/* TAB 1: TRANSAÇÕES */}
            {activeTab === 'transacoes' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                    
                    {/* Cards interativos que funcionam como filtros de faixa de valor */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Faturamento Geral */}
                        <div 
                            onClick={() => setValorFilter('all')}
                            className={`card-premium cursor-pointer py-4 px-5 transition-all border-l-4 ${
                                valorFilter === 'all' 
                                    ? 'bg-white/10 border-slate-400 shadow-xl' 
                                    : 'border-transparent hover:bg-white/5'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Faturamento Total</span>
                                <Filter className={`w-3.5 h-3.5 ${valorFilter === 'all' ? 'text-white' : 'text-slate-600'}`} />
                            </div>
                            <p className="text-xl font-black text-white">{formatCurrency(totalFiltrado)}</p>
                            <p className="text-xs text-slate-500 mt-1 font-medium">{clientesAgregados.length} {clientesAgregados.length === 1 ? 'cliente listado' : 'clientes listados'}</p>
                        </div>

                        {/* Vendas Premium (> 30k) */}
                        <div 
                            onClick={() => setValorFilter(valorFilter === 'premium' ? 'all' : 'premium')}
                            className={`card-premium cursor-pointer py-4 px-5 transition-all border-l-4 ${
                                valorFilter === 'premium' 
                                    ? 'bg-emerald-500/10 border-emerald-500 shadow-lg shadow-emerald-500/5' 
                                    : 'border-transparent hover:bg-white/5'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Premium (&gt; R$ 30K)</span>
                                <TrendingUp className={`w-3.5 h-3.5 ${valorFilter === 'premium' ? 'text-emerald-400' : 'text-slate-600'}`} />
                            </div>
                            <p className="text-xl font-black text-emerald-400">{formatCurrency(statsFaixas.premium)}</p>
                            <p className="text-xs text-slate-500 mt-1 font-medium">{statsFaixas.countPremium} {statsFaixas.countPremium === 1 ? 'cliente premium' : 'clientes premium'}</p>
                        </div>

                        {/* Vendas Médias (5k - 30k) */}
                        <div 
                            onClick={() => setValorFilter(valorFilter === 'media' ? 'all' : 'media')}
                            className={`card-premium cursor-pointer py-4 px-5 transition-all border-l-4 ${
                                valorFilter === 'media' 
                                    ? 'bg-amber-500/10 border-amber-500 shadow-lg shadow-amber-500/5' 
                                    : 'border-transparent hover:bg-white/5'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Médias (R$ 5K - R$ 30K)</span>
                                <Clock className={`w-3.5 h-3.5 ${valorFilter === 'media' ? 'text-amber-400' : 'text-slate-600'}`} />
                            </div>
                            <p className="text-xl font-black text-amber-400">{formatCurrency(statsFaixas.media)}</p>
                            <p className="text-xs text-slate-500 mt-1 font-medium">{statsFaixas.countMedia} {statsFaixas.countMedia === 1 ? 'cliente recorrente' : 'clientes recorrentes'}</p>
                        </div>

                        {/* Vendas Recorrentes / Varejo (< 5k) */}
                        <div 
                            onClick={() => setValorFilter(valorFilter === 'varejo' ? 'all' : 'varejo')}
                            className={`card-premium cursor-pointer py-4 px-5 transition-all border-l-4 ${
                                valorFilter === 'varejo' 
                                    ? 'bg-rose-500/10 border-rose-500 shadow-lg shadow-rose-500/5' 
                                    : 'border-transparent hover:bg-white/5'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Varejo (&lt; R$ 5K)</span>
                                <UserCheck className={`w-3.5 h-3.5 ${valorFilter === 'varejo' ? 'text-rose-400' : 'text-slate-600'}`} />
                            </div>
                            <p className="text-xl font-black text-rose-400">{formatCurrency(statsFaixas.varejo)}</p>
                            <p className="text-xs text-slate-500 mt-1 font-medium">{statsFaixas.countVarejo} {statsFaixas.countVarejo === 1 ? 'cliente fracionado' : 'clientes fracionados'}</p>
                        </div>
                    </div>


                    {/* Filtros */}
                    <div className="flex flex-wrap gap-3">
                        <div className="relative flex-1 min-w-[160px] max-w-sm group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-[#e05050] transition-colors" />
                            <input
                                className="input pl-9"
                                placeholder="Buscar por cliente ou código..."
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
                        {(search || dataInicio || dataFim || valorFilter !== 'all') && (
                            <button
                                className="bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                                onClick={() => { setSearch(''); setDataInicio(''); setDataFim(''); setValorFilter('all'); }}
                            >
                                Limpar filtros
                            </button>
                        )}
                    </div>

                    {/* Painel Principal de Transações em Duas Colunas (Distinct Sum + Gaveta Lateral) */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        {/* Coluna Esquerda: Ranking e Agrupamento por Cliente (Distinct Sum) */}
                        <div className="lg:col-span-7 space-y-4">
                            <div className="card-premium p-0 overflow-hidden shadow-2xl border border-white/10">
                                <div className="p-4 bg-white/5 border-b border-white/10 flex items-center justify-between">
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Clientes Ativos no Período</span>
                                    <span className="bg-white/10 px-2.5 py-0.5 rounded text-[10px] font-bold text-slate-300">
                                        {clientesAgregados.length} {clientesAgregados.length === 1 ? 'cliente' : 'clientes'}
                                    </span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-white/5 border-b border-white/10 text-slate-500">
                                            <tr>
                                                <th className="text-left text-[10px] font-bold uppercase tracking-wider px-6 py-4">Cliente</th>
                                                <th className="text-right text-[10px] font-bold uppercase tracking-wider px-4 py-4">Qtd Itens</th>
                                                <th className="text-right text-[10px] font-bold uppercase tracking-wider px-6 py-4">Valor Acumulado</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {clientesAgregados.length === 0 ? (
                                                <tr>
                                                    <td colSpan={3} className="px-6 py-12 text-center text-slate-500 font-medium">
                                                        Nenhum cliente encontrado para os filtros ativos.
                                                    </td>
                                                </tr>
                                            ) : (
                                                clientesAgregados.map((c, i) => (
                                                    <tr 
                                                        key={i} 
                                                        onClick={() => setSelectedClienteNome(selectedClienteNome === c.cliente ? null : c.cliente)}
                                                        className={`cursor-pointer transition-colors group ${
                                                            selectedClienteNome === c.cliente 
                                                                ? 'bg-[#C01717]/10 hover:bg-[#C01717]/15' 
                                                                : 'hover:bg-white/5'
                                                        }`}
                                                    >
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-[10px] font-bold text-slate-500 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                                                                    #{i + 1}
                                                                </span>
                                                                <div className="font-bold text-white max-w-[280px] truncate group-hover:text-[#f87171] transition-colors" title={c.cliente}>
                                                                    {c.cliente}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4 text-right text-slate-400 font-medium">
                                                            {c.transacoesCount} {c.transacoesCount === 1 ? 'pedido' : 'pedidos'}
                                                        </td>
                                                        <td className="px-6 py-4 text-right text-emerald-400 font-black whitespace-nowrap">
                                                            {formatCurrency(c.valorTotal)}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Coluna Direita: Gaveta de Itens Comprados */}
                        <div className="lg:col-span-5">
                            {selectedClienteNome ? (
                                <div className="card-premium border border-[#C01717]/30 bg-black/45 backdrop-blur-md shadow-2xl p-6 space-y-6 animate-in slide-in-from-right-4 duration-300 sticky top-4">
                                    {/* Cabeçalho da Gaveta */}
                                    <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/10">
                                        <div className="space-y-1">
                                            <span className="text-[9px] font-bold tracking-widest text-[#f87171] uppercase bg-[#C01717]/15 px-2 py-0.5 rounded border border-[#C01717]/25">
                                                Detalhamento de Compras
                                            </span>
                                            <h3 className="text-base font-black text-white leading-tight break-words">
                                                {selectedClienteNome}
                                            </h3>
                                        </div>
                                        <button 
                                            onClick={() => setSelectedClienteNome(null)}
                                            className="text-slate-400 hover:text-white p-1 hover:bg-white/5 rounded-lg transition-all cursor-pointer flex-shrink-0"
                                            title="Fechar detalhes"
                                        >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>

                                    {/* Resumo Rápido */}
                                    <div className="grid grid-cols-2 gap-4 bg-white/5 p-4 rounded-xl border border-white/5">
                                        <div>
                                            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Valor Acumulado</p>
                                            <p className="text-lg font-black text-emerald-400 mt-0.5">
                                                {formatCurrency(transacoesDoClienteSelecionado.reduce((acc, t) => acc + t.valor, 0))}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Total de Peças</p>
                                            <p className="text-lg font-black text-white mt-0.5">
                                                {transacoesDoClienteSelecionado.reduce((acc, t) => acc + t.quantidade, 0).toLocaleString('pt-BR')}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Tabela de Itens */}
                                    <div className="space-y-3">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Itens Comprados no Período</p>
                                        <div className="overflow-hidden rounded-xl border border-white/5 bg-white/5 max-h-[350px] overflow-y-auto custom-scrollbar">
                                            <table className="w-full text-xs">
                                                <thead className="bg-white/5 border-b border-white/10 text-slate-500 sticky top-0 backdrop-blur-md">
                                                    <tr>
                                                        <th className="text-left py-3 px-4 font-bold uppercase tracking-wider">Código (PN)</th>
                                                        <th className="text-right py-3 px-2 font-bold uppercase tracking-wider">Qtd</th>
                                                        <th className="text-right py-3 px-4 font-bold uppercase tracking-wider">Subtotal</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5 text-slate-300">
                                                    {transacoesDoClienteSelecionado.map((item, index) => (
                                                        <tr key={index} className="hover:bg-white/5 transition-colors">
                                                            <td className="py-3 px-4">
                                                                <div className="font-mono font-bold text-white tracking-tighter">
                                                                    {item.codigo}
                                                                </div>
                                                                <div className="text-[9px] text-slate-500 font-semibold mt-0.5">
                                                                    Data: {formatDate(item.data)}
                                                                </div>
                                                            </td>
                                                            <td className="py-3 px-2 text-right font-medium">
                                                                {item.quantidade}
                                                            </td>
                                                            <td className="py-3 px-4 text-right text-emerald-400 font-bold whitespace-nowrap">
                                                                {formatCurrency(item.valor)}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Ação Inteligente de Oportunidades */}
                                    <div className="pt-2">
                                        <Link
                                            to={`/clientes?cliente=${encodeURIComponent(selectedClienteNome)}&tab=itens`}
                                            className="w-full flex items-center justify-center gap-2 bg-[#C01717] hover:bg-[#a81414] text-white rounded-xl py-3 px-4 text-xs font-bold uppercase tracking-widest transition-all cursor-pointer shadow-lg shadow-[#C01717]/25"
                                        >
                                            <span>Identificar Oportunidades</span>
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                            </svg>
                                        </Link>
                                        <p className="text-[10px] text-center text-slate-500 mt-2 font-medium">
                                            Veja a lista de itens que este cliente deixou de comprar.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="card-premium border border-white/5 bg-white/5 py-16 px-6 text-center flex flex-col items-center justify-center gap-4 sticky top-4">
                                    <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-slate-500">
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-white">Detalhamento de Compras</h4>
                                        <p className="text-xs text-slate-500 mt-1 max-w-[240px] mx-auto leading-relaxed">
                                            Selecione um cliente na lista à esquerda para analisar seus itens comprados detalhadamente.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            )}

            {/* TAB 2: PREDICT COMERCIAL */}
            {activeTab === 'predict' && (
                loadingPredict ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <div className="w-8 h-8 border-2 border-[#C01717] border-t-transparent rounded-full animate-spin" />
                        <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider animate-pulse">Calculando Ciclos & Predições Comerciais...</p>
                    </div>
                ) : (
                    <div className="space-y-6 animate-in fade-in duration-200">
                    
                    {/* Seção Superior: KPIs e Gráfico Amplo */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        {/* Card 1: Faturamento Estimado */}
                        <div className="card-premium py-4 px-5 border-l-4 border-emerald-500 bg-black/45 backdrop-blur-md shadow-2xl flex flex-col justify-between min-h-[115px]">
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Faturamento Estimado ({predictData.mesForecastLabel})</span>
                                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                                </div>
                                <p className="text-2xl font-black text-emerald-400">{formatCurrency(predictData.forecastMedio)}</p>
                            </div>
                            <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-white/5 text-[9px] font-bold text-slate-400">
                                <div>
                                    <span className="text-[8px] uppercase text-slate-500 block">Pessimista</span>
                                    <span className="text-rose-400">{formatCurrency(predictData.forecastPessimista)}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-[8px] uppercase text-slate-500 block">Otimista</span>
                                    <span className="text-emerald-400">{formatCurrency(predictData.forecastOtimista)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Card 2: Ação Imediata */}
                        <div className="card-premium py-4 px-5 border-l-4 border-[#C01717] bg-black/45 backdrop-blur-md shadow-2xl">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Acionar Agora</span>
                                <PhoneCall className="w-4 h-4 text-[#f87171]" />
                            </div>
                            <p className="text-2xl font-black text-white">
                                {predictResumo.acionaveis}
                            </p>
                            <p className="text-xs text-slate-500 mt-1 font-medium">Clientes no ponto de recompra com valor relevante.</p>
                        </div>

                        {/* Card 3: Reativação */}
                        <div className="card-premium py-4 px-5 border-l-4 border-rose-500 bg-black/45 backdrop-blur-md shadow-2xl">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Reativar Carteira</span>
                                <AlertTriangle className="w-4 h-4 text-rose-400" />
                            </div>
                            <p className="text-2xl font-black text-rose-400">{predictResumo.reativar}</p>
                            <p className="text-xs text-slate-500 mt-1 font-medium">Clientes fora do ciclo e com risco de perda.</p>
                        </div>

                        {/* Card 4: Confiança */}
                        <div className="card-premium py-4 px-5 border-l-4 border-amber-500 bg-black/45 backdrop-blur-md shadow-2xl">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Confiança do Ciclo</span>
                                <Gauge className="w-4 h-4 text-amber-400" />
                            </div>
                            <p className="text-2xl font-black text-amber-400">
                                {Math.round(predictResumo.confiancaMedia * 100)}%
                            </p>
                            <p className="text-xs text-slate-500 mt-1 font-medium">Regularidade média dos ciclos históricos.</p>
                        </div>
                    </div>

                    {/* Gráfico de Linhas Amplo de Histórico e Forecast */}
                    <div className="card-premium p-6 bg-black/45 backdrop-blur-md shadow-2xl border border-white/10">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                            <div>
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Histórico Consolidado & Tendência de Vendas</h3>
                                <p className="text-xs text-slate-500 mt-0.5">Visão geral do faturamento dos últimos 6 meses com forecast relativo para {predictData.mesForecastLabel}.</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-4 text-xs font-bold">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-3 h-0.5 bg-[#C01717] rounded inline-block" />
                                    <span className="text-slate-300">Faturamento Real</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-3 h-0.5 border-t border-dashed border-emerald-500 rounded inline-block" />
                                    <span className="text-[#10b981]">Cenário Otimista</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-3 h-0.5 border-t border-dashed border-amber-400 rounded inline-block" />
                                    <span className="text-amber-400">Cenário Médio</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-3 h-0.5 border-t border-dashed border-rose-500 rounded inline-block" />
                                    <span className="text-rose-400">Cenário Pessimista</span>
                                </div>
                            </div>
                        </div>
                        <div className="h-64 sm:h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                    data={predictData.historicoGrafico}
                                    margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                    <XAxis 
                                        dataKey="mes" 
                                        stroke="#64748b" 
                                        fontSize={10} 
                                        fontWeight="bold"
                                        tickLine={false} 
                                    />
                                    <YAxis 
                                        stroke="#64748b" 
                                        fontSize={10} 
                                        fontWeight="bold"
                                        tickLine={false}
                                        tickFormatter={(v) => `R$ ${(v / 1000)}k`}
                                    />
                                    <Tooltip 
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                const data = payload[0].payload;
                                                return (
                                                    <div className="bg-[#151518]/95 border border-white/10 rounded-xl p-3 shadow-2xl backdrop-blur-md">
                                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">{data.mes}</p>
                                                        {data.real !== undefined && (
                                                            <div className="flex items-center justify-between gap-4 text-xs mt-1">
                                                                <span className="text-slate-400 font-bold flex items-center gap-1.5">
                                                                    <span className="w-2 h-2 rounded-full bg-[#C01717]" />
                                                                    Faturamento Real:
                                                                </span>
                                                                <span className="font-black text-white">{formatCurrency(data.real)}</span>
                                                            </div>
                                                        )}
                                                        {data.forecastOtimista !== undefined && (
                                                            <div className="flex items-center justify-between gap-4 text-xs mt-1">
                                                                <span className="text-slate-400 font-bold flex items-center gap-1.5">
                                                                    <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
                                                                    Cenário Otimista:
                                                                </span>
                                                                <span className="font-black text-[#10b981]">{formatCurrency(data.forecastOtimista)}</span>
                                                            </div>
                                                        )}
                                                        {data.forecastMedio !== undefined && (
                                                            <div className="flex items-center justify-between gap-4 text-xs mt-1">
                                                                <span className="text-slate-400 font-bold flex items-center gap-1.5">
                                                                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                                                    Cenário Médio:
                                                                </span>
                                                                <span className="font-black text-amber-400">{formatCurrency(data.forecastMedio)}</span>
                                                            </div>
                                                        )}
                                                        {data.forecastPessimista !== undefined && (
                                                            <div className="flex items-center justify-between gap-4 text-xs mt-1">
                                                                <span className="text-slate-400 font-bold flex items-center gap-1.5">
                                                                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                                                                    Cenário Pessimista:
                                                                </span>
                                                                <span className="font-black text-rose-400">{formatCurrency(data.forecastPessimista)}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Line 
                                        type="monotone" 
                                        dataKey="real" 
                                        stroke="#C01717" 
                                        strokeWidth={3} 
                                        dot={{ r: 4, stroke: '#C01717', strokeWidth: 1, fill: '#0a0a0c' }}
                                        activeDot={{ r: 6, stroke: '#C01717', strokeWidth: 2, fill: '#fff' }}
                                        connectNulls={true}
                                    />
                                    <Line 
                                        type="monotone" 
                                        dataKey="forecastOtimista" 
                                        stroke="#10b981" 
                                        strokeWidth={2} 
                                        strokeDasharray="5 5"
                                        dot={{ r: 4, stroke: '#10b981', strokeWidth: 1, fill: '#0a0a0c' }}
                                        activeDot={{ r: 6, stroke: '#10b981', strokeWidth: 2, fill: '#fff' }}
                                        connectNulls={true}
                                    />
                                    <Line 
                                        type="monotone" 
                                        dataKey="forecastMedio" 
                                        stroke="#fbbf24" 
                                        strokeWidth={2} 
                                        strokeDasharray="5 5"
                                        dot={{ r: 4, stroke: '#fbbf24', strokeWidth: 1, fill: '#0a0a0c' }}
                                        activeDot={{ r: 6, stroke: '#fbbf24', strokeWidth: 2, fill: '#fff' }}
                                        connectNulls={true}
                                    />
                                    <Line 
                                        type="monotone" 
                                        dataKey="forecastPessimista" 
                                        stroke="#f43f5e" 
                                        strokeWidth={2} 
                                        strokeDasharray="5 5"
                                        dot={{ r: 4, stroke: '#f43f5e', strokeWidth: 1, fill: '#0a0a0c' }}
                                        activeDot={{ r: 6, stroke: '#f43f5e', strokeWidth: 2, fill: '#fff' }}
                                        connectNulls={true}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Seção Inferior: Grid de Clientes e Contatos Críticos */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        {/* Coluna Esquerda: Filtros e Tabela de Oportunidades */}
                        <div className="lg:col-span-8 space-y-4">
                            <div className="card-premium p-6 bg-black/45 backdrop-blur-md shadow-2xl border border-white/10 space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Clientes Potenciais de Compra</h3>
                                        <p className="text-xs text-slate-500 mt-0.5">Lista inteligente baseada no ciclo médio e tempo de inatividade.</p>
                                    </div>
                                    <div className="relative w-full sm:max-w-xs group">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-[#e05050] transition-colors" />
                                        <input
                                            className="input pl-9 text-xs"
                                            placeholder="Buscar por cliente no predict..."
                                            value={searchPredict}
                                            onChange={e => setSearchPredict(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {/* Filtros de Inatividade */}
                                <div className="flex flex-wrap gap-1 bg-white/5 border border-white/10 rounded-xl p-1 w-fit">
                                    {([
                                        { id: 'all', label: 'Todos' },
                                        { id: 'ativo', label: 'Ciclo Ativo' },
                                        { id: '3m', label: '+3 Meses' },
                                        { id: '6m', label: '+6 Meses' },
                                        { id: '9m', label: '+9 Meses' },
                                        { id: '1a', label: '+1 Ano' },
                                        { id: '2a+', label: '+2 Anos' }
                                    ] as const).map(opt => (
                                        <button
                                            key={opt.id}
                                            onClick={() => setFiltroInatividade(opt.id)}
                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                                                filtroInatividade === opt.id
                                                    ? 'bg-white/15 text-white shadow'
                                                    : 'text-slate-500 hover:text-slate-300'
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div className="bg-white/5 border border-white/10 rounded-xl p-1">
                                        <div className="px-2 pt-1 text-[9px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                                            <Gauge className="w-3 h-3" />
                                            Probabilidade
                                        </div>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {([
                                                { id: 'all', label: 'Todas' },
                                                { id: 'alta', label: 'Alta' },
                                                { id: 'media', label: 'Média' },
                                                { id: 'baixa', label: 'Baixa' },
                                            ] as const).map(opt => (
                                                <button
                                                    key={opt.id}
                                                    onClick={() => setFiltroProbabilidade(opt.id)}
                                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${filtroProbabilidade === opt.id ? 'bg-white/15 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="bg-white/5 border border-white/10 rounded-xl p-1">
                                        <div className="px-2 pt-1 text-[9px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3" />
                                            Ação
                                        </div>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {([
                                                { id: 'all', label: 'Todas' },
                                                { id: 'acionar', label: 'Acionar' },
                                                { id: 'monitorar', label: 'Monitorar' },
                                                { id: 'reativar', label: 'Reativar' },
                                                { id: 'observar', label: 'Observar' },
                                            ] as const).map(opt => (
                                                <button
                                                    key={opt.id}
                                                    onClick={() => setFiltroAcao(opt.id)}
                                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${filtroAcao === opt.id ? 'bg-white/15 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <label className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 flex items-center gap-2">
                                        <SlidersHorizontal className="w-4 h-4 text-slate-500" />
                                        <select
                                            value={ordenacaoPredict}
                                            onChange={e => setOrdenacaoPredict(e.target.value as typeof ordenacaoPredict)}
                                            className="w-full bg-transparent text-xs font-bold text-slate-300 focus:outline-none cursor-pointer"
                                        >
                                            <option value="prioridade" className="bg-[#111113]">Ordenar: Prioridade</option>
                                            <option value="probabilidade" className="bg-[#111113]">Ordenar: Probabilidade</option>
                                            <option value="valor" className="bg-[#111113]">Ordenar: Valor mensal</option>
                                            <option value="atraso" className="bg-[#111113]">Ordenar: Atraso</option>
                                        </select>
                                    </label>
                                </div>

                                 {/* Tabela Premium */}
                                <div className="overflow-x-auto rounded-xl border border-white/5 bg-white/5">
                                    <table className="w-full text-xs">
                                        <thead className="bg-white/5 border-b border-white/10 text-slate-500">
                                            <tr>
                                                <th className="text-left text-[10px] font-bold uppercase tracking-wider px-4 py-3">Cliente</th>
                                                <th className="text-right text-[10px] font-bold uppercase tracking-wider px-2 py-3">Ciclo Médio</th>
                                                <th className="text-right text-[10px] font-bold uppercase tracking-wider px-2 py-3">Inatividade</th>
                                                <th className="text-right text-[10px] font-bold uppercase tracking-wider px-3 py-3">Valor Previsto</th>
                                                <th className="text-center text-[10px] font-bold uppercase tracking-wider px-4 py-3">Probabilidade</th>
                                                <th className="text-center text-[10px] font-bold uppercase tracking-wider px-3 py-3">Ação Sugerida</th>
                                                <th className="text-right text-[10px] font-bold uppercase tracking-wider px-4 py-3">Ação</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {filteredPredict.length === 0 ? (
                                                <tr>
                                                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500 font-medium">
                                                        Nenhum cliente atende a estes filtros de predição.
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredPredict.map((c, i) => {
                                                    // Determinar classes HSL sintonizadas para a probabilidade
                                                    const getProbColor = (lbl: 'alta' | 'media' | 'baixa') => {
                                                        if (lbl === 'alta') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25';
                                                        if (lbl === 'media') return 'bg-amber-500/10 text-amber-400 border-amber-500/25';
                                                        return 'bg-rose-500/10 text-rose-400 border-rose-500/25';
                                                    };
                                                    const getActionColor = (acao: ClientePredict['acaoRecomendada']) => {
                                                        if (acao === 'acionar') return 'bg-[#C01717]/15 text-[#f87171] border-[#C01717]/35';
                                                        if (acao === 'monitorar') return 'bg-amber-500/10 text-amber-300 border-amber-500/25';
                                                        if (acao === 'reativar') return 'bg-rose-500/10 text-rose-300 border-rose-500/25';
                                                        return 'bg-slate-500/10 text-slate-300 border-slate-500/20';
                                                    };

                                                    return (
                                                        <tr key={i} className="hover:bg-white/5 transition-colors group">
                                                            <td className="px-4 py-3 whitespace-nowrap">
                                                                <div className="font-bold text-white max-w-[200px] truncate group-hover:text-[#f87171] transition-colors" title={c.nome}>
                                                                    {c.nome}
                                                                </div>
                                                                <div className="text-[9px] text-slate-500 font-semibold mt-0.5">
                                                                    Última compra: {formatDate(c.ultimaCompraDate)}
                                                                </div>
                                                                <div className="text-[9px] text-slate-600 font-semibold mt-0.5">
                                                                    Score {c.prioridadeScore} · {c.segmentoValor}
                                                                </div>
                                                            </td>
                                                            <td className="px-2 py-3 text-right text-slate-300 font-medium whitespace-nowrap">
                                                                {c.cicloMedioMeses > 0 
                                                                    ? `a cada ${c.cicloMedioMeses.toFixed(1)} meses` 
                                                                    : 'Compra única'}
                                                                <div className="text-[9px] text-slate-600 mt-0.5">
                                                                    Conf. {Math.round(c.confiancaCiclo * 100)}%
                                                                </div>
                                                            </td>
                                                            <td className="px-2 py-3 text-right whitespace-nowrap">
                                                                <span className={`font-bold ${c.inatividadeMeses > c.cicloMedioMeses && c.cicloMedioMeses > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                                                                    {c.inatividadeMeses === 0 ? 'Ativo' : `${c.inatividadeMeses} ${c.inatividadeMeses === 1 ? 'mês' : 'meses'}`}
                                                                </span>
                                                                <div className="text-[9px] text-slate-600 mt-0.5">
                                                                    {c.proximaCompraMes ? `Prev. ${c.proximaCompraMes}` : 'Sem ciclo'}
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-3 text-right whitespace-nowrap">
                                                                <span className="font-bold text-white block">
                                                                    {c.valorForecast > 0 ? formatCurrency(c.valorForecast) : '—'}
                                                                </span>
                                                                <span className="text-[9px] text-slate-500 block">
                                                                    Média: {formatCurrency(c.faturamentoMedioMensal)}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-center whitespace-nowrap">
                                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${getProbColor(c.probabilidadeLabel)}`}>
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                                                    {c.probabilidade}% - {c.probabilidadeLabel}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-3 text-center whitespace-nowrap">
                                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${getActionColor(c.acaoRecomendada)}`}>
                                                                    {c.acaoRecomendada}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-right whitespace-nowrap">
                                                                <Link
                                                                    to={`/clientes?cliente=${encodeURIComponent(c.nome)}&tab=itens`}
                                                                    className="inline-flex items-center gap-1 bg-[#C01717]/10 hover:bg-[#C01717] text-[#f87171] hover:text-white border border-[#C01717]/25 hover:border-transparent rounded-lg px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                                                                >
                                                                    <span>Oportunidades</span>
                                                                    <ArrowRight className="w-3 h-3" />
                                                                </Link>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Coluna Direita: Widget Premium - Contatos Críticos */}
                        <div className="lg:col-span-4 space-y-4">
                            <div className="card-premium p-6 bg-black/45 backdrop-blur-md shadow-2xl border border-white/10 space-y-4 sticky top-4">
                                <div className="border-b border-white/10 pb-3">
                                    <h3 className="text-xs font-bold text-[#f87171] uppercase tracking-wider flex items-center gap-1.5">
                                        <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                                        Contatos Críticos do Mês
                                    </h3>
                                    <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                                        Clientes de alto ticket com compra iminente prevista. Ação recomendada imediata.
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    {predictData.contatosQuentes.length === 0 ? (
                                        <p className="text-xs text-slate-500 text-center py-6">Nenhum contato crítico pendente no momento.</p>
                                    ) : (
                                        predictData.contatosQuentes.map((c, i) => (
                                            <div 
                                                key={i} 
                                                className="bg-white/5 border border-white/5 hover:border-[#C01717]/40 rounded-xl p-3.5 space-y-2.5 transition-all group"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="space-y-0.5 max-w-[70%]">
                                                        <h4 className="font-bold text-white text-xs truncate group-hover:text-[#f87171] transition-colors" title={c.nome}>
                                                            {c.nome}
                                                        </h4>
                                                        <p className="text-[9px] text-slate-500 font-semibold">
                                                            Última compra há {c.inatividadeMeses === 0 ? 'menos de 1 mês' : `${c.inatividadeMeses} ${c.inatividadeMeses === 1 ? 'mês' : 'meses'}`}
                                                        </p>
                                                    </div>
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                                                        {c.probabilidade}% Alta
                                                    </span>
                                                </div>

                                                <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-white/5">
                                                    <div>
                                                        <span className="text-[9px] text-slate-500 block">Ticket Médio Mensal</span>
                                                        <span className="font-black text-emerald-400">{formatCurrency(c.faturamentoMedioMensal)}</span>
                                                    </div>
                                                    <Link
                                                        to={`/clientes?cliente=${encodeURIComponent(c.nome)}&tab=itens`}
                                                        className="inline-flex items-center gap-1 bg-[#C01717] hover:bg-[#a81414] text-white rounded-lg px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wider transition-all shadow-md shadow-[#C01717]/15"
                                                    >
                                                        <PhoneCall className="w-3 h-3" />
                                                        <span>Acionar</span>
                                                    </Link>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    </div>
                )
            )}
        </div>
    );
}
