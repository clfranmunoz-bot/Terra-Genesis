"""
Módulo de Carga, Limpieza y Fusión de Datos FRX (Pulpas y Cuttings).
"""
import os
import glob
import re
import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional, Any, Union

from src.config import (
    DEFAULT_PULP_PATHS,
    DEFAULT_CUTTING_PATHS,
    DEFAULT_PULP_PATH,
    DEFAULT_CUTTING_PATH,
    ELEMENT_CATALOG,
    normalize_hole_id,
    extract_element_symbol
)


def select_best_pulp_file(files: List[str]) -> str:
    """Selecciona el reporte oficial de pulpas descartando plantillas vacías."""
    valid = [f for f in files if not os.path.basename(f).startswith('~$') and '-geoatacama' not in os.path.basename(f).lower()]
    if not valid:
        valid = files
    reps = [f for f in valid if 'reporte' in os.path.basename(f).lower() or '_pp' in os.path.basename(f).lower()]
    cands = reps if reps else valid
    return max(cands, key=os.path.getsize)


def select_best_cutting_file(files: List[str]) -> str:
    """Selecciona el reporte oficial de cutting descartando plantillas y generadoras."""
    valid = [f for f in files if not os.path.basename(f).startswith('~$') and '-geoatacama' not in os.path.basename(f).lower() and 'generadora' not in os.path.basename(f).lower()]
    if not valid:
        valid = files
    reps = [f for f in valid if 'reporte' in os.path.basename(f).lower() or '_ct' in os.path.basename(f).lower()]
    cands = reps if reps else valid
    return max(cands, key=os.path.getsize)


def scan_directories(pulp_base_dir: Union[str, List[str]] = DEFAULT_PULP_PATHS,
                     cutting_base_dir: Union[str, List[str]] = DEFAULT_CUTTING_PATHS) -> Dict[str, Any]:
    """
    Escanea uno o múltiples directorios de Pulpas y Cuttings, emparejando sondajes
    y resolviendo variaciones tipográficas de nombres y multicampañas.
    """
    pulp_dirs = [pulp_base_dir] if isinstance(pulp_base_dir, str) else list(pulp_base_dir)
    cutting_dirs = [cutting_base_dir] if isinstance(cutting_base_dir, str) else list(cutting_base_dir)

    pulp_map = {}
    for p_base in pulp_dirs:
        if not os.path.exists(p_base):
            continue
        camp = os.path.basename(p_base)
        for d in os.listdir(p_base):
            full_d = os.path.join(p_base, d)
            if not os.path.isdir(full_d):
                continue
            excels = glob.glob(os.path.join(full_d, "*.xlsx")) + glob.glob(os.path.join(full_d, "*.xls"))
            excels = [f for f in excels if not os.path.basename(f).startswith('~$')]
            if excels:
                best = select_best_pulp_file(excels)
                norm = normalize_hole_id(d)
                if norm not in pulp_map:
                    pulp_map[norm] = {'folder': d, 'file': best, 'campaign': camp, 'base_dir': p_base}

    cutting_map = {}
    for c_base in cutting_dirs:
        if not os.path.exists(c_base):
            continue
        camp = os.path.basename(os.path.dirname(c_base)) if "campaña" in os.path.basename(os.path.dirname(c_base)).lower() else os.path.basename(c_base)
        for d in os.listdir(c_base):
            full_d = os.path.join(c_base, d)
            if not os.path.isdir(full_d):
                continue
            excels = glob.glob(os.path.join(full_d, "*.xlsx")) + glob.glob(os.path.join(full_d, "*.xls"))
            excels = [f for f in excels if not os.path.basename(f).startswith('~$')]
            if excels:
                best = select_best_cutting_file(excels)
                norm = normalize_hole_id(d)
                if norm not in cutting_map:
                    cutting_map[norm] = {'folder': d, 'file': best, 'campaign': camp, 'base_dir': c_base}

    common_holes = sorted(list(set(pulp_map.keys()).intersection(set(cutting_map.keys()))))
    only_pulp = sorted(list(set(pulp_map.keys()) - set(cutting_map.keys())))
    only_cutting = sorted(list(set(cutting_map.keys()) - set(pulp_map.keys())))

    holes_info = {}
    for h in common_holes:
        holes_info[h] = {
            'hole_id': h,
            'pulp_folder': pulp_map[h]['folder'],
            'cutting_folder': cutting_map[h]['folder'],
            'pulp_file': pulp_map[h]['file'],
            'cutting_file': cutting_map[h]['file'],
            'pulp_campaign': pulp_map[h]['campaign'],
            'cutting_campaign': cutting_map[h]['campaign'],
            'campaign': f"{pulp_map[h]['campaign']} / {cutting_map[h]['campaign']}"
        }

    campaigns = sorted(list(set(info['pulp_campaign'] for info in holes_info.values())))

    return {
        'common_holes': sorted(list(holes_info.keys())),
        'holes_info': holes_info,
        'only_pulp': only_pulp,
        'only_cutting': only_cutting,
        'pulp_base_dir': pulp_dirs,
        'cutting_base_dir': cutting_dirs,
        'campaigns': campaigns
    }


