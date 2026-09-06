"""
src/tunnel_manager.py
---------------------
Gestor de túnel seguro (Cloudflare Tunnel) para compartir temporalmente
la aplicación Streamlit de forma remota.

Características:
- Genera URL pública HTTPS temporal (https://*.trycloudflare.com)
- Control de tiempo con apagado automático programado (Timer)
- Botón de parada de emergencia inmediata
- Persistencia de estado en tools/tunnel_state.json
- Detección de IP local para redes LAN / Wi-Fi
- Compatible 100% con Windows
"""

import json
import os
import re
import socket
import subprocess
import threading
import time
from pathlib import Path
from typing import Optional, Tuple, Dict, Any

ROOT_DIR = Path(__file__).resolve().parent.parent
TOOLS_DIR = ROOT_DIR / "tools"
CLOUDFLARED_BIN = TOOLS_DIR / "cloudflared.exe"
STATE_FILE = TOOLS_DIR / "tunnel_state.json"

# Lock para sincronizar acceso al estado
_STATE_LOCK = threading.Lock()
_ACTIVE_PROC: Optional[subprocess.Popen] = None
_TIMER_THREAD: Optional[threading.Thread] = None


def get_local_ip() -> str:
    """Obtiene la IP local en la red Wi-Fi/LAN del equipo."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.5)
        # No envía paquetes reales, solo resuelve la ruta de interfaz predeterminada
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        try:
            return socket.gethostbyname(socket.gethostname())
        except Exception:
            return "127.0.0.1"


def get_cloudflared_path() -> Optional[str]:
    """Retorna la ruta absoluta al ejecutable cloudflared.exe si existe."""
    if CLOUDFLARED_BIN.is_file():
        return str(CLOUDFLARED_BIN)
    # Verificar en PATH
    import shutil
    sys_path = shutil.which("cloudflared")
    if sys_path:
        return sys_path
    return None


def _is_pid_alive(pid: int) -> bool:
    """Verifica si un proceso sigue activo en Windows por PID."""
    if not pid or pid <= 0:
        return False
    try:
        import ctypes
        PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
        handle = ctypes.windll.kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
        if handle:
            ctypes.windll.kernel32.CloseHandle(handle)
            return True
        return False
    except Exception:
        try:
            res = subprocess.run(
                f'tasklist /FI "PID eq {pid}" /NH',
                capture_output=True,
                text=True,
                shell=True,
                timeout=2
            )
            return str(pid) in res.stdout
        except Exception:
            return False


def _kill_pid_tree(pid: int):
    """Mata el proceso y sus hijos usando taskkill en Windows."""
    if not pid or pid <= 0:
        return
    try:
        subprocess.run(
            f"taskkill /F /PID {pid} /T",
            shell=True,
            capture_output=True,
            timeout=5
        )
    except Exception:
        pass


def _read_state() -> Dict[str, Any]:
    """Lee el estado persistido del túnel."""
    if not STATE_FILE.is_file():
        return {
            "status": "STOPPED",
            "url": None,
            "pid": None,
            "started_at": None,
            "duration_seconds": 0,
            "expires_at": None,
            "error": None
        }
    try:
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {
            "status": "STOPPED",
            "url": None,
            "pid": None,
            "started_at": None,
            "duration_seconds": 0,
            "expires_at": None,
            "error": None
        }


def _write_state(state: Dict[str, Any]):
    """Escribe el estado del túnel asegurando el directorio."""
    try:
        TOOLS_DIR.mkdir(parents=True, exist_ok=True)
        with open(STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(state, f, indent=2)
    except Exception:
        pass


def get_tunnel_status() -> Dict[str, Any]:
    """
    Retorna el estado actual del túnel remoto, sincronizando con el proceso del sistema.
    """
    with _STATE_LOCK:
        state = _read_state()
        pid = state.get("pid")
        status = state.get("status", "STOPPED")
        expires_at = state.get("expires_at")
        now = time.time()

        # Si estaba registrado como RUNNING, verificar si el proceso sigue vivo
        if status == "RUNNING":
            if not pid or not _is_pid_alive(pid):
                state["status"] = "STOPPED"
                state["url"] = None
                _write_state(state)
            elif expires_at and now >= expires_at:
                # El tiempo asignado venció: apagar inmediatamente
                _kill_pid_tree(pid)
                state["status"] = "EXPIRED"
                state["url"] = None
                _write_state(state)

        # Calcular segundos restantes
        remaining = 0
        if state.get("status") == "RUNNING" and expires_at:
            remaining = max(0, int(expires_at - now))

        return {
            "is_active": state.get("status") == "RUNNING",
            "status": state.get("status", "STOPPED"),
            "url": state.get("url"),
            "pid": state.get("pid"),
            "duration_seconds": state.get("duration_seconds", 0),
            "remaining_seconds": remaining,
            "expires_at": expires_at,
            "local_ip": get_local_ip(),
            "error": state.get("error")
        }


def _auto_kill_worker(pid: int, expires_at: float):
    """Hilo trabajador que espera hasta la fecha de expiración y corta el túnel."""
    while time.time() < expires_at:
        time.sleep(1)
        # Si el proceso fue cerrado manualmente, salir
        if not _is_pid_alive(pid):
            return

    # Tiempo cumplido: cerrar túnel
    with _STATE_LOCK:
        _kill_pid_tree(pid)
        state = _read_state()
        if state.get("pid") == pid:
            state["status"] = "EXPIRED"
            state["url"] = None
            _write_state(state)


def start_tunnel(port: int = 8501, duration_minutes: int = 30) -> Tuple[bool, str, Optional[str]]:
    """
    Inicia Cloudflare Tunnel en segundo plano por una duración determinada.
    duration_minutes: 0 o negativo indica duración manual (sin apagado automático).
    
    Retorna: (éxito: bool, mensaje: str, url_publica: Optional[str])
    """
    global _ACTIVE_PROC, _TIMER_THREAD

    cloudflared_path = get_cloudflared_path()
    if not cloudflared_path:
        return False, "Ejecutable cloudflared.exe no encontrado en tools/ ni en PATH.", None

    # Verificar si ya hay un túnel activo
    current_status = get_tunnel_status()
    if current_status["is_active"]:
        return True, "El túnel ya se encuentra activo.", current_status["url"]

    # Detener cualquier proceso residual previo
    if current_status.get("pid"):
        _kill_pid_tree(current_status["pid"])

    cmd = [
        cloudflared_path,
        "tunnel",
        "--url", f"http://localhost:{port}",
        "--no-autoupdate"
    ]

    try:
        # En Windows, CREATE_NO_WINDOW evita ventanas negras emergentes
        creationflags = 0x08000000 if os.name == 'nt' else 0
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            creationflags=creationflags
        )
        _ACTIVE_PROC = proc

        # Cloudflare Tunnel emite la URL en stderr
        tunnel_url = None
        start_wait = time.time()
        url_regex = re.compile(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com")

        # Leer stderr con timeout de 25 segundos
        while time.time() - start_wait < 25:
            if proc.poll() is not None:
                # El proceso terminó prematuramente
                _, err_out = proc.communicate(timeout=2)
                return False, f"El proceso cloudflared falló al iniciar: {err_out[:300]}", None

            line = proc.stderr.readline()
            if line:
                match = url_regex.search(line)
                if match:
                    tunnel_url = match.group(0)
                    break
            else:
                time.sleep(0.1)

        if not tunnel_url:
            _kill_pid_tree(proc.pid)
            return False, "Tiempo de espera agotado sin recibir la URL pública de Cloudflare.", None

        # Configurar expiración
        now = time.time()
        duration_sec = int(duration_minutes * 60) if duration_minutes > 0 else 0
        expires_at = (now + duration_sec) if duration_sec > 0 else None

        new_state = {
            "status": "RUNNING",
            "url": tunnel_url,
            "pid": proc.pid,
            "started_at": now,
            "duration_seconds": duration_sec,
            "expires_at": expires_at,
            "error": None
        }

        with _STATE_LOCK:
            _write_state(new_state)

        # Iniciar hilo de auto-desconexión si tiene temporizador
        if expires_at:
            _TIMER_THREAD = threading.Thread(
                target=_auto_kill_worker,
                args=(proc.pid, expires_at),
                daemon=True
            )
            _TIMER_THREAD.start()

        return True, "Enlace remoto generado exitosamente.", tunnel_url

    except Exception as e:
        return False, f"Error al ejecutar cloudflared: {e}", None


def stop_tunnel() -> Tuple[bool, str]:
    """Detiene inmediatamente el túnel remoto y corta la conexión."""
    global _ACTIVE_PROC
    with _STATE_LOCK:
        state = _read_state()
        pid = state.get("pid")
        if pid:
            _kill_pid_tree(pid)

        if _ACTIVE_PROC and _ACTIVE_PROC.poll() is None:
            try:
                _ACTIVE_PROC.terminate()
            except Exception:
                pass
        _ACTIVE_PROC = None

        state["status"] = "STOPPED"
        state["url"] = None
        state["pid"] = None
        state["expires_at"] = None
        _write_state(state)

    return True, "Acceso remoto desconectado exitosamente. La aplicación ya no es accesible por el enlace público."
