# Territorio y mapas

**Sección:** 02

**Entrada:** `mapa.html`

**Función:** Mapa 3D aprobado; las parcelas y su interacción siguen aquí.

**Regla:** trabaja aquí en tu rama. No modifiques archivos compartidos (`common.js`, `styles.css`, `data.js`, `config.js`, `conexion-api.js`, `backend/`) sin coordinarlo.


## Sección «Territorio» en la vista principal

- `seccion-territorio.js`: selector de estado (botones o mapa SVG) y explicación de cómo la
  geografía de Puebla, Tlaxcala e Hidalgo ayuda o complica a la cebada, más las condiciones
  ideales del cultivo. Usa `DATA` y `ESTADOS_MEXICO` (solo lectura).
- Estilos al final de `estilos.css`, todos con prefijo `.terr-`.
- Se monta en `vistas/01-introduccion/index.html` dentro de `<div id="territorio-demo">`.
- Pendiente: verificar con SIAP/INIFAP las regiones cebaderas de Puebla y Tlaxcala
  (marcadas con «verificar» en el código).
- `siluetas-estados.js`: contornos reales de los tres estados (trazados de siluetas y colocados
  en sus coordenadas del INEGI). Si consiguen el GeoJSON oficial, solo reemplacen estos arreglos.
