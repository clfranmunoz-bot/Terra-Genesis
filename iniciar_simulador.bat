@echo off
title Terra Genesis - Servidor Local
echo ============================================================
echo        TERRA GENESIS - INICIADOR DEL SIMULADOR
echo ============================================================
echo.
echo Iniciando servidor en http://localhost:8080 ...
echo Abriendo en tu navegador...
echo.
python server.py
if %errorlevel% neq 0 (
    echo.
    echo Reintentando con ruta directa de Python...
    "C:\Users\%USERNAME%\AppData\Local\Programs\Python\Python311\python.exe" server.py
)
pause
