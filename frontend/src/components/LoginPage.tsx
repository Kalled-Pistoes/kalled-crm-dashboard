import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
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
            navigate('/dashboard', { replace: true });
        } catch (err: any) {
            setError(err.message || 'Erro ao fazer login');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-[#18181b] flex items-center justify-center relative overflow-hidden">
            {/* Subtle red glow */}
            <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-[#C01717]/8 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-[30%] h-[30%] bg-[#C01717]/5 blur-[100px] rounded-full pointer-events-none" />

            <div className="relative z-10 w-full max-w-sm mx-4">
                {/* Back to catalog */}
                <button
                    onClick={() => navigate('/')}
                    className="flex items-center gap-1.5 text-xs text-[#666] hover:text-[#aaa] mb-8 transition-colors"
                >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Voltar ao Catálogo
                </button>

                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-4">
                        <img
                            src="/logo-kalled.png"
                            alt="Kalled Pistões"
                            className="h-14 object-contain"
                            onError={e => {
                                e.currentTarget.style.display = 'none';
                                const fb = e.currentTarget.nextElementSibling as HTMLElement | null;
                                if (fb) fb.style.removeProperty('display');
                            }}
                        />
                        <div className="hidden items-center gap-2">
                            <span className="text-4xl font-black text-[#C01717] italic">K</span>
                            <div className="text-left">
                                <p className="text-base font-black tracking-widest uppercase leading-none text-[#f0f0f0]">Kalled</p>
                                <p className="text-[10px] font-semibold tracking-[0.3em] text-[#666] uppercase">Pistões</p>
                            </div>
                        </div>
                    </div>
                    <p className="text-[10px] font-bold text-[#666] uppercase tracking-widest">Área Restrita · CRM</p>
                </div>

                {/* Card */}
                <div className="bg-[#232328] border border-[#333] rounded-2xl p-6">
                    <h2 className="text-lg font-semibold text-[#f0f0f0] mb-6">Acesso ao Dashboard</h2>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-[#a0a0a8] uppercase tracking-wider mb-1.5">
                                Usuário
                            </label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    placeholder="seu usuário"
                                    autoComplete="username"
                                    autoFocus
                                    required
                                    className="w-full bg-[#18181b] border-2 border-[#444] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#f0f0f0] placeholder-[#555] outline-none focus:border-[#C01717] transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-[#a0a0a8] uppercase tracking-wider mb-1.5">
                                Senha
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                    required
                                    className="w-full bg-[#18181b] border-2 border-[#444] rounded-xl pl-10 pr-10 py-2.5 text-sm text-[#f0f0f0] placeholder-[#555] outline-none focus:border-[#C01717] transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-[#aaa] transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[#C01717] hover:bg-[#a01414] disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors mt-2"
                        >
                            {loading ? 'Entrando...' : 'Entrar'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
