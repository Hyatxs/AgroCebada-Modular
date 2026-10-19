"use strict";

/*
 * Parte 4 del capítulo 1: «2025, un año atípico» (nuestro EDA). Va después de «Cómo crece»
 * (vistas/03-crecimiento), que cuenta las etapas; aquí se ven los datos.
 * Arriba, el mismo campo de «Cómo crece» (campo-cebada.js): uno solo, que se divide en dos cuando aparecen los
 * dos arranques (148 parcelas tempranas y 49 tardías). Abajo, la gráfica. Un cursor de fecha recorre los meses
 * en cada paso y mueve a la vez el campo y la gráfica:
 *   1. ciclo      el ciclo del reto (abril–octubre) contra la temporada que ve el satélite (junio–noviembre)
 *   2. lluvia     lluvia mensual de 2025 contra el promedio 2022–2024
 *   3. arranques  las 197 parcelas: dos momentos distintos para reverdecer
 *   4. rinde      ¿rindieron distinto?
 * Todo es dato real: curvas semanales de data.js (DATA.P[].n), nubosidad semanal (DATA.cli.cld), fenología y
 * clima de temporada-datos.js.
 */

(() => {
  const svg = document.getElementById("tm-svg");
  const T = window.TEMPORADA;
  if (!svg || !T || typeof DATA === "undefined") return;

  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs = {}, padre = null, texto = null) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (texto !== null) n.textContent = texto;
    if (padre) padre.appendChild(n);
    return n;
  };
  const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
  const reducido = () => typeof Paleta !== "undefined" && Paleta.movimientoReducido();
  const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const fecha = (dia) => {
    const d = new Date(2025, 0, Math.round(dia));
    return `${d.getDate()} de ${MESES_LARGOS[d.getMonth()]}`;
  };
  const inicioMes = (m) => Math.round((new Date(2025, m, 1) - new Date(2025, 0, 1)) / 864e5) + 1;
  const mediana = (v) => {
    const s = [...v].sort((a, b) => a - b);
    const i = (s.length - 1) / 2;
    return (s[Math.floor(i)] + s[Math.ceil(i)]) / 2;
  };
  const promedio = (v) => v.reduce((a, b) => a + b, 0) / v.length;

  /* --- Datos ---------------------------------------------------------------- */

  const SEM0 = 12; // semana w = días 7w+1 … 7w+7 del año
  const SEM1 = 49;
  const diaDeSemana = (w) => 7 * w + 4;
  const parcelas = DATA.P.filter((p) => T.parcelas[p.id]).map((p) => {
    const [inicio, pico, fin, temporadas] = T.parcelas[p.id];
    return { id: p.id, n: p.n, y: p.p ? null : p.y, inicio, pico, fin, temporadas, tardia: inicio >= 200 };
  });
  const grupos = {
    tempranas: parcelas.filter((p) => !p.tardia),
    tardias: parcelas.filter((p) => p.tardia),
  };
  const curvaMediana = (lista) => {
    const salida = [];
    for (let w = SEM0; w <= SEM1; w++) salida.push([diaDeSemana(w), mediana(lista.map((p) => p.n[w])) / 1000]);
    return salida;
  };
  const resumen = (lista) => ({
    n: lista.length,
    inicio: mediana(lista.map((p) => p.inicio)),
    pico: mediana(lista.map((p) => p.pico)),
    fin: mediana(lista.map((p) => p.fin)),
    rinde: promedio(lista.filter((p) => p.y !== null).map((p) => p.y)),
    conocidas: lista.filter((p) => p.y !== null).length,
    curva: curvaMediana(lista),
  });
  const R = { tempranas: resumen(grupos.tempranas), tardias: resumen(grupos.tardias), todas: resumen(parcelas) };

  // Lluvia de la región: 2025 contra el promedio 2022–2024 (abril a noviembre)
  const LL = T.region.lluvia;
  const lluvia = [3, 4, 5, 6, 7, 8, 9, 10].map((m) => ({
    m,
    y2025: LL["2025"][m],
    promedio: (LL["2022"][m] + LL["2023"][m] + LL["2024"][m]) / 3,
  }));

  /* --- Escalas -------------------------------------------------------------- */

  // En celular la gráfica es más angosta en unidades, para que los textos no queden diminutos
  const ANGOSTA = window.innerWidth < 700;
  const ANCHO = ANGOSTA ? 560 : 760;
  const ALTO = 440;
  const IZQ = ANGOSTA ? 40 : 46;
  const DER = ANCHO - 16;
  const ARRIBA = 34;
  const ABAJO_CURVA = 292;
  const BANDA_ARRIBA = 312;
  const BANDA_ABAJO = 392;
  const DIA0 = inicioMes(3); // 1 de abril
  const DIA1 = inicioMes(11) + 14; // 15 de diciembre
  const x = (dia) => IZQ + ((dia - DIA0) / (DIA1 - DIA0)) * (DER - IZQ);
  const y = (ndvi) => ABAJO_CURVA - ((ndvi - 0.1) / (0.85 - 0.1)) * (ABAJO_CURVA - ARRIBA);
  const yLluvia = (mm) => BANDA_ABAJO - (mm / 340) * (BANDA_ABAJO - BANDA_ARRIBA);
  const linea = (puntos) => puntos.map(([d, v], i) => `${i ? "L" : "M"}${x(d).toFixed(1)},${y(v).toFixed(1)}`).join("");

  svg.setAttribute("viewBox", `0 0 ${ANCHO} ${ALTO}`);

  /* --- Capas ---------------------------------------------------------------- */

  const capa = (nombre) => el("g", { class: `tm-capa tm-${nombre}` }, svg);

  // Bandas de calendario (paso 2)
  const cBandas = capa("bandas");
  el("rect", { x: x(DIA0), y: ARRIBA - 22, width: x(inicioMes(10)) - x(DIA0), height: ABAJO_CURVA - ARRIBA + 22, class: "tm-banda-reto" }, cBandas);
  el("text", { x: (x(DIA0) + x(inicioMes(10))) / 2, y: ARRIBA - 8, "text-anchor": "middle", class: "tm-texto tm-texto-reto" }, cBandas, "Ciclo del reto: abril–octubre");
  const bandaReal = el("rect", { x: x(R.todas.inicio), y: ARRIBA + 4, width: x(R.todas.fin) - x(R.todas.inicio), height: ABAJO_CURVA - ARRIBA - 4, class: "tm-banda-real" }, cBandas);
  el("text", { x: x(R.todas.fin) - 8, y: ARRIBA + 22, "text-anchor": "end", class: "tm-texto tm-texto-real" }, cBandas, `Lo que ve el satélite: ${fecha(R.todas.inicio).replace(" de ", " ")} – ${fecha(R.todas.fin).replace(" de ", " ")}`);

  // Ejes
  const cEjes = capa("ejes");
  for (let m = 3; m <= 11; m++) {
    const d = inicioMes(m);
    el("line", { x1: x(d), x2: x(d), y1: ARRIBA, y2: BANDA_ABAJO, class: "tm-reja" }, cEjes);
    el("text", { x: x(d + 15), y: ALTO - 24, "text-anchor": "middle", class: "tm-mes" }, cEjes, MESES[m]);
  }
  [0.2, 0.4, 0.6, 0.8].forEach((v) => {
    el("line", { x1: IZQ, x2: DER, y1: y(v), y2: y(v), class: "tm-reja tm-reja-h" }, cEjes);
    el("text", { x: IZQ - 6, y: y(v) + 4, "text-anchor": "end", class: "tm-num" }, cEjes, Util.fmt(v, 1));
  });
  el("line", { x1: IZQ, x2: DER, y1: ABAJO_CURVA, y2: ABAJO_CURVA, class: "tm-eje" }, cEjes);
  el("text", { x: IZQ, y: ARRIBA - 12, class: "tm-eje-titulo" }, cEjes, "Verdor (NDVI)");

  // Las 197 curvas, tenues (pasos 1 y 4)
  const cTodas = capa("todas");
  const finas = parcelas.map((p) => {
    const pts = [];
    for (let w = SEM0; w <= SEM1; w++) pts.push([diaDeSemana(w), p.n[w] / 1000]);
    return el("path", { d: linea(pts), class: `tm-fina ${p.tardia ? "tardia" : "temprana"}` }, cTodas);
  });

  // Curvas medianas
  const cCurvas = capa("curvas");
  const curvaPrincipal = el("path", { d: linea(R.tempranas.curva), class: "tm-curva temprana" }, cCurvas);
  const curvaTardia = el("path", { d: linea(R.tardias.curva), class: "tm-curva tardia" }, cCurvas);
  const largoPrincipal = curvaPrincipal.getTotalLength ? curvaPrincipal.getTotalLength() : 1000;

  // Fases sobre la curva principal (paso 1)
  const cFases = capa("fases");
  const valorEn = (curva, dia) => {
    for (let i = 1; i < curva.length; i++) {
      if (curva[i][0] >= dia) {
        const [d0, v0] = curva[i - 1];
        const [d1, v1] = curva[i];
        return v0 + ((v1 - v0) * (dia - d0)) / (d1 - d0);
      }
    }
    return curva[curva.length - 1][1];
  };
  const FASES = [
    { dia: R.tempranas.inicio, nombre: "Arranca", ancla: "start", dy: 30 },
    { dia: R.tempranas.pico, nombre: "Punto más alto", ancla: "middle", dy: -14 },
    { dia: R.tempranas.fin, nombre: "Se apaga", ancla: "end", dy: 30 },
  ].map((f) => {
    const g = el("g", { class: "tm-fase" }, cFases);
    const v = valorEn(R.tempranas.curva, f.dia);
    el("line", { x1: x(f.dia), x2: x(f.dia), y1: y(v), y2: ABAJO_CURVA, class: "tm-fase-linea" }, g);
    el("circle", { cx: x(f.dia), cy: y(v), r: 5.5, class: "tm-fase-punto" }, g);
    const t = el("text", { x: x(f.dia) + (f.ancla === "start" ? -4 : f.ancla === "end" ? 4 : 0), y: y(v) + f.dy, "text-anchor": f.ancla, class: "tm-fase-texto" }, g);
    el("tspan", { x: t.getAttribute("x"), class: "tm-fase-nombre" }, t, f.nombre);
    el("tspan", { x: t.getAttribute("x"), dy: "1.2em", class: "tm-fase-fecha" }, t, fecha(f.dia));
    return g;
  });

  // Lluvia (paso 3)
  const cLluvia = capa("lluvia");
  el("text", { x: IZQ, y: BANDA_ARRIBA - 4, class: "tm-eje-titulo" }, cLluvia, ANGOSTA ? "Lluvia por mes (mm)" : "Lluvia por mes (mm), promedio de la región del reto");
  const anchoBarra = (x(inicioMes(5)) - x(inicioMes(4))) * 0.34;
  const barras = lluvia.map((l) => {
    const centro = x(inicioMes(l.m) + 15);
    const g = el("g", { class: "tm-barra" }, cLluvia);
    el("rect", { x: centro - anchoBarra - 1, y: yLluvia(l.promedio), width: anchoBarra, height: BANDA_ABAJO - yLluvia(l.promedio), class: "tm-barra-prom" }, g);
    const r25 = el("rect", { x: centro + 1, y: yLluvia(l.y2025), width: anchoBarra, height: BANDA_ABAJO - yLluvia(l.y2025), class: "tm-barra-2025" }, g);
    if (l.m === 4 || l.m === 5) {
      el("text", { x: centro + 1 + anchoBarra / 2, y: yLluvia(l.y2025) - 4, "text-anchor": "middle", class: "tm-num tm-num-fuerte" }, g, Math.round(l.y2025));
      el("text", { x: centro - 1 - anchoBarra / 2, y: yLluvia(l.promedio) - 4, "text-anchor": "middle", class: "tm-num" }, g, Math.round(l.promedio));
    }
    return { g, r25 };
  });
  const leyendaLluvia = el("g", { class: "tm-leyenda" }, cLluvia);
  el("rect", { x: DER - 236, y: BANDA_ARRIBA - 14, width: 11, height: 11, class: "tm-barra-2025" }, leyendaLluvia);
  el("text", { x: DER - 220, y: BANDA_ARRIBA - 4, class: "tm-num" }, leyendaLluvia, "2025");
  el("rect", { x: DER - 172, y: BANDA_ARRIBA - 14, width: 11, height: 11, class: "tm-barra-prom" }, leyendaLluvia);
  el("text", { x: DER - 156, y: BANDA_ARRIBA - 4, class: "tm-num" }, leyendaLluvia, "promedio 2022–2024");

  // Inicio del verdor de cada parcela (paso 4): un punto por parcela, apilados por semana
  const cInicios = capa("inicios");
  el("text", { x: IZQ, y: BANDA_ARRIBA - 4, class: "tm-eje-titulo" }, cInicios, "Cuándo empezó a reverdecer cada parcela");
  const pilas = {};
  [...parcelas].sort((a, b) => a.inicio - b.inicio).forEach((p) => {
    const sem = Math.floor((p.inicio - 1) / 7);
    pilas[sem] = (pilas[sem] || 0) + 1;
    const fila = pilas[sem] - 1;
    const col = Math.floor(fila / 12);
    el("circle", {
      cx: x(diaDeSemana(sem)) + (col - 0.5) * 5.5,
      cy: BANDA_ABAJO - 3 - (fila % 12) * 6.2,
      r: 2.5,
      class: `tm-inicio ${p.tardia ? "tardia" : "temprana"}`,
    }, cInicios);
  });

  // Etiquetas de los dos grupos (paso 4)
  const cGrupos = capa("grupos");
  const etiquetaGrupo = (grupo, clase, dia, dy) => {
    const v = valorEn(grupo.curva, dia);
    const t = el("text", { x: x(dia), y: y(v) + dy, "text-anchor": "middle", class: `tm-grupo ${clase}` }, cGrupos);
    el("tspan", { x: x(dia), class: "tm-grupo-n" }, t, `${grupo.n} parcelas`);
    el("tspan", { x: x(dia), dy: "1.2em", class: "tm-grupo-f" }, t, `arrancan ~${fecha(grupo.inicio).replace(" de ", " ")}`);
  };
  etiquetaGrupo(R.tempranas, "temprana", R.tempranas.pico - 24, -34);
  etiquetaGrupo(R.tardias, "tardia", R.tardias.pico + 28, -22);

  // Rendimiento por grupo (paso 5)
  const cRinde = capa("rinde");
  const tarjeta = el("g", { transform: `translate(${DER - 300} ${BANDA_ARRIBA - 18})` }, cRinde);
  el("rect", { x: 0, y: 0, width: 300, height: 98, rx: 14, class: "tm-tarjeta" }, tarjeta);
  el("text", { x: 16, y: 24, class: "tm-eje-titulo" }, tarjeta, "Rendimiento promedio (parcelas conocidas)");
  const maxRinde = 5;
  [["tempranas", "temprana", 46], ["tardias", "tardia", 76]].forEach(([k, clase, yy]) => {
    const g = R[k];
    el("text", { x: 16, y: yy + 4, class: "tm-num" }, tarjeta, k === "tempranas" ? "Tempranas" : "Tardías");
    el("rect", { x: 92, y: yy - 8, width: 150, height: 14, rx: 7, class: "tm-riel" }, tarjeta);
    el("rect", { x: 92, y: yy - 8, width: (150 * g.rinde) / maxRinde, height: 14, rx: 7, class: `tm-relleno ${clase}` }, tarjeta);
    el("text", { x: 250, y: yy + 4, class: "tm-num tm-num-fuerte" }, tarjeta, `${Util.fmt(g.rinde, 2)} t/ha`);
  });

  // Cursor de fecha (todos los pasos): se mueve con el campo
  const cCursor = capa("cursor");
  const cursorLinea = el("line", { x1: 0, x2: 0, y1: ARRIBA - 4, y2: BANDA_ABAJO, class: "tm-cursor" }, cCursor);
  const cursorTexto = el("text", { x: 0, y: BANDA_ABAJO + 13, "text-anchor": "middle", class: "tm-cursor-texto" }, cCursor, "");

  /* --- Textos que dependen de los datos ------------------------------------- */

  const poner = (sel, texto) => document.querySelectorAll(`[data-tm="${sel}"]`).forEach((n) => (n.textContent = texto));
  poner("inicio", fecha(R.tempranas.inicio));
  poner("pico", fecha(R.tempranas.pico));
  poner("fin", fecha(R.tempranas.fin));
  poner("inicio-todas", fecha(R.todas.inicio));
  poner("fin-todas", fecha(R.todas.fin));
  poner("n-tempranas", R.tempranas.n);
  poner("n-tardias", R.tardias.n);
  poner("inicio-tardias", fecha(R.tardias.inicio));
  poner("pico-tardias", fecha(R.tardias.pico));
  poner("rinde-tempranas", Util.fmt(R.tempranas.rinde, 2));
  poner("rinde-tardias", Util.fmt(R.tardias.rinde, 2));
  const mayoJunio = lluvia.filter((l) => l.m === 4 || l.m === 5);
  poner("lluvia-mj-2025", Math.round(mayoJunio.reduce((s, l) => s + l.y2025, 0)));
  poner("lluvia-mj-prom", Math.round(mayoJunio.reduce((s, l) => s + l.promedio, 0)));
  const C = T.clima_parcelas;
  poner("lluvia-previa", Math.round(C.lluvia_previa_anomalia_mediana));
  poner("lluvia-previa-pct", Math.round(C.lluvia_previa_mas * 100));
  poner("tmax-previa", Util.fmt(Math.abs(C.tmax_previa_anomalia_mediana), 1));
  poner("verdor-mayor", Math.round(T.historia.verdor_mayor * 10));
  poner("desfase-centro", Math.round(T.historia.desfase_centro_mediana));

  /* --- Los campos (campo-cebada.js) --------------------------------------- */

  const cajaCampos = document.getElementById("tm-campos");
  const hayCampos = cajaCampos && typeof CampoCebada !== "undefined";
  const campoA = hayCampos ? CampoCebada.crear(document.getElementById("tm-campo-a"), { semilla: 31, horizonte: 0.38, espacio: 1.3 }) : null;
  const campoB = hayCampos ? CampoCebada.crear(document.getElementById("tm-campo-b"), { semilla: 57, horizonte: 0.38, espacio: 1.3 }) : null;
  const fenDe = (g) => ({ inicio: g.inicio, pico: g.pico, fin: g.fin });
  const siembraTardia = hayCampos ? CampoCebada.etapas(fenDe(R.tardias))[0].desde : 0;
  const nubesEn = (dia) => {
    const c = DATA.cli.cld;
    const w = limitar((dia - 4) / 7, 0, 50.999);
    const i = Math.floor(w);
    return (c[i] + (c[i + 1] - c[i]) * (w - i)) / 100;
  };
  const mmEn = (dia) => LL["2025"][new Date(2025, 0, Math.round(dia)).getMonth()];

  function estadoCampo(g, dia, t) {
    const base = CampoCebada.estado(dia, fenDe(g));
    const ndvi = valorEn(g.curva, dia);
    let maleza = 0;
    if (g === R.tardias) {
      // El verdor corto de junio en las tardías, antes de su siembra; luego se apaga
      const cubre = limitar((ndvi - 0.24) / 0.3, 0, 1);
      maleza = dia < siembraTardia ? cubre : cubre * limitar(1 - (dia - siembraTardia) / 12, 0, 1);
    }
    const nubes = limitar(nubesEn(dia), 0.05, 0.95);
    const temporal = limitar(mmEn(dia) / 230, 0, 1);
    return {
      ...base,
      verde: limitar((ndvi - 0.2) / 0.52, 0, 1),
      maleza,
      lluvia: temporal * limitar((nubes - 0.3) / 0.35, 0, 1),
      nubes: limitar(nubes * 0.7 + temporal * 0.35, 0, 1),
      humedad: limitar(0.15 + mmEn(dia) / 230, 0.15, 0.95),
      otono: limitar((dia - 262) / 40, 0, 1),
      t,
    };
  }

  const etiquetaA = document.getElementById("tm-campo-a-txt");
  const etiquetaB = document.getElementById("tm-campo-b-txt");
  const rindeA = document.getElementById("tm-campo-a-rinde");
  const rindeB = document.getElementById("tm-campo-b-rinde");
  const fechaCampos = document.getElementById("tm-campos-fecha");
  if (etiquetaB) etiquetaB.innerHTML = `<b>${R.tardias.n} parcelas</b> arrancan ~${fecha(R.tardias.inicio).replace(" de ", " ")}`;
  if (rindeA) rindeA.textContent = `${Util.fmt(R.tempranas.rinde, 2)} t/ha`;
  if (rindeB) rindeB.textContent = `${Util.fmt(R.tardias.rinde, 2)} t/ha`;

  /* --- Pasos ---------------------------------------------------------------- */

  const CAPAS_POR_PASO = {
    ciclo: ["ejes", "curvas", "bandas", "todas", "fases", "cursor"],
    lluvia: ["ejes", "curvas", "lluvia", "cursor"],
    arranques: ["ejes", "curvas", "curvas-tardia", "todas", "inicios", "grupos", "colores", "cursor"],
    rinde: ["ejes", "curvas", "curvas-tardia", "grupos", "rinde", "colores", "cursor"],
  };
  const TITULOS = {
    ciclo: "El calendario del reto y el que ve el satélite",
    lluvia: "2025 llovió antes y más",
    arranques: "197 parcelas, dos momentos para reverdecer",
    rinde: "Arrancar tarde no rindió menos",
  };
  // Cada paso recorre unos meses; con «Reducir movimiento» se queda en una fecha fija
  const BARRIDOS = {
    ciclo: { desde: DIA0, hasta: inicioMes(11) + 1, seg: 11, quieto: inicioMes(6) + 20 },
    lluvia: { desde: inicioMes(4), hasta: inicioMes(6) + 30, seg: 8, quieto: inicioMes(5) + 12 },
    arranques: { desde: inicioMes(5) + 10, hasta: inicioMes(9) + 25, seg: 11, quieto: inicioMes(7) + 18 },
    rinde: { desde: inicioMes(9) + 1, hasta: inicioMes(11) + 6, seg: 8, quieto: inicioMes(11) + 6 },
  };
  const titulo = document.getElementById("tm-titulo");
  let pasoActual = null;
  const reloj = { dia: DIA0, desde: DIA0, hasta: DIA0, t0: 0, seg: 1, visible: false, t: 0, previo: performance.now() };

  function barrer(paso) {
    const b = BARRIDOS[paso];
    if (reducido()) {
      reloj.dia = reloj.desde = reloj.hasta = b.quieto;
    } else {
      reloj.desde = b.desde;
      reloj.hasta = b.hasta;
      reloj.seg = b.seg;
      reloj.t0 = performance.now();
      reloj.dia = b.desde;
    }
  }

  function irA(paso) {
    if (paso === pasoActual || !CAPAS_POR_PASO[paso]) return;
    pasoActual = paso;
    const visibles = new Set(CAPAS_POR_PASO[paso]);
    svg.dataset.paso = paso;
    svg.querySelectorAll(".tm-capa").forEach((g) => g.classList.toggle("visible", visibles.has(g.classList[1].slice(3))));
    curvaPrincipal.classList.add("visible");
    curvaTardia.classList.toggle("visible", visibles.has("curvas-tardia"));
    cTodas.classList.toggle("en-color", visibles.has("colores"));
    if (titulo) {
      titulo.textContent = TITULOS[paso];
      titulo.classList.remove("cambio");
      void titulo.offsetWidth; // reinicia la animación del título
      titulo.classList.add("cambio");
    }
    svg.setAttribute("aria-label", TITULOS[paso]);
    if (cajaCampos) {
      const dos = paso === "arranques" || paso === "rinde";
      cajaCampos.dataset.dos = dos ? "1" : "0";
      cajaCampos.dataset.paso = paso;
      if (etiquetaA) {
        etiquetaA.innerHTML = dos
          ? `<b>${R.tempranas.n} parcelas</b> arrancan ~${fecha(R.tempranas.inicio).replace(" de ", " ")}`
          : `<b>Una parcela típica</b> de las ${R.tempranas.n} que reverdecieron primero`;
      }
    }
    if (paso === "lluvia" && !reducido()) barras.forEach((b, i) => (b.g.style.transitionDelay = `${0.06 * i}s`));
    curvaPrincipal.style.strokeDasharray = `${largoPrincipal}`;
    barrer(paso);
  }

  function pintar() {
    const d = reloj.dia;
    // Gráfica: cursor, curva que se dibuja en el primer paso y fechas clave
    const cx = x(limitar(d, DIA0, DIA1)).toFixed(1);
    cursorLinea.setAttribute("x1", cx);
    cursorLinea.setAttribute("x2", cx);
    cursorTexto.setAttribute("x", cx);
    cursorTexto.textContent = fecha(d);
    const revelar = pasoActual === "ciclo" ? limitar((d - DIA0) / (DIA1 - DIA0), 0, 1) : 1;
    curvaPrincipal.style.strokeDashoffset = `${(largoPrincipal * (1 - revelar)).toFixed(1)}`;
    if (pasoActual === "ciclo") FASES.forEach((f, i) => f.classList.toggle("visible", d >= [R.tempranas.inicio, R.tempranas.pico, R.tempranas.fin][i]));
    else FASES.forEach((f) => f.classList.add("visible"));

    // Campos
    if (!hayCampos) return;
    if (fechaCampos) fechaCampos.textContent = fecha(d);
    const t = reducido() ? 2 : reloj.t;
    campoA.ajustar();
    campoA.dibujar(estadoCampo(R.tempranas, d, t));
    if (cajaCampos.dataset.dos === "1") {
      campoB.ajustar();
      campoB.dibujar(estadoCampo(R.tardias, d, t + 1.3));
    }
    const listo = pasoActual === "rinde";
    cajaCampos.classList.toggle("cosecha-a", listo && d >= R.tempranas.fin + 2);
    cajaCampos.classList.toggle("cosecha-b", listo && d >= R.tardias.fin + 2);
  }

  function cuadro(ahora) {
    const dt = Math.min(0.06, (ahora - reloj.previo) / 1000);
    reloj.previo = ahora;
    if (reloj.visible && pasoActual) {
      if (!reducido()) {
        const k = limitar((ahora - reloj.t0) / (reloj.seg * 1000), 0, 1);
        reloj.dia = reloj.desde + (reloj.hasta - reloj.desde) * (1 - Math.pow(1 - k, 1.4));
        reloj.t += dt;
      }
      pintar();
    }
    requestAnimationFrame(cuadro);
  }

  // El paso activo es el que cruza la mitad de la pantalla
  const pasos = [...document.querySelectorAll(".tm-paso")];
  const observador = new IntersectionObserver(
    (entradas) => {
      entradas.forEach((e) => {
        e.target.classList.toggle("activo", e.isIntersecting);
        if (e.isIntersecting) irA(e.target.dataset.paso);
      });
    },
    { rootMargin: "-45% 0px -45% 0px" }
  );
  pasos.forEach((p) => observador.observe(p));
  irA("ciclo");

  // Solo se anima mientras la sección se ve; al entrar por primera vez, el primer paso arranca de nuevo
  const seccion = document.getElementById("temporada");
  let vista = false;
  if (seccion) {
    new IntersectionObserver((e) => {
      reloj.visible = e[0].isIntersecting;
      if (reloj.visible && !vista) {
        vista = true;
        barrer(pasoActual);
      }
    }, { threshold: 0.05 }).observe(seccion);
  }
  pintar();
  requestAnimationFrame(cuadro);
})();
