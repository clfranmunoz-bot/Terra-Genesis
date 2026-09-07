"""
Módulo de Visualización Espacial 2D y 3D para Sondajes Mineros.
Genera mapas interactivos de collares en planta y visores tridimensionales con Plotly.
"""
import numpy as np
import pandas as pd
import plotly.graph_objects as go
from typing import Dict, List, Optional, Any, Tuple


def plot_collar_map_2d(df_collars: pd.DataFrame, selected_hole: Optional[str] = None, theme: str = 'dark') -> go.Figure:
    """
    Genera un mapa en planta interactivo (Este vs Norte) con la ubicación de todos los collares.
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

    fases = sorted(df_collars['Fase'].unique())
    colors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#84cc16']

    for idx, fase in enumerate(fases):
        sub = df_collars[df_collars['Fase'] == fase]
        fig.add_trace(go.Scatter(
            x=sub['East'],
            y=sub['North'],
            mode='markers+text',
            name=f"{fase} ({len(sub)})",
            text=sub['Hole_ID'],
            textposition='top center',
            textfont=dict(size=9, color=text_color),
            marker=dict(
                size=8,
                color=colors[idx % len(colors)],
                line=dict(width=1, color='#ffffff' if is_dark else '#000000')
            ),
            hovertemplate=(
                "<b>%{text}</b><br>"
                "Fase: " + fase + "<br>"
                "Este: %{x:,.1f} m<br>"
                "Norte: %{y:,.1f} m<br>"
                "Cota: %{customdata[0]:,.1f} m.s.n.m.<br>"
                "Inclinación: %{customdata[1]:.1f}° | Azimut: %{customdata[2]:.1f}°<br>"
                "Profundidad: %{customdata[3]:.1f} m"
                "<extra></extra>"
            ),
            customdata=sub[['Elevation', 'Dip', 'Azimuth', 'Total_Depth']].values
        ))

    # Resaltar pozo seleccionado si aplica
    if selected_hole and selected_hole in df_collars['Hole_ID'].values:
        sel_row = df_collars[df_collars['Hole_ID'] == selected_hole].iloc[0]
        fig.add_trace(go.Scatter(
            x=[sel_row['East']],
            y=[sel_row['North']],
            mode='markers',
            name=f"⭐ Activo: {selected_hole}",
            marker=dict(
                size=18,
                color='#ef4444',
                symbol='star',
                line=dict(width=2, color='#ffffff')
            ),
            hoverinfo='skip'
        ))

    fig.update_layout(
        title=dict(
            text=f"🗺️ Distribución Espacial de Sondajes en Planta (Total: {len(df_collars)} Collares)",
            font=dict(size=18, color=text_color)
        ),
        xaxis=dict(
            title="Coordenada Este (m)",
            gridcolor=grid_color,
            zeroline=False,
            scaleanchor="y",
            scaleratio=1
        ),
        yaxis=dict(
            title="Coordenada Norte (m)",
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
            bgcolor='rgba(0,0,0,0.2)' if is_dark else 'rgba(255,255,255,0.8)'
        ),
        height=620,
        margin=dict(l=60, r=40, t=80, b=50)
    )

    return fig


def plot_drillholes_3d(spatial_datasets: Dict[str, pd.DataFrame],
                       color_by: str = 'Cu_Cut',
                       selected_hole: Optional[str] = None,
                       elev_range: Optional[Tuple[float, float]] = None,
                       theme: str = 'dark') -> go.Figure:
    """
    Genera un visor 3D interactivo en Plotly con las trayectorias reales de los sondajes
    y las concentraciones químicas coloreadas a lo largo de cada intervalo.
    """
    fig = go.Figure()
    if not spatial_datasets:
        fig.add_annotation(text="No hay datos espaciales 3D disponibles", showarrow=False, font=dict(size=16))
        return fig

    is_dark = (theme != 'light')
    bg_color = '#0e1117' if is_dark else '#ffffff'
    paper_color = '#0e1117' if is_dark else '#f8fafc'
    grid_color = '#334155' if is_dark else '#e2e8f0'
    text_color = '#f8fafc' if is_dark else '#0f172a'

    # Calcular min y max del elemento para escala de color unificada
    all_vals = []
    for h_df in spatial_datasets.values():
        if color_by in h_df.columns:
            v = pd.to_numeric(h_df[color_by], errors='coerce').dropna()
            if not v.empty:
                all_vals.extend(v.values)

    c_min = float(np.percentile(all_vals, 2)) if all_vals else 0.0
    c_max = float(np.percentile(all_vals, 98)) if all_vals else 1.0

    # Determinar si el elemento es ppm o %
    is_ppm = ('ppm' in color_by.lower() or 'mo' in color_by.lower() or 'as' in color_by.lower())
    val_unit = 'ppm' if is_ppm else '%'
    elem_label = color_by.replace('_Cut', ' (CT)').replace('_Pulp', ' (PP)')

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

        fig.add_trace(go.Scatter3d(
            x=sub['Mid_X'],
            y=sub['Mid_Y'],
            z=sub['Mid_Z'],
            mode='lines+markers',
            name=f"{h_id}" + (" (⭐ Activo)" if is_selected else ""),
            line=dict(
                color=vals,
                colorscale='Turbo',
                cmin=c_min,
                cmax=c_max,
                width=line_width,
                colorbar=dict(
                    title=dict(text=f"Ley {elem_label} [{val_unit}]", font=dict(color=text_color)),
                    x=1.02,
                    len=0.75,
                    thickness=18
                ) if (is_selected or h_id == list(spatial_datasets.keys())[0]) else None
            ),
            marker=dict(
                size=4 if is_selected else 2,
                color=vals,
                colorscale='Turbo',
                cmin=c_min,
                cmax=c_max
            ),
            text=sub['From'].astype(str) + " - " + sub['To'].astype(str) + "m",
            hovertemplate=(
                f"<b>Sondaje: {h_id}</b><br>"
                "Tramo: %{text}<br>"
                f"{elem_label}: %{{marker.color:.3f}} {val_unit}<br>"
                "Este (X): %{x:,.1f} m<br>"
                "Norte (Y): %{y:,.1f} m<br>"
                "Cota (Z): %{z:,.1f} m.s.n.m."
                "<extra></extra>"
            )
        ))

    fig.update_layout(
        title=dict(
            text=f"🌐 Visor 3D de Sondajes & Distribución de Ley ({elem_label})",
            font=dict(size=18, color=text_color)
        ),
        scene=dict(
            xaxis=dict(title="Este (X) [m]", backgroundcolor=bg_color, gridcolor=grid_color, showbackground=True),
            yaxis=dict(title="Norte (Y) [m]", backgroundcolor=bg_color, gridcolor=grid_color, showbackground=True),
            zaxis=dict(title="Cota (Z) [m.s.n.m.]", backgroundcolor=bg_color, gridcolor=grid_color, showbackground=True),
            aspectmode='data',
            camera=dict(
                eye=dict(x=1.5, y=-1.5, z=1.2)
            )
        ),
        paper_bgcolor=paper_color,
        font=dict(color=text_color),
        height=750,
        margin=dict(l=20, r=20, t=50, b=20)
    )

    return fig