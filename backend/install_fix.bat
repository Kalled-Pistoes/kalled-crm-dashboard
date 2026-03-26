@echo off
echo ==========================================
echo    CRM Backend Setup - Auto Fix Script
echo ==========================================
echo.
echo [1/2] Installing dependencies...
:: Usando --no-bin-links como fallback para drives de rede se o normal falhar
call npm install
if %errorlevel% neq 0 (
    echo Tentando com --no-bin-links...
    call npm install --no-bin-links
)

if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b %errorlevel%
)

echo.
echo [2/2] Checking Excel file...
if not exist "..\Base de Dados de Vendas.xlsx" (
    echo [AVISO] Arquivo "Base de Dados de Vendas.xlsx" nao encontrado na pasta raiz!
    echo O backend pode falhar ao iniciar sem este arquivo.
) else (
    echo [OK] Arquivo Excel encontrado.
)

echo.
echo ==========================================
echo    SETUP COMPLETE SUCCESSFULLY!
echo ==========================================
echo.
echo  Pode rodar o "Run_CRM.bat" na pasta principal agora.
echo.
pause
