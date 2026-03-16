@echo off
setlocal enabledelayedexpansion
title CRM Vendas Dashboard
color 0A

echo.
echo  ============================================
echo   CRM Kalled Pistoes - Iniciando...
echo  ============================================
echo.

:: Verifica Node.js
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Node.js nao encontrado! Por favor, instale o Node.js.
    pause
    exit /b 1
)

:: Mata processos antigos para liberar a porta 3000
echo [0/3] Limpando processos antigos...
taskkill /F /IM node.exe /T >nul 2>&1

:: Instala dependencias do backend se necessario
if not exist "%~dp0backend\node_modules" (
    echo [AVISO] Instalando dependencias do backend...
    cd /d "%~dp0backend" && npm install
)

:: Instala dependencias do frontend se necessario
if not exist "%~dp0frontend\node_modules" (
    echo [AVISO] Instalando dependencias do frontend...
    cd /d "%~dp0frontend" && npm install
)

:: Build do frontend (gera os arquivos estaticos em frontend/dist)
echo [1/3] Compilando Frontend...
cd /d "%~dp0frontend"
call npm run build
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao compilar o frontend!
    pause
    exit /b 1
)

:: Descobre o IP local da maquina
for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr /i "IPv4"') do (
    set LOCAL_IP=%%A
    goto :found_ip
)
:found_ip
set LOCAL_IP=%LOCAL_IP: =%

:: Inicia apenas o backend (que agora serve o frontend tambem)
echo [2/3] Iniciando servidor (porta 3000)...
start "CRM Backend" cmd /k "cd /d "%~dp0backend" && npm start"

:: Aguarda o backend subir
timeout /t 6 /nobreak > nul

:: Abre o navegador
echo [3/3] Abrindo navegador...
start "" "http://localhost:3000"

echo.
echo  ============================================
echo   Dashboard disponivel em:
echo.
echo   Local:  http://localhost:3000
echo   Rede:   http://%LOCAL_IP%:3000
echo  ============================================
echo.
echo   Compartilhe o link da REDE com qualquer
echo   pessoa conectada ao mesmo Wi-Fi/servidor.
echo.
pause
