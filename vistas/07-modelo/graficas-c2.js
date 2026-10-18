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
    const compacto = (contenedor.clientWidth || 600) < 560;
    const altoFila = compacto ? 46 : 34;
    const margen = { izq: compacto ? 14 : Math.min(250, (contenedor.clientWidth || 600) * 0.42), der: 56, sup: 30, inf: 50 };
    const { svg, ancho } = lienzo(contenedor, margen.sup + filas.length * altoFila + margen.inf, "Error de cada modelo");
    const x = escala(0.48, 0.86, margen.izq, ancho - margen.der);

    // Eje
    const eje = el("g", { class: "c2-eje" }, svg);
    for (const v of [0.5, 0.6, 0.7, 0.8]) {
      el("line", { x1: x(v), x2: x(v), y1: margen.sup - 8, y2: margen.sup + filas.length * altoFila, class: "c2-rejilla" }, eje);
      texto(eje, x(v), margen.sup + filas.length * altoFila + 20, fmt(v, 1), { "text-anchor": "middle" });
    }
    texto(eje, ancho - margen.der, margen.sup + filas.length * altoFila + 40, "Error típico (RMSE, t/ha) · menos es mejor", { "text-anchor": "end", class: "c2-eje-titulo" });

    const base = filas.find((m) => m.id === 0);
    const refLinea = el("line", { y1: margen.sup - 6, y2: margen.sup + filas.length * altoFila, class: "c2-referencia" }, svg);
    const refTexto = texto(svg, 0, margen.sup - 10, "solo el municipio", { class: "c2-referencia-texto", "text-anchor": "middle" });

    const puntos = filas.map((m, i) => {
      const y = margen.sup + i * altoFila + (compacto ? altoFila - 12 : altoFila / 2);
      const g = el("g", { class: `c2-fila tipo-${m.tipo}${m.final ? " final" : ""}` }, svg);
      if (compacto) texto(g, margen.izq, y - 14, m.nombre, { class: "c2-fila-nombre" });
      else texto(g, margen.izq - 14, y + 5, m.nombre, { "text-anchor": "end", class: "c2-fila-nombre" });
      const pista = el("line", { x1: x(0.48), y1: y, y2: y, class: "c2-pista" }, g);
      const circulo = el("circle", { cy: y, r: m.final ? 8 : 6, class: "c2-punto" }, g);
      const valor = texto(g, 0, y + 5, "", { class: "c2-fila-valor" });
      g.addEventListener("pointermove", (e) => mostrarTip(e, `<b>${m.nombre}</b><br>${m.desc}`));
      g.addEventListener("pointerleave", ocultarTip);
      return { m, circulo, valor, pista };
    });

    function mover(nuevo, animar = true) {
      const dur = animar && !Paleta.movimientoReducido() ? 900 : 0;
      const bx = x(base[nuevo].rmse);
      refLinea.setAttribute("x1", bx);
      refLinea.setAttribute("x2", bx);
      refTexto.setAttribute("x", bx);
      puntos.forEach(({ m, circulo, valor, pista }, i) => {
        const v = m[nuevo].rmse;
        circulo.style.transition = valor.style.transition = pista.style.transition = `all ${dur}ms cubic-bezier(.2,.8,.2,1) ${i * 40}ms`;
        circulo.setAttribute("cx", x(v));
        pista.setAttribute("x2", x(v));
        valor.setAttribute("x", x(v) + 14);
        valor.textContent = fmt(v, 3);
      });
    }
    mover(esquema, false);
    return { mover };
  }

  /* ---------------------------------------------------------------------- */
  /* Predicho contra observado (138 parcelas conocidas, fuera de muestra)    */
  /* ---------------------------------------------------------------------- */

  function dispersion(contenedor, parcelas, rmse) {
    const lado = Math.min(560, Math.max(300, contenedor.clientWidth || 500));
    contenedor.innerHTML = "";
    const svg = el("svg", { viewBox: `0 0 ${lado} ${lado}`, width: "100%", role: "img", class: "c2-grafica", "aria-label": "Rendimiento predicho contra real" }, contenedor);
    const m = { izq: 52, der: 14, sup: 14, inf: 46 };
    const x = escala(1.8, 5.8, m.izq, lado - m.der);
    const y = escala(1.8, 5.8, lado - m.inf, m.sup);

    const eje = el("g", { class: "c2-eje" }, svg);
    for (let v = 2; v <= 5.5; v += 1) {
      el("line", { x1: x(v), x2: x(v), y1: y(1.8), y2: y(5.8), class: "c2-rejilla" }, eje);
      el("line", { x1: x(1.8), x2: x(5.8), y1: y(v), y2: y(v), class: "c2-rejilla" }, eje);
      texto(eje, x(v), lado - m.inf + 20, fmt(v, 0), { "text-anchor": "middle" });
      texto(eje, m.izq - 10, y(v) + 4, fmt(v, 0), { "text-anchor": "end" });
    }
    texto(eje, (m.izq + lado - m.der) / 2, lado - 8, "Predicción del modelo sin ver la parcela (t/ha)", { "text-anchor": "middle", class: "c2-eje-titulo" });
    texto(eje, 14, (m.sup + lado - m.inf) / 2, "Rendimiento real (t/ha)", { "text-anchor": "middle", class: "c2-eje-titulo", transform: `rotate(-90 14 ${(m.sup + lado - m.inf) / 2})` });

    // Banda ± RMSE y diagonal
    el("polygon", {
      points: [[1.8, 1.8 + rmse], [5.8 - rmse, 5.8], [5.8, 5.8], [5.8, 5.8 - rmse], [1.8 + rmse, 1.8], [1.8, 1.8]]
        .map(([a, b]) => `${x(a)},${y(b)}`).join(" "),
      class: "c2-banda",
    }, svg);
    el("line", { x1: x(1.8), y1: y(1.8), x2: x(5.8), y2: y(5.8), class: "c2-diagonal" }, svg);
    texto(svg, x(5.65), y(5.65) - 8, "acierto perfecto", { "text-anchor": "end", class: "c2-nota-grafica" });

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
    const { svg, ancho, alto } = lienzo(contenedor, 300, "Las 59 predicciones con su rango P10 a P90");
    const m = { izq: 44, der: 10, sup: 16, inf: 34 };
    const x = escala(0, datos.length - 1, m.izq + 6, ancho - m.der - 6);
    const y = escala(1.8, 5.6, alto - m.inf, m.sup);

    const eje = el("g", { class: "c2-eje" }, svg);
    for (let v = 2; v <= 5.5; v += 1) {
      el("line", { x1: m.izq, x2: ancho - m.der, y1: y(v), y2: y(v), class: "c2-rejilla" }, eje);
      texto(eje, m.izq - 8, y(v) + 4, fmt(v, 0), { "text-anchor": "end" });
    }
    texto(eje, m.izq, alto - 10, "Parcelas por predecir, de menor a mayor rendimiento estimado →", { class: "c2-eje-titulo" });

    datos.forEach((p, i) => {
      const p10 = p.est + q.p10 * p.sd, p90 = p.est + q.p90 * p.sd, p20 = p.est + q.p20 * p.sd;
      const g = el("g", { class: `c2-oruga riesgo-${p.riesgo.toLowerCase()}` }, svg);
      g.style.animationDelay = `${i * 15}ms`;
      el("line", { x1: x(i), x2: x(i), y1: y(p10), y2: y(p90), class: "c2-oruga-rango" }, g);
      el("line", { x1: x(i) - 3, x2: x(i) + 3, y1: y(p20), y2: y(p20), class: "c2-oruga-p20" }, g);
      el("circle", { cx: x(i), cy: y(p.est), r: 3.4, class: "c2-oruga-punto" }, g);
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
    const altoFila = compacto ? 42 : 30;
    const izq = compacto ? 2 : Math.min(210, (contenedor.clientWidth || 400) * 0.45);
    const { svg, ancho } = lienzo(contenedor, items.length * altoFila + 8, etiqueta);
    const x = escala(0, maximo, izq, ancho - 54);
    items.forEach((it, i) => {
      const y = i * altoFila + (compacto ? 14 : 4);
      const g = el("g", { class: "c2-barra" + (i === 0 ? " primera" : "") }, svg);
      if (compacto) texto(g, izq, y + 2, it.nombre, { class: "c2-fila-nombre" });
      else texto(g, izq - 10, y + altoFila / 2 + 1, it.nombre, { "text-anchor": "end", class: "c2-fila-nombre" });
      const r = el("rect", { x: x(0), y: y + 5, height: altoFila - 12, width: 0, rx: 3 }, g);
      r.style.setProperty("--ancho", `${x(valor(it)) - x(0)}px`);
      r.style.transitionDelay = `${i * 50}ms`;
      requestAnimationFrame(() => requestAnimationFrame(() => r.setAttribute("width", Math.max(1, x(valor(it)) - x(0)))));
      texto(g, x(valor(it)) + 8, y + altoFila / 2 + 1, formato(it), { class: "c2-fila-valor" });
    });
    return svg;
  }

  /* ---------------------------------------------------------------------- */
  /* Diagrama de puntos de RMSE con referencias (pregunta 3)                 */
  /* ---------------------------------------------------------------------- */

  function puntosError(contenedor, items, referencias) {
    const compacto = (contenedor.clientWidth || 400) < 400;
    const altoFila = compacto ? 42 : 30;
    const izq = compacto ? 8 : Math.min(250, (contenedor.clientWidth || 400) * 0.5);
    const { svg, ancho } = lienzo(contenedor, items.length * altoFila + 46, "Error de cada combinación de variables");
    const x = escala(0.48, 0.86, izq, ancho - 50);
    const fondo = items.length * altoFila + 8;
    for (const r of referencias) {
      el("line", { x1: x(r.valor), x2: x(r.valor), y1: 0, y2: fondo, class: "c2-referencia" + (r.clase ? ` ${r.clase}` : "") }, svg);
      texto(svg, x(r.valor), fondo + 16, r.texto, { "text-anchor": "middle", class: "c2-referencia-texto" });
    }
    items.forEach((it, i) => {
      const y = i * altoFila + (compacto ? altoFila - 8 : altoFila / 2 + 4);
      const g = el("g", { class: "c2-fila" + (i === 0 ? " final" : "") }, svg);
      if (compacto) texto(g, izq, y - 14, it.nombre, { class: "c2-fila-nombre" });
      else texto(g, izq - 12, y + 4, it.nombre, { "text-anchor": "end", class: "c2-fila-nombre" });
      el("line", { x1: x(it.rmse - it.se), x2: x(it.rmse + it.se), y1: y, y2: y, class: "c2-error" }, g);
      el("circle", { cx: x(it.rmse), cy: y, r: i === 0 ? 7 : 5.5, class: "c2-punto" }, g);
      texto(g, x(it.rmse + it.se) + 8, y + 4, fmt(it.rmse, 3), { class: "c2-fila-valor" });
    });
    texto(svg, ancho - 50, fondo + 34, "error (t/ha) · menos es mejor", { "text-anchor": "end", class: "c2-eje-titulo" });
    return svg;
  }

  return { carreraModelos, dispersion, oruga, curvaParecido, barras, puntosError, mostrarTip, ocultarTip, TIPOS, escala, texto, lienzo };
})();
