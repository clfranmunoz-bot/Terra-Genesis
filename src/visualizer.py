"""
Módulo de Visualización Interactiva Geológica con Plotly.
"""
import numpy as np
import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from typing import Dict, Any, Optional

from src.config import ELEMENT_CATALOG

__all__ = [
    'plot_downhole_profile',
    'plot_multi_track_downhole',
    'plot_two_elements_overlay',
    'plot_scatter_1to1',
    'plot_multi_scatter_grid',
    'plot_cross_element_correlation',
    'plot_bland_altman',
    'plot_hard_cumulative',
    'plot_multielement_overview',
    'render_sticky_ruler_html',
    'render_sticky_multitrack_html',
    'get_element_unit',
    'get_theme_layout_params',
    'apply_figure_theme'
]

def get_element_unit(element: str) -> str:
    """Retorna la unidad del elemento según el catálogo."""
    return ELEMENT_CATALOG.get(element, {}).get('unit', '%')


def get_theme_layout_params(theme: str = 'light') -> Dict[str, Any]:
    """
    Retorna la paleta y configuración de layout de Plotly adaptada al tema ('light' o 'dark').
    En modo 'light', garantiza un fondo 100% blanco puro (#ffffff) sin ningún recuadro o matiz gris,
    con tipografía de máximo contraste (#0f172a) para títulos, ejes y marcas numéricas.
    """
    if theme == 'dark':
        return {
            'template': 'plotly_dark',
            'paper_bgcolor': 'rgba(0, 0, 0, 0)',
            'plot_bgcolor': 'rgba(15, 23, 42, 0.45)',
            'font_color': '#f1f5f9',
            'title_color': '#f8fafc',
            'grid_color': 'rgba(255, 255, 255, 0.10)',
            'zeroline_color': 'rgba(255, 255, 255, 0.25)',
            'line_ref_color': 'rgba(255, 255, 255, 0.40)',
            'line_1to1_color': '#cbd5e1',
            'legend_bg': 'rgba(15, 23, 42, 0.90)',
            'legend_border': 'rgba(255, 255, 255, 0.20)',
            'legend_font_color': '#f1f5f9',
            'card_bg': 'rgba(15, 23, 42, 0.90)',
            'card_border': 'rgba(255, 255, 255, 0.20)',
            'card_font_color': '#f1f5f9',
            'axis_title_color': '#f8fafc',
            'axis_tick_color': '#cbd5e1',
        }
    else:
        return {
            'template': 'plotly_white',
            'paper_bgcolor': '#ffffff',
            'plot_bgcolor': '#ffffff',
            'font_color': '#0f172a',
            'title_color': '#0f172a',
            'grid_color': 'rgba(0, 0, 0, 0.08)',
            'zeroline_color': 'rgba(0, 0, 0, 0.25)',
            'line_ref_color': 'rgba(0, 0, 0, 0.35)',
            'line_1to1_color': '#0f172a',
            'legend_bg': 'rgba(255, 255, 255, 0.96)',
            'legend_border': 'rgba(0, 0, 0, 0.20)',
            'legend_font_color': '#0f172a',
            'card_bg': '#ffffff',
            'card_border': 'rgba(0, 0, 0, 0.15)',
            'card_font_color': '#0f172a',
            'axis_title_color': '#0f172a',
            'axis_tick_color': '#0f172a',
        }


def apply_figure_theme(fig: go.Figure, t: Dict[str, Any]):
    """
    Aplica rigurosamente la paleta de colores y estilos en todos los ejes,
    títulos y marcas de un gráfico de Plotly para garantizar legibilidad 100%
    incluso si Streamlit se encuentra en Modo Oscuro y el gráfico en Modo Claro.
    """
    fig.update_layout(
        template=t['template'],
        paper_bgcolor=t['paper_bgcolor'],
        plot_bgcolor=t['plot_bgcolor'],
        font=dict(
            family='-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            color=t['font_color'],
            size=12
        ),
    )
    fig.update_xaxes(
        color=t['axis_tick_color'],
        tickfont=dict(color=t['axis_tick_color'], size=11),
        title_font=dict(color=t['axis_title_color'], size=12),
        gridcolor=t['grid_color'],
        zerolinecolor=t['zeroline_color']
    )
    fig.update_yaxes(
        color=t['axis_tick_color'],
        tickfont=dict(color=t['axis_tick_color'], size=11),
        title_font=dict(color=t['axis_title_color'], size=12),
        gridcolor=t['grid_color'],
        zerolinecolor=t['zeroline_color']
    )


