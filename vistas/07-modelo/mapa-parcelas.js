"use strict";

/*
 * Mapa de las 197 parcelas reales (polígonos del shapefile, EPSG:6372 en km).
 * SVG puro: el zoom anima el viewBox, así que las formas se ven nítidas a
 * cualquier escala y los contornos conservan su grosor (non-scaling-stroke).
 *
 * Modos de color:
 *   categoria    conocidas (verde) y por predecir (doradas con rayado)
 *   municipio    cada parcela con el rendimiento medio de su municipio
 *   rendimiento  conocidas: rendimiento real · por predecir: predicción
 */

const SVG_NS = "http://www.w3.org/2000/svg";

function crearElementoSvg(nombre, atributos = {}, padre = null) {
  const el = document.createElementNS(SVG_NS, nombre);
  for (const [clave, valor] of Object.entries(atributos)) el.setAttribute(clave, valor);
  if (padre) padre.appendChild(el);
  return el;
}

/** Rampa secuencial de rendimiento: del fondo (bajo) al verde profundo (alto). */
function colorRendimiento(valor, paleta) {
  const pal = paleta || Paleta.actual;
  const t = Util.clamp((valor - 2.0) / (5.6 - 2.0), 0, 1);
  const oscuro = document.documentElement.dataset.theme === "dark";
  const claro = oscuro ? "#3a4436" : "#dde2cf";
  const intenso = oscuro ? "#cfe8c4" : "#2f4f2a";
  // Mezcla en tres tramos para que el medio conserve el verde de la paleta
  return t < 0.5 ? mezclarColor(claro, pal.green, t / 0.5) : mezclarColor(pal.green, intenso, (t - 0.5) / 0.5);
}

function mezclarColor(a, b, t) {
  const h = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const [ca, cb] = [h(a), h(b)];
  return "#" + ca.map((v, i) => Math.round(v + (cb[i] - v) * t).toString(16).padStart(2, "0")).join("");
}

