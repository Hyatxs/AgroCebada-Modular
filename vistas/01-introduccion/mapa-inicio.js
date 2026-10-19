"use strict";

/*
 * Capítulo 1 · El globo de la portada (d3-geo, proyección ortográfica).
 *   - Portada: la Tierra gira despacio detrás del título y la mascota.
 *   - «Nuestra huella ancestral»: el globo se detiene en el Creciente Fértil, donde nació la cebada.
 *   - Durante «¿Qué es la cebada?» (las espigas) se desvanece.
 *   - «Pequeña, pero de gran peso»: vuelve y viaja del Creciente Fértil a México pasando por España.
 *   - «Dónde crecemos»: se acerca a Hidalgo, Puebla y Tlaxcala; después aparecen las 197 parcelas.
 *   - «¿Dónde crece mejor la cebada?»: se desvanece.
 * Con «Reducir movimiento» no gira ni viaja: cada paso muestra su vista fija.
 * Contornos: Natural Earth (simplificados), en mapa-inicio-datos.js. Las fronteras simplificadas se
 * corren 1–5 km cerca de las parcelas, por eso el acercamiento se queda en el nivel de los estados.
 */

const MapaInicio = (() => {
  const D = window.MAPA_INICIO;
  const svg = document.getElementById("mapa-inicio");
  if (!D || !svg || typeof d3 === "undefined" || !d3.geoOrthographic) return null;

  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs = {}, padre = null) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (padre) padre.appendChild(n);
    return n;
  };
  const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
  const suave = (x) => x * x * (3 - 2 * x);
  const reducido = () => typeof Paleta !== "undefined" && Paleta.movimientoReducido();
  const GIRO_GRADOS_POR_SEGUNDO = 8;

  /* --- Geometrías ----------------------------------------------------------- */

  // d3 dibuja en la esfera: un anillo exterior al revés cubriría casi todo el globo, así que se corrige
  function multipoligono(polis) {
    const coordinates = polis.map((p) => (d3.geoArea({ type: "Polygon", coordinates: p }) > 2 * Math.PI ? p.map((r) => r.slice().reverse()) : p));
    return { type: "MultiPolygon", coordinates };
  }

  const MUNDO = multipoligono(D.mundo);
  const MEXICO = multipoligono(D.mexico);
  const OTROS_ESTADOS = { type: "GeometryCollection", geometries: D.estados.filter((e) => !e.reto).map((e) => multipoligono(e.p)) };
  const ESFERA = { type: "Sphere" };
  const RETICULA = d3.geoGraticule10();
  const caja = ([x0, y0, x1, y1]) => ({
    type: "Polygon",
    coordinates: [[[x0, y0], [x0, y1], [x1, y1], [x1, y0], [x0, y0]]],
  });

  // Los tres estados del reto: color y producción 2024 (SIAP-SADER)
  const RETO = {
    Hidalgo: { clase: "hgo", toneladas: "195 mil t", etiqueta: [-98.95, 20.62] },
    Puebla: { clase: "pue", toneladas: "133 mil t", etiqueta: [-97.55, 18.55] },
    Tlaxcala: { clase: "tla", toneladas: "129 mil t", etiqueta: [-98.12, 19.44] },
  };

  // El Creciente Fértil (del Levante a Mesopotamia) y el viaje a México en el siglo XVI
  const CRECIENTE = { type: "LineString", coordinates: [[34.6, 31.4], [36.2, 34.6], [38.6, 36.9], [42.2, 36.7], [44.3, 33.3], [47.2, 30.7]] };
  const MESOPOTAMIA = [44.3, 33.3];
  const ESPANA = [-6.0, 37.4]; // Sevilla, puerto de salida a la Nueva España
  const VERACRUZ = [-96.1, 19.2];
  const RUTA = [MESOPOTAMIA, [30.0, 34.0], [14.0, 37.8], ESPANA, VERACRUZ];
  const tramosRuta = RUTA.slice(1).map((b, i) => ({ a: RUTA[i], b, largo: d3.geoDistance(RUTA[i], b) }));
  const largoRuta = tramosRuta.reduce((s, r) => s + r.largo, 0);

  function rutaHasta(p) {
    // Recorta la ruta a la fracción p de su largo, siguiendo arcos de círculo máximo
    const pts = [RUTA[0]];
    let falta = p * largoRuta;
    for (const r of tramosRuta) {
      const interp = d3.geoInterpolate(r.a, r.b);
      const pasos = Math.max(2, Math.ceil(r.largo / 0.02));
      const hasta = falta >= r.largo ? 1 : falta / r.largo;
      for (let k = 1; k <= pasos; k++) {
        const f = (k / pasos) * hasta;
        pts.push(interp(f));
        if (f >= hasta) break;
      }
      falta -= r.largo;
      if (falta <= 0) break;
    }
    return { type: "LineString", coordinates: pts };
  }

  /* --- Capas ---------------------------------------------------------------- */

  const defs = el("defs", {}, svg);
  const gradiente = el("radialGradient", { id: "mi-oceano", cx: "36%", cy: "30%", r: "78%" }, defs);
  el("stop", { offset: "0%", class: "mi-oceano-1" }, gradiente);
  el("stop", { offset: "100%", class: "mi-oceano-2" }, gradiente);

  const pHalo = el("path", { class: "mi-halo" }, svg);
  const pEsfera = el("path", { class: "mi-esfera", fill: "url(#mi-oceano)" }, svg);
  const pReticula = el("path", { class: "mi-reticula" }, svg);
  const pMundo = el("path", { class: "mi-mundo" }, svg);
  const pMexicoRelleno = el("path", { class: "mi-mexico-relleno" }, svg);
  const pEstados = el("path", { class: "mi-estado" }, svg);
  const capaReto = el("g", { class: "mi-capa-reto" }, svg);
  const pReto = D.estados.filter((e) => e.reto).map((e) => ({ geo: multipoligono(e.p), nodo: el("path", { class: `mi-reto mi-reto-${RETO[e.n].clase}` }, capaReto) }));
  const pMexico = el("path", { class: "mi-mexico" }, svg);
  const pCreciente = el("path", { class: "mi-creciente" }, svg);
  const pRuta = el("path", { class: "mi-ruta" }, svg);

  const capaParcelas = el("g", { class: "mi-capa-parcelas" }, svg);
  // Primero las conocidas y encima las que hay que predecir
  const parcelas = [...D.parcelas]
    .sort((a, b) => a[2] - b[2])
    .map(([lon, lat, pred]) => ({ lon, lat, nodo: el("circle", { r: 3, class: pred ? "mi-parcela predecir" : "mi-parcela conocida" }, capaParcelas) }));

  const capaMarcas = el("g", { class: "mi-capa-marcas" }, svg);
  const marcaOrigen = el("g", { class: "mi-marca" }, capaMarcas);
  el("circle", { r: 14, class: "mi-marca-onda" }, marcaOrigen);
  el("circle", { r: 5, class: "mi-marca-punto" }, marcaOrigen);
  const marcaLlegada = el("g", { class: "mi-marca mi-marca-llegada" }, capaMarcas);
  el("circle", { r: 14, class: "mi-marca-onda" }, marcaLlegada);
  el("circle", { r: 5, class: "mi-marca-punto" }, marcaLlegada);

  const capaEtiquetas = el("g", { class: "mi-capa-etiquetas" }, svg);
  const etiqueta = (clase, lineas, lonlat) => {
    const t = el("text", { class: `mi-etiqueta ${clase}`, "text-anchor": "middle" }, capaEtiquetas);
    const spans = lineas.map(([texto, c], i) => {
      const s = el("tspan", { x: 0, dy: i ? "1.25em" : 0, class: c }, t);
      s.textContent = texto;
      return s;
    });
    return { t, spans, lonlat };
  };
  const etiquetasReto = Object.entries(RETO).map(([nombre, r]) =>
    etiqueta(`mi-etiqueta-${r.clase}`, [[nombre, "mi-nombre"], [r.toneladas, "mi-toneladas"]], r.etiqueta)
  );
  const etiquetaMexico = etiqueta("mi-pais", [["México", ""]], [-102.4, 24.2]);
  const etiquetaOrigen = etiqueta("mi-lugar", [["Creciente Fértil", "mi-nombre"], ["hace unos 10,000 años", "mi-toneladas"]], [41.5, 38.6]);
  const etiquetaEspana = etiqueta("mi-lugar mi-lugar-chico", [["España", "mi-nombre"]], [-4.5, 41.6]);
  const etiquetaLlegada = etiqueta("mi-lugar", [["México", "mi-nombre"], ["la cebada llega en el siglo XVI", "mi-toneladas"]], [-102.4, 25.6]);

  /* --- Vistas --------------------------------------------------------------- */

  const proyeccion = d3.geoOrthographic().precision(0.6);
  const camino = d3.geoPath(proyeccion);

  // Cada vista: centro (lon, lat), radio del globo en píxeles y posición del centro en pantalla
  let VISTAS = null;
  function calcularVistas() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const angosto = W < 760;
    const m = Math.min(W, H);

    // Ajusta una caja lon/lat al hueco libre de la pantalla (el texto va a la izquierda o arriba)
    const ajustar = (bbox, margen) => {
      const [x0, y0, x1, y1] = bbox;
      const lon = (x0 + x1) / 2;
      const lat = (y0 + y1) / 2;
      proyeccion.rotate([-lon, -lat]).scale(1).translate([0, 0]).clipExtent(null);
      const [[a, b], [c, d]] = camino.bounds(caja(bbox));
      const libreW = angosto ? W * 0.92 : W * 0.56;
      const libreH = angosto ? H * 0.5 : H * 0.78;
      const R = Math.min(libreW / (c - a), libreH / (d - b)) / margen;
      return { lon, lat, R, x: angosto ? W * 0.5 : W * 0.66, y: angosto ? H * 0.69 : H * 0.53 };
    };

    VISTAS = {
      portada: { lon: -100, lat: 16, R: angosto ? Math.min(W * 0.62, H * 0.33) : Math.min(W * 0.32, H * 0.42), x: W * 0.5, y: angosto ? H * 0.62 : H * 0.58 },
      origen: { lon: 40, lat: 30, R: angosto ? Math.min(W * 0.6, H * 0.3) : m * 0.42, x: angosto ? W * 0.5 : W * 0.68, y: angosto ? H * 0.7 : H * 0.54 },
      mexico: { lon: -97, lat: 24, R: angosto ? Math.min(W * 0.6, H * 0.3) : m * 0.42, x: angosto ? W * 0.5 : W * 0.68, y: angosto ? H * 0.7 : H * 0.54 },
      reto: ajustar(D.cajas.reto, 1.1),
      cerca: ajustar(D.cajas.reto, 0.92),
    };
  }

  /* --- Recorrido con el scroll --------------------------------------------- */

  const BASE = { op: 0, giro: 0, mundo: 1, mexico: 0.35, estados: 0, reto: 0, parcelas: 0, creciente: 0, ruta: 0, llegada: 0 };
  let CUADROS = [];

  function medir() {
    const H = window.innerHeight;
    const arriba = (id, defecto) => {
      const n = document.getElementById(id);
      return n ? (n.getBoundingClientRect().top + window.scrollY) / H : defecto;
    };
    const origen = arriba("origen", 1);
    const espigas = arriba("espigas", origen + 1);
    const produccion = arriba("produccion", espigas + 2);
    const estados = arriba("donde-estados", produccion + 1);
    const lote = arriba("donde-parcelas", estados + 1);
    const condiciones = arriba("crecimiento", lote + 1);
    const c = (t, vista, valores) => ({ t, vista, ...BASE, ...valores });

    CUADROS = [
      c(0, "portada", { op: 0.6, giro: 1 }),
      c(origen - 0.25, "origen", { op: 0.9, creciente: 1 }),
      c(espigas - 0.35, "origen", { op: 0.9, creciente: 1 }),
      c(espigas + 0.05, "origen", { op: 0, creciente: 0 }),
      c(produccion - 0.1, "origen", { op: 0 }),
      c(produccion + 0.25, "origen", { op: 0.9, creciente: 0.5 }),
      c(produccion + 0.85, "mexico", { op: 0.9, ruta: 1, llegada: 1, mexico: 1 }),
      c(estados - 0.3, "mexico", { op: 0.9, ruta: 1, llegada: 1, mexico: 1 }),
      c(estados + 0.12, "reto", { op: 1, mundo: 0.3, mexico: 1, estados: 1, reto: 1, ruta: 1, llegada: 1 }),
      c(lote - 0.45, "reto", { op: 1, mundo: 0.3, mexico: 1, estados: 1, reto: 1, ruta: 1, llegada: 1 }),
      c(lote + 0.02, "cerca", { op: 1, mundo: 0.3, mexico: 1, estados: 1, reto: 1, parcelas: 1, ruta: 1, llegada: 1 }),
      // Se apaga mientras entra el título de «Cómo crece», para no quedar debajo de él
      c(Math.max(lote + 0.3, condiciones - 0.95), "cerca", { op: 1, mundo: 0.3, mexico: 1, estados: 1, reto: 1, parcelas: 1, ruta: 1, llegada: 1 }),
      c(Math.max(lote + 0.55, condiciones - 0.55), "cerca", { op: 0, mundo: 0.3, mexico: 1, estados: 1, reto: 1, parcelas: 1, ruta: 1, llegada: 1 }),
    ];
  }

  const angulo = (a, b, u) => a + ((((b - a) % 360) + 540) % 360 - 180) * u;

  function estadoEn(t, giroLon) {
    const sinMovimiento = reducido();
    let i = 0;
    while (i < CUADROS.length - 1 && CUADROS[i + 1].t <= t) i++;
    const a = CUADROS[i];
    const b = CUADROS[Math.min(i + 1, CUADROS.length - 1)];
    let u = b === a || b.t <= a.t ? 0 : suave(limitar((t - a.t) / (b.t - a.t), 0, 1));
    if (sinMovimiento) u = u < 0.5 ? 0 : 1; // sin transiciones: cada paso con su vista fija

    const va = VISTAS[a.vista];
    const vb = VISTAS[b.vista];
    const e = {};
    for (const k of Object.keys(BASE)) e[k] = a[k] + (b[k] - a[k]) * u;
    if (sinMovimiento) e.giro = 0;

    const lonA = angulo(va.lon, giroLon, a.giro * (sinMovimiento ? 0 : 1));
    const lonB = angulo(vb.lon, giroLon, b.giro * (sinMovimiento ? 0 : 1));
    e.lon = angulo(lonA, lonB, u);
    e.lat = va.lat + (vb.lat - va.lat) * u;
    e.R = va.R * Math.pow(vb.R / va.R, u); // el acercamiento se siente parejo en escala logarítmica
    e.x = va.x + (vb.x - va.x) * u;
    e.y = va.y + (vb.y - va.y) * u;
    return e;
  }

  /* --- Dibujo --------------------------------------------------------------- */

  let W = 0;
  let H = 0;
  function tamano() {
    W = window.innerWidth;
    H = window.innerHeight;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    calcularVistas();
    medir();
  }

  const mostrar = (nodo, v, minimo = 0.01) => {
    nodo.style.display = v < minimo ? "none" : "";
    if (v >= minimo) nodo.style.opacity = Math.min(1, v).toFixed(3);
    return v >= minimo;
  };

  function colocar(item, centro, minimo = 0.12) {
    const visible = d3.geoDistance(item.lonlat, centro) < Math.PI / 2 - minimo;
    const [x, y] = proyeccion(item.lonlat);
    item.t.setAttribute("x", x.toFixed(1));
    item.t.setAttribute("y", y.toFixed(1));
    item.spans.forEach((s) => s.setAttribute("x", x.toFixed(1)));
    return visible;
  }

  function colocarMarca(nodo, lonlat, centro, v) {
    const visible = v > 0.01 && d3.geoDistance(lonlat, centro) < Math.PI / 2 - 0.08;
    nodo.style.display = visible ? "" : "none";
    if (!visible) return;
    const [x, y] = proyeccion(lonlat);
    nodo.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    nodo.style.opacity = v.toFixed(3);
  }

  let ultimo = "";
  function pintar(e) {
    const angosto = W < 760;
    const clave = [e.lon, e.lat, e.R, e.x, e.y, e.op, e.mundo, e.mexico, e.estados, e.reto, e.parcelas, e.creciente, e.ruta, e.llegada].map((n) => n.toFixed(2)).join("|");
    if (clave === ultimo) return;
    ultimo = clave;

    svg.style.opacity = e.op.toFixed(3);
    svg.style.visibility = e.op < 0.01 ? "hidden" : "visible";
    if (e.op < 0.01) return;

    proyeccion
      .rotate([-e.lon, -e.lat])
      .scale(e.R)
      .translate([e.x, e.y])
      .clipExtent([[-20, -20], [W + 20, H + 20]]);
    const centro = [e.lon, e.lat];

    pHalo.setAttribute("d", camino(ESFERA) || "");
    pEsfera.setAttribute("d", camino(ESFERA) || "");
    // La retícula solo se ve mientras el globo es un globo
    const globo = limitar(1 - Math.log(e.R / Math.min(W, H)) / Math.log(4), 0, 1);
    if (mostrar(pReticula, globo)) pReticula.setAttribute("d", camino(RETICULA) || "");
    if (mostrar(pMundo, 0.35 + 0.65 * e.mundo)) pMundo.setAttribute("d", camino(MUNDO) || "");
    pMexicoRelleno.setAttribute("d", camino(MEXICO) || "");
    pMexicoRelleno.style.opacity = e.mexico.toFixed(3);
    if (mostrar(pEstados, e.estados)) pEstados.setAttribute("d", camino(OTROS_ESTADOS) || "");
    if (mostrar(capaReto, e.reto)) pReto.forEach((r) => r.nodo.setAttribute("d", camino(r.geo) || ""));
    if (mostrar(pMexico, Math.max(e.mexico, e.estados))) pMexico.setAttribute("d", camino(MEXICO) || "");
    if (mostrar(pCreciente, e.creciente)) pCreciente.setAttribute("d", camino(CRECIENTE) || "");
    if (mostrar(pRuta, e.ruta > 0.01 ? 1 - e.estados : 0)) pRuta.setAttribute("d", camino(rutaHasta(e.ruta)) || "");

    colocarMarca(marcaOrigen, MESOPOTAMIA, centro, Math.max(e.creciente, e.ruta > 0.01 && e.llegada < 0.99 ? 1 - e.llegada : 0));
    colocarMarca(marcaLlegada, VERACRUZ, centro, suave(limitar((e.ruta - 0.85) / 0.15, 0, 1)) * (1 - e.estados));

    if (mostrar(capaParcelas, e.parcelas)) {
      const r = angosto ? 2.6 : 3.4;
      parcelas.forEach((p) => {
        const [x, y] = proyeccion([p.lon, p.lat]);
        p.nodo.setAttribute("cx", x.toFixed(1));
        p.nodo.setAttribute("cy", y.toFixed(1));
        p.nodo.setAttribute("r", r);
      });
    }

    // Etiquetas
    const tamanoReto = angosto ? 13 : 16;
    etiquetasReto.forEach((et) => {
      const ok = colocar(et, centro) && e.reto > 0.01;
      et.t.style.display = ok ? "" : "none";
      et.t.setAttribute("font-size", tamanoReto);
      et.t.style.opacity = e.reto.toFixed(3);
    });
    // «México» se nombra mientras no aparece la etiqueta de la llegada
    const vMexico = limitar((e.mexico - 0.5) * 2, 0, 1) * (1 - e.reto) * (1 - suave(limitar((e.ruta - 0.85) / 0.15, 0, 1)));
    const okMexico = colocar(etiquetaMexico, centro) && vMexico > 0.01;
    etiquetaMexico.t.style.display = okMexico ? "" : "none";
    etiquetaMexico.t.setAttribute("font-size", angosto ? 14 : 18);
    etiquetaMexico.t.style.opacity = vMexico.toFixed(3);

    const okOrigen = colocar(etiquetaOrigen, centro) && e.creciente > 0.01;
    etiquetaOrigen.t.style.display = okOrigen ? "" : "none";
    etiquetaOrigen.t.setAttribute("font-size", angosto ? 13 : 16);
    etiquetaOrigen.t.style.opacity = e.creciente.toFixed(3);

    const vEspana = e.ruta > 0.35 ? (1 - e.llegada * 0.6) * (1 - e.estados) : 0;
    const okEspana = colocar(etiquetaEspana, centro) && vEspana > 0.01;
    etiquetaEspana.t.style.display = okEspana ? "" : "none";
    etiquetaEspana.t.setAttribute("font-size", angosto ? 11 : 13);
    etiquetaEspana.t.style.opacity = vEspana.toFixed(3);

    const vLlegada = suave(limitar((e.ruta - 0.85) / 0.15, 0, 1)) * (1 - e.estados);
    const okLlegada = colocar(etiquetaLlegada, centro) && vLlegada > 0.01;
    etiquetaLlegada.t.style.display = okLlegada ? "" : "none";
    etiquetaLlegada.t.setAttribute("font-size", angosto ? 13 : 16);
    etiquetaLlegada.t.style.opacity = vLlegada.toFixed(3);
  }

  /* --- Bucle ---------------------------------------------------------------- */

  let tSuave = 0;
  let giroLon = -100;
  let previo = performance.now();

  function cuadro(ahora) {
    const dt = Math.min(0.1, (ahora - previo) / 1000);
    previo = ahora;
    const t = window.scrollY / H;
    tSuave += (t - tSuave) * (reducido() ? 1 : 0.14);
    if (Math.abs(t - tSuave) < 0.0005) tSuave = t;
    // Gira solo mientras se ve la portada (y no con «Reducir movimiento»)
    if (!reducido() && !document.hidden) giroLon -= GIRO_GRADOS_POR_SEGUNDO * dt;
    if (giroLon < -180) giroLon += 360;
    pintar(estadoEn(tSuave, giroLon));
    requestAnimationFrame(cuadro);
  }

  tamano();
  tSuave = window.scrollY / H;
  window.addEventListener("resize", () => {
    tamano();
    ultimo = "";
  });
  window.addEventListener("load", () => {
    medir();
    ultimo = "";
  });
  requestAnimationFrame(cuadro);

  return { medir };
})();
