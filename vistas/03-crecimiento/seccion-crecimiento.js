"use strict";

/*
 * Sección «Cómo crece» del capítulo 1 (idea y textos originales de Lulú).
 *
 * Un campo de cebada ilustrado crece solo, de la siembra a la cosecha, cuando la sección entra en
 * pantalla. Se puede pausar, arrastrar la barra de meses o tocar una etapa para saltar a ella.
 *
 * Todo sale de los datos de 2025:
 *   - Las fechas: inicio, pico y fin del verdor (mediana de las 148 parcelas que reverdecieron primero,
 *     NB03, en temporada-datos.js). Son las mismas que usa la parte 4, «2025, un año atípico».
 *   - Qué tan verde se ve el campo: la curva semanal de NDVI de esas parcelas (data.js).
 *   - Las nubes: la nubosidad semanal de las imágenes Planet del reto (DATA.cli.cld). La lluvia: CHIRPS
 *     mensual, promedio de la región del reto.
 * Las etapas son aproximadas: el reto no trae fechas de siembra ni de cosecha, así que se reparten entre el
 * inicio, el pico y el fin del verdor (CampoCebada.etapas). Quedan cerca de lo que reporta el INIFAP: floración
 * de 45 a 57 días y madurez de 94 a 115 días (Zamora Díaz et al. 2017); siembra de mayo a junio según la zona.
 *
 * Depende de: common.js (Util, Paleta), data.js (DATA), temporada-datos.js (TEMPORADA) y campo-cebada.js.
 * Contenedor: <div id="crecimiento-demo"></div> dentro de <section id="crecimiento">.
 */

