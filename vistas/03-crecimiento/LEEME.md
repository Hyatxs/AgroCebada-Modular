# Crecimiento de la cebada

**Sección:** 03

**Entrada:** `vistas/03-crecimiento/index.html`

**Función:** Puerta a la animación actual; espacio para desarrollar una vista propia.

**Regla:** trabaja aquí en tu rama. No modifiques archivos compartidos (`common.js`, `styles.css`, `data.js`, `config.js`, `conexion-api.js`, `backend/`) sin coordinarlo.


## Sección «Crecimiento» en la vista principal

- `seccion-crecimiento.js`: animación de la parcela (siembra → emergencia → amacollamiento →
  encañe → espigamiento/pico → llenado → madurez → cosecha con cosechadora), lista de etapas
  con sus meses, los tres hitos (inicio, pico, término) y un calendario con el verdor real.
- Las fechas se calculan con la curva NDVI mediana de las 197 parcelas (`data.js`), no están
  escritas a mano.
- Estilos al final de `estilos.css`, todos con prefijo `.crec-`.
- Se monta en `vistas/01-introduccion/index.html` dentro de `<div id="crecimiento-demo">`.
- `campo.js`, `animacion-campo.js` e `historia-crecimiento.js` siguen siendo del mapa 3D y no
  se tocaron.

### Versión del 18 de octubre (noche)

- `campo-cebada.js` (nuevo): el campo pintado en `<canvas>`, sin figuras geométricas a la vista: cielo con nubes
  suaves, sierra con volcán, surcos en perspectiva, plantas con hojas, macollos y espigas con aristas, lluvia, un
  tractor en la siembra y una cosechadora al final. Lo usa también la parte 4 del capítulo 1.
- `seccion-crecimiento.js` (reescrito, con las ideas y los textos de Lulú): avanza solo al entrar en pantalla; se
  puede pausar, arrastrar la barra de meses o tocar una etapa. Las fechas son las del NB03 para las 148 parcelas
  que reverdecieron primero (inicio 15 jun, pico 31 ago, fin 10 nov), las mismas de la parte 4. El verdor del campo
  sigue la curva NDVI de esas parcelas, las nubes la nubosidad semanal de las imágenes Planet y la lluvia la de
  CHIRPS por mes (promedio de la región del reto).
- Etapas: siembra (fines de mayo), emergencia, amacollamiento, encañe, espigamiento y floración (agosto), llenado
  (pico de verdor, fines de agosto–septiembre), madurez (septiembre–octubre) y cosecha (octubre–noviembre),
  aproximadas: el reto no trae fechas de siembra ni de cosecha, así que se reparten entre el inicio, el pico y el
  fin del verdor; quedan cerca de los días a floración y madurez que reporta el INIFAP.
- El botón de pausa/reproducir usa íconos SVG (no caracteres que algunos teléfonos muestran como emoji).
- `estilos.css` reescrito para la nueva estructura (siguen con prefijo `.crec-`).