def plot_downhole_profile(df: pd.DataFrame,
                          element: str,
                          hole_id: str,
                          unit: Optional[str] = None,
                          height: int = 750,
                          orientation: str = 'vertical',
                          color_pulp: str = '#1f77b4',
                          color_cut: str = '#ff7f0e',
                          dash_pulp: str = 'solid',
                          dash_cut: str = 'solid',
                          width_pulp: float = 2.5,
                          width_cut: float = 2.0,
                          plot_mode: str = 'lines+markers',
                          marker_size: int = 4,
                          theme: str = 'light') -> go.Figure:
    """
    Genera un perfil de sondaje comparativo de FRX (Pulpa vs Cutting).
    Soporta orientación 'vertical' (pozo abajo) y 'horizontal' (a lo largo del pozo).
    Utiliza colores, estilos de línea (continua, punteada, segmentada) y grosores configurables.
    """
    if unit is None:
        unit = get_element_unit(element)

    p_col = f"{element}_Pulp"
    c_col = f"{element}_Cut"
    d_col = f"{element}_Diff_Abs"

    has_pulp = p_col in df.columns
    has_cut = c_col in df.columns
    is_paired = has_pulp and has_cut and (d_col in df.columns)

    cols_to_sub = ['From', 'To', 'Punto_Medio_m']
    if has_pulp:
        cols_to_sub.append(p_col)
    if has_cut:
        cols_to_sub.append(c_col)
    if is_paired:
        cols_to_sub.append(d_col)

    sub = df[cols_to_sub].dropna(subset=['From', 'To']).copy()
    sub = sub.sort_values(by='From')

    colors_diff = [color_cut if v >= 0 else color_pulp for v in sub[d_col]] if is_paired else []
    t = get_theme_layout_params(theme)

    if orientation == 'horizontal':
        # --- MODO HORIZONTAL (A lo largo del pozo) ---
        if is_paired:
            fig = make_subplots(
                rows=2, cols=1,
                shared_xaxes=True,
                row_heights=[0.70, 0.30],
                vertical_spacing=0.08
            )

            # 1. Curvas de Ley (Fila 1)
            fig.add_trace(
                go.Scatter(
                    x=sub['Punto_Medio_m'],
                    y=sub[p_col],
                    mode=plot_mode,
                    name='Pulpa (Referencia)',
                    line=dict(color=color_pulp, width=width_pulp, dash=dash_pulp),
                    marker=dict(size=marker_size, color=color_pulp, symbol='circle'),
                    hovertemplate=(
                        f"<b>Pulpa</b><br>"
                        f"Profundidad: %{{x:.1f}}m (Tramo: %{{customdata[0]:.1f}}-%{{customdata[1]:.1f}}m)<br>"
                        f"Ley: %{{y:.4f}} {unit}<extra></extra>"
                    ),
                    customdata=sub[['From', 'To']].values
                ),
                row=1, col=1
            )

            fig.add_trace(
                go.Scatter(
                    x=sub['Punto_Medio_m'],
                    y=sub[c_col],
                    mode=plot_mode,
                    name='Cutting (FRX)',
                    line=dict(color=color_cut, width=width_cut, dash=dash_cut),
                    marker=dict(size=marker_size, color=color_cut, symbol='square'),
                    hovertemplate=(
                        f"<b>Cutting</b><br>"
                        f"Profundidad: %{{x:.1f}}m (Tramo: %{{customdata[0]:.1f}}-%{{customdata[1]:.1f}}m)<br>"
                        f"Ley: %{{y:.4f}} {unit}<extra></extra>"
                    ),
                    customdata=sub[['From', 'To']].values
                ),
                row=1, col=1
            )

            # 2. Barras de Diferencia Verticales (Fila 2)
            fig.add_trace(
                go.Bar(
                    x=sub['Punto_Medio_m'],
                    y=sub[d_col],
                    name='Δ (Cut - Pulp)',
                    marker=dict(color=colors_diff),
                    hovertemplate=(
                        f"<b>Diferencia</b><br>"
                        f"Profundidad: %{{x:.1f}}m<br>"
                        f"Δ: %{{y:+.4f}} {unit}<extra></extra>"
                    ),
                    customdata=sub[['From', 'To']].values
                ),
                row=2, col=1
            )

            fig.add_hline(y=0, line_width=1, line_dash='dash', line_color=t['line_ref_color'], row=2, col=1)

            x_min = max(0.0, float(sub['From'].min()))
            x_max = float(sub['To'].max())
            fig.update_yaxes(title_text=f"Ley {element} ({unit})", row=1, col=1)
            fig.update_yaxes(title_text=f"Δ ({unit})", row=2, col=1)
            fig.update_xaxes(range=[x_min, x_max], row=1, col=1)
            fig.update_xaxes(
                title_text="Profundidad a lo largo del pozo (m)",
                range=[x_min, x_max],
                rangeslider=dict(visible=False),
                row=2, col=1
            )
        else:
            fig = go.Figure()
            if has_pulp:
                fig.add_trace(
                    go.Scatter(
                        x=sub['Punto_Medio_m'],
                        y=sub[p_col],
                        mode=plot_mode,
                        name='Pulpa (Referencia)',
                        line=dict(color=color_pulp, width=width_pulp, dash=dash_pulp),
                        marker=dict(size=marker_size, color=color_pulp, symbol='circle'),
                        hovertemplate=(
                            f"<b>Pulpa</b><br>"
                            f"Profundidad: %{{x:.1f}}m (Tramo: %{{customdata[0]:.1f}}-%{{customdata[1]:.1f}}m)<br>"
                            f"Ley: %{{y:.4f}} {unit}<extra></extra>"
                        ),
                        customdata=sub[['From', 'To']].values
                    )
                )
            if has_cut:
                fig.add_trace(
                    go.Scatter(
                        x=sub['Punto_Medio_m'],
                        y=sub[c_col],
                        mode=plot_mode,
                        name='Cutting (FRX)',
                        line=dict(color=color_cut, width=width_cut, dash=dash_cut),
                        marker=dict(size=marker_size, color=color_cut, symbol='square'),
                        hovertemplate=(
                            f"<b>Cutting</b><br>"
                            f"Profundidad: %{{x:.1f}}m (Tramo: %{{customdata[0]:.1f}}-%{{customdata[1]:.1f}}m)<br>"
                            f"Ley: %{{y:.4f}} {unit}<extra></extra>"
                        ),
                        customdata=sub[['From', 'To']].values
                    )
                )
            x_min = max(0.0, float(sub['From'].min()))
            x_max = float(sub['To'].max())
            fig.update_yaxes(title_text=f"Ley {element} ({unit})")
            fig.update_xaxes(
                title_text="Profundidad a lo largo del pozo (m)",
                range=[x_min, x_max],
                rangeslider=dict(visible=False)
            )

    else:
        # --- MODO VERTICAL ---
        if is_paired:
            fig = make_subplots(
                rows=1, cols=2,
                shared_yaxes=True,
                column_widths=[0.70, 0.30],
                horizontal_spacing=0.05
            )

            # 1. Curva Pulpa
            fig.add_trace(
                go.Scatter(
                    x=sub[p_col],
                    y=sub['Punto_Medio_m'],
                    mode=plot_mode,
                    name='Pulpa (Referencia)',
                    line=dict(color=color_pulp, width=width_pulp, dash=dash_pulp),
                    marker=dict(size=marker_size, color=color_pulp, symbol='circle'),
                    hovertemplate=(
                        f"<b>Pulpa</b><br>"
                        f"Tramo: %{{customdata[0]:.1f}}m - %{{customdata[1]:.1f}}m<br>"
                        f"Ley: %{{x:.4f}} {unit}<extra></extra>"
                    ),
                    customdata=sub[['From', 'To']].values
                ),
                row=1, col=1
            )

            # 2. Curva Cutting
            fig.add_trace(
                go.Scatter(
                    x=sub[c_col],
                    y=sub['Punto_Medio_m'],
                    mode=plot_mode,
                    name='Cutting (FRX)',
                    line=dict(color=color_cut, width=width_cut, dash=dash_cut),
                    marker=dict(size=marker_size, color=color_cut, symbol='square'),
                    hovertemplate=(
                        f"<b>Cutting</b><br>"
                        f"Tramo: %{{customdata[0]:.1f}}m - %{{customdata[1]:.1f}}m<br>"
                        f"Ley: %{{x:.4f}} {unit}<extra></extra>"
                    ),
                    customdata=sub[['From', 'To']].values
                ),
                row=1, col=1
            )

            # 3. Barras de Diferencia en Panel 2 (Colores unificados)
            fig.add_trace(
                go.Bar(
                    x=sub[d_col],
                    y=sub['Punto_Medio_m'],
                    orientation='h',
                    name='Δ (Cut - Pulp)',
                    marker=dict(color=colors_diff),
                    hovertemplate=(
                        f"<b>Diferencia</b><br>"
                        f"Tramo: %{{customdata[0]:.1f}}m - %{{customdata[1]:.1f}}m<br>"
                        f"Δ: %{{x:+.4f}} {unit}<extra></extra>"
                    ),
                    customdata=sub[['From', 'To']].values
                ),
                row=1, col=2
            )

            # Línea cero en diferencia
            fig.add_vline(x=0, line_width=1, line_dash='dash', line_color=t['line_ref_color'], row=1, col=2)

            # Invertir eje Y (profundidad geológica con rango explícito para Home)
            y_min = max(0.0, float(sub['From'].min()))
            y_max = float(sub['To'].max())
            fig.update_yaxes(range=[y_max, y_min], autorange='reversed')
            fig.update_yaxes(title_text="Profundidad (m)", row=1, col=1)

            # Ejes X superiores con espaciado garantizado anti-solapamiento
            fig.update_xaxes(
                title_text=f"<b>Ley {element} ({unit})</b>",
                side='top',
                title_standoff=14,
                mirror='ticks',
                row=1, col=1
            )
            fig.update_xaxes(
                title_text=f"<b>Δ (Cut - Pulp) ({unit})</b>",
                side='top',
                title_standoff=14,
                mirror='ticks',
                row=1, col=2
            )
        else:
            fig = go.Figure()
            if has_pulp:
                fig.add_trace(
                    go.Scatter(
                        x=sub[p_col],
                        y=sub['Punto_Medio_m'],
                        mode=plot_mode,
                        name='Pulpa (Referencia)',
                        line=dict(color=color_pulp, width=width_pulp, dash=dash_pulp),
                        marker=dict(size=marker_size, color=color_pulp, symbol='circle'),
                        hovertemplate=(
                            f"<b>Pulpa</b><br>"
                            f"Tramo: %{{customdata[0]:.1f}}m - %{{customdata[1]:.1f}}m<br>"
                            f"Ley: %{{x:.4f}} {unit}<extra></extra>"
                        ),
                        customdata=sub[['From', 'To']].values
                    )
                )
            if has_cut:
                fig.add_trace(
                    go.Scatter(
                        x=sub[c_col],
                        y=sub['Punto_Medio_m'],
                        mode=plot_mode,
                        name='Cutting (FRX)',
                        line=dict(color=color_cut, width=width_cut, dash=dash_cut),
                        marker=dict(size=marker_size, color=color_cut, symbol='square'),
                        hovertemplate=(
                            f"<b>Cutting</b><br>"
                            f"Tramo: %{{customdata[0]:.1f}}m - %{{customdata[1]:.1f}}m<br>"
                            f"Ley: %{{x:.4f}} {unit}<extra></extra>"
                        ),
                        customdata=sub[['From', 'To']].values
                    )
                )
            y_min = max(0.0, float(sub['From'].min()))
            y_max = float(sub['To'].max())
            fig.update_yaxes(range=[y_max, y_min], autorange='reversed', title_text="Profundidad (m)")
            fig.update_xaxes(
                title_text=f"<b>Ley {element} ({unit})</b>",
                side='top',
                title_standoff=14,
                mirror='ticks'
            )

    # Layout unificado con separación de dos filas (Título arriba, Leyenda debajo)
    sub_title_text = "Vertical" if orientation == 'vertical' else "Horizontal"
    if orientation == 'horizontal':
        if height <= 320:
            margin_t = 65
            margin_b = 35
            legend_y = 1.05
        elif height <= 420:
            margin_t = 75
            margin_b = 40
            legend_y = 1.04
        else:
            margin_t = 95
            margin_b = 45
            legend_y = 1.03
    else:
        margin_t = 125
        margin_b = 45
        legend_y = 1.09

    fig.update_layout(
        title=dict(
            text=f"<b>Sondaje {hole_id}</b> — Perfil {sub_title_text} ({element})",
            x=0.01,
            y=0.98,
            xanchor='left',
            yanchor='top',
            yref='container',
            xref='container',
            font=dict(size=14, color=t['title_color'])
        ),
        margin=dict(t=margin_t, b=margin_b, l=65, r=45),
        template=t['template'],
        paper_bgcolor=t['paper_bgcolor'],
        plot_bgcolor=t['plot_bgcolor'],
        hovermode='closest',
        height=height,
        font=dict(color=t['font_color']),
        legend=dict(
            orientation='h',
            x=0.5,
            y=legend_y,
            xanchor='center',
            yanchor='bottom',
            bgcolor=t['legend_bg'],
            bordercolor=t['legend_border'],
            borderwidth=1,
            font=dict(size=11, color=t['legend_font_color'])
        )
    )

    apply_figure_theme(fig, t)

    return fig


