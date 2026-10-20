# Agro-verse · FIRA 2026 (Reto AgroCebada)

Experiencia web en tres capítulos que cuenta la historia de la cebada y predice el rendimiento de las
197 parcelas del reto en Puebla, Tlaxcala e Hidalgo (138 con rendimiento conocido y 59 por predecir).

Es HTML, CSS y JavaScript sin compilar. Todo se calcula en el navegador: **no necesita backend**.
Three.js r128 (la mascota) se carga desde cdnjs y las fuentes desde Google Fonts. Sin internet las
páginas funcionan, pero sin la mascota y con otra tipografía.

Proyecto del Equipo Representativo STEM · UDLAP.

## El reto

FIRA entregó 197 parcelas de cebada del ciclo 2025: 138 con su rendimiento real (t/ha) y 59 sin él,
junto con su polígono y sus índices de satélite. Hay que **predecir el rendimiento de las 59** y
explicar cómo se llegó a la predicción. Este sitio cuenta ese proceso para un público general y muestra
cómo podría usarse la predicción para dar crédito agrícola.

**En línea:** [completar con el enlace donde se publique]

## Cómo abrirlo

Desde la raíz del proyecto:

```
python -m http.server 5500
```

y abre `http://localhost:5500/`. No lo abras con doble clic (`file://`): las páginas usan
`<base href>` y rutas relativas que necesitan un servidor.

**Requisitos:** Python 3 (solo para servir la carpeta) y un navegador actual con WebGL (Chrome, Edge,
Firefox o Safari). Si el equipo no tiene WebGL, el capítulo 2 muestra un mapa plano en lugar de la
maqueta 3D.

## Páginas

| Capítulo | Página | Qué cuenta |
| --- | --- | --- |
| 1 · La cebada y su territorio | `vistas/01-introduccion/index.html` (`index.html`) | Origen de la cebada con un globo que viaja del Creciente Fértil a México; qué es la cebada (2 y 6 hileras); producción en México; dónde están las parcelas del reto; cómo crece, de la siembra a la cosecha; y 2025, un año atípico (siembras tempranas y tardías). |
| 2 · El modelo | `vistas/07-modelo/index.html` (`modelo.html`) | Las dos pistas del modelo (municipio y parcelas vecinas) en una maqueta 3D, un simulador que predice parcela por parcela, la comparación de 10 modelos, los resultados y las preguntas guía. |
| 3 · Del rendimiento al crédito | `vistas/08-credito/index.html` (`credito.html`) | Cómo leería un banco las predicciones: P20, punto de equilibrio, cobertura del crédito y riesgo; simulador con precio, costo y tasa; y la cartera de las 59 parcelas, descargable en CSV. |
| Referencias | `vistas/06-interpretacion/referencias.html` (`referencias.html`) | Única bibliografía del sitio: fuentes numeradas y agrupadas por tema. Los capítulos las citan con números pequeños que abren la fuente. |

Los archivos `.html` de la raíz solo redirigen a la página de su carpeta. Para cambiar una página,
edita la de `vistas/`.

**Barra superior (en todas):** Introducción, Modelo, Crédito, **Diccionario** (glosario de términos;
las palabras marcadas en el texto se pueden tocar) y **Preferencias**: Referencias, tema
(automático / claro / oscuro), daltonismo (protanopia, deuteranopia, tritanopia) y «Reducir movimiento».

## El modelo

El modelo final es un **GP jerárquico** (NB07):

```
rendimiento = promedio de las 138 conocidas + efecto del municipio + ajuste de las vecinas + ruido
```

- Se calcula en el navegador con `vistas/07-modelo/motor-hgp.js` y reproduce las 59 predicciones
  entregadas (diferencias ≤ 0.0002 t/ha).
- Validación (10 repeticiones × 5 particiones): **RMSE 0.50 t/ha, R² 0.65**; el rendimiento varía
  ±0.85 t/ha entre parcelas. El rango P10–P90 contuvo el valor real en 8 de cada 10 parcelas.
- En zonas sin vecinas conocidas (validación espacial) el error sube a ±0.66 t/ha.
- Todas las cifras salen de `vistas/07-modelo/datos-modelo.js`, generado a partir de las salidas
  oficiales del NB07. No se edita a mano.

Detalle completo en `vistas/07-modelo/LEEME.md`.

## Datos

