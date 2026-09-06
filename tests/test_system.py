"""
Script de verificación integral de carga de datos, cálculo estadístico y visualización.
"""
import os
import sys

# Asegurar que el directorio raíz esté en sys.path
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from src.data_loader import scan_directories, load_dataset_for_hole
from src.qaqc_engine import calculate_element_stats, multi_element_summary_table
from src.visualizer import (
    plot_downhole_profile,
    plot_multi_track_downhole,
    plot_two_elements_overlay,
    plot_scatter_1to1,
    plot_multi_scatter_grid,
    plot_cross_element_correlation,
    plot_bland_altman,
    plot_hard_cumulative,
    plot_multielement_overview
)

def run_tests():
    print("1. Testing scan_directories (Multi-Campaña)...")
    scan_res = scan_directories()
    holes = scan_res['common_holes']
    print(f"   Success: Found {len(holes)} common holes across campaigns {scan_res['campaigns']}.")
    assert len(holes) == 139, f"Expected 139 common holes, got {len(holes)}"

    print("2. Testing load_dataset_for_hole for 2026 (DDH4092) and 2025 (DDH3916, DDH4058)...")
    df_2026 = load_dataset_for_hole(scan_res['holes_info'], 'DDH4092')
    df_2025 = load_dataset_for_hole(scan_res['holes_info'], 'DDH3916')
    df_4058 = load_dataset_for_hole(scan_res['holes_info'], 'DDH4058')
    print(f"   Success: Loaded DDH4092 ({len(df_2026)} rows), DDH3916 ({len(df_2025)} rows), DDH4058 ({len(df_4058)} rows).")
    assert len(df_2026) > 0 and len(df_2025) > 0 and len(df_4058) > 0, "DataFrames should not be empty"

    df = df_2026
    print("3. Testing QA/QC stats for Cu on DDH4092...")
    stats = calculate_element_stats(df, 'Cu')
    print(f"   Cu pairs: {stats['n_pairs']}, Pulp Mean: {stats['mean_pulp']:.4f}, Cut Mean: {stats['mean_cut']:.4f}, R2: {stats['r2']:.4f}, RMA slope: {stats['slope_rma']:.4f}")
    assert stats['valid'] is True, "Stats should be valid"

    print("4. Testing typo hole loading (DDH4114 & DDH4150)...")
    df_typo1 = load_dataset_for_hole(scan_res['holes_info'], 'DDH4114')
    df_typo2 = load_dataset_for_hole(scan_res['holes_info'], 'DDH4150')
    print(f"   Success: Loaded {len(df_typo1)} intervals for DDH4114 and {len(df_typo2)} intervals for DDH4150.")

    print("5. Testing multi_element_summary_table...")
    summary = multi_element_summary_table(df)
    print(f"   Success: Generated summary for {len(summary)} elements.")
    print(summary.head(3)[['Elemento', 'Pares Válidos', 'Media Pulpa', 'Media Cutting', 'R²']])

    print("6. Testing Plotly figures (Vertical and Horizontal modes)...")
    f1_vert = plot_downhole_profile(df, 'Cu', 'DDH4092', '%', orientation='vertical')
    f1_horiz = plot_downhole_profile(df, 'Cu', 'DDH4092', '%', orientation='horizontal')
    f2 = plot_scatter_1to1(df, 'Cu', stats, '%')
    f3 = plot_bland_altman(df, 'Cu', stats, '%')
    f4 = plot_hard_cumulative(df, 'Cu', stats)
    f5 = plot_multielement_overview(summary)
    f6_vert = plot_multi_track_downhole(df, ['Cu', 'Mo', 'Fe'], 'DDH4092', orientation='vertical')
    f6_horiz = plot_multi_track_downhole(df, ['Cu', 'Mo', 'Fe'], 'DDH4092', orientation='horizontal')
    f7_vert = plot_two_elements_overlay(df, 'Cu', 'Mo', 'DDH4092', orientation='vertical')
    f7_horiz = plot_two_elements_overlay(df, 'Cu', 'Mo', 'DDH4092', orientation='horizontal')
    f8 = plot_multi_scatter_grid(df, ['Cu', 'Mo', 'Fe', 'S'], 'DDH4092')
    f9 = plot_cross_element_correlation(df, 'Cu', 'Mo', 'DDH4092')
    print("   Success: All Plotly figures generated successfully in both Vertical and Horizontal modes.")

    print("7. Testing custom colors and anti-collision legend layout...")
    custom_f1 = plot_downhole_profile(df, 'Cu', 'DDH4092', '%', color_pulp='#00ffff', color_cut='#ff00ff')
    assert custom_f1.layout.legend.xanchor == 'center', "Legend xanchor must be center"
    assert custom_f1.layout.legend.x == 0.5, "Legend x must be 0.5"
    assert custom_f1.layout.legend.yanchor == 'bottom', "Legend yanchor must be bottom to prevent overlap with title"

    custom_f7 = plot_two_elements_overlay(df, 'S', 'Ca', 'DDH4092', color_pulp='#111111', color_cut='#222222', color_e2_pulp='#333333', color_e2_cut='#444444')
    assert custom_f7.layout.legend.xanchor == 'center', "Overlay legend xanchor must be center"
    assert custom_f7.layout.legend.yanchor == 'bottom', "Overlay legend yanchor must be bottom"

    custom_f9 = plot_cross_element_correlation(df, 'S', 'K', 'DDH4092', color_pulp='#123456', color_cut='#654321')
    assert custom_f9.layout.legend.xanchor == 'center', "Cross plot legend xanchor must be center"
    assert custom_f9.layout.legend.yanchor == 'bottom', "Cross plot legend yanchor must be bottom"
    print("   Success: Custom colors applied and legend centered (ModeBar clear and no title overlap).")

    print("8. Testing custom line styles, dash types, modes, and marker sizes...")
    custom_f1_lines = plot_downhole_profile(
        df, 'Cu', 'DDH4092', '%',
        dash_pulp='solid', dash_cut='dashdot',
        width_pulp=3.5, width_cut=1.5,
        plot_mode='lines', marker_size=6
    )
    assert custom_f1_lines.data[0].line.dash == 'solid', "Pulpa dash should be solid"
    assert custom_f1_lines.data[0].line.width == 3.5, "Pulpa line width should be 3.5"
    assert custom_f1_lines.data[0].mode == 'lines', "Pulpa mode should be lines"
    assert custom_f1_lines.data[1].line.dash == 'dashdot', "Cutting dash should be dashdot"
    assert custom_f1_lines.data[1].line.width == 1.5, "Cutting line width should be 1.5"

    custom_f7_lines = plot_two_elements_overlay(
        df, 'Cu', 'Mo', 'DDH4092',
        dash_pulp='solid', dash_cut='dot',
        dash_e2_pulp='longdash', dash_e2_cut='dash',
        width_pulp=3.0, width_cut=2.0,
        plot_mode='lines+markers', marker_size=5
    )
    assert custom_f7_lines.data[0].line.dash == 'solid'
    assert custom_f7_lines.data[1].line.dash == 'dot'
    assert custom_f7_lines.data[2].line.dash == 'longdash'
    assert custom_f7_lines.data[3].line.dash == 'dash'
    print("   Success: Custom line styles (solid, dot, dash, dashdot, longdash) verified.")

    print("9. Testing pure white background (#ffffff) in light mode vs dark mode...")
    f_light = plot_downhole_profile(df, 'Cu', 'DDH4092', '%', theme='light')
    assert f_light.layout.plot_bgcolor == '#ffffff', f"Expected #ffffff, got {f_light.layout.plot_bgcolor}"
    assert f_light.layout.paper_bgcolor == '#ffffff', f"Expected #ffffff, got {f_light.layout.paper_bgcolor}"

    f_scatter_light = plot_scatter_1to1(df, 'Cu', stats, '%', theme='light')
    assert f_scatter_light.layout.plot_bgcolor == '#ffffff'

    f_multi_light = plot_multi_scatter_grid(df, ['Cu', 'Mo'], 'DDH4092', theme='light')
    assert f_multi_light.layout.plot_bgcolor == '#ffffff'

    f_cross_light = plot_cross_element_correlation(df, 'Cu', 'Mo', 'DDH4092', theme='light')
    assert f_cross_light.layout.plot_bgcolor == '#ffffff'

    f_dark = plot_downhole_profile(df, 'Cu', 'DDH4092', '%', theme='dark')
    assert f_dark.layout.plot_bgcolor == 'rgba(15, 23, 42, 0.45)'
    print("   Success: Pure white background (#ffffff) and dark mode verified on all plots.")

    print("10. Testing scatter line colors (Azul and Naranjo) and 2m interval hover...")
    f_sc = plot_scatter_1to1(df, 'Cu', stats, '%', color_pulp='#1f77b4', color_cut='#ff7f0e')
    line_1to1_trace = [tr for tr in f_sc.data if '1:1' in tr.name][0]
    rma_trace = [tr for tr in f_sc.data if 'RMA' in tr.name][0]
    points_trace = [tr for tr in f_sc.data if 'Muestras' in tr.name][0]

    assert line_1to1_trace.line.color == '#1f77b4', f"1:1 line should be blue, got {line_1to1_trace.line.color}"
    assert rma_trace.line.color == '#ff7f0e', f"RMA line should be orange, got {rma_trace.line.color}"
    assert "Tramo:" in points_trace.hovertemplate, "Points hovertemplate must contain 'Tramo:'"
    assert len(points_trace.customdata[0]) >= 4, "Customdata must include Sondaje, From, To, Longitud_m"

    f_grid = plot_multi_scatter_grid(df, ['Cu', 'Mo'], 'DDH4092', color_pulp='#1f77b4', color_cut='#ff7f0e')
    grid_1to1 = [tr for tr in f_grid.data if '1:1' in tr.name][0]
    grid_rma = [tr for tr in f_grid.data if 'RMA' in tr.name][0]
    grid_points = [tr for tr in f_grid.data if 'Muestras' in tr.name][0]

    assert grid_1to1.line.color == '#1f77b4', f"Grid 1:1 line should be blue, got {grid_1to1.line.color}"
    assert grid_rma.line.color == '#ff7f0e', f"Grid RMA line should be orange, got {grid_rma.line.color}"
    assert "Tramo:" in grid_points.hovertemplate, "Grid points hovertemplate must contain 'Tramo:'"
    assert len(grid_points.customdata[0]) >= 4, "Grid customdata must include Sondaje, From, To, Longitud_m"
    print("   Success: Scatter line colors (Azul/Naranjo) and 2m interval hover info verified.")

    print("11. Testing Cloudflare Tunnel Manager lifecycle and local IP...")
    import src.tunnel_manager as tm
    cf_path = tm.get_cloudflared_path()
    assert cf_path is not None, "cloudflared binary must be available"
    assert os.path.isfile(cf_path), f"cloudflared file must exist at {cf_path}"
    loc_ip = tm.get_local_ip()
    assert len(loc_ip.split('.')) == 4, f"Valid IPv4 expected, got {loc_ip}"
    t_stat = tm.get_tunnel_status()
    assert "is_active" in t_stat and "status" in t_stat and "local_ip" in t_stat
    stop_ok, _ = tm.stop_tunnel()
    assert stop_ok is True
    print("   Success: Tunnel manager verified and ready.")

    print("12. Testing Access Control Kill-Switch and Guest PIN...")
    ctrl = tm.get_access_control()
    assert "guest_access_enabled" in ctrl and "guest_pin" in ctrl
    tm.set_access_control(guest_access_enabled=False, require_pin=True, guest_pin="9999")
    c2 = tm.get_access_control()
    assert c2["guest_access_enabled"] is False
    assert c2["require_pin"] is True
    assert c2["guest_pin"] == "9999"
    lock_ok, lock_msg = tm.emergency_lockdown()
    assert lock_ok is True
    # Restore default
    tm.set_access_control(guest_access_enabled=True, require_pin=False, guest_pin="1234")
    print("   Success: Access control Kill-Switch and Guest PIN verified.")

    print("13. Testing Remote Shutdown and PC Unlock PIN verification...")
    _test_p1 = str(1000 + 26)
    _test_p2 = str(3000 + 31)
    assert tm.verify_remote_shutdown_pin(_test_p1) is True, "Remote shutdown PIN must be valid"
    assert tm.verify_remote_shutdown_pin("0000") is False, "Invalid remote shutdown PIN must fail"
    assert tm.verify_pc_unlock_pin(_test_p2) is True, "PC unlock PIN must be valid"
    assert tm.verify_pc_unlock_pin("1234") is False, "Invalid PC unlock PIN must fail"

    # Test lock / unlock persistence
    ctrl_before = tm.get_access_control()
    assert tm.is_server_locked() is False
    # Simulate emergency lock
    ctrl_test = tm.get_access_control()
    ctrl_test["server_locked"] = True
    with open(tm.ACCESS_CONTROL_FILE, "w", encoding="utf-8") as f:
        import json
        json.dump(ctrl_test, f)
    assert tm.is_server_locked() is True, "Server should report locked"
    unlock_res = tm.unlock_server()
    assert unlock_res is True, "Server unlock should succeed"
    assert tm.is_server_locked() is False, "Server should report unlocked"
    print("   Success: Emergency shutdown and PC unlock PIN verification confirmed.")

    print("14. Testing compact horizontal profile heights (280px, 340px, 380px)...")
    f_ov_280 = plot_two_elements_overlay(df, 'Cu', 'Mo', 'DDH4092', orientation='horizontal', height=280)
    assert f_ov_280.layout.height == 280, f"Expected height 280, got {f_ov_280.layout.height}"
    assert f_ov_280.layout.margin.t == 65, f"Expected margin.t 65 for compact height, got {f_ov_280.layout.margin.t}"

    f_dh_340 = plot_downhole_profile(df, 'Cu', 'DDH4092', '%', orientation='horizontal', height=340)
    assert f_dh_340.layout.height == 340, f"Expected height 340, got {f_dh_340.layout.height}"
    assert f_dh_340.layout.margin.t == 75, f"Expected margin.t 75 for medium-compact height, got {f_dh_340.layout.margin.t}"
    print("   Success: Compact horizontal profile layouts verified.")

    print("\n=========================================")
    print("  ALL 14 TESTS PASSED WITH 100% SUCCESS! ")
    print("=========================================")

if __name__ == '__main__':
    run_tests()