def plot_multi_track_downhole(df: pd.DataFrame,
                              elements: list,
                              hole_id: str,
                              height: int = 750,
                              orientation: str = 'vertical',
                              color_pulp: str = '#1f77b4',
                              color_cut: str = '#ff7f0e',
                              dash_pulp: str = 'solid',
                              dash_cut: str = 'solid',
                              width_pulp: float = 2.0,
                              width_cut: float = 1.8,
                              plot_mode: str = 'lines+markers',
                              marker_size: int = 4,
                              theme: str = 'light') -> go.Figure:
    """
    Genera un perfil multi-track con múltiples elementos sincronizados.
    Soporta orientación 'vertical' (columnas paralelas estilo WellCAD) y 'horizontal' (filas apiladas con rangeslider).
    Garantiza separación anti-colisión en el eje X, compatibilidad visual con modo oscuro y estilos de línea configurables.
    """
    if not elements:
        elements = ['Cu', 'Mo']

    n_elem = len(elements)
    t = get_theme_layout_params(theme)

    if orientation == 'horizontal':
        # --- MODO HORIZONTAL (Filas apiladas con eje X común de Profundidad) ---
        fig = make_subplots(
            rows=n_elem, cols=1,
            shared_xaxes=True,
            vertical_spacing=max(0.03, 0.10 / n_elem)
        )

        for idx, el in enumerate(elements, start=1):
            unit = get_element_unit(el)
            p_col = f"{el}_Pulp"
            c_col = f"{el}_Cut"

            has_p = p_col in df.columns
            has_c = c_col in df.columns
            if not has_p and not has_c:
                continue

            cols_sub = ['From', 'To', 'Punto_Medio_m']
            if has_p:
                cols_sub.append(p_col)
            if has_c:
                cols_sub.append(c_col)

            sub = df[cols_sub].dropna(subset=['From', 'To']).copy()
            sub = sub.sort_values(by='From')
            show_leg = (idx == 1)

            # 1. Curva Pulpa
            if has_p:
                fig.add_trace(
                    go.Scatter(
                        x=sub['Punto_Medio_m'],
                        y=sub[p_col],
                        mode=plot_mode,
                        name='Pulpa (Ref)',
                        line=dict(color=color_pulp, width=width_pulp, dash=dash_pulp),
                        marker=dict(size=marker_size, color=color_pulp),
                        showlegend=show_leg,
                        hovertemplate=(
                            f"<b>{el} (Pulpa)</b><br>"
                            f"Profundidad: %{{x:.1f}}m (Tramo: %{{customdata[0]:.1f}}-%{{customdata[1]:.1f}}m)<br>"
                            f"Ley: %{{y:.4f}} {unit}<extra></extra>"
                        ),
                        customdata=sub[['From', 'To']].values
                    ),
                    row=idx, col=1
                )

            # 2. Curva Cutting
            if has_c:
                fig.add_trace(
                    go.Scatter(
                        x=sub['Punto_Medio_m'],
                        y=sub[c_col],
                        mode=plot_mode,
                        name='Cutting (FRX)',
                        line=dict(color=color_cut, width=width_cut, dash=dash_cut),
                        marker=dict(size=marker_size, color=color_cut, symbol='square'),
                        showlegend=show_leg,
                        hovertemplate=(
                            f"<b>{el} (Cutting)</b><br>"
                            f"Profundidad: %{{x:.1f}}m (Tramo: %{{customdata[0]:.1f}}-%{{customdata[1]:.1f}}m)<br>"
                            f"Ley: %{{y:.4f}} {unit}<extra></extra>"
                        ),
                        customdata=sub[['From', 'To']].values
                    ),
                    row=idx, col=1
                )

            fig.update_yaxes(title_text=f"<b>{el}</b> ({unit})", row=idx, col=1)

        # Habilitar rangeslider en la última fila
        fig.update_xaxes(
            title_text="Profundidad a lo largo del pozo (m)",
            rangeslider=dict(visible=False),
            row=n_elem, col=1
        )

    else:
        # --- MODO VERTICAL (Columnas paralelas clásicas) ---
        fig = make_subplots(
            rows=1, cols=n_elem,
            shared_yaxes=True,
            horizontal_spacing=max(0.02, 0.12 / n_elem)
        )

        for idx, el in enumerate(elements, start=1):
            unit = get_element_unit(el)
            p_col = f"{el}_Pulp"
            c_col = f"{el}_Cut"

            has_p = p_col in df.columns
            has_c = c_col in df.columns
            if not has_p and not has_c:
                continue

            cols_sub = ['From', 'To', 'Punto_Medio_m']
            if has_p:
                cols_sub.append(p_col)
            if has_c:
                cols_sub.append(c_col)

            sub = df[cols_sub].dropna(subset=['From', 'To']).copy()
            sub = sub.sort_values(by='From')
            show_leg = (idx == 1)

            # 1. Curva Pulpa
            if has_p:
                fig.add_trace(
                    go.Scatter(
                        x=sub[p_col],
                        y=sub['Punto_Medio_m'],
                        mode=plot_mode,
                        name='Pulpa (Ref)',
                        line=dict(color=color_pulp, width=width_pulp, dash=dash_pulp),
                        marker=dict(size=marker_size, color=color_pulp),
                        showlegend=show_leg,
                        hovertemplate=(
                            f"<b>{el} (Pulpa)</b><br>"
                            f"Tramo: %{{customdata[0]:.1f}}m - %{{customdata[1]:.1f}}m<br>"
                            f"Ley: %{{x:.4f}} {unit}<extra></extra>"
                        ),
                        customdata=sub[['From', 'To']].values
                    ),
                    row=1, col=idx
                )

            # 2. Curva Cutting
            if has_c:
                fig.add_trace(
                    go.Scatter(
                        x=sub[c_col],
                        y=sub['Punto_Medio_m'],
                        mode=plot_mode,
                        name='Cutting (FRX)',
                        line=dict(color=color_cut, width=width_cut, dash=dash_cut),
                        marker=dict(size=marker_size, color=color_cut, symbol='square'),
                        showlegend=show_leg,
                        hovertemplate=(
                            f"<b>{el} (Cutting)</b><br>"
                            f"Tramo: %{{customdata[0]:.1f}}m - %{{customdata[1]:.1f}}m<br>"
                            f"Ley: %{{x:.4f}} {unit}<extra></extra>"
                        ),
                        customdata=sub[['From', 'To']].values
                    ),
                    row=1, col=idx
                )

            # Eje X superior con espaciado anti-solapamiento (sin subplots que colisionen)
            fig.update_xaxes(
                title_text=f"<b>{el} ({unit})</b>",
                side='top',
                title_standoff=14,
                mirror='ticks',
                row=1, col=idx
            )

        # Invertir eje Y (profundidad geológica)
        fig.update_yaxes(autorange='reversed')
        fig.update_yaxes(title_text="Profundidad (m)", row=1, col=1)

    title_elem_list = ', '.join(elements[:3]) + ('...' if len(elements) > 3 else '')
    sub_title_text = "Vertical" if orientation == 'vertical' else "Horizontal"
    margin_t = 125 if orientation == 'vertical' else 95
    legend_y = 1.09 if orientation == 'vertical' else 1.03

    fig.update_layout(
        title=dict(
            text=f"<b>Sondaje {hole_id}</b> — Multi-Elemento {sub_title_text} ({title_elem_list})",
            x=0.01,
            y=0.98,
            xanchor='left',
            yanchor='top',
            yref='container',
            xref='container',
            font=dict(size=14, color=t['title_color'])
        ),
        margin=dict(t=margin_t, b=45, l=65, r=45),
        template=t['template'],
        paper_bgcolor=t['paper_bgcolor'],
        plot_bgcolor=t['plot_bgcolor'],
        hovermode='closest',
        height=height,
        font=dict(color=t['font_color']),
        legend=dict(
            orientation='h',
            x=0.5,
            y=legend_y,
            xanchor='center',
            yanchor='bottom',
            bgcolor=t['legend_bg'],
            bordercolor=t['legend_border'],
            borderwidth=1,
            font=dict(size=11, color=t['legend_font_color'])
        )
    )

    apply_figure_theme(fig, t)

    return fig


