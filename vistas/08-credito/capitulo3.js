"use strict";

/*
 * Capítulo 3 · Del rendimiento al crédito.
 *   - Historia: las 59 parcelas por predecir (su forma real) cambian de acomodo con el scroll:
 *     mapa inclinado → lo que le importa a FIRA → ¿llega a tiempo? → P20 contra predicción →
 *     punto de equilibrio → el riesgo del precio → semáforo → municipios.
 *   - Simulador de crédito: una parcela, precio, costo y tasa; contesta las tres preguntas.
 *   - La cartera: cifras, sensibilidad al precio, superficie por riesgo, tabla y CSV.
 *   - Todo el recorrido y mascota.
 * Las predicciones, el P20 y el riesgo salen de datos-modelo.js (modelo final del capítulo 2).
 * Precio, costo y tasa son supuestos editables, con su fuente en el pie de página.
 * Lo que se debe = costo × (1 + tasa × plazo / 12): crédito que financia todo el costo, interés simple.
 */

(() => {
  const datos = window.MODELO_HGP;
  const q = datos.modelo.q;
  const [U1, U2] = datos.modelo.umbrales_riesgo;
  const fmt = Util.fmt;
  const reducido = () => Paleta.movimientoReducido();

  // Supuestos de referencia (ver fuentes en el pie de la página)
  // tasa: % anual (referencia: Cosechando Soberanía; no confirmada para cebada); PLAZO: meses del crédito de avío
  const REF = { precio: 7500, costo: 15755, tasa: 8.5 };
  const PLAZO = 10;
  const PRECIOS = [
    { v: 4500, t: "recorte 2025" },
    { v: 6077, t: "promedio 2024" },
    { v: 7000, t: "2026" },
    { v: 7500, t: "2025" },
    { v: 8252, t: "2023" },
  ];
  const RIESGOS = ["Bajo", "Medio", "Alto"];
  const claseRiesgo = (r) => `riesgo-${r.toLowerCase()}`;

  /* --- Datos: las 59 parcelas por predecir ---------------------------------- */

  const parcelas = datos.parcelas
    .filter((p) => p.pred)
    .map((p) => ({
      ...p,
      p10: p.est + q.p10 * p.sd,
      p20: p.est + q.p20 * p.sd,
      p90: p.est + q.p90 * p.sd,
      caida: (-q.p20 * p.sd) / p.est,
    }));
  const conocidas = datos.parcelas.filter((p) => !p.pred);
  const porId = new Map(parcelas.map((p) => [p.id, p]));
  const maxHa = Math.max(...parcelas.map((p) => p.ha));

  const estado = {
    precio: REF.precio,
    costo: REF.costo,
    tasa: REF.tasa,
    seleccion: porId.has("AGC_031") ? "AGC_031" : parcelas[0].id,
    eligio: false, // la marca rosa en la historia aparece solo cuando la persona elige una parcela
  };

  // Lo que se debe por hectárea: el costo más los intereses del plazo
  const deudaHa = (costo = estado.costo, tasa = estado.tasa) => costo * (1 + (tasa / 100) * (PLAZO / 12));
  // Punto de equilibrio (t/ha): lo que se debe entre el precio
  const equilibrioDe = (precio = estado.precio, costo = estado.costo, tasa = estado.tasa) => deudaHa(costo, tasa) / precio;

  function finanzas(p, precio = estado.precio, costo = estado.costo, tasa = estado.tasa) {
    const costoTotal = costo * p.ha;
    const deuda = deudaHa(costo, tasa) * p.ha;
    const ingresoP20 = p.p20 * p.ha * precio;
    return {
      costoTotal, deuda, intereses: deuda - costoTotal, ingresoP20,
      cob: ingresoP20 / deuda, equilibrio: equilibrioDe(precio, costo, tasa), margen: ingresoP20 - deuda,
    };
  }
  const cubren = (precio = estado.precio, costo = estado.costo, tasa = estado.tasa) =>
    parcelas.filter((p) => p.p20 >= equilibrioDe(precio, costo, tasa));
  const pesos = (v) => "$" + fmt(Math.round(v), 0);
  const porcentaje = (v) => fmt(v, Number.isInteger(v) ? 0 : 1); // 8.5 → "8.5", 0 → "0"
  const millones = (v) => "$" + fmt(v / 1e6, 1) + " M";
  const suma = (lista, f) => lista.reduce((s, x) => s + f(x), 0);
  const listaNatural = (xs) => (xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " y " + xs[xs.length - 1]);

  /* --- Ayudas de SVG y tooltip ---------------------------------------------- */

  const NS = "http://www.w3.org/2000/svg";
  function el(tag, attrs = {}, padre) {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (padre) padre.appendChild(n);
    return n;
  }
  function texto(padre, x, y, contenido, attrs = {}) {
    const t = el("text", { x, y, ...attrs }, padre);
    t.textContent = contenido;
    return t;
  }

  let tip = null;
  function mostrarTip(e, html) {
    if (!tip) {
      tip = document.createElement("div");
      tip.className = "c3-tip";
      tip.setAttribute("role", "status");
      document.body.appendChild(tip);
    }
    tip.innerHTML = html;
    tip.hidden = false;
    const x = Math.min(window.innerWidth - tip.offsetWidth - 12, e.clientX + 14);
    const y = Math.max(12, e.clientY - tip.offsetHeight - 12);
    tip.style.transform = `translate(${x}px, ${y}px)`;
  }
  const ocultarTip = () => tip && (tip.hidden = true);
  const tipParcela = (p) =>
    `<b>${p.id}</b> · ${p.mun}<br>predicción ${fmt(p.est, 2)} · P20 ${fmt(p.p20, 2)} t/ha<br>${fmt(p.ha, 1)} ha · riesgo ${p.riesgo.toLowerCase()}`;

  // Polígono real de una parcela, centrado y con radio 100 (luego se escala)
  function caminoParcela(p) {
    const anillo = p.poly[0];
    const R = Math.max(...anillo.map(([x, y]) => Math.hypot(x - p.x, y - p.y))) || 0.05;
    const d = anillo.map(([x, y], i) => `${i ? "L" : "M"}${(((x - p.x) / R) * 100).toFixed(1)},${(((y - p.y) / R) * 100).toFixed(1)}`).join("") + "Z";
    return { d, R };
  }
  parcelas.forEach((p) => Object.assign(p, caminoParcela(p)));

  /* --- Cifras del texto ------------------------------------------------------ */

  // Municipios de las parcelas que no pagan su crédito con ese precio, de más a menos: "Calpulalpan (14), …"
  function municipiosSin(precio, costo, tasa) {
    const eq = equilibrioDe(precio, costo, tasa);
    const cuenta = new Map();
    parcelas.filter((p) => p.p20 < eq).forEach((p) => {
      const mun = p.mun.replace(" de Mariano Arista", "");
      cuenta.set(mun, (cuenta.get(mun) || 0) + 1);
    });
    const lista = [...cuenta].sort((a, b) => b[1] - a[1]).map(([mun, n]) => `${mun} (${n})`);
    return lista.length ? listaNatural(lista) : "ningún municipio";
  }

  // Cifras fijas de la historia: siempre con los supuestos de referencia
  function llenarCifras() {
    const cuentas = Object.fromEntries(RIESGOS.map((r) => [r, parcelas.filter((p) => p.riesgo === r).length]));
    const m = datos.metricas;
    const valores = {
      n: parcelas.length,
      ha: fmt(suma(parcelas, (p) => p.ha), 1),
      t_est: fmt(suma(parcelas, (p) => p.est * p.ha), 0),
      t_p20: fmt(suma(parcelas, (p) => p.p20 * p.ha), 0),
      t_p20b: fmt(suma(parcelas, (p) => p.p20 * p.ha), 0),
      costo: fmt(REF.costo, 0),
      precio: fmt(REF.precio, 0),
      tasa: porcentaje(REF.tasa),
      plazo: PLAZO,
      deuda_ha: fmt(Math.round(deudaHa(REF.costo, REF.tasa)), 0),
      equilibrio: fmt(equilibrioDe(REF.precio, REF.costo, REF.tasa), 2),
      cubren: cubren(REF.precio, REF.costo, REF.tasa).length,
      no_6077: parcelas.length - cubren(6077, REF.costo, REF.tasa).length,
      equilibrio_4500: fmt(equilibrioDe(4500, REF.costo, REF.tasa), 2),
      cubren_4500: cubren(4500, REF.costo, REF.tasa).length,
      mun_4500: municipiosSin(4500, REF.costo, REF.tasa),
      n_bajo: cuentas.Bajo, n_medio: cuentas.Medio, n_alto: cuentas.Alto, n_alto2: cuentas.Alto,
      u1: fmt(U1 * 100, 0), u1b: fmt(U1 * 100, 0), u2: fmt(U2 * 100, 0), u2b: fmt(U2 * 100, 0),
      alto_calpulalpan: parcelas.filter((p) => p.riesgo === "Alto" && p.mun === "Calpulalpan").length,
      bajo_chignahuapan: parcelas.filter((p) => p.riesgo === "Bajo" && p.mun === "Chignahuapan").length,
      rmse: fmt(m.rmse, 2),
      rmse2: fmt(m.rmse, 2),
      rmse_base: fmt(m.rmse_base, 2),
      rmse_esp: fmt(m.rmse_espacial, 2),
      dist_m: fmt(Math.round(m.dist_mediana_km * 1000), 0),
    };
    $$("[data-c3]").forEach((n) => {
      const v = valores[n.dataset.c3];
      if (v != null) n.textContent = String(v);
    });
  }
  llenarCifras();

  // Cifras que siguen al simulador (precio, costo y tasa elegidos)
  function llenarVivas() {
    const valores = {
      cubren_4500: cubren(4500).length,
      mun_4500: municipiosSin(4500, estado.costo, estado.tasa),
    };
    $$("[data-vivo]").forEach((n) => {
      const v = valores[n.dataset.vivo];
      if (v != null) n.textContent = String(v);
    });
  }

  /* --- Fondo: líneas onduladas como en un billete ---------------------------- */

  (function dibujarFondo() {
    const svg = $(".c3-fondo");
    if (!svg) return;
    svg.setAttribute("viewBox", "0 0 1440 900");
    for (let familia = 0; familia < 2; familia++) {
      const g = el("g", { transform: familia ? "rotate(-7 720 450)" : "rotate(5 720 450)" }, svg);
      for (let i = 0; i < 22; i++) {
        const y0 = -40 + i * 46 + familia * 23;
        const amp = 10 + 7 * Math.sin(i * 0.9 + familia);
        const lambda = 240 + 40 * Math.sin(i * 0.5);
        let d = "";
        for (let x = -60; x <= 1500; x += 12) {
          const y = y0 + amp * Math.sin((x / lambda) * Math.PI * 2 + i * 0.7) + 4 * Math.sin(x / 37 + i);
          d += `${x === -60 ? "M" : "L"}${x},${y.toFixed(1)}`;
        }
        el("path", { d }, g);
      }
    }
  })();

  /* --- Escenario de la historia ---------------------------------------------- */

  const escenario = $(".c3-escenario");
  const svg = $("#c3-fichas");
  const capaContexto = el("g", { class: "c3-capa c3-contexto" }, svg);
  const placa = el("rect", { class: "c3-placa", rx: 26 }, capaContexto);
  const capaEjes = el("g", { class: "c3-capa" }, svg);
  const capaEquilibrio = el("g", { class: "c3-capa" }, svg);
  const capaRangos = el("g", { class: "c3-capa c3-rango" }, svg);
  const sombras = el("g", { class: "c3-sombras" }, svg);
  const capaEtiquetas = el("g", { class: "c3-capa" }, svg);
  // La línea de equilibrio y su etiqueta van encima de las parcelas, para que siempre se lean
  const capaEqTexto = el("g", { class: "c3-capa" }, svg);

  // Orden fijo para el gráfico: de la predicción más baja a la más alta
  const porPrediccion = [...parcelas].sort((a, b) => a.est - b.est);
  const rango = new Map();
  porPrediccion.forEach((p, i) => {
    const l = el("line", {}, capaRangos);
    l.style.animationDelay = `${i * 14}ms`;
    rango.set(p.id, l);
  });

  const glifos = new Map();
  parcelas.forEach((p, i) => {
    const g = el("g", { class: `c3-g ${claseRiesgo(p.riesgo)}` }, sombras);
    el("path", { d: p.d }, g);
    g.style.transitionDelay = `${(i % 30) * 9}ms`;
    g.style.transform = "translate(0px, 0px) scale(0)";
    g.addEventListener("pointermove", (e) => mostrarTip(e, tipParcela(p)));
    g.addEventListener("pointerleave", ocultarTip);
    g.addEventListener("click", () => {
      ocultarTip();
      Simulador.elegir(p.id);
      $("#c3-simulador").scrollIntoView({ behavior: reducido() ? "auto" : "smooth" });
    });
    glifos.set(p.id, g);
  });

  // Las 138 conocidas, de contexto en el mapa (sin animación)
  conocidas.forEach((p) => {
    const { d, R } = caminoParcela(p);
    const g = el("g", { class: "c3-conocida" }, capaContexto);
    el("path", { d }, g);
    g.dataset.r = R;
    g.dataset.id = p.id;
  });

  let tam = { W: 600, H: 500 };
  let pasoActual = null;

  function medir() {
    const caja = svg.getBoundingClientRect();
    tam = { W: Math.max(280, caja.width), H: Math.max(240, caja.height) };
    svg.setAttribute("viewBox", `0 0 ${tam.W} ${tam.H}`);
  }

  function colocar(p, x, y, r) {
    glifos.get(p.id).style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${(r / 100).toFixed(4)})`;
  }

  // Mapa: las posiciones del mapa esquemático del capítulo 2, con su tamaño real
  function acomodoMapa() {
    const { W, H } = tam;
    const todos = datos.parcelas;
    const xs = todos.map((p) => p.x + (p.dx || 0)), ys = todos.map((p) => p.y + (p.dy || 0));
    const x0 = Math.min(...xs) - 0.3, x1 = Math.max(...xs) + 0.3, y0 = Math.min(...ys) - 0.3, y1 = Math.max(...ys) + 0.3;
    const k = Math.min((W * 0.92) / (x1 - x0), (H * 0.92) / (y1 - y0));
    const ox = (W - (x1 - x0) * k) / 2, oy = (H - (y1 - y0) * k) / 2;
    const X = (p) => ox + (p.x + (p.dx || 0) - x0) * k, Y = (p) => oy + (p.y + (p.dy || 0) - y0) * k;
    placa.setAttribute("x", ox - 14); placa.setAttribute("y", oy - 14);
    placa.setAttribute("width", (x1 - x0) * k + 28); placa.setAttribute("height", (y1 - y0) * k + 28);
    parcelas.forEach((p) => colocar(p, X(p), Y(p), Math.max(2.2, p.R * k)));
    const porIdTodos = new Map(conocidas.map((p) => [p.id, p]));
    [...capaContexto.querySelectorAll(".c3-conocida")].forEach((g) => {
      const p = porIdTodos.get(g.dataset.id);
      g.setAttribute("transform", `translate(${X(p).toFixed(1)} ${Y(p).toFixed(1)}) scale(${(Math.max(2, g.dataset.r * k) / 100).toFixed(4)})`);
    });
    capaEtiquetas.innerHTML = "";
  }

  // Gráfico: cada parcela es un punto en su predicción; su línea baja hasta el P20
  const DOM = { y0: 1.8, y1: 5.0 };
  function ejesGrafico() {
    const { W, H } = tam;
    const m = { izq: 52, der: 14, sup: 26, inf: 48 };
    const x = (i) => m.izq + ((i + 0.5) * (W - m.izq - m.der)) / porPrediccion.length;
    const y = (v) => m.sup + ((DOM.y1 - v) / (DOM.y1 - DOM.y0)) * (H - m.sup - m.inf);
    return { m, x, y };
  }

  // Punto de equilibrio en el gráfico. La línea y la franja rosa se dibujan una vez por tamaño y luego solo
  // se desplazan (con transición CSS), así la línea sube cuando el precio baja en el paso «precio».
  let dibujoEquilibrio = null;
  function equilibrioGrafico(precio) {
    const { W, H } = tam;
    const { m, y } = ejesGrafico();
    if (!dibujoEquilibrio || dibujoEquilibrio.W !== W || dibujoEquilibrio.H !== H) {
      capaEquilibrio.innerHTML = "";
      capaEqTexto.innerHTML = "";
      const clip = el("clipPath", { id: "c3-clip-grafico" }, el("defs", {}, capaEquilibrio));
      el("rect", { x: m.izq, y: m.sup, width: W - m.izq - m.der, height: y(DOM.y0) - m.sup }, clip);
      // Referencia fija: dónde quedaba la línea con el precio de 2025 (solo se ve en el paso «precio»)
      const eqRef = equilibrioDe(REF.precio, REF.costo, REF.tasa);
      const previa = el("g", { class: "c3-eq-previa" }, capaEquilibrio);
      el("line", { x1: m.izq, x2: W - m.der, y1: y(eqRef), y2: y(eqRef) }, previa);
      texto(previa, m.izq + 8, y(eqRef) - 7, `con $${fmt(REF.precio, 0)}: ${fmt(eqRef, 2)} t/ha`);
      const franja = el("g", { class: "c3-eq-movil" }, el("g", { "clip-path": "url(#c3-clip-grafico)" }, capaEquilibrio));
      el("rect", { x: m.izq, y: 0, width: W - m.izq - m.der, height: H, class: "c3-perdida" }, franja);
      const linea = el("g", { class: "c3-eq-movil" }, capaEqTexto);
      el("line", { x1: m.izq, x2: W - m.der, y1: 0, y2: 0, class: "c3-linea-equilibrio" }, linea);
      const etiqueta = texto(linea, 0, -8, "", { class: "rosa" });
      const nota = texto(linea, 0, 20, "aquí la cosecha no alcanza para pagar el crédito");
      dibujoEquilibrio = { W, H, franja, linea, etiqueta, nota, m };
    }
    const eq = equilibrioDe(precio, REF.costo, REF.tasa);
    const mover = `translate(0px, ${y(eq).toFixed(1)}px)`;
    dibujoEquilibrio.franja.style.transform = mover;
    dibujoEquilibrio.linea.style.transform = mover;
    dibujoEquilibrio.etiqueta.textContent = `con $${fmt(precio, 0)}/t · equilibrio ${fmt(eq, 2)} t/ha`;
    // Las etiquetas van del lado sin parcelas: a la derecha cuando la línea está baja, a la izquierda cuando sube
    const izquierda = eq > 3.2;
    [dibujoEquilibrio.etiqueta, dibujoEquilibrio.nota].forEach((t) => {
      t.setAttribute("x", izquierda ? m.izq + 8 : W - m.der - 6);
      t.setAttribute("text-anchor", izquierda ? "start" : "end");
    });
    return eq;
  }

  function acomodoGrafico(paso = {}) {
    const { W, H } = tam;
    const { m, x, y } = ejesGrafico();
    const r = Math.max(4, Math.min(8, (W - m.izq - m.der) / porPrediccion.length / 1.6));
    porPrediccion.forEach((p, i) => {
      colocar(p, x(i), y(p.est), r);
      const l = rango.get(p.id);
      l.setAttribute("x1", x(i)); l.setAttribute("x2", x(i));
      l.setAttribute("y1", y(p.est)); l.setAttribute("y2", y(p.p20));
    });
    capaEjes.innerHTML = "";
    for (let v = 2; v <= DOM.y1 + 1e-9; v += 0.5) {
      el("line", { x1: m.izq, x2: W - m.der, y1: y(v), y2: y(v), class: "c3-rejilla" }, capaEjes);
      el("line", { x1: m.izq - 5, x2: m.izq, y1: y(v), y2: y(v), class: "c3-eje-linea" }, capaEjes);
      if (v % 1 === 0) texto(capaEjes, m.izq - 9, y(v) + 4, fmt(v, 1), { "text-anchor": "end" });
    }
    el("line", { x1: m.izq, x2: m.izq, y1: y(DOM.y0), y2: y(DOM.y1), class: "c3-eje-linea" }, capaEjes);
    el("line", { x1: m.izq, x2: W - m.der, y1: y(DOM.y0), y2: y(DOM.y0), class: "c3-eje-linea" }, capaEjes);
    texto(capaEjes, 12, (m.sup + H - m.inf) / 2, "Rendimiento (t/ha)", { class: "titulo", "text-anchor": "middle", transform: `rotate(-90 12 ${(m.sup + H - m.inf) / 2})` });
    texto(capaEjes, (m.izq + W - m.der) / 2, H - 14, "Las 59 parcelas, de la predicción más baja a la más alta", { class: "titulo", "text-anchor": "middle" });
    texto(capaEjes, m.izq + 10, m.sup - 8, "● predicción   │ baja hasta su P20", { class: "titulo" });

    // Punto de equilibrio con los supuestos de referencia (y el precio del paso, si lo cambia)
    equilibrioGrafico(paso.precio || REF.precio);
    capaEtiquetas.innerHTML = "";
  }

  // Semáforo: tres columnas, una por nivel de riesgo; el tamaño sigue a la superficie
  function acomodoRiesgo() {
    const { W, H } = tam;
    const ancho = W / 3;
    const sup = 92;
    capaEtiquetas.innerHTML = "";
    RIESGOS.forEach((r, c) => {
      const lista = parcelas.filter((p) => p.riesgo === r).sort((a, b) => b.ha - a.ha);
      const cols = Math.max(3, Math.round(Math.sqrt((lista.length * ancho) / (H - sup))));
      const celda = Math.min((ancho - 16) / cols, (H - sup - 10) / Math.ceil(lista.length / cols));
      lista.forEach((p, i) => {
        const cx = c * ancho + 8 + ((i % cols) + 0.5) * celda;
        const cy = sup + (Math.floor(i / cols) + 0.5) * celda;
        colocar(p, cx, cy, celda * 0.46 * (0.55 + 0.45 * Math.sqrt(p.ha / maxHa)));
      });
      const ha = suma(lista, (p) => p.ha);
      const xm = c * ancho + ancho / 2;
      texto(capaEtiquetas, xm, 30, W < 520 ? r : `Riesgo ${r.toLowerCase()}`, { class: "grande", "text-anchor": "middle", style: `font-size:${W < 520 ? 16 : 22}px` });
      texto(capaEtiquetas, xm, 52, `${lista.length} parcelas · ${fmt(ha, 0)} ha`, { class: "titulo", "text-anchor": "middle" });
      const rango = r === "Bajo" ? `caída de hasta ${fmt(U1 * 100, 0)} %` : r === "Medio" ? `${fmt(U1 * 100, 0)} a ${fmt(U2 * 100, 0)} %` : `más de ${fmt(U2 * 100, 0)} %`;
      texto(capaEtiquetas, xm, 70, rango, { "text-anchor": "middle" });
    });
  }

  // Municipios: una fila por municipio, cada parcela con el color de su riesgo
  function acomodoMunicipios() {
    const { W, H } = tam;
    const grupos = [...new Set(parcelas.map((p) => p.mun))]
      .map((mun) => ({ mun, lista: parcelas.filter((p) => p.mun === mun).sort((a, b) => RIESGOS.indexOf(a.riesgo) - RIESGOS.indexOf(b.riesgo) || b.ha - a.ha) }))
      .sort((a, b) => b.lista.length - a.lista.length);
    const izq = Math.min(170, W * 0.32);
    const util = W - izq - 10;
    let celda = 30;
    // celda más grande que quepa: filas totales × celda ≤ alto disponible
    for (celda = 40; celda > 12; celda -= 1) {
      const porFila = Math.floor(util / celda);
      const filas = suma(grupos, (g) => Math.ceil(g.lista.length / porFila));
      if (filas * celda + grupos.length * 10 <= H - 20) break;
    }
    const porFila = Math.floor(util / celda);
    capaEtiquetas.innerHTML = "";
    let y = 14;
    grupos.forEach(({ mun, lista }) => {
      const filas = Math.ceil(lista.length / porFila);
      lista.forEach((p, i) => {
        colocar(p, izq + ((i % porFila) + 0.5) * celda, y + (Math.floor(i / porFila) + 0.5) * celda, celda * 0.44 * (0.6 + 0.4 * Math.sqrt(p.ha / maxHa)));
      });
      const corto = mun.replace(" de Mariano Arista", "").replace(" de Hinojosa", "");
      texto(capaEtiquetas, izq - 12, y + celda / 2 + 1, corto, { class: "titulo", "text-anchor": "end" });
      const altos = lista.filter((p) => p.riesgo === "Alto").length;
      texto(capaEtiquetas, izq - 12, y + celda / 2 + 16, `${lista.length} · ${altos} de riesgo alto`, { "text-anchor": "end" });
      y += filas * celda + 10;
    });
  }

  const PASOS = {
    portada: { acomodo: acomodoMapa, color: "oro", capas: [capaContexto], sombra: true },
    fira: { acomodo: acomodoMapa, color: "oro", capas: [capaContexto], sombra: true },
    cuando: { acomodo: acomodoMapa, color: "oro", capas: [capaContexto], sombra: true },
    p20: { acomodo: acomodoGrafico, color: "oro", capas: [capaEjes, capaRangos] },
    equilibrio: { acomodo: acomodoGrafico, color: "oro", capas: [capaEjes, capaRangos, capaEquilibrio, capaEqTexto], cubre: true },
    // El precio baja al recorte propuesto en 2025: la línea sube y las que no alcanzan se vuelven rosas
    precio: { acomodo: acomodoGrafico, color: "oro", capas: [capaEjes, capaRangos, capaEquilibrio, capaEqTexto], cubre: true, precio: 4500 },
    riesgo: { acomodo: acomodoRiesgo, color: "riesgo", capas: [capaEtiquetas] },
    municipios: { acomodo: acomodoMunicipios, color: "riesgo", capas: [capaEtiquetas] },
  };
  const TODAS_CAPAS = [capaContexto, capaEjes, capaEquilibrio, capaRangos, capaEtiquetas, capaEqTexto];

  function aplicarPaso(nombre) {
    const paso = PASOS[nombre];
    if (!paso) return;
    escenario.dataset.paso = nombre;
    svg.dataset.color = paso.color;
    svg.dataset.sombra = paso.sombra ? "si" : "no";
    paso.acomodo(paso);
    TODAS_CAPAS.forEach((c) => c.classList.toggle("visible", paso.capas.includes(c)));
    // En los pasos del equilibrio, las parcelas que no pagan su crédito con ese precio se marcan en rosa
    const eq = equilibrioDe(paso.precio || REF.precio, REF.costo, REF.tasa);
    const noCubre = (id) => Boolean(paso.cubre) && porId.get(id).p20 < eq;
    rango.forEach((l, id) => l.classList.toggle("no-cubre", noCubre(id)));
    glifos.forEach((g, id) => g.classList.toggle("no-cubre", noCubre(id)));
    capaRangos.classList.toggle("cubre", Boolean(paso.cubre));
  }

  const articulos = $$(".c3-paso");
  function activarPaso(articulo) {
    const nombre = articulo.dataset.paso;
    if (nombre === pasoActual) return;
    pasoActual = nombre;
    articulos.forEach((a) => a.classList.toggle("activo", a === articulo));
    aplicarPaso(nombre);
    Mascota.decir(articulo);
  }
  const movil = () => window.innerWidth <= 900;
  let observarPasos = null;
  function vigilarPasos() {
    if (observarPasos) observarPasos.disconnect();
    observarPasos = new IntersectionObserver(
      (entradas) => {
        const visibles = entradas.filter((e) => e.isIntersecting);
        if (visibles.length) activarPaso(visibles[visibles.length - 1].target);
      },
      { rootMargin: movil() ? "-55% 0px -35% 0px" : "-45% 0px -45% 0px" }
    );
    articulos.forEach((a) => observarPasos.observe(a));
  }

  /* --- Simulador de crédito -------------------------------------------------- */

  const Simulador = (() => {
    const entrada = $("#c3-buscar");
    const ficha = $("#c3-ficha");
    const precio = $("#c3-precio");
    const costo = $("#c3-costo");
    const tasa = $("#c3-tasa");
    const presets = $$("[data-precio]");
    const presetsTasa = $$("[data-tasa]");
    const mostrados = {}; // últimos valores mostrados, para animar el cambio

    $("#c3-lista").innerHTML = parcelas
      .slice()
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((p) => `<option value="${p.id}">${p.mun} · ${fmt(p.ha, 1)} ha</option>`)
      .join("");

    // Minimapa: las 59, agrupadas por municipio
    const mini = $("#c3-minimapa");
    const minis = new Map();
    [...new Set(parcelas.map((p) => p.mun))].forEach((mun) => {
      const nombre = document.createElement("span");
      nombre.className = "c3-minimapa-nombre";
      nombre.textContent = mun;
      mini.appendChild(nombre);
      parcelas.filter((p) => p.mun === mun).sort((a, b) => a.id.localeCompare(b.id)).forEach((p) => {
        const s = el("svg", { viewBox: "-115 -115 230 230", class: claseRiesgo(p.riesgo), role: "button", "aria-label": `${p.id}, ${p.mun}, riesgo ${p.riesgo.toLowerCase()}`, tabindex: "0" }, mini);
        el("path", { d: p.d }, s);
        s.addEventListener("click", () => elegir(p.id));
        s.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), elegir(p.id)));
        s.addEventListener("pointermove", (e) => mostrarTip(e, tipParcela(p)));
        s.addEventListener("pointerleave", ocultarTip);
        minis.set(p.id, s);
      });
    });

    function animar(clave, nodo, valor, formato, ms = 550) {
      const desde = mostrados[clave] ?? valor;
      mostrados[clave] = valor;
      if (reducido() || desde === valor) return (nodo.textContent = formato(valor));
      const t0 = performance.now();
      const paso = (ahora) => {
        const k = Math.min(1, (ahora - t0) / ms);
        nodo.textContent = formato(desde + (valor - desde) * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(paso);
      };
      requestAnimationFrame(paso);
    }

    function dibujarRegla(p, f) {
      const caja = $("#c3-regla");
      const W = Math.max(280, caja.clientWidth || 480);
      const H = 112;
      caja.innerHTML = "";
      const s = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `Predicción ${fmt(p.est, 2)}, P20 ${fmt(p.p20, 2)} y punto de equilibrio ${fmt(f.equilibrio, 2)} t/ha` }, caja);
      const d0 = 1.5, d1 = 5.6;
      const x = (v) => 14 + ((Util.clamp(v, d0, d1) - d0) / (d1 - d0)) * (W - 28);
      const yEje = 60;
      el("rect", { x: x(d0), y: yEje - 14, width: x(f.equilibrio) - x(d0), height: 28, class: "perdida" }, s);
      el("rect", { x: x(p.p10), y: yEje - 7, width: x(p.p90) - x(p.p10), height: 14, rx: 7, class: "banda" }, s);
      el("line", { x1: x(d0), x2: x(d1), y1: yEje, y2: yEje, class: "eje" }, s);
      for (let v = 2; v <= 5.5; v += 0.5) {
        el("line", { x1: x(v), x2: x(v), y1: yEje, y2: yEje + (v % 1 ? 4 : 7), class: "eje" }, s);
        if (v % 1 === 0) texto(s, x(v), H - 4, fmt(v, 0), { "text-anchor": "middle" });
      }
      texto(s, x(d1), H - 4, "t/ha", { "text-anchor": "end" });
      el("line", { x1: x(f.equilibrio), x2: x(f.equilibrio), y1: 20, y2: yEje + 16, class: "equilibrio" }, s);
      const izqEq = x(f.equilibrio) > W * 0.55;
      texto(s, x(f.equilibrio) + (izqEq ? -6 : 6), 16, `equilibrio ${fmt(f.equilibrio, 2)}`, { class: "rosa", "text-anchor": izqEq ? "end" : "start" });
      el("line", { x1: x(p.p20), x2: x(p.p20), y1: yEje - 13, y2: yEje + 13, class: "p20" }, s);
      texto(s, x(p.p20), yEje + 28, `P20 ${fmt(p.p20, 2)}`, { class: "fuerte", "text-anchor": "middle" });
      el("circle", { cx: x(p.est), cy: yEje, r: 7, class: "punto" }, s);
      texto(s, x(p.est), yEje - 16, `predicción ${fmt(p.est, 2)}`, { class: "fuerte", "text-anchor": "middle" });
    }

    function idea(p, f) {
      if (f.cob < 1) return "Con estos supuestos conviene prestar menos que el costo total, o sumar un seguro agrícola o un contrato con precio pactado.";
      if (p.riesgo === "Bajo") return "Perfil para un crédito de avío con condiciones estándar.";
      if (p.riesgo === "Medio") return "Crédito de avío con una garantía que cubra parte del riesgo, como las que ofrece FIRA.";
      return "Crédito con garantía y seguro agrícola, o con acompañamiento técnico para el siguiente ciclo.";
    }

    function pintar() {
      const p = porId.get(estado.seleccion);
      const f = finanzas(p);
      entrada.value = p.id;
      $(".c3-ficha-id", ficha).textContent = p.id;
      $(".c3-ficha-meta", ficha).textContent = `${p.mun}, ${p.edo} · ${fmt(p.ha, 2)} ha`;
      const sello = $(".c3-sello", ficha);
      const nuevoSello = `Riesgo ${p.riesgo.toLowerCase()}`;
      if (sello.textContent !== nuevoSello) {
        sello.textContent = nuevoSello;
        sello.className = `c3-sello ${claseRiesgo(p.riesgo)}`;
        sello.style.animation = "none";
        void sello.offsetWidth;
        sello.style.animation = "";
      }
      animar("est", $(".c3-v-prod", ficha), p.est, (v) => `${fmt(v, 2)} t/ha`);
      $(".c3-v-prod-d", ficha).textContent = `${fmt(p.est * p.ha, 1)} t en sus ${fmt(p.ha, 1)} ha. Rango P10–P90: ${fmt(p.p10, 2)} a ${fmt(p.p90, 2)} t/ha.`;
      animar("p20", $(".c3-v-p20", ficha), p.p20, (v) => `${fmt(v, 2)} t/ha`);
      $(".c3-v-p20-d", ficha).textContent = `Rendimiento financiable (P20): en la validación, 8 de cada 10 parcelas alcanzaron el suyo. Caída posible de ${fmt(p.caida * 100, 0)} %.`;
      dibujarRegla(p, f);
      const tope = Math.max(f.deuda, f.ingresoP20);
      $(".c3-barra-dinero.costo em", ficha).style.setProperty("--w", `${(f.deuda / tope) * 100}%`);
      $(".c3-barra-dinero.ingreso em", ficha).style.setProperty("--w", `${(f.ingresoP20 / tope) * 100}%`);
      $(".c3-barra-dinero.ingreso", ficha).classList.toggle("no-alcanza", f.cob < 1);
      animar("costo", $(".c3-v-costo", ficha), f.deuda, pesos);
      animar("ingreso", $(".c3-v-ingreso", ficha), f.ingresoP20, pesos);
      $(".c3-v-desglose", ficha).textContent = estado.tasa > 0
        ? `Costo de producción ${pesos(f.costoTotal)} + intereses ${pesos(f.intereses)} (${porcentaje(estado.tasa)} % anual, ${PLAZO} meses).`
        : `Costo de producción ${pesos(f.costoTotal)}, sin intereses.`;
      animar("cob", $(".c3-v-cob", ficha), f.cob, (v) => `${fmt(v, 2)}×`);
      $(".c3-cobertura", ficha).classList.toggle("no-alcanza", f.cob < 1);
      $(".c3-v-texto", ficha).textContent =
        f.cob >= 1.5 ? `Aun con su P20, la cosecha paga ${fmt(f.cob, 2)} veces lo que se debe: sobran ${pesos(f.margen)}.`
        : f.cob >= 1 ? `Con su P20, la cosecha paga el crédito, con poco margen: ${pesos(f.margen)}.`
        : `Con su P20, la cosecha no alcanza para pagar el crédito: faltan ${pesos(-f.margen)}.`;
      $(".c3-idea", ficha).innerHTML = `<b>Idea de uso:</b> ${idea(p, f)}`;
      minis.forEach((s, id) => s.classList.toggle("elegida", id === p.id));
      glifos.forEach((g, id) => g.classList.toggle("marcada", estado.eligio && id === p.id));
    }

    function elegir(id) {
      if (!porId.has(id)) return;
      estado.seleccion = id;
      estado.eligio = true;
      pintar();
    }

    function supuestos() {
      estado.precio = Number(precio.value);
      estado.costo = Number(costo.value);
      estado.tasa = Number(tasa.value);
      $("#c3-precio-valor").textContent = `$${fmt(estado.precio, 0)} / t`;
      $("#c3-costo-valor").textContent = `$${fmt(estado.costo, 0)} / ha`;
      $("#c3-tasa-valor").textContent = `${porcentaje(estado.tasa)} %`;
      presets.forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.precio) === estado.precio)));
      presetsTasa.forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.tasa) === estado.tasa)));
      pintar();
      Cartera.actualizar();
    }

    entrada.addEventListener("change", () => {
      const id = entrada.value.trim().toUpperCase().replace(/^(\d+)$/, (n) => `AGC_${n.padStart(3, "0")}`);
      if (porId.has(id)) elegir(id);
      else entrada.value = estado.seleccion;
    });
    $("#c3-azar").addEventListener("click", () => {
      const otras = parcelas.filter((p) => p.id !== estado.seleccion);
      elegir(otras[Math.floor(Math.random() * otras.length)].id);
    });
    let pendiente = false;
    const alMover = () => {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(() => { pendiente = false; supuestos(); });
    };
    precio.addEventListener("input", alMover);
    costo.addEventListener("input", alMover);
    tasa.addEventListener("input", alMover);
    presets.forEach((b) => b.addEventListener("click", () => { precio.value = b.dataset.precio; supuestos(); }));
    presetsTasa.forEach((b) => b.addEventListener("click", () => { tasa.value = b.dataset.tasa; supuestos(); }));

    return { elegir, pintar, supuestos };
  })();

  /* --- La cartera ------------------------------------------------------------ */

  const Cartera = (() => {
    const tbody = $("#c3-tabla tbody");
    let orden = { clave: "caida", dir: 1 };
    let filtro = "todos";
    // Cada pieza se dibuja (y se anima) cuando llega a la pantalla
    const hecho = { cifras: false, tabla: false, riesgo: false, sensibilidad: false };

    function filas() {
      return parcelas.map((p) => ({ p, ...finanzas(p) }));
    }

    function cifras(animar) {
      const lista = filas();
      const valores = {
        ha: [suma(parcelas, (p) => p.ha), (v) => fmt(v, 1)],
        t: [suma(parcelas, (p) => p.p20 * p.ha), (v) => fmt(v, 0)],
        ingreso: [suma(lista, (f) => f.ingresoP20), millones],
        cubren: [lista.filter((f) => f.cob >= 1).length, (v) => `${fmt(v, 0)} de ${parcelas.length}`],
      };
      $$("[data-cartera]").forEach((n) => {
        const [v, formato] = valores[n.dataset.cartera];
        if (!animar || reducido()) return (n.textContent = formato(v));
        const t0 = performance.now();
        const paso = (ahora) => {
          const k = Math.min(1, (ahora - t0) / 1100);
          n.textContent = formato(v * (1 - Math.pow(1 - k, 3)));
          if (k < 1) requestAnimationFrame(paso);
        };
        requestAnimationFrame(paso);
      });
    }

    function tabla() {
      const lista = filas()
        .filter((f) => filtro === "todos" || f.p.riesgo === filtro)
        .sort((a, b) => {
          const va = orden.clave in a.p ? a.p[orden.clave] : a[orden.clave];
          const vb = orden.clave in b.p ? b.p[orden.clave] : b[orden.clave];
          return (typeof va === "string" ? va.localeCompare(vb) : va - vb) * orden.dir;
        });
      tbody.innerHTML = lista
        .map(({ p, ingresoP20, cob }) => `
          <tr data-id="${p.id}">
            <td><b>${p.id}</b></td>
            <td>${p.mun}</td>
            <td class="num">${fmt(p.ha, 1)}</td>
            <td class="num">${fmt(p.est, 2)}</td>
            <td class="num">${fmt(p.p20, 2)}</td>
            <td><span class="c3-chip ${claseRiesgo(p.riesgo)}">${p.riesgo}</span></td>
            <td class="num">${pesos(ingresoP20)}</td>
            <td class="num${cob < 1 ? " no-alcanza" : ""}">${fmt(cob, 2)}×</td>
          </tr>`)
        .join("");
      $$("#c3-tabla th").forEach((th) => {
        th.setAttribute("aria-sort", th.dataset.orden === orden.clave ? (orden.dir > 0 ? "ascending" : "descending") : "none");
      });
    }

    function riesgoHa(animar) {
      const caja = $("#c3-riesgo-ha");
      const W = Math.max(280, caja.clientWidth || 440);
      const filaH = 52, H = RIESGOS.length * filaH + 6;
      caja.innerHTML = "";
      const s = el("svg", { viewBox: `0 0 ${W} ${H}`, class: "c3-grafica", role: "img", "aria-label": "Hectáreas por nivel de riesgo" }, caja);
      const datosR = RIESGOS.map((r) => {
        const lista = parcelas.filter((p) => p.riesgo === r);
        return { r, n: lista.length, ha: suma(lista, (p) => p.ha) };
      });
      const tope = Math.max(...datosR.map((d) => d.ha));
      const x0 = 0, x1 = W - 120;
      datosR.forEach((d, i) => {
        const y = i * filaH;
        texto(s, 0, y + 14, `Riesgo ${d.r.toLowerCase()} · ${d.n} parcelas`, { class: "suave" });
        const rect = el("rect", { x: x0, y: y + 20, height: 20, width: animar && !reducido() ? 0 : ((d.ha / tope) * (x1 - x0)), rx: 4, class: `barra ${d.r.toLowerCase()}` }, s);
        texto(s, (d.ha / tope) * (x1 - x0) + 8, y + 35, `${fmt(d.ha, 1)} ha`, { "font-weight": 600 });
        if (animar && !reducido()) {
          rect.style.transitionDelay = `${i * 120}ms`;
          requestAnimationFrame(() => requestAnimationFrame(() => rect.setAttribute("width", (d.ha / tope) * (x1 - x0))));
        }
      });
    }

    // Cuántas parcelas pagan su crédito con su P20, según el precio (con el costo y la tasa elegidos)
    function sensibilidad(animar) {
      const caja = $("#c3-sensibilidad");
      const W = Math.max(300, caja.clientWidth || 560);
      const H = 280;
      const m = { izq: 44, der: 16, sup: 40, inf: 46 };
      caja.innerHTML = "";
      const s = el("svg", { viewBox: `0 0 ${W} ${H}`, class: "c3-grafica", role: "img", "aria-label": "Parcelas que cubren su costo según el precio de la cebada" }, caja);
      const p0 = 4000, p1 = 9000;
      const x = (v) => m.izq + ((v - p0) / (p1 - p0)) * (W - m.izq - m.der);
      const y = (n) => m.sup + (1 - n / parcelas.length) * (H - m.sup - m.inf);
      for (const n of [0, 20, 40, 59]) {
        el("line", { x1: m.izq, x2: W - m.der, y1: y(n), y2: y(n), class: "rejilla" }, s);
        texto(s, m.izq - 8, y(n) + 4, String(n), { "text-anchor": "end", class: "suave" });
      }
      for (let v = 4000; v <= 9000; v += 1000) {
        el("line", { x1: x(v), x2: x(v), y1: y(0), y2: y(0) + 5, class: "eje" }, s);
        texto(s, x(v), y(0) + 19, `$${fmt(v / 1000, 0)} mil`, { "text-anchor": "middle", class: "suave" });
      }
      el("line", { x1: m.izq, x2: W - m.der, y1: y(0), y2: y(0), class: "eje" }, s);
      el("line", { x1: m.izq, x2: m.izq, y1: y(0), y2: y(parcelas.length), class: "eje" }, s);
      texto(s, (m.izq + W - m.der) / 2, H - 6, "Precio de la cebada (pesos por tonelada)", { "text-anchor": "middle", class: "titulo-eje" });
      texto(s, m.izq, 14, W < 460 ? "parcelas que pagan su crédito (de 59)" : `parcelas que pagan su crédito (de 59) · $${fmt(estado.costo, 0)}/ha al ${porcentaje(estado.tasa)} %`, { class: "titulo-eje" });

      let d = "", area = "";
      for (let v = p0; v <= p1; v += 25) {
        const n = cubren(v, estado.costo).length;
        d += `${v === p0 ? "M" : "L"}${x(v).toFixed(1)},${y(n).toFixed(1)}`;
      }
      area = d + `L${x(p1)},${y(0)}L${x(p0)},${y(0)}Z`;
      el("path", { d: area, class: "escalon-area" }, s);
      const linea = el("path", { d, class: "escalon" }, s);
      if (animar && !reducido()) {
        const largo = linea.getTotalLength ? linea.getTotalLength() : 800;
        linea.style.strokeDasharray = largo;
        linea.style.strokeDashoffset = largo;
        linea.classList.add("dibujar");
      }
      // Precios de referencia: los que dan el mismo resultado comparten una etiqueta
      const grupos = [];
      PRECIOS.forEach((r) => {
        const n = cubren(r.v, estado.costo).length;
        el("line", { x1: x(r.v), x2: x(r.v), y1: y(n), y2: y(0), class: "marca" }, s);
        el("circle", { cx: x(r.v), cy: y(n), r: 4.5, class: "marca-punto" }, s);
        const ultimo = grupos[grupos.length - 1];
        if (ultimo && ultimo.n === n) ultimo.t.push(r.t);
        else grupos.push({ n, v: r.v, t: [r.t] });
      });
      if (W >= 520) {
        // Cada etiqueta va debajo de su punto y hacia la derecha: como la curva solo sube con el precio,
        // ahí nunca la cruza. Si choca con otra etiqueta, baja un renglón.
        const puestas = [];
        grupos.forEach((g) => {
          const etiqueta = `${listaNatural(g.t)}: ${g.n}`;
          const ancho = etiqueta.length * 6.2;
          const x0 = Math.min(x(g.v) + 8, W - m.der - ancho);
          let ty = y(g.n) + 20;
          while (puestas.some((b) => x0 < b.x1 + 6 && x0 + ancho > b.x0 - 6 && Math.abs(ty - b.y) < 14) && ty < y(0) - 8) ty += 15;
          ty = Math.min(ty, y(0) - 8);
          puestas.push({ x0, x1: x0 + ancho, y: ty });
          texto(s, x0, ty, etiqueta, { class: "suave", "font-size": 11 });
        });
      } else {
        // En pantallas angostas las etiquetas no caben dentro: van en una línea debajo
        const nota = document.createElement("p");
        nota.className = "c3-nota";
        nota.textContent = grupos.map((g) => `${listaNatural(g.t)}: ${g.n}`).join(" · ");
        caja.appendChild(nota);
      }
      const nAct = cubren(estado.precio, estado.costo).length;
      el("circle", { cx: x(estado.precio), cy: y(nAct), r: 7, class: "marca-punto actual" }, s);
    }

    function actualizar() {
      llenarVivas();
      if (hecho.cifras) cifras(false);
      if (hecho.tabla) tabla();
      if (hecho.sensibilidad) sensibilidad(false);
    }

    const DIBUJOS = {
      "c3-cifras": () => { hecho.cifras = true; cifras(true); },
      "c3-riesgo-ha": () => { hecho.riesgo = true; riesgoHa(true); },
      "c3-sensibilidad": () => { hecho.sensibilidad = true; sensibilidad(true); },
      "c3-tabla": () => { hecho.tabla = true; tabla(); },
    };
    const observar = new IntersectionObserver(
      (entradas, obs) => entradas.forEach((e) => {
        if (!e.isIntersecting) return;
        obs.unobserve(e.target);
        DIBUJOS[e.target.id]();
      }),
      { threshold: 0.25 }
    );
    Object.keys(DIBUJOS).forEach((id) => id !== "c3-tabla" && observar.observe(document.getElementById(id)));
    DIBUJOS["c3-tabla"](); // la tabla no se anima: se llena desde el principio

    function redibujar() {
      if (hecho.riesgo) riesgoHa(false);
      if (hecho.sensibilidad) sensibilidad(false);
    }

    $$("#c3-tabla th").forEach((th) =>
      th.addEventListener("click", () => {
        const clave = th.dataset.orden;
        orden = { clave, dir: orden.clave === clave ? -orden.dir : 1 };
        tabla();
      })
    );
    $$("[data-filtro]").forEach((b) =>
      b.addEventListener("click", () => {
        filtro = b.dataset.filtro;
        $$("[data-filtro]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        tabla();
      })
    );
    tbody.addEventListener("click", (e) => {
      const fila = e.target.closest("tr[data-id]");
      if (!fila) return;
      Simulador.elegir(fila.dataset.id);
      $("#c3-simulador").scrollIntoView({ behavior: reducido() ? "auto" : "smooth" });
    });

    $("#c3-descargar").addEventListener("click", () => {
      const cab = ["parcela", "municipio", "estado", "hectareas", "prediccion_t_ha", "p10_t_ha", "p20_t_ha", "p90_t_ha",
        "riesgo", "caida_relativa", "precio_supuesto_mxn_t", "costo_supuesto_mxn_ha", "tasa_anual_pct", "plazo_meses",
        "valor_cosecha_p20_mxn", "costo_total_mxn", "intereses_mxn", "deuda_total_mxn", "equilibrio_t_ha", "cobertura_credito"];
      const lineas = filas().map(({ p, ingresoP20, costoTotal, intereses, deuda, equilibrio, cob }) => [
        p.id, `"${p.mun}"`, `"${p.edo}"`, p.ha.toFixed(2), p.est.toFixed(4), p.p10.toFixed(4), p.p20.toFixed(4), p.p90.toFixed(4),
        p.riesgo, p.caida.toFixed(4), estado.precio, estado.costo, estado.tasa, PLAZO,
        ingresoP20.toFixed(0), costoTotal.toFixed(0), intereses.toFixed(0), deuda.toFixed(0), equilibrio.toFixed(3), cob.toFixed(3),
      ].join(","));
      const blob = new Blob(["﻿" + [cab.join(","), ...lineas].join("\n")], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "agrocebada_59_parcelas_credito.csv";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    });

    return { actualizar, redibujar };
  })();

  /* --- Revelado de secciones, progreso e índice ------------------------------ */

  $$(".c3-seccion .c3-ancho > *").forEach((n) => n.classList.add("c3-revelar"));
  const observarRevelar = new IntersectionObserver(
    (entradas, obs) => entradas.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("visible");
      obs.unobserve(e.target);
    }),
    { rootMargin: "0px 0px -12% 0px" }
  );
  $$(".c3-revelar").forEach((n) => observarRevelar.observe(n));

  const barra = $(".c3-progreso");
  const enlacesIndice = $$(".c3-indice a");
  const seccionesIndice = enlacesIndice.map((a) => document.getElementById(a.hash.slice(1)));
  function actualizarProgreso() {
    const total = document.documentElement.scrollHeight - window.innerHeight;
    barra.style.setProperty("--progreso", total > 0 ? (window.scrollY / total).toFixed(4) : 0);
    let actual = 0;
    seccionesIndice.forEach((s, i) => {
      if (s.getBoundingClientRect().top <= window.innerHeight * 0.4) actual = i;
    });
    enlacesIndice.forEach((a, i) => a.classList.toggle("actual", i === actual));
  }
  window.addEventListener("scroll", actualizarProgreso, { passive: true });

  // Enlaces internos con <base href>: desplazamiento suave dentro de la página
  $$('a[href*="#c3-"]').forEach((a) =>
    a.addEventListener("click", (e) => {
      const destino = document.getElementById(a.hash.slice(1));
      if (!destino) return;
      e.preventDefault();
      destino.scrollIntoView({ behavior: reducido() ? "auto" : "smooth" });
      history.replaceState(null, "", a.hash);
    })
  );

  /* --- Mascota: en zonas libres, más grande cuando habla --------------------- */

  const Mascota = (() => {
    const disponible = typeof THREE !== "undefined" && typeof crearEscenaMascota === "function";
    let escena = null;
    const dichos = new Set();
    let temporizador = null;
    let tPrevio = 0;
    const ancha = () => window.innerWidth >= 1000;
    const ESCALA = 0.3, ESCALA_HABLANDO = 0.44;
    let escalaActual = ESCALA, hablando = false, ultimoLugar = null;
    const tiempoLectura = (t) => Math.max(6000, t.length * 85);

    function iniciar() {
      if (!disponible || !ancha()) return;
      try {
        escena = crearEscenaMascota($("#mascot"));
      } catch (error) {
        escena = null;
        return;
      }
      escena.ajustar();
      escena.colocar(-0.9, -0.85, ESCALA);
      escena.brotar(performance.now() / 1000 + 0.3);
      window.addEventListener("resize", () => escena && escena.ajustar());
      requestAnimationFrame(cuadro);
    }

    const aNdc = ({ x, y }) => ({ x: (x / window.innerWidth) * 2 - 1, y: -((y / window.innerHeight) * 2 - 1) });

    function lugarLibre() {
      const historia = $("#c3-historia").getBoundingClientRect();
      if (historia.bottom > window.innerHeight * 0.6) {
        if (window.innerHeight < 720) return null;
        const t = $(".c3-paso.activo .c3-texto");
        if (!t) return null;
        const r = t.getBoundingClientRect();
        const y = window.innerHeight - 80;
        if (r.bottom > y - 170) return null;
        return { x: r.left + 30, y, zona: "historia" };
      }
      for (const id of ["c3-simulador", "c3-cartera", "c3-recorrido"]) {
        const etiqueta = document.querySelector(`#${id} .kicker`);
        const r = etiqueta.getBoundingClientRect();
        if (r.top > 130 && r.top < window.innerHeight * 0.85) {
          const ancho = document.querySelector(`#${id} .c3-ancho`).getBoundingClientRect();
          return { x: ancho.right - 60, y: r.top - 24, zona: id };
        }
      }
      return null;
    }

    function cuadro(ms) {
      const t = ms / 1000;
      const dt = Math.min(0.05, t - tPrevio);
      tPrevio = t;
      if (escena) {
        let lugar = ancha() ? lugarLibre() : null;
        const enHistoria = $("#c3-historia").getBoundingClientRect().bottom > window.innerHeight * 0.6;
        if (!lugar && hablando && enHistoria && ultimoLugar && ultimoLugar.zona === "historia") lugar = ultimoLugar;
        if (lugar) ultimoLugar = lugar;
        escena.estado.visible = Boolean(lugar);
        escalaActual += ((hablando ? ESCALA_HABLANDO : ESCALA) - escalaActual) * Math.min(1, dt * 5);
        if (lugar) {
          const n = aNdc(lugar);
          escena.mover(n.x, n.y, escalaActual);
        } else if (Narrador.escribiendo || $("#bubble").classList.contains("visible")) {
          Narrador.callar();
          hablando = false;
        }
        escena.actualizar(t, dt);
        escena.render();
      }
      requestAnimationFrame(cuadro);
    }

    function decir(elemento) {
      if (!escena || !elemento || !elemento.dataset.say) return;
      const clave = elemento.dataset.paso || elemento.id;
      if (dichos.has(clave)) return;
      dichos.add(clave);
      clearTimeout(temporizador);
      hablando = true;
      const dicho = elemento.dataset.say;
      Narrador.decir(dicho).then((completo) => {
        if (!completo) return;
        temporizador = setTimeout(() => {
          Narrador.callar();
          hablando = false;
        }, tiempoLectura(dicho));
      });
      escena.saltito();
    }

    return { iniciar, decir };
  })();

  const observarDialogos = new IntersectionObserver(
    (entradas) => entradas.forEach((e) => e.isIntersecting && Mascota.decir(e.target)),
    { threshold: 0.3 }
  );
  $$(".c3-seccion[data-say]").forEach((s) => observarDialogos.observe(s));

  /* --- Tamaño y arranque ----------------------------------------------------- */

  let temporizadorTamano;
  let anchoPrevio = window.innerWidth;
  window.addEventListener("resize", () => {
    clearTimeout(temporizadorTamano);
    temporizadorTamano = setTimeout(() => {
      medir();
      if (pasoActual) aplicarPaso(pasoActual);
      Simulador.pintar();
      if (Math.abs(window.innerWidth - anchoPrevio) < 30) return;
      const cruzaMovil = (anchoPrevio <= 900) !== movil();
      anchoPrevio = window.innerWidth;
      if (cruzaMovil) vigilarPasos();
      Cartera.redibujar();
    }, 250);
  });

  function arrancar() {
    const telon = $("#c3-telon");
    setTimeout(() => telon && telon.remove(), reducido() ? 0 : 1800);
    medir();
    Simulador.supuestos();
    // Las parcelas brotan en el mapa cuando se levanta el telón
    setTimeout(() => {
      if (!pasoActual) activarPaso($(".c3-portada"));
      vigilarPasos();
      Mascota.iniciar();
      if (location.hash && location.hash.startsWith("#c3-")) {
        const destino = document.getElementById(location.hash.slice(1));
        if (destino) destino.scrollIntoView();
      }
    }, reducido() ? 0 : 900);
    actualizarProgreso();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar);
  else arrancar();

  // Para depurar desde la consola
  window.Capitulo3 = { datos, parcelas, estado, Simulador, Cartera, aplicarPaso };
})();
