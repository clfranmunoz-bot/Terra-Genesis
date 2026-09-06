"""
Aplicación Principal Streamlit: Comparador y QA/QC de FRX (Pulpas vs. Cutting).
Soporta comparación simultánea de múltiples elementos para el mismo pozo (Multi-Track, Multi-Scatter y Correlación Cruzada).
"""
import streamlit as st
import pandas as pd
import numpy as np
import io
import sys
import importlib

# Asegurar recarga reactiva de módulos locales en caliente
for mod_name in ['src.config', 'src.data_loader', 'src.qaqc_engine', 'src.visualizer', 'src.tunnel_manager']:
    if mod_name in sys.modules:
        importlib.reload(sys.modules[mod_name])

from src.tunnel_manager import (
    start_tunnel,
    stop_tunnel,
    get_tunnel_status,
    get_local_ip,
    is_local_session,
    get_access_control,
    set_access_control,
    emergency_lockdown,
    is_server_locked,
    verify_remote_shutdown_pin,
    verify_pc_unlock_pin,
    unlock_server,
    trigger_emergency_shutdown
)
from src.config import (
    DEFAULT_PULP_PATHS,
    DEFAULT_CUTTING_PATHS,
    DEFAULT_PULP_PATH,
    DEFAULT_CUTTING_PATH,
    PRIORITY_ELEMENTS,
    ELEMENT_CATALOG,
    ADMIN_PIN
)
from src.data_loader import (
    scan_directories,
    load_dataset_for_hole,
    load_all_holes_consolidated
)
from src.qaqc_engine import (
    calculate_element_stats,
    multi_element_summary_table
)
from src.visualizer import (
    plot_downhole_profile,
    plot_multi_track_downhole,
    plot_two_elements_overlay,
    plot_scatter_1to1,
    plot_multi_scatter_grid,
    plot_cross_element_correlation,
    plot_bland_altman,
    plot_hard_cumulative,
    plot_multielement_overview,
    render_sticky_ruler_html,
    render_sticky_multitrack_html,
    get_element_unit
)