def plot_two_elements_overlay(df: pd.DataFrame,
                              elem1: str,
                              elem2: str,
                              hole_id: str,
                              orientation: str = 'vertical',
                              height: int = 750,
                              color_pulp: str = '#1f77b4',
                              color_cut: str = '#ff7f0e',
                              color_e2_pulp: str = '#2ca02c',
                              color_e2_cut: str = '#d62728',
                              dash_pulp: str = 'solid',
                              dash_cut: str = 'solid',
                              dash_e2_pulp: str = 'solid',
                              dash_e2_cut: str = 'dot',
                              width_pulp: float = 2.5,
                              width_cut: float = 2.0,
                              width_e2_pulp: float = 2.5,
                              width_e2_cut: float = 2.0,
                              plot_mode: str = 'lines+markers',
                              marker_size: int = 4,
                              theme: str = 'light') -> go.Figure:
    """
    Superpone dos elementos (ej. Cu y Mo, o S y Ca) en el mismo perfil de profundidad
    usando doble eje (X1/X2 en vertical o Y1/Y2 en horizontal) para analizar zonamiento y co-ocurrencia.
    Soporta colores y estilos de línea totalmente configurables por el usuario.
    """
    unit1 = get_element_unit(elem1)
    unit2 = get_element_unit(elem2)

    req_cols = list(dict.fromkeys(['From', 'To', 'Punto_Medio_m', f"{elem1}_Pulp", f"{elem1}_Cut", f"{elem2}_Pulp", f"{elem2}_Cut"]))
    cols_to_use = [c for c in req_cols if c in df.columns]
    sub = df[cols_to_use].dropna(subset=['From', 'To']).copy()
    sub = sub.sort_values(by='From')

    t = get_theme_layout_params(theme)
    fig = go.Figure()

    c_e1_p = f"{elem1}_Pulp"
    c_e1_c = f"{elem1}_Cut"
    c_e2_p = f"{elem2}_Pulp"
    c_e2_c = f"{elem2}_Cut"

    if orientation == 'horizontal':
        # Eje X: Profundidad, Eje Y1 (izq): elem1, Eje Y2 (der): elem2
        if c_e1_p in sub.columns:
            fig.add_trace(go.Scatter(
                x=sub['Punto_Medio_m'],
                y=sub[c_e1_p],
                mode=plot_mode,
                name=f"{elem1} Pulpa",
                line=dict(color=color_pulp, width=width_pulp, dash=dash_pulp),
                marker=dict(size=marker_size, color=color_pulp),
                hovertemplate=f"<b>{elem1} Pulpa</b><br>Profundidad: %{{x:.1f}}m<br>Ley: %{{y:.4f}} {unit1}<extra></extra>",
                customdata=sub[['From', 'To']].values
            ))
        if c_e1_c in sub.columns:
            fig.add_trace(go.Scatter(
                x=sub['Punto_Medio_m'],
                y=sub[c_e1_c],
                mode=plot_mode,
                name=f"{elem1} Cutting",
                line=dict(color=color_cut, width=width_cut, dash=dash_cut),
                marker=dict(size=marker_size, color=color_cut, symbol='square'),
                hovertemplate=f"<b>{elem1} Cutting</b><br>Profundidad: %{{x:.1f}}m<br>Ley: %{{y:.4f}} {unit1}<extra></extra>",
                customdata=sub[['From', 'To']].values
            ))

        if c_e2_p in sub.columns:
            fig.add_trace(go.Scatter(
                x=sub['Punto_Medio_m'],
                y=sub[c_e2_p],
                mode=plot_mode,
                name=f"{elem2} Pulpa",
                line=dict(color=color_e2_pulp, width=width_e2_pulp, dash=dash_e2_pulp),
                marker=dict(size=marker_size, color=color_e2_pulp),
                yaxis='y2',
                hovertemplate=f"<b>{elem2} Pulpa</b><br>Profundidad: %{{x:.1f}}m<br>Ley: %{{y:.4f}} {unit2}<extra></extra>",
                customdata=sub[['From', 'To']].values
            ))
        if c_e2_c in sub.columns:
            fig.add_trace(go.Scatter(
                x=sub['Punto_Medio_m'],
                y=sub[c_e2_c],
                mode=plot_mode,
                name=f"{elem2} Cutting",
                line=dict(color=color_e2_cut, width=width_e2_cut, dash=dash_e2_cut),
                marker=dict(size=marker_size, color=color_e2_cut, symbol='diamond'),
                yaxis='y2',
                hovertemplate=f"<b>{elem2} Cutting</b><br>Profundidad: %{{x:.1f}}m<br>Ley: %{{y:.4f}} {unit2}<extra></extra>",
                customdata=sub[['From', 'To']].values
            ))

        fig.update_layout(
            xaxis=dict(
                title=dict(text="Profundidad a lo largo del pozo (m)", font=dict(color=t['axis_title_color'], size=12)),
                tickfont=dict(color=t['axis_tick_color'], size=11),
                color=t['axis_tick_color'],
                rangeslider=dict(visible=False),
                gridcolor=t['grid_color']
            ),
            yaxis=dict(
                title=dict(text=f"<b>{elem1} ({unit1})</b>", font=dict(color=color_pulp)),
                tickfont=dict(color=color_pulp),
                gridcolor=t['grid_color']
            ),
            yaxis2=dict(
                title=dict(text=f"<b>{elem2} ({unit2})</b>", font=dict(color=color_e2_pulp)),
                tickfont=dict(color=color_e2_pulp),
                overlaying='y',
                side='right',
                gridcolor=t['grid_color']
            )
        )
    else:
        # Modo Vertical: Eje Y Profundidad invertido, Eje X1 inferior elem1, Eje X2 superior elem2
        if c_e1_p in sub.columns:
            fig.add_trace(go.Scatter(
                x=sub[c_e1_p],
                y=sub['Punto_Medio_m'],
                mode=plot_mode,
                name=f"{elem1} Pulpa",
                line=dict(color=color_pulp, width=width_pulp, dash=dash_pulp),
                marker=dict(size=marker_size, color=color_pulp),
                hovertemplate=f"<b>{elem1} Pulpa:</b> %{{x:.4f}} {unit1}<extra></extra>"
            ))
        if c_e1_c in sub.columns:
            fig.add_trace(go.Scatter(
                x=sub[c_e1_c],
                y=sub['Punto_Medio_m'],
                mode=plot_mode,
                name=f"{elem1} Cutting",
                line=dict(color=color_cut, width=width_cut, dash=dash_cut),
                marker=dict(size=marker_size, color=color_cut, symbol='square'),
                hovertemplate=f"<b>{elem1} Cutting:</b> %{{x:.4f}} {unit1}<extra></extra>"
            ))

        if c_e2_p in sub.columns:
            fig.add_trace(go.Scatter(
                x=sub[c_e2_p],
                y=sub['Punto_Medio_m'],
                mode=plot_mode,
                name=f"{elem2} Pulpa",
                line=dict(color=color_e2_pulp, width=width_e2_pulp, dash=dash_e2_pulp),
                marker=dict(size=marker_size, color=color_e2_pulp),
                xaxis='x2',
                hovertemplate=f"<b>{elem2} Pulpa:</b> %{{x:.4f}} {unit2}<extra></extra>"
            ))
        if c_e2_c in sub.columns:
            fig.add_trace(go.Scatter(
                x=sub[c_e2_c],
                y=sub['Punto_Medio_m'],
                mode=plot_mode,
                name=f"{elem2} Cutting",
                line=dict(color=color_e2_cut, width=width_e2_cut, dash=dash_e2_cut),
                marker=dict(size=marker_size, color=color_e2_cut, symbol='diamond'),
                xaxis='x2',
                hovertemplate=f"<b>{elem2} Cutting:</b> %{{x:.4f}} {unit2}<extra></extra>"
            ))

        fig.update_layout(
            xaxis=dict(
                title=dict(text=f"<b>{elem1} ({unit1})</b>", font=dict(color=color_pulp)),
                tickfont=dict(color=color_pulp),
                gridcolor=t['grid_color']
            ),
            xaxis2=dict(
                title=dict(text=f"<b>{elem2} ({unit2})</b>", font=dict(color=color_e2_pulp)),
                tickfont=dict(color=color_e2_pulp),
                overlaying='x',
                side='top',
                title_standoff=14,
                gridcolor=t['grid_color']
            ),
            yaxis=dict(
                title=dict(text="Profundidad (m)", font=dict(color=t['axis_title_color'], size=12)),
                tickfont=dict(color=t['axis_tick_color'], size=11),
                color=t['axis_tick_color'],
                autorange='reversed',
                gridcolor=t['grid_color']
            )
        )

    sub_title_text = "Vertical" if orientation == 'vertical' else "Horizontal"
    if orientation == 'horizontal':
        if height <= 320:
            margin_t = 65
            margin_b = 35
            legend_y = 1.05
        elif height <= 420:
            margin_t = 75
            margin_b = 40
            legend_y = 1.04
        else:
            margin_t = 95
            margin_b = 45
            legend_y = 1.03
    else:
        margin_t = 125
        margin_b = 45
        legend_y = 1.09

    fig.update_layout(
        title=dict(
            text=f"<b>Sondaje {hole_id}</b> — Superposición {sub_title_text}: {elem1} vs. {elem2}",
            x=0.01,
            y=0.98,
            xanchor='left',
            yanchor='top',
            yref='container',
            xref='container',
            font=dict(size=14, color=t['title_color'])
        ),
        margin=dict(t=margin_t, b=margin_b, l=65, r=55),
        template=t['template'],
        paper_bgcolor=t['paper_bgcolor'],
        plot_bgcolor=t['plot_bgcolor'],
        hovermode='closest',
        height=height,
        font=dict(color=t['font_color']),
        legend=dict(
            orientation='h',
            x=0.5,
            y=legend_y,
            xanchor='center',
            yanchor='bottom',
            bgcolor=t['legend_bg'],
            bordercolor=t['legend_border'],
            borderwidth=1,
            font=dict(size=11, color=t['legend_font_color'])
        )
    )

    return fig


