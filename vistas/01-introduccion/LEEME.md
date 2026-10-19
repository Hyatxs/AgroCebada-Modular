# Capítulo 1 · La cebada y su territorio

**Sección:** 01

**Entrada:** `index.html` (raíz) → `vistas/01-introduccion/index.html`

**Función:** storytelling de la cebada en cuatro partes, con un índice lateral que sigue el avance.

## Recorrido

| Parte | Secciones | Qué muestra |
| --- | --- | --- |
| Entrada | `#c1-telon`, portada | Telón verde como en los capítulos 2 y 3. Detrás del título, la Tierra gira despacio (`mapa-inicio.js`). |
| 1 · La cebada | `#origen`, `#espigas`, `#produccion` | El globo se detiene en el Creciente Fértil; qué es la cebada (2 y 6 hileras; aquí crece la planta 3D); producción en México mientras el globo viaja a México por España (siglo XVI). La historia del INIFAP queda en una línea. |
| 2 · Territorio | `#donde-estados`, `#donde-parcelas` | El globo se acerca a Hidalgo, Puebla y Tlaxcala (55 % del país, SIAP 2024) y muestra las 197 parcelas. Las condiciones ideales quedan en una línea: arriba de 1,800 m en el trópico y de 15 a 20 °C (FAO); en 2025 todas las parcelas tuvieron de 16 a 18 °C de media en su temporada. |
| 3 · Cómo crece | `#crecimiento` | Un campo pintado (`vistas/03-crecimiento/campo-cebada.js`) crece solo de la siembra a la cosecha, con tractor y cosechadora; su verdor, nubes y lluvia son los de 2025, y abajo corre la curva real del satélite. |
| 4 · 2025, un año atípico | `#temporada` | El mismo campo arriba (uno, que se divide en dos: 148 tempranas y 49 tardías) y la gráfica abajo, con un cursor de fecha que recorre los meses en cuatro pasos: el calendario, la lluvia, los dos arranques y el rendimiento. |
| Final | `#continuar` | Botón al capítulo 2. Es un enlace normal: la transición la hace el telón de entrada del capítulo 2 (antes había dos telones seguidos). |

Se quitaron la línea del tiempo de seis tarjetas (el origen y la llegada a México los cuenta el globo), la parte de
rendimiento y preguntas guía y la parte «Lo que los datos no dicen»: las preguntas guía, el error de cada modelo, la
prueba de permutación y por qué un modelo espacial se explican en el capítulo 2. También salió «¿Dónde crece mejor
la cebada?» (la sección de Lulú en `vistas/02-territorio/`): pedía muchos clics y repetía lo que ya muestra el globo;
su código sigue en esa carpeta.

## Archivos

| Archivo | Qué hace |
| --- | --- |
| `index.html` | Estructura y textos. |
| `estilos.css` | Estilos propios: telón, globo, índice y gráfica de 2025. |
| `home.js` | Mascota, planta (crece en «¿Qué es la cebada?») y telón de entrada. Después de la portada, la mascota vive en la esquina inferior derecha (en celular se asoma medio fuera de la pantalla) y su globo de diálogo busca un hueco sin texto: a su izquierda o arriba de ella; si no hay, espera escondido (`ubicarBurbuja`). En «Cómo crece» y «2025» la mascota se encoge para no tapar la animación. El globo se oculta solo a los 6.5 s. El código de la línea del tiempo sigue ahí, pero solo corre si la sección existe. |
| `mapa-inicio.js` | Globo ortográfico (d3-geo): gira, se detiene en el Creciente Fértil, viaja a México y se acerca a los tres estados. |
| `mapa-inicio-datos.js` | Contornos lon/lat y parcelas (generado; no editar a mano). |
| `temporada.js` | Parte 4: dos campos y la gráfica, fijos, que cambian con cada paso. |
| `temporada-datos.js` | Fenología por parcela, clima por parcela y por estado, lluvia mensual de la región (generado; no editar a mano). |
| `indice.js` | Índice de las cuatro partes: riel de puntos a la derecha, sin números (el nombre se asoma al pasar el ratón); en celular, una pastilla arriba. |
| `lib/d3-geo.min.js`, `lib/d3-array.min.js` | d3 3.x (licencia ISC, en `lib/LICENCIA-d3.txt`). |
| `herramientas/exportar_mapa_inicio.py` | Genera `mapa-inicio-datos.js` (Natural Earth vía datamaps y world-atlas). |
| `herramientas/exportar_temporada.py` | Genera `temporada-datos.js` desde `sat_features.parquet` y `climate_features.parquet` (cuadernos del equipo), los inventarios de clima del reto y `vistas/07-modelo/datos-modelo.js`. |

También usa `vistas/03-crecimiento/seccion-crecimiento.js`,
`vistas/03-crecimiento/campo-cebada.js` y `vistas/07-modelo/datos-modelo.js` (cifras oficiales del NB07).

## Notas

- Todo lo que se grafica es dato real: verdor semanal de Planet (`data.js`), fechas de inicio, pico y fin por parcela
  (NB03), clima de cada parcela (CHIRPS y CHIRTS-ERA5) y cifras del NB07. La lluvia mensual de la gráfica es el
  promedio de los tres estados del inventario del reto; las cifras «en las parcelas» son de cada parcela.
- No hay curvas semanales de 2022–2024. La comparación con esos años usa lo que sí tenemos: la lluvia y la
  temperatura de las mismas fechas y el pico y el centro de la temporada de cada parcela en 2022–2024 (Sentinel-2).
- Se quitó el laboratorio de factores (`factores.js`): simulaba la temperatura mínima y los grados-día, y tomaba
  «una parcela por estado» con un corte de 66 parcelas que no corresponde a los estados.
- Los contornos de Natural Earth están simplificados (1–5 km cerca de las fronteras); por eso el globo solo se
  acerca hasta el nivel de los estados.
- Con «Reducir movimiento» el globo no gira ni viaja: cada paso muestra su vista fija.
- Sin emojis: el botón del campo de «Cómo crece» y el engrane de la barra (en celular) son SVG.
- «Cómo crece» y «2025» caben en una pantalla de laptop (probado en 1280×720, 1366×768, 1440×900 y 1536×760): el
  campo se ajusta a la altura disponible y la gráfica de 2025 se angosta si la pantalla es baja.
- Cada cifra del capítulo se revisó contra los datos del reto, los cuadernos del equipo y las fuentes de
  `referencias.html` (19 oct 2026).

**Regla:** trabaja aquí en tu rama. No modifiques archivos compartidos (`common.js`, `styles.css`, `data.js`, `config.js`, `conexion-api.js`, `backend/`) sin coordinarlo.
