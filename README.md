# 🌍 Terra-Genesis

Un simulador planetario 3D hiperrealista e interactivo basado en física astrofísica, ciclos climáticos globales, tectónica de placas (deriva continental) y astrobiología. Desarrollado con Three.js, WebGL y shaders GLSL personalizados.

---

## 🌟 Características Principales

### ⏳ Deriva Continental y Tiempo Geodinámico (-250 Ma a +250 Ma)
* Visualización continua de la tectónica de placas desde la fragmentación de **Pangea (-250 Ma)**, el **Jurásico (-150 Ma)**, la extinción **K-Pg (-66 Ma)**, el **Presente (0 Ma)**, hasta la formación de **Pangea Ultima (+250 Ma)**.
* Mapas paleogeográficos de alta precisión basados en las cartas geológicas del *PALEOMAP Project* (Dr. Christopher Scotese).
* Animación interactiva de la deriva continental en tiempo real con control de velocidad.

### 🪐 Dinámica Orbital y Astrofísica
* Control de **distancia orbital al Sol** (0.70 UA a 1.60 UA) con cálculo de insolación en /m^2$.
* **Oblicuidad axial** (0° a 90°) para modelar estaciones templadas, nulas o extremas.
* **Velocidad de rotación** (duración del día de 6h a 72h) con pausa e inversión a rotación retrógrada.
* **Estrellas Huésped**: Sol (G2V), Enana Roja M (*TRAPPIST-1*, con anclaje mareal), Enana Naranja K (*Kepler-442b*) y Gigante Azul (*Rigel*).
* **Escudo Geomagnético**: Campo dipolo con simulación volumétrica de auroras boreales y australes 3D.

### 🧪 Química Atmosférica y Efecto Invernadero
* Simulación termodinámica de gases de efecto invernadero: $ (50 a 8.000 ppm), $ (0% a 35%), $ y $.
* Manto nuboso fotorrealista con sombreado de scattering y autoturbulencia.
* Presión superficial y resplandor de dispersión de Rayleigh en el limbo atmosférico.

### 🌋 Geología, Océanos y Silicatos
* **Eustasia marina interactiva**: Desplazamiento del nivel del mar de -130m a +1.500m sobre relieve topográfico real.
* **Vulcanismo global**: Puntos calientes y emisión de fisuras basálticas incandescentes.
* **Termostato Silicato-Carbono (Walker Feedback)**: Retroalimentación de meteorización química y autorregulación del carbono planetario.
* Paletas oceánicas configurables (azul marino, turquesa tropical somero, verde esmeralda y rojo ferroso arqueano).

### 🧬 Biosfera y Astrobiología
* Simulación de biosfera activa vs. mundo inerte/estéril.
* Pigmentos fotosintéticos adaptados a diferentes espectros solares (clorofila verde, retinal púrpura, fotorreceptores negros para enanas rojas, oro y ficocianina azul).
* Civilización tecnológica con red luminosa nocturna satelital.

### 🎯 Escenarios Extremos e Impactos de Asteroides
* Líneas temporales preconfiguradas: *Tierra Real*, *Tierra Inerte*, *Cataclismo Volcánico (Siberian Traps)*, *Tierra Bola de Nieve*, *Invernadero Desbocado (Venus húmedo)* y *Waterworld (+1.200m)*.
* Sistema balístico de selección de impacto de asteroides con cráteres persistentes, deformación cortical y nubes de polvo y hollín.

---

## 🚀 Cómo Ejecutar el Proyecto

1. Clona el repositorio:
   `ash
   git clone https://github.com/clfranmunoz-bot/Terra-Genesis.git
   cd Terra-Genesis
   `

2. Inicia un servidor web local (por ejemplo con Python):
   `ash
   python server.py
   `
   *o alternativamente:*
   `ash
   python -m http.server 8080
   `

3. Abre en tu navegador moderno preferido (con aceleración por hardware WebGL):
   `
   http://localhost:8080/index.html
   `

---

## 🛠️ Tecnologías Utilizadas
* **Three.js** (WebGL 3D Rendering Engine)
* **GLSL Shaders** (Shaders de fragmentos y vértices fotorrealistas con atmósfera de scattering múltiple y nubes procedurales)
* **HTML5 / CSS3** (Interfaz HUD Sci-Fi con diseño responsivo y modo cinemático)
* **JavaScript ES6+** (Motores desacoplados: simulation.js, strophysics.js, geology.js, strobiology.js, 	ectonics.js)

---

## 📄 Licencia
Este proyecto está bajo la Licencia MIT.