def plot_scatter_1to1(df: pd.DataFrame,
                      element: str,
                      stats_dict: Dict[str, Any],
                      unit: Optional[str] = None,
                      log_scale: bool = False,
                      color_pulp: str = '#1f77b4',
                      color_cut: str = '#ff7f0e',
                      theme: str = 'light') -> go.Figure:
    """
    Genera el gráfico de dispersión X-Y (1:1) con envolventes de tolerancia,
    regresión OLS y regresión RMA (Reduced Major Axis).
    Muestra la línea 1:1 en color Azul (Pulpa) y la RMA en color Naranjo (Cutting),
    e identifica en el cursor el tramo exacto de 2m de cada punto.
    """
    if unit is None:
        unit = get_element_unit(element)

    t = get_theme_layout_params(theme)

    p_col = f"{element}_Pulp"
    c_col = f"{element}_Cut"

    req_cols = [p_col, c_col, 'From', 'To']
    if 'Sondaje' in df.columns:
        req_cols.append('Sondaje')
    if 'Longitud_m' in df.columns:
        req_cols.append('Longitud_m')

    sub = df[[c for c in req_cols if c in df.columns]].dropna().copy()
    if log_scale:
        sub = sub[(sub[p_col] > 0) & (sub[c_col] > 0)]

    if 'Sondaje' not in sub.columns:
        sub['Sondaje'] = 'Sondaje'
    if 'Longitud_m' not in sub.columns:
        sub['Longitud_m'] = (sub['To'] - sub['From']).round(2)

    x = sub[p_col].values
    y = sub[c_col].values

    min_val = min(np.min(x), np.min(y)) if len(x) > 0 else 0
    max_val = max(np.max(x), np.max(y)) if len(x) > 0 else 1

    # Margen para las líneas
    line_x = np.linspace(min_val * 0.95 if not log_scale else min_val * 0.8,
                         max_val * 1.05, 100)

    fig = go.Figure()

    # Envolvente ±20%
    fig.add_trace(go.Scatter(
        x=line_x, y=line_x * 1.20,
        mode='lines', line=dict(color='rgba(180, 180, 180, 0.4)', dash='dot', width=1),
        name='+20%', showlegend=True
    ))
    fig.add_trace(go.Scatter(
        x=line_x, y=line_x * 0.80,
        mode='lines', line=dict(color='rgba(180, 180, 180, 0.4)', dash='dot', width=1),
        fill='tonexty', fillcolor='rgba(230, 240, 255, 0.25)',
        name='-20%', showlegend=True
    ))

    # Envolvente ±10%
    fig.add_trace(go.Scatter(
        x=line_x, y=line_x * 1.10,
        mode='lines', line=dict(color='rgba(130, 130, 130, 0.6)', dash='dash', width=1.2),
        name='+10%', showlegend=True
    ))
    fig.add_trace(go.Scatter(
        x=line_x, y=line_x * 0.90,
        mode='lines', line=dict(color='rgba(130, 130, 130, 0.6)', dash='dash', width=1.2),
        fill='tonexty', fillcolor='rgba(200, 220, 250, 0.35)',
        name='-10%', showlegend=True
    ))

    # Línea 1:1 Paridad Perfecta (Azul Pulpa Referencia)
    fig.add_trace(go.Scatter(
        x=line_x, y=line_x,
        mode='lines', line=dict(color=color_pulp, dash='dash', width=2.0),
        name='Línea 1:1 (Pulpa Ref)'
    ))

    # Regresión RMA (Naranjo Cutting Calibración)
    m_rma = stats_dict.get('slope_rma', 1.0)
    b_rma = stats_dict.get('intercept_rma', 0.0)
    y_rma = m_rma * line_x + b_rma
    fig.add_trace(go.Scatter(
        x=line_x, y=y_rma,
        mode='lines', line=dict(color=color_cut, width=2.5),
        name=f"Regresión RMA (Cutting): y = {m_rma:.3f}x {b_rma:+.3f}"
    ))

    # Puntos de dispersión con tramo de 2m en el cursor
    fig.add_trace(go.Scatter(
        x=x, y=y,
        mode='markers',
        marker=dict(size=6, color=color_cut, opacity=0.8, line=dict(width=0.8, color=color_pulp)),
        name='Muestras Pareadas',
        hovertemplate=(
            f"<b>Sondaje:</b> %{{customdata[0]}} ({element})<br>"
            f"<b>Tramo:</b> %{{customdata[1]:.1f}}m - %{{customdata[2]:.1f}}m (%{{customdata[3]:.1f}}m)<br>"
            f"<b>Pulpa (Lab):</b> %{{x:.4f}} {unit}<br>"
            f"<b>Cutting (FRX):</b> %{{y:.4f}} {unit}<extra></extra>"
        ),
        customdata=sub[['Sondaje', 'From', 'To', 'Longitud_m']].values
    ))

    # Caja de texto informativa QA/QC
    r2_val = stats_dict.get('r2', 0.0)
    bias_val = stats_dict.get('rel_bias_pct', 0.0)
    hard_10 = stats_dict.get('pct_hard_le_10', 0.0)
    n_pairs = stats_dict.get('n_pairs', len(x))

    annotation_text = (
        f"<b>Estadísticas QA/QC ({element})</b><br>"
        f"Pares (N): {n_pairs}<br>"
        f"R²: {r2_val:.4f}<br>"
        f"Sesgo Rel.: {bias_val:+.2f}%<br>"
        f"% HARD ≤ 10%: {hard_10:.1f}%<br>"
        f"Pendiente RMA: {m_rma:.3f}"
    )

    fig.add_annotation(
        xref="paper", yref="paper",
        x=0.03, y=0.97,
        text=annotation_text,
        showarrow=False,
        bgcolor=t['card_bg'],
        bordercolor=t['card_border'],
        borderwidth=1,
        font=dict(size=12, color=t['card_font_color'])
    )

    axis_type = 'log' if log_scale else 'linear'
    fig.update_xaxes(title_text=f"Pulpa (Referencia) [{unit}]", type=axis_type, gridcolor=t['grid_color'], zerolinecolor=t['zeroline_color'])
    fig.update_yaxes(title_text=f"Cutting (Evaluado) [{unit}]", type=axis_type, gridcolor=t['grid_color'], zerolinecolor=t['zeroline_color'])

    fig.update_layout(
        title=dict(
            text=f"Dispersión 1:1 y Calibración RMA — {element} ({unit})",
            font=dict(size=14, color=t['title_color'])
        ),
        template=t['template'],
        paper_bgcolor=t['paper_bgcolor'],
        plot_bgcolor=t['plot_bgcolor'],
        height=620,
        font=dict(color=t['font_color']),
        legend=dict(
            orientation='h',
            yanchor='bottom',
            y=-0.25,
            xanchor='center',
            x=0.5,
            bgcolor=t['legend_bg'],
            bordercolor=t['legend_border'],
            font=dict(color=t['legend_font_color'])
        )
    )

    apply_figure_theme(fig, t)
    return fig


