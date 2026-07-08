import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || window.location.origin;

export interface AuthUser {
    id: string;
    username: string;
    role: string;
    representante: string | null;
}

interface AuthContextType {
    user: AuthUser | null;
    token: string | null;
    login: (username: string, password: string) => Promise<void>;
    logout: () => void;
    isAdmin: boolean;
    isRep: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [token, setToken] = useState<string | null>(null);

    useEffect(() => {
        const savedToken = localStorage.getItem('crm_token');
        const savedUser = localStorage.getItem('crm_user');
        if (savedToken && savedUser) {
            try {
                setToken(savedToken);
                setUser(JSON.parse(savedUser));
            } catch {
                localStorage.removeItem('crm_token');
                localStorage.removeItem('crm_user');
            }
        }
    }, []);

    async function login(username: string, password: string) {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Erro ao conectar' }));
            throw new Error(err.error || 'Usuário ou senha incorretos');
        }
        const data = await res.json();
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('crm_token', data.token);
        localStorage.setItem('crm_user', JSON.stringify(data.user));
    }

    function logout() {
        setToken(null);
        setUser(null);
        localStorage.removeItem('crm_token');
        localStorage.removeItem('crm_user');
    }

    return (
        <AuthContext.Provider value={{
            user, token,
            login, logout,
            isAdmin: user?.role === 'admin',
            isRep: user?.role === 'representante',
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
