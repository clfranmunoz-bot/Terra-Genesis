/**
 * Main Application Orchestrator v4.0:
 * Integra Simulación, Visor 3D, Astrofísica, Geología (Walker),
 * Astrobiología (JWST / Redes Tróficas) y Sonda Orbital In Situ.
 */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Instanciación de Motores Científicos
    const simulation = new EarthSimulation();
    const viewer = new PlanetViewer('canvas-viewport', simulation);
    const astrophysics = new AstrophysicsEngine(simulation);
    const geology = new GeologyEngine(simulation);
    const astrobiology = new AstrobiologyEngine(simulation);
    const survey = new SurveyEngine(simulation, viewer);
    const tectonics = new TectonicsEngine(simulation);

    window.astrophysicsEngine = astrophysics;
    window.geologyEngine = geology;
    window.astrobiologyEngine = astrobiology;
    window.surveyEngine = survey;
    window.tectonicsEngine = tectonics;

    // 2. Elementos del DOM de Telemetría
    const valTemp = document.getElementById('val-temp');
    const barTemp = document.getElementById('bar-temp');
    const statusTemp = document.getElementById('status-temp');

    const valSea = document.getElementById('val-sea');
    const barSea = document.getElementById('bar-sea');
    const statusSea = document.getElementById('status-sea');

    const valWeathering = document.getElementById('val-weathering');
    const statusThermostat = document.getElementById('status-thermostat');

    const barCarnivores = document.getElementById('bar-carnivores');
    const valCarnivores = document.getElementById('val-carnivores');
    const barHerbivores = document.getElementById('bar-herbivores');
    const valHerbivores = document.getElementById('val-herbivores');
    const barProducers = document.getElementById('bar-producers');
    const valProducers = document.getElementById('val-producers');

    const valO2 = document.getElementById('val-o2');
    const barO2 = document.getElementById('bar-o2');
    const valCO2 = document.getElementById('val-co2');
    const barCO2 = document.getElementById('bar-co2');
    const valCH4 = document.getElementById('val-ch4');
    const barCH4 = document.getElementById('bar-ch4');
    const statusPressure = document.getElementById('status-pressure');

    const dominantCladeBadge = document.getElementById('dominant-clade');
    const dominantDesc = document.getElementById('dominant-desc');

    const displayEpoch = document.getElementById('display-epoch');
    const chronicleText = document.getElementById('chronicle-text');

    // 3. Controles de Astrofísica y Órbita
    const sliderObliquity = document.getElementById('slider-obliquity');
    const dispObliquity = document.getElementById('disp-obliquity');
    const toggleMoon = document.getElementById('toggle-moon');
    const selectStarType = document.getElementById('select-star-type');
    const sliderMagneticField = document.getElementById('slider-magnetic-field');
    const dispMagneticField = document.getElementById('disp-magnetic-field');

    // 4. Geología y Silicatos
    const toggleThermostat = document.getElementById('toggle-thermostat');
    const sliderSeaLevel = document.getElementById('slider-sea-level');
    const dispSliderSea = document.getElementById('disp-slider-sea');
    const floodImpactText = document.getElementById('flood-impact-text');

    // 5. Astrobiología y Pigmentos
    const selectPigment = document.getElementById('select-pigment');
    const toggleLife = document.getElementById('toggle-life');
    const lifeStateText = document.getElementById('life-state-text');

    // 6. Rotación y Capas
    const btnToggleRotation = document.getElementById('btn-toggle-rotation');
    const btnReverseRotation = document.getElementById('btn-reverse-rotation');
    const toggleClouds = document.getElementById('toggle-clouds');
    const toggleAtmosphere = document.getElementById('toggle-atmosphere');
    const btnNakedEarth = document.getElementById('btn-naked-earth');

    // 7. Modos de Escáner Satelital
    const scannerBtns = document.querySelectorAll('.scanner-btn');

    // 8. Puntería de Asteroide
    const btnTargetMeteor = document.getElementById('btn-target-meteor');
    const targetModeHud = document.getElementById('target-mode-hud');
    const btnCancelTarget = document.getElementById('btn-cancel-target');
    const targetCoordsText = document.getElementById('target-coords-text');
    const sliderMeteorSize = document.getElementById('slider-meteor-size');
    const dispMeteorSize = document.getElementById('disp-meteor-size');
    const sliderMeteorSpeed = document.getElementById('slider-meteor-speed');
    const dispMeteorSpeed = document.getElementById('disp-meteor-speed');
    const selectMeteorComp = document.getElementById('select-meteor-comp');
    const dispMeteorEnergy = document.getElementById('disp-meteor-energy');
    const dispMeteorCrater = document.getElementById('disp-meteor-crater');
    const impactAlertOverlay = document.getElementById('impact-alert-overlay');

    // 9. Modales (Sonda, JWST, Studio)
    const btnProbeMode = document.getElementById('btn-probe-mode');
    const probeModal = document.getElementById('probe-analysis-modal');
    const btnCloseProbe = document.getElementById('btn-close-probe');

    const btnJwstModal = document.getElementById('btn-jwst-modal');
    const jwstModal = document.getElementById('jwst-spectrum-modal');
    const btnCloseJwst = document.getElementById('btn-close-jwst');
    const jwstCanvas = document.getElementById('jwst-canvas');

    const btnScenarioStudio = document.getElementById('btn-scenario-studio');
    const scenarioStudioModal = document.getElementById('scenario-studio-modal');
    const btnCloseStudio = document.getElementById('btn-close-studio');
    const btnSaveScenario = document.getElementById('btn-save-scenario');
    const btnExportScenarios = document.getElementById('btn-export-scenarios');
    const btnImportScenarios = document.getElementById('btn-import-scenarios');
    const fileImportInput = document.getElementById('file-import-input');
    const scenariosCarousel = document.getElementById('scenarios-carousel');
    const btnReset = document.getElementById('btn-reset');

    const canvasViewport = document.getElementById('canvas-viewport');

    let isTargetingActive = false;
    let isProbeActive = false;

    // ========================================================
    // GESTIÓN DE MODOS DE ESCÁNER SATELITAL
    // ========================================================
    scannerBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.getAttribute('data-view');
            if (!mode) return;
            scannerBtns.forEach(b => {
                if (b.getAttribute('data-view')) b.classList.remove('active');
            });
            btn.classList.add('active');
            survey.setViewMode(mode);
        });
    });

    // ========================================================
    // MODO ILUMINACIÓN GLOBAL (360° SIN NOCHE)
    // ========================================================
    let isGlobalLight = false;
    const btnToggleGlobalLight = document.getElementById('btn-toggle-global-light');
    const toggleGlobalLightCheck = document.getElementById('toggle-global-light-check');

    function setGlobalLightMode(enabled) {
        isGlobalLight = enabled;
        viewer.setGlobalLight(isGlobalLight);
        if (btnToggleGlobalLight) {
            btnToggleGlobalLight.classList.toggle('active', isGlobalLight);
            btnToggleGlobalLight.textContent = isGlobalLight ? '☀️ LUZ GLOBAL (ACTIVA)' : '☀️ LUZ GLOBAL (SIN NOCHE)';
        }
        if (toggleGlobalLightCheck) {
            toggleGlobalLightCheck.checked = isGlobalLight;
        }
    }

    if (btnToggleGlobalLight) {
        btnToggleGlobalLight.addEventListener('click', () => {
            setGlobalLightMode(!isGlobalLight);
        });
    }

    if (toggleGlobalLightCheck) {
        toggleGlobalLightCheck.addEventListener('change', (e) => {
            setGlobalLightMode(e.target.checked);
        });
    }

    // ========================================================
    // ========================================================
    // ESCALA DE TIEMPO GEOLÓGICO LATERAL DESPLEGABLE (-250 A +250 Ma)
    // ========================================================
    const sliderGeoTime = document.getElementById('slider-geological-time');
    const dispGeoTime = document.getElementById('disp-geological-time');
    const dispSideTimePreview = document.getElementById('disp-side-time-preview');
    const btnPlayTimeline = document.getElementById('btn-play-timeline');
    const btnResetTimeline = document.getElementById('btn-reset-timeline');
    const epochChips = document.querySelectorAll('.epoch-chip');
    const geologicalSideDrawer = document.getElementById('geological-side-drawer');
    const btnToggleTimeDrawer = document.getElementById('btn-toggle-time-drawer');
    const btnCloseTimeDrawer = document.getElementById('btn-close-time-drawer');

    let isTimelinePlaying = false;
    let timelinePlayDirection = 1;

    // Desplegar / Plegar cajón de tiempo lateral
    if (btnToggleTimeDrawer && geologicalSideDrawer) {
        btnToggleTimeDrawer.addEventListener('click', () => {
            geologicalSideDrawer.classList.remove('collapsed');
        });
    }
    if (btnCloseTimeDrawer && geologicalSideDrawer) {
        btnCloseTimeDrawer.addEventListener('click', () => {
            geologicalSideDrawer.classList.add('collapsed');
        });
    }

    function applyGeologicalTimeline(ma) {
        const state = tectonics.setTimeMa(ma);
        const sign = state.ma > 0 ? '+' : '';
        if (dispGeoTime) {
            dispGeoTime.textContent = `${state.period} (${sign}${state.ma} Ma)`;
        }
        if (dispSideTimePreview) {
            dispSideTimePreview.textContent = `${sign}${state.ma} Ma`;
        }
        displayEpoch.textContent = state.period;
        chronicleText.textContent = state.chronicle;
        dominantCladeBadge.textContent = state.clade;
        dominantDesc.textContent = state.desc;

        // Resaltar hito geológico activo más cercano
        epochChips.forEach(chip => {
            const chipMa = parseFloat(chip.getAttribute('data-ma'));
            if (Math.abs(chipMa - ma) < 35) {
                chip.classList.add('active');
            } else {
                chip.classList.remove('active');
            }
        });
    }

    if (sliderGeoTime) {
        sliderGeoTime.addEventListener('input', (e) => {
            isTimelinePlaying = false;
            if (btnPlayTimeline) btnPlayTimeline.textContent = '▶ ANIMAR DERIVA';
            applyGeologicalTimeline(parseFloat(e.target.value));
        });
    }

    if (btnPlayTimeline) {
        btnPlayTimeline.addEventListener('click', () => {
            isTimelinePlaying = !isTimelinePlaying;
            btnPlayTimeline.textContent = isTimelinePlaying ? '⏸ PAUSAR DERIVA' : '▶ ANIMAR DERIVA';
            btnPlayTimeline.classList.toggle('active-btn', isTimelinePlaying);
        });
    }

    if (btnResetTimeline) {
        btnResetTimeline.addEventListener('click', () => {
            isTimelinePlaying = false;
            if (btnPlayTimeline) btnPlayTimeline.textContent = '▶ ANIMAR DERIVA';
            if (sliderGeoTime) sliderGeoTime.value = 0;
            applyGeologicalTimeline(0);
        });
    }

    epochChips.forEach(chip => {
        chip.addEventListener('click', () => {
            isTimelinePlaying = false;
            if (btnPlayTimeline) btnPlayTimeline.textContent = '▶ ANIMAR DERIVA';
            const ma = parseFloat(chip.getAttribute('data-ma'));
            if (sliderGeoTime) sliderGeoTime.value = ma;
            applyGeologicalTimeline(ma);
        });
    });

    // ========================================================
    // CONTROL DE ASTROFÍSICA & ÓRBITA
    // ========================================================
    // GESTOR DE PESTAÑAS DE PARÁMETROS CIENTÍFICOS
    // ========================================================
    document.querySelectorAll('.p-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const targetId = tab.getAttribute('data-tab');
            document.querySelectorAll('.p-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            const targetPane = document.getElementById(targetId);
            if (targetPane) targetPane.classList.add('active');
        });
    });

    // ========================================================
    // 1. TAB: ASTROFÍSICA & DINÁMICA ORBITAL
    // ========================================================
    const sliderOrbitalDist = document.getElementById('slider-orbital-dist');
    const dispOrbitalDist = document.getElementById('disp-orbital-dist');
    const subOrbitalDist = document.getElementById('sub-orbital-dist');
    if (sliderOrbitalDist) {
        sliderOrbitalDist.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            dispOrbitalDist.textContent = `${val.toFixed(2)} UA`;
            const solarFlux = Math.round(1361.0 / (val * val));
            simulation.setParam('solarLuminosity', 1.0 / (val * val));
            if (subOrbitalDist) {
                subOrbitalDist.textContent = `Constante solar: ${solarFlux} W/m² (Insolación).`;
            }
        });
    }

    sliderObliquity.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        dispObliquity.textContent = `${val.toFixed(1)}°`;
        astrophysics.setObliquity(val);
    });

    const sliderRotationSpeed = document.getElementById('slider-rotation-speed');
    const dispRotationSpeed = document.getElementById('disp-rotation-speed');
    if (sliderRotationSpeed) {
        sliderRotationSpeed.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            dispRotationSpeed.textContent = `${val.toFixed(1)} h`;
            viewer.rotationSpeed = 24.0 / val;
        });
    }

    btnToggleRotation.addEventListener('click', () => {
        viewer.isRotationPaused = !viewer.isRotationPaused;
        btnToggleRotation.textContent = viewer.isRotationPaused ? '▶️ REANUDAR' : '⏸️ PAUSAR';
        btnToggleRotation.classList.toggle('active-btn', !viewer.isRotationPaused);
    });

    btnReverseRotation.addEventListener('click', () => {
        viewer.rotationSpeed = -viewer.rotationSpeed;
        btnReverseRotation.classList.toggle('active-btn', viewer.rotationSpeed < 0);
    });

    toggleMoon.addEventListener('change', (e) => {
        astrophysics.setMoon(e.target.checked);
        if (!e.target.checked) {
            displayEpoch.textContent = 'DERIVA CAÓTICA POR AUSENCIA LUNAR';
            chronicleText.textContent = 'Sin la estabilización giroscópica de la Luna, el eje de la Tierra oscila caóticamente entre 0° y 85° como en Marte, generando colapsos climáticos extremos y mareas reducidas.';
        }
    });

    selectStarType.addEventListener('change', (e) => {
        const type = e.target.value;
        astrophysics.setStarType(type);
        if (type === 'red_dwarf_m') {
            displayEpoch.textContent = 'TIERRA EN ÓRBITA DE ENANA ROJA (TRAPPIST-1)';
            chronicleText.textContent = 'El planeta ha caído en anclaje por marea (Tidal Locking). Un hemisferio es un desierto perpetuo expuesto a luz infrarroja y llamaradas UV, mientras el otro es un glaciar eterno.';
            selectPigment.value = 'black';
            astrobiology.setPigment('black');
        } else if (type === 'blue_giant') {
            displayEpoch.textContent = 'TIERRA EN ÓRBITA DE GIGANTE AZUL (RIGEL)';
            chronicleText.textContent = 'Radiación ultravioleta e ionizante extrema. La capa de ozono es bombardeada por fotones duros.';
            selectPigment.value = 'purple';
            astrobiology.setPigment('purple');
        } else {
            selectPigment.value = 'green';
            astrobiology.setPigment('green');
        }
    });

    sliderMagneticField.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        dispMagneticField.textContent = `${val.toFixed(1)}x`;
        astrophysics.setMagneticField(val);
    });

    // ========================================================
    // 2. TAB: QUÍMICA ATMOSFÉRICA & CLIMA
    // ========================================================
    const sliderCo2 = document.getElementById('slider-co2');
    const dispCo2 = document.getElementById('disp-co2');
    if (sliderCo2) {
        sliderCo2.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            dispCo2.textContent = `${Math.round(val)} ppm`;
            simulation.setParam('co2', val);
        });
    }

    const sliderO2 = document.getElementById('slider-o2');
    const dispO2 = document.getElementById('disp-o2');
    if (sliderO2) {
        sliderO2.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            dispO2.textContent = `${val.toFixed(1)} %`;
            simulation.setParam('o2', val);
        });
    }

    const sliderCh4 = document.getElementById('slider-ch4');
    const dispCh4 = document.getElementById('disp-ch4');
    if (sliderCh4) {
        sliderCh4.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            dispCh4.textContent = `${val.toFixed(1)} ppm`;
            simulation.setParam('ch4', val);
        });
    }

    const sliderSo2 = document.getElementById('slider-so2');
    const dispSo2 = document.getElementById('disp-so2');
    if (sliderSo2) {
        sliderSo2.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            dispSo2.textContent = `${Math.round(val)} ppm`;
            simulation.setParam('so2', val);
        });
    }

    const sliderCloudDensity = document.getElementById('slider-cloud-density');
    const dispCloudDensity = document.getElementById('disp-cloud-density');
    if (sliderCloudDensity) {
        sliderCloudDensity.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            dispCloudDensity.textContent = `${Math.round(val)} %`;
            simulation.setParam('cloudDensity', val / 100.0);
        });
    }

    const sliderSurfacePressure = document.getElementById('slider-surface-pressure');
    const dispSurfacePressure = document.getElementById('disp-surface-pressure');
    if (sliderSurfacePressure) {
        sliderSurfacePressure.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            dispSurfacePressure.textContent = `${val.toFixed(2)} atm`;
            simulation.setParam('surfacePressure', val);
        });
    }

    // ========================================================
    // 3. TAB: GEOLOGÍA & SILICATOS
    // ========================================================
    toggleThermostat.addEventListener('change', (e) => {
        geology.setThermostat(e.target.checked);
    });

    sliderSeaLevel.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        const sign = val >= 0 ? '+' : '';
        dispSliderSea.textContent = `${sign}${val} m`;
        simulation.setParam('seaLevelOffset', val);

        if (val <= -50) {
            floodImpactText.textContent = 'Glaciación profunda: emergen plataformas someras (Beringia, Doggerland).';
        } else if (val < 15) {
            floodImpactText.textContent = 'Nivel costero estándar (costas mundiales actuales).';
        } else if (val <= 75) {
            floodImpactText.textContent = 'Fusión polar total (+70m): Florida, Países Bajos y costas bajas sumergidas.';
        } else if (val <= 300) {
            floodImpactText.textContent = 'Inundación severa (+300m): Cuenca del Amazonas y Europa central como mares interiores.';
        } else {
            floodImpactText.textContent = 'Diluvio planetario: continentes casi 100% sumergidos, solo cordilleras altas.';
        }
    });

    const sliderVolcanism = document.getElementById('slider-volcanism');
    const dispVolcanism = document.getElementById('disp-volcanism');
    if (sliderVolcanism) {
        sliderVolcanism.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            dispVolcanism.textContent = `${val.toFixed(1)}x`;
            simulation.setParam('volcanism', val);
        });
    }

    const sliderErosion = document.getElementById('slider-erosion');
    const dispErosion = document.getElementById('disp-erosion');
    if (sliderErosion) {
        sliderErosion.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            dispErosion.textContent = `${Math.round(val)} %`;
            simulation.setParam('erosionFactor', val / 100.0);
        });
    }

    const selectOceanPalette = document.getElementById('select-ocean-palette');
    if (selectOceanPalette) {
        selectOceanPalette.addEventListener('change', (e) => {
            const pal = e.target.value;
            if (pal === 'tropical') {
                simulation.setParam('oceanColor', [0.02, 0.35, 0.55]);
                simulation.setParam('oceanShallowColor', [0.12, 0.75, 0.85]);
            } else if (pal === 'emerald') {
                simulation.setParam('oceanColor', [0.02, 0.28, 0.25]);
                simulation.setParam('oceanShallowColor', [0.10, 0.65, 0.45]);
            } else if (pal === 'ferrous') {
                simulation.setParam('oceanColor', [0.45, 0.12, 0.08]);
                simulation.setParam('oceanShallowColor', [0.65, 0.25, 0.15]);
            } else {
                simulation.setParam('oceanColor', [0.03, 0.18, 0.45]);
                simulation.setParam('oceanShallowColor', [0.08, 0.45, 0.65]);
            }
        });
    }

    // ========================================================
    // 4. TAB: ASTROBIOLOGÍA & BIOSFERA
    // ========================================================
    selectPigment.addEventListener('change', (e) => {
        astrobiology.setPigment(e.target.value);
    });

    toggleLife.addEventListener('change', (e) => {
        simulation.setParam('hasLife', e.target.checked);
        lifeStateText.textContent = e.target.checked ? 'ACTIVA' : 'INEXISTENTE';
    });

    const toggleCivilization = document.getElementById('toggle-civilization');
    if (toggleCivilization) {
        toggleCivilization.addEventListener('change', (e) => {
            simulation.setParam('hasCivilization', e.target.checked);
            simulation.setParam('nightLights', e.target.checked ? 1.0 : 0.0);
        });
    }

    const sliderNightLights = document.getElementById('slider-night-lights');
    const dispNightLights = document.getElementById('disp-night-lights');
    if (sliderNightLights) {
        sliderNightLights.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            dispNightLights.textContent = `${Math.round(val)} %`;
            simulation.setParam('nightLights', val / 100.0);
        });
    }

    // ========================================================
    // 5. TAB: CAPAS & RENDER
    // ========================================================
    toggleClouds.addEventListener('change', (e) => {
        viewer.setCloudsVisible(e.target.checked);
        if (quickClouds) quickClouds.checked = e.target.checked;
    });

    toggleAtmosphere.addEventListener('change', (e) => {
        viewer.setAtmosphereVisible(e.target.checked);
        if (quickAtmo) quickAtmo.checked = e.target.checked;
    });

    const toggleAuroras = document.getElementById('toggle-auroras');
    if (toggleAuroras) {
        toggleAuroras.addEventListener('change', (e) => {
            viewer.setAurorasVisible(e.target.checked);
            if (quickAuroras) quickAuroras.checked = e.target.checked;
        });
    }

    // Sincronización con barra rápida de capas
    const quickClouds = document.getElementById('quick-toggle-clouds');
    const quickAtmo = document.getElementById('quick-toggle-atmo');
    const quickAuroras = document.getElementById('quick-toggle-auroras');
    const quickLight = document.getElementById('quick-toggle-light');

    if (quickClouds) {
        quickClouds.addEventListener('change', (e) => {
            toggleClouds.checked = e.target.checked;
            viewer.setCloudsVisible(e.target.checked);
        });
    }
    if (quickAtmo) {
        quickAtmo.addEventListener('change', (e) => {
            toggleAtmosphere.checked = e.target.checked;
            viewer.setAtmosphereVisible(e.target.checked);
        });
    }
    if (quickAuroras) {
        quickAuroras.addEventListener('change', (e) => {
            if (toggleAuroras) toggleAuroras.checked = e.target.checked;
            viewer.setAurorasVisible(e.target.checked);
        });
    }
    if (quickLight) {
        quickLight.addEventListener('change', (e) => {
            setGlobalLightMode(e.target.checked);
        });
    }

    btnNakedEarth.addEventListener('click', () => {
        toggleClouds.checked = false;
        toggleAtmosphere.checked = false;
        if (quickClouds) quickClouds.checked = false;
        if (quickAtmo) quickAtmo.checked = false;
        viewer.setCloudsVisible(false);
        viewer.setAtmosphereVisible(false);
        simulation.setParam('seaLevelOffset', -130);
        sliderSeaLevel.value = -130;
        dispSliderSea.textContent = '-130 m';
    });

    const btnRestoreDefaults = document.getElementById('btn-restore-defaults');
    if (btnRestoreDefaults) {
        btnRestoreDefaults.addEventListener('click', () => {
            resetAllParametersToDefault();
        });
    }

    // ========================================================
    // SONDA ORBITAL DE SUPERFICIE (MUESTREO IN SITU)
    // ========================================================
    btnProbeMode.addEventListener('click', () => {
        isProbeActive = !isProbeActive;
        if (isProbeActive) {
            isTargetingActive = false;
            targetModeHud.classList.remove('active');
            canvasViewport.classList.remove('targeting-cursor');
            canvasViewport.classList.add('probe-cursor');
            btnProbeMode.classList.add('active-btn');
        } else {
            canvasViewport.classList.remove('probe-cursor');
            btnProbeMode.classList.remove('active-btn');
        }
    });

    btnCloseProbe.addEventListener('click', () => {
        probeModal.classList.remove('active');
    });

    // ========================================================
    // ESPECTROSCOPIO DE BIOSIGNATURAS (JWST) REACTIVO
    // ========================================================
    const activeJwstMolecules = new Set(['o3', 'h2o', 'ch4', 'co2', 'so2', 'red-edge']);
    const jwstFilterBtns = document.querySelectorAll('#jwst-filter-chips .legend-tag');

    jwstFilterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const mol = btn.getAttribute('data-molecule');
            if (!mol) return;
            if (activeJwstMolecules.has(mol)) {
                activeJwstMolecules.delete(mol);
                btn.classList.remove('active');
            } else {
                activeJwstMolecules.add(mol);
                btn.classList.add('active');
            }
            renderJwstSpectrum();
        });
    });

    btnJwstModal.addEventListener('click', () => {
        jwstModal.classList.add('active');
        renderJwstSpectrum();
    });

    btnCloseJwst.addEventListener('click', () => {
        jwstModal.classList.remove('active');
    });

    function renderJwstSpectrum() {
        if (!jwstCanvas) return;
        const ctx = jwstCanvas.getContext('2d');
        const w = jwstCanvas.width;
        const h = jwstCanvas.height;

        ctx.clearRect(0, 0, w, h);

        const padLeft = 45;
        const padRight = 20;
        const padTop = 30;
        const padBottom = 30;
        const graphW = w - padLeft - padRight;
        const graphH = h - padTop - padBottom;

        // Función de mapeo de longitud de onda logarítmica/proporcional (0.4 a 15 um)
        const getX = (wl) => padLeft + ((Math.log(wl / 0.4)) / Math.log(15.0 / 0.4)) * graphW;

        // 1. Regiones Espectrales de Fondo (VIS, NIR, MIR)
        const xVisEnd = getX(0.75);
        const xNirEnd = getX(5.0);

        // Visible (0.4 - 0.75 um)
        const visGrad = ctx.createLinearGradient(padLeft, 0, xVisEnd, 0);
        visGrad.addColorStop(0, 'rgba(99, 102, 241, 0.08)');
        visGrad.addColorStop(1, 'rgba(239, 68, 68, 0.08)');
        ctx.fillStyle = visGrad;
        ctx.fillRect(padLeft, padTop, xVisEnd - padLeft, graphH);

        // Near-Infrared (0.75 - 5.0 um)
        ctx.fillStyle = 'rgba(168, 85, 247, 0.04)';
        ctx.fillRect(xVisEnd, padTop, xNirEnd - xVisEnd, graphH);

        // Mid-Infrared (5.0 - 15.0 um)
        ctx.fillStyle = 'rgba(244, 63, 94, 0.04)';
        ctx.fillRect(xNirEnd, padTop, padLeft + graphW - xNirEnd, graphH);

        // 2. Cuadrícula y Marcas de Eje X
        const tickWavelengths = [0.4, 0.7, 1.0, 2.0, 4.0, 8.0, 15.0];
        ctx.font = '9px Share Tech Mono, monospace';
        ctx.textAlign = 'center';

        tickWavelengths.forEach(wl => {
            const x = getX(wl);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, padTop);
            ctx.lineTo(x, padTop + graphH);
            ctx.stroke();

            ctx.fillStyle = '#64748b';
            ctx.fillText(wl < 1 ? `${wl * 1000}nm` : `${wl}µm`, x, padTop + graphH + 14);
        });

        // Eje Y (Transmisión 0% a 100%)
        ctx.textAlign = 'right';
        ctx.fillStyle = '#64748b';
        ctx.fillText('100%', padLeft - 6, padTop + 8);
        ctx.fillText('50%', padLeft - 6, padTop + graphH * 0.5 + 4);
        ctx.fillText('0%', padLeft - 6, padTop + graphH);

        // 3. Resaltado de Bandas Moleculares Activas
        const molecularBands = [
            { id: 'red-edge', name: 'Vegetation Edge', wl: 0.70, width: 0.08, color: '#10b981' },
            { id: 'h2o', name: 'H₂O', wl: 1.4, width: 0.22, color: '#60a5fa' },
            { id: 'h2o', name: 'H₂O', wl: 1.9, width: 0.25, color: '#60a5fa' },
            { id: 'ch4', name: 'CH₄', wl: 3.3, width: 0.35, color: '#f59e0b' },
            { id: 'co2', name: 'CO₂ (4.3µm)', wl: 4.3, width: 0.40, color: '#f43f5e' },
            { id: 'so2', name: 'SO₂', wl: 7.3, width: 0.35, color: '#fb923c' },
            { id: 'ch4', name: 'CH₄', wl: 7.7, width: 0.40, color: '#f59e0b' },
            { id: 'o3', name: 'O₃ (9.6µm)', wl: 9.6, width: 0.60, color: '#38bdf8' },
            { id: 'co2', name: 'CO₂ (15µm)', wl: 14.8, width: 0.70, color: '#f43f5e' }
        ];

        molecularBands.forEach(band => {
            if (!activeJwstMolecules.has(band.id)) return;
            const xCenter = getX(band.wl);
            const xLeft = getX(band.wl - band.width * 0.5);
            const xRight = getX(band.wl + band.width * 0.5);
            const bandW = Math.max(6, xRight - xLeft);

            ctx.fillStyle = `${band.color}18`;
            ctx.fillRect(xCenter - bandW * 0.5, padTop, bandW, graphH);

            ctx.strokeStyle = `${band.color}50`;
            ctx.lineWidth = 1;
            ctx.strokeRect(xCenter - bandW * 0.5, padTop, bandW, graphH);

            ctx.fillStyle = band.color;
            ctx.font = '9px Share Tech Mono, monospace';
            ctx.textAlign = 'center';
            ctx.fillText(band.name, xCenter, padTop - 6);
        });

        // 4. Datos del Espectro Continuo Sintético
        const data = astrobiology.generateAtmosphericSpectrum();
        const points = data.spectrum;

        // Curva espectral suavizada con resplandor
        ctx.beginPath();
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 2.2;
        ctx.shadowColor = 'rgba(192, 132, 252, 0.6)';
        ctx.shadowBlur = 8;

        for (let i = 0; i < points.length; i++) {
            const pt = points[i];
            const x = getX(pt.wavelength);
            const y = padTop + (1.0 - Math.min(1.15, pt.flux)) * graphH;

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0; // Reset sombra

        // 5. Diagnóstico Exobiológico
        const diagStatus = document.getElementById('jwst-diagnosis-status');
        const diagDesc = document.getElementById('jwst-diagnosis-desc');

        if (simulation.current.hasLife && simulation.current.o2 > 6 && simulation.current.ch4 > 0.4) {
            diagStatus.textContent = 'DESEQUILIBRIO REDOX DETECTADO (VIDA ACTIVA)';
            diagStatus.className = 'status-confirmed';
            diagDesc.textContent = `Coexistencia termodinámicamente anómala de oxidante O₂/O₃ (${simulation.current.o2.toFixed(1)}%) y reductor CH₄ (${simulation.current.ch4.toFixed(1)} ppm). Salto reflectivo "Red Edge" a 700 nm confirma biosfera fotosintética activa.`;
        } else if (simulation.current.hasLife) {
            diagStatus.textContent = 'BIOSIGNATURA DÉBIL / PROTO-BIÓTICA';
            diagStatus.className = '';
            diagStatus.style.color = '#f59e0b';
            diagDesc.textContent = 'Presencia de compuestos prebióticos o microbianos anaerobios. El desequilibrio redox atmosférico es marginal.';
        } else {
            diagStatus.textContent = 'EQUILIBRIO TERMODINÁMICO INERTE (SIN VIDA)';
            diagStatus.className = '';
            diagStatus.style.color = '#f43f5e';
            diagDesc.textContent = 'Espectro dominado exclusivamente por gases abióticos e invernadero (CO₂ / Vapor de agua). Ausencia absoluta de biosignaturas biológicas.';
        }
    }

    // ========================================================
    // ROTACIÓN Y CAPAS
    // ========================================================
    btnToggleRotation.addEventListener('click', () => {
        viewer.isRotationPaused = !viewer.isRotationPaused;
        viewer.controls.autoRotate = false;
        if (viewer.isRotationPaused) {
            btnToggleRotation.textContent = '▶️ REANUDAR GIRO';
            btnToggleRotation.classList.remove('active-btn');
        } else {
            btnToggleRotation.textContent = '⏸️ PAUSAR GIRO';
            btnToggleRotation.classList.add('active-btn');
        }
    });

    btnReverseRotation.addEventListener('click', () => {
        viewer.rotationSpeed = -viewer.rotationSpeed;
        viewer.controls.autoRotate = false;
    });

    toggleClouds.addEventListener('change', (e) => {
        viewer.setCloudsVisible(e.target.checked);
    });

    toggleAtmosphere.addEventListener('change', (e) => {
        viewer.setAtmosphereVisible(e.target.checked);
    });

    let isNakedActive = false;
    btnNakedEarth.addEventListener('click', () => {
        isNakedActive = !isNakedActive;
        if (isNakedActive) {
            toggleClouds.checked = false;
            toggleAtmosphere.checked = false;
            viewer.setCloudsVisible(false);
            viewer.setAtmosphereVisible(false);
            btnNakedEarth.textContent = '🌐 RESTAURAR CAPAS';
            btnNakedEarth.classList.add('active-btn');
        } else {
            toggleClouds.checked = true;
            toggleAtmosphere.checked = true;
            viewer.setCloudsVisible(true);
            viewer.setAtmosphereVisible(true);
            btnNakedEarth.textContent = '🌍 MODO CORTEZA PURA';
            btnNakedEarth.classList.remove('active-btn');
        }
    });

    // ========================================================
    // PUNTERÍA DE ASTEROIDE (RAYCASTING)
    // ========================================================
    btnTargetMeteor.addEventListener('click', () => {
        isTargetingActive = true;
        isProbeActive = false;
        canvasViewport.classList.remove('probe-cursor');
        btnProbeMode.classList.remove('active-btn');
        targetModeHud.classList.add('active');
        canvasViewport.classList.add('targeting-cursor');
    });

    btnCancelTarget.addEventListener('click', () => {
        isTargetingActive = false;
        targetModeHud.classList.remove('active');
        canvasViewport.classList.remove('targeting-cursor');
    });

    // Manejo de eventos del ratón sobre el canvas 3D
    canvasViewport.addEventListener('mousemove', (e) => {
        if (!isTargetingActive && !isProbeActive) return;

        const coords = viewer.getCoordinatesAtMouse(e.clientX, e.clientY);
        if (coords && isTargetingActive) {
            const ns = coords.lat >= 0 ? 'N' : 'S';
            const ew = coords.lon >= 0 ? 'E' : 'O';
            targetCoordsText.textContent = `Lat ${Math.abs(coords.lat).toFixed(1)}° ${ns} / Lon ${Math.abs(coords.lon).toFixed(1)}° ${ew}`;
        }
    });

    canvasViewport.addEventListener('click', (e) => {
        const coords = viewer.getCoordinatesAtMouse(e.clientX, e.clientY);
        if (!coords) return;

        if (isTargetingActive) {
            const d = parseFloat(sliderMeteorSize.value);
            const v = parseFloat(sliderMeteorSpeed.value);
            const comp = selectMeteorComp.value;

            viewer.launchMeteorToCoordinates(coords.hitPointWorld, d, v, comp);
            impactAlertOverlay.classList.add('active');
            setTimeout(() => impactAlertOverlay.classList.remove('active'), 4000);

            isTargetingActive = false;
            targetModeHud.classList.remove('active');
            canvasViewport.classList.remove('targeting-cursor');
        } else if (isProbeActive) {
            // Disparar sonda in situ
            viewer.launchProbeVisual(coords.hitPointWorld);
            const isWater = Math.abs(coords.lat) < 55 && coords.lon > -40 && coords.lon < 15; // Estimación preliminar
            const report = survey.analyzePoint(coords.lat, coords.lon, isWater, 0.15);

            document.getElementById('probe-latlon').textContent = `Coordenadas: Lat ${coords.lat}° / Lon ${coords.lon}°`;
            document.getElementById('probe-biome').textContent = report.biomeName;
            document.getElementById('probe-temp').textContent = `${report.localTemp} °C`;
            document.getElementById('probe-elevation').textContent = `${report.elevationM} m`;
            document.getElementById('probe-pressure').textContent = `${report.pressureAtm} atm`;
            document.getElementById('probe-uv').textContent = `Índice ${report.uvIndex} (Escala OMS)`;
            document.getElementById('probe-soil-text').textContent = report.soilAnalysis;
            document.getElementById('probe-water-text').textContent = report.waterAnalysis;

            probeModal.classList.add('active');
        }
    });

    // ========================================================
    // SCENARIOS & STUDIO
    // ========================================================
    function bindScenarioPills() {
        document.querySelectorAll('.scenario-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                const scenarioKey = pill.getAttribute('data-scenario');
                document.querySelectorAll('.scenario-pill').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');

                simulation.applyScenario(scenarioKey);
                syncControlsFromSimulation(scenarioKey);

                if (scenarioKey === 'pangea') {
                    if (sliderGeoTime) sliderGeoTime.value = -250;
                    applyGeologicalTimeline(-250);
                } else if (scenarioKey === 'real') {
                    if (sliderGeoTime) sliderGeoTime.value = 0;
                    applyGeologicalTimeline(0);
                } else if (scenarioKey === 'dinosaurs') {
                    if (sliderGeoTime) sliderGeoTime.value = -66;
                    applyGeologicalTimeline(-66);
                }
            });
        });
    }
    bindScenarioPills();

    btnScenarioStudio.addEventListener('click', () => scenarioStudioModal.classList.add('active'));
    btnCloseStudio.addEventListener('click', () => scenarioStudioModal.classList.remove('active'));

    btnSaveScenario.addEventListener('click', () => {
        const name = document.getElementById('studio-name').value.trim() || 'Nuevo Escenario';
        const epoch = document.getElementById('studio-epoch').value.trim() || 'PRESENTE ALTERNATIVO';
        const chronicle = document.getElementById('studio-chronicle').value.trim() || 'Escenario diseñado en Scenario Studio.';
        const co2 = parseFloat(document.getElementById('studio-co2').value) || 420;
        const o2 = parseFloat(document.getElementById('studio-o2').value) || 21;
        const ch4 = parseFloat(document.getElementById('studio-ch4').value) || 2;
        const sea = parseFloat(document.getElementById('studio-sea').value) || 0;
        const temp = parseFloat(document.getElementById('studio-temp').value) || 15;
        const volcanism = parseFloat(document.getElementById('studio-volcanism').value) || 1;
        const hasLife = document.getElementById('studio-has-life').value === 'true';
        const hasCiv = document.getElementById('studio-has-civ').value === 'true';

        const newId = 'custom_' + Date.now();
        const newScenario = {
            id: newId,
            name: name,
            epoch: epoch,
            params: {
                co2, o2, ch4, so2: volcanism * 3.0, solarLuminosity: 1.0,
                volcanism, hasLife, hasCivilization: hasCiv,
                seaLevelOffset: sea, meanTempTarget: temp
            },
            visual: {
                atmosphereColor: hasLife ? [0.15, 0.55, 1.0] : [0.90, 0.55, 0.20],
                atmosphereOpacity: 0.85,
                oceanColor: hasLife ? [0.03, 0.18, 0.45] : [0.12, 0.35, 0.22],
                oceanShallowColor: hasLife ? [0.08, 0.45, 0.65] : [0.22, 0.48, 0.25],
                cloudDensity: 0.70,
                cloudColor: [1.0, 1.0, 1.0],
                hasCityLights: hasCiv,
                abioticFactor: hasLife ? 0.0 : 1.0,
                dinosaurFactor: 0.0,
                volcanicGlow: Math.min(2.0, volcanism * 0.1),
                erosionFactor: hasLife ? 0.05 : 0.90
            },
            dominantClade: hasLife ? 'BIOTA PERSONALIZADA' : 'ESTÉRIL',
            cladeDescription: `Escenario con nivel del mar de ${sea}m y temperatura de ${temp}°C.`,
            chronicle: chronicle
        };

        window.scenarioManager.saveCustomScenario(newScenario);
        scenarioStudioModal.classList.remove('active');
        simulation.applyScenario(newId);
    });

    // ========================================================
    // RESTABLECIMIENTO TOTAL DE TODOS LOS PARÁMETROS
    // ========================================================
    function resetAllParametersToDefault() {
        // 1. Detener animaciones y eventos temporales
        isTimelinePlaying = false;
        if (btnPlayTimeline) {
            btnPlayTimeline.textContent = '▶ ANIMAR DERIVA';
            btnPlayTimeline.classList.remove('active-btn');
        }
        timelinePlayDirection = 1;

        // 2. Escenario real en simulación
        simulation.applyScenario('real');
        simulation.manualSeaLevel = false;
        simulation.craters = [];
        simulation.meteorEvent.active = false;

        // 3. Motores científicos
        astrophysics.setObliquity(23.44);
        astrophysics.setMoon(true);
        astrophysics.setStarType('sun_g2v');
        astrophysics.setTidalLock(false);
        astrophysics.setMagneticField(1.0);
        if (window.astrophysicsEngine) {
            window.astrophysicsEngine.params.obliquityDeg = 23.44;
            window.astrophysicsEngine.params.hasMoon = true;
            window.astrophysicsEngine.params.starType = 'sun_g2v';
            window.astrophysicsEngine.params.isTidallyLocked = false;
            window.astrophysicsEngine.params.magneticField = 1.0;
        }

        geology.setThermostat(true);
        geology.setOrogeny(1.0);
        geology.setContinentalEpoch('modern');

        astrobiology.setPigment('green');

        // 4. Visor 3D y Capas
        viewer.rotationSpeed = 1.0;
        viewer.isRotationPaused = false;
        viewer.setCloudsVisible(true);
        viewer.setAtmosphereVisible(true);
        viewer.setAurorasVisible(true);
        setGlobalLightMode(false);
        if (viewer.earthUniforms) {
            viewer.earthUniforms.uGlobalLight.value = 0.0;
            viewer.earthUniforms.uGeologicalMa.value = 0.0;
        }

        // 5. Restablecer controles de Astrofísica & Órbita
        if (sliderOrbitalDist) sliderOrbitalDist.value = 1.00;
        if (dispOrbitalDist) dispOrbitalDist.textContent = '1.00 UA';
        if (subOrbitalDist) subOrbitalDist.textContent = 'Constante solar: 1361 W/m² (Insolación).';
        if (sliderObliquity) sliderObliquity.value = 23;
        if (dispObliquity) dispObliquity.textContent = '23.4°';
        if (sliderRotationSpeed) sliderRotationSpeed.value = 24;
        if (dispRotationSpeed) dispRotationSpeed.textContent = '24.0 h';
        if (btnToggleRotation) {
            btnToggleRotation.textContent = '⏸️ PAUSAR';
            btnToggleRotation.classList.add('active-btn');
        }
        if (btnReverseRotation) btnReverseRotation.classList.remove('active-btn');
        if (selectStarType) selectStarType.value = 'sun_g2v';
        if (sliderMagneticField) sliderMagneticField.value = 1.0;
        if (dispMagneticField) dispMagneticField.textContent = '1.0x';
        if (toggleMoon) toggleMoon.checked = true;

        // 6. Restablecer controles de Clima & Atmósfera
        if (sliderCo2) sliderCo2.value = 420;
        if (dispCo2) dispCo2.textContent = '420 ppm';
        if (sliderO2) sliderO2.value = 20.9;
        if (dispO2) dispO2.textContent = '20.9 %';
        if (sliderCh4) sliderCh4.value = 1.9;
        if (dispCh4) dispCh4.textContent = '1.9 ppm';
        if (sliderSo2) sliderSo2.value = 0;
        if (dispSo2) dispSo2.textContent = '0 ppm';
        if (sliderCloudDensity) sliderCloudDensity.value = 75;
        if (dispCloudDensity) dispCloudDensity.textContent = '75 %';
        if (sliderSurfacePressure) sliderSurfacePressure.value = 1.00;
        if (dispSurfacePressure) dispSurfacePressure.textContent = '1.00 atm';

        // 7. Restablecer controles de Geología & Silicatos
        if (sliderSeaLevel) sliderSeaLevel.value = 0;
        if (dispSliderSea) dispSliderSea.textContent = '+0 m';
        if (floodImpactText) floodImpactText.textContent = 'Nivel costero estándar.';
        if (sliderVolcanism) sliderVolcanism.value = 1.0;
        if (dispVolcanism) dispVolcanism.textContent = '1.0x';
        if (toggleThermostat) toggleThermostat.checked = true;
        if (sliderErosion) sliderErosion.value = 4;
        if (dispErosion) dispErosion.textContent = '4 %';
        if (selectOceanPalette) selectOceanPalette.value = 'default';

        // 8. Restablecer controles de Biosfera & Astrobiología
        if (toggleLife) toggleLife.checked = true;
        if (lifeStateText) lifeStateText.textContent = 'ACTIVA';
        if (selectPigment) selectPigment.value = 'green';
        if (toggleCivilization) toggleCivilization.checked = true;
        if (sliderNightLights) sliderNightLights.value = 100;
        if (dispNightLights) dispNightLights.textContent = '100 %';

        // 9. Restablecer Capas & Toggles rápidos
        if (toggleClouds) toggleClouds.checked = true;
        if (toggleAtmosphere) toggleAtmosphere.checked = true;
        const toggleAuroras = document.getElementById('toggle-auroras');
        if (toggleAuroras) toggleAuroras.checked = true;
        if (toggleGlobalLightCheck) toggleGlobalLightCheck.checked = false;
        if (quickClouds) quickClouds.checked = true;
        if (quickAtmo) quickAtmo.checked = true;
        if (quickAuroras) quickAuroras.checked = true;
        if (quickLight) quickLight.checked = false;

        // 10. Restablecer Escala de Tiempo Geológico a Hoy (0 Ma)
        if (sliderGeoTime) sliderGeoTime.value = 0;
        applyGeologicalTimeline(0);
        document.querySelectorAll('.epoch-chip').forEach(c => {
            c.classList.toggle('active', c.getAttribute('data-ma') === '0');
        });

        // 11. Restablecer Escenarios y Escáner
        document.querySelectorAll('.scenario-pill').forEach(p => {
            p.classList.toggle('active', p.getAttribute('data-scenario') === 'real');
        });

        document.querySelectorAll('.scanner-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-view') === 'optical');
        });
        survey.setViewMode('optical');

        // 12. Actualizar Telemetría
        syncControlsFromSimulation('real');
        updateTelemetryDisplay();
    }

    btnReset.addEventListener('click', () => {
        resetAllParametersToDefault();
    });

    // ========================================================
    // PERSONALIZADOR DE TELEMETRÍA (QUÉ VER Y ORDEN EN TIEMPO REAL)
    // ========================================================
    const btnConfigTelemetry = document.getElementById('btn-config-telemetry');
    const telemetryCustomizer = document.getElementById('telemetry-customizer');
    const telemetryGrid = document.getElementById('telemetry-grid-container');
    const btnResetTelemetryOrder = document.getElementById('btn-reset-telemetry-order');

    if (btnConfigTelemetry && telemetryCustomizer) {
        btnConfigTelemetry.addEventListener('click', () => {
            const isCollapsed = telemetryCustomizer.classList.toggle('collapsed');
            btnConfigTelemetry.classList.toggle('active', !isCollapsed);
        });
    }

    // 1. Visibilidad en tiempo real (Qué ver)
    document.querySelectorAll('#telemetry-customizer input[data-card]').forEach(input => {
        input.addEventListener('change', (e) => {
            const cardId = e.target.getAttribute('data-card');
            const card = document.getElementById(cardId);
            if (card) {
                card.style.display = e.target.checked ? '' : 'none';
            }
            e.target.closest('.customizer-chip').classList.toggle('active', e.target.checked);
            saveTelemetrySettings();
        });
    });

    // 2. Reordenar con botones [▲] y [▼]
    function bindCardReorderButtons() {
        document.querySelectorAll('.btn-card-up').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const card = btn.closest('.telemetry-card');
                const prev = card.previousElementSibling;
                if (prev && prev.classList.contains('telemetry-card')) {
                    telemetryGrid.insertBefore(card, prev);
                    saveTelemetrySettings();
                }
            };
        });

        document.querySelectorAll('.btn-card-down').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const card = btn.closest('.telemetry-card');
                const next = card.nextElementSibling;
                if (next && next.classList.contains('telemetry-card')) {
                    telemetryGrid.insertBefore(next, card);
                    saveTelemetrySettings();
                }
            };
        });
    }
    bindCardReorderButtons();

    // 3. Reordenar mediante Drag & Drop
    let draggedCard = null;

    document.querySelectorAll('.telemetry-card').forEach(card => {
        card.addEventListener('dragstart', (e) => {
            draggedCard = card;
            card.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', card.id);
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            document.querySelectorAll('.telemetry-card').forEach(c => c.classList.remove('drag-over'));
            saveTelemetrySettings();
        });

        card.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (card !== draggedCard) {
                card.classList.add('drag-over');
            }
        });

        card.addEventListener('dragleave', () => {
            card.classList.remove('drag-over');
        });

        card.addEventListener('drop', (e) => {
            e.preventDefault();
            card.classList.remove('drag-over');
            if (draggedCard && card !== draggedCard) {
                const allCards = Array.from(telemetryGrid.querySelectorAll('.telemetry-card'));
                const draggedIdx = allCards.indexOf(draggedCard);
                const targetIdx = allCards.indexOf(card);
                if (draggedIdx < targetIdx) {
                    telemetryGrid.insertBefore(draggedCard, card.nextSibling);
                } else {
                    telemetryGrid.insertBefore(draggedCard, card);
                }
                saveTelemetrySettings();
            }
        });
    });

    // 4. Guardar y Restaurar Configuración de Telemetría
    const DEFAULT_TELEMETRY_ORDER = [
        'card-temp',
        'card-sea',
        'card-thermostat',
        'card-trophic',
        'card-atmosphere',
        'card-clade',
        'card-chronicle'
    ];

    function saveTelemetrySettings() {
        try {
            if (!telemetryGrid) return;
            const order = Array.from(telemetryGrid.querySelectorAll('.telemetry-card')).map(c => c.id);
            const visibility = {};
            document.querySelectorAll('#telemetry-customizer input[data-card]').forEach(inp => {
                visibility[inp.getAttribute('data-card')] = inp.checked;
            });
            localStorage.setItem('terra_telemetry_order', JSON.stringify(order));
            localStorage.setItem('terra_telemetry_visibility', JSON.stringify(visibility));
        } catch (err) {}
    }

    function loadTelemetrySettings() {
        try {
            if (!telemetryGrid) return;
            const savedOrder = JSON.parse(localStorage.getItem('terra_telemetry_order'));
            if (savedOrder && Array.isArray(savedOrder)) {
                savedOrder.forEach(id => {
                    const card = document.getElementById(id);
                    if (card && telemetryGrid) telemetryGrid.appendChild(card);
                });
            }
            const savedVis = JSON.parse(localStorage.getItem('terra_telemetry_visibility'));
            if (savedVis) {
                Object.entries(savedVis).forEach(([id, isVisible]) => {
                    const card = document.getElementById(id);
                    const inp = document.querySelector(`#telemetry-customizer input[data-card="${id}"]`);
                    if (card) card.style.display = isVisible ? '' : 'none';
                    if (inp) {
                        inp.checked = isVisible;
                        inp.closest('.customizer-chip').classList.toggle('active', isVisible);
                    }
                });
            }
        } catch (err) {}
    }
    loadTelemetrySettings();

    if (btnResetTelemetryOrder) {
        btnResetTelemetryOrder.addEventListener('click', () => {
            DEFAULT_TELEMETRY_ORDER.forEach(id => {
                const card = document.getElementById(id);
                if (card && telemetryGrid) {
                    card.style.display = '';
                    telemetryGrid.appendChild(card);
                }
                const inp = document.querySelector(`#telemetry-customizer input[data-card="${id}"]`);
                if (inp) {
                    inp.checked = true;
                    inp.closest('.customizer-chip').classList.add('active');
                }
            });
            localStorage.removeItem('terra_telemetry_order');
            localStorage.removeItem('terra_telemetry_visibility');
        });
    }

    function syncControlsFromSimulation(scenarioKey) {
        const scen = window.SCENARIOS[scenarioKey];
        if (!scen) return;

        displayEpoch.textContent = scen.epoch;
        chronicleText.textContent = scen.chronicle;
        toggleLife.checked = scen.params.hasLife;
        lifeStateText.textContent = scen.params.hasLife ? 'ACTIVA' : 'INEXISTENTE';

        sliderSeaLevel.value = scen.params.seaLevelOffset;
        const sign = scen.params.seaLevelOffset >= 0 ? '+' : '';
        dispSliderSea.textContent = `${sign}${scen.params.seaLevelOffset} m`;

        if (sliderCo2) {
            sliderCo2.value = Math.round(scen.params.co2);
            dispCo2.textContent = `${Math.round(scen.params.co2)} ppm`;
        }
        if (sliderO2) {
            sliderO2.value = scen.params.o2.toFixed(1);
            dispO2.textContent = `${scen.params.o2.toFixed(1)} %`;
        }
        if (sliderCh4) {
            sliderCh4.value = scen.params.ch4.toFixed(1);
            dispCh4.textContent = `${scen.params.ch4.toFixed(1)} ppm`;
        }
        if (sliderSo2) {
            sliderSo2.value = Math.round(scen.params.so2);
            dispSo2.textContent = `${Math.round(scen.params.so2)} ppm`;
        }
        if (sliderVolcanism) {
            sliderVolcanism.value = scen.params.volcanism.toFixed(1);
            dispVolcanism.textContent = `${scen.params.volcanism.toFixed(1)}x`;
        }
        if (sliderErosion) {
            const erPct = Math.round((scen.visual.erosionFactor || 0.04) * 100);
            sliderErosion.value = erPct;
            dispErosion.textContent = `${erPct} %`;
        }
        if (sliderCloudDensity) {
            const clPct = Math.round((scen.visual.cloudDensity || 0.75) * 100);
            sliderCloudDensity.value = clPct;
            dispCloudDensity.textContent = `${clPct} %`;
        }
        if (toggleCivilization) {
            toggleCivilization.checked = scen.params.hasCivilization;
        }
    }

    // ========================================================
    // ACTUALIZACIÓN DE TELEMETRÍA CIENTÍFICA
    // ========================================================
    function updateTelemetryDisplay() {
        const cur = simulation.current;

        // Temperatura
        valTemp.textContent = `${cur.meanTemp.toFixed(1)} °C`;
        const tempPct = Math.max(0, Math.min(100, (cur.meanTemp + 50) / 100 * 100));
        barTemp.style.width = `${tempPct}%`;

        // Nivel del mar
        const sign = cur.seaLevelOffset >= 0 ? '+' : '';
        valSea.textContent = `${sign}${Math.round(cur.seaLevelOffset)} m`;
        const seaPct = Math.max(0, Math.min(100, (cur.seaLevelOffset + 150) / 1650 * 100));
        barSea.style.width = `${seaPct}%`;
        const oceanPct = Math.min(99, Math.round((0.71 + (cur.seaLevelOffset / 1400)) * 100));
        statusSea.textContent = `Cobertura líquida: ${oceanPct}% | Casquetes: ${Math.round(cur.iceCoverage * 100)}%`;

        if (!simulation.manualSeaLevel) {
            sliderSeaLevel.value = Math.round(cur.seaLevelOffset);
            dispSliderSea.textContent = `${sign}${Math.round(cur.seaLevelOffset)} m`;
        }

        // Termostato de Silicatos (Walker)
        const wRate = Math.round(geology.params.weatheringRateMtYear);
        const dRate = Math.round(geology.params.degassingRateMtYear);
        valWeathering.textContent = `${wRate} Mt/a`;
        statusThermostat.textContent = `Secuestro químico: ${wRate} Mt | Emisión volcánica: ${dRate} Mt CO₂`;

        // Red Trófica
        const pProducers = Math.round(astrobiology.params.trophicProducers);
        const pHerbivores = Math.round(astrobiology.params.trophicHerbivores);
        const pCarnivores = Math.round(astrobiology.params.trophicCarnivores);

        barProducers.style.width = `${pProducers}%`;
        valProducers.textContent = `${pProducers}%`;
        barHerbivores.style.width = `${pHerbivores}%`;
        valHerbivores.textContent = `${pHerbivores}%`;
        barCarnivores.style.width = `${pCarnivores}%`;
        valCarnivores.textContent = `${pCarnivores}%`;

        // Gases
        valO2.textContent = `${cur.o2.toFixed(1)}%`;
        barO2.style.width = `${Math.min(100, (cur.o2 / 35) * 100)}%`;
        valCO2.textContent = `${Math.round(cur.co2)} ppm`;
        barCO2.style.width = `${Math.min(100, (cur.co2 / 10000) * 100)}%`;
        valCH4.textContent = `${cur.ch4.toFixed(1)} ppm`;
        barCH4.style.width = `${Math.min(100, (cur.ch4 / 50) * 100)}%`;

        // Dominio biológico
        const cladeInfo = simulation.getDominantCladeInfo();
        dominantCladeBadge.textContent = cladeInfo.badge;
        dominantDesc.textContent = cladeInfo.desc;
    }

    // ========================================================
    // GESTIÓN DE SATURACIÓN DE PANTALLA Y MODO CINEMÁTICO
    // ========================================================
    const btnCinemaMode = document.getElementById('btn-cinema-mode');
    const appContainer = document.getElementById('app-container');
    const leftTelemetry = document.getElementById('left-telemetry');
    const rightControls = document.getElementById('right-controls');
    const btnCollapseLeft = document.getElementById('btn-collapse-left');
    const btnCollapseRight = document.getElementById('btn-collapse-right');
    const btnTabLeft = document.getElementById('btn-tab-left');
    const btnTabRight = document.getElementById('btn-tab-right');
    const hudChronicle = document.getElementById('hud-chronicle');
    const btnToggleChronicle = document.getElementById('btn-toggle-chronicle');
    const chronicleExpandBtn = document.getElementById('chronicle-expand-btn');

    if (btnCinemaMode) {
        btnCinemaMode.addEventListener('click', () => {
            const isCinema = appContainer.classList.toggle('cinematic-mode');
            btnCinemaMode.classList.toggle('active', isCinema);
            btnCinemaMode.innerHTML = isCinema 
                ? '<span class="icon">✕</span> SALIR CINEMA'
                : '<span class="icon">🖥️</span> CINEMÁTICO';
        });
    }

    if (btnCollapseLeft && leftTelemetry && btnTabLeft) {
        btnCollapseLeft.addEventListener('click', () => {
            leftTelemetry.classList.add('collapsed');
            btnTabLeft.classList.add('visible');
        });
        btnTabLeft.addEventListener('click', () => {
            leftTelemetry.classList.remove('collapsed');
            btnTabLeft.classList.remove('visible');
        });
    }

    if (btnCollapseRight && rightControls && btnTabRight) {
        btnCollapseRight.addEventListener('click', () => {
            rightControls.classList.add('collapsed');
            btnTabRight.classList.add('visible');
        });
        btnTabRight.addEventListener('click', () => {
            rightControls.classList.remove('collapsed');
            btnTabRight.classList.remove('visible');
        });
    }

    if (btnToggleChronicle && hudChronicle) {
        btnToggleChronicle.addEventListener('click', () => {
            const isCollapsed = hudChronicle.classList.toggle('collapsed');
            if (chronicleExpandBtn) {
                chronicleExpandBtn.textContent = isCollapsed ? '▲ MOSTRAR DETALLE' : '▼ OCULTAR DETALLE';
            }
        });
    }

    // ========================================================
    // REGISTRO DE TENDENCIA TÉRMICA EN TIEMPO REAL (SPARKLINE)
    // ========================================================
    const tempTrendHistory = [];
    const maxTrendPoints = 60;
    let sparklineTimer = 0;
    const canvasTempTrend = document.getElementById('canvas-temp-trend');

    function updateTempTrend(dt, currentTemp) {
        sparklineTimer += dt;
        if (sparklineTimer >= 0.8) {
            sparklineTimer = 0;
            tempTrendHistory.push(currentTemp);
            if (tempTrendHistory.length > maxTrendPoints) {
                tempTrendHistory.shift();
            }
            drawTempSparkline();
        }
    }

    function drawTempSparkline() {
        if (!canvasTempTrend) return;
        const ctx = canvasTempTrend.getContext('2d');
        const w = canvasTempTrend.width;
        const h = canvasTempTrend.height;

        ctx.clearRect(0, 0, w, h);

        if (tempTrendHistory.length < 2) return;

        let minT = Math.min(...tempTrendHistory);
        let maxT = Math.max(...tempTrendHistory);
        if (maxT - minT < 2.0) {
            minT -= 1.0;
            maxT += 1.0;
        }

        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, 'rgba(0, 240, 255, 0.40)');
        grad.addColorStop(1, 'rgba(0, 240, 255, 0.0)');

        ctx.beginPath();
        for (let i = 0; i < tempTrendHistory.length; i++) {
            const x = (i / (maxTrendPoints - 1)) * w;
            const y = h - ((tempTrendHistory[i] - minT) / (maxT - minT)) * (h - 6) - 3;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }

        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1.6;
        ctx.stroke();

        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        // Punto actual
        const lastIdx = tempTrendHistory.length - 1;
        const lastX = (lastIdx / (maxTrendPoints - 1)) * w;
        const lastY = h - ((tempTrendHistory[lastIdx] - minT) / (maxT - minT)) * (h - 6) - 3;
        ctx.beginPath();
        ctx.arc(lastX, lastY, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
    }

    // ========================================================
    // BUCLE DE RENDERIZADO Y FÍSICA
    // ========================================================
    let lastTime = performance.now();

    function animate(now) {
        requestAnimationFrame(animate);

        const dt = Math.min(0.1, (now - lastTime) / 1000);
        lastTime = now;

        simulation.update(dt);
        astrophysics.update(dt);
        geology.update(dt);
        astrobiology.update(dt);
        viewer.update(dt);

        if (isTimelinePlaying && sliderGeoTime) {
            let curMa = parseFloat(sliderGeoTime.value);
            curMa += timelinePlayDirection * dt * 25.0; // Avanzar 25 millones de años por segundo
            if (curMa >= 250) {
                curMa = 250;
                timelinePlayDirection = -1;
            } else if (curMa <= -250) {
                curMa = -250;
                timelinePlayDirection = 1;
            }
            sliderGeoTime.value = Math.round(curMa);
            applyGeologicalTimeline(curMa);
        }

        updateTelemetryDisplay();
        updateTempTrend(dt, simulation.current.meanTemp);

        if (jwstModal && jwstModal.classList.contains('active')) {
            renderJwstSpectrum();
        }
    }

    requestAnimationFrame(animate);
});
