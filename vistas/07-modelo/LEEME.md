# Capítulo 2 · El modelo

**Entrada:** `vistas/07-modelo/index.html` (también `modelo.html`, que redirige aquí).

Página de scroll con el modelo final del equipo, el **GP jerárquico** del NB07. El modelo se
calcula en el navegador y no necesita backend.

## Secciones

| Sección | Qué muestra |
| --- | --- |
| Las pistas (`#c2-historia`) | **Escena 3D a pantalla completa** que se queda fija mientras el texto pasa a la izquierda. Con el scroll la cámara se acerca a la maqueta: de lejos (portada) → las 59 por descubrir → pista 1, el municipio (vista alta con etiquetas) → pista 2, las vecinas (a ras de una parcela) → las dos pistas juntas (arcos verdes y rosas). |
| Simulador (`#c2-simulador`) | La misma escena, ahora con el control: controles a la izquierda, ficha a la derecha y el mapa en medio. Se toca una parcela (o se escribe su clave) y el modelo se ejecuta paso a paso: punto de partida, municipio, vecinas y rango. El modo prueba esconde el rendimiento de una parcela conocida. «Predecir las 59» corre el modelo completo y lo compara con lo entregado. |
| Diez modelos (`#c2-modelos`) | Error de los 10 modelos del NB07. Se alterna entre las particiones del reto y las zonas nuevas (bloques espaciales). |
| Resultados (`#c2-resultados`) | RMSE, cobertura y R², la gráfica de predicho contra real (138 parcelas fuera de muestra) y las 59 predicciones con su rango y nivel de riesgo. |
| Preguntas guía (`#c2-preguntas`) | Q1 (índice), Q2 (clima) y Q3 (combinación), más el aviso de la prueba de permutación. |

## Archivos

| Archivo | Qué hace |
| --- | --- |
| `index.html` | Estructura y textos del capítulo. |
| `capitulo2.css` | Estilos del capítulo. Todo va bajo `body.c2` o con prefijo `c2-`. **No** se usa `estilos.css`, porque el mapa (02-territorio) también lo carga. |
| `datos-modelo.js` | **Fuente única de cifras.** Se genera a partir de las salidas oficiales del NB07; no se edita a mano. |
| `motor-hgp.js` | El GP jerárquico en JavaScript, sin dependencias. Reproduce las 59 predicciones entregadas con diferencias ≤ 0.0002 t/ha y los mismos niveles de riesgo. |
| `escena-3d.js` | **Maqueta 3D a pantalla completa** con el estilo del esqueleto (losetas con surcos, rayado en las por predecir, tallos que se mecen). Relieve según la elevación INEGI de cada parcela (suavizado y exagerado ×2), bordes de tierra y sombra. Cámara con guion (`camaraHacia`, `encuadreGeneral`, `encuadreParcela`): el texto ocupa un lado y la maqueta se encuadra en la zona libre con un corrimiento de lente. Baja la calidad sola si el equipo dibuja lento. |
| `mapa-parcelas.js` | Mapa SVG plano de respaldo: se usa si three.js no carga o no hay WebGL (misma interfaz). |
| `graficas-c2.js` | Gráficas SVG sin librerías: carrera de modelos, dispersión, oruga, curva de parecido y barras. |
| `simulador.js` | Lógica y animación del simulador. |
| `capitulo2.js` | Orquesta la página: telón, pasos del scroll y **guion de cámara** (cada paso tiene un encuadre; entre pasos se interpola según el scroll), mascota, índice, progreso y cifras en el texto (`data-cifra`). |
| `herramientas/` | `exportar_datos_modelo.py` regenera `datos-modelo.js`; `compactar_mapa.py` arma el mapa esquemático; `verificar_motor.js` comprueba el motor contra lo entregado. |
| `api-predicciones.js`, `panel-predicciones.js`, `estilos.css` | Los usa el **mapa** (02-territorio). No forman parte de este capítulo. |

Compartidos nuevos: `vistas/compartido/diccionario.js` y `diccionario.css` agregan el botón
**Diccionario** a la barra superior y vuelven clicables los términos con `data-termino="id"`.
Para usarlo en otra página, incluye los dos archivos después de `common.js`.

## El mapa esquemático (léase antes de presentar)

Las 197 parcelas están repartidas en más de 100 km; a escala real cada una sería un punto. Para verlas
juntas, `compactar_mapa.py` las acomoda en una maqueta de unos 6 × 8 km:

1. Agrupa las parcelas a menos de 1 km entre sí. Toda vecina que influye en una predicción queda en el
   mismo grupo que su parcela.
2. Dentro de cada grupo acerca las parcelas al centro (factor 0.45) sin encimarlas (30 m entre polígonos).
3. Acomoda los grupos cerca de su posición real encogida (factor 0.07), con 150 m entre ellos. Se conserva
   la geografía general: los municipios quedan juntos y en su lugar relativo.

Forma y tamaño de cada polígono son reales; las distancias en pantalla no. Por eso la escena no dibuja
anillos de distancia: las etiquetas de los arcos dicen la **distancia real**, y el modelo calcula siempre
con las coordenadas reales. La nota al pie del mapa lo dice en la página.

## Regenerar los datos (si cambia el modelo)

```
cd vistas/07-modelo/herramientas
python exportar_datos_modelo.py CARPETA_RETO CARPETA_NB07 ../datos-modelo.js
node verificar_motor.js ../datos-modelo.js ../motor-hgp.js
```

- `CARPETA_RETO`: los archivos del reto (shapefile, `DataSet_Maestro_AgroCebada.csv`, `ID_area_rendimiento…csv`).
- `CARPETA_NB07`: la carpeta del proyecto en Drive, que contiene `outputs/` y `qa/`.
- Solo necesita `numpy` y `pandas`.

## Cómo funciona el modelo (resumen)

rendimiento = promedio de las 138 parcelas conocidas + efecto del municipio + ajuste de las vecinas + ruido

- **Municipio:** efecto aleatorio, varianza 0.542.
- **Vecinas:** Matérn 3/2 con alcance de 0.300 km y varianza 0.189. El parecido baja a la mitad a 290 m y a 5 % a 820 m.
- **Ruido:** varianza 0.063.
- **Rango:** cuantiles conformales del NB07 (P10 −1.152, P20 −0.805, P90 1.128 desviaciones).
- **Riesgo:** tercios de la caída relativa `(predicción − P20) / predicción`.

## Probar

Desde la raíz del proyecto: `python -m http.server 5500` y abre
`http://localhost:5500/vistas/07-modelo/index.html`. Se necesita internet para las fuentes y para
three.js (la mascota). Sin internet la página funciona igual, sin la mascota.
