import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Catalogo from './components/Catalogo';
import LoginPage from './components/LoginPage';
import SyncPage from './components/SyncPage';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Clientes = lazy(() => import('./pages/Clientes'));
const Vendas = lazy(() => import('./pages/Vendas'));
const Representantes = lazy(() => import('./components/Representantes'));
const Visitas = lazy(() => import('./pages/Visitas'));
const GerenciarUsuarios = lazy(() => import('./pages/GerenciarUsuarios'));

const fallback = <div className="flex items-center justify-center h-full text-slate-400 text-sm">Carregando...</div>;

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Página pública — catálogo de produtos */}
          <Route index element={<Catalogo />} />
          <Route path="/login" element={<LoginPage />} />
          {/* Área restrita */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<Suspense fallback={fallback}><Dashboard /></Suspense>} />
              <Route path="/vendas" element={<Suspense fallback={fallback}><Vendas /></Suspense>} />
              <Route path="/clientes" element={<Suspense fallback={fallback}><Clientes /></Suspense>} />
              <Route path="/representantes" element={<Suspense fallback={fallback}><Representantes /></Suspense>} />
              <Route path="/visitas" element={<Suspense fallback={fallback}><Visitas /></Suspense>} />
              <Route path="/usuarios" element={<Suspense fallback={fallback}><GerenciarUsuarios /></Suspense>} />
              <Route path="/sync" element={<SyncPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
