# Histórico de Decisões — CRM Kalled Pistões

## 2026-04-08 — Migração para pipeline 100% web

### Contexto
O dashboard CRM foi originalmente desenvolvido com um backend Fastify rodando localmente,
que lia um arquivo Excel (`Base de Dados de Vendas.xlsx`) diretamente do disco.
O sync para o Supabase era feito manualmente via `run_sync.js` / `atualizar_supabase.bat`.

### Decisão
Desvinculação completa de arquivos locais. O pipeline passou a ser:

```
Upload de Excel (aba Sincronizar)
        ↓
Vercel Function (api/route.ts)  ←→  Supabase
        ↓
Frontend React (Vercel)
```

### O que mudou

| Componente | Antes | Depois |
|---|---|---|
| API | Fastify local (porta 3000) | Vercel Function `api/route.ts` |
| Fonte de dados | Excel local no disco | Supabase (PostgreSQL) |
| Sync de dados | Script `run_sync.js` + `.bat` | Upload via aba "Sincronizar" |
| Auth | `users.json` local | Tabela `crm_users` no Supabase |
| Deploy | Manual (servidor local) | `git push → Vercel` automático |

### Arquivos removidos do repositório
- `backend/index.ts` — servidor Fastify (arquivado em `obsoleto/backend/`)
- `backend/package.json`, `tsconfig.json`, etc.
- `atualizar_supabase.bat`

### Arquivos adicionados/mantidos
- `api/route.ts` — Vercel Function (744 linhas, todos endpoints)
- `api/_lib/supabase.ts` — cliente Supabase
- `api/_lib/auth.ts` — JWT helpers
- `api/_lib/filters.ts` — utilitários de filtro/paginação
- `supabase/migrations/003_crm_users.sql` — tabela de usuários

### Commits relacionados
- `f78404a` — fix: corrige erro TS2345 em SyncPage (vendasFile pode ser null)
- `f7f98b7` — chore: remove backend local e bat — pipeline 100% via Vercel + Supabase

---

## 2026-04-09 — Reorganização de filtros, badge verde e cards de resultado no catálogo

### Contexto
Após o redesign do catálogo, o usuário solicitou três ajustes: reorganizar os campos de filtro
em seções lógicas, alterar a cor do badge "Novo" de azul para verde, e substituir a tabela de
resultados por cards mais visuais.

### O que mudou
- Filtros agrupados em três seções: **Identificação do Produto**, **Dados do Veículo**, **Tipo**
- Badge de lançamento alterado para verde (`bg-green-500/20 text-green-400 border-green-500/40`)
- Resultados exibidos como grade de cards (`grid-cols-1 sm:grid-cols-2 xl:grid-cols-3`):
  - Cabeçalho vermelho com código PA, código produto e badges
  - Corpo com descrição, montadora, motor, cilindros, ano, diâmetro
  - Rodapé com tags coloridas para referências de concorrentes (sky = Metal Leve/Sulloy, violeta = Kalled)
- Limite de resultados: 200 itens

### Commit
- `fa9837c` — feat: reorganiza filtros, badge verde e cards de resultado no catálogo

---

## 2026-04-09 — Filtro de código de referência de concorrentes

### Contexto
O catálogo contém dois campos de referência de concorrentes (`ref_metal_leve_sulloy` e
`ref_anel_kalled`). A equipe comercial precisava encontrar produtos pelo código parcial
do concorrente para responder consultas de clientes.

### Decisão
Adicionar campo de texto livre "Ref. Concorrente" que busca simultaneamente em ambas as
colunas usando `ilike` com wildcard parcial.

### Implementação
```ts
// api/route.ts
if (filters.ref.trim())
  query = query.or(
    `ref_metal_leve_sulloy.ilike.%${filters.ref.trim()}%,ref_anel_kalled.ilike.%${filters.ref.trim()}%`
  );
```
```ts
// Catalogo.tsx — interface Filters
interface Filters { ref: string; /* ... outros campos */ }
```

### Problema identificado (pendente)
O `.or()` com `ilike` em colunas sem índice causa varredura completa da tabela → timeout
na Vercel Function. Requer migração com índice trigram (ver pendências).

### Commit
- `354e017` — feat: filtro de código de referência de concorrentes no catálogo

---

## 2026-04-09 — Normalização de montadoras para Title Case

### Problema
A mesma montadora aparecia múltiplas vezes no dropdown de filtro por variação de caixa
(ex: `FORD`, `Ford`, `ford`), impedindo seleção única.

### Decisão
Aplicar `toTitleCase()` durante o sync, antes de inserir no Supabase, garantindo que todas
as montadoras sigam o mesmo padrão independente de como estão na planilha.

