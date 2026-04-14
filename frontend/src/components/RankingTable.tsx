import { Check, X } from 'lucide-react';

import { formatCurrency, RankingVendedor } from '../lib/api';

interface RankingTableProps {
    vendedores: RankingVendedor[];
}

export default function RankingTable({ vendedores }: RankingTableProps) {
    const getMedal = (index: number) => {
        switch (index) {
            case 0: return <span className="text-xl">🥇</span>;
            case 1: return <span className="text-xl">🥈</span>;
            case 2: return <span className="text-xl">🥉</span>;
            default: return index + 1;
        }
    };

    return (
        <div className="card-premium overflow-hidden flex flex-col h-full">
            <div className="bg-[#C01717]/15 text-[#e05050] px-4 py-3 border-b border-[#2a2a2a]">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-center">Ranking Geral de Vendedores</h3>
            </div>

            <div className="flex-1 overflow-y-auto">
                <table className="w-full text-xs border-collapse">
                    <thead className="bg-white/5 sticky top-0 z-10 border-b border-white/5">
                        <tr>
                            <th className="py-3 px-4 w-12 text-center text-[9px] font-bold text-slate-500 uppercase tracking-wider">#</th>
                            <th className="py-3 px-2 text-left text-[9px] font-bold text-slate-500 uppercase tracking-wider">Vendedor</th>
                            <th className="py-3 px-4 w-28 text-center text-[9px] font-bold text-slate-500 uppercase tracking-wider">Faturamento</th>
                            <th className="py-3 px-4 w-24 text-center text-[9px] font-bold text-slate-500 uppercase tracking-wider">Média</th>
                            <th className="py-3 px-4 w-24 text-right text-[9px] font-bold text-slate-500 uppercase pr-8 tracking-wider">Meta</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {vendedores.map((v, index) => (
                            <tr key={v.nome} className="hover:bg-white/5 transition-colors group">
                                <td className="py-3 px-4 font-bold text-slate-300 w-12 text-center">{getMedal(index)}</td>
                                <td className="py-3 px-2 font-bold text-slate-200 leading-tight">
                                    <div className="flex flex-col">
                                        <span className="truncate max-w-[180px]">{v.nome}</span>
                                    </div>
                                </td>
                                <td className="py-3 px-4 w-28 text-center font-bold text-slate-300">{formatCurrency(v.faturamento)}</td>
                                <td className="py-3 px-4 w-24 text-center text-slate-500 font-medium">{formatCurrency(v.media)}</td>
                                <td className="py-3 px-4 w-24">
                                    <div className="flex items-center justify-end gap-2">
                                        {v.percentMeta >= 100 ? (
                                            <Check className="w-3 h-3 text-emerald-400 stroke-[3px]" />
                                        ) : (
                                            <X className="w-3 h-3 text-rose-400 stroke-[3px]" />
                                        )}
                                        <span className={`font-black w-10 text-right text-[11px] ${v.percentMeta >= 100 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {v.percentMeta.toFixed(0)}%
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
