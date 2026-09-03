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

        // 2. Temperatura local (gradiente latitudinal + gradiente altotérmico -6.5°C / 1000m)
        const latCooling = Math.pow(absLat / 90.0, 2) * 42.0;
        const altCooling = (!isWater && elevationM > 0) ? (elevationM / 1000) * 6.5 : 0;
        const localTemp = Math.round((cur.meanTemp + 14 - latCooling - altCooling) * 10) / 10;

        // 3. Presión barométrica local (fórmula hipsométrica barométrica)
        const pressureAtm = !isWater ? 
            Math.round(cur.surfacePressure * Math.exp(-Math.max(0, elevationM) / 8400) * 100) / 100 : 
            cur.surfacePressure;

        // 4. Radiación UV local
        let uvIndex = Math.max(0, Math.round((12 - (absLat / 90) * 8) * (1.0 - cur.cloudDensity * 0.5)));
        if (cur.o2 < 10) uvIndex *= 2.5; // Sin capa de ozono
        if (window.astrophysicsEngine && window.astrophysicsEngine.params.magneticField < 0.2) uvIndex *= 2.0;

        // 5. Análisis Geo-Biológico
        let biomeName = '';
        let soilAnalysis = '';
        let waterAnalysis = 'N/A (Tierra firme emergida)';

        if (isWater) {
            biomeName = localTemp < -2 ? 'Banquisa Glaciar Marina' : (absLat < 25 ? 'Océano Tropical Pelágico' : 'Océano Abisal Templado');
            soilAnalysis = 'Sedimentos marinos pelágicos y lodos silíceos/calcáreos';
            
            const ph = cur.hasLife ? (8.1 - (cur.co2 / 3000) * 0.8).toFixed(1) : '5.8 (Acidificación carbónica extrema)';
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
