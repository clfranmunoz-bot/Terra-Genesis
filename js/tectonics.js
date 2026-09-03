/**
 * Tectonics Module: Cinemática de placas tectónicas, deriva continental continua,
 * polos de rotación de Euler y reconstrucción geológica (-250 Ma a +250 Ma).
 */
class TectonicsEngine {
    constructor(simulation) {
        this.simulation = simulation;

        this.currentMa = 0.0; // Millones de años (0 = hoy, -250 = Pérmico, +250 = Pangea Ultima)

        // Hitos geocronológicos clave
        this.epochs = [
            {
                ma: -250,
                name: 'Pérmico Tardío / Pangea Ensamblada',
                period: 'PÉRMICO (-250 Ma)',
                co2: 1600,
                o2: 16.0,
                temp: 22.5,
                seaLevel: -45,
                pangeaFactor: 1.0,
                clade: 'SINÁPSIDOS Y REPTILES BASALES',
                desc: 'Supercontinente Pangea unificado con megadesierto central y océano Pantalasa.',
                chronicle: 'Hace 250 Ma: La deriva continental ha unido todas las masas terrestres en el supercontinente Pangea. El océano Pantalasa cubre el resto del planeta. La aridez continental en el interior es extrema y los precursores de los mamíferos (terápsidos) dominan la tierra firme.'
            },
            {
                ma: -150,
                name: 'Jurásico / Ruptura de Pangea',
                period: 'JURÁSICO SUPERIOR (-150 Ma)',
                co2: 1850,
                o2: 20.0,
                temp: 23.5,
                seaLevel: 75,
                pangeaFactor: 0.65,
                clade: 'DINOSAURIOS SAURÓPODOS GIGANTES',
                desc: 'Apertura del Atlántico central y fragmentación de Laurasia y Gondwana.',
                chronicle: 'Hace 150 Ma: Pangea se fragmenta por rifts volcánicos colosales. El mar de Tetis penetra entre Laurasia (norte) y Gondwana (sur). El clima es cálido y húmedo, sin casquetes polares, permitiendo la era dorada de los dinosaurios gigantes y frondosos bosques de cícadas y coníferas.'
            },
            {
                ma: -66,
                name: 'Límite Cretácico-Paleógeno (K-Pg)',
                period: 'CRETÁCICO TERMINAL (-66 Ma)',
                co2: 850,
                o2: 25.0,
                temp: 21.0,
                seaLevel: 110,
                pangeaFactor: 0.25,
                clade: 'DINOSAURIOS NO AVIARES (LÍMITE K-Pg)',
                desc: 'Continentes cuasi-modernos, mar interior de Norteamérica e India como isla veloz.',
                chronicle: 'Hace 66 Ma: El Atlántico sur se ha ensanchado. El mar interior occidental inunda Norteamérica dividiéndola en dos islas continentales (Laramidia y Appalachia). El subcontinente indio navega velozmente a través del océano Índico hacia Asia antes del impacto de Chicxulub.'
            },
            {
                ma: 0,
                name: 'Presente / Antropoceno',
                period: 'PRESENTE ANTROPOCENO (0 Ma)',
                co2: 420,
                o2: 21.0,
                temp: 15.0,
                seaLevel: 0,
                pangeaFactor: 0.0,
                clade: 'HOMO SAPIENS (CIVILIZACIÓN TECNOLÓGICA)',
                desc: 'Siete continentes modernos, casquetes polares estables y actividad antrópica.',
                chronicle: 'Presente (0 Ma): Configuración continental actual. La colisión de la India ha elevado la meseta del Tíbet y los Himalayas. Los casquetes de hielo en la Antártida y Groenlandia regulan el nivel del mar y sustentan una civilización industrial interconectada.'
            },
            {
                ma: 250,
                name: 'Pangea Ultima / Futuro Supercontinente',
                period: 'PANGEA ULTIMA (+250 Ma)',
                co2: 320,
                o2: 18.5,
                temp: 27.0,
                seaLevel: -50,
                pangeaFactor: 0.95,
                clade: 'BIOTA POST-HUMANA ADAPTADA AL CALOR',
                desc: 'El Atlántico se subduce y cierra. América colisiona con Afro-Eurasia en un nuevo superbloque.',
                chronicle: 'Dentro de +250 Ma: La subducción del Atlántico ha provocado el cierre del océano y la colisión frontal de América del Norte y del Sur con la masa de Europa y África. Se forma el nuevo supercontinente Pangea Ultima con un mar interior semicerrado y un clima global hiperárido.'
            }
        ];
    }

    /**
     * Devuelve el estado geológico interpolado en cualquier millón de años (-250 a +250)
     */
    getStateAtMa(ma) {
        ma = Math.max(-250, Math.min(250, ma));

        // Encontrar los dos hitos geológicos entre los cuales se sitúa ma
        let lower = this.epochs[0];
        let upper = this.epochs[this.epochs.length - 1];

        for (let i = 0; i < this.epochs.length - 1; i++) {
            if (ma >= this.epochs[i].ma && ma <= this.epochs[i + 1].ma) {
                lower = this.epochs[i];
                upper = this.epochs[i + 1];
                break;
            }
        }

        const span = upper.ma - lower.ma;
        const frac = span === 0 ? 0 : (ma - lower.ma) / span;

        return {
            ma: Math.round(ma),
            period: frac < 0.5 ? lower.period : upper.period,
            name: frac < 0.5 ? lower.name : upper.name,
            co2: Math.round(lower.co2 + (upper.co2 - lower.co2) * frac),
            o2: Math.round((lower.o2 + (upper.o2 - lower.o2) * frac) * 10) / 10,
            temp: Math.round((lower.temp + (upper.temp - lower.temp) * frac) * 10) / 10,
            seaLevel: Math.round(lower.seaLevel + (upper.seaLevel - lower.seaLevel) * frac),
            pangeaFactor: lower.pangeaFactor + (upper.pangeaFactor - lower.pangeaFactor) * frac,
            clade: frac < 0.5 ? lower.clade : upper.clade,
            desc: frac < 0.5 ? lower.desc : upper.desc,
            chronicle: frac < 0.5 ? lower.chronicle : upper.chronicle
        };
    }

    /**
     * Aplica el tiempo geológico directamente a la simulación planetaria
     */
    setTimeMa(ma) {
        this.currentMa = ma;
        const state = this.getStateAtMa(ma);

        this.simulation.target.co2 = state.co2;
        this.simulation.target.o2 = state.o2;
        this.simulation.target.meanTempTarget = state.temp;
        this.simulation.target.seaLevelOffset = state.seaLevel;
        this.simulation.target.pangeaFactor = state.pangeaFactor;
        this.simulation.target.geologicalMa = ma;
        this.simulation.current.geologicalMa = ma; // Respuesta interactiva inmediata al frotar la barra
        this.simulation.target.hasCivilization = (Math.abs(ma) < 2); // Luces nocturnas solo en torno al presente

        return state;
    }
}

window.TectonicsEngine = TectonicsEngine;
