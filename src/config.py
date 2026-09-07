"""
Módulo de Configuración y Constantes del Sistema de Comparación FRX.
"""
import os
import re

PULP_ROOT = r"C:\Users\cemge\OneDrive - GEOATACAMA CONSULTORES LTDA\CEM Muestrera\FRX\Pulpas\Campaña 2023 - 2024\REPORTE MLP ( POR PULPA )"
if os.path.exists(PULP_ROOT):
    _pulp_subdirs = [
        os.path.join(PULP_ROOT, d) for d in os.listdir(PULP_ROOT)
        if os.path.isdir(os.path.join(PULP_ROOT, d)) and d.isdigit()
    ]
    DEFAULT_PULP_PATHS = sorted(_pulp_subdirs, reverse=True) if _pulp_subdirs else [
        os.path.join(PULP_ROOT, "2026"),
        os.path.join(PULP_ROOT, "2025")
    ]
else:
    DEFAULT_PULP_PATHS = [
        r"C:\Users\cemge\OneDrive - GEOATACAMA CONSULTORES LTDA\CEM Muestrera\FRX\Pulpas\Campaña 2023 - 2024\REPORTE MLP ( POR PULPA )\2026",
        r"C:\Users\cemge\OneDrive - GEOATACAMA CONSULTORES LTDA\CEM Muestrera\FRX\Pulpas\Campaña 2023 - 2024\REPORTE MLP ( POR PULPA )\2025"
    ]

CUTTING_ROOT = r"C:\Users\cemge\OneDrive - GEOATACAMA CONSULTORES LTDA\CEM Muestrera\FRX\Cutting"
DEFAULT_CUTTING_PATHS = []
if os.path.exists(CUTTING_ROOT):
    for _c_dir in sorted(os.listdir(CUTTING_ROOT), reverse=True):
        _full_c = os.path.join(CUTTING_ROOT, _c_dir)
        if os.path.isdir(_full_c) and 'camp' in _c_dir.lower():
            for _sub in os.listdir(_full_c):
                if 'reporte' in _sub.lower() and 'sondaje' in _sub.lower() and 'sg' not in _sub.lower():
                    DEFAULT_CUTTING_PATHS.append(os.path.join(_full_c, _sub))

if not DEFAULT_CUTTING_PATHS:
    DEFAULT_CUTTING_PATHS = [
        r"C:\Users\cemge\OneDrive - GEOATACAMA CONSULTORES LTDA\CEM Muestrera\FRX\Cutting\Campaña 2025-2031\REPORTE MLP (Por sondaje)",
        r"C:\Users\cemge\OneDrive - GEOATACAMA CONSULTORES LTDA\CEM Muestrera\FRX\Cutting\Campaña 2023-2025\REPORTE MLP (POR SONDAJE)"
    ]

DEFAULT_PULP_PATH = DEFAULT_PULP_PATHS[0]
DEFAULT_CUTTING_PATH = DEFAULT_CUTTING_PATHS[0]
DEFAULT_GYRO_PATH = r"C:\Users\cemge\OneDrive - GEOATACAMA CONSULTORES LTDA\CEM Muestrera\Medición\Giroscopia"

# Elementos prioritarios para accesos rápidos en la interfaz
PRIORITY_ELEMENTS = ['Cu', 'Fe', 'Mo', 'As', 'S', 'Zn', 'Pb', 'Ti']