def plot_bland_altman(df: pd.DataFrame,
                      element: str,
                      stats_dict: Dict[str, Any],
                      unit: Optional[str] = None,
                      theme: str = 'light') -> go.Figure:
    """
    Genera el gráfico de Bland-Altman (Diferencia Relativa % vs Promedio de Ley).
    Evalúa si el sesgo del cutting depende de la concentración de la muestra.
    """
    if unit is None:
        unit = get_element_unit(element)

    t = get_theme_layout_params(theme)

    p_col = f"{element}_Pulp"
    c_col = f"{element}_Cut"

    sub = df[[p_col, c_col, 'From', 'To', 'Sondaje']].dropna().copy()
    sub = sub[(sub[p_col] > 0) & (sub[c_col] > 0)]

    x_mean = (sub[p_col].values + sub[c_col].values) / 2.0
    y_diff_pct = ((sub[c_col].values - sub[p_col].values) / x_mean) * 100.0

    ba_mean = stats_dict.get('ba_mean', np.mean(y_diff_pct))
    ba_upper = stats_dict.get('ba_upper_limit', ba_mean + 1.96 * np.std(y_diff_pct))
    ba_lower = stats_dict.get('ba_lower_limit', ba_mean - 1.96 * np.std(y_diff_pct))

    fig = go.Figure()

    # Puntos
    fig.add_trace(go.Scatter(
        x=x_mean, y=y_diff_pct,
        mode='markers',
        marker=dict(size=6, color='#2ca02c', opacity=0.7),
        name='Diferencia Relativa %',
        hovertemplate=(
            f"<b>Sondaje:</b> %{{customdata[0]}}<br>"
            f"<b>Tramo:</b> %{{customdata[1]:.1f}}m - %{{customdata[2]:.1f}}m<br>"
            f"<b>Ley Promedio:</b> %{{x:.4f}} {unit}<br>"
            f"<b>Diferencia %:</b> %{{y:+.2f}}%<extra></extra>"
        ),
        customdata=sub[['Sondaje', 'From', 'To']].values
    ))

    # Línea Cero
    fig.add_hline(y=0, line_dash='dash', line_color=t['line_ref_color'], line_width=1.5, annotation_text="0% (Sin Sesgo)")
    # Media de Sesgo
    fig.add_hline(y=ba_mean, line_dash='solid', line_color='#3b82f6', line_width=2,
                  annotation_text=f"Sesgo Medio: {ba_mean:+.2f}%")
    # Límites ±1.96 SD
    fig.add_hline(y=ba_upper, line_dash='dot', line_color='#ef4444', line_width=1.5,
                  annotation_text=f"+1.96 SD: {ba_upper:+.2f}%")
    fig.add_hline(y=ba_lower, line_dash='dot', line_color='#ef4444', line_width=1.5,
                  annotation_text=f"-1.96 SD: {ba_lower:+.2f}%")

    fig.update_xaxes(title_text=f"Ley Promedio (Pulpa + Cutting) / 2 [{unit}]", gridcolor=t['grid_color'], zerolinecolor=t['zeroline_color'])
    fig.update_yaxes(title_text="Diferencia Relativa (%) [(Cut - Pulp) / Mean * 100]", gridcolor=t['grid_color'], zerolinecolor=t['zeroline_color'])

    fig.update_layout(
        title=dict(
            text=f"<b>Gráfico de Bland-Altman</b> — Sesgo Relativo vs Concentración ({element})",
            font=dict(size=14, color=t['title_color'])
        ),
        template=t['template'],
        paper_bgcolor=t['paper_bgcolor'],
        plot_bgcolor=t['plot_bgcolor'],
        font=dict(color=t['font_color']),
        height=550
    )

    apply_figure_theme(fig, t)
    return fig


def plot_hard_cumulative(df: pd.DataFrame,
                         element: str,
                         stats_dict: Dict[str, Any],
                         theme: str = 'light') -> go.Figure:
    """
    Curva de Frecuencia Acumulada de HARD (Half Absolute Relative Difference).
    Estándar internacional minero (JORC / NI 43-101) para evaluar precisión de duplicados.
    """
    hard_col = f"{element}_HARD_%"
    if hard_col not in df.columns:
        return go.Figure()

    vals = df[hard_col].dropna().values
    vals = vals[vals >= 0]

    if len(vals) == 0:
        return go.Figure()

    sorted_vals = np.sort(vals)
    cum_pct = (np.arange(1, len(sorted_vals) + 1) / len(sorted_vals)) * 100.0

    t = get_theme_layout_params(theme)
    fig = go.Figure()

    fig.add_trace(go.Scatter(
        x=sorted_vals, y=cum_pct,
        mode='lines',
        line=dict(color='#8b5cf6', width=3),
        name='Curva HARD',
        fill='tozeroy',
        fillcolor='rgba(139, 92, 246, 0.15)',
        hovertemplate="<b>HARD:</b> %{x:.2f}%<br><b>Frec. Acumulada:</b> %{y:.1f}%<extra></extra>"
    ))

    # Línea umbral recomendada: 10% HARD
    pct_10 = stats_dict.get('pct_hard_le_10', 0.0)
    fig.add_vline(x=10.0, line_dash='dash', line_color='#ef4444', line_width=1.5)
    fig.add_hline(y=pct_10, line_dash='dash', line_color='#ef4444', line_width=1.5,
                  annotation_text=f"{pct_10:.1f}% pares ≤ 10% HARD")

    fig.update_xaxes(title_text="HARD (%) [|Cut - Pulp| / (Cut + Pulp) * 100]", range=[0, min(50, np.max(sorted_vals) if len(sorted_vals)>0 else 50)], gridcolor=t['grid_color'], zerolinecolor=t['zeroline_color'])
    fig.update_yaxes(title_text="Porcentaje Acumulado de Muestras (%)", range=[0, 105], gridcolor=t['grid_color'], zerolinecolor=t['zeroline_color'])

    fig.update_layout(
        title=dict(
            text=f"<b>Precisión Acumulada HARD</b> — {element} (Criterio Minero: ≥ 80% bajo 10% HARD)",
            font=dict(size=14, color=t['title_color'])
        ),
        template=t['template'],
        paper_bgcolor=t['paper_bgcolor'],
        plot_bgcolor=t['plot_bgcolor'],
        font=dict(color=t['font_color']),
        height=550
    )

    apply_figure_theme(fig, t)
    return fig


def plot_multielement_overview(summary_df: pd.DataFrame, theme: str = 'light') -> go.Figure:
    """
    Genera un gráfico de barras comparativo de R² y Sesgo Relativo %
    para todos los elementos analizados.
    """
    if summary_df.empty:
        return go.Figure()

    t = get_theme_layout_params(theme)

    fig = make_subplots(
        rows=2, cols=1,
        shared_xaxes=True,
        vertical_spacing=0.1,
        subplot_titles=["Coeficiente de Determinación (R² por Elemento)", "Sesgo Relativo Medio (% por Elemento)"]
    )

    # R2
    colors_r2 = ['#22c55e' if r >= 0.85 else '#f97316' if r >= 0.65 else '#ef4444' for r in summary_df['R²']]
    fig.add_trace(
        go.Bar(
            x=summary_df['Elemento'],
            y=summary_df['R²'],
            marker=dict(color=colors_r2),
            name='R²',
            hovertemplate="<b>%{x}</b><br>R²: %{y:.4f}<extra></extra>"
        ),
        row=1, col=1
    )
    fig.add_hline(y=0.85, line_dash='dash', line_color='#22c55e', line_width=1, row=1, col=1)

    # Sesgo Relativo %
    colors_bias = ['#ef4444' if abs(b) > 20 else '#f97316' if abs(b) > 10 else '#22c55e' for b in summary_df['Sesgo Relativo (%)']]
    fig.add_trace(
        go.Bar(
            x=summary_df['Elemento'],
            y=summary_df['Sesgo Relativo (%)'],
            marker=dict(color=colors_bias),
            name='Sesgo Rel. %',
            hovertemplate="<b>%{x}</b><br>Sesgo: %{y:+.2f}%<extra></extra>"
        ),
        row=2, col=1
    )
    fig.add_hline(y=0, line_dash='solid', line_color=t['line_ref_color'], line_width=1, row=2, col=1)
    fig.add_hline(y=10, line_dash='dot', line_color=t['grid_color'], line_width=1, row=2, col=1)
    fig.add_hline(y=-10, line_dash='dot', line_color=t['grid_color'], line_width=1, row=2, col=1)

    fig.update_yaxes(title_text="R²", range=[0, 1.05], row=1, col=1, gridcolor=t['grid_color'], zerolinecolor=t['zeroline_color'])
    fig.update_yaxes(title_text="Sesgo Relativo (%)", row=2, col=1, gridcolor=t['grid_color'], zerolinecolor=t['zeroline_color'])
    fig.update_xaxes(gridcolor=t['grid_color'], zerolinecolor=t['zeroline_color'])
    fig.update_layout(
        title=dict(
            text="<b>Evaluación Comparativa Multielemento</b> (Confiabilidad Cutting vs Pulpa)",
            font=dict(size=14, color=t['title_color'])
        ),
        template=t['template'],
        paper_bgcolor=t['paper_bgcolor'],
        plot_bgcolor=t['plot_bgcolor'],
        font=dict(color=t['font_color']),
        height=680,
        showlegend=False
    )

    apply_figure_theme(fig, t)
    return fig


