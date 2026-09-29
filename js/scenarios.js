/**
 * Escenarios. En `params`:
 *  - co2 [ppm], o2 [% en volumen], ch4 [ppm], n2o [ppm], so2 [Mt de SO₂ estratosférico]
 *  - solarLuminosity: luminosidad solar relativa a la actual (Gough 1981 para el pasado/futuro)
 *  - volcanism: desgasificación relativa a la actual (1 = 0,26 Gt CO₂/año; Gerlach 2011)
 *  - seaLevelOffset: SOLO la eustasia tectónica [m]; el aporte del hielo lo calcula el modelo según la temperatura.
 *    Más de ±250 m (Haq 1987; Müller 2008) se marca como HIPOTÉTICO.
 *  - meanTempTarget: condición inicial del clima (el equilibrio lo calcula el modelo; importa por la histéresis del hielo).
 *
 * Scenarios Module: Definición de las líneas temporales alternativas "What-If"
 * y gestor robusto "Scenario Studio" con soporte de persistencia local y exportación JSON.
 */
const SCENARIOS = {
    real: {
        id: 'real',
        name: 'Tierra Real (Línea Base)',
        epoch: 'PRESENTE ANTROPOCENO (2026 d.C.)',
        divergenceDate: 'Sin divergencia (Línea canónica)',
        params: {
            co2: 420,
            o2: 21.0,
            ch4: 1.9,
            so2: 0.05,
            solarLuminosity: 1.0,
            volcanism: 1.0,
            hasLife: true,
            hasCivilization: true,
            seaLevelOffset: 0,
            meanTempTarget: 15.0
        },
        visual: {
            atmosphereColor: [0.15, 0.55, 1.0],
            atmosphereOpacity: 0.85,
            oceanColor: [0.03, 0.18, 0.45],
            oceanShallowColor: [0.08, 0.45, 0.65],
            cloudDensity: 0.75,
            cloudColor: [1.0, 1.0, 1.0],
            hasCityLights: true,
            abioticFactor: 0.0,
            dinosaurFactor: 0.0,
            volcanicGlow: 0.0,
            erosionFactor: 0.04
        },
        dominantClade: 'HOMO SAPIENS (CIVILIZACIÓN)',
        cladeDescription: 'Megaciudades, redes electromagnéticas mundiales y biosfera intensamente modificada por la actividad humana.',
        chronicle: 'La Tierra se encuentra en su línea temporal estándar. La atmósfera oxigenada de origen fotosintético soporta una biosfera compleja y una civilización tecnológica con 8.000 millones de individuos visibles de noche por la emisión lumínica de las ciudades.',
        impactWinter: false
    },

    abiotic: {
        id: 'abiotic',
        name: 'Planeta Inerte (Sin Vida)',
        epoch: 'AÑO 2026 d.C. SIN GÉNESIS BIOLÓGICA',
        divergenceDate: 'Hace 3.800 Millones de Años (La sopa primordial nunca formó autorreplicadores)',
        params: {
            // Sin fotosíntesis el CO₂ no se fija como carbono orgánico ni se forma O₂; sin metanógenos no hay CH₄ biológico.
            // simplificación: CO₂ ~10× preindustrial, por la menor meteorización sin raíces (Berner 1997: las plantas la aceleran ×4–7)
            co2: 2800,
            o2: 0.0,
            ch4: 0.01,          // solo CH₄ abiótico serpentinización (~1 % del flujo actual; Etiope & Sherwood Lollar 2013)
            n2o: 0.0,
            so2: 0.05,
            solarLuminosity: 1.0,
            volcanism: 1.0,
            hasLife: false,
            hasCivilization: false,
            seaLevelOffset: 0,
            meanTempTarget: 25
        },
        visual: {
            atmosphereColor: [0.31, 0.51, 1.0], // N₂ domina la dispersión de Rayleigh: el cielo sigue siendo azul
            atmosphereOpacity: 0.9,
            oceanColor: [0.12, 0.35, 0.22],     // Verde por Fe(III) coloidal en un océano ferruginoso anóxico (hipótesis: Matsuo et al. 2025, Nat. Ecol. Evol.)
            oceanShallowColor: [0.22, 0.48, 0.25],
            cloudDensity: 0.90,
            cloudColor: [0.88, 0.80, 0.65],
            hasCityLights: false,
            abioticFactor: 1.0,
            dinosaurFactor: 0.0,
            volcanicGlow: 0.0,
            erosionFactor: 0.95                 // Erosión masiva por falta de raíces y suelo estabilizado
        },
        dominantClade: 'ESTÉRIL (QUÍMICA PREBIÓTICA)',
        cladeDescription: 'Mares ricos en hierro ferroso, continentes desprovistos de suelo orgánico, radiación UV letal sin capa de ozono.',
        chronicle: 'Sin vida no hubo fotosíntesis oxigénica ni Gran Oxidación (hace ~2.400 Ma; Lyons et al. 2014): la atmósfera es de N₂ y CO₂, sin O₂ ni capa de ozono, y el cielo sigue siendo azul por la dispersión de Rayleigh del N₂. El termostato carbono-silicato mantiene el clima templado-cálido (Kasting 1993), con más CO₂ que hoy porque sin raíces la meteorización es más lenta. Los continentes son roca desnuda y los océanos anóxicos y ricos en hierro ferroso.',
        impactWinter: false
    },

    dinosaurs: {
        id: 'dinosaurs',
        name: 'Imperio de los Dinosaurios',
        epoch: 'PRESENTE ALTERNATIVO (66 Ma POST-IMPACTO EVITADO)',
        divergenceDate: 'Hace 66 Millones de Años (El asteroide de Chicxulub erró la Tierra por 15.000 km)',
        params: {
            co2: 850,           // Maastrichtiense: ~400–1000 ppm (Foster, Royer & Lunt 2017)
            o2: 23.0,           // Cretácico tardío: ~21–25 % (Berner 2009; Glasspool & Scott 2010)
            ch4: 1.5,
            so2: 0.08,
            solarLuminosity: 1.0,
            volcanism: 1.1,
            hasLife: true,
            hasCivilization: false,
            seaLevelOffset: 0,  // misma tectónica actual (solo cambió la biosfera)
            meanTempTarget: 22.0
        },
        visual: {
            atmosphereColor: [0.08, 0.72, 0.85],
            atmosphereOpacity: 0.75,
            oceanColor: [0.02, 0.22, 0.52],
            oceanShallowColor: [0.08, 0.62, 0.60],
            cloudDensity: 0.65,
            cloudColor: [1.0, 1.0, 1.0],
            hasCityLights: false,
            abioticFactor: 0.0,
            dinosaurFactor: 1.0,
            volcanicGlow: 0.0,
            erosionFactor: 0.02
        },
        dominantClade: 'DINOSAURIA & SAUROPSIDA',
        cladeDescription: 'Megafauna reptiliana domina los continentes; pterosaurios gigantes en el aire y mosasaurios reinan los océanos.',
        chronicle: 'Sin el invierno de impacto del Cretácico, los mamíferos continuaron siendo pequeños seres de madriguera. Los dinosaurios evolucionaron 66 millones de años adicionales, desarrollando una asombrosa diversidad. Bosques colosales cubren desde el ecuador hasta Groenlandia.',
        impactWinter: false
    },

    volcanic: {
        id: 'volcanic',
        name: 'Cataclismo Volcánico Masivo',
        epoch: 'GRAN EXTINCIÓN CONTINUA (ANÁLOGO PÉRMICO-TRIÁSICO)',
        divergenceDate: 'Superpluma mantélica activa en la corteza continental',
        params: {
            // Pulso tipo Trampas Siberianas: 3×10⁴–10⁵ Gt de CO₂ y ~7000 Gt de azufre en ~1 Ma (Svensen 2009; Black 2012)
            co2: 2500,          // Pérmico-Triásico: ~2000–4000 ppm tras el pulso (Joachimski et al. 2022)
            o2: 16.0,
            ch4: 10.0,
            so2: 180.0,         // carga estratosférica durante un pulso eruptivo; Pinatubo = 20 Mt
            solarLuminosity: 0.98, // Sol hace 252 Ma (Gough 1981); el vulcanismo no cambia la luminosidad
            volcanism: 25.0,    // 25 × 0,26 = 6,5 Gt CO₂/año: orden de los pulsos eruptivos estimados
            hasLife: true,
            hasCivilization: false,
            seaLevelOffset: 0,
            meanTempTarget: 8.5
        },
        visual: {
            atmosphereColor: [0.85, 0.65, 0.20],
            atmosphereOpacity: 1.4,
            oceanColor: [0.10, 0.22, 0.20],     // euxinia: bacterias verdes del azufre (biomarcadores de Grice et al. 2005)
            oceanShallowColor: [0.18, 0.35, 0.25],
            cloudDensity: 0.98,
            cloudColor: [0.28, 0.24, 0.22],
            hasCityLights: false,
            abioticFactor: 0.6,
            dinosaurFactor: 0.0,
            volcanicGlow: 1.0,
            erosionFactor: 0.70
        },
        dominantClade: 'MICROORGANISMOS METANÓGENOS Y HONGOS',
        cladeDescription: 'Extinción de ~81 % de las especies marinas (Stanley 2016) y ~70 % de los vertebrados terrestres. Océanos ácidos y euxínicos.',
        chronicle: 'Durante un pulso eruptivo de una gran provincia ígnea (~4 millones de km³ de basalto en ~1 Ma en Siberia; Burgess & Bowring 2015), los aerosoles de sulfato enfrían el planeta durante años, mientras que el CO₂ lo calienta durante cientos de miles de años. Las intrusiones queman capas de carbón y evaporitas (Svensen 2009), los océanos se acidifican y quedan anóxicos y euxínicos, y proliferan las bacterias verdes del azufre (Grice et al. 2005). Hace 252 Ma esto causó la mayor extinción conocida: ~81 % de las especies marinas (Stanley 2016).',
        impactWinter: true
    },

    snowball: {
        id: 'snowball',
        name: 'Tierra Bola de Nieve',
        epoch: 'SUPERGLACIACIÓN GLOBAL CRIOGÉNICA',
        divergenceDate: 'Desbalance extremo del albedo terrestre hace 700 Ma',
        params: {
            co2: 110,
            o2: 12.0,
            ch4: 0.2,
            so2: 0.01,
            solarLuminosity: 0.94,
            volcanism: 0.5,
            hasLife: true,
            hasCivilization: false,
            seaLevelOffset: 0,  // el descenso por el hielo lo calcula el modelo
            meanTempTarget: -45.0
        },
        visual: {
            atmosphereColor: [0.45, 0.75, 1.0],
            atmosphereOpacity: 0.65,
            oceanColor: [0.88, 0.92, 0.96],
            oceanShallowColor: [0.82, 0.88, 0.94],
            cloudDensity: 0.35,
            cloudColor: [1.0, 1.0, 1.0],
            hasCityLights: false,
            abioticFactor: 0.0,
            dinosaurFactor: 0.0,
            volcanicGlow: 0.0,
            erosionFactor: 0.15
        },
        dominantClade: 'EXTREMÓFILOS Y ALGAS SUBLACUSTRES',
        cladeDescription: 'La vida sobrevive confinada bajo kilómetros de banquisa de hielo o en respiraderos hidrotermales.',
        chronicle: 'Una retroalimentación de albedo positiva causó que el hielo polar avanzara hasta alcanzar los trópicos y el ecuador. Con una reflectividad superficial del 80%, el calor solar escapa al espacio, manteniendo el planeta en una congelación total con temperaturas ecuatoriales de ~-30 a -40 °C (Pierrehumbert et al. 2011). Salir de ella exige acumular ~0,1 bar de CO₂ volcánico durante millones de años (histéresis de Budyko-Sellers).',
        impactWinter: false
    },

    runaway_hot: {
        id: 'runaway_hot',
        name: 'Invernadero Extremo (Hothouse)',
        epoch: 'EQUILIBRIO TRAS EMISIONES EXTREMAS (MILENIOS DESPUÉS DE 2250 d.C.)',
        divergenceDate: 'Liberación total de permafrost y clatratos submarinos',
        params: {
            // SSP5-8.5 alcanza ~2000 ppm hacia 2250 (Meinshausen et al. 2020); 2400 ppm exige quemar más de las reservas probadas
            co2: 2000,
            o2: 20.9,
            ch4: 3.5,           // liberación parcial de permafrost e hidratos (Schuur et al. 2015)
            so2: 0.05,
            solarLuminosity: 1.0,
            volcanism: 1.2,
            hasLife: true,
            hasCivilization: true,
            seaLevelOffset: 0,  // la fusión del hielo (hasta +65,7 m) la calcula el modelo; en equilibrio tarda milenios
            meanTempTarget: 27.5
        },
        visual: {
            atmosphereColor: [0.35, 0.65, 1.0],
            atmosphereOpacity: 0.95,
            oceanColor: [0.05, 0.25, 0.45],
            oceanShallowColor: [0.10, 0.50, 0.55],
            cloudDensity: 0.85,
            cloudColor: [0.92, 0.92, 0.95],
            hasCityLights: true,
            abioticFactor: 0.3,
            dinosaurFactor: 0.0,
            volcanicGlow: 0.0,
            erosionFactor: 0.45
        },
        dominantClade: 'HUMANIDAD POLAR Y ESPECIES OPORTUNISTAS',
        cladeDescription: 'Casquetes polares extintos. Nuevas franjas habitables en la Antártida y Siberia septentrional.',
        chronicle: 'No es un invernadero desbocado (eso exige ~1,1 veces la insolación actual y evaporar los océanos; Kopparapu 2014): es un clima de invernadero extremo en equilibrio. Tras milenios, la fusión de Groenlandia y la Antártida sube el mar hasta ~66 m (Fretwell 2013), sumergiendo Nueva York, Londres, Shanghái y Buenos Aires. En los trópicos la temperatura de bulbo húmedo supera con frecuencia los 35 °C, el límite fisiológico humano (Sherwood & Huber 2010).',
        impactWinter: false
    },

    waterworld: {
        id: 'waterworld',
        name: 'Mundo Océano (HIPOTÉTICO)',
        epoch: 'HIPERINUNDACIÓN POR BOMBARDEO COMETARIO',
        divergenceDate: 'Bombardeo masivo de cometas de hielo en el Cenozoico',
        params: {
            co2: 550,
            o2: 23.0,
            ch4: 1.5,
            so2: 0.02,
            solarLuminosity: 1.0,
            volcanism: 1.0,
            hasLife: true,
            hasCivilization: false,
            seaLevelOffset: 1200, // HIPOTÉTICO: supera los ±250 m físicamente posibles; exige ~4×10⁸ km³ de agua (~30 % del océano actual)
            meanTempTarget: 17.5
        },
        visual: {
            atmosphereColor: [0.10, 0.60, 1.0],
            atmosphereOpacity: 0.80,
            oceanColor: [0.01, 0.15, 0.45],
            oceanShallowColor: [0.05, 0.40, 0.60],
            cloudDensity: 0.80,
            cloudColor: [1.0, 1.0, 1.0],
            hasCityLights: false,
            abioticFactor: 0.0,
            dinosaurFactor: 0.2,
            volcanicGlow: 0.0,
            erosionFactor: 0.05
        },
        dominantClade: 'CETÁCEOS Y ORGANISMOS PELÁGICOS',
        cladeDescription: 'Planeta acuático donde solo emergen archipiélagos aislados en las cumbres del Tíbet y los Andes.',
        chronicle: 'ESCENARIO HIPOTÉTICO (no es un proceso físico plausible): +1.200 m requieren añadir unos 4×10⁸ km³ de agua, cerca de un tercio del océano actual; ni la fusión del hielo (+66 m) ni la tectónica (±250 m) lo permiten, y un bombardeo de cometas con esa masa esterilizaría la superficie. Los continentes han desaparecido bajo un abismo azul sin fin. La vida marina ha evolucionado formas colosales en un océano global sin barreras costeras.',
        impactWinter: false
    },

    pangea: {
        id: 'pangea',
        name: 'Supercontinente Pangea Revertido',
        epoch: 'GEOLOGÍA UNIFICADA (SUPERBLOQUE CONTINENTAL)',
        divergenceDate: 'La deriva continental se detuvo en una única masa terrestre',
        params: {
            co2: 1200,
            o2: 19.0,
            ch4: 2.2,
            so2: 0.15,
            solarLuminosity: 0.98, // Sol hace 250 Ma (Gough 1981)
            volcanism: 1.5,
            hasLife: true,
            hasCivilization: false,
            seaLevelOffset: -20, // Pérmico tardío: cerca o algo por debajo del actual (Haq & Schutter 2008)
            meanTempTarget: 23.0
        },
        visual: {
            atmosphereColor: [0.25, 0.65, 0.95],
            atmosphereOpacity: 0.70,
            oceanColor: [0.02, 0.20, 0.50],
            oceanShallowColor: [0.08, 0.48, 0.60],
            cloudDensity: 0.50,
            cloudColor: [0.95, 0.95, 0.98],
            hasCityLights: false,
            abioticFactor: 0.25,
            dinosaurFactor: 0.4,
            volcanicGlow: 0.1,
            erosionFactor: 0.55
        },
        dominantClade: 'REPTILES TERRESTRES ADAPTADOS A LA ARIDEZ',
        cladeDescription: 'Megadesierto interior en el supercontinente con vegetación confinada a las costas monzónicas.',
        chronicle: 'Unificada en un supercontinente rodeado por el inmenso océano Pantalasa, la lluvia no logra penetrar miles de kilómetros tierra adentro. El corazón del continente es el desierto más vasto que haya visto el planeta, azotado por tormentas de arena y vientos secos.',
        impactWinter: false
    },

    far_future: {
        id: 'far_future',
        name: 'Tierra del Futuro Lejano (+1.000 Ma)',
        epoch: 'OCASO BIOLÓGICO SOLAR (+1.000.000.000 AÑOS)',
        divergenceDate: 'Evolución estelar natural: el Sol aumenta su luminosidad ~9 % por Ga (Gough 1981)',
        params: {
            co2: 15,             // El termostato baja el CO₂ por debajo de ~10–150 ppm, límite de las plantas C3/C4 (Caldeira & Kasting 1992)
            o2: 10.0,            // Sin fotosíntesis el O₂ decae en ~10⁶–10⁷ años (Ozaki & Reinhard 2021); aquí, un estado intermedio
            ch4: 0.05,
            so2: 8.0,
            solarLuminosity: 1.10, // Gough 1981: +1 Ga ≈ 1,10 L☉; se acerca al umbral de invernadero desbocado (1,107 S⊕)
            volcanism: 0.8,
            hasLife: true,
            hasCivilization: false,
            seaLevelOffset: 0,    // la pérdida de agua por invernadero húmedo tarda cientos de Ma
            meanTempTarget: 48.0  // Hipertermia global
        },
        visual: {
            atmosphereColor: [0.80, 0.70, 0.50],
            atmosphereOpacity: 0.95,
            oceanColor: [0.15, 0.35, 0.45],     // Océanos salobres reducidos
            oceanShallowColor: [0.35, 0.50, 0.45],
            cloudDensity: 0.40,
            cloudColor: [0.90, 0.85, 0.75],
            hasCityLights: false,
            abioticFactor: 0.85,                // Prácticamente toda la vegetación ha muerto
            dinosaurFactor: 0.0,
            volcanicGlow: 0.0,
            erosionFactor: 0.88                 // Erosión extrema por vientos calientes desérticos
        },
        dominantClade: 'MICROORGANISMOS SUBTERRÁNEOS Y EXTREMÓFILOS',
        cladeDescription: 'Plantas y animales extintos por falta de CO2 y calor extremo. Sólo bacterias sobreviven en cuevas profundas.',
        chronicle: 'A medida que el Sol se vuelve más brillante, el termostato carbono-silicato extrae casi todo el CO₂ de la atmósfera y las plantas mueren por falta de carbono (Caldeira & Kasting 1992). Sin fotosíntesis el oxígeno decae en unos millones de años (Ozaki & Reinhard 2021). Cerca del umbral de invernadero húmedo el vapor de agua llega a la estratosfera, se fotodisocia y el hidrógeno escapa al espacio: los océanos se pierden lentamente, sin hervir (Kasting 1988). Es el camino hacia un estado tipo Venus.',
        impactWinter: false
    }
};

