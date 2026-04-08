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