(() => {
  const contenedor = document.getElementById("crecimiento-demo");
  if (!contenedor || typeof CampoCebada === "undefined" || typeof DATA === "undefined" || !window.TEMPORADA) return;

  const T = window.TEMPORADA;
  const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
  const reducido = () => typeof Paleta !== "undefined" && Paleta.movimientoReducido();
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const fechaDe = (dia) => new Date(2025, 0, Math.round(dia));
  const fecha = (dia) => `${fechaDe(dia).getDate()} de ${MESES[fechaDe(dia).getMonth()]}`;
  function cuandoEs(dia) {
    const f = fechaDe(dia);
    const parte = f.getDate() <= 10 ? "principios" : f.getDate() <= 20 ? "mediados" : "fines";
    return `${parte} de ${MESES[f.getMonth()]}`;
  }
  const mediana = (v) => {
    const s = [...v].sort((a, b) => a - b);
    const i = (s.length - 1) / 2;
    return (s[Math.floor(i)] + s[Math.ceil(i)]) / 2;
  };

  /* --- La temporada típica de 2025, desde los datos ------------------------------ */

  const tempranas = DATA.P.filter((p) => T.parcelas[p.id] && T.parcelas[p.id][0] < 200);
  const FEN = {
    inicio: mediana(tempranas.map((p) => T.parcelas[p.id][0])),
    pico: mediana(tempranas.map((p) => T.parcelas[p.id][1])),
    fin: mediana(tempranas.map((p) => T.parcelas[p.id][2])),
  };
  const NDVI = Array.from({ length: 52 }, (_, w) => mediana(tempranas.map((p) => p.n[w])) / 1000);
  const ndviEn = (dia) => {
    const w = limitar((dia - 4) / 7, 0, 50.999);
    const i = Math.floor(w);
    return NDVI[i] + (NDVI[i + 1] - NDVI[i]) * (w - i);
  };
  const nubesEn = (dia) => {
    const w = limitar((dia - 4) / 7, 0, 50.999);
    const i = Math.floor(w);
    const c = DATA.cli.cld;
    return (c[i] + (c[i + 1] - c[i]) * (w - i)) / 100;
  };
  const LLUVIA = T.region.lluvia["2025"];
  const lluviaMes = (dia) => LLUVIA[fechaDe(dia).getMonth()];

  const ETAPAS = CampoCebada.etapas(FEN);
  const D0 = Math.floor(ETAPAS[0].desde - 6);
  const D1 = Math.ceil(ETAPAS[7].hasta + 6);
  const SEGUNDOS = 34; // toda la temporada
  // Ancho de la curva en unidades del SVG: en celular es menor, para que sus letras no queden diminutas
  const ANCHO_CURVA = window.innerWidth < 640 ? 560 : 1000;

  const TEXTOS = {
    siembra: "Con las primeras lluvias fuertes se siembra. En los Valles Altos, el INIFAP recomienda sembrar entre mayo y junio, según la zona, en cuanto se asienta el temporal.",
    emergencia: "La semilla germina y asoma la plántula. Hacia el " + fecha(FEN.inicio) + " el satélite ya ve verde en el campo.",
    macollo: "La planta saca «hijos»: más tallos desde la misma base. Más tallos, más espigas.",
    encane: "Los tallos se estiran y las plantas cubren el suelo: cada semana el campo se ve más verde.",
    espiga: "Sale la espiga con sus largas aristas y la planta florece. Una sequía, un calor fuerte o una helada en esta etapa cuestan grano.",
    llenado: "El verdor llega a su punto más alto hacia el " + fecha(FEN.pico) + ". Después el grano se llena: la espiga pesa y se inclina.",
    madurez: "Las hojas amarillean y la planta se dora. El grano se endurece y se seca.",
    cosecha: "Entra la cosechadora: corta, trilla y separa el grano de la paja. Hacia el " + fecha(FEN.fin) + " ya no queda verde.",
  };
  const MARCAS = { siembra: "Inicio de temporada", llenado: "Pico de verdor", cosecha: "Fin de temporada" };

  /* --- Estructura ------------------------------------------------------------------ */

  contenedor.innerHTML = `
    <div class="crec-grid">
      <figure class="crec-escena">
        <canvas id="crec-lienzo" role="img" aria-label="Campo de cebada ilustrado que crece de la siembra a la cosecha"></canvas>
        <div class="crec-sobre" aria-hidden="true">
          <span class="crec-fecha" id="crec-fecha"></span>
          <span class="crec-clima" id="crec-clima"></span>
        </div>
        <button type="button" class="crec-play" id="crec-play" aria-label="Pausar"></button>
      </figure>
      <article class="crec-tarjeta" id="crec-tarjeta" aria-live="polite">
        <div class="crec-arriba">
          <span id="crec-cuenta">Etapa 1 de 8</span>
          <span class="crec-mes" id="crec-mes"></span>
        </div>
        <span class="crec-marca" id="crec-marca" hidden></span>
        <h3 id="crec-nombre"></h3>
        <p id="crec-texto"></p>
        <p class="crec-dato" id="crec-dato"></p>
      </article>
    </div>
    <div class="crec-linea">
      <svg class="crec-curva" id="crec-curva" viewBox="0 0 ${ANCHO_CURVA} 92" aria-hidden="true"></svg>
      <input type="range" class="crec-barra" id="crec-barra" min="${D0}" max="${D1}" step="1" value="${D0}"
             aria-label="Fecha de la temporada">
      <ol class="crec-pasos" id="crec-pasos" aria-label="Etapas del cultivo"></ol>
    </div>
    <span class="fuente">
      Fechas y verdor: mediana de las 148 parcelas que reverdecieron primero (Planet, 2025). Nubes: nubosidad semanal
      de las imágenes Planet. Lluvia: CHIRPS, promedio de la región del reto. Las etapas son aproximadas: el reto no
      trae fechas de siembra ni de cosecha, así que se reparten entre el inicio, el pico y el fin del verdor.
    </span>`;

  const $c = (id) => document.getElementById(id);
  // Íconos del botón (SVG, para que no se vean como emoji en ningún teléfono)
  const svgBoton = (cuerpo) =>
    `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">${cuerpo}</svg>`;
  const BOTON = {
    pausa: svgBoton('<rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/>'),
    play: svgBoton('<path d="M8 5.5v13l10.5-6.5Z" fill="currentColor"/>'),
    otra: svgBoton('<path d="M18.5 12a6.5 6.5 0 1 1-2.1-4.8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M17.6 3.6l.4 4.4-4.4.3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'),
  };

  const el = {
    lienzo: $c("crec-lienzo"),
    fecha: $c("crec-fecha"),
    clima: $c("crec-clima"),
    play: $c("crec-play"),
    tarjeta: $c("crec-tarjeta"),
    cuenta: $c("crec-cuenta"),
    mes: $c("crec-mes"),
    marca: $c("crec-marca"),
    nombre: $c("crec-nombre"),
    texto: $c("crec-texto"),
    dato: $c("crec-dato"),
    curva: $c("crec-curva"),
    barra: $c("crec-barra"),
    pasos: $c("crec-pasos"),
  };
  const campo = CampoCebada.crear(el.lienzo, { semilla: 23 });

  /* --- Línea de la temporada: etapas y verdor real ------------------------------- */

  const NS = "http://www.w3.org/2000/svg";
  const nodo = (tag, attrs, padre, texto) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (texto) n.textContent = texto;
    padre.appendChild(n);
    return n;
  };
  const X = (dia) => ((dia - D0) / (D1 - D0)) * ANCHO_CURVA;
  const Y = (v) => 76 - ((v - 0.15) / (0.78 - 0.15)) * 58;
  ETAPAS.forEach((e, i) => {
    nodo("rect", { x: X(e.desde), y: 14, width: Math.max(1, X(e.hasta) - X(e.desde)), height: 66, class: `crec-banda ${i % 2 ? "par" : ""}` }, el.curva);
  });
  for (let m = 4; m <= 11; m++) {
    const d = Math.round((new Date(2025, m, 1) - new Date(2025, 0, 1)) / 864e5) + 1;
    if (d < D0 || d > D1) continue;
    nodo("line", { x1: X(d), x2: X(d), y1: 14, y2: 80, class: "crec-mes-linea" }, el.curva);
    nodo("text", { x: X(d) + 4, y: 90, class: "crec-mes-txt" }, el.curva, MESES[m].slice(0, 3));
  }
  const puntos = [];
  for (let d = D0; d <= D1; d += 2) puntos.push(`${X(d).toFixed(1)},${Y(ndviEn(d)).toFixed(1)}`);
  nodo("polyline", { points: puntos.join(" "), class: "crec-ndvi-fondo" }, el.curva);
  const ndviHecha = nodo("polyline", { points: puntos.join(" "), class: "crec-ndvi" }, el.curva);
  const largoCurva = ndviHecha.getTotalLength ? ndviHecha.getTotalLength() : 1000;
  ndviHecha.style.strokeDasharray = `${largoCurva}`;
  [
    [FEN.inicio, "arranca"],
    [FEN.pico, "máximo"],
    [FEN.fin, "se apaga"],
  ].forEach(([d, txt], i) => {
    nodo("circle", { cx: X(d), cy: Y(ndviEn(d)), r: 4.5, class: "crec-hito" }, el.curva);
    nodo("text", { x: X(d) + (i === 2 ? 8 : 0), y: Y(ndviEn(d)) - 9, "text-anchor": i === 2 ? "end" : "middle", class: "crec-hito-txt" }, el.curva, `${txt} · ${fecha(d).replace(" de ", " ")}`);
  });
  nodo("text", { x: 6, y: 10, class: "crec-curva-titulo" }, el.curva, "Verdor medido en 2025 (NDVI, mediana de 148 parcelas)");
  const cursor = nodo("line", { x1: 0, x2: 0, y1: 12, y2: 80, class: "crec-cursor" }, el.curva);
  const cursorPunto = nodo("circle", { cx: 0, cy: 0, r: 6, class: "crec-cursor-punto" }, el.curva);

  ETAPAS.forEach((etapa, i) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <button type="button" aria-label="${etapa.nombre}: ${cuandoEs(etapa.desde)}">
        <span class="crec-punto">${i + 1}</span>
        <span class="crec-paso-nombre">${etapa.nombre.replace(" y floración", "")}</span>
        <small>${MESES[fechaDe(etapa.desde).getMonth()].slice(0, 3)}</small>
      </button>`;
    li.querySelector("button").addEventListener("click", () => {
      estado.dia = Math.max(D0, etapa.desde + 0.5);
      estado.jugando = !reducido();
      pintar(true);
    });
    el.pasos.appendChild(li);
  });

  /* --- Estado y dibujo ------------------------------------------------------------ */

  const estado = { dia: D0, jugando: false, iniciado: false, enPantalla: false, etapa: -2, t: 0 };

  function marcarEtapa(i) {
    if (i === estado.etapa) return;
    estado.etapa = i;
    const k = Math.max(0, i);
    const e = ETAPAS[k];
    el.cuenta.textContent = `Etapa ${k + 1} de ${ETAPAS.length}`;
    el.nombre.textContent = e.nombre;
    el.texto.textContent = TEXTOS[e.clave];
    el.marca.hidden = !MARCAS[e.clave];
    el.marca.textContent = MARCAS[e.clave] || "";
    el.lienzo.setAttribute("aria-label", `Campo de cebada en ${e.nombre.toLowerCase()}, ${cuandoEs(e.desde)}`);
    el.tarjeta.classList.remove("entra");
    void el.tarjeta.offsetWidth; // reinicia la animación de entrada
    el.tarjeta.classList.add("entra");
    [...el.pasos.children].forEach((li, j) => {
      li.classList.toggle("activa", j === k);
      li.classList.toggle("hecha", j < k);
    });
  }

  function pintar(forzar = false) {
    const d = estado.dia;
    const fen = CampoCebada.estado(d, FEN);
    marcarEtapa(fen.etapa);

    const ndvi = ndviEn(d);
    const nubes = limitar(nubesEn(d), 0.05, 0.95);
    const mm = lluviaMes(d);
    const temporal = limitar(mm / 230, 0, 1);
    const llueve = temporal * limitar((nubes - 0.3) / 0.35, 0, 1);
    campo.dibujar({
      ...fen,
      verde: limitar((ndvi - 0.2) / 0.52, 0, 1),
      lluvia: llueve,
      nubes: limitar(nubes * 0.7 + temporal * 0.35, 0, 1),
      humedad: limitar(0.15 + mm / 230, 0.15, 0.95),
      otono: limitar((d - 262) / 40, 0, 1),
      t: reducido() ? 2 : estado.t,
    });

    el.fecha.textContent = cuandoEs(d);
    el.mes.textContent = cuandoEs(d);
    el.clima.textContent = llueve > 0.15 ? `Lluvia de temporal · ${Math.round(mm)} mm en ${MESES[fechaDe(d).getMonth()]}` : `${Math.round(nubes * 100)} % de nubes`;
    el.dato.textContent = `Verdor medido esta semana: NDVI ${Util.fmt(ndvi, 2)}`;
    if (forzar || document.activeElement !== el.barra) el.barra.value = Math.round(d);

    const x = X(d);
    cursor.setAttribute("x1", x.toFixed(1));
    cursor.setAttribute("x2", x.toFixed(1));
    cursorPunto.setAttribute("cx", x.toFixed(1));
    cursorPunto.setAttribute("cy", Y(ndvi).toFixed(1));
    ndviHecha.style.strokeDashoffset = `${(largoCurva * (1 - (d - D0) / (D1 - D0))).toFixed(1)}`;

    const terminado = d >= D1 - 0.01;
    const boton = estado.jugando ? "pausa" : terminado ? "otra" : "play";
    if (el.play.dataset.icono !== boton) {
      el.play.dataset.icono = boton;
      el.play.innerHTML = BOTON[boton];
      el.play.setAttribute("aria-label", estado.jugando ? "Pausar" : terminado ? "Ver otra vez" : "Reproducir");
    }
  }

  let previo = performance.now();
  function cuadro(ahora) {
    const dt = Math.min(0.06, (ahora - previo) / 1000);
    previo = ahora;
    if (estado.enPantalla) {
      if (campo.ajustar()) estado.etapa = -2;
      if (estado.jugando) {
        estado.dia = Math.min(D1, estado.dia + ((D1 - D0) / SEGUNDOS) * dt);
        if (estado.dia >= D1) estado.jugando = false;
      }
      if (!reducido()) estado.t += dt;
      pintar();
    }
    requestAnimationFrame(cuadro);
  }

  el.play.addEventListener("click", () => {
    if (estado.dia >= D1 - 0.01) estado.dia = D0;
    estado.jugando = !estado.jugando && !reducido();
    if (reducido() && estado.dia < D1) estado.dia = Math.min(D1, ETAPAS[Math.min(7, Math.max(0, estado.etapa) + 1)].desde + 0.5);
    pintar(true);
  });
  el.barra.addEventListener("input", () => {
    estado.jugando = false;
    estado.dia = Number(el.barra.value);
    pintar();
  });

  // Empieza sola la primera vez que la sección se ve; se detiene al salir
  new IntersectionObserver(
    (entradas) => {
      entradas.forEach((entrada) => {
        estado.enPantalla = entrada.isIntersecting;
        if (entrada.isIntersecting && !estado.iniciado) {
          estado.iniciado = true;
          estado.dia = D0;
          estado.jugando = !reducido();
          if (reducido()) estado.dia = ETAPAS[4].desde + 1;
        }
      });
    },
    { threshold: 0.3 }
  ).observe(document.getElementById("crecimiento"));

  pintar(true);
  requestAnimationFrame(cuadro);
})();
