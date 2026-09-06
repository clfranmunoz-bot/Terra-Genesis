@echo off
chcp 65001 >nul
title Terra-Genesis QA/QC - Compartir Acceso Remoto Temporal
cls
echo ====================================================================
echo         TERRA-GENESIS QA/QC - COMPARTIR APLICACIÓN TEMPORAL
echo ====================================================================
echo.
echo Este lanzador genera un enlace público temporal y seguro (HTTPS)
echo para que supervisores o colegas remotos accedan al programa que está
echo corriendo en este computador, durante el tiempo exacto que tú decidas.
echo.
echo --------------------------------------------------------------------
set /p DURATION="Ingresa los MINUTOS de acceso (ej. 15, 30, 60, 120 o 0 para manual): "
echo --------------------------------------------------------------------
echo.
echo Conectando túnel seguro de Cloudflare...
echo.

python -c "import src.tunnel_manager as tm, time; ok, msg, url = tm.start_tunnel(8501, float('%DURATION%')); print('RESULTADO:', msg); print('\n>>> ENLACE PÚBLICO TEMPORAL:\n' + str(url) + '\n') if ok else None; print('IP Local (LAN): http://' + tm.get_local_ip() + ':8501\n')"

echo ====================================================================
echo  El enlace permanecerá activo durante el tiempo configurado.
echo  Para cancelarlo en cualquier momento, puedes usar el botón en la app
echo  o presionar una tecla en esta ventana para cerrarlo.
echo ====================================================================
echo.
set /p OP="Presiona ENTER para detener el enlace remoto ahora, o escribe 'M' para mantenerlo en segundo plano: "
if /i "%OP%"=="M" (
    echo Manteniendo acceso en segundo plano según el temporizador.
) else (
    echo Desconectando enlace remoto...
    python -c "import src.tunnel_manager as tm; ok, msg = tm.stop_tunnel(); print(msg)"
)
echo.
pause