### Implementação
```ts
// api/route.ts
const toTitleCase = (v: any): string | null => {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.toLowerCase().replace(/(?:^|\s|\/|-)\S/g, c => c.toUpperCase());
};
// aplicado em: montadora: toTitleCase(col(r,'MONTADORA','Montadora','montadora'))
```

### Commit
- `4665e74` — fix: normaliza montadoras para Title Case durante sync do catálogo

---

## 2026-04-09 — Redesign completo do Catálogo (modo claro/escuro, paleta Kalled)

### Contexto
O layout anterior do catálogo era espartano (tabela simples, sem identidade visual).
O público-alvo é compradores e mecânicos com idade entre 40–60 anos, que precisam de
leitura fácil, boa hierarquia visual e interface não sobrecarregada.

### Referência visual
Catálogo da Apex Pistões (modo claro/escuro, cards, filtros laterais).

### Decisão
Reescrever `Catalogo.tsx` do zero com:
- **Modo claro/escuro** com persistência em `localStorage` (`catalogo_theme`)
- **Paleta Kalled**: vermelho `#c1272d` como cor primária
- **Fontes maiores** e espaçamento generoso para legibilidade
- **Sistema de tokens** via objeto `t` com funções `(d: boolean) => string` por tema
- **Filtros** em painel lateral colapsável (mobile) / fixo (desktop)
- **Cards de produto** com estrutura clara: cabeçalho → descrição → dados do veículo → referências

### Commit
- `0b1e50c` — feat: redesign completo do Catálogo — modo claro/escuro, fontes maiores, paleta Kalled

---

## 2026-04-09 — Correção da lógica de lançamentos

### Problema
Todos os produtos apareciam com badge "Novo" mesmo quando a coluna "Lançamento" continha
"em produção". A lógica usava lista de exclusão (blacklist), e qualquer valor não listado
era tratado como `true`.

### Causa
```ts
// ERRADO — qualquer valor fora da lista era "lançamento"
const lancamentos = !['nao','não','n','false','0'].includes(lancRaw.toLowerCase().trim());
```

### Correção
```ts
// CORRETO — apenas valores explícitos da lista são "lançamento"
const lancamentos = lancRaw
  ? ['lançamento','lancamento','sim','yes','s','true','1','novo','new','launch']
      .includes(lancRaw.toLowerCase().trim())
  : false;
```

### Commit
- `0a365a6` — fix: corrige lógica de lançamentos — usa lista de valores positivos

---

## 2026-04-09 — Correção da ingestão do Catálogo (auto-detecção de cabeçalho)

### Problema
A ingestão do `Catalogo_Kalled.xlsx` retornava 0 registros. A API assumia `range: 1`
(linha 0 = título, linha 1 = cabeçalho), mas a planilha real tinha o cabeçalho na linha 0.
Com isso, todos os nomes de coluna ficavam errados e o campo `cod` ficava vazio, fazendo
com que todos os registros fossem filtrados.

### Decisão
Implementar auto-detecção da linha de cabeçalho tentando ranges 0, 1 e 2, verificando
se alguma das colunas lidas contém uma chave com `cod` (case-insensitive). Além disso,
criar função `col()` de busca normalizada de colunas (sem acento, sem maiúsculas) para
tolerar variações na planilha.

### Implementação
```ts
// api/route.ts
const normKey = (k: string) => k.toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').trim();

const col = (row: any, ...names: string[]) => {
  const keys = Object.keys(row);
  for (const name of names) {
    const found = keys.find(k => normKey(k) === normKey(name));
    if (found !== undefined && row[found] !== undefined && row[found] !== '') return row[found];
  }
  return undefined;
};

// Auto-detecção: tenta range 0, 1, 2
let range = 0;
for (const r of [0, 1, 2]) {
  const sample = XLSX.utils.sheet_to_json(ws, { range: r, defval: '' });
  if (sample.length && Object.keys(sample[0]).some(k => normKey(k).includes('cod'))) {
    range = r; break;
  }
}
```

### Commit
- `779a949` — fix: corrige ingestão do Catálogo — auto-detecta range de cabeçalho e normaliza nomes de colunas

---

## 2026-04-08 — Correção de build Vercel (SyncPage.tsx)

### Problema
Build falhou com `TS2345: Argument of type 'File | null' is not assignable to parameter of type 'File'`
em `src/components/SyncPage.tsx:123`.

### Causa
A função `handleSync` chamava `toBase64(vendasFile)` sem checar null,
mas `vendasFile` é `File | null` e o guard da linha 120 permite que seja null
(quando apenas `catalogoFile` está preenchido).

### Correção
```ts
// Antes
const vendas = await toBase64(vendasFile);
// Depois
const vendas = vendasFile ? await toBase64(vendasFile) : undefined;
```
