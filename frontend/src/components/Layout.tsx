import { useSearchParams, NavLink, useLocation, Outlet } from 'react-router-dom';
import {
    LayoutDashboard,
    Users,
    ShoppingCart,
    UserCheck,
    TrendingUp,
    MapPin,
    LogOut,
    UserCog,
    User,
    Database,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Layout() {
    const [searchParams, setSearchParams] = useSearchParams();
    const { pathname } = useLocation();
    const { user, logout, isAdmin, isRep } = useAuth();

    const isClientesPage = pathname === '/clientes';
    const isRepresentantesPage = pathname === '/representantes';

    const currentAno = searchParams.get('ano') || '2024';
    const currentMes = searchParams.get('mes') || '';

    const setFilter = (key: string, value: string) => {
        const newParams = new URLSearchParams(searchParams);
        if (value && value !== 'Todos') {
            newParams.set(key, value);
        } else {
            newParams.delete(key);
        }
        setSearchParams(newParams);
    };

    const anos = ['2023', '2024', '2025', '2026'];
    const meses = [
        { val: '01', label: 'Janeiro' },
        { val: '02', label: 'Fevereiro' },
        { val: '03', label: 'Março' },
        { val: '04', label: 'Abril' },
        { val: '05', label: 'Maio' },
        { val: '06', label: 'Junho' },
        { val: '07', label: 'Julho' },
        { val: '08', label: 'Agosto' },
        { val: '09', label: 'Setembro' },
        { val: '10', label: 'Outubro' },
        { val: '11', label: 'Novembro' },
        { val: '12', label: 'Dezembro' },
    ];

    const navItems = [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/vendas', icon: ShoppingCart, label: 'Vendas' },
        { to: '/clientes', icon: Users, label: 'Clientes' },
        { to: '/representantes', icon: UserCheck, label: 'Representantes' },
        { to: '/visitas', icon: MapPin, label: 'Visitas' },
        ...(isAdmin ? [{ to: '/usuarios', icon: UserCog, label: 'Usuários' }] : []),
        ...(isAdmin ? [{ to: '/sync', icon: Database, label: 'Sincronizar' }] : []),
    ];

    return (
        <div className="flex flex-col h-screen bg-pbi-bg text-pbi-text overflow-hidden relative">
            {/* Background Spotlight Effects */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
                <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-brand-500/10 blur-[120px] rounded-full" />
                <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-pink-500/5 blur-[100px] rounded-full" />
            </div>

            {/* Top Navigation Bar */}
            <header className="glass-header h-14 flex items-center justify-between px-3 sm:px-6 flex-shrink-0 z-20">
                <div className="flex items-center gap-3 sm:gap-8">
                    {/* Logo Area */}
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 flex items-center justify-center">
                            <TrendingUp className="w-6 h-6 text-sky-400" />
                        </div>
                        <div className="leading-tight hidden sm:block">
                            <p className="text-[10px] font-bold opacity-70 uppercase tracking-tighter">POWER BI</p>
                            <p className="text-sm font-black italic tracking-tighter">EXPERIENCE</p>
                        </div>
                    </div>

                    <div className="hidden sm:block h-6 w-px bg-white/20 mx-2" />

                    {/* Title Area */}
                    <h1 className="hidden md:block text-lg font-medium tracking-tight uppercase">VISÃO GERAL DE VENDAS</h1>
                </div>

                {/* Nav + User */}
                <div className="flex items-center gap-2 sm:gap-3">
                    <div className="flex items-center bg-white/5 border border-white/5 rounded-xl p-1 backdrop-blur-sm">
                        {navItems.map(({ to, icon: Icon, label }) => (
                            <NavLink
                                key={to}
                                to={to}
                                end={to === '/dashboard'}
                                className={({ isActive }) =>
                                    `px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${isActive
                                        ? 'bg-white/10 text-white shadow-lg shadow-black/20'
                                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                                    }`
                                }
                            >
                                <Icon className="w-3.5 h-3.5" />
                                <span className="hidden lg:inline">{label}</span>
                            </NavLink>
                        ))}
                    </div>

                    <div className="hidden sm:block h-6 w-px bg-white/10" />

                    {/* User info + logout */}
                    <div className="flex items-center gap-2">
                        <div className="hidden sm:flex items-center gap-2 bg-white/5 rounded-xl px-2.5 py-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span className="text-xs font-medium text-slate-300 max-w-[100px] truncate">{user?.username}</span>
                        </div>
                        <button
                            onClick={logout}
                            title="Sair"
                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Rep banner */}
            {isRep && user?.representante && (
                <div className="bg-sky-500/10 border-b border-sky-500/20 px-4 sm:px-6 py-2 flex items-center gap-2 z-10 flex-shrink-0">
                    <UserCheck className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                    <span className="text-xs text-sky-300">
                        Você está visualizando dados de: <strong className="font-semibold text-white">{user.representante}</strong>
                    </span>
                </div>
            )}

            {/* Filter Sub-header */}
            <div className="bg-pbi-navy/40 backdrop-blur-sm text-white flex-shrink-0 text-xs shadow-sm border-b border-white/5 z-10 overflow-x-auto">
                <div className="flex items-center justify-end px-3 sm:px-6 gap-3 sm:gap-6 py-2 min-w-max sm:min-w-0 sm:w-full">
                    {!isClientesPage && (
                        <>
                            {!isRepresentantesPage && (
                                <div className="flex items-center gap-2">
                                    <span className="text-slate-500 font-bold uppercase tracking-wider">Ano</span>
                                    <div className="flex gap-1 bg-black/20 p-1 rounded-lg">
                                        {anos.map(ano => (
                                            <button
                                                key={ano}
                                                onClick={() => setFilter('ano', ano)}
                                                className={`px-2 sm:px-3 py-1 rounded-md transition-all text-[10px] font-bold ${currentAno === ano ? 'bg-white/10 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                                            >
                                                {ano}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-2 min-w-[130px]">
                                <span className="text-slate-500 font-bold uppercase tracking-wider">Mês</span>
                                <select
                                    value={currentMes || 'Todos'}
                                    onChange={(e) => setFilter('mes', e.target.value)}
                                    className="bg-white/5 border border-white/10 text-white rounded-lg px-2 py-1 w-full outline-none focus:ring-1 focus:ring-brand-500 backdrop-blur-md appearance-none cursor-pointer"
                                >
                                    <option value="Todos" className="bg-slate-900">Todos os Meses</option>
                                    {meses.map(m => (
                                        <option key={m.val} value={m.val} className="bg-slate-900">{m.label}</option>
                                    ))}
                                </select>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 bg-transparent z-10">
                <Outlet />
            </main>

            {/* Micro Footer */}
            <footer className="h-6 bg-slate-950/80 backdrop-blur-md border-t border-white/5 px-3 sm:px-4 flex items-center justify-between text-[10px] text-slate-500 z-20">
                <p className="font-medium opacity-60 italic truncate max-w-[50%] hidden sm:block">Z:\VENDAS\...\Base de Dados de Vendas.xlsx</p>
                <div className="flex items-center gap-3 sm:gap-4 ml-auto">
                    <span>Brasil</span>
                    <span className="bg-white/5 px-2 py-0.5 rounded border border-white/5">v2.0.0-premium</span>
                </div>
            </footer>
        </div>
    );
}
