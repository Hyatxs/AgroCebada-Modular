"use strict";

/*
 * Sección «Territorio» de la vista principal (storytime).
 *
 * Mapa grande e interactivo: eliges Puebla, Tlaxcala o Hidalgo (botón o
 * tocando el mapa), el mapa se acerca al estado y a un lado aparece solo lo
 * esencial. El detalle se abre tocando un factor (altura, lluvia,
 * temperatura, heladas): «lo ideal» frente a «en este estado».
 *
 * Depende de (vistas/compartido): common.js ($, Util, Paleta), estados.js (ESTADOS_MEXICO),
 * vistas/07-modelo/datos-modelo.js (MODELO_HGP: estado y rendimiento de cada parcela) y
 * vistas/01-introduccion/temporada-datos.js (TEMPORADA.por_estado: altura, lluvia y temperatura
 * medidas en las parcelas de cada estado en 2025). No modifica ninguno de ellos.
 * Contenedor: <div id="territorio-demo"></div> dentro de <section id="territorio">.
 *
 * Fuentes (ver también referencias.html):
 *  [1] Zamora Díaz et al. (2017). Maravilla: variedad de cebada forrajera para
 *      Valles Altos de México. Rev. Mex. Cienc. Agríc. 8(6). → lluvia por zona,
 *      siembra de temporal, heladas tempranas, suelos.
 *  [2] Gómez Mercado et al. (2009). Agric. Téc. Méx. 35(1). → ensayos en Villa de Tezontepec (2,355 m),
 *      Apan (2,547 m) y Almoloya (2,730 m); media de 12.2 a 15.5 °C en el ciclo; en Almoloya la
 *      madurez fisiológica llegó del 20 al 27 de octubre.
 *  [3] Gómez-Espinoza et al. (2025). Rev. Fitotec. Mex. 48(3). → rinde mejor si espiga y llena
 *      el grano con temperaturas moderadas; arriba de 30 °C sube la proteína del grano.
 *  [6] FAO Ecocrop (Hordeum vulgare). → óptimo de 15 a 20 °C; en el trópico, arriba de 1,800 m.
 *  [4] Zamora Díaz et al. (2008). Agric. Téc. Méx. 34(4). → se adapta a climas con ≥ 500 mm anuales.
 *  [7] Hispanopedia, «Valle de Apan» → municipios de los Llanos de Apan (Hidalgo, Tlaxcala, Puebla, Edomex).
 *  [5] SIAP 2024 (ya citado en el proyecto) → participación de cada estado.
 *
 */

