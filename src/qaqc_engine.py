"""
Módulo de Motor Estadístico y QA/QC Geológico-Minero para Análisis FRX.
"""
import numpy as np
import pandas as pd
from scipy import stats
from typing import Dict, Any, List, Optional
from src.config import ELEMENT_CATALOG

def calculate_element_stats(df: pd.DataFrame,
                            element: str,
                            cutoff: float = 0.0) -> Dict[str, Any]:
    """
    Calcula exhaustivamente todas las métricas estadísticas, de sesgo,
    regresión OLS, regresión RMA, HARD y Bland-Altman para un elemento.
    """
    p_col = f"{element}_Pulp"
    c_col = f"{element}_Cut"

    if p_col not in df.columns or c_col not in df.columns:
        return {'valid': False, 'error': f'Columnas para {element} no encontradas.'}

    # Filtrar valores válidos numéricos y mayores a cutoff
    sub = df[[p_col, c_col, 'From', 'To']].copy()
    sub[p_col] = pd.to_numeric(sub[p_col], errors='coerce')
    sub[c_col] = pd.to_numeric(sub[c_col], errors='coerce')
    sub = sub.dropna().copy()
    if cutoff > 0:
        sub = sub[(sub[p_col] >= cutoff) | (sub[c_col] >= cutoff)]

    # Eliminar posibles ceros o valores negativos anómalos si los hay
    sub = sub[(sub[p_col] >= 0) & (sub[c_col] >= 0)]

    n_pairs = len(sub)
    if n_pairs < 3:
        return {
            'valid': False,
            'n_pairs': n_pairs,
            'error': f'Muestras insuficientes ({n_pairs} pares válidos).'
        }

    x = sub[p_col].values  # Referencia: Pulpa
    y = c_col_vals = sub[c_col].values  # Evaluado: Cutting

    # 1. Estadísticas Descriptivas
    mean_x, std_x = np.mean(x), np.std(x, ddof=1)
    mean_y, std_y = np.mean(y), np.std(y, ddof=1)
    median_x, median_y = np.median(x), np.median(y)
    min_x, max_x = np.min(x), np.max(x)
    min_y, max_y = np.min(y), np.max(y)
    cv_x = (std_x / mean_x * 100.0) if mean_x > 0 else 0.0
    cv_y = (std_y / mean_y * 100.0) if mean_y > 0 else 0.0

    # 2. Diferencias y Sesgo (Bias)
    diff = y - x
    mean_diff = np.mean(diff)
    median_diff = np.median(diff)
    mae = np.mean(np.abs(diff))
    rmse = np.sqrt(np.mean(diff ** 2))
    rel_bias_pct = ((mean_y - mean_x) / mean_x * 100.0) if mean_x > 0 else 0.0

    # Test t pareado para significancia estadística del sesgo
    if std_x > 0 and std_y > 0:
        t_stat, p_val_bias = stats.ttest_rel(y, x)
    else:
        t_stat, p_val_bias = 0.0, 1.0

    # 3. Correlaciones y Regresión OLS (Ordinary Least Squares)
    if std_x > 0 and std_y > 0:
        r_pearson, p_pearson = stats.pearsonr(x, y)
        r_spearman, _ = stats.spearmanr(x, y)
        slope_ols, intercept_ols, r_val, p_ols, std_err_ols = stats.linregress(x, y)
        r2 = r_pearson ** 2
    else:
        r_pearson, p_pearson, r_spearman = 0.0, 1.0, 0.0
        slope_ols, intercept_ols, r2, p_ols, std_err_ols = 1.0, 0.0, 0.0, 1.0, 0.0

    # 4. Regresión RMA (Reduced Major Axis / Geometric Mean Regression)
    # Fundamental en minería: considera que tanto Pulpa como Cutting tienen error analítico
    if std_x > 0 and std_y > 0:
        sign_r = 1.0 if r_pearson >= 0 else -1.0
        slope_rma = sign_r * (std_y / std_x)
        intercept_rma = mean_y - (slope_rma * mean_x)
    else:
        slope_rma = 1.0
        intercept_rma = 0.0

    # 5. HARD (Half Absolute Relative Difference)
    denom_hard = x + y
    valid_hard_mask = denom_hard > 0
    if valid_hard_mask.any():
        hard_vals = (np.abs(diff[valid_hard_mask]) / denom_hard[valid_hard_mask]) * 100.0
        mean_hard = np.mean(hard_vals)
        median_hard = np.median(hard_vals)
        pct_hard_le_5 = np.mean(hard_vals <= 5.0) * 100.0
        pct_hard_le_10 = np.mean(hard_vals <= 10.0) * 100.0
        pct_hard_le_15 = np.mean(hard_vals <= 15.0) * 100.0
        pct_hard_le_20 = np.mean(hard_vals <= 20.0) * 100.0
    else:
        hard_vals = np.array([])
        mean_hard, median_hard = 0.0, 0.0
        pct_hard_le_5 = pct_hard_le_10 = pct_hard_le_15 = pct_hard_le_20 = 100.0

    # 6. Bland-Altman (Límites de Acuerdo)
    mean_pair = (x + y) / 2.0
    valid_ba = mean_pair > 0
    if valid_ba.any():
        ba_diff_pct = (diff[valid_ba] / mean_pair[valid_ba]) * 100.0
        ba_mean = np.mean(ba_diff_pct)
        ba_std = np.std(ba_diff_pct, ddof=1)
        ba_upper_limit = ba_mean + 1.96 * ba_std
        ba_lower_limit = ba_mean - 1.96 * ba_std
    else:
        ba_mean, ba_std = 0.0, 0.0
        ba_upper_limit, ba_lower_limit = 0.0, 0.0

    # 7. Diagnóstico de Calidad Geológico / Criterio QA/QC
    if r2 >= 0.90 and abs(rel_bias_pct) <= 10.0 and pct_hard_le_10 >= 75.0:
        quality_rating = "Excelente"
        quality_color = "green"
    elif r2 >= 0.80 and abs(rel_bias_pct) <= 20.0 and pct_hard_le_10 >= 60.0:
        quality_rating = "Bueno"
        quality_color = "blue"
    elif r2 >= 0.65 and abs(rel_bias_pct) <= 30.0:
        quality_rating = "Aceptable / Cautela"
        quality_color = "orange"
    else:
        quality_rating = "No Confiable / Alto Sesgo"
        quality_color = "red"

    return {
        'valid': True,
        'element': element,
        'n_pairs': n_pairs,
        'mean_pulp': mean_x,
        'std_pulp': std_x,
        'median_pulp': median_x,
        'min_pulp': min_x,
        'max_pulp': max_x,
        'cv_pulp': cv_x,
        'mean_cut': mean_y,
        'std_cut': std_y,
        'median_cut': median_y,
        'min_cut': min_y,
        'max_cut': max_y,
        'cv_cut': cv_y,
        'mean_diff': mean_diff,
        'median_diff': median_diff,
        'mae': mae,
        'rmse': rmse,
        'rel_bias_pct': rel_bias_pct,
        'p_val_bias': p_val_bias,
        'r_pearson': r_pearson,
        'r_spearman': r_spearman,
        'r2': r2,
        'slope_ols': slope_ols,
        'intercept_ols': intercept_ols,
        'slope_rma': slope_rma,
        'intercept_rma': intercept_rma,
        'mean_hard': mean_hard,
        'median_hard': median_hard,
        'pct_hard_le_5': pct_hard_le_5,
        'pct_hard_le_10': pct_hard_le_10,
        'pct_hard_le_15': pct_hard_le_15,
        'pct_hard_le_20': pct_hard_le_20,
        'ba_mean': ba_mean,
        'ba_std': ba_std,
        'ba_upper_limit': ba_upper_limit,
        'ba_lower_limit': ba_lower_limit,
        'quality_rating': quality_rating,
        'quality_color': quality_color
    }


