"use strict";

/*
 * Sección «Crecimiento» de la vista principal (storytime).
 *
 * Una parcela de cebada crece de la siembra a la cosecha, UNA ETAPA A LA VEZ:
 * se anima la etapa, se detiene y se explica con una tarjeta corta. Con
 * «Siguiente» avanza a la próxima; con «Ver toda la temporada» corre seguida.
 * La última etapa termina con la cosechadora.
 *
 * Las fechas NO están escritas a mano: salen de la curva de verdor (NDVI)
 * mediana de las 197 parcelas reales de 2025 (data.js):
 *   inicio = la semana en que el verdor sube un 15 % hacia su máximo
 *   pico   = la semana de verdor máximo
 *   fin    = la semana en que, tras el pico, cae a la mitad (la planta se seca)
 *
 * Depende de (vistas/compartido): common.js ($, Util, Paleta) y data.js (DATA).
 * Contenedor: <div id="crecimiento-demo"></div> dentro de <section id="crecimiento">.
 *
 * Fuentes del texto: INIFAP (Zamora Díaz et al. 2008 y 2017: siembra de
 * temporal de mayo a junio, madurez a los 90–132 días, heladas tempranas) y
 * Gómez-Espinoza et al. 2025 (espigamiento y llenado son las etapas críticas).
 */