def plot_multi_scatter_grid(df: pd.DataFrame,
                            elements: list,
                            hole_id: str,
                            color_pulp: str = '#1f77b4',
                            color_cut: str = '#ff7f0e',
                            theme: str = 'light') -> go.Figure:
    """
    Genera una cuadrícula de gráficos 1:1 para comparar simultáneamente múltiples
    elementos para el mismo pozo (ej. Cu, Mo, Fe, S).
    """
    from src.qaqc_engine import calculate_element_stats

    n = len(elements)
    if n == 0:
        return go.Figure()

    t = get_theme_layout_params(theme)

    if n <= 3:
        rows, cols = 1, n
    elif n == 4:
        rows, cols = 2, 2
    else:
        cols = 3
        rows = (n + 2) // 3

    sub_titles = []
    stats_list = []
    for el in elements:
        st_dict = calculate_element_stats(df, el)
        stats_list.append(st_dict)
        unit = get_element_unit(el)
        r2 = st_dict.get('r2', 0.0)
        bias = st_dict.get('rel_bias_pct', 0.0)
        sub_titles.append(f"{el} [{unit}] (R²={r2:.3f} | Sesgo={bias:+.1f}%)")

    fig = make_subplots(
        rows=rows, cols=cols,
        subplot_titles=sub_titles,
        horizontal_spacing=0.08,
        vertical_spacing=0.12 if rows > 1 else 0.05
    )

    for idx, (el, st_dict) in enumerate(zip(elements, stats_list)):
        r = (idx // cols) + 1
        c = (idx % cols) + 1
        unit = get_element_unit(el)

        p_col = f"{el}_Pulp"
        c_col = f"{el}_Cut"
        req_cols = [p_col, c_col, 'From', 'To']
        if 'Sondaje' in df.columns:
            req_cols.append('Sondaje')
        if 'Longitud_m' in df.columns:
            req_cols.append('Longitud_m')

        sub = df[[c for c in req_cols if c in df.columns]].dropna().copy()
        sub = sub[(sub[p_col] > 0) & (sub[c_col] > 0)]

        if 'Sondaje' not in sub.columns:
            sub['Sondaje'] = hole_id
        if 'Longitud_m' not in sub.columns:
            sub['Longitud_m'] = (sub['To'] - sub['From']).round(2)

        if len(sub) < 2:
            continue

        x = sub[p_col].values
        y = sub[c_col].values

        min_val = min(np.min(x), np.min(y))
        max_val = max(np.max(x), np.max(y))
        line_x = np.linspace(min_val * 0.95, max_val * 1.05, 50)

        # 1:1 (Línea Azul - Pulpa Ref)
        fig.add_trace(
            go.Scatter(
                x=line_x, y=line_x, mode='lines',
                line=dict(color=color_pulp, dash='dash', width=2.0),
                name='1:1 (Pulpa Ref)', showlegend=(idx==0)
            ),
            row=r, col=c
        )

        # RMA (Línea Naranjo - Cutting Calibrado)
        m_rma = st_dict.get('slope_rma', 1.0)
        b_rma = st_dict.get('intercept_rma', 0.0)
        y_rma = m_rma * line_x + b_rma
        fig.add_trace(
            go.Scatter(
                x=line_x, y=y_rma, mode='lines',
                line=dict(color=color_cut, width=2.5),
                name='Regresión RMA (Cutting)', showlegend=(idx==0)
            ),
            row=r, col=c
        )

        # Points (Muestras de 2m con identificación completa de tramo y ley)
        fig.add_trace(
            go.Scatter(
                x=x, y=y, mode='markers',
                marker=dict(size=6, color=color_cut, opacity=0.75, line=dict(color=color_pulp, width=0.8)),
                name=f'{el} Muestras',
                showlegend=False,
                hovertemplate=(
                    f"<b>%{{customdata[0]}}</b> (Elemento: {el})<br>"
                    f"<b>Tramo:</b> %{{customdata[1]:.1f}}m - %{{customdata[2]:.1f}}m (%{{customdata[3]:.1f}}m)<br>"
                    f"<b>Pulpa (Lab):</b> %{{x:.4f}} {unit}<br>"
                    f"<b>Cutting (FRX):</b> %{{y:.4f}} {unit}<extra></extra>"
                ),
                customdata=sub[['Sondaje', 'From', 'To', 'Longitud_m']].values
            ),
            row=r, col=c
        )

        fig.update_xaxes(title_text=f"Pulpa [{unit}]", row=r, col=c, gridcolor=t['grid_color'], zerolinecolor=t['zeroline_color'])
        fig.update_yaxes(title_text=f"Cutting [{unit}]", row=r, col=c, gridcolor=t['grid_color'], zerolinecolor=t['zeroline_color'])

    calc_height = 420 if rows == 1 else (750 if rows == 2 else 950)
    title_elem_str = ', '.join(elements[:4]) + ('...' if len(elements) > 4 else '')
    fig.update_layout(
        title=dict(
            text=f"<b>Sondaje {hole_id}</b> — Dispersión 1:1 ({title_elem_str})",
            x=0.01,
            y=0.98,
            xanchor='left',
            yanchor='top',
            yref='container',
            xref='container',
            font=dict(size=14, color=t['title_color'])
        ),
        margin=dict(t=95, b=40, l=60, r=40),
        template=t['template'],
        paper_bgcolor=t['paper_bgcolor'],
        plot_bgcolor=t['plot_bgcolor'],
        font=dict(color=t['font_color']),
        height=calc_height,
        showlegend=True,
        legend=dict(
            orientation='h',
            x=0.5,
            y=1.03,
            xanchor='center',
            yanchor='bottom',
            bgcolor=t['legend_bg'],
            bordercolor=t['legend_border'],
            borderwidth=1,
            font=dict(size=11, color=t['legend_font_color'])
        )
    )

    apply_figure_theme(fig, t)
    return fig


def plot_cross_element_correlation(df: pd.DataFrame,
                                   elem_x: str,
                                   elem_y: str,
                                   hole_id: str,
                                   color_pulp: str = '#1f77b4',
                                   color_cut: str = '#ff7f0e',
                                   dash_pulp: str = 'solid',
                                   dash_cut: str = 'solid',
                                   width_pulp: float = 2.0,
                                   width_cut: float = 2.0,
                                   marker_size: int = 7,
                                   theme: str = 'light') -> go.Figure:
    """
    Compara la relación geoquímica cruzada entre dos elementos (ej. Cu vs Mo, o Cu vs Fe)
    evaluando si la tendencia natural en Pulpa se preserva en Cutting.
    Soporta colores, estilos de línea configurables y leyenda centrada sin colisión con el ModeBar.
    """
    from scipy import stats

    unit_x = get_element_unit(elem_x)
    unit_y = get_element_unit(elem_y)

    has_pulp = f"{elem_x}_Pulp" in df.columns and f"{elem_y}_Pulp" in df.columns
    has_cut = f"{elem_x}_Cut" in df.columns and f"{elem_y}_Cut" in df.columns

    if not has_pulp and not has_cut:
        return go.Figure()

    t = get_theme_layout_params(theme)
    fig = go.Figure()

    # 1. Puntos Pulpa
    if has_pulp:
        cols_p = [c for c in ['From', 'To', f"{elem_x}_Pulp", f"{elem_y}_Pulp"] if c in df.columns]
        sub_p = df[cols_p].dropna().copy()
        if not sub_p.empty:
            xp, yp = sub_p[f"{elem_x}_Pulp"].values, sub_p[f"{elem_y}_Pulp"].values
            cdata_p = sub_p[['From', 'To']].values if 'From' in sub_p.columns and 'To' in sub_p.columns else None
            fig.add_trace(go.Scatter(
                x=xp, y=yp,
                mode='markers',
                marker=dict(size=marker_size, color=color_pulp, opacity=0.75, symbol='circle'),
                name=f'Pulpa ({elem_x} vs {elem_y})',
                hovertemplate=f"<b>Pulpa</b><br>{elem_x}: %{{x:.4f}} {unit_x}<br>{elem_y}: %{{y:.4f}} {unit_y}<extra></extra>" if cdata_p is None else f"<b>Pulpa</b><br>Tramo: %{{customdata[0]:.1f}}-%{{customdata[1]:.1f}}m<br>{elem_x}: %{{x:.4f}} {unit_x}<br>{elem_y}: %{{y:.4f}} {unit_y}<extra></extra>",
                customdata=cdata_p
            ))

            # Regresión Pulpa
            if len(xp) > 2 and np.std(xp) > 0:
                sp, ip, rp, _, _ = stats.linregress(xp, yp)
                lx = np.linspace(np.min(xp), np.max(xp), 50)
                fig.add_trace(go.Scatter(
                    x=lx, y=sp*lx + ip, mode='lines',
                    line=dict(color=color_pulp, width=width_pulp, dash=dash_pulp),
                    name=f'Tendencia Pulpa (R²={rp**2:.3f})'
                ))

    # 2. Puntos Cutting
    if has_cut:
        cols_c = [c for c in ['From', 'To', f"{elem_x}_Cut", f"{elem_y}_Cut"] if c in df.columns]
        sub_c = df[cols_c].dropna().copy()
        if not sub_c.empty:
            xc, yc = sub_c[f"{elem_x}_Cut"].values, sub_c[f"{elem_y}_Cut"].values
            cdata_c = sub_c[['From', 'To']].values if 'From' in sub_c.columns and 'To' in sub_c.columns else None
            fig.add_trace(go.Scatter(
                x=xc, y=yc,
                mode='markers',
                marker=dict(size=marker_size, color=color_cut, opacity=0.75, symbol='square'),
                name=f'Cutting ({elem_x} vs {elem_y})',
                hovertemplate=f"<b>Cutting</b><br>{elem_x}: %{{x:.4f}} {unit_x}<br>{elem_y}: %{{y:.4f}} {unit_y}<extra></extra>" if cdata_c is None else f"<b>Cutting</b><br>Tramo: %{{customdata[0]:.1f}}-%{{customdata[1]:.1f}}m<br>{elem_x}: %{{x:.4f}} {unit_x}<br>{elem_y}: %{{y:.4f}} {unit_y}<extra></extra>",
                customdata=cdata_c
            ))

            # Regresión Cutting
            if len(xc) > 2 and np.std(xc) > 0:
                sc, ic, rc, _, _ = stats.linregress(xc, yc)
                lx_c = np.linspace(np.min(xc), np.max(xc), 50)
                fig.add_trace(go.Scatter(
                    x=lx_c, y=sc*lx_c + ic, mode='lines',
                    line=dict(color=color_cut, width=width_cut, dash=dash_cut),
                    name=f'Tendencia Cutting (R²={rc**2:.3f})'
                ))

    fig.update_layout(
        title=dict(
            text=f"<b>Sondaje {hole_id}</b> — Correlación Cruzada: {elem_x} vs. {elem_y}",
            x=0.01,
            y=0.98,
            xanchor='left',
            yanchor='top',
            yref='container',
            xref='container',
            font=dict(size=14, color=t['title_color'])
        ),
        margin=dict(t=95, b=50, l=60, r=40),
        xaxis_title=f"{elem_x} ({unit_x})",
        yaxis_title=f"{elem_y} ({unit_y})",
        template=t['template'],
        paper_bgcolor=t['paper_bgcolor'],
        plot_bgcolor=t['plot_bgcolor'],
        font=dict(color=t['font_color']),
        height=620,
        legend=dict(
            orientation='h',
            x=0.5,
            y=1.03,
            xanchor='center',
            yanchor='bottom',
            bgcolor=t['legend_bg'],
            bordercolor=t['legend_border'],
            borderwidth=1,
            font=dict(size=11, color=t['legend_font_color'])
        )
    )

    apply_figure_theme(fig, t)

    return fig


def _clean_html(html_str: str) -> str:
    """Elimina sangrías y saltos de línea para que Streamlit Markdown nunca lo renderice como código de texto."""
    return "".join(line.strip() for line in html_str.splitlines() if line.strip())


def render_sticky_ruler_html(df: pd.DataFrame, elem: str, unit: Optional[str] = None) -> str:
    """
    Genera un elemento HTML con estilo CSS 'position: sticky' que se fija en la parte
    superior de la pantalla mientras el usuario hace scroll vertical en el perfil del pozo.
    """
    if unit is None:
        unit = get_element_unit(elem)

    p_col = f"{elem}_Pulp"
    c_col = f"{elem}_Cut"
    d_col = f"{elem}_Diff_Abs"

    if p_col not in df.columns or c_col not in df.columns or d_col not in df.columns:
        return ""

    sub = df[[p_col, c_col, d_col]].dropna()
    if sub.empty:
        return ""

    p_max = max(float(sub[p_col].max()), float(sub[c_col].max()))
    p_min = 0.0
    d_abs_max = max(abs(float(sub[d_col].min())), abs(float(sub[d_col].max())), 0.05)

    p_ticks = np.linspace(p_min, p_max, 5)
    d_ticks = np.linspace(-d_abs_max, d_abs_max, 5)

    p_ticks_html = "".join([f'<span style="font-size:11px; font-weight:600; color:#90cdf4;">{t:.2f}</span>' for t in p_ticks])
    d_ticks_html = "".join([f'<span style="font-size:11px; font-weight:600; color:#feb2b2;">{t:+.2f}</span>' for t in d_ticks])

    html = (
        '<div style="'
        'position: -webkit-sticky; position: sticky; top: 52px; z-index: 999; '
        'background: rgba(15, 23, 42, 0.94); backdrop-filter: blur(8px); '
        'border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px; '
        'padding: 6px 14px; margin: 6px 0 12px 0; box-shadow: 0 4px 14px rgba(0,0,0,0.35);'
        '">'
        '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">'
        '<div style="width: 66%; display: flex; justify-content: space-between; align-items: center; padding-right: 15px;">'
        f'<span style="font-weight: 700; color: #63b3ed; font-size: 11px;">📌 EJE X FIJO (LEY): {elem} ({unit})</span>'
        '<span style="font-size: 10px; color: #a0aec0;">Pulpa (Azul) / Cutting (Naranja)</span>'
        '</div>'
        '<div style="width: 32%; display: flex; justify-content: space-between; align-items: center; padding-left: 10px; border-left: 2px solid rgba(255,255,255,0.25);">'
        f'<span style="font-weight: 700; color: #fc8181; font-size: 11px;">📌 EJE X FIJO (DISCREPANCIA): Δ {elem} ({unit})</span>'
        '<span style="font-size: 10px; color: #a0aec0;">Cutting - Pulpa</span>'
        '</div>'
        '</div>'
        '<div style="display: flex; justify-content: space-between;">'
        f'<div style="width: 66%; display: flex; justify-content: space-between; padding-right: 15px; border-top: 1px dashed rgba(255,255,255,0.3); padding-top: 2px;">{p_ticks_html}</div>'
        f'<div style="width: 32%; display: flex; justify-content: space-between; padding-left: 10px; border-left: 2px solid rgba(255,255,255,0.25); border-top: 1px dashed rgba(255,255,255,0.3); padding-top: 2px;">{d_ticks_html}</div>'
        '</div>'
        '</div>'
    )
    return _clean_html(html)


def render_sticky_multitrack_html(df: pd.DataFrame, elements: list) -> str:
    """
    Genera una barra flotante sticky para el modo multi-track mostrando las escalas
    de cada columna de elemento de forma fija al hacer scroll.
    """
    if not elements:
        return ""

    cols_html = []
    for el in elements:
        unit = get_element_unit(el)
        p_col = f"{el}_Pulp"
        c_col = f"{el}_Cut"
        if p_col in df.columns and c_col in df.columns:
            sub = df[[p_col, c_col]].dropna()
            max_val = max(float(sub[p_col].max()), float(sub[c_col].max())) if not sub.empty else 1.0
            t_min = 0.0
            t_mid = max_val / 2.0
            t_max = max_val
        else:
            t_min, t_mid, t_max = 0.0, 0.5, 1.0

        col_box = (
            '<div style="flex: 1; min-width: 80px; padding: 4px 8px; border-right: 1px solid rgba(255,255,255,0.15);">'
            f'<div style="font-weight: 700; color: #63b3ed; font-size: 11px; text-align: center;">{el} ({unit})</div>'
            '<div style="display: flex; justify-content: space-between; border-top: 1px dashed rgba(255,255,255,0.25); padding-top: 2px; font-size: 10px; color: #e2e8f0;">'
            f'<span>{t_min:.2f}</span>'
            f'<span>{t_mid:.2f}</span>'
            f'<span>{t_max:.2f}</span>'
            '</div>'
            '</div>'
        )
        cols_html.append(col_box)

    all_cols = "".join(cols_html)
    html = (
        '<div style="'
        'position: -webkit-sticky; position: sticky; top: 52px; z-index: 999; '
        'background: rgba(15, 23, 42, 0.94); backdrop-filter: blur(8px); '
        'border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px; '
        'padding: 6px 12px; margin: 6px 0 12px 0; box-shadow: 0 4px 14px rgba(0,0,0,0.35);'
        '">'
        '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">'
        '<span style="font-size: 11px; font-weight: 700; color: #90cdf4;">📌 REGLA FLOTANTE — ESCALAS EJE X (FIJAS AL HACER SCROLL):</span>'
        '<span style="font-size: 10px; color: #a0aec0;">Pulpa (Azul) / Cutting (Naranja)</span>'
        '</div>'
        f'<div style="display: flex; justify-content: space-between; width: 100%;">{all_cols}</div>'
        '</div>'
    )
    return _clean_html(html)

