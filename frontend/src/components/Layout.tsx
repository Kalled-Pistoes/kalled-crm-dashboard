import { useSearchParams, NavLink, useLocation, Outlet } from 'react-router-dom';
import {
    LayoutDashboard,
    Users,
    ShoppingCart,
    UserCheck,
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
    const isSyncPage = pathname === '/sync';

    const currentAno = searchParams.get('ano') || String(new Date().getFullYear());
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

    const currentYear = new Date().getFullYear();
    const anos = [
        String(currentYear - 2),
        String(currentYear - 1),
        String(currentYear),
        String(currentYear + 1)
    ];
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
        <div className="flex flex-col h-screen bg-[#18181b] text-[#f0f0f0] overflow-hidden relative">
            {/* Subtle red glow top-left */}
            <div className="absolute -top-[10%] -left-[10%] w-[35%] h-[35%] bg-[#C01717]/6 blur-[120px] rounded-full pointer-events-none z-0" />

            {/* Top Navigation Bar */}
            <header className="bg-[#111113]/90 backdrop-blur-md border-b border-[#2a2a2a] h-14 flex items-center justify-between px-3 sm:px-6 flex-shrink-0 z-20">
                <div className="flex items-center gap-3 sm:gap-6">
                    {/* Kalled Logo */}
                    <div className="flex items-center gap-3">
                        <img
                            src="/Kalled%20White.png"
                            alt="Kalled"
                            className="h-20 object-contain"
                            onError={e => {
                                e.currentTarget.style.display = 'none';
                                const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
                                if (fb) fb.style.removeProperty('display');
                            }}
                        />
                        <div className="hidden items-center gap-1.5">
                            <span className="text-2xl font-black text-[#C01717] italic">K</span>
                            <div className="leading-tight">
                                <p className="text-xs font-black tracking-widest uppercase leading-none text-[#f0f0f0]">Kalled</p>
                                <p className="text-[9px] font-semibold tracking-[0.25em] text-[#666] uppercase">Pistões</p>
                            </div>
                        </div>
                    </div>

                    <div className="hidden sm:block h-5 w-px bg-[#333]" />

                    <h1 className="hidden md:block text-xs font-bold tracking-[0.2em] uppercase text-[#666]">
                        CRM · Dashboard
                    </h1>
                </div>

                {/* Nav + User */}
                <div className="flex items-center gap-2 sm:gap-3">
                    <div className="flex items-center bg-[#232328] border border-[#333] rounded-xl p-1">
                        {navItems.map(({ to, icon: Icon, label }) => (
                            <NavLink
                                key={to}
                                to={to}
                                end={to === '/dashboard'}
                                className={({ isActive }) =>
                                    `px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${isActive
                                        ? 'bg-[#C01717] text-white shadow-lg shadow-[#C01717]/20'
                                        : 'text-[#888] hover:text-[#f0f0f0] hover:bg-[#2d2d35]'
                                    }`
                                }
                            >
                                <Icon className="w-3.5 h-3.5" />
                                <span className="hidden lg:inline">{label}</span>
                            </NavLink>
                        ))}
                    </div>

                    <div className="hidden sm:block h-5 w-px bg-[#333]" />

                    {/* User info + logout */}
                    <div className="flex items-center gap-2">
                        <div className="hidden sm:flex items-center gap-2 bg-[#232328] border border-[#333] rounded-xl px-2.5 py-1.5">
                            <User className="w-3.5 h-3.5 text-[#666] flex-shrink-0" />
                            <span className="text-xs font-medium text-[#a0a0a8] max-w-[100px] truncate">{user?.username}</span>
                        </div>
                        <button
                            onClick={logout}
                            title="Sair"
                            className="p-2 text-[#666] hover:text-[#C01717] hover:bg-[#C01717]/10 rounded-xl transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Rep banner */}
            {isRep && user?.representante && (
                <div className="bg-[#C01717]/10 border-b border-[#C01717]/20 px-4 sm:px-6 py-2 flex items-center gap-2 z-10 flex-shrink-0">
                    <UserCheck className="w-3.5 h-3.5 text-[#C01717] flex-shrink-0" />
                    <span className="text-xs text-[#e05050]">
                        Você está visualizando dados de: <strong className="font-semibold text-[#f0f0f0]">{user.representante}</strong>
                    </span>
                </div>
            )}

            {/* Filter Sub-header */}
            <div className="bg-[#111113]/60 backdrop-blur-sm text-[#f0f0f0] flex-shrink-0 text-xs border-b border-[#2a2a2a] z-10 overflow-x-auto">
                <div className="flex items-center justify-end px-3 sm:px-6 gap-3 sm:gap-6 py-2 min-w-max sm:min-w-0 sm:w-full">
                    {!isClientesPage && !isSyncPage && (
                        <>
                            {!isRepresentantesPage && (
                                <div className="flex items-center gap-2">
                                    <span className="text-[#555] font-bold uppercase tracking-wider">Ano</span>
                                    <div className="flex gap-1 bg-[#18181b] p-1 rounded-lg border border-[#2a2a2a]">
                                        {anos.map(ano => (
                                            <button
                                                key={ano}
                                                onClick={() => setFilter('ano', ano)}
                                                className={`px-2 sm:px-3 py-1 rounded-md transition-all text-[10px] font-bold ${currentAno === ano
                                                    ? 'bg-[#C01717] text-white shadow-sm'
                                                    : 'text-[#555] hover:text-[#aaa]'}`}
                                            >
                                                {ano}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-2 min-w-[130px]">
                                <span className="text-[#555] font-bold uppercase tracking-wider">Mês</span>
                                <select
                                    value={currentMes || 'Todos'}
                                    onChange={(e) => setFilter('mes', e.target.value)}
                                    style={{ backgroundColor: '#18181b' }}
                                    className="border border-[#333] text-[#f0f0f0] rounded-lg px-2 py-1 w-full outline-none focus:ring-1 focus:ring-[#C01717] appearance-none cursor-pointer"
                                >
                                    <option value="Todos" style={{ backgroundColor: '#18181b' }}>Todos os Meses</option>
                                    {meses.map(m => (
                                        <option key={m.val} value={m.val} style={{ backgroundColor: '#18181b' }}>{m.label}</option>
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
            <footer className="h-6 bg-[#111113]/90 backdrop-blur-md border-t border-[#2a2a2a] px-3 sm:px-4 flex items-center justify-between text-[10px] text-[#444] z-20">
                <p className="font-medium italic truncate max-w-[50%] hidden sm:block">Kalled Pistões · CRM</p>
                <div className="flex items-center gap-3 sm:gap-4 ml-auto">
                    <span>Brasil</span>
                    <span className="bg-[#232328] border border-[#333] px-2 py-0.5 rounded">v2.0.0</span>
                </div>
            </footer>
        </div>
    );
}
