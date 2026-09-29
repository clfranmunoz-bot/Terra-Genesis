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
| Insolación | S = L/(4πd²); media diaria por latitud y día con excentricidad, oblicuidad y precesión; longitud solar con la ecuación de Kepler | Kopp & Lean 2011; Berger 1978 |
| Zona habitable | Límites de S_eff según Teff | Kopparapu et al. 2013, 2014 |
| Anclaje por marea | t = ωa⁶IQ/(3GM★²k₂R⁵) comparado con la edad estelar | Gladman et al. 1996; Heller et al. 2011 |
| Luna y oblicuidad | Estable con Luna; caótica 0–85° sin Luna (en Ma) | Laskar et al. 1993; Lissauer et al. 2012 |
| Magnetosfera | Magnetopausa de Chapman-Ferraro y óvalo auroral dipolar | Chapman & Ferraro 1931; Shue et al. 1998 |
| Clima | Balance energético **estacional** de Budyko-Sellers (18 bandas, cada una con columna de tierra y de océano), histéresis de hielo y océano de dos capas; transporte según la presión y la rotación | North & Coakley 1979; North et al. 1981; IPCC AR6 tabla 7.10; Held et al. 2010; Williams & Kasting 1997 |
| Planetas anclados | Dos cajas día/noche con contraste calibrado con GCM | Yang, Cowan & Abbot 2013; Leconte et al. 2013 |
| Forzamientos | CO₂, CH₄, N₂O (AR6, con ajustes troposféricos); CO₂ muy alto; aerosoles de sulfato; nubes | Meinshausen et al. 2020; Byrne & Goldblatt 2014; Hansen et al. 2005; Pinto et al. 1989; Loeb et al. 2018 |
| Límites de invernadero | Húmedo y desbocado según la insolación | Kasting 1988; Kopparapu 2013/2014; Goldblatt 2013 |
| Atmósfera | Clausius-Clapeyron; espesor óptico de Rayleigh; color del cielo por el espectro estelar | Alduchov & Eskridge 1996; Bodhaine et al. 1999 |
| Carbono-silicato | W = W₀(C/C₀)^0,3·e^((T−T₀)/13,7); V₀ = 0,26 Gt CO₂/a; τ ≈ 400 ka | Walker, Hays & Kasting 1981; Gerlach 2011; Archer 2005 |
| Nivel del mar | Hielo (+65,7 m / −125 m UMG, con retardo τ = 2000 años) + eustasia tectónica (±250 m); inundación sobre topografía calibrada (0–6400 m) y batimetría GEBCO | Fretwell 2013; Clark 2009; Levermann 2013; Haq 1987; Müller 2008 |
| Paleoclima | CO₂, O₂, nivel del mar, velocidades de placas y luminosidad solar por época | Foster et al. 2017; Berner 2009; DeMets 2010; Gough 1981 |
| Impactos | Entrada atmosférica, fragmentación, explosión aérea, frenado en el océano, ángulo elegible, cráter transitorio y final, sismo, invierno de impacto | Collins, Melosh & Marcus 2005; Brugger et al. 2017 |
| Biosfera | Índice de habitabilidad con factores (O₂ como presión parcial), pigmentos según la estrella, umbrales de O₂ | Kiang 2007; Catling 2005; Segura 2003; Belcher & McElwain 2008 |
| UV y espectro | Índice UV con la declinación del día; espectro de tránsito como altura efectiva | Madronich 2007; Lecavelier des Etangs 2008; Kaltenegger & Traub 2009 |
| Imagen | Luz de cuerpo negro de la estrella (CIE 1931) y su diámetro angular; dispersión simple de Rayleigh y Mie; masa de aire; hielo, nieve y vista térmica desde el modelo de clima | Wyman, Sloan & Shirley 2013; Kasten & Young 1989; Hillaire 2015 |
| Océano | Color por absorción del agua y fitoplancton; pH de la química del carbonato | Pope & Fry 1997; Morel & Maritorena 2001; Zeebe & Wolf-Gladrow 2001 |