def multi_element_summary_table(df: pd.DataFrame,
                                elements: Optional[List[str]] = None,
                                cutoff: float = 0.0) -> pd.DataFrame:
    """
    Genera una tabla comparativa resumen con métricas clave para todos los elementos.
    """
    if elements is None:
        # Detectar todos los elementos disponibles que pertenezcan al catálogo
        p_cols = [c[:-5] for c in df.columns if c.endswith('_Pulp') and c[:-5] in ELEMENT_CATALOG]
        c_cols = [c[:-4] for c in df.columns if c.endswith('_Cut') and c[:-4] in ELEMENT_CATALOG]
        elements = sorted(list(set(p_cols).intersection(set(c_cols))))

    rows = []
    for elem in elements:
        stats_dict = calculate_element_stats(df, elem, cutoff=cutoff)
        if stats_dict.get('valid', False):
            rows.append({
                'Elemento': elem,
                'Pares Válidos': stats_dict['n_pairs'],
                'Media Pulpa': stats_dict['mean_pulp'],
                'Media Cutting': stats_dict['mean_cut'],
                'Sesgo Relativo (%)': stats_dict['rel_bias_pct'],
                'R²': stats_dict['r2'],
                'Pendiente RMA': stats_dict['slope_rma'],
                'Intercepto RMA': stats_dict['intercept_rma'],
                '% HARD ≤ 10%': stats_dict['pct_hard_le_10'],
                '% HARD ≤ 20%': stats_dict['pct_hard_le_20'],
                'Evaluación QA/QC': stats_dict['quality_rating']
            })

    summary_df = pd.DataFrame(rows)
    if not summary_df.empty:
        summary_df = summary_df.sort_values(by='R²', ascending=False).reset_index(drop=True)
    return summary_df
