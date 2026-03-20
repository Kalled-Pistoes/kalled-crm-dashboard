@echo off
title CRM - Sync Excel para Supabase
color 0B

echo.
echo  ============================================
echo   CRM Kalled Pistoes - Sync Supabase
echo  ============================================
echo.

:: Verifica se o .env existe
if not exist "%~dp0backend\.env" (
    echo [ERRO] Arquivo backend\.env nao encontrado!
    echo.
    echo  Crie o arquivo backend\.env com base em backend\.env.example:
    echo    SUPABASE_URL=https://xxxx.supabase.co
    echo    SUPABASE_SERVICE_ROLE_KEY=eyJ...
    echo.
    pause
    exit /b 1
)

echo  Sincronizando Excel com o Supabase...
echo  Isso pode levar alguns minutos dependendo do tamanho da base.
echo.

cd /d "%~dp0backend"
node --loader ts-node/esm scripts/sync_supabase.ts

if %errorlevel% neq 0 (
    echo.
    echo [ERRO] Sync falhou. Verifique as mensagens acima.
    pause
    exit /b 1
)

echo.
echo  Sync concluido! Os dados do Supabase estao atualizados.
echo.
pause
