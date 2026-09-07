"""
Módulo de Visualización Espacial 2D y 3D para Sondajes Mineros.
Genera planos locales de collares con proyección de azimut, visores tridimensionales
y superficies topográficas del rajo minero con Plotly.
"""
import numpy as np
import pandas as pd
import plotly.graph_objects as go
from scipy.interpolate import griddata
from scipy.ndimage import gaussian_filter
from typing import Dict, List, Optional, Any, Tuple
from src.config import ELEMENT_CATALOG


def compute_topography_grid(df_collars: pd.DataFrame,
                            grid_res: int = 65) -> Optional[Dict[str, Any]]:
    """
    Calcula una malla topográfica regular interpolada (DEM) a partir de las
    coordenadas de collares en superficie (X, Y, Z).
    Retorna gx, gy, grid_x, grid_y, grid_z y rangos de elevación.
    """
    if df_collars.empty:
        return None

    valid = df_collars[
        (df_collars['East'] > 56000) & (df_collars['East'] < 61000) &
        (df_collars['North'] > 88000) & (df_collars['North'] < 93500) &
        (df_collars['Elevation'] > 2500) & (df_collars['Elevation'] < 4500)
    ].dropna(subset=['East', 'North', 'Elevation']).copy()

    if len(valid) < 10:
        return None

    x = valid['East'].values
    y = valid['North'].values
    z = valid['Elevation'].values

    gx = np.linspace(float(x.min()) - 40.0, float(x.max()) + 40.0, grid_res)
    gy = np.linspace(float(y.min()) - 40.0, float(y.max()) + 40.0, grid_res)
    grid_x, grid_y = np.meshgrid(gx, gy)

    grid_z = griddata((x, y), z, (grid_x, grid_y), method='linear')
    grid_z_near = griddata((x, y), z, (grid_x, grid_y), method='nearest')
    grid_z = np.where(np.isnan(grid_z), grid_z_near, grid_z)

    # Suavizado gaussiano leve para morfología de ladera natural
    grid_z = gaussian_filter(grid_z, sigma=1.0)

    z_min = float(np.nanmin(grid_z))
    z_max = float(np.nanmax(grid_z))
    c_levels = np.arange(int(z_min // 50) * 50, int(z_max // 50 + 1) * 50, 50).tolist()

    return {
        'gx': gx,
        'gy': gy,
        'grid_x': grid_x,
        'grid_y': grid_y,
        'grid_z': grid_z,
        'z_min': z_min,
        'z_max': z_max,
        'c_levels': c_levels
    }


def plot_collar_map_2d(df_collars: pd.DataFrame,
                       selected_hole: Optional[str] = None,
                       view_mode: str = 'local',
                       theme: str = 'dark',
                       show_contours: bool = True,
                       topo_data: Optional[Dict[str, Any]] = None) -> go.Figure:
    """
    Genera un plano geológico en planta interactivo (Este vs Norte).
    - En modo 'local': Se enfoca en el sondaje activo y sus vecinos cercanos,
      dibujando la proyección horizontal de la trayectoria (vector Azimut/Inclinación).
    - En modo 'global': Muestra todos los collares del yacimiento agrupados por fase.
    - Soporta curvas de nivel topográficas maestras cada 50m.
    """
    fig = go.Figure()
    if df_collars.empty:
        fig.add_annotation(text="No hay datos de collares disponibles", showarrow=False, font=dict(size=16))
        return fig

    is_dark = (theme != 'light')
    bg_color = '#0e1117' if is_dark else '#ffffff'
    paper_color = '#0e1117' if is_dark else '#f8fafc'
    grid_color = '#334155' if is_dark else '#e2e8f0'
    text_color = '#f8fafc' if is_dark else '#0f172a'

    df_plot = df_collars.copy()
    c_sel = None

    if selected_hole and selected_hole in df_plot['Hole_ID'].values:
        c_sel = df_plot[df_plot['Hole_ID'] == selected_hole].iloc[0]
        # Calcular distancia Euclideana al pozo activo
        df_plot['Dist_Active_m'] = np.sqrt(
            (df_plot['East'] - c_sel['East'])**2 + (df_plot['North'] - c_sel['North'])**2
        )
    else:
        df_plot['Dist_Active_m'] = 0.0

    # Filtrar según modo
    if view_mode == 'local' and c_sel is not None:
        df_local = df_plot[df_plot['Dist_Active_m'] <= 450.0]
        if len(df_local) < 8:
            df_local = df_plot.sort_values(by='Dist_Active_m').head(12)
        df_plot = df_local.copy()

    # 0. Capa de Fondo: Curvas de Nivel Topográficas (si está habilitada y disponible)
    if show_contours and topo_data is not None:
        fig.add_trace(go.Contour(
            x=topo_data['gx'],
            y=topo_data['gy'],
            z=topo_data['grid_z'],
            colorscale='Earth',
            showscale=False,
            opacity=0.30 if is_dark else 0.40,
            contours=dict(
                start=topo_data['z_min'],
                end=topo_data['z_max'],
                size=50,
                showlabels=True,
                labelfont=dict(size=9, color=text_color)
            ),
            hoverinfo='skip',
            name='Curvas de Nivel'
        ))

    # 1. Dibujar trazas proyectadas en superficie (stick horizontal según Azimut y Dip)
    for _, row in df_plot.iterrows():
        h_id = row['Hole_ID']
        is_sel = (h_id == selected_hole)
        dip_rad = np.radians(abs(float(row.get('Dip', -90.0))))
        azim_rad = np.radians(float(row.get('Azimuth', 0.0)))
        td = float(row.get('Total_Depth', 150.0))
        
        # Longitud horizontal = TD * cos(dip)
        h_len = td * np.cos(dip_rad)
        dx = h_len * np.sin(azim_rad)
        dy = h_len * np.cos(azim_rad)
        
        x0, y0 = row['East'], row['North']
        x1, y1 = x0 + dx, y0 + dy

        # Línea de proyección de la trayectoria
        fig.add_trace(go.Scatter(
            x=[x0, x1],
            y=[y0, y1],
            mode='lines',
            line=dict(
                color='#ef4444' if is_sel else ('#60a5fa' if is_dark else '#2563eb'),
                width=4 if is_sel else 1.5,
                dash='solid' if is_sel else 'dot'
            ),
            hoverinfo='skip',
            showlegend=False
        ))

    # 2. Dibujar Collares (puntos de inicio en superficie)
    fases = sorted(df_plot['Fase'].unique())
    palette = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#84cc16']

    for idx, fase in enumerate(fases):
        sub = df_plot[df_plot['Fase'] == fase]
        fig.add_trace(go.Scatter(
            x=sub['East'],
            y=sub['North'],
            mode='markers+text',
            name=f"{fase} ({len(sub)})",
            text=sub['Hole_ID'],
            textposition='top center',
            textfont=dict(size=10, color=text_color),
            marker=dict(
                size=10,
                color=palette[idx % len(palette)],
                line=dict(width=1.5, color='#ffffff' if is_dark else '#0f172a')
            ),
            hovertemplate=(
                "<b>Sondaje: %{text}</b><br>"
                "Fase: " + str(fase) + "<br>"
                "Este (X): %{x:,.1f} m<br>"
                "Norte (Y): %{y:,.1f} m<br>"
                "Cota: %{customdata[0]:,.1f} m.s.n.m.<br>"
                "Inclinación: %{customdata[1]:.1f}° | Azimut: %{customdata[2]:.1f}°<br>"
                "Profundidad: %{customdata[3]:.1f} m<br>"
                "Distancia al pozo activo: %{customdata[4]:,.1f} m"
                "<extra></extra>"
            ),
            customdata=sub[['Elevation', 'Dip', 'Azimuth', 'Total_Depth', 'Dist_Active_m']].values
        ))

    # Resaltar pozo activo con estrella
    if c_sel is not None and selected_hole in df_plot['Hole_ID'].values:
        fig.add_trace(go.Scatter(
            x=[c_sel['East']],
            y=[c_sel['North']],
            mode='markers',
            name=f"⭐ Activo: {selected_hole}",
            marker=dict(
                size=20,
                color='#ef4444',
                symbol='star',
                line=dict(width=2, color='#ffffff')
            ),
            hoverinfo='skip'
        ))

    title_text = (
        f"🗺️ Plano Local de Sondajes — Centrado en {selected_hole} ({len(df_plot)} pozos con proyección horizontal)"
        if (view_mode == 'local' and selected_hole)
        else f"🗺️ Plano General de Collares en Superficie ({len(df_plot)} Sondajes Georreferenciados)"
    )

    fig.update_layout(
        title=dict(
            text=title_text,
            font=dict(size=17, color=text_color)
        ),
        xaxis=dict(
            title="Coordenada Este (X) [m]",
            gridcolor=grid_color,
            zeroline=False,
            scaleanchor="y",
            scaleratio=1
        ),
        yaxis=dict(
            title="Coordenada Norte (Y) [m]",
            gridcolor=grid_color,
            zeroline=False
        ),
        plot_bgcolor=bg_color,
        paper_bgcolor=paper_color,
        font=dict(color=text_color),
        legend=dict(
            orientation="h",
            yanchor="bottom",
            y=1.02,
            xanchor="right",
            x=1,
            bgcolor='rgba(15,23,42,0.6)' if is_dark else 'rgba(255,255,255,0.85)'
        ),
        height=640,
        margin=dict(l=60, r=40, t=80, b=50)
    )

    return fig


def plot_drillholes_3d(spatial_datasets: Dict[str, pd.DataFrame],
                       color_by: str = 'Cu_Cut',
                       selected_hole: Optional[str] = None,
                       elev_range: Optional[Tuple[float, float]] = None,
                       theme: str = 'dark',
                       show_legend: bool = True,
                       show_topography: bool = False,
                       topo_opacity: float = 0.45,
                       topo_data: Optional[Dict[str, Any]] = None) -> go.Figure:
    """
    Genera un visor 3D interactivo con Plotly.
    - Soporta visualización opcional de la Superficie Topográfica 3D (Rajo).
    - Resuelve el choque de leyendas: la lista de pozos se sitúa a la izquierda
      y la barra de escala de ley queda aislada a la derecha.
    - Soporta cualquier elemento químico de los 35 elementos en Cutting o Pulpa.
    """
    fig = go.Figure()
    if not spatial_datasets and (not show_topography or topo_data is None):
        fig.add_annotation(text="No hay datos espaciales 3D disponibles", showarrow=False, font=dict(size=16))
        return fig

    is_dark = (theme != 'light')
    bg_color = '#0e1117' if is_dark else '#ffffff'
    paper_color = '#0e1117' if is_dark else '#f8fafc'
    grid_color = '#334155' if is_dark else '#e2e8f0'
    text_color = '#f8fafc' if is_dark else '#0f172a'

    # 0. Superficie Topográfica 3D (Rajo / Montaña)
    if show_topography and topo_data is not None:
        fig.add_trace(go.Surface(
            x=topo_data['gx'],
            y=topo_data['gy'],
            z=topo_data['grid_z'],
            name="Topografía Rajo (Terreno)",
            colorscale='Earth',
            cmin=topo_data['z_min'],
            cmax=topo_data['z_max'],
            opacity=float(topo_opacity),
            showscale=False,
            contours_z=dict(
                show=True,
                usecolormap=False,
                project_z=False,
                color='#94a3b8' if is_dark else '#475569',
                size=50,
                width=1
            ),
            hoverinfo='skip'
        ))

    # Calcular min y max del elemento para escala de color unificada
    all_vals = []
    for h_df in spatial_datasets.values():
        if color_by in h_df.columns:
            v = pd.to_numeric(h_df[color_by], errors='coerce').dropna()
            if not v.empty:
                all_vals.extend(v.values)

    c_min = float(np.percentile(all_vals, 2)) if all_vals else 0.0
    c_max = float(np.percentile(all_vals, 98)) if all_vals else 1.0
    if c_min == c_max:
        c_max = c_min + 1.0

    # Extraer símbolo y unidad estándar del catálogo
    base_sym = color_by.replace('_Cut', '').replace('_Pulp', '').strip()
    cat_entry = ELEMENT_CATALOG.get(base_sym, {})
    elem_name = cat_entry.get('name', base_sym)
    val_unit = cat_entry.get('unit', '%')
    source_tag = 'Cutting (Terreno)' if color_by.endswith('_Cut') else ('Pulpa (Lab)' if color_by.endswith('_Pulp') else '')
    title_elem_desc = f"{base_sym} [{elem_name}] — {source_tag}"

    first_hole = list(spatial_datasets.keys())[0] if spatial_datasets else None

    for h_id, df_h in spatial_datasets.items():
        if df_h.empty or 'Mid_X' not in df_h.columns:
            continue

        sub = df_h.copy()
        if elev_range is not None:
            sub = sub[(sub['Mid_Z'] >= elev_range[0]) & (sub['Mid_Z'] <= elev_range[1])]
            if sub.empty:
                continue

        is_selected = (h_id == selected_hole)
        line_width = 7 if is_selected else 3.5

        # Valores químicos para colorear
        vals = pd.to_numeric(sub[color_by], errors='coerce') if color_by in sub.columns else pd.Series([0.0]*len(sub))

        # Barra de color en la primera traza o traza seleccionada
        attach_colorbar = (is_selected or h_id == first_hole)
        cb_dict = dict(
            title=dict(
                text=f"<b>Ley {base_sym}</b><br>({val_unit})",
                font=dict(color=text_color, size=12)
            ),
            x=1.06,
            len=0.70,
            thickness=16,
            tickfont=dict(color=text_color, size=10)
        ) if attach_colorbar else None

        fig.add_trace(go.Scatter3d(
            x=sub['Mid_X'],
            y=sub['Mid_Y'],
            z=sub['Mid_Z'],
            mode='lines+markers',
            name=f"{h_id}" + (" (⭐ Activo)" if is_selected else ""),
            showlegend=show_legend,
            line=dict(
                color=vals,
                colorscale='Turbo',
                cmin=c_min,
                cmax=c_max,
                width=line_width,
                colorbar=cb_dict
            ),
            marker=dict(
                size=4.5 if is_selected else 2.5,
                color=vals,
                colorscale='Turbo',
                cmin=c_min,
                cmax=c_max
            ),
            text=sub['From'].astype(str) + " - " + sub['To'].astype(str) + "m",
            hovertemplate=(
                f"<b>Sondaje: {h_id}</b><br>"
                "Tramo: %{text}<br>"
                f"{base_sym} ({source_tag}): %{{marker.color:.4f}} {val_unit}<br>"
                "Este (X): %{x:,.1f} m<br>"
                "Norte (Y): %{y:,.1f} m<br>"
                "Cota (Z): %{z:,.1f} m.s.n.m."
                "<extra></extra>"
            )
        ))

    fig.update_layout(
        title=dict(
            text=f"🌐 Visor 3D de Sondajes — Ley {title_elem_desc}" + (" + Topografía Rajo" if (show_topography and topo_data) else ""),
            font=dict(size=17, color=text_color)
        ),
        scene=dict(
            xaxis=dict(title="Este (X) [m]", backgroundcolor=bg_color, gridcolor=grid_color, showbackground=True),
            yaxis=dict(title="Norte (Y) [m]", backgroundcolor=bg_color, gridcolor=grid_color, showbackground=True),
            zaxis=dict(title="Cota (Z) [m.s.n.m.]", backgroundcolor=bg_color, gridcolor=grid_color, showbackground=True),
            aspectmode='data',
            camera=dict(
                eye=dict(x=1.4, y=-1.4, z=1.1)
            )
        ),
        # LEYENDA UBICADA A LA IZQUIERDA PARA EVITAR CHOQUE CON LA BARRA DE COLOR
        legend=dict(
            x=0.01,
            y=0.98,
            xanchor='left',
            yanchor='top',
            bgcolor='rgba(15,23,42,0.75)' if is_dark else 'rgba(255,255,255,0.85)',
            bordercolor=grid_color,
            borderwidth=1,
            font=dict(size=10, color=text_color)
        ),
        paper_bgcolor=paper_color,
        font=dict(color=text_color),
        height=750,
        margin=dict(l=10, r=90, t=50, b=20)
    )

    return fig
