# 🔬 Ct-Pp: Comparador de Análisis FRX (Cutting vs. Pulpa)

Plataforma especializada en reconciliación geológica y control de calidad analítico (QA/QC) entre lecturas instrumentales de **FRX Portátil en terreno (Cutting)** y ensayos químicos de laboratorio oficial **(Pulpa)** en sondajes de exploración minera.

---

## 🌟 Características Principales

* **Perfil en Profundidad Multi-Track y Superpuesto**:
  - Visualización sincronizada de concentraciones tramo a tramo (cada 2 metros) a lo largo del sondaje.
  - Modos de visualización vertical (estilo WellCAD) y horizontal (con *rangeslider* interactivo).
  - Barras de discrepancia $\Delta = \text{Cutting} - \text{Pulpa}$ con código de color dinámico.
* **Control de Calidad Analítico (QA/QC)**:
  - Regresión de Eje Mayor Reducido (**RMA - *Reduced Major Axis***) para calibración instrumental asumiendo error en ambas variables.
  - Métrica de Precisión de Duplicados **HARD** (*Half Absolute Relative Difference*) bajo estándar internacional (JORC / NI 43-101).
  - Gráfico de **Bland-Altman** para evaluación de sesgo relativo vs. concentración con límites de acuerdo del 95% ($\pm 1.96\,\text{SD}$).
* **Comparación Multi-Elemento**:
  - Cuadrícula de dispersión 1:1 simultánea para múltiples elementos (Cu, Mo, Fe, S, As, etc.).
  - Matriz global y semáforo de confiabilidad instrumental para el catálogo de 35 elementos.
  - Gráficos de correlación cruzada entre elementos (ej. Cu vs Mo, Cu vs Fe).
* **Filtros Económicos y Detección (<LOD)**:
  - Filtrado dinámico por Ley de Corte mínima con selección de criterio (Pulpa, Cutting o ambos).
  - Tratamiento riguroso de límites de detección (<LOD): exclusión o imputación (LOD/2, LOD/√2).
* **Personalización y Accesibilidad**:
  - Modo claro con fondo blanco puro (`#ffffff`) y modo oscuro de alto contraste.
  - Control de color, estilos de línea (sólida, punteada, segmentada) y grosores por variable.
  - Tooltip enriquecido en cada punto mostrando sondaje, tramo de 2m y leyes.
* **Acceso Remoto Seguro**:
  - Integración nativa con Cloudflare Tunnel para compartir la plataforma temporalmente mediante enlace seguro HTTPS con temporizador de desconexión automática.

---

## 🚀 Instalación y Uso

1. **Clonar el repositorio**:
   ```bash
   git clone https://github.com/clfranmunoz-bot/Ct-Pp.git
   cd Ct-Pp
   ```

2. **Instalar dependencias**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Ejecutar la aplicación**:
   ```bash
   streamlit run app.py
   ```
   *O en Windows, hacer doble clic en el archivo lanzador `Iniciar_Comparador_FRX.bat`.*

---

## 🔒 Seguridad e Integridad de Datos

Esta plataforma opera bajo **modo estricto de solo lectura** sobre las carpetas de datos de campaña en OneDrive. Ningún archivo maestro original es modificado, renombrado ni sobreescrito.
