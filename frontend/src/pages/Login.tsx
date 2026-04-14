import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Lock, User, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
    const { login } = useAuth();
    const navigate = useNavigate();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(username.trim(), password);
            navigate('/', { replace: true });
        } catch (err: any) {
            setError(err.message || 'Erro ao fazer login');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-pbi-bg flex items-center justify-center relative overflow-hidden">
            {/* Background effects */}
            <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-[#C01717]/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute top-[20%] -right-[5%] w-[30%] h-[30%] bg-pink-500/5 blur-[100px] rounded-full pointer-events-none" />

            <div className="relative z-10 w-full max-w-sm mx-4">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-[#C01717]/15 flex items-center justify-center">
                            <TrendingUp className="w-6 h-6 text-[#e05050]" />
                        </div>
                        <div className="text-left">
                            <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest text-slate-400">POWER BI</p>
                            <p className="text-lg font-black italic tracking-tight text-white">EXPERIENCE</p>
                        </div>
                    </div>
                    <p className="text-slate-400 text-sm">CRM Kalled Pistões</p>
                </div>

                {/* Card */}
                <div className="glass-header rounded-2xl p-6 border border-white/10">
                    <h2 className="text-lg font-semibold text-white mb-6">Acesso ao Dashboard</h2>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Username */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                                Usuário
                            </label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    placeholder="seu usuário"
                                    autoComplete="username"
                                    autoFocus
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:ring-1 focus:ring-[#C01717] focus:border-[#C01717]/50 transition-all"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                                Senha
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:ring-1 focus:ring-[#C01717] focus:border-[#C01717]/50 transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                                {error}
                            </p>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[#C01717] hover:bg-[#a01414] disabled:bg-[#C01717]/50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors mt-2"
                        >
                            {loading ? 'Entrando...' : 'Entrar'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
