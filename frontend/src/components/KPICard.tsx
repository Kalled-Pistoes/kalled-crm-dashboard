import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface KPICardProps {
    title: string;
    value: string;
    subtitle?: string;
    icon: LucideIcon;
    variant?: 'purple' | 'pink' | 'green' | 'blue';
    trend?: number;
}

// Todos os cards usam a paleta Kalled — variações sutis de vermelho/escuro
const variantMap = {
    purple: 'from-[#C01717]/12 to-[#C01717]/5 border-[#C01717]/25',
    pink:   'from-[#a01414]/12 to-[#a01414]/5 border-[#a01414]/25',
    green:  'from-[#232328] to-[#1f1f23] border-[#333]',
    blue:   'from-[#232328] to-[#1f1f23] border-[#333]',
};

const iconBgMap = {
    purple: 'bg-[#C01717]/20 text-[#e05050]',
    pink:   'bg-[#C01717]/15 text-[#C01717]',
    green:  'bg-[#C01717]/10 text-[#C01717]',
    blue:   'bg-[#C01717]/10 text-[#C01717]',
};

export default function KPICard({ title, value, subtitle, icon: Icon, variant = 'blue', trend }: KPICardProps) {
    const vClass = variantMap[variant];
    const iconClass = iconBgMap[variant];

    return (
        <div className={`card bg-gradient-to-br backdrop-blur-2xl border flex flex-col justify-between h-28 sm:h-32 transition-all hover:scale-[1.02] hover:border-[#C01717]/40 group cursor-default ${vClass}`}>
            <div className="flex justify-between items-start">
                <div className={`p-2.5 rounded-xl transition-colors ${iconClass}`}>
                    <Icon className="w-5 h-5" />
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-bold uppercase text-[#666] tracking-widest">{title}</p>
                    <p className="text-2xl font-black mt-1 text-[#f0f0f0] tracking-tighter">{value}</p>
                </div>
            </div>

            <div className="flex justify-between items-end mt-2">
                {trend !== undefined && (
                    <div className={`flex items-center gap-1.5 text-[11px] font-bold ${trend >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {trend >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                        <span>{Math.abs(trend).toFixed(1)}%</span>
                        <span className="text-[#444] font-normal ml-1">vs. ano anterior</span>
                    </div>
                )}
                {subtitle && <p className="text-[10px] text-[#555] italic">{subtitle}</p>}
            </div>
        </div>
    );
}