(() => {
  const contenedor = $("#territorio-demo");
  if (!contenedor) return;

  const ESTADOS = ["Puebla", "Tlaxcala", "Hidalgo"];

  /* --- Factores: lo ideal (igual para todos) ----------------------------- */

  // Íconos de línea (24 × 24), dibujados con el color del texto
  const ICONOS = {
    altura: '<path d="M2.5 19.5 9 8.5l3.4 5.6 2.9-4.1 6.2 9.5Z"/><path d="m7.2 11.6 1.8 1.2 1.6-1.4"/>',
    lluvia: '<path d="M7 14.5h9.6a3.4 3.4 0 0 0 .5-6.8 5 5 0 0 0-9.6-.4A3.6 3.6 0 0 0 7 14.5Z"/><path d="m8.5 17.5-1 2.5M12.5 17.5l-1 2.5M16.5 17.5l-1 2.5"/>',
    temp: '<path d="M10 13.6V5a2 2 0 0 1 4 0v8.6a4 4 0 1 1-4 0Z"/><path d="M12 9.5v6.8"/>',
    heladas: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="m9.6 4.6 2.4 2 2.4-2M9.6 19.4l2.4-2 2.4 2M4.6 10.8l3.1-.6-1-3M19.4 13.2l-3.1.6 1 3M6.7 16.8l1-3-3.1-.6M17.3 7.2l-1 3 3.1.6"/>',
  };
  const icono = (clave) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONOS[clave]}</svg>`;

  const FACTORES = [
    { clave: "altura", nombre: "Altura", ideal: "Fresco de altura: en el trópico, arriba de 1,800 m", porque: "El fresco de la altura le da más tiempo al grano para llenarse." },
    { clave: "lluvia", nombre: "Lluvia", ideal: "500 mm o más en el año", porque: "Es cultivo de temporal: con menos de 450 mm el rendimiento baja." },
    { clave: "temp", nombre: "Temperatura", ideal: "Templada: lo óptimo es de 15 a 20 °C", porque: "Rinde mejor si espiga y llena el grano con temperaturas moderadas; arriba de 30 °C el grano acumula más proteína." },
    { clave: "heladas", nombre: "Heladas", ideal: "Que no lleguen antes de cosechar", porque: "Una helada temprana daña el grano que aún está lleno de agua." },
  ];

  /* --- Cada estado (corto). "si" = cumple, "ojo" = depende del año ------- */

  const INFO = {
    Puebla: {
      lema: "Llanos altos y de temporal",
      frase: "El 16 % de la cebada del país en 2024 (SIAP). Las 100 parcelas del reto están en Chignahuapan, en la Sierra Norte.",
      altura: ["si", "Sus parcelas están en lo alto de la Sierra Norte."],
      lluvia: ["ojo", "Depende del año: si las lluvias se atrasan, la siembra también."],
      temp: ["si", "Templado y fresco durante el temporal."],
      heladas: ["ojo", "Las heladas tempranas de otoño son un riesgo en las partes altas (INIFAP)."],
      consejo: "Sembrar en cuanto se asienten las lluvias de junio, para cosechar antes de las heladas.",
    },
    Tlaxcala: {
      lema: "Pequeño, pero muy cebadero",
      frase: "El 16 % de la cebada del país en 2024 (SIAP). Sus parcelas del reto están en Calpulalpan y Nanacamilpa, en los Llanos de Apan que comparte con Hidalgo.",
      altura: ["si", "Está en el Altiplano, en tierras altas y frescas."],
      lluvia: ["ojo", "Un año seco o con lluvias irregulares se nota en la cosecha."],
      temp: ["si", "Valles frescos: el grano se llena sin calor."],
      heladas: ["ojo", "Riesgo en otoño en las partes más altas."],
      consejo: "Elegir suelos que guarden humedad y variedades de ciclo corto en las zonas frías.",
    },
    Hidalgo: {
      lema: "El mayor productor del país",
      frase: "El mayor productor del país en 2024: el 24 % de la cebada (SIAP). Sus parcelas del reto están en seis municipios del sureste del estado: Almoloya, Apan, Cuautepec, Emiliano Zapata, Singuilucan y Tepeapulco; todos menos Singuilucan, en los Llanos de Apan.",
      altura: ["si", "Los ensayos de cebada del INIFAP en Hidalgo se hicieron entre 2,355 y 2,730 m."],
      lluvia: ["ojo", "Clima templado seco: cuenta mucho que el suelo guarde agua."],
      temp: ["si", "Templado: en esos ensayos, de 12 a 15.5 °C de media durante el ciclo."],
      heladas: ["ojo", "En Almoloya (2,730 m), el sitio más alto de esos ensayos, el grano maduró hasta fines de octubre."],
      consejo: "En las partes altas, sembrar temprano; en las bajas, cuidar el agua del suelo.",
    },
  };

  /* --- Datos reales del reto por estado --------------------------------- */

  // Cada parcela trae su estado en MODELO_HGP (data.js va ordenado por clave, no por estado)
  const PARCELAS = (window.MODELO_HGP && MODELO_HGP.parcelas) || [];
  const MEDIDO = (window.TEMPORADA && TEMPORADA.por_estado) || {};
  const RETO = ESTADOS.map((nombre) => {
    const parcelas = PARCELAS.filter((p) => p.edo === nombre);
    const conocidas = parcelas.filter((p) => !p.pred && p.y_obs !== null).map((p) => p.y_obs);
    return {
      parcelas: parcelas.length,
      hectareas: parcelas.reduce((suma, p) => suma + (p.ha || 0), 0),
      promedio: conocidas.length ? conocidas.reduce((a, b) => a + b, 0) / conocidas.length : NaN,
    };
  });

  // Lo que se midió en sus parcelas en 2025, por factor
  const miles = (v) => Math.round(v).toLocaleString("es-MX");
  function medido(nombre, clave) {
    const m = MEDIDO[nombre];
    if (!m) return "";
    if (clave === "altura") return `De ${miles(m.elev_min)} a ${miles(m.elev_max)} m de altura (INEGI).`;
    if (clave === "lluvia") return `${miles(m.lluvia_temporada)} mm en la temporada de 2025 (mediana, CHIRPS).`;
    if (clave === "temp") return `${Util.fmt(m.tmedia_temporada, 1)} °C de media en la temporada de 2025 (CHIRTS-ERA5).`;
    if (clave === "heladas") return `Mínima promedio de ${Util.fmt(m.tmin_tardia, 1)} °C en el tramo final de la temporada de 2025, del llenado del grano al fin del verdor (mediana, CHIRTS-ERA5). Son datos mensuales: una helada de una noche no se ve.`;
    return "";
  }

  /* --- Mapa SVG ----------------------------------------------------------- */

  // Proyección simple con corrección por latitud (cos 19.5° ≈ 0.94), para que
  // las formas no se vean estiradas a lo ancho.
  const COS_LAT = Math.cos((19.5 * Math.PI) / 180);
  const LIMITES = { lonMin: -101.6, lonMax: -95.4, latMin: 17.6, latMax: 21.7 };
  const ANCHO = 520;
  const ALTO = Math.round((ANCHO * (LIMITES.latMax - LIMITES.latMin)) / ((LIMITES.lonMax - LIMITES.lonMin) * COS_LAT));
  const proyectar = ([lon, lat]) => [
    ((lon - LIMITES.lonMin) / (LIMITES.lonMax - LIMITES.lonMin)) * ANCHO,
    ((LIMITES.latMax - lat) / (LIMITES.latMax - LIMITES.latMin)) * ALTO,
  ];
  const ruta = (anillo) => anillo.map((p, i) => (i ? "L" : "M") + proyectar(p).map((v) => v.toFixed(1)).join(",")).join("") + "Z";
  const dentro = ([lon, lat]) => lon > LIMITES.lonMin + 0.9 && lon < LIMITES.lonMax - 0.9 && lat > LIMITES.latMin + 0.2 && lat < LIMITES.latMax - 0.2;

  function cajaDe(anillo) {
    const puntos = anillo.map(proyectar);
    const xs = puntos.map((p) => p[0]);
    const ys = puntos.map((p) => p[1]);
    return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  }

  // Dónde va el nombre de cada estado [lon, lat]
  const ETIQUETAS = { Puebla: [-97.75, 18.75], Tlaxcala: [-98.18, 19.42], Hidalgo: [-98.95, 20.55] };
  const SILUETAS = typeof SILUETAS_ESTADOS !== "undefined" ? SILUETAS_ESTADOS : {};

  const OBJETIVOS = ESTADOS.map((nombre) => {
    // Contorno real (siluetas-estados.js); si no está, el dibujado a mano de estados.js
    const anillo = SILUETAS[nombre] || ESTADOS_MEXICO.find((e) => e.nombre === nombre).anillo;
    const caja = cajaDe(anillo);
    return { nombre, anillo, caja, etiqueta: proyectar(ETIQUETAS[nombre]) };
  });

  function dibujarMapa() {
    // Vecinos: solo su nombre, tenue (sus fronteras dibujadas a mano no coinciden
    // con los contornos reales y se veían encimadas)
    const vecinos = ESTADOS_MEXICO.filter((e) => !ESTADOS.includes(e.nombre) && e.etiqueta && dentro(e.etiqueta))
      .map((e) => {
        const [x, y] = proyectar(e.etiqueta);
        return `<text x="${x.toFixed(0)}" y="${y.toFixed(0)}" class="terr-vecino-nombre">${e.nombre}</text>`;
      })
      .join("");

    // Tlaxcala se dibuja al final porque queda dentro del contorno de Puebla
    const objetivos = [0, 2, 1].map((zona) => [OBJETIVOS[zona], zona]).map(
      ([o, zona]) => `
      <g class="terr-estado" data-zona="${zona}">
        <path d="${ruta(o.anillo)}"/>
        <text x="${o.etiqueta[0].toFixed(0)}" y="${o.etiqueta[1].toFixed(0)}">${o.nombre}</text>
      </g>`
    ).join("");

    return `
      <rect x="-2000" y="-2000" width="5000" height="5000" class="terr-mar"/>
      ${vecinos}${objetivos}
      <g id="terr-pin" class="terr-pin" opacity="0"><circle r="20"/><g class="terr-pin-icono" transform="translate(-12 -12)"></g></g>`;
  }

  /* --- Estructura -------------------------------------------------------- */

  contenedor.innerHTML = `
    <div class="terr-grid">
      <div class="terr-mapa">
        <svg id="terr-svg" viewBox="0 0 ${ANCHO} ${ALTO}" role="img"
             aria-label="Mapa del centro de México con Puebla, Tlaxcala e Hidalgo">${dibujarMapa()}</svg>
        <div class="terr-tabs" id="terr-tabs" role="tablist" aria-label="Estado"></div>
        <button class="terr-alejar" id="terr-alejar" hidden>Ver los tres</button>
        <span class="terr-nota">Contornos aproximados</span>
      </div>
      <div class="terr-info">
        <div id="terr-cabeza" aria-live="polite"></div>
        <p class="terr-pregunta">¿Qué tal le va a la cebada aquí? Toca un factor:</p>
        <div class="terr-factores" id="terr-factores" role="group" aria-label="Factores"></div>
        <div class="terr-detalle" id="terr-detalle" aria-live="polite"></div>
        <div class="terr-pie">
          <span id="terr-reto"></span>
          <button id="terr-consejo-btn" class="terr-consejo-btn" aria-expanded="false">Consejo</button>
        </div>
        <p class="terr-consejo" id="terr-consejo" hidden></p>
      </div>
    </div>
    <span class="fuente">Fuentes: INIFAP, FAO, Rev. Fitotecnia Mexicana y SIAP 2024 · lo medido: datos del reto (INEGI, CHIRPS y CHIRTS-ERA5) en las 197 parcelas de 2025. Ver Referencias.</span>`;

  const el = {
    svg: $("#terr-svg"),
    tabs: $("#terr-tabs"),
    alejar: $("#terr-alejar"),
    cabeza: $("#terr-cabeza"),
    factores: $("#terr-factores"),
    detalle: $("#terr-detalle"),
    reto: $("#terr-reto"),
    consejoBtn: $("#terr-consejo-btn"),
    consejo: $("#terr-consejo"),
    pin: $("#terr-pin"),
  };

  const estado = { zona: null, factor: 0, vista: [0, 0, ANCHO, ALTO] };

  /* --- Zoom suave del mapa ---------------------------------------------- */

  let animacion = 0;
  function irA(destino) {
    cancelAnimationFrame(animacion);
    const origen = [...estado.vista];
    const duracion = Paleta.movimientoReducido() ? 0 : 650;
    const t0 = performance.now();

    const paso = (ahora) => {
      const k = duracion ? Util.suave(Math.min(1, (ahora - t0) / duracion)) : 1;
      estado.vista = origen.map((v, i) => v + (destino[i] - v) * k);
      el.svg.setAttribute("viewBox", estado.vista.map((v) => v.toFixed(1)).join(" "));
      // Las letras mantienen su tamaño al acercarse
      el.svg.style.setProperty("--escala", (estado.vista[2] / ANCHO).toFixed(3));
      colocarPin();
      if (k < 1) animacion = requestAnimationFrame(paso);
    };
    animacion = requestAnimationFrame(paso);
  }

  function vistaDe(zona) {
    const { x0, y0, x1, y1 } = OBJETIVOS[zona].caja;
    const margen = 40;
    let w = x1 - x0 + margen * 2;
    let h = y1 - y0 + margen * 2;
    // Mantener la proporción del mapa
    if (w / h > ANCHO / ALTO) h = (w * ALTO) / ANCHO;
    else w = (h * ANCHO) / ALTO;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    return [cx - w / 2, cy - h / 2, w, h];
  }

  /* --- Interfaz ----------------------------------------------------------- */

  function montarTabs() {
    el.tabs.innerHTML = "";
    ESTADOS.forEach((nombre, zona) => {
      const boton = document.createElement("button");
      boton.setAttribute("role", "tab");
      boton.setAttribute("aria-selected", String(zona === estado.zona));
      boton.className = zona === estado.zona ? "active" : "";
      boton.textContent = nombre;
      boton.addEventListener("click", () => elegir(zona));
      el.tabs.appendChild(boton);
    });
  }

  function montarFactores() {
    const info = INFO[ESTADOS[estado.zona]];
    el.factores.innerHTML = "";
    FACTORES.forEach((factor, i) => {
      const [marca] = info[factor.clave];
      const boton = document.createElement("button");
      boton.className = `terr-factor ${i === estado.factor ? "active" : ""}`;
      boton.setAttribute("aria-pressed", String(i === estado.factor));
      boton.innerHTML = `
        <span class="terr-factor-icono" aria-hidden="true">${icono(factor.clave)}</span>
        <span>${factor.nombre}</span>
        <span class="terr-marca ${marca}" aria-label="${marca === "si" ? "cumple" : "depende del año"}">${marca === "si" ? "✓" : "!"}</span>`;
      boton.addEventListener("click", () => {
        estado.factor = i;
        montarFactores();
        mostrarDetalle();
      });
      el.factores.appendChild(boton);
    });
  }

  function mostrarDetalle() {
    const nombre = ESTADOS[estado.zona];
    const factor = FACTORES[estado.factor];
    const [marca, texto] = INFO[nombre][factor.clave];

    el.detalle.innerHTML = `
      <div class="terr-comparar">
        <div><small>Lo ideal</small><b>${factor.ideal}</b></div>
        <div class="${marca}"><small>En ${nombre}</small><b>${texto}</b></div>
      </div>
      ${medido(nombre, factor.clave) ? `<p class="terr-medido"><small>Medido en sus ${RETO[estado.zona].parcelas} parcelas</small>${medido(nombre, factor.clave)}</p>` : ""}
      <p class="terr-porque">${factor.porque}</p>`;
    el.detalle.classList.remove("entra");
    void el.detalle.offsetWidth; // reinicia la animación de entrada
    el.detalle.classList.add("entra");

    // El ícono del factor aparece sobre el estado en el mapa
    el.pin.querySelector(".terr-pin-icono").innerHTML = ICONOS[factor.clave];
    el.pin.setAttribute("opacity", "1");
    colocarPin();
  }

  function colocarPin() {
    if (estado.zona === null) return;
    const escala = estado.vista[2] / ANCHO;
    const [x, y] = OBJETIVOS[estado.zona].etiqueta;
    el.pin.setAttribute("transform", `translate(${x.toFixed(1)} ${(y - 30 * escala).toFixed(1)}) scale(${escala.toFixed(3)})`);
  }

  function mostrarEstado() {
    const nombre = ESTADOS[estado.zona];
    const info = INFO[nombre];
    const reto = RETO[estado.zona];

    el.cabeza.innerHTML = `
      <span class="terr-lema">${info.lema}</span>
      <h3>${nombre}</h3>
      <p>${info.frase}</p>`;
    el.reto.innerHTML = `En el reto: <b>${reto.parcelas}</b> parcelas · <b>${Util.fmt(reto.hectareas, 0)}</b> ha · <b>${Util.fmt(reto.promedio, 1)}</b> t/ha en promedio`;
    el.consejo.innerHTML = `<b>Para el agricultor:</b> ${info.consejo}`;
  }

  function marcarMapa() {
    el.svg.querySelectorAll(".terr-estado").forEach((g) => g.classList.toggle("activo", Number(g.dataset.zona) === estado.zona));
  }

  function elegir(zona) {
    estado.zona = zona;
    montarTabs();
    marcarMapa();
    mostrarEstado();
    montarFactores();
    mostrarDetalle();
    el.alejar.hidden = false;
    irA(vistaDe(zona));
  }

  el.svg.querySelectorAll(".terr-estado").forEach((g) => {
    g.addEventListener("click", () => elegir(Number(g.dataset.zona)));
  });

  el.alejar.addEventListener("click", () => {
    el.alejar.hidden = true;
    irA([0, 0, ANCHO, ALTO]);
  });

  el.consejoBtn.addEventListener("click", () => {
    el.consejo.hidden = !el.consejo.hidden;
    el.consejoBtn.setAttribute("aria-expanded", String(!el.consejo.hidden));
    el.consejoBtn.classList.toggle("active", !el.consejo.hidden);
  });

  // Empieza en Hidalgo, el mayor productor; el acercamiento ocurre al llegar a la sección
  estado.zona = 2;
  montarTabs();
  marcarMapa();
  mostrarEstado();
  montarFactores();
  mostrarDetalle();
  el.svg.style.setProperty("--escala", "1");

  let visto = false;
  new IntersectionObserver(
    (entradas) => {
      if (!visto && entradas.some((e) => e.isIntersecting)) {
        visto = true;
        setTimeout(() => elegir(estado.zona), 600);
      }
    },
    { threshold: 0.4 }
  ).observe($("#territorio"));
})();