# Catálogo completo de elementos y sus unidades estándar reportadas
ELEMENT_CATALOG = {
    'Cu': {'name': 'Cobre', 'unit': '%', 'category': 'Mayor / Económico'},
    'Mo': {'name': 'Molibdeno', 'unit': 'PPM', 'category': 'Mayor / Económico'},
    'Fe': {'name': 'Hierro', 'unit': '%', 'category': 'Mayor / Matriz'},
    'As': {'name': 'Arsénico', 'unit': 'PPM', 'category': 'Penalizable / Guía'},
    'S': {'name': 'Azufre', 'unit': '%', 'category': 'Mayor / Sulfuros'},
    'Al': {'name': 'Aluminio', 'unit': '%', 'category': 'Silicatos / Alteración'},
    'Si': {'name': 'Silicio', 'unit': '%', 'category': 'Silicatos / Matriz'},
    'Ca': {'name': 'Calcio', 'unit': '%', 'category': 'Carbonatos / Alteración'},
    'K': {'name': 'Potasio', 'unit': '%', 'category': 'Alteración Potásica'},
    'Ti': {'name': 'Titanio', 'unit': '%', 'category': 'Accesorio / Inmóvil'},
    'Mn': {'name': 'Manganeso', 'unit': '%', 'category': 'Mayor / Óxidos'},
    'Mg': {'name': 'Magnesio', 'unit': '%', 'category': 'Silicatos / Carbonatos'},
    'P': {'name': 'Fósforo', 'unit': '%', 'category': 'Accesorio / Apatita'},
    'Zn': {'name': 'Zinc', 'unit': '%', 'category': 'Metal Base'},
    'Pb': {'name': 'Plomo', 'unit': '%', 'category': 'Metal Base'},
    'Ni': {'name': 'Níquel', 'unit': '%', 'category': 'Metal Base'},
    'Co': {'name': 'Cobalto', 'unit': '%', 'category': 'Accesorio'},
    'Cr': {'name': 'Cromo', 'unit': '%', 'category': 'Accesorio'},
    'V': {'name': 'Vanadio', 'unit': '%', 'category': 'Accesorio'},
    'Ag': {'name': 'Plata', 'unit': '%', 'category': 'Precioso'},
    'Au': {'name': 'Oro', 'unit': '%', 'category': 'Precioso'},
    'Zr': {'name': 'Circonio', 'unit': '%', 'category': 'Inmóvil / Circones'},
    'Sr': {'name': 'Estroncio', 'unit': '%', 'category': 'Trazas'},
    'Rb': {'name': 'Rubidio', 'unit': '%', 'category': 'Trazas'},
    'Nb': {'name': 'Niobio', 'unit': '%', 'category': 'Inmóvil'},
    'W': {'name': 'Wolframio', 'unit': '%', 'category': 'Especial'},
    'Sn': {'name': 'Estaño', 'unit': '%', 'category': 'Especial'},
    'Sb': {'name': 'Antimonio', 'unit': '%', 'category': 'Epitemal / Guía'},
    'Bi': {'name': 'Bismuto', 'unit': '%', 'category': 'Epitemal / Guía'},
    'Se': {'name': 'Selenio', 'unit': '%', 'category': 'Asociado Sulfuros'},
    'Cd': {'name': 'Cadmio', 'unit': '%', 'category': 'Trazas'},
    'Pd': {'name': 'Paladio', 'unit': '%', 'category': 'PGE'},
    'Cl': {'name': 'Cloro', 'unit': '%', 'category': 'Halógenos'},
    'Y': {'name': 'Itrio', 'unit': '%', 'category': 'Tierras Raras'},
    'Hg': {'name': 'Mercurio', 'unit': '%', 'category': 'Volátil'}
}

def normalize_hole_id(raw_name: str) -> str:
    """
    Normaliza el identificador de un sondaje para resolver discrepancias
    como DHH vs DDH, espacios en blanco o minúsculas.
    Ej: 'DHH4114' -> 'DDH4114', ' ddh 4092 ' -> 'DDH4092'
    """
    clean = str(raw_name).strip().upper()
    # Reemplazar DHH por DDH común en sondajes diamantina
    clean = re.sub(r'^DHH', 'DDH', clean)
    # Eliminar espacios intermedios si los hay
    clean = re.sub(r'\s+', '', clean)
    return clean

def extract_element_symbol(col_name: str) -> str:
    """
    Extrae el símbolo químico limpio a partir del encabezado de columna.
    Ej: 'Cu_SCI' -> 'Cu', 'Cu_pct' -> 'Cu', 'Mo_ppm' -> 'Mo', 'As_SCI' -> 'As'
    """
    clean = str(col_name).strip()
    # Ignorar columnas de metadatos conocidas
    if clean.upper() in ['Nº', 'N°', 'N', 'PESO', 'PESO (G)', 'ID', 'ID.', 'SONDAJE', 'DESDE', 'HASTA', 'FROM', 'TO', 'NONE', 'NAN', '']:
        return ""
    # Quitar sufijos conocidos
    clean = re.sub(r'(_SCI|_pct|_ppm|_PPM|_PCT|\(\w+\)|\(%\))$', '', clean, flags=re.IGNORECASE).strip()
    # Tomar primera palabra antes de guiones bajos o espacios
    clean = clean.split('_')[0].split(' ')[0]
    symbol = clean.capitalize() if len(clean) <= 2 else clean
    
    # Validar contra catálogo si está presente
    if symbol in ELEMENT_CATALOG:
        return symbol
    return symbol if symbol.upper() not in ['N', 'PESO', 'ID', 'EXTRA'] else ""

# PIN Maestro de Administrador (para acceso seguro a controles de servidor)
ADMIN_PIN = os.getenv("CTPP_ADMIN_PIN", "2026")
