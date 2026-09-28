/**
 * Survey Module: Sonda orbital de muestreo in situ por coordenadas y
 * gestión de modos de escaneo satelital (Óptico, Térmico FLIR, NDVI de Biomasa y Magnetosfera).
 */
class SurveyEngine {
    constructor(simulation, viewer) {
        this.simulation = simulation;
        this.viewer = viewer;

        this.currentViewMode = 'optical'; // 'optical', 'thermal', 'ndvi', 'magnetic'
        this.isProbeActive = false;
    }

    setViewMode(mode) {
        this.currentViewMode = mode;
        if (this.viewer && this.viewer.earthUniforms) {
            // Mapeo numérico para el shader: 0=óptico, 1=térmico, 2=ndvi, 3=magnético
            const modeMap = { optical: 0.0, thermal: 1.0, ndvi: 2.0, magnetic: 3.0 };
            this.viewer.earthUniforms.uViewMode.value = modeMap[mode] !== undefined ? modeMap[mode] : 0.0;
            
            // Alternar líneas de dipolo magnético 3D
            if (this.viewer.setMagneticFieldVisible) {
                this.viewer.setMagneticFieldVisible(mode === 'magnetic');
            }
        }

        // Actualizar widget de Leyenda Radiométrica Científica
        const legend = document.getElementById('scanner-legend');
        const legendTitle = document.getElementById('legend-title');
        const legendUnit = document.getElementById('legend-unit');
        const legendBar = document.getElementById('legend-gradient-bar');
        const legendLabels = document.getElementById('legend-labels');

        if (legend && legendTitle && legendUnit && legendBar && legendLabels) {
            if (mode === 'thermal') {
                legend.classList.remove('hidden');
                legendTitle.textContent = 'RADIOMETRÍA TÉRMICA FLIR';
                legendUnit.textContent = '[-50°C a +50°C]';
                legendBar.className = 'legend-bar legend-flir';
                legendLabels.innerHTML = '<span>-50°C (Polar)</span><span>-25°C</span><span>0°C (Deshielo)</span><span>+25°C</span><span>+50°C (Tórrido)</span>';
            } else if (mode === 'ndvi') {
                legend.classList.remove('hidden');
                legendTitle.textContent = 'ÍNDICE DE VEGETACIÓN NDVI (BIOMASA)';
                legendUnit.textContent = '[0.00 a 1.00 NDVI]';
                legendBar.className = 'legend-bar legend-ndvi';
                legendLabels.innerHTML = '<span>0.0 (Océano/Inerte)</span><span>0.25 (Estepa)</span><span>0.50 (Bosque)</span><span>0.75 (Selva)</span><span>1.0 (Máx. Clorofila)</span>';
            } else {
                legend.classList.add('hidden');
            }
        }
    }

    /**
     * Realiza un escaneo científico in situ en las coordenadas indicadas
     */
    analyzePoint(latDeg, lonDeg, isWater, topoElev) {
        const cur = this.simulation.current;
        const absLat = Math.abs(latDeg);

        // 1. Elevación topográfica aproximada en metros
        const elevationM = isWater ? -Math.round((1.0 - topoElev) * 4500) : Math.round(topoElev * 6000);

        // 2. Temperatura local: banda de latitud del modelo de balance energético + gradiente de −6,5 °C/km (atmósfera estándar ISA)
        const T = this.simulation.T;
        const banda = Math.min(T.length - 1, Math.floor((Math.sin(latDeg * Math.PI / 180) + 1) / 2 * T.length));
        const altCooling = (!isWater && elevationM > 0) ? (elevationM / 1000) * 6.5 : 0;
        const localTemp = Math.round((T[banda] - altCooling) * 10) / 10;

        // 3. Presión local: P = P₀ exp(−z/H), escala de altura H = R T / (M g) = 287·T/9,81 ≈ 8,4 km a 15 °C (atmósfera isoterma)
        const H = 287 * (localTemp + altCooling + 273.15) / 9.81;
        const pressureAtm = !isWater ?
            Math.round(cur.surfacePressure * Math.exp(-Math.max(0, elevationM) / H) * 100) / 100 :
            cur.surfacePressure;

        // 4. Índice UV al mediodía: ∝ cos(cenit) y atenuado por nubes; sin ozono el UV-B crece un orden de magnitud
        //    (Segura et al. 2003). El campo magnético NO filtra UV (desvía partículas cargadas), por eso no interviene.
        // simplificación: cielo despejado con índice 12 en el ecuador en equinoccio (OMS 2002).
        const escudoO3 = Math.min(1, cur.o2 / 2.1);
        let uvIndex = Math.max(0, Math.round(12 * Math.cos(latDeg * Math.PI / 180) * (1.0 - cur.cloudDensity * 0.5) * (1 + 9 * (1 - escudoO3))));

        // 5. Análisis Geo-Biológico
        let biomeName = '';
        let soilAnalysis = '';
        let waterAnalysis = 'N/A (Tierra firme emergida)';

        if (isWater) {
            biomeName = localTemp < -2 ? 'Banquisa Glaciar Marina' : (absLat < 25 ? 'Océano Tropical Pelágico' : 'Océano Abisal Templado');
            soilAnalysis = 'Sedimentos marinos pelágicos y lodos silíceos/calcáreos';
            
            // pH superficial con alcalinidad constante: [H⁺] ∝ pCO₂^0,77 → pH = 8,17 − 0,77·log₁₀(CO₂/280)
            // (preindustrial 8,17, hoy 8,05; Zeebe & Wolf-Gladrow 2001; IPCC AR6 cap. 5).
            // simplificación: en escalas geológicas la meteorización sube la alcalinidad y amortigua la acidificación.
            const ph = (8.17 - 0.77 * Math.log10(Math.max(1, cur.co2) / 280)).toFixed(2);
            const salinity = (35 + (cur.meanTemp > 25 ? 4 : 0)).toFixed(1);
            waterAnalysis = `pH: ${ph} | Salinidad: ${salinity} PSU | Profundidad: ${Math.abs(elevationM)} m`;
        } else {
            if (localTemp < -10) {
                biomeName = 'Desierto Polar / Casquete Glaciar';
                soilAnalysis = 'Permafrost criogénico y hielo compactado';
            } else if (absLat > 15 && absLat < 35 && cur.meanTemp > 10) {
                biomeName = cur.hasLife ? 'Desierto Árido de Dunas' : 'Regolito Basáltico Desnudo';
                soilAnalysis = 'Arenas silíceas ricas en cuarzo y óxidos de hierro (Fe₂O₃)';
            } else if (absLat < 15) {
                biomeName = cur.hasLife ? 'Selva Tropical Húmeda' : 'Lecho Rocoso Oxidado por Radiación';
                soilAnalysis = cur.hasLife ? 'Humus fértil rico en materia orgánica y arcillas' : 'Roca volcánica meteorizada';
            } else {
                biomeName = cur.hasLife ? 'Bosque Templado / Pradera' : 'Planicie de Arenisca y Basalto';
                soilAnalysis = cur.hasLife ? 'Suelo franco-arenoso estabilizado por micorrizas' : 'Canto rodado y arenas eólicas';
            }
        }

        return {
            lat: latDeg,
            lon: lonDeg,
            elevationM,
            localTemp,
            pressureAtm,
            uvIndex,
            biomeName,
            soilAnalysis,
            waterAnalysis,
            isWater
        };
    }
}

window.SurveyEngine = SurveyEngine;
