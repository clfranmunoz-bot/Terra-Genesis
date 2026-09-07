"""
Módulo de Carga y Desurveying de Certificados Direccionales de Giroscopía.
Extrae metadatos operacionales, coordenadas de collar y estaciones 3D desurveyadas
para georreferenciar intervalos de muestreo FRX.
"""
import os
import openpyxl
import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Optional, Any, Union

from src.config import DEFAULT_GYRO_PATH, normalize_hole_id


def scan_gyro_directory(gyro_base_dir: str = DEFAULT_GYRO_PATH) -> Dict[str, str]:
    """
    Escanea el directorio maestro de giroscopía y mapea cada sondaje
    con su certificado direccional oficial (priorizando versiones _Final).
    Retorna un diccionario {hole_id: file_path}.
    """
    gyro_map: Dict[str, str] = {}
    if not os.path.exists(gyro_base_dir):
        return gyro_map

    for item in os.listdir(gyro_base_dir):
        item_path = os.path.join(gyro_base_dir, item)
        if not os.path.isdir(item_path):
            continue

        norm_id = normalize_hole_id(item)
        if not norm_id or norm_id.upper() in ['ANTIGUOS', 'COPIA MACRO', 'MACROS']:
            continue

        try:
            candidates = [
                f for f in os.listdir(item_path)
                if 'certificado direccional' in f.lower()
                and f.lower().endswith(('.xlsx', '.xls'))
                and not f.startswith('~$')
            ]
            if not candidates:
                continue

            final_cands = [f for f in candidates if '_final' in f.lower()]
            selected_file = final_cands[0] if final_cands else candidates[0]
            gyro_map[norm_id] = os.path.join(item_path, selected_file)
        except Exception:
            continue

    return gyro_map