function crearMapaParcelas(svg, datos, opciones = {}) {
  const parcelas = datos.parcelas;
  const municipios = new Map(datos.municipios.map((m) => [m.nombre, m]));
  const margen = 1.2;

  // Extensión total (km locales)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of parcelas) {
    for (const anillo of p.poly) {
      for (const [x, y] of anillo) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }
  }
  const total = { x: minX - margen, y: minY - margen, w: maxX - minX + 2 * margen, h: maxY - minY + 2 * margen };
  let vista = { ...total };
  let animacionVista = null;

  svg.setAttribute("viewBox", `${total.x} ${total.y} ${total.w} ${total.h}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.classList.add("c2-mapa");

  const defs = crearElementoSvg("defs", {}, svg);
  const idRayado = `rayado-${Math.random().toString(36).slice(2, 7)}`;
  const patron = crearElementoSvg("pattern", {
    id: idRayado, patternUnits: "userSpaceOnUse", width: 0.09, height: 0.09, patternTransform: "rotate(45)",
  }, defs);
  crearElementoSvg("rect", { width: 0.09, height: 0.09, class: "c2-rayado-fondo" }, patron);
  crearElementoSvg("rect", { width: 0.035, height: 0.09, class: "c2-rayado-linea" }, patron);

  const capaAnillos = crearElementoSvg("g", { class: "c2-anillos" }, svg);
  const capaEnlaces = crearElementoSvg("g", { class: "c2-enlaces" }, svg);
  const capaParcelas = crearElementoSvg("g", { class: "c2-parcelas" }, svg);
  const capaEtiquetas = crearElementoSvg("g", { class: "c2-etiquetas" }, svg);
  const capaMarcas = crearElementoSvg("g", { class: "c2-marcas" }, svg);

  const nodos = new Map();
  for (const p of parcelas) {
    const d = p.poly
      .map((anillo) => "M" + anillo.map(([x, y]) => `${x},${y}`).join("L") + "Z")
      .join("");
    const g = crearElementoSvg("g", { class: "c2-parcela" + (p.pred ? " por-predecir" : " conocida"), "data-id": p.id }, capaParcelas);
    const forma = crearElementoSvg("path", { d, "vector-effect": "non-scaling-stroke" }, g);
    const rayas = p.pred ? crearElementoSvg("path", { d, fill: `url(#${idRayado})`, class: "c2-rayas" }, g) : null;
    const titulo = crearElementoSvg("title", {}, g);
    titulo.textContent = p.pred
      ? `${p.id} · ${p.mun} · por predecir`
      : `${p.id} · ${p.mun} · ${Util.fmt(p.y_obs, 2)} t/ha`;
    nodos.set(p.id, { g, forma, rayas, parcela: p });
  }

  // Etiquetas de municipio (con más de 2 parcelas conocidas)
  const etiquetas = [];
  for (const m of datos.municipios) {
    if (m.n_entren < 3) continue;
    const g = crearElementoSvg("g", { class: "c2-etiqueta", transform: `translate(${m.cx},${m.cy})` }, capaEtiquetas);
    const texto = crearElementoSvg("text", { y: -1.6, "text-anchor": "middle" }, g);
    texto.textContent = m.nombre;
    const valor = crearElementoSvg("text", { y: -0.55, "text-anchor": "middle", class: "c2-etiqueta-valor" }, g);
    valor.textContent = `${Util.fmt(m.media, 1)} t/ha`;
    etiquetas.push({ g, m });
  }

  // Escala gráfica
  const barraEscala = crearElementoSvg("g", { class: "c2-escala", "aria-hidden": "true" }, svg);
  const lineaEscala = crearElementoSvg("line", { "vector-effect": "non-scaling-stroke" }, barraEscala);
  const textoEscala = crearElementoSvg("text", {}, barraEscala);

  let modo = "categoria";
  const valorPintado = new Map(); // id -> rendimiento mostrado en modo rendimiento

  function colorDe(p) {
    if (modo === "municipio") return colorRendimiento(municipios.get(p.mun).media);
    if (modo === "rendimiento") {
      const v = p.pred ? valorPintado.get(p.id) : p.y_obs;
      return v == null ? null : colorRendimiento(v);
    }
    return null;
  }

  function pintar() {
    for (const { g, forma, parcela } of nodos.values()) {
      const c = colorDe(parcela);
      if (c) {
        forma.style.fill = c;
        forma.style.stroke = c;
      } else {
        forma.style.fill = "";
        forma.style.stroke = "";
      }
      g.classList.toggle("pintada", Boolean(c));
    }
    svg.dataset.modo = modo;
  }

  function actualizarEscala() {
    const ancho = svg.clientWidth || 600;
    const kmPorPx = vista.w / ancho;
    const candidatos = [0.1, 0.25, 0.5, 1, 2, 5, 10];
    const km = candidatos.find((c) => c / kmPorPx > 70) || 10;
    const x = vista.x + vista.w - km - 14 * kmPorPx;
    const y = vista.y + vista.h - 16 * kmPorPx;
    lineaEscala.setAttribute("x1", x);
    lineaEscala.setAttribute("x2", x + km);
    lineaEscala.setAttribute("y1", y);
    lineaEscala.setAttribute("y2", y);
    textoEscala.setAttribute("x", x + km / 2);
    textoEscala.setAttribute("y", y - 6 * kmPorPx);
    textoEscala.setAttribute("font-size", 12 * kmPorPx);
    textoEscala.setAttribute("text-anchor", "middle");
    textoEscala.textContent = km < 1 ? `${km * 1000} m` : `${km} km`;

    // Textos del mapa con tamaño constante en pantalla
    svg.style.setProperty("--km-px", kmPorPx);
    for (const { g, m } of etiquetas) {
      g.setAttribute("transform", `translate(${m.cx},${m.cy}) scale(${kmPorPx * 20})`);
    }
    capaMarcas.querySelectorAll("[data-escala]").forEach((el) => {
      el.setAttribute("transform", `translate(${el.dataset.x},${el.dataset.y}) scale(${kmPorPx * 20})`);
    });
  }

  function aplicarVista(v) {
    vista = v;
    svg.setAttribute("viewBox", `${v.x} ${v.y} ${v.w} ${v.h}`);
    actualizarEscala();
  }

  /** Mueve la cámara a un rectángulo (km) con una transición suave. */
  function enfocar(destino, duracion = 1100) {
    cancelAnimationFrame(animacionVista);
    const ancho = svg.clientWidth || 1;
    const alto = svg.clientHeight || 1;
    // Ajustar a la proporción del lienzo para que el centro quede centrado
    const proporcion = ancho / alto;
    let { x, y, w, h } = destino;
    if (w / h < proporcion) {
      const nw = h * proporcion; x -= (nw - w) / 2; w = nw;
    } else {
      const nh = w / proporcion; y -= (nh - h) / 2; h = nh;
    }
    const inicio = { ...vista };
    const fin = { x, y, w, h };
    if (Paleta.movimientoReducido() || duracion === 0) return aplicarVista(fin);

    const t0 = performance.now();
    const paso = (ahora) => {
      const k = Util.clamp((ahora - t0) / duracion, 0, 1);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      // Interpolación geométrica del tamaño: el zoom se siente uniforme
      const w = inicio.w * Math.pow(fin.w / inicio.w, e);
      const h = inicio.h * Math.pow(fin.h / inicio.h, e);
      const cx = Util.mezcla(inicio.x + inicio.w / 2, fin.x + fin.w / 2, e);
      const cy = Util.mezcla(inicio.y + inicio.h / 2, fin.y + fin.h / 2, e);
      aplicarVista({ x: cx - w / 2, y: cy - h / 2, w, h });
      if (k < 1) animacionVista = requestAnimationFrame(paso);
    };
    animacionVista = requestAnimationFrame(paso);
  }

  const verTodo = (duracion) => enfocar(total, duracion);
  const enfocarEn = (p, radioKm = 1.4, duracion) =>
    enfocar({ x: p.x - radioKm, y: p.y - radioKm, w: 2 * radioKm, h: 2 * radioKm }, duracion);

  function enfocarMunicipio(nombre, duracion) {
    const ps = parcelas.filter((p) => p.mun === nombre);
    const xs = ps.map((p) => p.x);
    const ys = ps.map((p) => p.y);
    const m = 0.8;
    enfocar({ x: Math.min(...xs) - m, y: Math.min(...ys) - m, w: Math.max(...xs) - Math.min(...xs) + 2 * m, h: Math.max(...ys) - Math.min(...ys) + 2 * m }, duracion);
  }

  function resaltar(id) {
    for (const [clave, n] of nodos) n.g.classList.toggle("seleccionada", clave === id);
    capaMarcas.innerHTML = "";
    if (!id) return;
    const p = nodos.get(id).parcela;
    const marca = crearElementoSvg("g", { class: "c2-pin", "data-escala": "1", "data-x": p.x, "data-y": p.y }, capaMarcas);
    crearElementoSvg("circle", { r: 0.55, class: "c2-pin-halo" }, marca);
    crearElementoSvg("circle", { r: 0.22, class: "c2-pin-punto" }, marca);
    actualizarEscala();
  }

  function anillos(p, radiosKm = []) {
    capaAnillos.innerHTML = "";
    radiosKm.forEach((r, i) => {
      const c = crearElementoSvg("circle", { cx: p.x, cy: p.y, r, "vector-effect": "non-scaling-stroke", class: `c2-anillo c2-anillo-${i}` }, capaAnillos);
      const t = crearElementoSvg("text", { x: p.x, y: p.y - r, class: "c2-anillo-texto", "text-anchor": "middle" }, capaAnillos);
      t.textContent = r < 1 ? `${Math.round(r * 1000)} m` : `${r} km`;
      c.style.animationDelay = `${i * 0.25}s`;
    });
  }

  /**
   * Dibuja una línea de cada vecina hacia la parcela objetivo.
   * Grosor = parecido; color = si empuja hacia arriba o hacia abajo.
   */
  function mostrarVecinas(p, vecinas, { animar = true, maxAporte = null } = {}) {
    capaEnlaces.innerHTML = "";
    const tope = maxAporte || Math.max(0.05, ...vecinas.map((v) => Math.abs(v.aporte)));
    vecinas.forEach((v, i) => {
      const n = nodos.get(v.id);
      if (!n) return;
      const linea = crearElementoSvg("line", {
        x1: n.parcela.x, y1: n.parcela.y, x2: p.x, y2: p.y,
        "vector-effect": "non-scaling-stroke",
        class: "c2-enlace " + (v.aporte >= 0 ? "sube" : "baja"),
      }, capaEnlaces);
      linea.style.strokeWidth = `${1 + 5 * Math.sqrt(v.parecido)}px`;
      linea.style.opacity = String(0.25 + 0.75 * Math.min(1, Math.abs(v.aporte) / tope));
      if (animar && !Paleta.movimientoReducido()) {
        const largo = Math.hypot(n.parcela.x - p.x, n.parcela.y - p.y);
        linea.style.strokeDasharray = `${largo}`;
        linea.style.strokeDashoffset = `${largo}`;
        linea.style.setProperty("--retraso", `${i * 60}ms`);
        linea.classList.add("dibujando");
      }
      n.g.classList.add("vecina");
    });
  }

  function limpiarVecinas() {
    capaEnlaces.innerHTML = "";
    capaAnillos.innerHTML = "";
    for (const n of nodos.values()) n.g.classList.remove("vecina", "mismo-municipio");
    svg.classList.remove("atenuar");
  }

  /** Atenúa todo menos las parcelas conocidas del municipio indicado. */
  function marcarMunicipio(nombre) {
    for (const n of nodos.values()) {
      n.g.classList.toggle("mismo-municipio", Boolean(nombre) && n.parcela.mun === nombre && !n.parcela.pred);
    }
    svg.classList.toggle("atenuar", Boolean(nombre));
  }

  /** Revela valores de las parcelas por predecir uno a uno (efecto de «correr el modelo»). */
  function revelarPredicciones(lista, duracion = 1800) {
    modo = "rendimiento";
    if (Paleta.movimientoReducido() || duracion === 0) {
      lista.forEach(({ parcela, media }) => valorPintado.set(parcela.id, media));
      pintar();
      return Promise.resolve();
    }
    // Orden de oeste a este: se ve como una pasada del modelo sobre el territorio
    const orden = [...lista].sort((a, b) => a.parcela.x - b.parcela.x);
    return new Promise((resolver) => {
      orden.forEach(({ parcela, media }, i) => {
        setTimeout(() => {
          valorPintado.set(parcela.id, media);
          const n = nodos.get(parcela.id);
          pintar();
          n.g.classList.remove("destello");
          void n.g.getBBox();
          n.g.classList.add("destello");
          if (i === orden.length - 1) resolver();
        }, (duracion * i) / orden.length);
      });
    });
  }

  function fijarPredicciones(lista) {
    lista.forEach(({ parcela, media }) => valorPintado.set(parcela.id, media));
  }

  function cambiarModo(nuevo) {
    modo = nuevo;
    pintar();
  }

  /** Entrada de las parcelas: vuelan desde puntos dispersos a su lugar real. */
  function entrada(duracion = 1600) {
    if (Paleta.movimientoReducido()) return;
    const rng = Util.crearRng(2026);
    for (const { g, parcela } of nodos.values()) {
      const dx = (rng() - 0.5) * total.w * 0.9;
      const dy = (rng() - 0.5) * total.h * 0.9;
      g.style.transition = "none";
      g.style.transform = `translate(${dx}px, ${dy}px)`;
      g.style.opacity = "0";
      g.style.transformBox = "fill-box";
    }
    // El transform en px de SVG usa unidades del viewBox (km): un vuelo de varios km
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        let i = 0;
        for (const { g } of nodos.values()) {
          g.style.transition = `transform ${duracion}ms cubic-bezier(.2,.8,.2,1) ${(i % 40) * 12}ms, opacity 500ms ${(i % 40) * 12}ms`;
          g.style.transform = "";
          g.style.opacity = "";
          i++;
        }
      });
    });
  }

  // Selección con clic o toque
  capaParcelas.addEventListener("click", (evento) => {
    const g = evento.target.closest(".c2-parcela");
    if (g && opciones.alSeleccionar) opciones.alSeleccionar(g.dataset.id);
  });

  window.addEventListener("paleta", pintar);
  new ResizeObserver(() => actualizarEscala()).observe(svg);

  aplicarVista(total);
  pintar();

  return {
    svg, total, nodos,
    enfocar, enfocarEn, enfocarMunicipio, verTodo,
    resaltar, anillos, mostrarVecinas, limpiarVecinas, marcarMunicipio,
    revelarPredicciones, fijarPredicciones, cambiarModo,
    entrada,
    get modo() { return modo; },
    mostrarEtiquetas: (si) => svg.classList.toggle("con-etiquetas", si),
  };
}