def parse_pulp_excel(file_path: str) -> pd.DataFrame:
    """
    Parsea un archivo de reporte de Pulpa (ej. Reporte MLP DDH4092_PP.xlsx).
    Maneja la cabecera de 2 filas: fila 0 con elementos y fila 1 con unidades/metadatos.
    """
    raw_df = pd.read_excel(file_path, header=None)
    if raw_df.shape[0] < 3:
        return pd.DataFrame()

    row0 = list(raw_df.iloc[0])
    row1 = list(raw_df.iloc[1])

    # Determinar columnas base y columnas de elementos
    col_names = []
    element_cols = {}

    for idx in range(len(row0)):
        r0_val = str(row0[idx]).strip() if pd.notna(row0[idx]) else ""
        r1_val = str(row1[idx]).strip() if pd.notna(row1[idx]) else ""

        # Identificar Desde/Hasta/From/To
        r1_lower = r1_val.lower()
        if 'desde' in r1_lower or 'from' in r1_lower:
            col_names.append('From')
        elif 'hasta' in r1_lower or 'to' in r1_lower:
            col_names.append('To')
        elif 'sondaje' in r1_lower or 'hole' in r1_lower:
            col_names.append('Sondaje')
        elif 'id.' in r1_lower or 'id' in r1_lower or 'muestra' in r1_lower:
            col_names.append('Sample_ID_Pulp')
        elif 'peso' in r1_lower:
            col_names.append('Peso_Pulp')
        elif 'nº' in r1_lower or 'n°' in r1_lower:
            col_names.append('Row_Index_Pulp')
        else:
            # Es columna de elemento
            elem_raw = r0_val if r0_val and r0_val != "None" else r1_val
            symbol = extract_element_symbol(elem_raw)
            if symbol and symbol.upper() not in ['NONE', 'NAN', '']:
                col_name = f"{symbol}_Pulp"
                col_names.append(col_name)
                element_cols[col_name] = symbol
            else:
                col_names.append(f"Extra_{idx}")

    df_data = raw_df.iloc[2:].copy()
    df_data.columns = col_names[:df_data.shape[1]]

    # Limpiar From y To
    if 'From' in df_data.columns and 'To' in df_data.columns:
        df_data['From'] = pd.to_numeric(df_data['From'], errors='coerce')
        df_data['To'] = pd.to_numeric(df_data['To'], errors='coerce')
        df_data = df_data.dropna(subset=['From', 'To']).copy()
        df_data['From'] = df_data['From'].astype(float).round(2)
        df_data['To'] = df_data['To'].astype(float).round(2)

    return df_data


