@echo off
setlocal
title Comparador FRX: Pulpas vs Cutting
color 0b

echo =====================================================================
echo           COMPARADOR DE LEYES FRX: PULPAS VS CUTTING
echo               Control de Calidad Geologico (QA/QC)
echo =====================================================================
echo.

cd /d "%~dp0"

:: Buscar Python de forma robusta
set "PYTHON_EXE="
where python >nul 2>nul
if %ERRORLEVEL% equ 0 (
    set "PYTHON_EXE=python"
) else (
    if exist "C:\Users\%USERNAME%\AppData\Local\Programs\Python\Python311\python.exe" (
        set "PYTHON_EXE=C:\Users\%USERNAME%\AppData\Local\Programs\Python\Python311\python.exe"
    ) else (
        where py >nul 2>nul
        if %ERRORLEVEL% equ 0 set "PYTHON_EXE=py"
    )
)

if "%PYTHON_EXE%"=="" (
    color 0c
    echo [ERROR] No se encontro Python instalado.
    echo Por favor contacta a soporte o reinstala Python.
    pause
    exit /b 1
)

echo [OK] Python detectado: %PYTHON_EXE%
echo [OK] Abriendo navegador web en http://localhost:8501 ...
echo.
echo Presiona Ctrl+C en esta ventana para cerrar el programa.
echo =====================================================================
echo.

:: Abrir navegador automaticamente despues de 2 segundos para dar tiempo al servidor de iniciar
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:8501"

:: Ejecutar aplicacion
"%PYTHON_EXE%" -m streamlit run app.py --server.port 8501 --server.headless false

if %ERRORLEVEL% neq 0 (
    echo.
    echo [AVISO] El programa se cerro con codigo de error %ERRORLEVEL%.
    pause
)