(() => {
  const contenedor = $("#crecimiento-demo");
  if (!contenedor) return;

  const { clamp, suave } = Util;
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  /* --- Fechas de la temporada a partir de los datos reales -------------- */

  const verdor = [];
  for (let w = 0; w < 52; w++) {
    const valores = DATA.P.map((p) => p.n[w]).sort((a, b) => a - b);
    verdor.push(valores[valores.length >> 1]);
  }

  let pico = 20;
  for (let w = 20; w <= 48; w++) if (verdor[w] > verdor[pico]) pico = w;
  const base = Math.min(...verdor.slice(14, pico + 1));
  const cruza = (fraccion) => base + fraccion * (verdor[pico] - base);

  let inicio = pico - 10;
  for (let w = 14; w <= pico; w++) {
    if (verdor[w] >= cruza(0.15)) {
      inicio = w;
      break;
    }
  }
  let fin = Math.min(49, pico + 9);
  for (let w = pico; w < 52; w++) {
    if (verdor[w] <= cruza(0.5)) {
      fin = w;
      break;
    }
  }

  /* --- Etapas (texto corto, para leer de un vistazo) ---------------------- */

  const ETAPAS = [
    { clave: "siembra", nombre: "Siembra", marca: "Inicio de temporada", desde: inicio - 3, hasta: inicio - 1.5,
      texto: "Llegan las lluvias de temporal y se siembra. En los Valles Altos, entre mayo y junio." },
    { clave: "emergencia", nombre: "Emergencia", desde: inicio - 1.5, hasta: inicio,
      texto: "La semilla germina y asoma la plántula. Necesita que el suelo siga húmedo." },
    { clave: "macollo", nombre: "Amacollamiento", desde: inicio, hasta: inicio + 4,
      texto: "La planta saca «hijos»: más tallos desde la misma semilla. Más tallos, más espigas." },
    { clave: "encane", nombre: "Encañe", desde: inicio + 4, hasta: pico - 2,
      texto: "Los tallos se estiran rápido y el campo se pone cada semana más verde." },
    { clave: "espiga", nombre: "Espigamiento", marca: "Pico", desde: pico - 2, hasta: pico + 1.5,
      texto: "Sale la espiga y florece: el campo está en su máximo verde. Sequía, calor o helada aquí cuestan grano." },
    { clave: "llenado", nombre: "Llenado de grano", desde: pico + 1.5, hasta: fin - 1,
      texto: "El grano se llena y pesa: la espiga se inclina y las hojas empiezan a amarillear." },
    { clave: "madurez", nombre: "Madurez", desde: fin - 1, hasta: fin + 1,
      texto: "La planta se seca y se vuelve dorada. El grano está duro; solo falta que se seque." },
    { clave: "cosecha", nombre: "Cosecha", marca: "Fin de temporada", desde: fin + 1, hasta: fin + 3.5,
      texto: "Entra la cosechadora: corta, trilla y separa el grano de la paja. ¡Temporada terminada!" },
  ];

  const W_INICIO = ETAPAS[0].desde;
  const W_FIN = ETAPAS.at(-1).hasta;
  const SEGUNDOS_POR_ETAPA = 3.2;
  const SEGUNDOS_COSECHA = 5.5;
  const E = Object.fromEntries(ETAPAS.map((e) => [e.clave, e]));

  /* --- Fechas legibles ---------------------------------------------------- */

  const fechaDe = (w) => new Date(2025, 0, 1 + Math.round(w * 7));
  const mesDe = (w) => MESES[fechaDe(w).getMonth()];
  function cuandoEs(w) {
    const fecha = fechaDe(w);
    const parte = fecha.getDate() <= 10 ? "principios" : fecha.getDate() <= 20 ? "mediados" : "finales";
    return `${parte} de ${MESES[fecha.getMonth()]}`;
  }

  /* --- Estado ------------------------------------------------------------ */

  // parada: semana en la que la animación se detiene sola (fin de la etapa actual)
  const estado = { w: W_INICIO, jugando: false, parada: W_FIN, iniciado: false, enPantalla: false, etapa: -1 };

  /* --- Estructura -------------------------------------------------------- */

  contenedor.innerHTML = `
    <div class="crec-grid">
      <svg class="crec-escena" id="crec-escena" viewBox="0 0 480 270" role="img"
           aria-label="Parcela de cebada que crece desde la siembra hasta la cosecha"></svg>
      <article class="crec-tarjeta" id="crec-tarjeta" aria-live="polite">
        <div class="crec-arriba">
          <span id="crec-cuenta">Etapa 1 de 8</span>
          <span class="crec-mes" id="crec-mes">mayo</span>
        </div>
        <span class="crec-marca" id="crec-marca" hidden></span>
        <h3 id="crec-nombre">Siembra</h3>
        <p id="crec-texto"></p>
        <div class="crec-botones">
          <button id="crec-ant" aria-label="Etapa anterior">←</button>
          <button id="crec-sig" class="crec-sig">Siguiente etapa →</button>
        </div>
        <button id="crec-todo" class="crec-todo">▶ Ver toda la temporada</button>
      </article>
    </div>
    <ol class="crec-pasos" id="crec-pasos" aria-label="Etapas del cultivo"></ol>
    <span class="fuente">Fechas de un campo «típico» del reto, calculadas con el verdor que vio el satélite en las 197 parcelas (2025).</span>`;

  const el = {
    escena: $("#crec-escena"),
    tarjeta: $("#crec-tarjeta"),
    cuenta: $("#crec-cuenta"),
    mes: $("#crec-mes"),
    marca: $("#crec-marca"),
    nombre: $("#crec-nombre"),
    texto: $("#crec-texto"),
    ant: $("#crec-ant"),
    sig: $("#crec-sig"),
    todo: $("#crec-todo"),
    pasos: $("#crec-pasos"),
  };

  // Línea de pasos: un punto por etapa con su mes (sin gráficas)
  ETAPAS.forEach((etapa, i) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <button aria-label="${etapa.nombre}, ${cuandoEs(etapa.desde)}">
        ${etapa.marca ? `<em>${etapa.marca.split(" ")[0]}</em>` : ""}
        <span class="crec-punto">${i + 1}</span>
        <span class="crec-paso-nombre">${etapa.nombre}</span>
        <small>${mesDe(etapa.desde).slice(0, 3)}</small>
      </button>`;
    li.querySelector("button").addEventListener("click", () => irAEtapa(i));
    el.pasos.appendChild(li);
  });

  /* --- Dibujo de la escena ---------------------------------------------- */

  const SUELO = 226;
  const PLANTAS = [
    { x: 62, s: 0.82 },
    { x: 124, s: 0.95 },
    { x: 186, s: 1 },
    { x: 248, s: 0.9 },
    { x: 310, s: 0.97 },
    { x: 372, s: 0.86 },
    { x: 428, s: 0.8 },
  ];
  const VERDE = "#6f9a58";
  const DORADO = "#d3a94a";
  const PAJA = "#c9a35a";

  function mezclaColor(a, b, t) {
    const parte = (hex, i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
    return "#" + [0, 1, 2].map((i) => Math.round(parte(a, i) + (parte(b, i) - parte(a, i)) * t).toString(16).padStart(2, "0")).join("");
  }

  const avance = (w, etapa) => clamp((w - etapa.desde) / (etapa.hasta - etapa.desde), 0, 1);
  const f = (n) => n.toFixed(1);

  // Posición del frente de la cosechadora (va de derecha a izquierda)
  const frenteCosechadora = (w) => {
    const k = avance(w, E.cosecha);
    return 500 - k * 640;
  };

  function dibujarPlanta(planta, w, t) {
    const { x, s } = planta;

    // Antes de emerger: semilla bajo el suelo (y una raíz cuando germina)
    const germina = avance(w, E.emergencia);
    if (w < E.emergencia.desde + 0.3) {
      const visible = avance(w, E.siembra);
      return `
        <ellipse cx="${x}" cy="${SUELO + 12}" rx="4.2" ry="2.6" fill="${DORADO}" stroke="#6b5a2e" stroke-width=".7"
                 opacity="${f(visible)}" transform="rotate(-20 ${x} ${SUELO + 12})"/>
        ${germina > 0 ? `<path d="M${x} ${SUELO + 14} q 2 6 -1 10" stroke="#e9e0c9" stroke-width="1.2" fill="none"/>` : ""}`;
    }

    // Cosechada: solo queda el rastrojo
    if (w >= E.cosecha.desde && x > frenteCosechadora(w) + 6) {
      return [-4, 0, 4].map((d) => `<line x1="${x + d}" y1="${SUELO}" x2="${x + d * 1.3}" y2="${SUELO - 9}" stroke="${PAJA}" stroke-width="2"/>`).join("");
    }

    const crecimiento = suave(clamp((w - E.emergencia.desde) / (E.espiga.hasta - E.emergencia.desde), 0, 1));
    const alto = s * (8 + 128 * Math.pow(crecimiento, 1.25));
    const madurez = clamp((w - E.llenado.desde) / (E.madurez.hasta - E.llenado.desde), 0, 1);
    const colorPlanta = mezclaColor(VERDE, DORADO, madurez);
    const tallos = 1 + Math.round(2 * avance(w, E.macollo));
    const espiga = avance(w, E.espiga);
    const balanceo = Math.sin(t * 1.4 + x) * 2 * (0.4 + crecimiento);

    let svg = "";
    for (let k = 0; k < tallos; k++) {
      const angulo = tallos === 1 ? 0 : (k - (tallos - 1) / 2) * 9;
      const h = alto * (k === Math.floor(tallos / 2) ? 1 : 0.88);
      const rad = (angulo * Math.PI) / 180;
      const xTop = x + Math.sin(rad) * h + balanceo;
      const yTop = SUELO - Math.cos(rad) * h;

      // Tallo
      svg += `<path d="M${x} ${SUELO} Q ${f(x + Math.sin(rad) * h * 0.5)} ${f(SUELO - h * 0.55)} ${f(xTop)} ${f(yTop)}"
                    fill="none" stroke="${colorPlanta}" stroke-width="${f(1.4 + 1.6 * crecimiento)}" stroke-linecap="round"/>`;

      // Hojas
      const nHojas = crecimiento < 0.15 ? 1 : 3;
      for (let j = 0; j < nHojas; j++) {
        const fr = 0.18 + j * 0.24;
        const px = x + (xTop - x) * fr;
        const py = SUELO - (SUELO - yTop) * fr;
        const largo = s * (8 + 34 * Math.min(1, crecimiento * 1.6)) * (1 - j * 0.15) * (1 - 0.35 * madurez);
        const lado = (j + k) % 2 ? 1 : -1;
        const caida = madurez * 12;
        svg += `<path d="M0 0 Q ${f(largo * 0.5)} ${f(-largo * 0.45 + caida * 0.5)} ${f(largo)} ${f(-largo * 0.1 + caida)} Q ${f(largo * 0.5)} ${f(-largo * 0.08 + caida * 0.3)} 0 0Z"
                      transform="translate(${f(px)} ${f(py)}) scale(${lado} 1)" fill="${mezclaColor(VERDE, DORADO, Math.min(1, madurez * 1.15))}"/>`;
      }

      // Espiga: sale en el espigamiento y se inclina al llenarse
      if (espiga > 0) {
        const largo = 26 * s * espiga;
        const inclina = madurez * 38 * (angulo >= 0 ? 1 : -1) + angulo;
        const granos = [];
        for (let g = 0; g < 6; g++) {
          const gy = -4 - (g / 6) * largo;
          const tam = (2.6 + 1.8 * madurez) * espiga;
          const color = mezclaColor(VERDE, DORADO, clamp(madurez * 1.3, 0, 1));
          granos.push(
            `<ellipse cx="-3.4" cy="${f(gy)}" rx="${f(tam * 0.7)}" ry="${f(tam)}" transform="rotate(-18 -3.4 ${f(gy)})" fill="${color}" stroke="#6b5a2e" stroke-width=".5"/>`,
            `<ellipse cx="3.4" cy="${f(gy)}" rx="${f(tam * 0.7)}" ry="${f(tam)}" transform="rotate(18 3.4 ${f(gy)})" fill="${color}" stroke="#6b5a2e" stroke-width=".5"/>`,
            `<line x1="-4" y1="${f(gy - tam)}" x2="-10" y2="${f(gy - tam - 13 * espiga)}" stroke="${DORADO}" stroke-width=".7"/>`,
            `<line x1="4" y1="${f(gy - tam)}" x2="10" y2="${f(gy - tam - 13 * espiga)}" stroke="${DORADO}" stroke-width=".7"/>`
          );
        }
        svg += `<g transform="translate(${f(xTop)} ${f(yTop)}) rotate(${f(inclina)})">${granos.join("")}</g>`;

        // Floración: pequeñas anteras amarillas en el pico
        const flor = Math.sin(Math.PI * avance(w, E.espiga));
        if (flor > 0.2 && madurez === 0) {
          svg += `<circle cx="${f(xTop + 5)}" cy="${f(yTop - largo * 0.5)}" r="1.6" fill="#f3e28a" opacity="${f(flor)}"/>
                  <circle cx="${f(xTop - 5)}" cy="${f(yTop - largo * 0.3)}" r="1.6" fill="#f3e28a" opacity="${f(flor)}"/>`;
        }
      }
    }
    return svg;
  }

  function dibujarCosechadora(w, t) {
    if (w < E.cosecha.desde) return "";
    const k = avance(w, E.cosecha);
    const x = frenteCosechadora(w);
    const giro = (t * 260) % 360;
    const vibra = k < 1 ? Math.sin(t * 30) * 0.6 : 0;
    const polvo =
      k < 1
        ? [0, 1, 2, 3]
            .map((i) => {
              const fase = (t * 1.8 + i * 0.25) % 1;
              return `<circle cx="${f(x + 100 + fase * 40)}" cy="${f(SUELO - 6 - fase * 18)}" r="${f(3 + fase * 6)}" fill="${PAJA}" opacity="${f(0.45 * (1 - fase))}"/>`;
            })
            .join("")
        : "";

    return `
      ${polvo}
      <g transform="translate(${f(x)} ${f(SUELO + vibra)})" class="crec-cosechadora">
        <!-- cabezal y molinete -->
        <rect x="-4" y="-24" width="20" height="16" rx="3" fill="#b2402f"/>
        <g transform="translate(6 -32) rotate(${f(-giro)})">
          <circle r="11" fill="none" stroke="#7a2a1f" stroke-width="2"/>
          <line x1="-11" y1="0" x2="11" y2="0" stroke="#7a2a1f" stroke-width="2"/>
          <line x1="0" y1="-11" x2="0" y2="11" stroke="#7a2a1f" stroke-width="2"/>
        </g>
        <!-- cuerpo -->
        <rect x="14" y="-52" width="80" height="40" rx="6" fill="#d44a35"/>
        <rect x="22" y="-76" width="28" height="24" rx="4" fill="#d44a35"/>
        <rect x="26" y="-72" width="20" height="14" rx="2" fill="#cde3ef"/>
        <!-- tubo de descarga -->
        <path d="M74 -52 L 96 -74" stroke="#7a2a1f" stroke-width="4" stroke-linecap="round"/>
        <!-- llantas -->
        <circle cx="34" cy="-8" r="13" fill="#2c2c2c"/><circle cx="34" cy="-8" r="5" fill="#9a9a9a"/>
        <circle cx="82" cy="-6" r="9" fill="#2c2c2c"/><circle cx="82" cy="-6" r="3.5" fill="#9a9a9a"/>
      </g>`;
  }

  function dibujarEscena(w, t) {
    const semana = clamp(Math.floor(w), 0, 51);
    const nubosidad = (DATA.cli.cld[semana] ?? 30) / 100; // nubosidad real de 2025
    const temporal = w >= E.siembra.desde && w <= E.llenado.desde + 2; // lluvias de verano
    const lluvia = temporal && nubosidad > 0.4;

    const gotas = lluvia
      ? Array.from({ length: 9 }, (_, i) => {
          const fase = (t * 1.3 + i * 0.37) % 1;
          const gx = 40 + i * 9 + (i % 2) * 4;
          return `<line x1="${gx}" y1="${f(66 + fase * 60)}" x2="${gx - 2}" y2="${f(72 + fase * 60)}" stroke="#5aa0d8" stroke-width="1.6" opacity="${f(1 - fase)}"/>`;
        }).join("")
      : "";

    const cosecha = avance(w, E.cosecha);
    const grano =
      cosecha >= 1
        ? `<g transform="translate(210 ${SUELO + 2})">
             <path d="M0 0 Q 30 -42 60 0 Z" fill="${DORADO}" stroke="#6b5a2e" stroke-width=".8"/>
             <text x="30" y="-52" text-anchor="middle" font-size="13">¡Cosecha lista!</text>
             <text x="30" y="-38" text-anchor="middle">grano → báscula</text>
           </g>
           ${[70, 360].map((x) => `<g transform="translate(${x} ${SUELO - 16})">
             <rect width="34" height="18" rx="5" fill="${PAJA}" stroke="#6b5a2e" stroke-width=".8"/>
             <path d="M6 4 V14 M17 4 V14 M28 4 V14" stroke="#6b5a2e" stroke-opacity=".5"/>
           </g>`).join("")}
           <text x="377" y="${SUELO - 22}" text-anchor="middle">paja → ganado</text>`
        : "";

    el.escena.innerHTML = `
      <rect width="480" height="270" fill="var(--sky)"/>
      <circle cx="425" cy="46" r="17" fill="var(--gold)" opacity="${f(0.5 + 0.5 * (1 - nubosidad))}"/>
      <g fill="var(--line)" stroke="var(--ink)" stroke-opacity=".3" opacity="${f(0.2 + 0.8 * nubosidad)}">
        <ellipse cx="78" cy="52" rx="38" ry="14"/><ellipse cx="60" cy="43" rx="18" ry="13"/><ellipse cx="94" cy="41" rx="20" ry="15"/>
      </g>
      ${gotas}
      <text x="78" y="24" text-anchor="middle" opacity=".75">${lluvia ? "lluvias de temporal" : `nubes ${Math.round(nubosidad * 100)}%`}</text>
      <rect x="0" y="${SUELO}" width="480" height="64" fill="#a9865a" opacity=".55"/>
      <path d="M0 ${SUELO + 1} H480" stroke="#6b5a2e" stroke-opacity=".35"/>
      ${PLANTAS.map((p) => dibujarPlanta(p, w, t)).join("")}
      ${dibujarCosechadora(w, t)}
      ${grano}`;
  }

  /* --- Etapas: tarjeta y bucle ------------------------------------------- */

  function etapaDe(w) {
    for (let i = 0; i < ETAPAS.length; i++) if (w < ETAPAS[i].hasta - 1e-6) return i;
    return ETAPAS.length - 1;
  }

  function marcarEtapa(i) {
    if (i === estado.etapa) return;
    estado.etapa = i;
    const etapa = ETAPAS[i];

    el.cuenta.textContent = `Etapa ${i + 1} de ${ETAPAS.length}`;
    el.nombre.textContent = etapa.nombre;
    el.texto.textContent = etapa.texto;
    el.marca.hidden = !etapa.marca;
    el.marca.textContent = etapa.marca || "";
    el.ant.disabled = i === 0;

    el.tarjeta.classList.remove("entra");
    void el.tarjeta.offsetWidth; // reinicia la animación de entrada
    el.tarjeta.classList.add("entra");

    [...el.pasos.children].forEach((li, k) => {
      li.classList.toggle("activa", k === i);
      li.classList.toggle("hecha", k < i);
    });
  }

  function dibujar() {
    const w = estado.w;
    const i = etapaDe(w);
    marcarEtapa(i);
    dibujarEscena(w, performance.now() / 1000);
    el.mes.textContent = cuandoEs(w);

    const ultima = i === ETAPAS.length - 1;
    const terminada = w >= W_FIN - 1e-3;
    el.sig.textContent = terminada ? "↻ Volver a empezar" : ultima ? "Cosechando…" : "Siguiente etapa →";
    el.sig.disabled = ultima && !terminada;
    el.sig.classList.toggle("lista", !estado.jugando);
    el.todo.textContent = estado.jugando && estado.parada === W_FIN ? "⏸ Pausar" : "▶ Ver toda la temporada";
  }

  let previo = performance.now();
  function ciclo(ahora) {
    const dt = Math.min(0.05, (ahora - previo) / 1000);
    previo = ahora;

    if (estado.enPantalla) {
      if (estado.jugando) {
        const etapa = ETAPAS[etapaDe(estado.w)];
        const segundos = etapa.clave === "cosecha" ? SEGUNDOS_COSECHA : SEGUNDOS_POR_ETAPA;
        estado.w = Math.min(estado.parada, estado.w + ((etapa.hasta - etapa.desde) / segundos) * dt);
        if (estado.w >= estado.parada) estado.jugando = false;
      }
      dibujar();
    }
    requestAnimationFrame(ciclo);
  }

  // Anima una sola etapa y se detiene al terminarla
  function irAEtapa(i) {
    const etapa = ETAPAS[i];
    if (Paleta.movimientoReducido()) {
      estado.jugando = false;
      estado.w = etapa.hasta - 1e-3;
    } else {
      estado.w = etapa.desde;
      estado.parada = etapa.hasta - 1e-3;
      estado.jugando = true;
    }
    dibujar();
  }

  el.sig.addEventListener("click", () => {
    if (estado.w >= W_FIN - 1e-3) return irAEtapa(0);
    const i = etapaDe(estado.w);
    // Si la etapa actual aún se está animando, salta a su final; si no, avanza
    if (estado.jugando) {
      estado.jugando = false;
      estado.w = ETAPAS[i].hasta - 1e-3;
      dibujar();
    } else {
      irAEtapa(Math.min(ETAPAS.length - 1, i + 1));
    }
  });

  el.ant.addEventListener("click", () => irAEtapa(Math.max(0, etapaDe(estado.w) - 1)));

  el.todo.addEventListener("click", () => {
    if (estado.jugando && estado.parada === W_FIN) {
      estado.jugando = false;
    } else {
      if (estado.w >= W_FIN - 1e-3) estado.w = W_INICIO;
      estado.parada = W_FIN;
      estado.jugando = !Paleta.movimientoReducido();
      if (!estado.jugando) estado.w = W_FIN;
    }
    dibujar();
  });

  // Al llegar a la sección se anima la primera etapa y se espera al usuario
  new IntersectionObserver(
    (entradas) => {
      entradas.forEach((entrada) => {
        estado.enPantalla = entrada.isIntersecting;
        if (entrada.isIntersecting && !estado.iniciado) {
          estado.iniciado = true;
          irAEtapa(0);
        }
      });
    },
    { threshold: 0.3 }
  ).observe($("#crecimiento"));

  dibujar();
  requestAnimationFrame(ciclo);
})();