def parse_cutting_excel(file_path: str) -> pd.DataFrame:
    """
    Parsea un archivo de reporte de Cutting (ej. Reporte MLP DDH4092_CT.xlsx).
    Maneja la cabecera de 1 fila con sufijos _pct y _ppm.
    """
    df = pd.read_excel(file_path, header=0)
    if df.empty:
        return df

    rename_dict = {}
    element_cols = {}

    for col in df.columns:
        c_str = str(col).strip()
        c_lower = c_str.lower()

        if 'from' in c_lower or 'desde' in c_lower:
            rename_dict[col] = 'From'
        elif 'to' in c_lower or 'hasta' in c_lower:
            rename_dict[col] = 'To'
        elif 'sondaje' in c_lower or 'hole' in c_lower:
            rename_dict[col] = 'Sondaje'
        elif 'id.' in c_lower or 'id' in c_lower or 'muestra' in c_lower:
            rename_dict[col] = 'Sample_ID_Cut'
        elif 'peso' in c_lower:
            rename_dict[col] = 'Peso_Cut'
        elif 'nº' in c_lower or 'n°' in c_lower:
            rename_dict[col] = 'Row_Index_Cut'
        else:
            symbol = extract_element_symbol(c_str)
            if symbol and symbol.upper() not in ['NONE', 'NAN', 'UNNAMED']:
                col_name = f"{symbol}_Cut"
                rename_dict[col] = col_name
                element_cols[col_name] = symbol

    df = df.rename(columns=rename_dict)

    # Limpiar From y To
    if 'From' in df.columns and 'To' in df.columns:
        df['From'] = pd.to_numeric(df['From'], errors='coerce')
        df['To'] = pd.to_numeric(df['To'], errors='coerce')
        df = df.dropna(subset=['From', 'To']).copy()
        df['From'] = df['From'].astype(float).round(2)
        df['To'] = df['To'].astype(float).round(2)

    return df


def clean_element_series(series: pd.Series, lod_mode: str = 'exclude') -> Tuple[pd.Series, pd.Series]:
    """
    Procesa una serie de valores químicos:
    - Detecta valores '<LOD'
    - Coerce errores no numéricos (ej. 'TRICONO', '-' etc.) a NaN
    - Trata los valores <LOD según el modo ('exclude', 'lod_half', 'lod_sqrt2')
    Retorna: (serie_numerica, serie_booleana_is_lod)
    """
    # Detectar string <LOD
    s_str = series.astype(str).str.strip().str.upper()
    is_lod = s_str.str.contains(r'<LOD|<\s*LOD|LOD', regex=True)

    # Convertir todo a numérico, strings no numéricos pasan a NaN
    num_series = pd.to_numeric(series, errors='coerce')

    if lod_mode != 'exclude' and is_lod.any():
        # Estimar el LOD mínimo positivo
        valid_positives = num_series[num_series > 0]
        if not valid_positives.empty:
            lod_estimate = valid_positives.min()
            if lod_mode == 'lod_half':
                impute_val = lod_estimate / 2.0
            elif lod_mode == 'lod_sqrt2':
                impute_val = lod_estimate / np.sqrt(2.0)
            else:
                impute_val = lod_estimate / 2.0
            num_series = num_series.copy()
            num_series[is_lod] = impute_val

    return num_series, is_lod


