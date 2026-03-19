import { formatCurrency, ClienteTop } from '../lib/api';

interface TopClientesProps {
    clientes: ClienteTop[];
}

export default function TopClientes({ clientes }: TopClientesProps) {
    return (
        <div className="card-premium overflow-hidden flex flex-col h-full">
            <div className="bg-brand-600/20 text-brand-300 px-4 py-3 border-b border-white/5">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-center">Top 5 Clientes (Faturamento)</h3>
            </div>

            <div className="flex-1 overflow-y-auto">
                <table className="w-full text-xs border-collapse">
                    <thead className="bg-white/5 sticky top-0 z-10 border-b border-white/5">
                        <tr>
                            <th className="py-3 px-4 w-12 text-center text-[9px] font-bold text-slate-500 uppercase tracking-wider">#</th>
                            <th className="py-3 px-2 text-left text-[9px] font-bold text-slate-500 uppercase tracking-wider">Cliente</th>
                            <th className="py-3 px-2 text-center text-[9px] font-bold text-slate-500 uppercase tracking-wider">UF</th>
                            <th className="py-3 px-4 w-28 text-right text-[9px] font-bold text-slate-500 uppercase pr-4 tracking-wider">Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {clientes.map((c, index) => (
                            <tr key={c.nome} className="hover:bg-white/5 transition-colors group">
                                <td className="py-3 px-4 font-bold text-slate-500 w-12 text-center">{index + 1}</td>
                                <td className="py-3 px-2 font-bold text-slate-200 leading-tight">
                                    <div className="flex flex-col">
                                        <span className="truncate max-w-[150px]" title={c.nome}>{c.nome}</span>
                                    </div>
                                </td>
                                <td className="py-3 px-2 text-center">
                                    <span className="px-2 py-0.5 bg-brand-500/10 text-brand-400 border border-brand-500/20 rounded text-[10px] font-bold">
                                        {c.estado}
                                    </span>
                                </td>
                                <td className="py-3 px-4 w-28 text-right font-bold text-brand-400 pr-4">{formatCurrency(c.valorTotal)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
