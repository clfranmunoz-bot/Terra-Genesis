# 🌍 Terra-Genesis

Simulador planetario 3D interactivo (Three.js + WebGL) que explora "¿y si…?" sobre la Tierra: otra estrella, otra órbita, otra atmósfera, impactos, glaciaciones y tiempo geológico. **La física está basada en modelos publicados y validada contra valores reales** (ver [Validación](#-validación)).

---

## 🚀 Cómo ejecutarlo

```bash
python3 server.py            # o: python3 -m http.server 8080
```
Luego abre `http://localhost:8080/index.html` en un navegador con WebGL.

Pruebas de validación (Node, sin dependencias):
```bash
node tests/validacion.js
```

---

## 🔬 Modelos físicos y fuentes

Toda la física vive en [`js/fisica.js`](js/fisica.js): funciones puras, sin DOM, cada una con su ecuación, unidades, fuente y simplificaciones comentadas.

| Área | Modelo | Fuente principal |
|---|---|---|
| Estrellas | L, Teff, masa y edad reales (Sol, K5V, Próxima Centauri, Rigel) | Prša 2016; Pecaut & Mamajek 2013; Boyajian 2012; Przybilla 2010 |
| Insolación | S = L/(4πd²); media diaria por latitud con excentricidad, oblicuidad y precesión | Kopp & Lean 2011; Berger 1978 |
| Zona habitable | Límites de S_eff según Teff | Kopparapu et al. 2013, 2014 |
| Anclaje por marea | t = ωa⁶IQ/(3GM★²k₂R⁵) comparado con la edad estelar | Gladman et al. 1996; Heller et al. 2011 |
| Luna y oblicuidad | Estable con Luna; caótica 0–85° sin Luna (en Ma) | Laskar et al. 1993; Lissauer et al. 2012 |
| Magnetosfera | Magnetopausa de Chapman-Ferraro y óvalo auroral dipolar | Chapman & Ferraro 1931; Shue et al. 1998 |
| Clima | Balance energético latitudinal de Budyko-Sellers (18 bandas) con histéresis de hielo y océano de dos capas | North et al. 1981; IPCC AR6 tabla 7.10; Held et al. 2010 |
| Forzamientos | CO₂, CH₄, N₂O; aerosoles de sulfato; nubes | Myhre et al. 1998; Hansen et al. 2005; Pinto et al. 1989; Loeb et al. 2018 |
| Límites de invernadero | Húmedo y desbocado según la insolación | Kasting 1988; Kopparapu 2013/2014; Goldblatt 2013 |
| Atmósfera | Clausius-Clapeyron; espesor óptico de Rayleigh; color del cielo por el espectro estelar | Alduchov & Eskridge 1996; Bodhaine et al. 1999 |
| Carbono-silicato | W = W₀(C/C₀)^0,3·e^((T−T₀)/13,7); V₀ = 0,26 Gt CO₂/a; τ ≈ 400 ka | Walker, Hays & Kasting 1981; Gerlach 2011; Archer 2005 |
| Nivel del mar | Hielo (+65,7 m / −125 m UMG) + eustasia tectónica (±250 m) | Fretwell 2013; Clark 2009; Haq 1987; Müller 2008 |
| Paleoclima | CO₂, O₂, nivel del mar, velocidades de placas y luminosidad solar por época | Foster et al. 2017; Berner 2009; DeMets 2010; Gough 1981 |
| Impactos | Entrada atmosférica, fragmentación, explosión aérea, cráter transitorio y final, sismo, invierno de impacto | Collins, Melosh & Marcus 2005; Brugger et al. 2017 |
| Biosfera | Índice de habitabilidad con factores, pigmentos según la estrella, umbrales de O₂ | Kiang 2007; Catling 2005; Segura 2003; Belcher & McElwain 2008 |
| Océano | Color por absorción del agua y fitoplancton; pH de la química del carbonato | Pope & Fry 1997; Morel & Maritorena 2001; Zeebe & Wolf-Gladrow 2001 |

La lista completa está en el panel **📚 FUENTES** de la app.

---

## ⏱️ Tiempo de la animación frente al tiempo real

| Proceso | En pantalla | Tiempo real del proceso |
|---|---|---|
| Clima | 1 s = 5 años | capa de mezcla ~5 años; océano profundo, siglos |
| Estaciones | 1 s = 15 días | 1 año |
| Termostato carbono-silicato | 1 s = 50.000 años | ~400.000 años |
| Oblicuidad sin Luna | 1 s = 1 Ma | 10⁶–10⁷ años |
| Escala geológica (reproducción) | 1 s = 25 Ma | — |

---

## ✅ Validación

`tests/validacion.js` comprueba 61 valores reales, entre ellos:

- Tierra actual: T media 15 °C, albedo 0,30, T_eq 255 K, efecto invernadero ~33 K.
- 1361 W/m² a 1 UA; media global S/4 = 340 W/m².
- Forzamiento de 2×CO₂ = 3,71 W/m²; sensibilidad climática de 2,7 °C (IPCC: 2,5–4 °C).
- Forzamientos actuales de CH₄ (0,52) y N₂O (0,20 W/m²); Pinatubo −3,7 W/m².
- Histéresis de bola de nieve; umbral de invernadero desbocado ≈ 1,1 S⊕.
- Magnetopausa a ~10 R⊕ y óvalo auroral a ~72°.
- Chicxulub: cráter de 173 km y enfriamiento de 29 K con recuperación; Barringer 1,1 km; Tunguska y Cheliábinsk explotan en el aire.
- Termostato: relajación de ~310 ka; nivel del mar +65,7 m / −125 m.

---

## ⚠️ Limitaciones conocidas

- El clima es zonal y medio anual: sin continentes, circulación atmosférica ni estaciones en la temperatura.
- Las nubes y el vapor de agua son retroalimentaciones globales, no nubes simuladas.
- La paleogeografía usa texturas a 240, 150 y 65 Ma interpoladas; no hay reconstrucción de placas entre hitos, y +250 Ma es una proyección.
- La fórmula logarítmica del CO₂ subestima el forzamiento por encima de ~2000 ppm.
- El invernadero desbocado se representa como un estado (>1100 °C), no se simula.
- La magnetosfera usa el mismo viento estelar para todas las estrellas (las enanas M lo tienen más denso).
- Los colores de cielo, océano y vegetación son aproximaciones visuales de procesos reales.
- **Mundo Océano (+1.200 m)** es un escenario hipotético: supera los límites físicos del nivel del mar.

---

## 🛠️ Tecnologías

Three.js r128, shaders GLSL, HTML5/CSS3 y JavaScript sin dependencias adicionales.

## 📄 Licencia

MIT.
