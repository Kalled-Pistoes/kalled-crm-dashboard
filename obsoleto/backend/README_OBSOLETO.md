# ⚠️ OBSOLETO — Backend Local (Fastify)

Este diretório contém o servidor Fastify que era usado durante o desenvolvimento local.

## Por que foi descontinuado

O pipeline foi migrado para **100% web**:

| Antes | Depois |
|---|---|
| Backend Fastify rodando na máquina local | Vercel Functions (`api/route.ts`) |
| Leitura de `Base de Dados de Vendas.xlsx` do disco | Leitura direto do Supabase |
| Sync via `run_sync.js` / `atualizar_supabase.bat` | Upload via aba "Sincronizar" no dashboard |

## O que era este servidor

- **Porta**: 3000
- **Função**: Ler o Excel local e expor endpoints `/api/*` para o frontend
- **Auth**: JWT + bcrypt com `data/users.json`
- **Dependências**: fastify, xlsx, jsonwebtoken, bcryptjs, @supabase/supabase-js

## Referência

Removido do pipeline principal no commit `f7f98b7` em 2026-04-08.
