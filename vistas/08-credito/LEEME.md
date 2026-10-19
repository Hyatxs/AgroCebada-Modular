# Capítulo 3 · Del rendimiento al crédito

**Entrada:** `vistas/08-credito/index.html` (también `credito.html` en la raíz, que redirige aquí, y el
botón «Crédito» de la barra).

Página de scroll que lee el modelo del capítulo 2 como lo leería un banco. No necesita backend: usa
`vistas/07-modelo/datos-modelo.js` (las mismas predicciones, P20 y niveles de riesgo del NB07).

## Secciones

| Sección | Qué muestra |
| --- | --- |
| Historia (`#c3-historia`) | Las 59 parcelas por predecir, con su forma real, fijas a la derecha. Cambian de acomodo con el scroll: mapa inclinado (con las 138 conocidas de contexto) → lo que le importa a FIRA → ¿llega a tiempo la predicción? (el modelo solo usa la ubicación) → P20 contra predicción → punto de equilibrio con intereses → el riesgo del precio (la línea sube con $4,500 y las que no alcanzan se vuelven rosas) → semáforo de riesgo → riesgo por municipio y alcance del modelo. Tocar una parcela la abre en el simulador. |
| Simulador (`#c3-simulador`) | Una parcela, el precio de la cebada, el costo de producción y la tasa del crédito. Contesta las tres preguntas: cuánto produce, qué tan seguro es (P20) y si alcanza para pagar (cobertura del crédito). Sello de riesgo, regla con el punto de equilibrio e «idea de uso». |
| La cartera (`#c3-cartera`) | Cifras de las 59, cuántas parcelas pagan su crédito según el precio, superficie por nivel de riesgo, tabla ordenable y filtrable, y descarga en CSV. Todo sigue al precio, costo y tasa del simulador. |
| Recorrido (`#c3-recorrido`) | Resumen de los tres capítulos y botones de regreso. |

## Archivos

| Archivo | Qué hace |
| --- | --- |
| `index.html` | Estructura y textos. Las cifras con `data-c3="…"` (supuestos de referencia) y `data-vivo="…"` (siguen al simulador) las llena `capitulo3.js`. |
| `capitulo3.css` | Estilos del capítulo (todo bajo `body.c3` o con prefijo `c3-`). |
| `capitulo3.js` | Escenario de la historia, simulador, cartera, mascota, índice y progreso. |

Compartidos que se tocaron: `vistas/compartido/common.js` (enlace «Crédito» en la barra) y
`vistas/compartido/diccionario.js` (términos: punto de equilibrio, cobertura del crédito, crédito de avío,
FIRA, garantía, inclusión financiera).

## Supuestos y fuentes

- **Costo de producción:** $15,755 por hectárea (FIRA, cebada de Hidalgo, primavera-verano 2025; citado en
  *Research, Society and Development*, 2026; Hernández Espinosa et al.). Se usa también para las parcelas de Puebla y Tlaxcala. Editable.
- **Precio de la cebada:** $7,500 por tonelada, pactado en 2025 entre productores de Hidalgo y Grupo
  Modelo (La Jornada, 4 may 2025). Referencias: $8,252 (2023) y $4,500 (lo que, según los productores, quería pagar Modelo en 2025),
  $7,000 (2026, La Silla Rota), $6,077 (promedio nacional 2024, SIAP). Editable.
- **Tasa del crédito:** 8.5 % anual, la tasa preferencial de Cosechando Soberanía para el ciclo 2026-2027
  (Luz Noticias, 14 oct 2026). Referencia alta: 17.5 %, la tasa máxima en créditos de 10 meses según la
  residencia de FIRA en Sinaloa (Los Noticieristas, sep 2026). Editable. Las fuentes del programa mencionan
  maíz, frijol, arroz, trigo, café, leche y pesca; no encontramos que incluya la cebada, así que las dos
  tasas son referencias, no reglas para este cultivo.
- **Plazo y monto:** 10 meses, financiando todo el costo de producción (supuesto prudente; FIRA financia de
  80 a 90 % a pequeños productores, según BBVA). Interés simple.

## Reglas de cálculo

- P20 = predicción + q20 × desviación (q20 = −0.8049).
- Lo que se debe por hectárea = costo × (1 + tasa × plazo / 12). Con la referencia: $16,871.
- Punto de equilibrio = lo que se debe por hectárea ÷ precio. Con la referencia: 2.25 t/ha; con $4,500: 3.75 t/ha.
- Cobertura del crédito = (P20 × hectáreas × precio) ÷ (lo que se debe por hectárea × hectáreas).
  Con la referencia, las 59 quedan entre 1.07 y 1.98 veces.
- Con la referencia, pagan su crédito con su P20: 59 de 59 con $7,500; 40 con $6,077; 35 con $4,500.
  Con 17.5 %: 58, 37 y 30.
- El nivel de riesgo es el del modelo (tercios de la caída relativa del P20).

## Lo que la página dice de sus límites

- **Qué mide el P20.** El error del modelo en un ciclo (2025), validado con las parcelas conocidas: 8 de
  cada 10 alcanzaron o superaron su P20. No mide la variación de un año a otro (sequía, helada).

- **Cuándo existe la predicción.** El modelo final solo usa la ubicación (municipio y vecinas conocidas), así
  que puede estimar antes de sembrar si el patrón por zona se repite de un año a otro. Con un solo ciclo de
  rendimientos todavía no se puede comprobar.
- **Hasta dónde llega.** Las 59 están, en mediana, a 349 m de una parcela conocida. En zonas sin vecinas
  conocidas el error sube a ±0.66 t/ha (validación espacial).
- Las «ideas de uso» del simulador son una propuesta del equipo para mostrar el uso del modelo: no son
  reglas de FIRA ni una aprobación de crédito. La página lo dice junto a la ficha.

## Probar

Desde la raíz del proyecto: `python -m http.server 5500` y abre
`http://localhost:5500/vistas/08-credito/index.html`.
