@echo off
setlocal enabledelayedexpansion
title CRM Vendas Dashboard
color 0A

echo.
echo  ============================================
echo   CRM Vendas Dashboard - Iniciando...
echo  ============================================
echo.

:: Verifica Node.js
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Node.js nao encontrado! Por favor, instale o Node.js.
    pause
    exit /b 1
)

:: Mata processos antigos para liberar portas
echo [0/2] Limpando processos antigos...
taskkill /F /IM node.exe /T >nul 2>&1

:: Verifica node_modules no frontend
if not exist "%~dp0frontend\node_modules" (
    echo [AVISO] Pasta node_modules nao encontrada no frontend.
    echo Instalando dependencias...
    cd /d "%~dp0frontend" && npm install
)

:: Inicia o backend
echo [1/2] Iniciando Backend (porta 3000)...
start "CRM Backend" cmd /k "cd /d "%~dp0backend" && npm start"

:: Aguarda o backend iniciar
timeout /t 5 /nobreak > nul

:: Inicia o frontend
echo [2/2] Iniciando Frontend (porta 5173)...
start "CRM Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev -- --port 5173 --clearScreen false"

:: Aguarda e abre o navegador
echo.
echo  Aguardando compilacao do Frontend...
timeout /t 10 /nobreak > nul

echo.
echo  Abrindo navegador em http://localhost:5173
start "" "http://localhost:5173"

echo.
echo  Dashboard iniciado! 
echo  Se a tela ficar branca, aguarde 15 segundos e atualize (F5).
echo.
pause