def merge_pulp_and_cutting(pulp_df: pd.DataFrame,
                           cutting_df: pd.DataFrame,
                           hole_id: str,
                           lod_mode: str = 'exclude') -> pd.DataFrame:
    """
    Fusiona tramo a tramo (From, To) los datos de Pulpa y Cutting para un sondaje.
    Calcula deltas, diferencias relativas y HARD por cada elemento en común.
    """
    if pulp_df.empty or cutting_df.empty:
        return pd.DataFrame()

    # Seleccionar columnas esenciales para evitar duplicados
    p_cols_to_keep = ['From', 'To']
    if 'Sample_ID_Pulp' in pulp_df.columns:
        p_cols_to_keep.append('Sample_ID_Pulp')
    p_elem_cols = [c for c in pulp_df.columns if c.endswith('_Pulp') and c != 'Sample_ID_Pulp']
    p_cols_to_keep.extend(p_elem_cols)
    p_sub = pulp_df[p_cols_to_keep].copy()

    c_cols_to_keep = ['From', 'To']
    if 'Sample_ID_Cut' in cutting_df.columns:
        c_cols_to_keep.append('Sample_ID_Cut')
    c_elem_cols = [c for c in cutting_df.columns if c.endswith('_Cut') and c != 'Sample_ID_Cut']
    c_cols_to_keep.extend(c_elem_cols)
    c_sub = cutting_df[c_cols_to_keep].copy()

    # Merge interior por From y To
    merged = pd.merge(p_sub, c_sub, on=['From', 'To'], how='inner')
    merged['Sondaje'] = hole_id
    merged['Longitud_m'] = (merged['To'] - merged['From']).round(2)
    merged['Punto_Medio_m'] = ((merged['From'] + merged['To']) / 2.0).round(2)

    # Identificar elementos coincidentes
    p_elems = {c[:-5]: c for c in p_elem_cols if c[:-5] in ELEMENT_CATALOG}
    c_elems = {c[:-4]: c for c in c_elem_cols if c[:-4] in ELEMENT_CATALOG}
    common_elements = sorted(list(set(p_elems.keys()).intersection(set(c_elems.keys()))))

    new_derived_cols = {}
    cleaned_p_cols = {}
    cleaned_c_cols = {}

    for elem in common_elements:
        p_col = f"{elem}_Pulp"
        c_col = f"{elem}_Cut"

        num_p, lod_p = clean_element_series(merged[p_col], lod_mode=lod_mode)
        num_c, lod_c = clean_element_series(merged[c_col], lod_mode=lod_mode)

        cleaned_p_cols[p_col] = num_p
        cleaned_c_cols[c_col] = num_c
        new_derived_cols[f"LOD_Flag_{elem}_Pulp"] = lod_p
        new_derived_cols[f"LOD_Flag_{elem}_Cut"] = lod_c

        # Métricas derivadas
        diff_abs = num_c - num_p
        diff_rel_pct = np.where(num_p != 0, (diff_abs / num_p) * 100.0, np.nan)
        mean_val = (num_p + num_c) / 2.0
        diff_bland_altman = np.where(mean_val != 0, (diff_abs / mean_val) * 100.0, np.nan)
        sum_val = num_p + num_c
        hard_pct = np.where(sum_val > 0, (np.abs(diff_abs) / sum_val) * 100.0, np.nan)

        new_derived_cols[f"{elem}_Diff_Abs"] = diff_abs
        new_derived_cols[f"{elem}_Diff_Rel_%"] = diff_rel_pct
        new_derived_cols[f"{elem}_Diff_BA_%"] = diff_bland_altman
        new_derived_cols[f"{elem}_HARD_%"] = hard_pct

    # Actualizar columnas de pulpa y cut limpiadas
    for col, s in cleaned_p_cols.items():
        merged[col] = s
    for col, s in cleaned_c_cols.items():
        merged[col] = s

    # Concatenar todas las columnas derivadas en un solo paso (evita fragmentación)
    df_derived = pd.DataFrame(new_derived_cols, index=merged.index)
    merged = pd.concat([merged, df_derived], axis=1)

    # Reordenar columnas: identificación primero
    base_cols = ['Sondaje', 'From', 'To', 'Longitud_m', 'Punto_Medio_m']
    if 'Sample_ID_Pulp' in merged.columns:
        base_cols.append('Sample_ID_Pulp')
    if 'Sample_ID_Cut' in merged.columns:
        base_cols.append('Sample_ID_Cut')

    other_cols = [c for c in merged.columns if c not in base_cols]
    merged = merged[base_cols + other_cols].sort_values(by='From').reset_index(drop=True)

    return merged


def load_dataset_for_hole(holes_info: Dict[str, Any],
                          hole_id: str,
                          lod_mode: str = 'exclude') -> pd.DataFrame:
    """
    Carga y fusiona los datos de un sondaje individual específico.
    """
    norm_id = normalize_hole_id(hole_id)
    if norm_id not in holes_info:
        raise ValueError(f"Sondaje {hole_id} no encontrado en la lista de sondajes comunes.")

    info = holes_info[norm_id]
    df_pulp = parse_pulp_excel(info['pulp_file'])
    df_cut = parse_cutting_excel(info['cutting_file'])

    return merge_pulp_and_cutting(df_pulp, df_cut, hole_id=norm_id, lod_mode=lod_mode)


def load_all_holes_consolidated(holes_info: Dict[str, Any],
                                lod_mode: str = 'exclude') -> pd.DataFrame:
    """
    Carga y consolida todos los sondajes comunes en un único DataFrame masivo.
    Ideal para análisis estadístico global de campaña (+5.000 tramos).
    """
    dfs = []
    for h_id in holes_info:
        try:
            df_h = load_dataset_for_hole(holes_info, h_id, lod_mode=lod_mode)
            if not df_h.empty:
                dfs.append(df_h)
        except Exception as e:
            print(f"Aviso: Error cargando sondaje {h_id}: {e}")

    if dfs:
        return pd.concat(dfs, ignore_index=True)
    return pd.DataFrame()