# Configuración de página de Streamlit
st.set_page_config(
    page_title="Comparador FRX: Pulpas vs Cutting",
    page_icon="🔬",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Configuración global de barra de herramientas de Plotly (Siempre visible y accesible)
PLOTLY_CONFIG = {
    'displaylogo': False,
    'displayModeBar': True,
    'modeBarButtonsToRemove': ['lasso2d', 'select2d']
}

# Inicialización y saneamiento de estilos por defecto para garantizar colores vivos (Azul y Naranjo)
DEFAULT_STYLE_SETTINGS = {
    'color_pulp': '#1f77b4',
    'color_cut': '#ff7f0e',
    'color_e2_pulp': '#2ca02c',
    'color_e2_cut': '#d62728',
    'dash_pulp_choice': "── Sólida",
    'dash_cut_choice': "── Sólida",
    'dash_e2_pulp_choice': "── Sólida",
    'dash_e2_cut_choice': "··· Punteada",
    'line_mode_choice': "Línea + Puntos",
    'width_pulp': 2.5,
    'width_cut': 2.0,
    'marker_size': 4,
    'theme_choice_radio': "☀️ Fondo Blanco"
}
for _k, _v in DEFAULT_STYLE_SETTINGS.items():
    if _k not in st.session_state or st.session_state[_k] in [None, '#000000', '', 'None']:
        st.session_state[_k] = _v

# Caching de escaneo de carpetas
@st.cache_data(show_spinner="Escaneando directorios de sondajes...")
def cached_scan(pulp_paths: tuple, cutting_paths: tuple):
    return scan_directories(list(pulp_paths), list(cutting_paths))

# Caching de carga por sondaje
@st.cache_data(show_spinner="Cargando y procesando datos del sondaje...")
def cached_load_hole(holes_info: dict, hole_id: str, lod_mode: str):
    return load_dataset_for_hole(holes_info, hole_id, lod_mode=lod_mode)

# Caching de consolidado
@st.cache_data(show_spinner="Consolidando datos de todos los sondajes (+26.000 tramos)...")
def cached_load_all(holes_info: dict, lod_mode: str):
    return load_all_holes_consolidated(holes_info, lod_mode=lod_mode)


def main():
    # -------------------------------------------------------------------------
    # 0. VERIFICACIÓN DE BLOQUEO DE EMERGENCIA DEL SERVIDOR
    # -------------------------------------------------------------------------
    if is_server_locked():
        st.markdown("""
        <div style="padding: 3rem 2rem; background: rgba(239, 68, 68, 0.08); border: 2px solid #ef4444; border-radius: 14px; text-align: center; max-width: 620px; margin: 4rem auto; box-shadow: 0 4px 20px rgba(239, 68, 68, 0.15);">
            <div style="font-size: 3.5rem; margin-bottom: 0.8rem;">🛑</div>
            <h2 style="color: #dc2626; margin-top: 0; font-weight: 700;">Servidor Bloqueado por Emergencia Remota</h2>
            <p style="color: var(--text-color, #334155); font-size: 1.05rem; line-height: 1.6;">
                El servidor fue cerrado remotamente mediante el protocolo de seguridad de emergencia.<br>
                Para reactivar la plataforma en este equipo y reanudar las operaciones geológicas,
                ingresa el <b>PIN Maestro de Desbloqueo Físico</b>.
            </p>
        </div>
        """, unsafe_allow_html=True)
        col_u1, col_u2, col_u3 = st.columns([1, 2, 1])
        with col_u2:
            unlock_input = st.text_input("PIN Maestro de Desbloqueo (PC):", type="password", key="pc_unlock_pin_input")
            if st.button("🔓 Reactivar Servidor", type="primary", use_container_width=True):
                if verify_pc_unlock_pin(unlock_input):
                    unlock_server()
                    st.success("¡Servidor reactivado exitosamente!")
                    st.rerun()
                else:
                    st.error("PIN incorrecto. Acceso denegado.")
        st.stop()

    # Inyección de estilos globales para soporte de Modo Oscuro y Plotly ModeBar
    st.markdown("""
    <style>
    /* Soporte de alto contraste para la barra lateral en Modo Oscuro */
    [data-testid="stSidebar"] {
        color: var(--text-color, inherit) !important;
    }
    [data-testid="stSidebar"] label,
    [data-testid="stSidebar"] label p,
    [data-testid="stSidebar"] .stMarkdown,
    [data-testid="stSidebar"] .stMarkdown p,
    [data-testid="stSidebar"] .stMarkdown span,
    [data-testid="stSidebar"] h1,
    [data-testid="stSidebar"] h2,
    [data-testid="stSidebar"] h3,
    [data-testid="stSidebar"] h4 {
        color: var(--text-color, inherit) !important;
    }
    [data-testid="stSidebar"] .stCaption,
    [data-testid="stSidebar"] small {
        color: var(--text-color, #94a3b8) !important;
        opacity: 0.85 !important;
    }
    [data-testid="stSidebar"] .stSelectbox label p,
    [data-testid="stSidebar"] .stNumberInput label p,
    [data-testid="stSidebar"] .stMultiSelect label p,
    [data-testid="stSidebar"] .stColorPicker label p,
    [data-testid="stSidebar"] .stSlider label p,
    [data-testid="stSidebar"] .stRadio label p {
        font-size: 13px !important;
        font-weight: 600 !important;
        white-space: normal !important;
        line-height: 1.3 !important;
        margin-bottom: 3px !important;
    }
    [data-testid="stSidebar"] div[data-baseweb="select"] {
        min-height: 38px !important;
    }
    [data-testid="stSidebar"] div[data-baseweb="input"] {
        min-height: 38px !important;
    }
    [data-testid="stSidebar"] div.stButton > button {
        border-radius: 6px !important;
        font-weight: 600 !important;
    }

    /* Contenedores de métricas y tarjetas en Modo Oscuro (alto contraste) */
    div[data-testid="stMetric"],
    div[data-testid="metric-container"],
    .stMetric {
        background-color: #1e293b !important;
        border: 1px solid #334155 !important;
        border-radius: 8px !important;
        padding: 0.6rem 1rem !important;
    }
    div[data-testid="stMetric"] label,
    div[data-testid="metric-container"] label,
    div[data-testid="stMetric"] label p {
        color: #94a3b8 !important;
    }
    div[data-testid="stMetric"] [data-testid="stMetricValue"],
    div[data-testid="metric-container"] [data-testid="stMetricValue"] {
        color: #ffffff !important;
    }

    /* Barra de herramientas Plotly siempre visible y con iconos adaptables */
    .modebar-container {
        opacity: 0.92 !important;
    }
    .modebar-container:hover {
        opacity: 1 !important;
    }
    .modebar-btn {
        padding: 4px 6px !important;
        margin: 0 2px !important;
    }
    .modebar-btn svg {
        width: 17px !important;
        height: 17px !important;
    }
    /* BOTÓN HOME DE PLOTLY: Integración orgánica, limpia y sutil */
    .modebar-btn[data-title*="Reset"],
    .modebar-btn[data-title*="reset"],
    .modebar-btn[data-title*="Restablecer"],
    .modebar-btn[data-title*="axes"],
    .modebar-btn[data-title*="ejes"],
    .modebar-btn[data-val="reset"] {
        background: transparent !important;
        border: none !important;
        border-radius: 4px !important;
        transition: background-color 0.2s ease, fill 0.2s ease !important;
        padding: 4px 6px !important;
        margin-right: 4px !important;
    }
    .modebar-btn[data-title*="Reset"]:hover,
    .modebar-btn[data-title*="reset"]:hover,
    .modebar-btn[data-title*="Restablecer"]:hover,
    .modebar-btn[data-title*="axes"]:hover,
    .modebar-btn[data-title*="ejes"]:hover,
    .modebar-btn[data-val="reset"]:hover {
        background: rgba(59, 130, 246, 0.18) !important;
    }
    .modebar-btn[data-title*="Reset"] svg path,
    .modebar-btn[data-title*="reset"] svg path,
    .modebar-btn[data-title*="Restablecer"] svg path,
    .modebar-btn[data-title*="axes"] svg path,
    .modebar-btn[data-title*="ejes"] svg path,
    .modebar-btn[data-val="reset"] svg path {
        fill: #3b82f6 !important;
    }

    /* Botón discreto e integrado del microscopio en la portada */
    button[data-testid="baseButton-secondary"]:has(p:contains("🔬")),
    div[data-testid="stButton"] > button:has(p:contains("🔬")) {
        background: transparent !important;
        border: none !important;
        font-size: 2.3rem !important;
        padding: 0 !important;
        line-height: 1 !important;
        box-shadow: none !important;
        cursor: pointer !important;
    }

    /* Contenedores de gráficos Plotly */
    div[data-testid="stPlotlyChart"] {
        border-radius: 8px !important;
        overflow: hidden !important;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12) !important;
        margin-bottom: 1.2rem !important;
    }
    </style>
    """, unsafe_allow_html=True)

    # -------------------------------------------------------------------------
    # DIÁLOGO MODAL: CIERRE DE EMERGENCIA REMOTO (EASTER EGG 5 TOQUES)
    # -------------------------------------------------------------------------
    @st.dialog("🔒 Cierre de Emergencia Remoto")
    def show_shutdown_dialog():
        st.write("Has activado el protocolo de cierre seguro del servidor.")
        st.write("Ingresa el código de autorización para proceder con el apagado inmediato:")
        code_input = st.text_input("Código de Autorización:", type="password", key="dialog_shutdown_pin_input")
        col_sh1, col_sh2 = st.columns(2)
        with col_sh1:
            if st.button("🛑 Apagar Servidor Ahora", type="primary", use_container_width=True):
                if verify_remote_shutdown_pin(code_input):
                    st.error("⚠️ Código validado. Desconectando accesos y apagando servidor...")
                    trigger_emergency_shutdown()
                else:
                    st.error("Código incorrecto.")
        with col_sh2:
            if st.button("Cancelar", use_container_width=True):
                st.session_state['show_shutdown_dialog'] = False
                st.rerun()

    if st.session_state.get('show_shutdown_dialog', False):
        show_shutdown_dialog()

    # Cabecera interactiva con gatillo oculto de 5 toques en el microscopio
    col_icon, col_hdr = st.columns([0.06, 0.94])
    with col_icon:
        st.write("")
        if st.button("🔬", key="btn_microscope_trigger", help="Ct-Pp QA/QC"):
            st.session_state['microscope_clicks'] = st.session_state.get('microscope_clicks', 0) + 1
            if st.session_state['microscope_clicks'] >= 5:
                st.session_state['microscope_clicks'] = 0
                st.session_state['show_shutdown_dialog'] = True
                st.rerun()
    with col_hdr:
        st.title("Comparador de Análisis FRX: Pulpas vs. Cutting")
    st.caption("Control de Calidad Geológico (QA/QC), Calibración y Comparación Multi-Elemento en Sondajes")

    st.info("🔒 **Modo de Lectura Segura**: Tus archivos maestros en OneDrive se abren únicamente en modo de lectura estricta. Ningún dato original es modificado ni sobrescrito.")

    # --- BARRA LATERAL ---
    with st.sidebar:
        st.header("📍 Explorador Geológico")

        # Determinar nivel de privilegios (Servidor Local vs Usuario Remoto)
        is_server_host = is_local_session()
        is_admin = is_server_host or st.session_state.get('admin_authenticated', False)
        
        # Consultar estado de control de acceso persistido
        access_ctrl = get_access_control()
        guest_allowed = access_ctrl.get("guest_access_enabled", True)
        require_guest_pin = access_ctrl.get("require_pin", False)
        guest_pin_val = access_ctrl.get("guest_pin", "1234")

        # =========================================================================
        # 1. VERIFICACIÓN DE ACCESO PARA USUARIOS REMOTOS (KILL-SWITCH & PIN GATE)
        # =========================================================================
        if not is_admin:
            # A) Si el Administrador activó el Cerrojo Maestro (Kill-Switch)
            if not guest_allowed:
                st.markdown("""
                <div style="padding: 3rem 2rem; background: rgba(239, 68, 68, 0.05); border: 2px solid #ef4444; border-radius: 12px; text-align: center; margin: 3rem auto; max-width: 650px;">
                    <div style="font-size: 3.5rem; margin-bottom: 1rem;">🔒</div>
                    <h2 style="color: #b91c1c; margin-top: 0; font-weight: 700;">Acceso Remoto Suspendido</h2>
                    <p style="color: #334155; font-size: 1.05rem; line-height: 1.6;">
                        La visualización remota de esta plataforma ha sido <b>pausada o revocada</b> por el geólogo administrador.
                    </p>
                    <p style="color: #64748b; font-size: 0.9rem; margin-top: 1rem;">
                        Por razones de confidencialidad y control de calidad, los datos geológicos no están disponibles en este momento.
                    </p>
                </div>
                """, unsafe_allow_html=True)
                
                with st.expander("🔐 ¿Eres el Administrador? (PIN Maestro)", expanded=False):
                    pin_admin = st.text_input("PIN Maestro:", type="password", key="lock_screen_admin_pin")
                    if st.button("Desbloquear como Administrador", key="btn_unlock_admin"):
                        if pin_admin == ADMIN_PIN:
                            st.session_state['admin_authenticated'] = True
                            st.rerun()
                        else:
                            st.error("PIN incorrecto.")
                st.stop()

            # B) Si se exige PIN de Invitado y aún no se ha validado
            if require_guest_pin and not st.session_state.get('guest_pin_authenticated', False):
                st.markdown("""
                <div style="padding: 2.5rem 2rem; background: rgba(37, 99, 235, 0.04); border: 1px solid rgba(37, 99, 235, 0.3); border-radius: 12px; text-align: center; margin: 2.5rem auto; max-width: 550px;">
                    <div style="font-size: 3rem; margin-bottom: 0.8rem;">🔐</div>
                    <h2 style="color: #1d4ed8; margin-top: 0; font-weight: 700;">Plataforma QA/QC Ct-Pp</h2>
                    <p style="color: #475569; font-size: 0.95rem;">
                        Esta sesión requiere una <b>Clave de Acceso Temporal</b> autorizada por el administrador.
                    </p>
                </div>
                """, unsafe_allow_html=True)
                
                col_g1, col_g2, col_g3 = st.columns([1, 2, 1])
                with col_g2:
                    entered_gpin = st.text_input("Ingresa la clave de invitado:", type="password", key="guest_pin_input_field")
                    if st.button("🔓 Ingresar a la Plataforma", key="btn_enter_guest", use_container_width=True):
                        if entered_gpin.strip() == guest_pin_val:
                            st.session_state['guest_pin_authenticated'] = True
                            st.rerun()
                        else:
                            st.error("Clave de invitado incorrecta.")
                            
                with st.expander("Soy el Administrador (PIN Maestro)", expanded=False):
                    pin_admin_fallback = st.text_input("PIN Maestro:", type="password", key="admin_pin_fallback")
                    if st.button("Entrar como Administrador", key="btn_admin_fallback"):
                        if pin_admin_fallback == ADMIN_PIN:
                            st.session_state['admin_authenticated'] = True
                            st.rerun()
                        else:
                            st.error("PIN incorrecto.")
                st.stop()

        # =========================================================================
        # SELECCIÓN GEOLÓGICA Y EXPLORACIÓN (ARRIBA DEL SIDEBAR)
        # =========================================================================
        # Escanear carpetas
        try:
            scan_res = cached_scan(tuple(DEFAULT_PULP_PATHS), tuple(DEFAULT_CUTTING_PATHS))
            all_holes_list = scan_res.get('all_holes', scan_res.get('common_holes', []))
            common_holes = scan_res.get('common_holes', [])
            holes_info = scan_res['holes_info']
            campaigns = scan_res.get('campaigns', ['2025', '2026'])
        except Exception as e:
            st.error(f"Error accediendo a las carpetas: {e}")
            st.stop()

        # 1. Filtro por Campaña
        st.subheader("🗓️ Selección de Campaña")
        campaign_opts = ["Todas las Campañas"] + [f"Campaña {c}" for c in campaigns]
        selected_camp_label = st.selectbox(
            "Campaña a explorar:",
            campaign_opts,
            index=0,
            help="Filtra los sondajes para visualizar una campaña de perforación específica o todas combinadas."
        )

        if selected_camp_label == "Todas las Campañas":
            available_holes = all_holes_list
        else:
            camp_val = selected_camp_label.replace("Campaña ", "").strip()
            available_holes = [
                h for h in all_holes_list
                if holes_info.get(h, {}).get('pulp_campaign') == camp_val or holes_info.get(h, {}).get('cutting_campaign') == camp_val
            ]

        # 2. Selección de Sondaje
        st.subheader("📍 Selección de Sondaje")
        hole_options = ["— Selecciona un sondaje para comenzar —"] + available_holes

        def format_hole_item(h):
            if h.startswith("—"):
                return h
            info = holes_info.get(h, {})
            stype = info.get('source_type', 'both')
            camp = info.get('pulp_campaign') or info.get('cutting_campaign') or ''
            if stype == 'both':
                tag = "🟢 [PP + CT]"
            elif stype == 'only_cutting':
                tag = "🟡 [Solo Cutting]"
            else:
                tag = "🔵 [Solo Pulpa]"
            return f"{h} {tag} ({camp})" if camp else f"{h} {tag}"

        hole_choice = st.selectbox(
            "Seleccione Sondaje:",
            hole_options,
            index=0,
            format_func=format_hole_item
        )
        selected_hole = hole_choice if hole_choice != hole_options[0] else None

        n_both = sum(1 for h in available_holes if holes_info.get(h, {}).get('source_type') == 'both')
        n_mono = len(available_holes) - n_both
        st.caption(f"📊 **{len(available_holes)} sondajes disponibles** ({n_both} pareados, {n_mono} monofuente).")

        # 3. Tratamiento de <LOD
        st.subheader("🧪 Límite de Detección (<LOD)")
        lod_choice = st.selectbox(
            "Criterio para valores <LOD:",
            ["Excluir valores <LOD", "Imputar a LOD / 2", "Imputar a LOD / √2"],
            index=0,
            help="Excluir es riguroso para correlaciones. LOD/2 preserva los intervalos completos en los perfiles en profundidad."
        )
        lod_mode = 'exclude' if lod_choice == "Excluir valores <LOD" else ('lod_half' if lod_choice == "Imputar a LOD / 2" else 'lod_sqrt2')

        # Cargar datos del sondaje seleccionado
        has_active_data = False
        df_active = pd.DataFrame()
        active_title = ""
        is_paired_hole = False
        hole_source_type = "both"

        if selected_hole is not None:
            df_active = cached_load_hole(holes_info, selected_hole, lod_mode)
            hole_info = holes_info.get(selected_hole, {})
            hole_source_type = hole_info.get('source_type', 'both')
            is_paired_hole = (hole_source_type == 'both')
            hole_camp = hole_info.get('campaign', '')
            active_title = f"Sondaje {selected_hole} ({hole_camp})"
            has_active_data = True
        else:
            st.info("👈 Selecciona un sondaje en la lista superior para comenzar.")

        if has_active_data and df_active.empty:
            st.warning("No se encontraron registros para el sondaje seleccionado.")
            st.stop()

        selected_elements = ['Cu', 'Mo']
        focus_elem = 'Cu'
        focus_unit = '%'
        cutoff = 0.0

        if has_active_data:
            # 4. Selector de Múltiples Elementos
            st.subheader("📊 Elementos a Comparar")
            p_elems = [c[:-5] for c in df_active.columns if c.endswith('_Pulp') and c[:-5] in ELEMENT_CATALOG]
            c_elems = [c[:-4] for c in df_active.columns if c.endswith('_Cut') and c[:-4] in ELEMENT_CATALOG]
            avail_elements = sorted(list(set(p_elems + c_elems)))
            if not avail_elements:
                avail_elements = ['Cu', 'Mo']

            # Sugerir Cu y Mo por defecto
            default_selected = [el for el in ['Cu', 'Mo'] if el in avail_elements]
            if not default_selected:
                default_selected = avail_elements[:min(2, len(avail_elements))]

            selected_elements = st.multiselect(
                "Selecciona los elementos que deseas analizar a la vez:",
                avail_elements,
                default=default_selected,
                help="Puedes elegir 2 o más elementos (ej. Cu, Mo, Fe, S, As) para ver su comportamiento conjunto a lo largo del sondaje."
            )

            if not selected_elements:
                st.warning("Por favor selecciona al menos un elemento.")
                st.stop()

            # Elemento enfocado para detalles específicos
            focus_elem = st.selectbox(
                "Elemento enfocado (para fórmulas detalladas):",
                selected_elements,
                index=0
            )
            focus_unit = get_element_unit(focus_elem)

            # 5. Filtros de Muestras
            st.subheader("🔍 Filtros")
            
            cutoff = st.number_input(
                f"Ley de corte mínima ({focus_elem} en {focus_unit}):",
                min_value=0.0,
                value=0.0,
                step=0.01 if focus_unit == '%' else 1.0,
                format="%.4f" if focus_unit == '%' else "%.1f",
                help=f"Filtra las muestras y gráficos mostrando únicamente los tramos que cumplen con este umbral de ley económica ({focus_unit})."
            )
            
            if is_paired_hole:
                cutoff_target = st.selectbox(
                    "Criterio de corte:",
                    ["Pulpa o Cut (Cualquiera)", "Solo Pulpa (Laboratorio)", "Solo Cutting (FRX)"],
                    index=0,
                    help="Define si el umbral de ley de corte se exige en Pulpa (Lab), en Cutting (FRX) o en cualquiera de las dos."
                )
            else:
                cutoff_target = "Fuente Disponible"

            if 'From' in df_active.columns and not df_active.empty:
                min_depth = float(df_active['From'].min())
                max_depth = float(df_active['To'].max())
                if min_depth < max_depth:
                    depth_range = st.slider(
                        "Rango de Profundidad (m):",
                        min_value=min_depth,
                        max_value=max_depth,
                        value=(min_depth, max_depth),
                        step=1.0
                    )
                    df_active = df_active[(df_active['From'] >= depth_range[0]) & (df_active['To'] <= depth_range[1])].copy()

            # Aplicar filtro de Ley de Corte si es mayor a 0
            if cutoff > 0.0:
                p_c = f"{focus_elem}_Pulp"
                c_c = f"{focus_elem}_Cut"
                n_before = len(df_active)
                if is_paired_hole:
                    if cutoff_target.startswith("Solo Pulpa"):
                        cond = (df_active[p_c] >= cutoff)
                    elif cutoff_target.startswith("Solo Cutting"):
                        cond = (df_active[c_c] >= cutoff)
                    else: # "Pulpa o Cut (Cualquiera)"
                        cond = (df_active[p_c] >= cutoff) | (df_active[c_c] >= cutoff)
                else:
                    col_use = c_c if c_c in df_active.columns else p_c
                    cond = (df_active[col_use] >= cutoff)

                df_active = df_active[cond].copy()
                n_after = len(df_active)

                if df_active.empty:
                    st.warning(f"⚠️ Ninguna muestra alcanza la ley de corte de **{cutoff:.4f} {focus_unit}** para **{focus_elem}** en el rango seleccionado.")
                    st.stop()
                else:
                    st.caption(f"🎯 **Filtro Cutoff Activo**: Mostrando **{n_after} de {n_before}** muestras ({n_after/n_before*100:.1f}%) con {focus_elem} ≥ {cutoff:.4f} {focus_unit}.")

            # 6. Personalización de Estilos, Colores y Líneas
            st.subheader("🎨 Estilo y Apariencia")
            with st.expander("Ajustar colores, líneas y puntos", expanded=False):
                # Inyección CSS para nivelación uniforme y prevención de saltos de línea asimétricos
                st.markdown("""
                <style>
                [data-testid="stSidebar"] .stSelectbox label p,
                [data-testid="stSidebar"] .stColorPicker label p,
                [data-testid="stSidebar"] .stSlider label p {
                    font-size: 13px !important;
                    font-weight: 600 !important;
                    white-space: nowrap !important;
                    overflow: hidden !important;
                    text-overflow: ellipsis !important;
                    margin-bottom: 2px !important;
                }
                [data-testid="stSidebar"] div[data-baseweb="select"] {
                    min-height: 38px !important;
                }
                </style>
                """, unsafe_allow_html=True)

                dash_options = [
                    "── Sólida",
                    "··· Punteada",
                    "-- Segmentada",
                    "-·- Trazo-Punto",
                    "— Trazos Largos"
                ]

                def reset_custom_styles():
                    st.session_state['theme_choice_radio'] = "☀️ Fondo Blanco"
                    st.session_state['color_pulp'] = '#1f77b4'
                    st.session_state['color_cut'] = '#ff7f0e'
                    st.session_state['color_e2_pulp'] = '#2ca02c'
                    st.session_state['color_e2_cut'] = '#d62728'
                    st.session_state['dash_pulp_choice'] = "── Sólida"
                    st.session_state['dash_cut_choice'] = "── Sólida"
                    st.session_state['dash_e2_pulp_choice'] = "── Sólida"
                    st.session_state['dash_e2_cut_choice'] = "··· Punteada"
                    st.session_state['line_mode_choice'] = "Línea + Puntos"
                    st.session_state['width_pulp'] = 2.5
                    st.session_state['width_cut'] = 2.0
                    st.session_state['marker_size'] = 4

                if 'dash_cut_choice_v3' not in st.session_state:
                    st.session_state['dash_cut_choice'] = "── Sólida"
                    st.session_state['dash_cut_choice_v3'] = True

                if 'theme_choice_radio' not in st.session_state: st.session_state['theme_choice_radio'] = "☀️ Fondo Blanco"
                if 'color_pulp' not in st.session_state: st.session_state['color_pulp'] = '#1f77b4'
                if 'color_cut' not in st.session_state: st.session_state['color_cut'] = '#ff7f0e'
                if 'color_e2_pulp' not in st.session_state: st.session_state['color_e2_pulp'] = '#2ca02c'
                if 'color_e2_cut' not in st.session_state: st.session_state['color_e2_cut'] = '#d62728'
                if st.session_state.get('dash_pulp_choice') not in dash_options: st.session_state['dash_pulp_choice'] = "── Sólida"
                if st.session_state.get('dash_cut_choice') not in dash_options: st.session_state['dash_cut_choice'] = "── Sólida"
                if st.session_state.get('dash_e2_pulp_choice') not in dash_options: st.session_state['dash_e2_pulp_choice'] = "── Sólida"
                if st.session_state.get('dash_e2_cut_choice') not in dash_options: st.session_state['dash_e2_cut_choice'] = "··· Punteada"
                if 'line_mode_choice' not in st.session_state: st.session_state['line_mode_choice'] = "Línea + Puntos"
                if 'width_pulp' not in st.session_state: st.session_state['width_pulp'] = 2.5
                if 'width_cut' not in st.session_state: st.session_state['width_cut'] = 2.0
                if 'marker_size' not in st.session_state: st.session_state['marker_size'] = 4

                # --- SECCIÓN 0: TEMA DE FONDO (BLANCO PURO / OSCURO) ---
                st.markdown("##### 🎨 Tema de Fondo de Gráficos")
                st.radio(
                    "Fondo de los Gráficos:",
                    ["☀️ Fondo Blanco", "🌙 Fondo Oscuro"],
                    index=0,
                    horizontal=True,
                    key="theme_choice_radio",
                    help="El modo '☀️ Fondo Blanco' establece un lienzo 100% blanco puro (#ffffff) sin bordes ni recuadros oscuros."
                )
                st.markdown("---")

                # --- SECCIÓN 1: CURVAS PRINCIPALES ---
                st.markdown("##### 📍 Curvas Principales")
                # Fila 1: Colores principales (exactamente al mismo nivel)
                col_c1, col_c2 = st.columns(2)
                with col_c1:
                    st.color_picker("Pulpa (Lab):", value=st.session_state.get('color_pulp', '#1f77b4'), key="color_pulp")
                with col_c2:
                    st.color_picker("Cutting (FRX):", value=st.session_state.get('color_cut', '#ff7f0e'), key="color_cut")

                # Fila 2: Trazos principales (exactamente al mismo nivel)
                col_t1, col_t2 = st.columns(2)
                with col_t1:
                    st.selectbox("Trazo Pulpa:", dash_options, key="dash_pulp_choice")
                with col_t2:
                    st.selectbox("Trazo Cutting:", dash_options, key="dash_cut_choice")

                # Fila 3: Grosores de línea (exactamente al mismo nivel)
                col_w1, col_w2 = st.columns(2)
                with col_w1:
                    st.slider("Grosor Pulpa:", min_value=1.0, max_value=5.0, step=0.5, key="width_pulp")
                with col_w2:
                    st.slider("Grosor Cutting:", min_value=1.0, max_value=5.0, step=0.5, key="width_cut")

                # --- SECCIÓN 2: CURVAS ELEMENTO 2 (SUPERPOSICIÓN) ---
                st.markdown("---")
                st.markdown("##### 🔀 Elemento 2 (Superposición)")
                # Fila 4: Colores Elem 2 (exactamente al mismo nivel)
                col_c3, col_c4 = st.columns(2)
                with col_c3:
                    st.color_picker("Elem 2 Pulpa:", value=st.session_state.get('color_e2_pulp', '#2ca02c'), key="color_e2_pulp")
                with col_c4:
                    st.color_picker("Elem 2 Cutting:", value=st.session_state.get('color_e2_cut', '#d62728'), key="color_e2_cut")

                # Fila 5: Trazos Elem 2 (exactamente al mismo nivel)
                col_t3, col_t4 = st.columns(2)
                with col_t3:
                    st.selectbox("Trazo E2 Pulpa:", dash_options, key="dash_e2_pulp_choice")
                with col_t4:
                    st.selectbox("Trazo E2 Cutting:", dash_options, key="dash_e2_cut_choice")

                # --- SECCIÓN 3: PUNTOS Y MODO GLOBAL ---
                st.markdown("---")
                st.markdown("##### 🔘 Modo y Marcadores")
                st.selectbox("Modo de trazado:", ["Línea + Puntos", "Solo Línea", "Solo Puntos"], key="line_mode_choice")
                st.slider("Tamaño de Puntos:", min_value=1, max_value=10, step=1, key="marker_size")

                st.button("🔄 Restablecer Estilos por Defecto", on_click=reset_custom_styles, use_container_width=True)

        # =========================================================================
        # SECCIÓN AL FONDO: CONFIGURACIÓN DEL SISTEMA Y ACCESO REMOTO
        # =========================================================================
        st.markdown("---")
        with st.expander("⚙️ Configuración del Sistema", expanded=False):
            if is_admin:
                # 1. Configuración de Directorios y Campañas (Solo Administrador)
                with st.expander("📁 Rutas de Datos y Campañas (OneDrive)", expanded=False):
                    st.markdown("**Carpetas de Pulpas Configurada(s):**")
                    for p in DEFAULT_PULP_PATHS:
                        st.code(p, language="text")
                    st.markdown("**Carpetas de Cutting Configurada(s):**")
                    for c in DEFAULT_CUTTING_PATHS:
                        st.code(c, language="text")
                    if st.button("🔄 Re-escanear Carpetas"):
                        st.cache_data.clear()
                        st.rerun()

                # 2. Control de Compartir Acceso Remoto (Solo Administrador)
                with st.expander("🌐 Compartir Acceso Remoto Temporal", expanded=False):
                    t_state = get_tunnel_status()
                    if t_state["is_active"]:
                        st.success("🟢 **Acceso Remoto Activo**")
                        st.markdown(f"**Enlace Público (Internet):**\n[{t_state['url']}]({t_state['url']})")
                        st.code(t_state["url"], language="text")
                        st.markdown(f"**Enlace Red Local (Misma Wi-Fi):**\n`{t_state.get('local_url', 'http://127.0.0.1:8501')}`")
                        rem = t_state.get("remaining_seconds", 0)
                        mins = rem // 60
                        secs = rem % 60
                        st.caption(f"⏱️ Tiempo restante de acceso: **{mins}m {secs}s**")
                        if st.button("🛑 Desconectar y Bloquear Acceso"):
                            stop_tunnel()
                            st.rerun()
                    else:
                        st.info("Genera un enlace público temporal (HTTPS) para compartir la plataforma con supervisores o colegas durante el tiempo que tú decidas.")
                        c_dur1, c_dur2 = st.columns([2, 1])
                        with c_dur1:
                            dur_min = st.selectbox(
                                "Duración del acceso:",
                                [15, 30, 60, 120, 240, 480],
                                index=2,
                                format_func=lambda m: f"{m} minutos" if m < 60 else f"{m // 60} horas"
                            )
                        with c_dur2:
                            st.write("")
                            st.write("")
                            start_btn = st.button("🚀 Iniciar Enlace", use_container_width=True)
                        if start_btn:
                            with st.spinner("Generando enlace seguro..."):
                                ok, msg, u = start_tunnel(8501, dur_min)
                                if ok:
                                    st.success("¡Enlace creado exitosamente!")
                                    st.rerun()
                                else:
                                    st.error(f"Error: {msg}")

                # 3. Cerrojo Maestro / Kill-Switch de Invitados (Solo Administrador)
                with st.expander("🛡️ Cerrojo Maestro de Acceso (Kill-Switch)", expanded=False):
                    st.markdown("**Controla en tiempo real la entrada de invitados:**")
                    sw_val = st.toggle(
                        "🟢 Permitir Visualización a Invitados",
                        value=guest_allowed,
                        help="Si apagas este interruptor, cualquier persona remota verá de inmediato la pantalla roja de bloqueo."
                    )
                    if sw_val != guest_allowed:
                        set_access_control(sw_val, require_guest_pin, guest_pin_val)
                        st.rerun()

                    st.markdown("---")
                    st.markdown("**Clave de Acceso para Invitados:**")
                    req_pin_chk = st.checkbox("Exigir Clave/PIN a invitados remotos", value=require_guest_pin)
                    new_g_pin = st.text_input("PIN de Invitado (para compartir con tu jefe):", value=guest_pin_val, type="password")
                    
                    col_save_ctrl, col_panic_ctrl = st.columns([1, 1])
                    with col_save_ctrl:
                        if st.button("💾 Guardar Permisos", use_container_width=True):
                            set_access_control(sw_val, req_pin_chk, new_g_pin)
                            st.success("Permisos guardados.")
                            st.rerun()
                    with col_panic_ctrl:
                        if st.button("🚨 EXPULSAR A TODOS", use_container_width=True):
                            emergency_lockdown()
                            st.warning("Túnel cerrado y acceso revocado inmediatamente.")
                            st.rerun()

                if not is_server_host and st.session_state.get('admin_authenticated'):
                    if st.button("🔒 Cerrar Modo Administrador", key="btn_logout_admin"):
                        st.session_state['admin_authenticated'] = False
                        st.rerun()
            else:
                st.markdown("""
                <div style="background: rgba(37, 99, 235, 0.07); border-left: 4px solid #2563eb; padding: 0.6rem 1rem; border-radius: 4px; margin-bottom: 0.8rem;">
                    <span style="font-size: 0.88rem; color: #1e40af; font-weight: 700;">👁️ Sesión Remota (Modo Consulta)</span><br>
                    <span style="font-size: 0.8rem; color: #94a3b8;">La administración de red y carpetas maestras está disponible exclusivamente en la estación local.</span>
                </div>
                """, unsafe_allow_html=True)

    dash_map = {
        "── Sólida": "solid",
        "··· Punteada": "dot",
        "-- Segmentada": "dash",
        "-·- Trazo-Punto": "dashdot",
        "— Trazos Largos": "longdash",
        "Sólida (Continua)": "solid",
        "Punteada (Puntos)": "dot",
        "Segmentada (Trazos)": "dash",
        "Trazo y Punto": "dashdot",
        "Trazos Largos": "longdash"
    }
    mode_map = {
        "Línea + Puntos": "lines+markers",
        "Solo Línea": "lines",
        "Solo Puntos": "markers"
    }

    c_pulp = st.session_state.get('color_pulp') or '#1f77b4'
    if c_pulp in ['#000000', '#000', 'black']:
        c_pulp = '#1f77b4'
        st.session_state['color_pulp'] = '#1f77b4'

    c_cut = st.session_state.get('color_cut') or '#ff7f0e'
    if c_cut in ['#000000', '#000', 'black']:
        c_cut = '#ff7f0e'
        st.session_state['color_cut'] = '#ff7f0e'

    c_e2_pulp = st.session_state.get('color_e2_pulp') or '#2ca02c'
    c_e2_cut = st.session_state.get('color_e2_cut') or '#d62728'

    dash_pulp = dash_map.get(st.session_state.get('dash_pulp_choice', "── Sólida"), "solid")
    dash_cut = dash_map.get(st.session_state.get('dash_cut_choice', "── Sólida"), "solid")
    dash_e2_pulp = dash_map.get(st.session_state.get('dash_e2_pulp_choice', "── Sólida"), "solid")
    dash_e2_cut = dash_map.get(st.session_state.get('dash_e2_cut_choice', "··· Punteada"), "dot")

    plot_mode = mode_map.get(st.session_state.get('line_mode_choice', "Línea + Puntos"), "lines+markers")
    w_pulp = float(st.session_state.get('width_pulp', 2.5))
    w_cut = float(st.session_state.get('width_cut', 2.0))
    pt_size = int(st.session_state.get('marker_size', 4))

    theme_param = 'dark' if st.session_state.get('theme_choice_radio', "☀️ Fondo Blanco") == "🌙 Fondo Oscuro" else 'light'

    # Si no hay sondaje seleccionado, mostrar la tarjeta de bienvenida en el cuerpo principal
    if not has_active_data:
        st.markdown(f"""
        <div style="padding: 2.2rem 2.5rem; background: rgba(30, 41, 59, 0.7); border-radius: 12px; border: 1px solid #334155; margin: 1.5rem 0 2rem 0; box-shadow: 0 4px 16px rgba(0,0,0,0.2);">
            <h2 style="margin-top: 0; color: #38bdf8; font-weight: 700;">🏔️ Bienvenido a Ct-Pp QA/QC Analytics</h2>
            <p style="font-size: 1.05rem; line-height: 1.6; color: #f1f5f9;">
                Plataforma especializada en reconciliación geológica y control de calidad analítico entre lecturas de 
                <b>FRX Portátil (Cutting)</b> y ensayos químicos de laboratorio oficial <b>(Pulpa)</b>.
            </p>
            <div style="display: flex; gap: 1.2rem; flex-wrap: wrap; margin-top: 1.4rem;">
                <div style="background: #1e293b; padding: 0.9rem 1.4rem; border-radius: 8px; border: 1px solid #334155; box-shadow: 0 2px 8px rgba(0,0,0,0.3); min-width: 170px;">
                    <span style="font-size: 0.82rem; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Sondajes Disponibles</span><br>
                    <span style="font-size: 1.6rem; font-weight: 700; color: #ffffff;">{len(available_holes)}</span><br>
                    <span style="font-size: 0.78rem; color: #60a5fa; font-weight: 500;">({n_both} pareados + {n_mono} monofuente)</span>
                </div>
                <div style="background: #1e293b; padding: 0.9rem 1.4rem; border-radius: 8px; border: 1px solid #334155; box-shadow: 0 2px 8px rgba(0,0,0,0.3); min-width: 170px;">
                    <span style="font-size: 0.82rem; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Elementos Disponibles</span><br>
                    <span style="font-size: 1.6rem; font-weight: 700; color: #ffffff;">35</span><br>
                    <span style="font-size: 0.78rem; color: #38bdf8; font-weight: 500;">Multi-Elemento FRX</span>
                </div>
                <div style="background: #1e293b; padding: 0.9rem 1.4rem; border-radius: 8px; border: 1px solid #334155; box-shadow: 0 2px 8px rgba(0,0,0,0.3); min-width: 170px;">
                    <span style="font-size: 0.82rem; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Integridad Archivos</span><br>
                    <span style="font-size: 1.6rem; font-weight: 700; color: #22c55e;">Solo Lectura 🔒</span><br>
                    <span style="font-size: 0.78rem; color: #94a3b8; font-weight: 500;">OneDrive Seguro</span>
                </div>
            </div>
            <div style="margin-top: 1.6rem; padding: 0.9rem 1.2rem; background: rgba(30, 58, 138, 0.35); border-left: 4px solid #3b82f6; border-radius: 4px;">
                <span style="color: #93c5fd; font-size: 1rem; font-weight: 600;">👈 Para comenzar:</span>
                <span style="color: #f1f5f9; font-size: 0.95rem;"> Selecciona un sondaje específico en el menú desplegable de la barra lateral izquierda.</span>
            </div>
        </div>
        """, unsafe_allow_html=True)
        st.info("💡 **Personalización**: Puedes cambiar el tema de fondo de los gráficos (☀️ Fondo Blanco o 🌙 Fondo Oscuro), colores y estilos de línea en la sección **🎨 Estilo y Apariencia de Gráficos** del panel lateral una vez cargado un sondaje.")
        st.stop()

    # --- TABLA RESUMEN MULTIELEMENTO PARA ESTE POZO (ENCABEZADO) ---
    header_subtitle = "Comparación de Elementos" if is_paired_hole else f"Monitoreo ({'Cutting FRX' if hole_source_type == 'only_cutting' else 'Pulpa Laboratorio'})"
    st.markdown(f"### 📍 {active_title} — {header_subtitle}: **{', '.join(selected_elements)}**")

    # Generar tabla rápida para los elementos seleccionados
    summary_selected_rows = []
    stats_dict_map = {}
    for el in selected_elements:
        st_el = calculate_element_stats(df_active, el, cutoff=cutoff if el == focus_elem else 0.0)
        stats_dict_map[el] = st_el
        if st_el.get('valid', False):
            unit_el = get_element_unit(el)
            summary_selected_rows.append({
                'Elemento': el,
                'Unidad': unit_el,
                'Pares (N)': st_el['n_pairs'],
                'Media Pulpa': st_el['mean_pulp'],
                'Media Cutting': st_el['mean_cut'],
                'Diferencia (Δ)': st_el['mean_diff'],
                'Sesgo Relativo (%)': st_el['rel_bias_pct'],
                'R²': st_el['r2'],
                'Pendiente RMA': st_el['slope_rma'],
                'Intercepto RMA': st_el['intercept_rma'],
                '% HARD ≤ 10%': st_el['pct_hard_le_10'],
                'Calidad QA/QC': f"{st_el['quality_rating']}"
            })

    if summary_selected_rows:
        df_quick_sum = pd.DataFrame(summary_selected_rows)
        st.dataframe(
            df_quick_sum.style.format({
                'Media Pulpa': '{:.4f}',
                'Media Cutting': '{:.4f}',
                'Diferencia (Δ)': '{:+.4f}',
                'Sesgo Relativo (%)': '{:+.2f}%',
                'R²': '{:.4f}',
                'Pendiente RMA': '{:.3f}',
                'Intercepto RMA': '{:+.4f}',
                '% HARD ≤ 10%': '{:.1f}%'
            }),
            use_container_width=True
        )
    elif not is_paired_hole:
        source_label = "Solo Cutting (FRX en terreno)" if hole_source_type == 'only_cutting' else "Solo Pulpa (Laboratorio oficial)"
        st.info(f"ℹ️ Este sondaje dispone de datos de **{source_label}**. La tabla de comparación estadística pareada (R², RMA, HARD) se activa cuando existen ambas fuentes disponibles.")

    # Generar tabla resumen multielemento (si aplica)
    summary_table = pd.DataFrame()
    if is_paired_hole:
        summary_table = multi_element_summary_table(df_active, cutoff=cutoff)

    # --- PESTAÑAS PRINCIPALES MULTIELEMENTO ---
    tab_downhole, tab_scatter, tab_cross, tab_qaqc, tab_all_matrix, tab_data = st.tabs([
        "📉 1. Perfil en Profundidad (Multi-Track & Superpuesto)",
        "🎯 2. Dispersión 1:1 Simultánea (Multi-Scatter)",
        "🔀 3. Correlación Cruzada (ej. Cu vs Mo)",
        "⚖️ 4. Control QA/QC (Bland-Altman & HARD)",
        "🧪 5. Matriz Completa (35 Elementos)",
        "📄 6. Tabla de Datos & Exportación"
    ])

    # =========================================================================
    # PESTAÑA 1: PERFILES EN PROFUNDIDAD
    # =========================================================================
    with tab_downhole:
        with st.expander("📖 Guía Didáctica: ¿Cómo interpretar los Perfiles en Profundidad?", expanded=False):
            st.markdown("""
            * **¿Qué muestra este gráfico?**: La trayectoria tramo a tramo (cada 2 metros) de las concentraciones químicas a medida que el pozo penetra en profundidad (desde la superficie $0\\,\\text{m}$ hasta el fondo del pozo).
            * **Curva Azul (Pulpa - Referencia)**: Análisis de laboratorio químico sobre roca finamente pulverizada ($<75\\,\\mu\\text{m}$). Es el estándar oficial de máxima confiabilidad del proyecto.
            * **Curva Naranja (Cutting - FRX)**: Lectura directa instrumental con equipo FRX sobre los detritos gruesos de perforación analizados en terreno.
            * **Barras de Discrepancia ($\\Delta = \\text{Cutting} - \\text{Pulpa}$)**:
              * 🟧 **Naranja ($\\Delta \\ge 0$)**: El Cutting reportó una ley superior a la Pulpa (sobreestimación).
              * 🟦 **Azul ($\\Delta < 0$)**: La Pulpa reportó una ley superior al Cutting (subestimación).
            * **¿Para qué sirve?**: Permite validar si las zonas de enriquecimiento y los picos de Cobre (Cu) coinciden en profundidad con otros elementos guías (ej. Molibdeno Mo, Hierro Fe, Azufre S) y detectar tramos anómalos que requieran re-muestreo.
            """)

        # Selectores de modalidad y orientación
        col_view_mode, col_orient = st.columns([0.58, 0.42])
        with col_view_mode:
            dh_view = st.radio(
                "Modalidad de Perfil:",
                [
                    f"📊 Multi-Track en Paralelo ({', '.join(selected_elements)})",
                    f"🔀 Superposición en un Mismo Gráfico",
                    f"🔍 Perfil Detallado de 1 Elemento con Barras Δ"
                ],
                horizontal=True
            )
        with col_orient:
            orient_choice = st.radio(
                "📐 Orientación del Perfil:",
                ["↕️ Vertical", "↔️ Horizontal (A lo largo del Sondaje)"],
                horizontal=True,
                help="↕️ Vertical: Eje Y hacia abajo (profundidad del pozo). ↔️ Horizontal: Eje X continuo con rangeslider para navegar a lo largo de todo el sondaje."
            )

        orientation_param = 'vertical' if orient_choice.startswith("↕️") else 'horizontal'

        # Controles de escala y altura según orientación
        if orientation_param == 'vertical':
            def reset_dh_height():
                st.session_state['slider_dh_profile_height'] = 750

            col_sc_slider, col_sc_btn = st.columns([0.70, 0.30])
            with col_sc_slider:
                if 'slider_dh_profile_height' not in st.session_state:
                    st.session_state['slider_dh_profile_height'] = 750

                profile_height = st.select_slider(
                    "↕️ Escala Vertical de Profundidad (Eje Y):",
                    options=[600, 750, 1000, 1400, 1800, 2400, 3200],
                    key="slider_dh_profile_height",
                    format_func=lambda h: {
                        600: "Comprimido (600px)",
                        750: "Estándar / Por Defecto (750px)",
                        1000: "Intermedio (1.000px)",
                        1400: "Expandido (1.400px)",
                        1800: "Alta Resolución (1.800px)",
                        2400: "Detalle Fino (2.400px)",
                        3200: "Máximo Estiramiento (3.200px)"
                    }.get(h, f"{h}px"),
                    help="Estira el eje vertical de profundidad para separar visualmente las barras de 2m y leer cómodamente cada muestra. Ideal para pozos profundos de más de 400m."
                )

            with col_sc_btn:
                st.write("")  # Alineación vertical
                st.write("")
                st.button("🔄 Escala por Defecto (750px)", key="btn_reset_height", on_click=reset_dh_height, use_container_width=True)

            use_scroll_box = st.checkbox("🪟 Bloquear en ventana con scroll vertical (mantiene la página fija en pantalla)", value=False)
        else:
            def reset_dh_height_h():
                st.session_state['slider_dh_horizontal_height'] = 340

            col_h_slider, col_h_btn = st.columns([0.70, 0.30])
            with col_h_slider:
                if 'slider_dh_horizontal_height' not in st.session_state:
                    st.session_state['slider_dh_horizontal_height'] = 340

                profile_height = st.select_slider(
                    "↕️ Dimensión Vertical del Gráfico (Eje Y):",
                    options=[220, 280, 340, 380, 450, 550, 680],
                    key="slider_dh_horizontal_height",
                    format_func=lambda h: {
                        220: "Ultra Bajo y Panorámico (220px)",
                        280: "Bajo y Ancho (280px)",
                        340: "Compacto / Recomendado (340px)",
                        380: "Estándar Horizontal (380px)",
                        450: "Medio (450px)",
                        550: "Alto (550px)",
                        680: "Máxima Altura (680px)"
                    }.get(h, f"{h}px"),
                    help="Ajusta la altura vertical del gráfico (Eje Y). Selecciona alturas menores (ej. 220px–340px) para que el gráfico se vea más bajo y alargado/ancho, facilitando el análisis visual horizontal a lo largo del pozo."
                )

            with col_h_btn:
                st.write("")
                st.write("")
                st.button("🔄 Altura por Defecto (340px)", key="btn_reset_height_h", on_click=reset_dh_height_h, use_container_width=True)

            if dh_view.startswith("📊"):
                profile_height = max(profile_height, len(selected_elements) * 180)

            st.caption("💡 **Modo Horizontal**: La profundidad se despliega a lo largo del pozo en el eje X de izquierda a derecha. Usa el deslizador superior para hacer el gráfico más bajo o alto y navega cualquier tramo con el **control deslizante inferior (rangeslider)**.")
            use_scroll_box = False

        if dh_view.startswith("📊"):
            st.markdown(f"#### 📊 Perfil Sincronizado para {selected_hole}")
            fig_mt = plot_multi_track_downhole(
                df_active, selected_elements, selected_hole,
                orientation=orientation_param, height=profile_height,
                color_pulp=c_pulp, color_cut=c_cut,
                dash_pulp=dash_pulp, dash_cut=dash_cut,
                width_pulp=w_pulp, width_cut=w_cut,
                plot_mode=plot_mode, marker_size=pt_size,
                theme=theme_param
            )
            if use_scroll_box:
                with st.container(height=720):
                    st.plotly_chart(fig_mt, use_container_width=True, config=PLOTLY_CONFIG, theme=None)
            else:
                st.plotly_chart(fig_mt, use_container_width=True, config=PLOTLY_CONFIG, theme=None)

        elif dh_view.startswith("🔀"):
            st.markdown(f"#### 🔀 Superposición de Elementos en {selected_hole}")
            st.caption("Superpone pares de elementos en el mismo perfil (con doble escala). Puedes agregar múltiples gráficos comparativos independientes a tu antojo (ej. **S vs Ca** y **S vs K**) para evaluar su comportamiento conjunto.")

            if 'overlay_pairs' not in st.session_state or not st.session_state['overlay_pairs']:
                default_e1 = selected_elements[0] if selected_elements else avail_elements[0]
                candidates_e2 = [el for el in selected_elements if el != default_e1] or [el for el in avail_elements if el != default_e1]
                default_e2 = candidates_e2[0] if candidates_e2 else default_e1
                st.session_state['overlay_pairs'] = [{'e1': default_e1, 'e2': default_e2}]

            def add_overlay_pair():
                e1_def = avail_elements[0]
                e2_def = avail_elements[1] if len(avail_elements) > 1 else avail_elements[0]
                st.session_state['overlay_pairs'].append({'e1': e1_def, 'e2': e2_def})

            col_add_btn, _ = st.columns([0.4, 0.6])
            with col_add_btn:
                st.button("➕ Agregar Gráfico de Superposición", on_click=add_overlay_pair, use_container_width=True)

            pairs_to_remove = []
            for idx, pair in enumerate(st.session_state['overlay_pairs']):
                st.markdown("---")
                col_t, col_del = st.columns([0.82, 0.18])
                with col_t:
                    st.markdown(f"##### 📈 Gráfico #{idx + 1}: **{pair['e1']}** vs **{pair['e2']}**")
                with col_del:
                    if len(st.session_state['overlay_pairs']) > 1:
                        if st.button("🗑️ Quitar", key=f"btn_del_overlay_{idx}", use_container_width=True):
                            pairs_to_remove.append(idx)

                col_sel1, col_sel2 = st.columns(2)
                with col_sel1:
                    idx_e1 = avail_elements.index(pair['e1']) if pair['e1'] in avail_elements else 0
                    pair['e1'] = st.selectbox(f"Elemento 1 (Gráfico #{idx + 1}):", avail_elements, index=idx_e1, key=f"overlay_pair_e1_{idx}")
                with col_sel2:
                    idx_e2 = avail_elements.index(pair['e2']) if pair['e2'] in avail_elements else (1 if len(avail_elements) > 1 else 0)
                    pair['e2'] = st.selectbox(f"Elemento 2 (Gráfico #{idx + 1}):", avail_elements, index=idx_e2, key=f"overlay_pair_e2_{idx}")

                if pair['e1'] == pair['e2']:
                    st.info(f"💡 Ambos ejes tienen el mismo elemento (**{pair['e1']}**). Elige otro elemento secundario para analizar la relación.")

                fig_ov = plot_two_elements_overlay(
                    df_active, pair['e1'], pair['e2'], selected_hole,
                    orientation=orientation_param, height=profile_height,
                    color_pulp=c_pulp, color_cut=c_cut,
                    color_e2_pulp=c_e2_pulp, color_e2_cut=c_e2_cut,
                    dash_pulp=dash_pulp, dash_cut=dash_cut,
                    dash_e2_pulp=dash_e2_pulp, dash_e2_cut=dash_e2_cut,
                    width_pulp=w_pulp, width_cut=w_cut,
                    width_e2_pulp=w_pulp, width_e2_cut=w_cut,
                    plot_mode=plot_mode, marker_size=pt_size,
                    theme=theme_param
                )
                if use_scroll_box:
                    with st.container(height=720):
                        st.plotly_chart(fig_ov, use_container_width=True, config=PLOTLY_CONFIG, theme=None)
                else:
                    st.plotly_chart(fig_ov, use_container_width=True, config=PLOTLY_CONFIG, theme=None)

            if pairs_to_remove:
                for i in sorted(pairs_to_remove, reverse=True):
                    st.session_state['overlay_pairs'].pop(i)
                st.rerun()

        else:
            st.markdown(f"#### 🔍 Perfil Detallado con Barras de Discrepancia: **{focus_elem}**")
            fig_single = plot_downhole_profile(
                df_active, focus_elem, selected_hole, focus_unit,
                orientation=orientation_param, height=profile_height,
                color_pulp=c_pulp, color_cut=c_cut,
                dash_pulp=dash_pulp, dash_cut=dash_cut,
                width_pulp=w_pulp, width_cut=w_cut,
                plot_mode=plot_mode, marker_size=pt_size,
                theme=theme_param
            )
            if use_scroll_box:
                with st.container(height=720):
                    st.plotly_chart(fig_single, use_container_width=True, config=PLOTLY_CONFIG, theme=None)
            else:
                st.plotly_chart(fig_single, use_container_width=True, config=PLOTLY_CONFIG, theme=None)

        # --- TABLA DE TRAMOS CON MAYOR DISCREPANCIA ---
        if is_paired_hole:
            st.markdown("---")
            st.markdown("#### ⚠️ Tramos con Mayor Discrepancia (|Cutting - Pulpa|)")
            st.caption("Intervalos del sondaje donde existe la mayor divergencia analítica entre las lecturas de Cutting y la Pulpa.")

            col_disc1, col_disc2 = st.columns([0.45, 0.55])
            with col_disc1:
                elem_disc = st.selectbox(
                    "Elemento a inspeccionar en la tabla:",
                    selected_elements if selected_elements else avail_elements,
                    index=0,
                    key="select_elem_discrepancy"
                )
            with col_disc2:
                n_disc = st.slider("Cantidad de tramos a listar:", min_value=5, max_value=25, value=10, step=5, key="slider_n_disc")

            d_col = f"{elem_disc}_Diff_Abs"
            if d_col in df_active.columns:
                top_diff = df_active.copy()
                top_diff['Abs_Diff_Mag'] = top_diff[d_col].abs()
                cols_show = ['From', 'To', 'Longitud_m']
                if 'Sample_ID_Pulp' in top_diff.columns: cols_show.append('Sample_ID_Pulp')
                if 'Sample_ID_Cut' in top_diff.columns: cols_show.append('Sample_ID_Cut')
                cols_show.extend([
                    f"{elem_disc}_Pulp",
                    f"{elem_disc}_Cut",
                    d_col,
                    f"{elem_disc}_Diff_Rel_%",
                    f"{elem_disc}_HARD_%"
                ])
                top_table = top_diff.sort_values(by='Abs_Diff_Mag', ascending=False).head(n_disc)[cols_show]
                unit_disc = get_element_unit(elem_disc)
                st.dataframe(
                    top_table.style.format({
                        f"{elem_disc}_Pulp": "{:.4f}",
                        f"{elem_disc}_Cut": "{:.4f}",
                        d_col: "{:+.4f}",
                        f"{elem_disc}_Diff_Rel_%": "{:+.2f}%",
                        f"{elem_disc}_HARD_%": "{:.2f}%"
                    }),
                    use_container_width=True
                )
        else:
            st.markdown("---")
            st.info("ℹ️ La tabla de tramos con mayor discrepancia (|Cutting - Pulpa|) se activa cuando el sondaje dispone de ambas fuentes pareadas.")

    # =========================================================================
    # PESTAÑA 2: DISPERSIÓN 1:1 SIMULTÁNEA (MULTI-SCATTER GRID)
    # =========================================================================
    with tab_scatter:
        if not is_paired_hole:
            st.info("ℹ️ Los gráficos de dispersión 1:1 y las ecuaciones de calibración RMA requieren comparar muestras pareadas (Cutting vs. Pulpa) en los mismos intervalos de muestreo. Este sondaje cuenta con una sola fuente analítica.")
        else:
            with st.expander("📖 Guía Didáctica: ¿Cómo interpretar la Dispersión 1:1 y la Calibración RMA?", expanded=False):
                st.markdown("""
                * **¿Qué muestra este gráfico?**: La correlación directa muestra a muestra entre el valor evaluado de **Cutting (Eje Y)** y la referencia oficial de **Pulpa (Eje X)**.
                * **Línea Diagonal 1:1 (Blanca continua)**: Representa la concordancia perfecta ($y = x$). Si todas las muestras estuvieran exactamente sobre esta línea, el Cutting reportaría idéntico al laboratorio.
                * **Envolventes Sombreadas ($\pm 10\%$ y $\pm 20\%$)**: Franjas de tolerancia analítica. Mientras mayor sea la proporción de puntos concentrados dentro del área azul claro ($\pm 10\%$), mayor es la exactitud operacional.
                * **Línea Roja (Regresión RMA - *Reduced Major Axis*)**: Ajuste geométrico estándar en minería. A diferencia de una regresión lineal común (OLS), la RMA asume que **ambas variables tienen incertidumbre analítica**.
                * **Fórmula de Calibración**: La ecuación mostrada más abajo permite corregir las lecturas futuras de cutting a leyes equivalentes de pulpa antes de ingresarlas al modelo de bloques.
                """)

            st.markdown(f"#### 🎯 Gráficos de Dispersión 1:1 para los Elementos Seleccionados ({', '.join(selected_elements)})")
            fig_grid = plot_multi_scatter_grid(
                df_active, selected_elements, selected_hole if selected_hole else "Consolidado",
                color_pulp=c_pulp, color_cut=c_cut,
                theme=theme_param
            )
            st.plotly_chart(fig_grid, use_container_width=True, config=PLOTLY_CONFIG, theme=None)

            st.markdown("---")
            st.markdown(f"#### 📐 Ecuaciones de Calibración Detalladas para **{focus_elem}**")
            st_focus = stats_dict_map.get(focus_elem, {})
            if st_focus.get('valid', False):
                c_eq1, c_eq2 = st.columns(2)
                with c_eq1:
                    st.markdown("**Regresión RMA (*Reduced Major Axis*):**")
                    st.latex(rf"\text{{Cut}} = {st_focus['slope_rma']:.4f} \cdot \text{{Pulp}} {st_focus['intercept_rma']:+.4f}")
                    st.caption(f"R²: {st_focus['r2']:.4f} | Pearson r: {st_focus['r_pearson']:.4f} | Spearman ρ: {st_focus['r_spearman']:.4f}")
                with c_eq2:
                    st.markdown("**Fórmula de Corrección Cutting $\to$ Pulpa Estimada:**")
                    st.latex(rf"\text{{Pulp}}_{{\text{{calibrada}}}} = \frac{{\text{{Cut}} - ({st_focus['intercept_rma']:+.4f})}}{{{st_focus['slope_rma']:.4f}}}")
                    st.caption(f"Error Cuadrático Medio (RMSE): {st_focus['rmse']:.4f} {focus_unit} | MAE: {st_focus['mae']:.4f} {focus_unit}")

    # =========================================================================
    # PESTAÑA 3: CORRELACIÓN CRUZADA ENTRE ELEMENTOS (ej. Cu vs Mo)
    # =========================================================================
    with tab_cross:
        with st.expander("📖 Guía Didáctica: ¿Cómo interpretar la Correlación Cruzada entre Elementos?", expanded=False):
            st.markdown("""
            * **¿Qué busca responder?**: *¿El análisis rápido de Cutting preserva la misma relación geoquímica natural que mide el laboratorio en Pulpa?*
            * **Asociaciones Geoquímicas**: Compara simultáneamente dos variables (ej. Cobre vs Molibdeno, Cobre vs Hierro o Azufre vs Calcio) en el mismo pozo o consolidado global.
            * **¿Cómo se interpreta visualmente?**:
              * **Puntos y Línea Azul**: Tendencia geoquímica original de la **Pulpa (Laboratorio)**.
              * **Puntos y Línea Naranja**: Tendencia observada con el **Cutting (FRX en terreno)**.
            * **Criterio de Validación**:
              * Si ambas líneas son **casi paralelas y con pendientes similares**, el Cutting reproduce con fidelidad la mineralogía y zonamiento del yacimiento.
              * Si las líneas se cruzan o tienen pendientes opuestas, indica un **efecto de matriz o interferencia instrumental** que afecta a uno de los elementos.
            """)

        st.markdown("#### 🔀 Análisis de Relación Geoquímica Cruzada")
        st.caption("Permite evaluar cómo se relacionan dos elementos químicos entre sí y comparar múltiples gráficos simultáneos a tu antojo (ej. **S vs Ca** y **S vs K**).")

        if 'cross_pairs' not in st.session_state or not st.session_state['cross_pairs']:
            def_x = 'Cu' if 'Cu' in avail_elements else avail_elements[0]
            cand_y = [el for el in ['Mo', 'Fe', 'S', 'Ca'] if el in avail_elements and el != def_x]
            def_y = cand_y[0] if cand_y else (avail_elements[1] if len(avail_elements) > 1 else def_x)
            st.session_state['cross_pairs'] = [{'x': def_x, 'y': def_y}]

        def add_cross_pair():
            x_def = avail_elements[0]
            y_def = avail_elements[1] if len(avail_elements) > 1 else avail_elements[0]
            st.session_state['cross_pairs'].append({'x': x_def, 'y': y_def})

        col_c_btn, _ = st.columns([0.4, 0.6])
        with col_c_btn:
            st.button("➕ Agregar Gráfico de Correlación Cruzada", on_click=add_cross_pair, use_container_width=True)

        cross_to_remove = []
        for idx, cp in enumerate(st.session_state['cross_pairs']):
            st.markdown("---")
            col_ct, col_cdel = st.columns([0.82, 0.18])
            with col_ct:
                st.markdown(f"##### 🎯 Gráfico Cruzado #{idx + 1}: **{cp['x']}** vs **{cp['y']}**")
            with col_cdel:
                if len(st.session_state['cross_pairs']) > 1:
                    if st.button("🗑️ Quitar", key=f"btn_del_cross_{idx}", use_container_width=True):
                        cross_to_remove.append(idx)

            col_cr1, col_cr2 = st.columns(2)
            with col_cr1:
                idx_x = avail_elements.index(cp['x']) if cp['x'] in avail_elements else 0
                cp['x'] = st.selectbox(f"Elemento Eje X (Gráfico #{idx + 1}):", avail_elements, index=idx_x, key=f"cross_x_{idx}")
            with col_cr2:
                idx_y = avail_elements.index(cp['y']) if cp['y'] in avail_elements else (1 if len(avail_elements) > 1 else 0)
                cp['y'] = st.selectbox(f"Elemento Eje Y (Gráfico #{idx + 1}):", avail_elements, index=idx_y, key=f"cross_y_{idx}")

            if cp['x'] != cp['y']:
                fig_cross = plot_cross_element_correlation(
                    df_active, cp['x'], cp['y'], selected_hole if selected_hole else "Consolidado",
                    color_pulp=c_pulp, color_cut=c_cut,
                    dash_pulp=dash_pulp, dash_cut=dash_cut,
                    width_pulp=w_pulp, width_cut=w_cut,
                    marker_size=max(5, pt_size + 2),
                    theme=theme_param
                )
                st.plotly_chart(fig_cross, use_container_width=True, config=PLOTLY_CONFIG, theme=None)
            else:
                st.warning(f"Selecciona dos elementos diferentes para el gráfico #{idx + 1}.")

        if cross_to_remove:
            for i in sorted(cross_to_remove, reverse=True):
                st.session_state['cross_pairs'].pop(i)
            st.rerun()

    # =========================================================================
    # PESTAÑA 4: CONTROL QA/QC (BLAND-ALTMAN & HARD)
    # =========================================================================
    with tab_qaqc:
        if not is_paired_hole:
            st.info("ℹ️ El control de calidad analítico QA/QC (Bland-Altman y Curvas de Precisión HARD) evalúa la diferencia relativa entre duplicados pareados (Cutting vs. Pulpa). Este sondaje dispone de una sola fuente.")
        else:
            with st.expander("📖 Guía Didáctica: ¿Cómo interpretar el Control QA/QC (Bland-Altman & HARD)?", expanded=False):
                st.markdown("""
                * **Gráfico de Bland-Altman (Izquierda - Sesgo vs Concentración)**:
                  * Evalúa si el sesgo del Cutting cambia a medida que aumenta la ley de la muestra.
                  * **Línea Azul Central**: Representa el sesgo relativo promedio de todo el pozo.
                  * **Líneas Punteadas Rojas ($\pm 1.96\\,\\text{SD}$)**: Marcan los límites de acuerdo del $95\%$. Muestras fuera de estas líneas rojas representan discrepancias analíticas severas que ameritan inspección visual del testigo o duplicado.
                * **Curva de Precisión HARD (Derecha - Frecuencia Acumulada)**:
                  * $\\text{HARD} = \\frac{|\\text{Cutting} - \\text{Pulpa}|}{\\text{Cutting} + \\text{Pulpa}} \\times 100\\%$. Métrica estándar internacional (JORC / NI 43-101) para duplicados de control geológico.
                  * **Regla de Decisión Minera**: Al menos el **$80\\%$** de los pares de muestras deben ubicarse bajo el **$10\\%$ de HARD** (línea roja discontinua). Si la curva morada supera este umbral, el método de Cutting califica como de alta precisión.
                """)

            elem_qaqc = st.selectbox("Selecciona el elemento a inspeccionar en QA/QC:", selected_elements, index=0, key="qaqc_elem")
            st_qaqc = stats_dict_map.get(elem_qaqc, calculate_element_stats(df_active, elem_qaqc))
            unit_qaqc = get_element_unit(elem_qaqc)

            col_q1, col_q2 = st.columns(2)
            with col_q1:
                fig_ba = plot_bland_altman(df_active, elem_qaqc, st_qaqc, unit_qaqc, theme=theme_param)
                st.plotly_chart(fig_ba, use_container_width=True, config=PLOTLY_CONFIG, theme=None)
                st.caption(f"💡 **Sesgo Medio**: {st_qaqc.get('ba_mean', 0.0):+.2f}% | Límites de acuerdo 95%: [{st_qaqc.get('ba_lower_limit', 0.0):+.1f}%, {st_qaqc.get('ba_upper_limit', 0.0):+.1f}%]")

            with col_q2:
                fig_hard = plot_hard_cumulative(df_active, elem_qaqc, st_qaqc, theme=theme_param)
                st.plotly_chart(fig_hard, use_container_width=True, config=PLOTLY_CONFIG, theme=None)
                st.caption(f"💡 **Muestras con HARD ≤ 10%**: {st_qaqc.get('pct_hard_le_10', 0.0):.1f}% | Criterio minero: ≥ 80%")

    # =========================================================================
    # PESTAÑA 5: MATRIZ COMPLETA (35 ELEMENTOS)
    # =========================================================================
    with tab_all_matrix:
        if not is_paired_hole:
            st.info("ℹ️ La matriz multielemento y su semáforo de confiabilidad instrumental evalúan la correlación pareada (R² y sesgo relativo) entre Cutting y Pulpa a lo largo de los 35 elementos. Este sondaje dispone de una sola fuente de datos.")
        else:
            with st.expander("📖 Guía Didáctica: ¿Cómo interpretar la Matriz de los 35 Elementos y el Semáforo?", expanded=False):
                st.markdown("""
                * **¿Qué muestra?**: Una evaluación integral de la confiabilidad instrumental del equipo FRX para todos los elementos analizados.
                * **Gráficos de Barras Superiores**:
                  * **$R^2$ por Elemento**: Muestra la consistencia lineal. Barras verdes ($R^2 \\ge 0.85$) indican excelente respuesta instrumental.
                  * **Sesgo Relativo (%)**: Muestra si el Cutting sobreestima ($>0$) o subestima ($<0$) al laboratorio. Barras dentro de $\\pm 10\\%$ cumplen tolerancia estricta.
                * **Semáforo y Criterios de Uso Operacional**:
                  * 🟢 **Excelente ($R^2 \\ge 0.85$ y $|\text{Sesgo}| \\le 10\%$)**: Datos altamente confiables. Aptos para control de leyes, delimitación de mineral y estimación directa.
                  * 🔵 **Bueno ($R^2 \\ge 0.70$ y $|\text{Sesgo}| \\le 15\%$)**: Buena respuesta. Su sesgo se puede corregir con la ecuación de regresión RMA.
                  * 🟠 **Aceptable / Cautela ($R^2 \\ge 0.50$)**: Presenta dispersión moderada. Confiable como guía de alteración hidrotermal y litología, pero no para reconciliación de leyes finas.
                  * 🔴 **No Confiable / Alto Sesgo**: Elementos cerca del límite de detección (LOD) o con interferencias espectrales. Utilizar solo con carácter cualitativo (presencia/ausencia).
                """)

            st.markdown(f"#### 🧪 Evaluación Global de los 35 Elementos en {active_title}")
            if not summary_table.empty:
                fig_multi = plot_multielement_overview(summary_table, theme=theme_param)
                st.plotly_chart(fig_multi, use_container_width=True, config=PLOTLY_CONFIG, theme=None)

                st.markdown("#### 📋 Matriz Completa y Ranking de Confiabilidad")
                st.dataframe(
                    summary_table.style.format({
                        'Media Pulpa': '{:.4f}',
                        'Media Cutting': '{:.4f}',
                        'Sesgo Relativo (%)': '{:+.2f}%',
                        'R²': '{:.4f}',
                        'Pendiente RMA': '{:.3f}',
                        'Intercepto RMA': '{:+.4f}',
                        '% HARD ≤ 10%': '{:.1f}%',
                        '% HARD ≤ 20%': '{:.1f}%'
                    }),
                    use_container_width=True
                )

    # =========================================================================
    # PESTAÑA 6: TABLA DE DATOS & EXPORTACIÓN
    # =========================================================================
    with tab_data:
        st.markdown(f"#### 📄 Datos de Muestreo Tramo a Tramo ({len(df_active):,} filas)")
        
        # Filtro de columnas para mostrar principalmente las seleccionadas
        base_cols = ['Sondaje', 'From', 'To', 'Longitud_m', 'Punto_Medio_m']
        if 'Sample_ID_Pulp' in df_active.columns: base_cols.append('Sample_ID_Pulp')
        if 'Sample_ID_Cut' in df_active.columns: base_cols.append('Sample_ID_Cut')
        
        elem_cols = []
        for el in selected_elements:
            for suffix in ['_Pulp', '_Cut', '_Diff_Abs', '_Diff_Rel_%', '_HARD_%']:
                c = f"{el}{suffix}"
                if c in df_active.columns:
                    elem_cols.append(c)

        cols_to_display = [c for c in base_cols + elem_cols if c in df_active.columns]
        st.dataframe(df_active[cols_to_display].head(250), use_container_width=True)

        col_d1, col_d2 = st.columns(2)
        with col_d1:
            csv_buffer = df_active[cols_to_display].to_csv(index=False).encode('utf-8')
            st.download_button(
                label="📥 Descargar Elementos Seleccionados en CSV",
                data=csv_buffer,
                file_name=f"FRX_Datos_{selected_hole if selected_hole else 'Sondaje'}_MultiElem.csv",
                mime="text/csv"
            )
        with col_d2:
            excel_buffer = io.BytesIO()
            with pd.ExcelWriter(excel_buffer, engine='openpyxl') as writer:
                df_active.to_excel(writer, index=False, sheet_name="Todos_los_Datos")
                if not summary_table.empty:
                    summary_table.to_excel(writer, index=False, sheet_name="Resumen_35_Elementos")
            excel_buffer.seek(0)
            st.download_button(
                label="📊 Descargar Informe Completo en Excel (.xlsx)",
                data=excel_buffer,
                file_name=f"FRX_Reporte_{selected_hole if selected_hole else 'Sondaje'}.xlsx",
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )


if __name__ == "__main__":
    main()
