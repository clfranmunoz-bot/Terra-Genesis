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
    get_local_ip
)
from src.config import (
    DEFAULT_PULP_PATHS,
    DEFAULT_CUTTING_PATHS,
    DEFAULT_PULP_PATH,
    DEFAULT_CUTTING_PATH,
    PRIORITY_ELEMENTS,
    ELEMENT_CATALOG
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

# Configuración global de barra de herramientas de Plotly (evita solapamiento con leyenda)
PLOTLY_CONFIG = {
    'displaylogo': False,
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
    st.title("🔬 Comparador de Análisis FRX: Pulpas vs. Cutting")
    st.caption("Control de Calidad Geológico (QA/QC), Calibración y Comparación Multi-Elemento en Sondajes")

    st.info("🔒 **Modo de Lectura Segura**: Tus archivos maestros en OneDrive se abren únicamente en modo de lectura estricta. Ningún dato original es modificado ni sobrescrito.")

    # --- BARRA LATERAL ---
    with st.sidebar:
        # Homogeneización visual de controles en la barra lateral
        st.markdown("""
        <style>
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
        /* Contenedores de gráficos Plotly: bordes limpios, sombra sutil y legibilidad garantizada */
        div[data-testid="stPlotlyChart"] {
            border-radius: 8px !important;
            overflow: hidden !important;
            box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12) !important;
            margin-bottom: 1.2rem !important;
        }
        </style>
        """, unsafe_allow_html=True)
        st.header("⚙️ Configuración y Filtros")

        # 1. Configuración de Directorios y Campañas
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

        # Control de Compartir Acceso Remoto
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

        # Escanear carpetas
        try:
            scan_res = cached_scan(tuple(DEFAULT_PULP_PATHS), tuple(DEFAULT_CUTTING_PATHS))
            all_common_holes = scan_res['common_holes']
            holes_info = scan_res['holes_info']
            campaigns = scan_res.get('campaigns', ['2025', '2026'])
        except Exception as e:
            st.error(f"Error accediendo a las carpetas: {e}")
            st.stop()

        # 2. Filtro por Campaña
        st.subheader("🗓️ Selección de Campaña")
        campaign_opts = ["Todas las Campañas"] + [f"Campaña {c}" for c in campaigns]
        selected_camp_label = st.selectbox(
            "Campaña a explorar:",
            campaign_opts,
            index=0,
            help="Filtra los sondajes para visualizar una campaña de perforación específica (ej. 2026 o 2025) o todas combinadas."
        )

        if selected_camp_label == "Todas las Campañas":
            common_holes = all_common_holes
            active_holes_info = holes_info
        else:
            camp_val = selected_camp_label.replace("Campaña ", "").strip()
            common_holes = [h for h in all_common_holes if holes_info[h].get('pulp_campaign') == camp_val]
            active_holes_info = {h: holes_info[h] for h in common_holes}

        st.success(f"✅ **{len(common_holes)} sondajes pareados** disponibles ({len(all_common_holes)} en total).")

        # 3. Selector de Modo
        mode = st.radio(
            "Modo de Análisis:",
            ["Sondaje Individual", "Consolidado Global (Todos los Sondajes)"],
            index=0
        )

        selected_hole = None
        if mode == "Sondaje Individual":
            hole_options = ["— Selecciona un sondaje para comenzar —"] + common_holes
            hole_choice = st.selectbox(
                "Seleccione Sondaje:",
                hole_options,
                index=0,
                format_func=lambda h: h if h.startswith("—") else f"{h} [{holes_info[h].get('pulp_campaign', '')}]"
            )
            if hole_choice != hole_options[0]:
                selected_hole = hole_choice

        # 4. Tratamiento de <LOD
        st.subheader("🧪 Límite de Detección (<LOD)")
        lod_choice = st.selectbox(
            "Criterio para valores <LOD:",
            ["Excluir valores <LOD", "Imputar a LOD / 2", "Imputar a LOD / √2"],
            index=0,
            help="Excluir es riguroso para correlaciones. LOD/2 preserva los intervalos completos en los perfiles en profundidad."
        )
        lod_mode = 'exclude' if lod_choice == "Excluir valores <LOD" else ('lod_half' if lod_choice == "Imputar a LOD / 2" else 'lod_sqrt2')

        # Cargar datos según modo
        if mode == "Sondaje Individual":
            if selected_hole is None:
                # Pantalla inicial limpia cuando no hay pozo seleccionado
                st.markdown("---")
                st.markdown(f"""
                <div style="padding: 2.2rem 2.5rem; background: linear-gradient(135deg, rgba(37, 99, 235, 0.07) 0%, rgba(59, 130, 246, 0.02) 100%); border-radius: 12px; border: 1px solid rgba(59, 130, 246, 0.22); margin-bottom: 2rem;">
                    <h2 style="margin-top: 0; color: #1d4ed8; font-weight: 700;">🏔️ Bienvenido a Ct-Pp QA/QC Analytics</h2>
                    <p style="font-size: 1.05rem; line-height: 1.6; color: #334155;">
                        Plataforma especializada en reconciliación geológica y control de calidad analítico entre lecturas de 
                        <b>FRX Portátil (Cutting)</b> y ensayos químicos de laboratorio oficial <b>(Pulpa)</b>.
                    </p>
                    <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 1.2rem;">
                        <div style="background: white; padding: 0.8rem 1.2rem; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                            <span style="font-size: 0.85rem; color: #64748b; font-weight: 600; text-transform: uppercase;">Sondajes Pareados</span><br>
                            <span style="font-size: 1.4rem; font-weight: 700; color: #0f172a;">{len(common_holes)}</span>
                        </div>
                        <div style="background: white; padding: 0.8rem 1.2rem; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                            <span style="font-size: 0.85rem; color: #64748b; font-weight: 600; text-transform: uppercase;">Elementos Disponibles</span><br>
                            <span style="font-size: 1.4rem; font-weight: 700; color: #0f172a;">35</span>
                        </div>
                        <div style="background: white; padding: 0.8rem 1.2rem; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                            <span style="font-size: 0.85rem; color: #64748b; font-weight: 600; text-transform: uppercase;">Integridad Archivos</span><br>
                            <span style="font-size: 1.4rem; font-weight: 700; color: #16a34a;">Solo Lectura 🔒</span>
                        </div>
                    </div>
                    <div style="margin-top: 1.5rem; padding: 0.9rem 1.2rem; background: rgba(59, 130, 246, 0.08); border-left: 4px solid #2563eb; border-radius: 4px;">
                        <span style="color: #1e40af; font-size: 1rem; font-weight: 600;">👈 Para comenzar:</span>
                        <span style="color: #1e3a8a; font-size: 0.95rem;"> Selecciona un sondaje específico en el menú desplegable de la barra lateral izquierda o cambia el modo a <b>Consolidado Global</b>.</span>
                    </div>
                </div>
                """, unsafe_allow_html=True)
                st.info("💡 **Personalización**: Puedes cambiar el tema de fondo de los gráficos (☀️ Fondo Blanco o 🌙 Fondo Oscuro), colores y estilos de línea en la sección **🎨 Estilo y Apariencia de Gráficos** del panel lateral.")
                st.stop()

            df_active = cached_load_hole(active_holes_info, selected_hole, lod_mode)
            hole_camp = holes_info[selected_hole].get('campaign', '')
            active_title = f"Sondaje {selected_hole} ({hole_camp})"
        else:
            df_active = cached_load_all(active_holes_info, lod_mode)
            active_title = f"Consolidado Global — {selected_camp_label} ({len(common_holes)} Sondajes)"

        if df_active.empty:
            st.warning("No se encontraron registros pareados para los parámetros seleccionados.")
            st.stop()

        # 4. Selector de Múltiples Elementos
        st.subheader("📊 Elementos a Comparar")
        avail_elements = sorted([c[:-5] for c in df_active.columns if c.endswith('_Pulp') and c[:-5] in ELEMENT_CATALOG])

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
        
        cutoff_target = st.selectbox(
            "Criterio de corte:",
            ["Pulpa o Cut (Cualquiera)", "Solo Pulpa (Laboratorio)", "Solo Cutting (FRX)"],
            index=0,
            help="Define si el umbral de ley de corte se exige en Pulpa (Lab), en Cutting (FRX) o en cualquiera de las dos."
        )

        if mode == "Sondaje Individual" and 'From' in df_active.columns and not df_active.empty:
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
            if p_c in df_active.columns and c_c in df_active.columns:
                n_before = len(df_active)
                if cutoff_target.startswith("Solo Pulpa"):
                    cond = (df_active[p_c] >= cutoff)
                elif cutoff_target.startswith("Solo Cutting"):
                    cond = (df_active[c_c] >= cutoff)
                else: # "Pulpa o Cut (Cualquiera)"
                    cond = (df_active[p_c] >= cutoff) | (df_active[c_c] >= cutoff)

                df_active = df_active[cond].copy()
                n_after = len(df_active)

                if df_active.empty:
                    st.warning(f"⚠️ Ninguna muestra alcanza la ley de corte de **{cutoff:.4f} {focus_unit}** para **{focus_elem}** ({cutoff_target}) en el rango seleccionado.")
                    st.stop()
                else:
                    st.caption(f"🎯 **Filtro Cutoff Activo ({cutoff_target})**: Mostrando **{n_after} de {n_before}** muestras ({n_after/n_before*100:.1f}%) con {focus_elem} ≥ {cutoff:.4f} {focus_unit}.")

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

        # 7. Compartición Remota Temporal
        st.subheader("🌐 Acceso Remoto Temporal")
        with st.expander("Compartir con usuarios remotos", expanded=False):
            tunnel_stat = get_tunnel_status()

            st.markdown("""
            Permite que colegas o supervisores fuera de tu red accedan a este programa en tiempo real
            mientras esté abierto en este PC, durante el tiempo que tú decidas.
            """)

            if tunnel_stat["is_active"]:
                st.success("🟢 **Enlace Remoto Activo**")
                url = tunnel_stat["url"]
                st.markdown(f"**URL Pública Segura (HTTPS):**\n[{url}]({url})")
                st.code(url, language="text")

                rem_sec = tunnel_stat.get("remaining_seconds", 0)
                if rem_sec > 0:
                    mins = rem_sec // 60
                    secs = rem_sec % 60
                    st.info(f"⏳ **Tiempo restante de acceso:** {mins:02d}m {secs:02d}s")
                else:
                    st.info("⏳ **Modo Manual activo** (sin límite de tiempo programado).")

                if st.button("⏹️ Desconectar Acceso Remoto Ahora", type="primary", use_container_width=True):
                    stop_tunnel()
                    st.rerun()
            else:
                if tunnel_stat.get("status") == "EXPIRED":
                    st.warning("⏱️ El enlace remoto anterior expiró y fue desconectado automáticamente.")

                dur_choice = st.selectbox(
                    "⏱️ Duración del acceso:",
                    ["15 minutos", "30 minutos", "1 hora (60 min)", "2 horas (120 min)", "4 horas (240 min)", "Manual (hasta que yo lo detenga)"],
                    index=1,
                    help="Al cumplirse el tiempo seleccionado, el enlace se desconectará automáticamente."
                )
                dur_map = {
                    "15 minutos": 15,
                    "30 minutos": 30,
                    "1 hora (60 min)": 60,
                    "2 horas (120 min)": 120,
                    "4 horas (240 min)": 240,
                    "Manual (hasta que yo lo detenga)": 0
                }

                if st.button("🚀 Activar Enlace Remoto Temporal", type="primary", use_container_width=True):
                    with st.spinner("Iniciando túnel seguro de Cloudflare..."):
                        ok, msg, url = start_tunnel(8501, dur_map[dur_choice])
                        if ok:
                            st.success("¡Enlace generado exitosamente!")
                            st.rerun()
                        else:
                            st.error(f"Error al conectar: {msg}")

            st.caption(f"🏠 **IP Red Local (LAN):** `http://{tunnel_stat.get('local_ip', 'localhost')}:8501`")

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

    # --- TABLA RESUMEN MULTIELEMENTO PARA ESTE POZO (ENCABEZADO) ---
    st.markdown(f"### 📍 {active_title} — Comparación de Elementos: **{', '.join(selected_elements)}**")

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

        if mode == "Sondaje Individual":
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
                profile_height = 580 if not dh_view.startswith("📊") else 660
                st.caption("💡 **Modo Horizontal**: La profundidad se despliega en el eje X continuo de izquierda a derecha. Utiliza el **control deslizante inferior (rangeslider)** dentro del gráfico para ampliar y recorrer cualquier tramo del pozo en alta resolución.")
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

            # --- TABLA DE TRAMOS CON MAYOR DISCREPANCIA (SIEMPRE VISIBLE) ---
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
            st.info("ℹ️ El perfil en profundidad se visualiza en modo **Sondaje Individual**. Selecciona un sondaje específico en la barra lateral para inspeccionar su trayectoria tramo a tramo.")

    # =========================================================================
    # PESTAÑA 2: DISPERSIÓN 1:1 SIMULTÁNEA (MULTI-SCATTER GRID)
    # =========================================================================
    with tab_scatter:
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
        summary_table = multi_element_summary_table(df_active, cutoff=cutoff)
        
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
        st.markdown(f"#### 📄 Datos Pareados Tramo a Tramo ({len(df_active):,} filas)")
        
        # Filtro de columnas para mostrar principalmente las seleccionadas
        base_cols = ['Sondaje', 'From', 'To', 'Longitud_m', 'Punto_Medio_m']
        if 'Sample_ID_Pulp' in df_active.columns: base_cols.append('Sample_ID_Pulp')
        
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
                file_name=f"FRX_Comparacion_{selected_hole if selected_hole else 'Consolidado'}_MultiElem.csv",
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
                file_name=f"FRX_Reporte_QAQC_{selected_hole if selected_hole else 'Consolidado'}.xlsx",
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            )


if __name__ == "__main__":
    main()
