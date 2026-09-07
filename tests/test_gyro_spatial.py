import os
import sys
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)
from src.gyro_loader import scan_gyro_directory, parse_gyro_certificate, desurvey_assay_intervals, extract_all_collars
from src.spatial_3d import plot_collar_map_2d, plot_drillholes_3d
from src.data_loader import scan_directories, load_dataset_for_hole

def test_gyro_and_spatial():
    # 1. Scan directory
    gyro_map = scan_gyro_directory()
    assert len(gyro_map) >= 300, f'Expected >= 300 gyro certificates, got {len(gyro_map)}'
    assert 'DDH4092' in gyro_map, 'DDH4092 should be in gyro map'
    assert 'DDH3866' in gyro_map, 'DDH3866 should be in gyro map'

    # 2. Parse DDH4092
    cert_4092 = parse_gyro_certificate(gyro_map['DDH4092'])
    assert cert_4092['has_gyro'] is True
    assert cert_4092['collar']['East'] > 50000
    assert cert_4092['collar']['North'] > 90000
    assert cert_4092['collar']['Elevation'] > 3000

    # 3. Parse DDH3866
    cert_3866 = parse_gyro_certificate(gyro_map['DDH3866'])
    assert cert_3866['has_gyro'] is True
    assert len(cert_3866['survey_df']) > 20

    # 4. Desurvey assays
    scan = scan_directories()
    df_4092 = load_dataset_for_hole(scan['holes_info'], 'DDH4092')
    df_4092_3d = desurvey_assay_intervals(df_4092, cert_4092['survey_df'])
    assert 'Mid_X' in df_4092_3d.columns
    assert 'Mid_Y' in df_4092_3d.columns
    assert 'Mid_Z' in df_4092_3d.columns
    assert not df_4092_3d['Mid_X'].isna().any()

    # 5. Extract collars and 2D map
    sample_gyro = {k: gyro_map[k] for k in list(gyro_map.keys())[:10]}
    df_collars = extract_all_collars(sample_gyro)
    assert len(df_collars) >= 10
    fig_2d = plot_collar_map_2d(df_collars, selected_hole='DDH4092')
    assert len(fig_2d.data) >= 1

    # 6. 3D Plot
    fig_3d = plot_drillholes_3d({'DDH4092': df_4092_3d}, color_by='Cu_Cut', selected_hole='DDH4092')
    assert len(fig_3d.data) >= 1
    print('All test_gyro_and_spatial assertions passed!')

if __name__ == '__main__':
    test_gyro_and_spatial()