- **Del reto:** 197 polígonos, áreas, rendimientos de entrenamiento e índices de satélite de 2025
  (NDVI, EVI y LAI de Planet; FAPAR y DSWI de Sentinel-2).
- **Clima:** lluvia CHIRPS y temperatura CHIRTS-ERA5 por parcela; altitud INEGI.
- **Fenología:** fechas de inicio, pico y fin del verdor por parcela (NB03).
- **Mapas:** contornos de Natural Earth (simplificados).
- **Aproximado:** las etapas del cultivo (siembra, floración, cosecha) se reparten entre el inicio, el
  pico y el fin del verdor, porque el reto no trae fechas de siembra ni de cosecha. En el capítulo 2 las
  parcelas se acomodan en una maqueta compacta: su forma es real, pero las distancias en pantalla no
  (el modelo usa siempre las coordenadas reales).

Las cifras de contexto (producción, precios, costos, tasas) y su fuente están en `referencias.html`.

## Estructura

```
index.html  modelo.html  credito.html  referencias.html    redirecciones a vistas/
vistas/
  01-introduccion/   capítulo 1: globo (d3-geo), índice, 2025 atípico
  03-crecimiento/    campo pintado que crece (lo usa el capítulo 1)
  02-territorio/     sección «¿Dónde crece mejor la cebada?» (hoy fuera del capítulo 1)
  06-interpretacion/ referencias
  07-modelo/         capítulo 2: motor del modelo, escena 3D, simulador, gráficas
  08-credito/        capítulo 3: crédito, simulador y cartera
  compartido/        estilos, utilidades, mascota, diccionario, datos (data.js)
backend/             API de FastAPI de la versión anterior (las páginas actuales no la usan)
```

Cada carpeta de `vistas/` tiene un `LEEME.md` con sus archivos, decisiones y cómo regenerar sus datos.

## Regenerar los datos

- Capítulo 2 y 3 (modelo): ver `vistas/07-modelo/LEEME.md` (`exportar_datos_modelo.py` y `verificar_motor.js`).
- Capítulo 1 (globo y 2025): `vistas/01-introduccion/herramientas/` (`exportar_mapa_inicio.py`, `exportar_temporada.py`).
- Requieren `numpy` y `pandas`.

## Trabajo en equipo
 
- Una rama por cambio (`git switch -c nombre-del-cambio`) y pull request a `main`. No se hace push
  directo a `main`.
- Cada quien trabaja en su carpeta de `vistas/`. Los archivos de `vistas/compartido/` los usan todas
  las páginas: avisa al equipo antes de cambiarlos.
- No subir `.venv`, `__pycache__`, `.env` ni respaldos.

## Accesibilidad

- Temas claro, oscuro y automático; tres modos de daltonismo.
- «Reducir movimiento» detiene giros y animaciones (también respeta la preferencia del sistema).
- Enlace «Saltar al contenido» y foco visible.
- Las preferencias se guardan en el navegador.

## Repositorios relacionados

El proyecto vive en dos repositorios. Los dos están enlazados al final del capítulo 2 de la página
(sección «¿Quieres ver cómo lo hicimos?»).

- **Página web (este repositorio):** [github.com/Hyatxs/AgroCebada-Modular](https://github.com/Hyatxs/AgroCebada-Modular)
- **Modelo predictivo:** [github.com/Valoo-1201/AgroCebada-Modelo](https://github.com/Valoo-1201/AgroCebada-Modelo).
  Contiene los notebooks de donde salen las cifras del sitio (NB03 fenología, NB04 clima, NB07 modelo final).

## Créditos y licencias

- **Datos del reto:** proporcionados por FIRA para el Reto AgroCebada 2026; se usan solo para este proyecto.
- **Imágenes de satélite:** Planet y Sentinel-2 (Copernicus, ESA).
- **Clima:** CHIRPS y CHIRTS-ERA5. **Altitud:** INEGI.
- **Contornos:** Natural Earth (dominio público).
- **Bibliotecas:** Three.js r128 (licencia MIT) y d3-geo / d3-array (licencia ISC, en
  `vistas/01-introduccion/lib/LICENCIA-d3.txt`).

## Equipo

Equipo Representativo STEM · UDLAP · Lourdes María García Garfias | María Valentina García Hernández | Dana Paola Sánchez Alonso | Dulce Grecia Pérez Capilla | Lizeth Bonilla Díaz 