import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Clientes = lazy(() => import('./pages/Clientes'));
const Vendas = lazy(() => import('./pages/Vendas'));
const Representantes = lazy(() => import('./pages/Representantes'));
const Visitas = lazy(() => import('./pages/Visitas'));

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Suspense fallback={<div className="flex items-center justify-center h-full text-slate-400 text-sm">Carregando...</div>}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/vendas" element={<Vendas />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/representantes" element={<Representantes />} />
            <Route path="/visitas" element={<Visitas />} />
          </Routes>
        </Suspense>
      </Layout>
    </BrowserRouter>
  );
}
