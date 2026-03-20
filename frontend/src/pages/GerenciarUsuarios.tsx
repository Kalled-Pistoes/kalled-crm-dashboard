import { useEffect, useState } from 'react';
import { UserCog, Plus, Pencil, Trash2, X, Check, KeyRound } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api, Representante } from '../lib/api';

const API_BASE = import.meta.env.VITE_API_URL || window.location.origin;

interface CrmUser {
    id: string;
    username: string;
    role: string;
    representante: string | null;
    createdAt: string;
}

interface UserForm {
    username: string;
    password: string;
    role: string;
    representante: string;
}

const emptyForm: UserForm = { username: '', password: '', role: 'representante', representante: '' };

export default function GerenciarUsuarios() {
    const { token, user: me, isAdmin } = useAuth();
    const [users, setUsers] = useState<CrmUser[]>([]);
    const [reps, setReps] = useState<Representante[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<UserForm>(emptyForm);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    async function authFetch(url: string, options: RequestInit = {}) {
        const res = await fetch(`${API_BASE}${url}`, {
            ...options,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers },
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `Erro ${res.status}`);
        }
        return res.json();
    }

    async function loadData() {
        setLoading(true);
        try {
            const [usersData, repsData] = await Promise.all([
                authFetch('/api/admin/users'),
                api.getRepresentantes(),
            ]);
            setUsers(usersData);
            setReps(repsData);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { if (isAdmin) loadData(); }, [isAdmin]);

    function openCreate() {
        setEditingId(null);
        setForm(emptyForm);
        setError('');
        setShowForm(true);
    }

    function openEdit(u: CrmUser) {
        setEditingId(u.id);
        setForm({ username: u.username, password: '', role: u.role, representante: u.representante || '' });
        setError('');
        setShowForm(true);
    }

    async function handleSave() {
        setError('');
        setSaving(true);
        try {
            if (editingId) {
                const body: any = { role: form.role, representante: form.representante || null };
                if (form.password) body.password = form.password;
                await authFetch(`/api/admin/users/${editingId}`, { method: 'PUT', body: JSON.stringify(body) });
            } else {
                await authFetch('/api/admin/users', {
                    method: 'POST',
                    body: JSON.stringify({
                        username: form.username,
                        password: form.password,
                        role: form.role,
                        representante: form.representante || null,
                    }),
                });
            }
            setShowForm(false);
            await loadData();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id: string) {
        setSaving(true);
        try {
            await authFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
            setDeleteConfirm(null);
            await loadData();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    }

    if (!isAdmin) {
        return (
            <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                Acesso restrito ao administrador.
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-sky-500/15 flex items-center justify-center">
                        <UserCog className="w-5 h-5 text-sky-400" />
                    </div>
                    <div>
                        <h1 className="text-base font-semibold text-white">Gerenciar Usuários</h1>
                        <p className="text-xs text-slate-500">{users.length} usuário{users.length !== 1 ? 's' : ''} cadastrado{users.length !== 1 ? 's' : ''}</p>
                    </div>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
                >
                    <Plus className="w-3.5 h-3.5" /> Novo Usuário
                </button>
            </div>

            {/* Error global */}
            {error && !showForm && (
                <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-4">{error}</p>
            )}

            {/* User list */}
            {loading ? (
                <p className="text-slate-500 text-sm text-center py-10">Carregando...</p>
            ) : (
                <div className="space-y-2">
                    {users.map(u => (
                        <div
                            key={u.id}
                            className="glass-header rounded-xl px-4 py-3 flex items-center gap-4"
                        >
                            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 text-xs font-bold uppercase flex-shrink-0">
                                {u.username[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white">{u.username}</p>
                                <p className="text-xs text-slate-500">
                                    {u.role === 'admin' ? 'Administrador' : `Representante${u.representante ? `: ${u.representante}` : ' (sem vínculo)'}`}
                                </p>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${u.role === 'admin' ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' : 'text-sky-400 border-sky-500/30 bg-sky-500/10'}`}>
                                {u.role === 'admin' ? 'ADMIN' : 'REP'}
                            </span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => openEdit(u)}
                                    className="p-1.5 text-slate-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                                    title="Editar"
                                >
                                    <Pencil className="w-3.5 h-3.5" />
                                </button>
                                {u.id !== me?.id && (
                                    deleteConfirm === u.id ? (
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleDelete(u.id)}
                                                disabled={saving}
                                                className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                title="Confirmar exclusão"
                                            >
                                                <Check className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => setDeleteConfirm(null)}
                                                className="p-1.5 text-slate-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setDeleteConfirm(u.id)}
                                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                            title="Excluir"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Form Overlay */}
            {showForm && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="glass-header rounded-2xl p-6 w-full max-w-sm border border-white/10">
                        <div className="flex items-center justify-between mb-5">
                            <h2 className="text-base font-semibold text-white">
                                {editingId ? 'Editar Usuário' : 'Novo Usuário'}
                            </h2>
                            <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-white transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Username (só na criação) */}
                            {!editingId && (
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Usuário</label>
                                    <input
                                        type="text"
                                        value={form.username}
                                        onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                                        placeholder="nome de login"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:ring-1 focus:ring-sky-500"
                                    />
                                </div>
                            )}

                            {/* Password */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                                    <KeyRound className="w-3 h-3 inline mr-1" />
                                    {editingId ? 'Nova Senha (deixe em branco para não alterar)' : 'Senha'}
                                </label>
                                <input
                                    type="password"
                                    value={form.password}
                                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                    placeholder={editingId ? '••••••••' : 'senha de acesso'}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:ring-1 focus:ring-sky-500"
                                />
                            </div>

                            {/* Role */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Papel</label>
                                <select
                                    value={form.role}
                                    onChange={e => setForm(f => ({ ...f, role: e.target.value, representante: e.target.value === 'admin' ? '' : f.representante }))}
                                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-sky-500"
                                >
                                    <option value="representante">Representante</option>
                                    <option value="admin">Administrador</option>
                                </select>
                            </div>

                            {/* Representante link */}
                            {form.role === 'representante' && (
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Representante Vinculado</label>
                                    <select
                                        value={form.representante}
                                        onChange={e => setForm(f => ({ ...f, representante: e.target.value }))}
                                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-sky-500"
                                    >
                                        <option value="">— Selecione —</option>
                                        {reps.map(r => (
                                            <option key={r.nome} value={r.nome}>{r.nome}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Error */}
                            {error && (
                                <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
                            )}

                            {/* Actions */}
                            <div className="flex gap-2 pt-1">
                                <button
                                    onClick={() => setShowForm(false)}
                                    className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-medium py-2.5 rounded-xl transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex-1 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
                                >
                                    {saving ? 'Salvando...' : 'Salvar'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