def parse_gyro_certificate(file_path: str) -> Dict[str, Any]:
    """
    Lee un archivo CERTIFICADO DIRECCIONAL DE POZO DDHXXXX_Final.xlsx y extrae:
    - Metadatos (Cliente, Proyecto, Pozo, Fecha, Instrumento, Ubicación/Fase, Operador)
    - Coordenadas de Collar en Superficie (X, Y, Z, Dip, Azimut)
    - DataFrame con las estaciones de survey desurveyadas
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Archivo de giroscopía no encontrado: {file_path}")

    wb = openpyxl.load_workbook(file_path, data_only=True, read_only=True)
    sheet_name = 'MEDICION' if 'MEDICION' in wb.sheetnames else wb.sheetnames[0]
    ws = wb[sheet_name]

    metadata: Dict[str, Any] = {
        'CLIENTE': 'MLP',
        'PROYECTO': '',
        'POZO': '',
        'FECHA': None,
        'INSTRUMENTO': '',
        'UBICACION': '',
        'OPERADOR': '',
        'LATITUD': '-31.5°',
        'FOLIO': ''
    }

    for r in range(1, 13):
        k_val = ws.cell(r, 1).value
        v_val = ws.cell(r, 2).value
        if k_val and v_val:
            k_clean = str(k_val).strip().upper()
            if 'PROYECTO' in k_clean:
                metadata['PROYECTO'] = str(v_val).strip()
            elif 'POZO' in k_clean:
                metadata['POZO'] = normalize_hole_id(str(v_val).strip())
            elif 'FECHA' in k_clean:
                metadata['FECHA'] = str(v_val).strip()
            elif 'INSTRUMENTO' in k_clean:
                metadata['INSTRUMENTO'] = str(v_val).strip()
            elif 'UBICACI' in k_clean or 'FASE' in k_clean:
                metadata['UBICACION'] = str(v_val).strip()
            elif 'OPERADOR' in k_clean:
                metadata['OPERADOR'] = str(v_val).strip()
            elif 'FOLIO' in k_clean:
                metadata['FOLIO'] = str(v_val).strip()

    header_row = 15
    for r in range(11, 20):
        c2 = str(ws.cell(r, 2).value or '').lower()
        if 'profundidad' in c2:
            header_row = r
            break

    stations: List[Dict[str, float]] = []
    for r in range(header_row + 1, ws.max_row + 1):
        depth_val = ws.cell(r, 2).value
        if depth_val is None or str(depth_val).strip() == '':
            break
        try:
            depth_f = float(depth_val)
            dip_val = float(ws.cell(r, 3).value)
            azim_val = float(ws.cell(r, 4).value)
            east_val = float(ws.cell(r, 5).value)
            north_val = float(ws.cell(r, 6).value)
            elev_val = float(ws.cell(r, 7).value)

            stations.append({
                'Depth': depth_f,
                'Dip': dip_val,
                'Azimuth': azim_val,
                'East': east_val,
                'North': north_val,
                'Elevation': elev_val
            })
        except (ValueError, TypeError):
            continue

    wb.close()

    df_survey = pd.DataFrame(stations)
    if not df_survey.empty:
        df_survey = df_survey.sort_values(by='Depth').reset_index(drop=True)
        collar = {
            'East': float(df_survey.iloc[0]['East']),
            'North': float(df_survey.iloc[0]['North']),
            'Elevation': float(df_survey.iloc[0]['Elevation']),
            'Dip': float(df_survey.iloc[0]['Dip']),
            'Azimuth': float(df_survey.iloc[0]['Azimuth']),
            'Total_Depth': float(df_survey.iloc[-1]['Depth'])
        }
    else:
        collar = {
            'East': 0.0, 'North': 0.0, 'Elevation': 0.0,
            'Dip': -90.0, 'Azimuth': 0.0, 'Total_Depth': 0.0
        }

    return {
        'metadata': metadata,
        'collar': collar,
        'survey_df': df_survey,
        'has_gyro': not df_survey.empty
    }


def desurvey_assay_intervals(df_assays: pd.DataFrame, df_survey: pd.DataFrame) -> pd.DataFrame:
    """
    Asigna a cada intervalo geoquímico (From, To) su coordenada 3D exacta (X, Y, Z)
    en el espacio real de la mina, interpolando a lo largo de las estaciones de giroscopía.
    Retorna el DataFrame enriquecido con ['Mid_X', 'Mid_Y', 'Mid_Z', 'Mid_Depth'].
    """
    if df_assays.empty or df_survey.empty:
        return df_assays

    df_res = df_assays.copy()

    if 'From' in df_res.columns and 'To' in df_res.columns:
        df_res['Mid_Depth'] = (df_res['From'] + df_res['To']) / 2.0
    else:
        df_res['Mid_Depth'] = df_res.index * 2.0 + 1.0

    s_depths = df_survey['Depth'].values
    s_easts = df_survey['East'].values
    s_norths = df_survey['North'].values
    s_elevs = df_survey['Elevation'].values
    s_dips = df_survey['Dip'].values
    s_azims = df_survey['Azimuth'].values

    mid_depths = df_res['Mid_Depth'].values
    df_res['Mid_X'] = np.interp(mid_depths, s_depths, s_easts)
    df_res['Mid_Y'] = np.interp(mid_depths, s_depths, s_norths)
    df_res['Mid_Z'] = np.interp(mid_depths, s_depths, s_elevs)
    df_res['Interp_Dip'] = np.interp(mid_depths, s_depths, s_dips)
    df_res['Interp_Azimuth'] = np.interp(mid_depths, s_depths, s_azims)

    return df_res


def extract_all_collars(gyro_map: Dict[str, str], use_cache: bool = True) -> pd.DataFrame:
    cache_path = os.path.join(os.path.dirname(__file__), 'collars_cache.csv')
    if use_cache and os.path.exists(cache_path):
        try:
            df_cache = pd.read_csv(cache_path)
            if not df_cache.empty and 'East' in df_cache.columns:
                return df_cache.sort_values(by='Hole_ID').reset_index(drop=True)
        except Exception:
            pass

    from concurrent.futures import ThreadPoolExecutor
    def parse_single_collar_fast(item):
        h_id, fpath = item
        try:
            wb = openpyxl.load_workbook(fpath, data_only=True, read_only=True)
            sheet_name = 'MEDICION' if 'MEDICION' in wb.sheetnames else wb.sheetnames[0]
            ws = wb[sheet_name]
            meta = {'UBICACION': 'General', 'INSTRUMENTO': '-', 'FECHA': '-'}
            header_row = 15
            row_data = []
            for r, row in enumerate(ws.iter_rows(max_row=25, values_only=True), 1):
                if r <= 12:
                    k = str(row[0] or '').strip().upper()
                    v = str(row[1] or '').strip()
                    if 'UBICACI' in k or 'FASE' in k: meta['UBICACION'] = v
                    elif 'INSTRUMENTO' in k: meta['INSTRUMENTO'] = v
                    elif 'FECHA' in k: meta['FECHA'] = v
                if 'profundidad' in str(row[1] or '').lower():
                    header_row = r
                if r > header_row and row[1] is not None:
                    try:
                        row_data.append((float(row[1]), float(row[2]), float(row[3]), float(row[4]), float(row[5]), float(row[6])))
                    except:
                        pass
            wb.close()
            if row_data:
                c0 = row_data[0]
                return {
                    'Hole_ID': h_id,
                    'East': c0[3],
                    'North': c0[4],
                    'Elevation': c0[5],
                    'Dip': c0[1],
                    'Azimuth': c0[2],
                    'Total_Depth': row_data[-1][0],
                    'Fase': meta['UBICACION'],
                    'Instrumento': meta['INSTRUMENTO'],
                    'Fecha': meta['FECHA']
                }
        except Exception:
            pass
        return None

    with ThreadPoolExecutor(max_workers=12) as executor:
        results = list(executor.map(parse_single_collar_fast, gyro_map.items()))

    collars = [r for r in results if r is not None]
    if collars:
        df_res = pd.DataFrame(collars).sort_values(by='Hole_ID').reset_index(drop=True)
        try:
            df_res.to_csv(cache_path, index=False)
        except Exception:
            pass
        return df_res
    return pd.DataFrame(columns=['Hole_ID', 'East', 'North', 'Elevation', 'Dip', 'Azimuth', 'Total_Depth', 'Fase'])