La lista completa está en el panel **📚 FUENTES** de la app.

---

## ⏱️ Tiempo de la animación frente al tiempo real

| Proceso | En pantalla | Tiempo real del proceso |
|---|---|---|
| Clima | 1 s = 5 años | capa de mezcla ~5 años; océano profundo, siglos |
| Estaciones (lo que se ve) | 1 s = 15 días; se muestra el ciclo anual del último año del modelo | 1 año |
| Nivel del mar por el hielo | τ = 2000 años (≈ 7 min en pantalla) | milenios |
| Termostato carbono-silicato | 1 s = 50.000 años | ~400.000 años |
| Oblicuidad sin Luna | 1 s = 1 Ma | 10⁶–10⁷ años |
| Escala geológica (reproducción) | 1 s = 25 Ma | — |

---

## ✅ Validación

`tests/validacion.js` comprueba 84 valores reales, entre ellos:

- Tierra actual: T media 15 °C, albedo 0,30, T_eq 255 K, efecto invernadero ~33 K.
- Estaciones: amplitud de ~26 K a 60 °N (continental), ~6 K a 60 °S (oceánica) y <5 K en el ecuador; más nieve en enero que en julio.
- 1361 W/m² a 1 UA; media global S/4 = 340 W/m².
- Forzamiento efectivo de 2×CO₂ = 3,93 W/m² (AR6); sensibilidad climática de ~3,4 °C (IPCC: 2,5–4 °C); 40 W/m² a 50.000 ppm.
- Forzamientos actuales de CH₄ (0,56) y N₂O (0,22 W/m²); Pinatubo −3,7 W/m².
- Planeta anclado: contraste día–noche de 40–80 K que baja con más presión.
- Índice UV ~12 en el ecuador; O₃ a 9,8 µm ~30 km sobre el continuo en tránsito; el Sol mide 0,53° desde 1 UA.
- Histéresis de bola de nieve; umbral de invernadero desbocado ≈ 1,1 S⊕.
- Magnetopausa a ~10 R⊕ y óvalo auroral a ~72°.
- Chicxulub: cráter de 173 km y enfriamiento de ~31 K con recuperación; Barringer 1,1 km; Tunguska y Cheliábinsk explotan en el aire; 4 km de océano achican el cráter.
- Termostato: relajación de ~310 ka; nivel del mar +65,7 m / −125 m.

---

## ⚠️ Limitaciones conocidas

- El clima es zonal (18 bandas con tierra y océano): sin circulación oceánica ni dinámica atmosférica. La fracción de tierra por banda es la actual en todas las épocas.
- Las nubes y el vapor de agua son retroalimentaciones globales, no nubes simuladas.
- La paleogeografía usa texturas a 240, 150 y 65 Ma interpoladas; no hay reconstrucción de placas entre hitos. El futuro (+250 Ma) no tiene mapa: se muestra la geografía actual.
- La atmósfera se dibuja 5 veces más gruesa (espesores ópticos reales) y el relieve se exagera ×15.
- Por encima de ~1800 ppm el forzamiento del CO₂ se corrige con un solo valor de Byrne & Goldblatt 2014 (40 W/m² a 50.000 ppm).
- El invernadero desbocado se representa como un estado (>1100 °C), no se simula.
- La magnetosfera usa el mismo viento estelar para todas las estrellas (las enanas M lo tienen más denso).
- El modelo anclado no incluye la cubierta de nubes subestelar, que subiría el albedo del lado diurno.
- Los colores de cielo, océano y vegetación son aproximaciones visuales de procesos reales.
- **Mundo Océano (+1.200 m)** es un escenario hipotético: supera los límites físicos del nivel del mar.

---

## 🛠️ Tecnologías

Three.js r128, shaders GLSL, HTML5/CSS3 y JavaScript sin dependencias adicionales.

## 📄 Licencia

MIT.
