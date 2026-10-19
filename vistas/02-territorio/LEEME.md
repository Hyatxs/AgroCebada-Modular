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

### Ajustes al integrarla al capítulo 1 (18 oct)

- Las cifras «En el reto» por estado salen de `MODELO_HGP` (estado de cada parcela). Antes se tomaban bloques
  de 66 parcelas de `data.js`, que va ordenado por clave y no por estado: mostraba unas 66 parcelas y ~3.9 t/ha
  para los tres. Real: Puebla 100 parcelas y 4.48 t/ha, Hidalgo 51 y 3.76, Tlaxcala 46 y 2.98.
- Cada factor muestra además «Medido en sus parcelas» (altura INEGI, lluvia CHIRPS y temperatura CHIRTS-ERA5 de
  2025), desde `TEMPORADA.por_estado` (`vistas/01-introduccion/temporada-datos.js`).
- Participaciones de 2024 (SIAP) en lugar de 2011: Hidalgo 24 %, Puebla 16 %, Tlaxcala 16 %. Se quitaron los
  «(verificar)» y se nombran los municipios donde están las parcelas del reto.
- «Lo ideal» con fuente: arriba de 1,800 m en el trópico y 15–20 °C óptimo (FAO Ecocrop). El artículo de
  Gómez-Espinoza (2025) habla de 30 °C para la proteína del grano, no para el tamaño: así quedó el texto.
- Colores de los estados iguales al resto del capítulo: Puebla oro, Tlaxcala rosa, Hidalgo verde.

### Revisión del 19 oct

- **La sección ya no se usa en el capítulo 1** (se quitó por decisión del equipo: pedía muchos clics y repetía lo
  que muestra el globo). El código queda aquí, ya corregido, por si se quiere usar en otra página.

- Sin emojis: los íconos de altura, lluvia, temperatura y heladas (en los botones y sobre el mapa) son SVG de
  línea; «Consejo» y «Ver los tres» quedaron como texto.
- Hidalgo, según Gómez Mercado et al. (2009): los ensayos del INIFAP fueron entre 2,355 y 2,730 m, con media de
  12.2 a 15.5 °C en el ciclo, y en Almoloya el grano maduró del 20 al 27 de octubre. Singuilucan no está entre los
  municipios de los Llanos de Apan, así que el texto ya no dice que todas las parcelas de Hidalgo estén ahí.
- La mínima «en el tramo final de la temporada» es la ventana del NB04 que va del llenado del grano al fin del
  verdor (antes decía «del pico a la cosecha»).
