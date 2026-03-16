# Dashboard CRM — Kalled Pistões

Dashboard interno de CRM e análise de vendas da **Kalled Pistões**, construído com React + FastAPI, lendo dados diretamente de uma base Excel.

---

## Visão Geral

O sistema centraliza os dados comerciais da empresa em um painel interativo com visual premium (estilo Power BI), permitindo acompanhar em tempo real:

- **Faturamento** por período, com comparativo vs. ano anterior
- **Atingimento de metas** mensais e anuais
- **Ranking de vendedores** com desempenho individual
- **Carteira de clientes** — status, histórico de compras e itens não comprados
- **Visitas técnicas** com custo e cobertura por representante
- **Top SKUs** por quantidade vendida
- **Ticket médio** e total de peças

---

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS v4, Recharts |
| Backend | Python, FastAPI, openpyxl |
| Dados | Excel (.xlsx) — leitura direta via backend |

---

## Estrutura do Projeto

```
00 - Dashboard - CRM/
├── frontend/               # Aplicação React
│   ├── src/
│   │   ├── pages/          # Dashboard, Clientes, Vendas, Visitas, Representantes
│   │   ├── components/     # KPICard, Layout, RankingTable, TopClientes
│   │   └── lib/api.ts      # Integração com o backend
│   └── package.json
├── backend/                # API FastAPI
│   └── main.py             # Endpoints de dados
├── Base de Dados de Vendas.xlsx   # ← NÃO versionado (.gitignore)
├── Run_CRM.bat             # Script para iniciar frontend + backend
└── README.md
```

---

## Como Rodar

### Requisitos
- Node.js 18+
- Python 3.10+

### Iniciar o sistema
```bash
# Opção 1 — script automático (Windows)
Run_CRM.bat

# Opção 2 — manual
# Terminal 1: Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

# Terminal 2: Frontend
cd frontend
npm install
npm run dev
```

Acesse: **http://localhost:5173**

---

## Atualizar a Base de Dados

Quando receber uma nova base de dados Excel:

1. Substitua o arquivo `Base de Dados de Vendas.xlsx` na raiz do projeto
2. Reinicie o backend (ou o `Run_CRM.bat`)
3. O dashboard atualiza automaticamente ao recarregar o browser

Para versionar as mudanças no código (não nos dados):

```bash
git add .
git commit -m "descrição das alterações"
git push
```

---

## Funcionalidades

### Dashboard
- KPIs: Faturamento, Atingimento de Meta, Ticket Médio, Total de Peças
- Gráfico de evolução mensal com linha de meta
- Evolução anual comparativa
- Top 5 SKUs (gráfico de rosca + barras de progresso)
- Top Clientes e Ranking de Vendedores

### Clientes
- Listagem com filtro por representante e status (ativo/inativo)
- Detalhe do cliente: informações comerciais, condições de faturamento
- Histórico de compras por mês (gráfico)
- Itens do catálogo não comprados pelo cliente (por linha de produto)

### Vendas
- Tabela completa de pedidos com filtro por data, cliente e grupo
- Totalizador em tempo real

### Visitas Técnicas
- Registro de visitas por representante e tipo
- Custo total por período

### Representantes
- Performance individual com gráficos comparativos
- Evolução histórica por representante

---

## Responsividade

O dashboard é responsivo e funciona em:
- Desktop (layout completo com sidebar)
- Tablet (grids adaptativos)
- Mobile (colunas únicas, scroll horizontal em tabelas)
