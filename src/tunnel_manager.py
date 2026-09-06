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
LOG_FILE = TOOLS_DIR / "tunnel.log"
ACCESS_CONTROL_FILE = TOOLS_DIR / "access_control.json"

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

        local_ip = get_local_ip()
        return {
            "is_active": state.get("status") == "RUNNING",
            "status": state.get("status", "STOPPED"),
            "url": state.get("url"),
            "local_url": f"http://{local_ip}:8501",
            "pid": state.get("pid"),
            "duration_seconds": state.get("duration_seconds", 0),
            "remaining_seconds": remaining,
            "expires_at": expires_at,
            "local_ip": local_ip,
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
        "--logfile", str(LOG_FILE),
        "tunnel",
        "--edge-ip-version", "4",
        "--url", f"http://127.0.0.1:{port}",
        "--no-autoupdate"
    ]

    try:
        TOOLS_DIR.mkdir(parents=True, exist_ok=True)
        # Truncar/crear archivo de log limpio para esta sesión
        with open(LOG_FILE, "w", encoding="utf-8") as f:
            pass

        # DETACHED_PROCESS (0x8) + CREATE_NEW_PROCESS_GROUP (0x200) + CREATE_NO_WINDOW (0x8000000)
        # Asegura que cloudflared no dependa de descriptores de tubería de Python y sobreviva en segundo plano
        creationflags = (0x08000000 | 0x00000008 | 0x00000200) if os.name == 'nt' else 0
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=creationflags
        )
        _ACTIVE_PROC = proc

        # Cloudflare Tunnel escribe la URL pública en el archivo de log
        tunnel_url = None
        start_wait = time.time()
        url_regex = re.compile(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com")

        # Leer log progresivamente con timeout de 30 segundos
        with open(LOG_FILE, "r", encoding="utf-8", errors="ignore") as log_read:
            while time.time() - start_wait < 30:
                if proc.poll() is not None:
                    time.sleep(0.5)
                    err_out = log_read.read()
                    return False, f"El proceso cloudflared falló al iniciar: {err_out[:300]}", None

                line = log_read.readline()
                if line:
                    match = url_regex.search(line)
                    if match:
                        tunnel_url = match.group(0)
                        break
                else:
                    time.sleep(0.2)

        if not tunnel_url:
            _kill_pid_tree(proc.pid)
            return False, "Tiempo de espera agotado sin recibir la URL pública de Cloudflare.", None

        # Breve pausa para propagación inicial en borde Cloudflare
        time.sleep(1.5)

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


def is_local_session() -> bool:
    """
    Determina con alta fiabilidad si la petición actual proviene directamente
    del computador donde se ejecuta el servidor (localhost / 127.0.0.1),
    o si es un usuario externo conectado a través de internet/túnel/red remota.
    """
    try:
        import streamlit as st
        if not hasattr(st, "context"):
            return True

        # 1. URL reportada por el navegador del cliente a Streamlit
        client_url = str(getattr(st.context, "url", "") or "").lower()
        if "trycloudflare.com" in client_url:
            return False

        # 2. Encabezados HTTP de la conexión
        headers = getattr(st.context, "headers", None)
        if headers:
            host = str(headers.get("host", "")).lower()
            if "trycloudflare.com" in host:
                return False
            if "cf-ray" in headers or "cf-connecting-ip" in headers:
                return False

            # Si el host es explícitamente localhost o 127.0.0.1
            if host.startswith("localhost") or host.startswith("127.0.0.1") or host.startswith("[::1]"):
                ip = getattr(st.context, "ip_address", None)
                if ip is None or ip in ["127.0.0.1", "::1"]:
                    return True

        # 3. Dirección IP remota detectada en WebSocket
        ip = getattr(st.context, "ip_address", None)
        if ip is not None and ip not in ["127.0.0.1", "::1"]:
            return False

        return True
    except Exception:
        return True


def get_access_control() -> Dict[str, Any]:
    """
    Retorna el estado de control de acceso para invitados remotos.
    """
    if not ACCESS_CONTROL_FILE.is_file():
        return {
            "guest_access_enabled": True,
            "require_pin": False,
            "guest_pin": "1234"
        }
    try:
        with open(ACCESS_CONTROL_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return {
                "guest_access_enabled": data.get("guest_access_enabled", True),
                "require_pin": data.get("require_pin", False),
                "guest_pin": str(data.get("guest_pin", "1234"))
            }
    except Exception:
        return {
            "guest_access_enabled": True,
            "require_pin": False,
            "guest_pin": "1234"
        }


def set_access_control(guest_access_enabled: bool, require_pin: bool = False, guest_pin: str = "1234") -> Dict[str, Any]:
    """
    Actualiza la configuración del interruptor maestro de acceso remoto y PIN de invitados.
    """
    state = {
        "guest_access_enabled": bool(guest_access_enabled),
        "require_pin": bool(require_pin),
        "guest_pin": str(guest_pin).strip() or "1234"
    }
    try:
        TOOLS_DIR.mkdir(parents=True, exist_ok=True)
        with open(ACCESS_CONTROL_FILE, "w", encoding="utf-8") as f:
            json.dump(state, f, indent=2)
    except Exception:
        pass
    return state


def emergency_lockdown() -> Tuple[bool, str]:
    """
    Bloqueo de emergencia total:
    1. Apaga y destruye el túnel de Cloudflare.
    2. Pone el cerrojo maestro en falso (bloquea cualquier sesión remota que siga viva).
    """
    set_access_control(guest_access_enabled=False)
    stop_tunnel()
    return True, "Bloqueo de emergencia activado: el túnel fue apagado y todo acceso remoto fue revocado."
