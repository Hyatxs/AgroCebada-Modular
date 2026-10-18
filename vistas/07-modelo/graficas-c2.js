"use strict";

/*
 * Gráficas del capítulo 2 en SVG, sin librerías.
 * Cada función dibuja dentro de un contenedor y se vuelve a dibujar al cambiar
 * de tamaño o de tema. Los colores salen de las variables CSS de la paleta.
 */

const Graficas = (() => {
  const fmt = (v, d = 2) => Util.fmt(v, d);
  const el = crearElementoSvg;

  function lienzo(contenedor, alto, etiqueta) {
    contenedor.innerHTML = "";
    const ancho = Math.max(280, contenedor.clientWidth || 600);
    const svg = el("svg", { viewBox: `0 0 ${ancho} ${alto}`, width: "100%", role: "img", "aria-label": etiqueta, class: "c2-grafica" }, contenedor);
    return { svg, ancho, alto };
  }

  function escala(d0, d1, r0, r1) {
    const f = (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
    f.inv = (p) => d0 + ((p - r0) / (r1 - r0)) * (d1 - d0);
    return f;
  }

  function texto(padre, x, y, contenido, atributos = {}) {
    const t = el("text", { x, y, ...atributos }, padre);
    t.textContent = contenido;
    return t;
  }

  /* ---------------------------------------------------------------------- */
  /* Tooltip compartido                                                      */
  /* ---------------------------------------------------------------------- */

  let tip = null;
  function mostrarTip(evento, html) {
    if (!tip) {
      tip = document.createElement("div");
      tip.className = "c2-tip";
      tip.setAttribute("role", "status");
      document.body.appendChild(tip);
    }
    tip.innerHTML = html;
    tip.hidden = false;
    const x = Math.min(window.innerWidth - tip.offsetWidth - 12, evento.clientX + 14);
    const y = Math.max(12, evento.clientY - tip.offsetHeight - 12);
    tip.style.transform = `translate(${x}px, ${y}px)`;
  }
  const ocultarTip = () => tip && (tip.hidden = true);

  /* ---------------------------------------------------------------------- */
  /* Carrera de modelos: diagrama de puntos (RMSE), se mueve entre esquemas  */
  /* ---------------------------------------------------------------------- */

  const TIPOS = {
    ubicacion: "Ubicación (municipio y vecinas)",
    mixto: "Ubicación + satélite, clima y suelo",
    satelite: "Solo satélite, clima y suelo, sin ubicación",
  };

  function carreraModelos(contenedor, modelos, esquema) {
    const filas = [...modelos].sort((a, b) => a.main.rmse - b.main.rmse);
    const anchoC = contenedor.clientWidth || 600;
    const compacto = anchoC < 560;
    const altoFila = compacto ? 54 : 42;
    const margen = { izq: compacto ? 12 : Math.min(240, anchoC * 0.34), der: compacto ? 58 : 76, sup: 58, inf: 54 };
    const fondo = margen.sup + filas.length * altoFila;
    const { svg, ancho } = lienzo(contenedor, fondo + margen.inf, "Error de cada modelo");
    const x0 = margen.izq, x1 = ancho - margen.der;
    const base = filas.find((m) => m.id === 0);

    const capaFilas = el("g", {}, svg);
    const capaEje = el("g", { class: "c2-eje" }, svg);
    const capaRef = el("g", {}, svg);
    const capaDatos = el("g", {}, svg);

    // Bandas por fila: alternadas y una más marcada para el modelo elegido
    filas.forEach((m, i) => {
      const y0 = margen.sup + i * altoFila;
      if (m.final || i % 2) {
        el("rect", { x: 0, y: y0 + 3, width: ancho, height: altoFila - 6, rx: 10, class: m.final ? "c2-fila-destacada" : "c2-fila-alterna" }, capaFilas);
      }
    });

    // Columna de valores a la derecha
    texto(svg, ancho - 10, margen.sup - 12, "error", { "text-anchor": "end", class: "c2-eje-titulo" });

    // Línea de referencia: el promedio del municipio
    const refLinea = el("line", { y1: margen.sup - 10, y2: fondo, class: "c2-referencia-solida" }, capaRef);
    const refTexto = texto(capaRef, 0, margen.sup - 32, "", { class: "c2-referencia-texto", "text-anchor": "middle" });
    const mejor = texto(capaRef, 0, margen.sup - 14, "← mejor", { class: "c2-nota-grafica", "text-anchor": "end" });
    const peor = texto(capaRef, 0, margen.sup - 14, "peor →", { class: "c2-nota-grafica" });

    const marcas = filas.map((m, i) => {
      const yc = margen.sup + i * altoFila + (compacto ? altoFila - 17 : altoFila / 2);
      const g = el("g", { class: `c2-fila tipo-${m.tipo}${m.final ? " final" : ""}` }, capaDatos);
      if (compacto) texto(g, x0, yc - 15, m.nombre, { class: "c2-fila-nombre c2-con-halo" });
      else texto(g, x0 - 16, yc + 4, m.nombre, { "text-anchor": "end", class: "c2-fila-nombre" });
      if (m.final) texto(g, x1, yc + (compacto ? -15 : 4), "modelo elegido", { "text-anchor": "end", class: "c2-etiqueta-final c2-con-halo" });
      const tallo = el("line", { y1: yc, y2: yc, class: "c2-tallo" }, g);
      const punto = el("circle", { cy: yc, r: m.final ? 9 : 7, class: "c2-punto" }, g);
      const valor = texto(g, ancho - 10, yc + 4, "", { "text-anchor": "end", class: "c2-fila-valor" });
      const zona = el("rect", { x: 0, y: margen.sup + i * altoFila, width: ancho, height: altoFila, class: "c2-zona" }, g);
      zona.addEventListener("pointermove", (e) => mostrarTip(e, `<b>${m.nombre}</b><br>${m.desc}`));
      zona.addEventListener("pointerleave", ocultarTip);
      return { m, tallo, punto, valor };
    });

    // Cada prueba tiene su propia escala (el error en zonas nuevas es mucho mayor)
    function estadoDe(nuevo) {
      const vals = filas.map((m) => m[nuevo].rmse);
      const lo = Math.min(...vals, base[nuevo].rmse), hi = Math.max(...vals, base[nuevo].rmse);
      const paso = hi - lo > 0.12 ? 0.05 : 0.02;
      return {
        d0: Math.floor((lo - paso * 0.4) / paso) * paso,
        d1: Math.ceil((hi + paso * 0.4) / paso) * paso,
        paso, ref: base[nuevo].rmse, vals,
      };
    }

    function pintar(e) {
      const x = escala(e.d0, e.d1, x0, x1);
      capaEje.innerHTML = "";
      for (let v = Math.ceil(e.d0 / e.paso - 1e-6) * e.paso; v <= e.d1 + 1e-9; v += e.paso) {
        el("line", { x1: x(v), x2: x(v), y1: margen.sup, y2: fondo, class: "c2-rejilla" }, capaEje);
        texto(capaEje, x(v), fondo + 20, fmt(v, 2), { "text-anchor": "middle" });
      }
      el("line", { x1: x0, x2: x1, y1: fondo, y2: fondo, class: "c2-eje-linea" }, capaEje);
      texto(capaEje, x1, fondo + 42, "Error típico (RMSE, t/ha) · menos es mejor", { "text-anchor": "end", class: "c2-eje-titulo" });
      const bx = x(e.ref);
      refLinea.setAttribute("x1", bx);
      refLinea.setAttribute("x2", bx);
      refTexto.setAttribute("x", bx);
      refTexto.textContent = `solo el municipio · ${fmt(e.ref, 3)}`;
      mejor.setAttribute("x", bx - 8);
      peor.setAttribute("x", bx + 8);
      marcas.forEach(({ tallo, punto, valor }, i) => {
        const v = e.vals[i];
        tallo.setAttribute("x1", bx);
        tallo.setAttribute("x2", x(v));
        punto.setAttribute("cx", x(v));
        valor.textContent = fmt(v, 3);
      });
    }

        // Antes de aparecer, todos los puntos esperan sobre la línea de referencia
    let elegido = esquema;
    let revelada = false;
    const inicial = estadoDe(esquema);
    let actual = { ...inicial, vals: inicial.vals.map(() => inicial.ref) };
    let animacion = 0;

    // escalon: retraso (ms) entre una fila y la siguiente, para que salgan una tras otra
    function transicion(hasta, { animar = true, escalon = 0, dur = 900 } = {}) {
      const desde = actual;
      cancelAnimationFrame(animacion);
      if (!animar || Paleta.movimientoReducido()) { actual = hasta; pintar(actual); return; }
      const t0 = performance.now();
      const fin = dur + escalon * (filas.length - 1);
      const suave = (k) => 1 - Math.pow(1 - k, 3);
      const paso = (ahora) => {
        const t = ahora - t0;
        const s = suave(Util.clamp(t / dur, 0, 1));
        const mezcla = (a, b, k = s) => a + (b - a) * k;
        actual = {
          d0: mezcla(desde.d0, hasta.d0), d1: mezcla(desde.d1, hasta.d1), paso: hasta.paso,
          ref: mezcla(desde.ref, hasta.ref),
          vals: hasta.vals.map((v, i) => mezcla(desde.vals[i], v, suave(Util.clamp((t - i * escalon) / dur, 0, 1)))),
        };
        pintar(actual);
        if (t < fin) animacion = requestAnimationFrame(paso);
        else { actual = hasta; pintar(actual); }
      };
      animacion = requestAnimationFrame(paso);
    }

    function mover(nuevo, animar = true) {
      elegido = nuevo;
      if (revelada) transicion(estadoDe(nuevo), { animar });
    }

    /** Despliega los modelos desde la referencia (la página la llama cuando la gráfica se ve). */
    function entrada(animar = true) {
      revelada = true;
      transicion(estadoDe(elegido), { animar, escalon: 70, dur: 800 });
    }

    pintar(actual);
    return { mover, entrada };
  }

    // Ejes con línea, marcas y títulos (comunes a las dos gráficas de resultados)
  function ejeY(g, y, xEje, valores, etiquetar, titulo, centro) {
    for (const v of valores) {
      el("line", { x1: xEje - 5, x2: xEje, y1: y(v), y2: y(v), class: "c2-eje-linea" }, g);
      if (etiquetar(v)) texto(g, xEje - 9, y(v) + 4, fmt(v, 1), { "text-anchor": "end" });
    }
    texto(g, 14, centro, titulo, { "text-anchor": "middle", class: "c2-eje-titulo", transform: `rotate(-90 14 ${centro})` });
  }

  function cabecera(contenedor, titulo, claves) {
    const c = document.createElement("div");
    c.className = "c2-fig-cabeza";
    c.innerHTML = `<p class="c2-fig-titulo">${titulo}</p><p class="c2-clave">${claves
      .map(([clase, t]) => `<span class="${clase}">${t}</span>`).join("")}</p>`;
    contenedor.appendChild(c);
  }

  /* ---------------------------------------------------------------------- */
  /* Predicho contra observado (138 parcelas conocidas, fuera de muestra)    */
  /* ---------------------------------------------------------------------- */

  function dispersion(contenedor, parcelas, rmse) {
    contenedor.innerHTML = "";
    cabecera(contenedor, "Lo que predijo el modelo contra lo que rindió cada parcela", [
      ["k-punto", "parcela conocida (138)"],
      ["k-lejano", "falló por más de 1 t/ha"],
      ["k-banda", `error típico (±${fmt(rmse, 2)} t/ha)`],
      ["k-diagonal", "acierto perfecto"],
    ]);
    const lado = Math.min(560, Math.max(300, contenedor.clientWidth || 500));
    const svg = el("svg", { viewBox: `0 0 ${lado} ${lado}`, width: "100%", role: "img", class: "c2-grafica", "aria-label": "Rendimiento predicho contra real" }, contenedor);
    svg.style.maxWidth = `${lado}px`; // no se agranda más que su tamaño de diseño (los textos crecerían)
    const m = { izq: 62, der: 14, sup: 12, inf: 58 };
    const D0 = 1.8, D1 = 5.8;
    const x = escala(D0, D1, m.izq, lado - m.der);
    const y = escala(D0, D1, lado - m.inf, m.sup);
    const valores = [2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5];
    const enteros = (v) => v % 1 === 0;

    const eje = el("g", { class: "c2-eje" }, svg);
    for (const v of valores) {
      el("line", { x1: x(v), x2: x(v), y1: y(D0), y2: y(D1), class: "c2-rejilla" + (enteros(v) ? "" : " menor") }, eje);
      el("line", { x1: x(D0), x2: x(D1), y1: y(v), y2: y(v), class: "c2-rejilla" + (enteros(v) ? "" : " menor") }, eje);
      el("line", { x1: x(v), x2: x(v), y1: y(D0), y2: y(D0) + 5, class: "c2-eje-linea" }, eje);
      if (enteros(v)) texto(eje, x(v), y(D0) + 20, fmt(v, 1), { "text-anchor": "middle" });
    }
    ejeY(eje, y, x(D0), valores, enteros, "Rendimiento real (t/ha)", (m.sup + lado - m.inf) / 2);
    el("line", { x1: x(D0), x2: x(D1), y1: y(D0), y2: y(D0), class: "c2-eje-linea" }, eje);
    el("line", { x1: x(D0), x2: x(D0), y1: y(D0), y2: y(D1), class: "c2-eje-linea" }, eje);
    texto(eje, (m.izq + lado - m.der) / 2, lado - 12, "Predicción del modelo, sin ver la parcela (t/ha)", { "text-anchor": "middle", class: "c2-eje-titulo" });

    // Banda ± RMSE y diagonal
    el("polygon", {
      points: [[D0, D0 + rmse], [D1 - rmse, D1], [D1, D1], [D1, D1 - rmse], [D0 + rmse, D0], [D0, D0]]
        .map(([a, b]) => `${x(a)},${y(b)}`).join(" "),
      class: "c2-banda",
    }, svg);
    el("line", { x1: x(D0), y1: y(D0), x2: x(D1), y2: y(D1), class: "c2-diagonal" }, svg);

    // Guías de lectura: arriba de la diagonal rindió más de lo predicho; abajo, menos
    texto(svg, x(D0) + 10, y(D1) + 18, "↑ rindió más de lo predicho", { class: "c2-guia" });
    texto(svg, x(D1) - 8, y(D0) - 12, "rindió menos de lo predicho ↓", { "text-anchor": "end", class: "c2-guia" });

    const g = el("g", { class: "c2-puntos" }, svg);
    const orden = [...parcelas].sort(() => 0.5 - Math.random());
    orden.forEach((p, i) => {
      const c = el("circle", { cx: x(p.oof), cy: y(p.y_obs), r: 5, class: "c2-dato" + (Math.abs(p.y_obs - p.oof) > 2 * rmse ? " lejano" : "") }, g);
      c.style.animationDelay = `${i * 8}ms`;
      c.addEventListener("pointermove", (e) =>
        mostrarTip(e, `<b>${p.id}</b> · ${p.mun}<br>real ${fmt(p.y_obs)} · predicho ${fmt(p.oof)} t/ha`));
      c.addEventListener("pointerleave", ocultarTip);
    });
    return svg;
  }

  /* ---------------------------------------------------------------------- */
  /* Las 59 predicciones con su rango (oruga), color por nivel de riesgo     */
  /* ---------------------------------------------------------------------- */

  function oruga(contenedor, predicciones, q) {
    const datos = [...predicciones].sort((a, b) => a.est - b.est);
    contenedor.innerHTML = "";
    cabecera(contenedor, "Las 59 predicciones entregadas, con su rango (8 de cada 10 veces el valor real cae dentro)", [
      ["k-riesgo bajo", "riesgo bajo"],
      ["k-riesgo medio", "riesgo medio"],
      ["k-riesgo alto", "riesgo alto"],
    ]);
    const anchoC = Math.max(280, contenedor.clientWidth || 600);
    const alto = 360;
    const svg = el("svg", { viewBox: `0 0 ${anchoC} ${alto}`, width: "100%", role: "img", class: "c2-grafica", "aria-label": "Las 59 predicciones con su rango P10 a P90" }, contenedor);
    const ancho = anchoC;
    const m = { izq: 62, der: 12, sup: 12, inf: 58 };
    const D0 = 1.8, D1 = 5.8;
    const x = escala(0, datos.length - 1, m.izq + 12, ancho - m.der - 6);
    const y = escala(D0, D1, alto - m.inf, m.sup);
    const valores = [2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5];
    const enteros = (v) => v % 1 === 0;

    const eje = el("g", { class: "c2-eje" }, svg);
    for (const v of valores) {
      el("line", { x1: m.izq, x2: ancho - m.der, y1: y(v), y2: y(v), class: "c2-rejilla" + (enteros(v) ? "" : " menor") }, eje);
    }
    ejeY(eje, y, m.izq, valores, enteros, "Rendimiento (t/ha)", (m.sup + alto - m.inf) / 2);
    el("line", { x1: m.izq, x2: m.izq, y1: y(D0), y2: y(D1), class: "c2-eje-linea" }, eje);
    el("line", { x1: m.izq, x2: ancho - m.der, y1: y(D0), y2: y(D0), class: "c2-eje-linea" }, eje);
    for (const n of [1, 10, 20, 30, 40, 50, datos.length]) {
      el("line", { x1: x(n - 1), x2: x(n - 1), y1: y(D0), y2: y(D0) + 5, class: "c2-eje-linea" }, eje);
      texto(eje, x(n - 1), y(D0) + 20, String(n), { "text-anchor": "middle" });
    }
    texto(eje, (m.izq + ancho - m.der) / 2, alto - 12, "Parcelas por predecir, de la predicción más baja a la más alta", { "text-anchor": "middle", class: "c2-eje-titulo" });

    // Cómo leer cada parcela (arriba a la izquierda, donde no hay datos)
    const kx = m.izq + 30, ky = y(5.65);
    const clave = el("g", { class: "c2-clave-oruga" }, svg);
    const largo = Math.min(96, y(4.3) - ky);
    el("line", { x1: kx, x2: kx, y1: ky, y2: ky + largo, class: "c2-oruga-rango" }, clave);
    el("line", { x1: kx - 5, x2: kx + 5, y1: ky + largo * 0.72, y2: ky + largo * 0.72, class: "c2-oruga-p20" }, clave);
    el("circle", { cx: kx, cy: ky + largo * 0.45, r: 4.5, class: "c2-oruga-punto" }, clave);
    texto(clave, kx + 14, ky + 4, "P90", { class: "c2-clave-texto" });
    texto(clave, kx + 14, ky + largo * 0.45 + 4, "predicción", { class: "c2-clave-texto fuerte" });
    texto(clave, kx + 14, ky + largo * 0.72 + 4, "P20 (financiable)", { class: "c2-clave-texto" });
    texto(clave, kx + 14, ky + largo + 4, "P10", { class: "c2-clave-texto" });

    datos.forEach((p, i) => {
      const p10 = p.est + q.p10 * p.sd, p90 = p.est + q.p90 * p.sd, p20 = p.est + q.p20 * p.sd;
      const g = el("g", { class: `c2-oruga riesgo-${p.riesgo.toLowerCase()}` }, svg);
      g.style.animationDelay = `${i * 15}ms`;
      el("line", { x1: x(i), x2: x(i), y1: y(p10), y2: y(p90), class: "c2-oruga-rango" }, g);
      el("line", { x1: x(i) - 3.5, x2: x(i) + 3.5, y1: y(p20), y2: y(p20), class: "c2-oruga-p20" }, g);
      el("circle", { cx: x(i), cy: y(p.est), r: 3.6, class: "c2-oruga-punto" }, g);
      const zona = el("rect", { x: x(i) - 5, y: m.sup, width: 10, height: alto - m.sup - m.inf, class: "c2-zona" }, g);
      zona.addEventListener("pointermove", (e) =>
        mostrarTip(e, `<b>${p.id}</b> · ${p.mun}<br>predicción ${fmt(p.est)} t/ha<br>rango ${fmt(p10)} – ${fmt(p90)} · P20 ${fmt(p20)}<br>riesgo ${p.riesgo.toLowerCase()}`));
      zona.addEventListener("pointerleave", ocultarTip);
    });
    return svg;
  }

  /* ---------------------------------------------------------------------- */
  /* Curva de parecido entre parcelas según la distancia                    */
  /* ---------------------------------------------------------------------- */

  function curvaParecido(contenedor, curva, marcas) {
    const { svg, ancho, alto } = lienzo(contenedor, 190, "Qué tanto se parecen dos parcelas según su distancia");
    const m = { izq: 40, der: 14, sup: 14, inf: 36 };
    const maxKm = curva[curva.length - 1].d_km;
    const x = escala(0, maxKm, m.izq, ancho - m.der);
    const y = escala(0, 1, alto - m.inf, m.sup);

    const eje = el("g", { class: "c2-eje" }, svg);
    for (let v = 0; v <= maxKm + 1e-9; v += 0.5) {
      texto(eje, x(v), alto - m.inf + 18, v === 0 ? "0" : v < 1 ? `${v * 1000} m` : `${fmt(v, v % 1 ? 1 : 0)} km`, { "text-anchor": "middle" });
    }
    for (const v of [0, 0.5, 1]) {
      el("line", { x1: m.izq, x2: ancho - m.der, y1: y(v), y2: y(v), class: "c2-rejilla" }, eje);
      texto(eje, m.izq - 8, y(v) + 4, `${v * 100}%`, { "text-anchor": "end" });
    }
    texto(eje, ancho - m.der, alto - 4, "distancia entre parcelas", { "text-anchor": "end", class: "c2-eje-titulo" });

    const area = `M${x(0)},${y(0)} ` + curva.map((c) => `L${x(c.d_km)},${y(c.parecido)}`).join(" ") + ` L${x(maxKm)},${y(0)} Z`;
    el("path", { d: area, class: "c2-curva-area" }, svg);
    const linea = el("path", { d: "M" + curva.map((c) => `${x(c.d_km)},${y(c.parecido)}`).join(" L"), class: "c2-curva" }, svg);
    const largo = linea.getTotalLength ? linea.getTotalLength() : 600;
    linea.style.strokeDasharray = largo;
    linea.style.strokeDashoffset = largo;
    linea.classList.add("dibujando");

    for (const { d_km, parecido, texto: t } of marcas) {
      el("line", { x1: x(d_km), x2: x(d_km), y1: y(0), y2: y(parecido), class: "c2-marca-linea" }, svg);
      el("circle", { cx: x(d_km), cy: y(parecido), r: 4.5, class: "c2-marca-punto" }, svg);
      texto(svg, x(d_km) + 8, y(parecido) - 8, t, { class: "c2-nota-grafica" });
    }
    return svg;
  }

  /* ---------------------------------------------------------------------- */
  /* Barras horizontales para las preguntas guía (desde cero)               */
  /* ---------------------------------------------------------------------- */

  function barras(contenedor, items, { valor, formato, maximo, etiqueta }) {
    const compacto = (contenedor.clientWidth || 400) < 400;
    // En compacto el nombre va arriba de su barra, con aire suficiente para no tocar la barra de arriba
    const altoFila = compacto ? 48 : 32;
    const grueso = compacto ? 16 : 18;
    const izq = compacto ? 2 : Math.min(210, (contenedor.clientWidth || 400) * 0.45);
    const { svg, ancho } = lienzo(contenedor, items.length * altoFila + 8, etiqueta);
    const x = escala(0, maximo, izq, ancho - 54);
    const rectangulos = [];
    items.forEach((it, i) => {
      const y = i * altoFila + 4;
      const yBarra = compacto ? y + 19 : y + (altoFila - grueso) / 2;
      const g = el("g", { class: "c2-barra" + (i === 0 ? " primera" : "") }, svg);
      if (compacto) texto(g, izq, y + 12, it.nombre, { class: "c2-fila-nombre" });
      else texto(g, izq - 10, yBarra + grueso / 2 + 4, it.nombre, { "text-anchor": "end", class: "c2-fila-nombre" });
      const r = el("rect", { x: x(0), y: yBarra, height: grueso, width: 0, rx: 4 }, g);
      r.style.transitionDelay = `${i * 50}ms`;
            r.style.transitionDelay = `${i * 60}ms`;
      rectangulos.push([r, Math.max(1, x(valor(it)) - x(0))]);
      const t = texto(g, x(valor(it)) + 8, yBarra + grueso / 2 + 4, formato(it), { class: "c2-fila-valor" });
      t.style.animationDelay = `${500 + i * 60}ms`;
    });
        /** Las barras crecen desde cero (la página la llama cuando la gráfica se ve). */
    function entrada(animar = true) {
      rectangulos.forEach(([r, ancho]) => {
        if (!animar) r.style.transition = "none";
        r.setAttribute("width", ancho);
      });
    }
    return { svg, entrada };
  }

  /* ---------------------------------------------------------------------- */
  /* Diagrama de puntos de RMSE con referencias (pregunta 3)                 */
  /* ---------------------------------------------------------------------- */

  function puntosError(contenedor, items, referencias) {
    const compacto = (contenedor.clientWidth || 400) < 400;
    const altoFila = compacto ? 46 : 30;
    const izq = compacto ? 8 : Math.min(250, (contenedor.clientWidth || 400) * 0.5);
    const { svg, ancho } = lienzo(contenedor, items.length * altoFila + 56, "Error de cada combinación de variables");
    const x = escala(0.48, 0.86, izq, ancho - 50);
    const fondo = items.length * altoFila + 8;
    // La referencia va primero (debajo) y los textos llevan un halo del color del fondo
    for (const r of referencias) {
      el("line", { x1: x(r.valor), x2: x(r.valor), y1: 0, y2: fondo, class: "c2-referencia" + (r.clase ? ` ${r.clase}` : "") }, svg);
      texto(svg, x(r.valor), fondo + 16, r.texto, { "text-anchor": "middle", class: "c2-referencia-texto c2-con-halo" });
    }
    items.forEach((it, i) => {
      const y = i * altoFila + (compacto ? altoFila - 8 : altoFila / 2 + 4);
      const g = el("g", { class: "c2-fila c2-fila-q3" + (i === 0 ? " final" : "") }, svg);
      g.style.animationDelay = `${i * 90}ms`;
      if (compacto) texto(g, izq, y - 15, it.nombre, { class: "c2-fila-nombre c2-con-halo" });
      else texto(g, izq - 12, y + 4, it.nombre, { "text-anchor": "end", class: "c2-fila-nombre c2-con-halo" });
      el("line", { x1: x(it.rmse - it.se), x2: x(it.rmse + it.se), y1: y, y2: y, class: "c2-error" }, g);
      el("circle", { cx: x(it.rmse), cy: y, r: i === 0 ? 7 : 5.5, class: "c2-punto" }, g);
      texto(g, x(it.rmse + it.se) + 8, y + 4, fmt(it.rmse, 3), { class: "c2-fila-valor c2-con-halo" });
    });
    texto(svg, ancho - 50, fondo + 40, "error (t/ha) · menos es mejor", { "text-anchor": "end", class: "c2-eje-titulo" });
    return svg;
  }

  return { carreraModelos, dispersion, oruga, curvaParecido, barras, puntosError, mostrarTip, ocultarTip, TIPOS, escala, texto, lienzo };
})();
