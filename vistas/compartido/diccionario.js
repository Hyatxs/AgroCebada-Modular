"use strict";

/*
 * Diccionario de variables en el menú superior (panel lateral con buscador).
 * Se carga después de common.js: agrega el botón «Diccionario» a la barra y
 * convierte en enlaces todos los elementos con data-termino="id".
 *
 * Para usarlo en otra página basta con:
 *   <link rel="stylesheet" href="vistas/compartido/diccionario.css" />
 *   <script src="vistas/compartido/diccionario.js"></script>   (después de common.js)
 */

const Diccionario = (() => {
  const CATEGORIAS = [
    ["rend", "Rendimiento y parcelas"],
    ["modelo", "El modelo"],
    ["metrica", "Qué tan bien predice"],
    ["credito", "Crédito y riesgo"],
    ["satelite", "Satélite"],
    ["clima", "Clima"],
    ["suelo", "Suelo y terreno"],
    ["ciclo", "Ciclo del cultivo"],
  ];

  // [id, categoría, término, definición, en este proyecto]
  const TERMINOS = [
    ["rendimiento", "rend", "Rendimiento (t/ha)", "Toneladas de grano cosechadas por cada hectárea sembrada.", "Es lo que el modelo predice. En las 138 parcelas conocidas va de 2.0 a 5.6 t/ha (ciclo 2025)."],
    ["hectarea", "rend", "Hectárea (ha)", "Diez mil metros cuadrados: un cuadrado de 100 × 100 m.", "La parcela típica del reto mide 5.5 ha."],
    ["parcela", "rend", "Parcela", "Terreno agrícola con límites propios.", "Cada una trae su polígono real (shapefile del reto) y una clave de AGC_001 a AGC_197."],
    ["entrenamiento", "rend", "Parcelas conocidas y por predecir", "Las 138 parcelas con rendimiento conocido enseñan al modelo; las 59 restantes son las que hay que estimar.", "Están intercaladas: la mitad de las parcelas por predecir está a menos de 350 m de una conocida."],
    ["gp", "modelo", "GP jerárquico (proceso gaussiano)", "Modelo que estima el rendimiento de una parcela con el nivel de su municipio y lo que rindieron sus vecinas, pesadas por distancia. Además dice qué tan seguro está.", "Es el modelo final: tuvo el menor error de los diez que probamos."],
    ["efecto-municipio", "modelo", "Efecto del municipio", "Cuánto sube o baja el rendimiento típico de un municipio respecto al promedio de todas las parcelas conocidas.", "El municipio solo ya explica el 64 % de las diferencias entre parcelas."],
    ["efecto-vecinos", "modelo", "Ajuste de las vecinas", "Corrección que aportan las parcelas cercanas: si rindieron más que su municipio, la predicción sube.", "Solo pesan las vecinas a menos de ~1 km."],
    ["alcance", "modelo", "Alcance espacial", "Distancia a la que dos parcelas dejan de parecerse.", "El modelo lo aprendió de los datos: a 290 m el parecido baja a la mitad y hacia 820 m casi desaparece."],
    ["matern", "modelo", "Función de Matérn 3/2", "Regla que convierte la distancia entre dos parcelas en qué tanto se parecen sus rendimientos.", "Define la curva de parecido de las vecinas."],
    ["linea-base", "modelo", "Línea base", "La predicción más simple posible. Todo modelo debe superarla para valer la pena.", "Aquí es el rendimiento medio del municipio: error de 0.509 t/ha."],
    ["validacion-cruzada", "metrica", "Validación cruzada", "Se esconde una parte de las parcelas conocidas, se predicen y se compara con su valor real. Se repite muchas veces.", "5 particiones × 10 repeticiones = 50 pruebas, iguales para todos los modelos."],
    ["rmse", "metrica", "RMSE (error típico)", "Raíz del error cuadrático medio, en t/ha. Castiga más los errores grandes. Menos es mejor.", "Modelo final: 0.503 t/ha. Es la métrica principal del reto."],
    ["mae", "metrica", "MAE (error absoluto medio)", "Por cuánto se equivoca en promedio la predicción, hacia arriba o hacia abajo.", "Modelo final: 0.347 t/ha."],
    ["r2", "metrica", "R² (coeficiente de determinación)", "Qué parte de las diferencias de rendimiento entre parcelas explica el modelo. 1 es perfecto; 0, no explicar nada.", "Modelo final: 0.649."],
    ["intervalo", "credito", "Rango P10–P90", "Rango donde esperamos el rendimiento real 8 de cada 10 veces.", "En la validación cubrió al 79.1 % de las parcelas (objetivo: 80 %)."],
    ["p20", "credito", "P20 · rendimiento financiable", "Rendimiento que la parcela alcanza o supera con 80 % de confianza.", "Es la cifra prudente para dimensionar un crédito."],
    ["riesgo", "credito", "Nivel de riesgo", "Bajo, medio o alto según cuánto podría caer el rendimiento por debajo de lo esperado.", "Se mide con la caída relativa del P20 frente a la predicción y se divide en tercios."],
    ["conformal", "credito", "Calibración conformal", "Ajuste del ancho del rango con los errores observados, para que cubra lo que promete.", ""],
    ["equilibrio", "credito", "Punto de equilibrio", "Rendimiento con el que la venta de la cosecha apenas paga el costo de producción: costo por hectárea ÷ precio por tonelada.", "Con $15,755/ha (FIRA, 2025) y $7,500/t (precio pactado en 2025) es de 2.1 t/ha."],
    ["cobertura", "credito", "Cobertura del costo", "Cuántas veces el valor de la cosecha en un mal año (con su P20) paga lo que cuesta producirla. 1.0 quiere decir que apenas alcanza.", "Con los supuestos de 2025, las 59 parcelas quedan entre 1.15 y 2.1 veces."],
    ["credito-avio", "credito", "Crédito de avío", "Crédito de corto plazo para los gastos de un ciclo de cultivo (semilla, fertilizante, labores), que se paga con la cosecha.", ""],
    ["fira", "credito", "FIRA", "Fideicomisos Instituidos en Relación con la Agricultura: cuatro fondos del Gobierno Federal que dan crédito, descuento y garantías al campo a través de bancos y otros intermediarios.", "Convoca el Reto AgroCebada 2026."],
    ["garantia", "credito", "Garantía de crédito", "Respaldo que cubre al banco una parte de la pérdida si un crédito no se paga. Anima a prestar a quien no tiene historial.", "En FIRA las otorga el FEGA."],
    ["inclusion-financiera", "credito", "Inclusión financiera", "Que las personas y las empresas tengan acceso a crédito, ahorro y seguros formales, y los usen.", "Es el objetivo de las reglas de operación de FIRA que cita el reto."],
    ["agricultura-contrato", "credito", "Agricultura por contrato", "Acuerdo entre productor y comprador, antes de vender, sobre cantidad, calidad y precio.", "En 2025, productores de Hidalgo y Grupo Modelo pactaron $7,500 por tonelada."],
    ["malteria", "rend", "Malta y maltería", "La malta es cebada remojada, germinada y secada; es la base de la cerveza. La maltería es la planta donde se hace.", "La cebada maltera del Altiplano se vende a las cerveceras, que la maltean."],
    ["planet", "satelite", "Planet", "Constelación de satélites pequeños con imágenes casi diarias de alta resolución (unos 3 m).", "Aporta NDVI, EVI, LAI y MSAVI de 2025 (datos PRO del reto)."],
    ["sentinel2", "satelite", "Sentinel-2", "Satélites de la Agencia Espacial Europea con imágenes de 10 a 20 m cada pocos días.", "Aporta 22 índices de 2022 a 2025 (datos básicos del reto)."],
    ["landsat", "satelite", "Landsat", "Satélites de la NASA y el USGS con imágenes de 30 m y una banda térmica.", "Aporta el índice VI6T."],
    ["ndvi", "satelite", "NDVI", "Índice de verdor: compara la luz roja y la infrarroja cercana que refleja la planta. Más alto, más vegetación activa.", "Con él detectamos el inicio, el pico y el fin de la temporada de cada parcela."],
    ["msavi", "satelite", "MSAVI", "Índice de vegetación que corrige el brillo del suelo desnudo; útil cuando el cultivo aún no cubre el terreno.", "Fue el índice con más capacidad predictiva por sí solo (pregunta guía 1)."],
    ["savi", "satelite", "SAVI", "Índice de vegetación ajustado al brillo del suelo.", "Segundo lugar en la pregunta guía 1."],
    ["evi", "satelite", "EVI", "Índice de vigor que reduce efectos de la atmósfera y del suelo; se satura menos que el NDVI en cultivos densos.", "Tercer lugar en la pregunta guía 1."],
    ["lai", "satelite", "LAI (índice de área foliar)", "Metros cuadrados de hoja por cada metro cuadrado de terreno.", ""],
    ["nubosidad", "satelite", "Nubosidad", "Porcentaje de nube en una imagen. Con nube, el índice de esa fecha es poco confiable.", "Filtramos imágenes nubladas antes de suavizar las series."],
    ["amplitud", "clima", "Amplitud térmica", "Diferencia entre la temperatura máxima y la mínima: días calientes con noches frías dan amplitud alta.", "Fue la variable climática con más peso (pregunta guía 2)."],
    ["tmax", "clima", "Temperatura máxima", "Promedio mensual de la temperatura más alta de cada día (CHIRTS-ERA5, ~5 km).", ""],
    ["pet", "clima", "Evapotranspiración potencial", "Agua que el cultivo perdería por evaporación y transpiración si tuviera agua de sobra.", "Calculada con el método de Hargreaves (FAO-56)."],
    ["precipitacion", "clima", "Precipitación acumulada", "Lluvia total en un periodo (CHIRPS, ~5 km).", "Mayo y junio de 2025 fueron mucho más lluviosos que en 2022–2024."],
    ["suelo-agua", "suelo", "Agua disponible del suelo", "Agua que el suelo guarda y la planta puede aprovechar.", "Estimada con SoilGrids 2.0 y las ecuaciones de Saxton y Rawls (2006)."],
    ["elevacion", "suelo", "Elevación", "Altura sobre el nivel del mar (INEGI, Continuo de Elevaciones Mexicano).", "Las parcelas están entre unos 2,500 y 2,900 m."],
    ["pendiente", "suelo", "Pendiente", "Inclinación del terreno, en grados.", ""],
    ["temporada", "ciclo", "Inicio, pico y fin de temporada", "Fechas en que el verdor de la parcela empieza a subir, llega a su máximo y vuelve al nivel del suelo.", "En 2025 la temporada real fue de junio a noviembre."],
  ];

  const porId = new Map(TERMINOS.map((t) => [t[0], t]));
  let panel, campo, lista, boton, ultimoFoco = null;
  let categoria = null;

  function construir() {
    panel = document.createElement("aside");
    panel.id = "dic-panel";
    panel.className = "dic-panel";
    panel.setAttribute("aria-label", "Diccionario de variables");
    panel.hidden = true;
    panel.innerHTML = `
      <header class="dic-cabeza">
        <h2>Diccionario</h2>
        <button type="button" class="dic-cerrar" aria-label="Cerrar el diccionario">✕</button>
      </header>
      <label class="sr-only" for="dic-buscar">Buscar un término</label>
      <input id="dic-buscar" class="dic-buscar" type="search" placeholder="Buscar: RMSE, MSAVI, P20…" autocomplete="off" />
      <div class="dic-filtros" role="group" aria-label="Filtrar por tema">
        <button type="button" data-cat="" aria-pressed="true">Todo</button>
        ${CATEGORIAS.map(([id, nombre]) => `<button type="button" data-cat="${id}" aria-pressed="false">${nombre}</button>`).join("")}
      </div>
      <dl class="dic-lista">
        ${TERMINOS.map(([id, cat, termino, corto, aqui]) => `
          <div class="dic-entrada" id="dic-${id}" data-cat="${cat}">
            <dt>${termino}</dt>
            <dd>${corto}${aqui ? `<span class="dic-aqui">${aqui}</span>` : ""}</dd>
          </div>`).join("")}
      </dl>
      <p class="dic-vacio" hidden>No hay términos con esa búsqueda.</p>`;
    document.body.appendChild(panel);

    campo = panel.querySelector(".dic-buscar");
    lista = panel.querySelector(".dic-lista");
    panel.querySelector(".dic-cerrar").addEventListener("click", cerrar);
    campo.addEventListener("input", filtrar);
    panel.querySelectorAll(".dic-filtros button").forEach((b) =>
      b.addEventListener("click", () => {
        categoria = b.dataset.cat || null;
        panel.querySelectorAll(".dic-filtros button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        filtrar();
      })
    );
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !panel.hidden) cerrar();
    });
    // Clic fuera del panel lo cierra (salvo en el botón o en un término)
    document.addEventListener("pointerdown", (e) => {
      if (panel.hidden || panel.contains(e.target)) return;
      if (e.target.closest("#dic-btn, [data-termino]")) return;
      cerrar();
    });
  }

  function filtrar() {
    const texto = campo.value.trim().toLowerCase();
    let visibles = 0;
    panel.querySelectorAll(".dic-entrada").forEach((entrada) => {
      const coincide = (!categoria || entrada.dataset.cat === categoria) && entrada.textContent.toLowerCase().includes(texto);
      entrada.hidden = !coincide;
      if (coincide) visibles++;
    });
    panel.querySelector(".dic-vacio").hidden = visibles > 0;
  }

  function abrir(id = null) {
    if (!panel) construir();
    ultimoFoco = document.activeElement;
    panel.hidden = false;
    requestAnimationFrame(() => panel.classList.add("abierto"));
    if (boton) boton.setAttribute("aria-expanded", "true");
    if (id && porId.has(id)) {
      campo.value = "";
      categoria = null;
      panel.querySelectorAll(".dic-filtros button").forEach((x) => x.setAttribute("aria-pressed", String(!x.dataset.cat)));
      filtrar();
      const entrada = panel.querySelector(`#dic-${id}`);
      entrada.scrollIntoView({ block: "center" });
      entrada.classList.remove("destacada");
      void entrada.offsetWidth;
      entrada.classList.add("destacada");
      entrada.setAttribute("tabindex", "-1");
      entrada.focus({ preventScroll: true });
    } else {
      campo.focus();
    }
  }

  function cerrar() {
    if (!panel || panel.hidden) return;
    panel.classList.remove("abierto");
    if (boton) boton.setAttribute("aria-expanded", "false");
    setTimeout(() => (panel.hidden = true), 250);
    if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
  }

  function enlazarTerminos(raiz = document) {
    raiz.querySelectorAll("[data-termino]").forEach((el) => {
      if (el.dataset.dicListo) return;
      const t = porId.get(el.dataset.termino);
      if (!t) return;
      el.dataset.dicListo = "1";
      el.setAttribute("role", "button");
      el.setAttribute("tabindex", "0");
      el.setAttribute("title", `${t[2]}: ${t[3]}`);
      const ir = (e) => {
        e.preventDefault();
        abrir(el.dataset.termino);
      };
      el.addEventListener("click", ir);
      el.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && ir(e));
    });
  }

  function montarBoton() {
    const nav = document.getElementById("nav");
    if (!nav || nav.querySelector("#dic-btn")) return;
    boton = document.createElement("button");
    boton.id = "dic-btn";
    boton.type = "button";
    boton.className = "ui dic-btn";
    boton.setAttribute("aria-controls", "dic-panel");
    boton.setAttribute("aria-expanded", "false");
    boton.setAttribute("aria-label", "Diccionario");
    boton.innerHTML = '<span aria-hidden="true" class="dic-icono">Aa</span><span class="dic-texto">Diccionario</span>';
    boton.addEventListener("click", () => (panel && !panel.hidden ? cerrar() : abrir()));
    const menu = nav.querySelector(".menu");
    nav.insertBefore(boton, menu || null);
  }

  document.addEventListener("DOMContentLoaded", () => {
    montarBoton();
    enlazarTerminos();
  });

  return { abrir, cerrar, enlazarTerminos, TERMINOS };
})();