/**
 * Scenario Studio Manager: Soporte de persistencia en localStorage y exportación/importación JSON
 */
class ScenarioManager {
    constructor() {
        this.storageKey = 'terragenesis_custom_scenarios';
        this.loadCustomScenarios();
    }

    loadCustomScenarios() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (raw) {
                const custom = JSON.parse(raw);
                Object.assign(SCENARIOS, custom);
            }
        } catch (e) {
            console.warn('No se pudieron cargar escenarios personalizados desde localStorage', e);
        }
    }

    saveCustomScenario(scenario) {
        if (!scenario.id) {
            scenario.id = 'custom_' + Date.now();
        }
        SCENARIOS[scenario.id] = scenario;

        // Persistir en localStorage
        try {
            const customOnly = {};
            for (const [key, val] of Object.entries(SCENARIOS)) {
                if (key.startsWith('custom_')) {
                    customOnly[key] = val;
                }
            }
            localStorage.setItem(this.storageKey, JSON.stringify(customOnly));
        } catch (e) {
            console.warn('Error al guardar en localStorage', e);
        }

        return scenario.id;
    }

    exportJSON() {
        return JSON.stringify(SCENARIOS, null, 2);
    }

    importJSON(jsonString) {
        const parsed = JSON.parse(jsonString);
        let count = 0;
        for (const [key, val] of Object.entries(parsed)) {
            if (val && val.id && val.params && val.visual) {
                SCENARIOS[key] = val;
                if (key.startsWith('custom_')) {
                    this.saveCustomScenario(val);
                }
                count++;
            }
        }
        return count;
    }
}

window.SCENARIOS = SCENARIOS;
window.scenarioManager = new ScenarioManager();
