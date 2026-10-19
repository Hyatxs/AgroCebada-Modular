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
