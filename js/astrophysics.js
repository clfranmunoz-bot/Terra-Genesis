/**
 * Astrophysics Module: Dinámica orbital, oblicuidad axial, influencia lunar,
 * estrellas huésped (Sol vs Enana Roja con Tidal Locking) y magnetosfera con auroras 3D.
 */
class AstrophysicsEngine {
    constructor(simulation) {
        this.simulation = simulation;

        this.params = {
            obliquityDeg: 23.44,      // Inclinación axial actual
            hasMoon: true,            // Estabilizador giroscópico lunar
            starType: 'sun_g2v',      // 'sun_g2v' (Sol) o 'red_dwarf_m' (Enana Roja)
            isTidallyLocked: false,   // Anclaje por marea (Mundo Ojo)
            magneticField: 1.0,       // 1.0 = 50 microTesla actual
            orbitalPeriodDays: 365.25,
            dayOfYear: 172            // Solsticio de verano en hemisferio norte (~21 de junio)
        };

        // Estado dinámico
        this.chaoticTiltTimer = 0;
        this.auroraIntensity = 1.0;
    }

    setObliquity(degrees) {
        this.params.obliquityDeg = Math.max(0, Math.min(90, degrees));
    }

    setMoon(hasMoon) {
        this.params.hasMoon = hasMoon;
    }

    setStarType(type) {
        this.params.starType = type;
        if (type === 'red_dwarf_m') {
            this.params.isTidallyLocked = true;
            this.simulation.target.solarLuminosity = 0.85; // Menor radiación visible, mayor infrarrojo
            this.simulation.target.atmosphereColor = [0.85, 0.40, 0.25]; // Cielo rojizo
        } else {
            this.params.isTidallyLocked = false;
            this.simulation.target.solarLuminosity = 1.0;
            this.simulation.target.atmosphereColor = [0.15, 0.55, 1.0];
        }
    }

    setTidalLock(locked) {
        this.params.isTidallyLocked = locked;
    }

    setMagneticField(strength) {
        this.params.magneticField = Math.max(0, Math.min(2.5, strength));
    }

    /**
     * Calcula la insolación solar estacional según latitud y día del año
     */
    getSeasonalInsulation(latDeg) {
        const radLat = (latDeg * Math.PI) / 180;
        const tiltRad = (this.params.obliquityDeg * Math.PI) / 180;

        // Declinación solar según día del año
        const dayAngle = ((this.params.dayOfYear - 80) / this.params.orbitalPeriodDays) * Math.PI * 2;
        const solarDeclination = tiltRad * Math.sin(dayAngle);

        // Insolación diaria media integrada
        const cosZenith = Math.sin(radLat) * Math.sin(solarDeclination) + 
                          Math.cos(radLat) * Math.cos(solarDeclination);

        return Math.max(0, cosZenith);
    }

    update(dt) {
        // 1. Progresión estacional en la órbita
        if (!this.params.isTidallyLocked) {
            this.params.dayOfYear = (this.params.dayOfYear + dt * 15) % this.params.orbitalPeriodDays;
        }

        // 2. Si no hay Luna, la oblicuidad se vuelve inestable (deriva caótica como en Marte)
        if (!this.params.hasMoon) {
            this.chaoticTiltTimer += dt * 0.5;
            const chaoticNoise = Math.sin(this.chaoticTiltTimer * 0.7) * 
                                 Math.cos(this.chaoticTiltTimer * 0.3) * 35;
            this.params.obliquityDeg = Math.max(0, Math.min(88, 30 + chaoticNoise));
        }

        // 3. Intensidad auroral en función del campo magnético y actividad solar
        this.auroraIntensity = this.params.magneticField * (0.7 + 0.3 * Math.sin(Date.now() * 0.003));

        // 4. Si el campo magnético cae a cero, el viento solar destruye la capa de ozono
        if (this.params.magneticField < 0.15) {
            this.simulation.target.habitability = Math.min(this.simulation.target.habitability, 40);
        }
    }
}

window.AstrophysicsEngine = AstrophysicsEngine;
