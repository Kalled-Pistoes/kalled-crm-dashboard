import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface KPICardProps {
    title: string;
    value: string;
    subtitle?: string;
    icon: LucideIcon;
    variant?: 'purple' | 'pink' | 'green' | 'blue';
    trend?: number;
}

const variantMap = {
    purple: 'from-purple-500/10 to-purple-500/5 border-purple-500/20 text-purple-200',
    pink: 'from-pink-500/10 to-pink-500/5 border-pink-500/20 text-pink-200',
    green: 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 text-emerald-200',
    blue: 'from-blue-500/10 to-blue-500/5 border-blue-500/20 text-blue-200',
};

const iconBgMap = {
    purple: 'bg-purple-500/20 text-purple-400',
    pink: 'bg-pink-500/20 text-pink-400',
    green: 'bg-emerald-500/20 text-emerald-400',
    blue: 'bg-blue-500/20 text-blue-400',
};

export default function KPICard({ title, value, subtitle, icon: Icon, variant = 'blue', trend }: KPICardProps) {
    const vClass = variantMap[variant];
    const iconClass = iconBgMap[variant];

    return (
        <div className={`card bg-gradient-to-br backdrop-blur-2xl border flex flex-col justify-between h-28 sm:h-32 transition-all hover:scale-[1.02] hover:border-white/20 group cursor-default ${vClass}`}>
            <div className="flex justify-between items-start">
                <div className={`p-2.5 rounded-xl transition-colors ${iconClass}`}>
                    <Icon className="w-5 h-5" />
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-bold uppercase opacity-50 tracking-widest">{title}</p>
                    <p className="text-2xl font-black mt-1 text-white tracking-tighter">{value}</p>
                </div>
            </div>

            <div className="flex justify-between items-end mt-2">
                {trend !== undefined && (
                    <div className={`flex items-center gap-1.5 text-[11px] font-bold ${trend >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {trend >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                        <span>{Math.abs(trend).toFixed(1)}%</span>
                        <span className="text-white/30 font-normal ml-1">vs. ano anterior</span>
                    </div>
                )}
                {subtitle && <p className="text-[10px] text-white/40 italic">{subtitle}</p>}
            </div>
        </div>
    );
}
