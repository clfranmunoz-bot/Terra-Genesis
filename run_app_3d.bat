@echo off
title Ct-Pp 3D - Comparador Geoquimico & Visor Espacial
echo =======================================================
echo   Iniciando Ct-Pp 3D en http://localhost:8502
echo =======================================================
python -m streamlit run app.py --server.port 8502 --server.headless false
pause
