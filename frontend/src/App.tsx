import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Clientes from './pages/Clientes';
import Vendas from './pages/Vendas';
import Representantes from './pages/Representantes';
import Visitas from './pages/Visitas';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/vendas" element={<Vendas />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/representantes" element={<Representantes />} />
          <Route path="/visitas" element={<Visitas />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
