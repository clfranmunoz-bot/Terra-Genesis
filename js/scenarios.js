/**
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
            co2: 12500,
            o2: 0.0,
            ch4: 85.0,
            so2: 12.0,
            solarLuminosity: 1.0,
            volcanism: 1.8,
            hasLife: false,
            hasCivilization: false,
            seaLevelOffset: 45,
            meanTempTarget: 34.5
        },
        visual: {
            atmosphereColor: [0.95, 0.55, 0.15],
            atmosphereOpacity: 1.2,
            oceanColor: [0.12, 0.35, 0.22],     // Verde ferroso
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
        chronicle: 'Al no ocurrir la Gran Oxidación (hace 2.400 Ma), el planeta es un mundo inerte semejante a un Marte húmedo o un preludio de Venus. La atmósfera es sofocante y anóxica con cielos color ámbar. Las masas continentales son pura roca desnuda y cañones gigantescos labrados por la erosión extrema.',
        impactWinter: false
    },

    dinosaurs: {
        id: 'dinosaurs',
        name: 'Imperio de los Dinosaurios',
        epoch: 'PRESENTE ALTERNATIVO (66 Ma POST-IMPACTO EVITADO)',
        divergenceDate: 'Hace 66 Millones de Años (El asteroide de Chicxulub erró la Tierra por 15.000 km)',
        params: {
            co2: 850,
            o2: 28.5,
            ch4: 4.5,
            so2: 0.08,
            solarLuminosity: 1.0,
            volcanism: 1.1,
            hasLife: true,
            hasCivilization: false,
            seaLevelOffset: 25,
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
            co2: 6500,
            o2: 9.0,
            ch4: 40.0,
            so2: 180.0,
            solarLuminosity: 0.90,
            volcanism: 25.0,
            hasLife: true,
            hasCivilization: false,
            seaLevelOffset: -15,
            meanTempTarget: 8.5
        },
        visual: {
            atmosphereColor: [0.85, 0.65, 0.20],
            atmosphereOpacity: 1.4,
            oceanColor: [0.35, 0.08, 0.42],
            oceanShallowColor: [0.45, 0.15, 0.35],
            cloudDensity: 0.98,
            cloudColor: [0.28, 0.24, 0.22],
            hasCityLights: false,
            abioticFactor: 0.6,
            dinosaurFactor: 0.0,
            volcanicGlow: 1.0,
            erosionFactor: 0.70
        },
        dominantClade: 'MICROORGANISMOS METANÓGENOS Y HONGOS',
        cladeDescription: 'Colapso ecológico del 96% de las especies marinas y 75% terrestres. Océanos ácidos tóxicos.',
        chronicle: 'Erupciones basálticas continuas de miles de kilómetros cúbicos de lava incendiaron mantos de carbón. El planeta está sumido en lluvia ácida concentrada y anoxia oceánica. Los mares han adquirido un tono púrpura por bacterias sulfurosas y los cielos son de un plomo amarillento.',
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
            seaLevelOffset: -120,
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
        chronicle: 'Una retroalimentación de albedo positiva causó que el hielo polar avanzara hasta alcanzar los trópicos y el ecuador. Con una reflectividad superficial del 80%, el calor solar escapa al espacio, manteniendo el planeta en una congelación total con temperaturas ecuatoriales de -30°C.',
        impactWinter: false
    },

    runaway_hot: {
        id: 'runaway_hot',
        name: 'Invernadero Desbocado',
        epoch: 'POST-CRISIS CLIMÁTICA TOTAL (AÑO 2200 d.C.)',
        divergenceDate: 'Liberación total de permafrost y clatratos submarinos',
        params: {
            co2: 2400,
            o2: 18.0,
            ch4: 35.0,
            so2: 2.5,
            solarLuminosity: 1.0,
            volcanism: 1.2,
            hasLife: true,
            hasCivilization: true,
            seaLevelOffset: 68,
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
        chronicle: 'La fusión completa del hielo polar elevó el nivel de los océanos 68 metros, sumergiendo a Nueva York, Londres, Shanghái y Buenos Aires. El ecuador se ha convertido en una zona inhabitable por calor húmedo mortal, desplazando la biosfera y la civilización hacia las altas latitudes polares.',
        impactWinter: false
    },

    waterworld: {
        id: 'waterworld',
        name: 'Mundo Océano (Waterworld)',
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
            seaLevelOffset: 1200, // +1.200 metros: sumerge casi toda la tierra
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
        chronicle: 'Un diluvio astronómico añadió miles de millones de metros cúbicos de agua al planeta. Los continentes han desaparecido bajo un abismo azul sin fin. La vida marina ha evolucionado formas colosales en un océano global sin barreras costeras.',
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
            solarLuminosity: 1.0,
            volcanism: 2.2,
            hasLife: true,
            hasCivilization: false,
            seaLevelOffset: -35,
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
            erosionFactor: 0.55,
            pangeaFactor: 1.0
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
        divergenceDate: 'Evolución estelar natural: El Sol aumenta un 10% su luminosidad',
        params: {
            co2: 15,             // Inanición de CO2: desgasificación de silicatos devora el carbono
            o2: 3.0,              // Colapso total de la fotosíntesis
            ch4: 0.05,
            so2: 8.0,
            solarLuminosity: 1.12, // Sol más caliente y brillante
            volcanism: 0.8,
            hasLife: true,
            hasCivilization: false,
            seaLevelOffset: -95,  // Océanos evaporándose hacia el espacio
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
        chronicle: 'A medida que el Sol envejece y se vuelve más brillante, el termostato de silicato terrestre extrajo casi todo el CO2 de la atmósfera, provocando la extinción de las plantas complejas. Los océanos hierven lentamente hacia la estratosfera y el planeta se encamina hacia su fase Venus terminal.',
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
