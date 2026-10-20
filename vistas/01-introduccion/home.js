"use strict";

/*
 * Página de inicio (storytelling): la mascota brota de la tierra, una planta
 * de cebada crece al hacer scroll, sus granos caen al suelo y se quedan ahí.
 * Al final, la mascota se coloca en el espacio en blanco de «Tu turno».
 * El globo de la portada vive en mapa-inicio.js; aquí la planta se recorre para que crezca en
 * «¿Qué es la cebada?» (las espigas), cuando el globo ya se desvaneció, y se vaya antes de que vuelva.
 */

const escenaHome = crearEscenaMascota($("#mascot"));

const PROFUNDIDAD_PLANTA = 7.5;
const MEDIO_ALTO_PLANTA = Math.tan(22.5 * D2R) * PROFUNDIDAD_PLANTA;

const planta = crearPlanta();
const contenedorPlanta = new THREE.Group();
contenedorPlanta.add(planta.grupo);
contenedorPlanta.position.z = -PROFUNDIDAD_PLANTA;
escenaHome.escena.add(contenedorPlanta);

let scrollSuave = 0;
let tiempoPrevio = 0;

// Pantallas antes de «¿Qué es la cebada?»: la planta crece ahí, sin encimarse con el globo
let desfasePlanta = 0;
function medirDesfase() {
  const espigas = $("#espigas");
  desfasePlanta = espigas ? Math.max(0, (espigas.getBoundingClientRect().top + window.scrollY) / window.innerHeight - 1) : 0;
}

function actualizarPlanta(t, sReal) {
  const s = sReal - desfasePlanta;
  const aspecto = escenaHome.camara.aspect;
  const angosto = aspecto < 1;

  const crecer = clamp((s - 0.6) / 0.7, 0, 1);
  const soltar = clamp((s - 1.35) / 0.5, 0, 1);
  const sale = suave(clamp((s - 1.9) / 0.4, 0, 1)); // se va antes de que el globo regrese en «Pequeña, pero de gran peso»

  const escala = (angosto ? 0.42 : 0.62) * (1 - sale);

  contenedorPlanta.visible = crecer > 0 && escala > 0.01;
  contenedorPlanta.scale.setScalar(Math.max(0.001, escala));
  contenedorPlanta.position.x = MEDIO_ALTO_PLANTA * aspecto * (angosto ? 0.6 : 0.52);
  contenedorPlanta.position.y = -MEDIO_ALTO_PLANTA * 0.84;

  planta.animar(t, crecer, soltar);
}

const seccionFinal = $("#continuar");

function llegadaAlFinal() {
  const caja = seccionFinal.getBoundingClientRect();
  return suave(clamp((window.innerHeight * 0.8 - caja.top) / (window.innerHeight * 0.5), 0, 1));
}

// Partes con animación a todo lo ancho («Cómo crece» y «2025»): ahí la mascota se encoge y se hace a un lado
// El pie de página (las referencias) también: ahí la mascota se despide y no tapa la bibliografía
const seccionesAnimadas = ["#crecimiento", "#temporada", "footer"].map((s) => $(s)).filter(Boolean);
let mascotaAparte = 0;
function enAnimacion() {
  const H = window.innerHeight;
  let cubre = 0;
  seccionesAnimadas.forEach((n) => {
    const r = n.getBoundingClientRect();
    // Qué tanto ocupa la sección la parte baja de la pantalla, donde vive la mascota
    cubre = Math.max(cubre, clamp((Math.min(r.bottom, H) - Math.max(r.top, H * 0.5)) / (H * 0.35), 0, 1));
  });
  return suave(cubre);
}

let pesoEsquina = 0;

function actualizarMascotaHome(s) {
  const aspecto = escenaHome.camara.aspect;
  const angosto = aspecto < 1;
  // Después de la portada, la mascota se va a la esquina inferior derecha: los textos del capítulo
  // van a la izquierda, así que ahí no tapa nada
  const peso = suave(clamp((s - 0.25) / 0.65, 0, 1));
  pesoEsquina = peso;
  // En celular se asoma desde la esquina, medio fuera de la pantalla, para no tapar las líneas de texto
  const esquina = angosto ? { x: 0.88, y: -0.84, escala: 0.32 } : { x: 0.86, y: -0.68, escala: 0.5 };

  const llegada = llegadaAlFinal();
  const hueco = angosto ? { x: 0.6, y: -0.7, escala: 0.5 } : { x: 0.6, y: -0.2, escala: 0.95 };
  const aparte = enAnimacion();
  mascotaAparte = aparte;

  escenaHome.mover(
    mezcla(mezcla(0, esquina.x, peso), hueco.x, llegada),
    mezcla(mezcla(-0.3, esquina.y, peso), hueco.y, llegada),
    mezcla(mezcla(1.25, esquina.escala, peso), hueco.escala, llegada) * (1 - 0.999 * aparte)
  );
  escenaHome.estado.monticulo = 1 - peso;
}

// El globo de diálogo busca un hueco sin texto: primero a la izquierda de la mascota y, si no cabe, arriba
// de ella. Si en ningún lado hay espacio (pasa en celular), espera escondido a que el texto se recorra.
const burbujaHome = $("#bubble");
const textosHome = $$("main .block > *");
function ubicarBurbuja() {
  if (burbujaHome && mascotaAparte > 0.5) {
    burbujaHome.classList.add("sin-lugar");
    return;
  }
  if (!burbujaHome || pesoEsquina < 0.5 || !burbujaHome.classList.contains("visible")) {
    if (burbujaHome) burbujaHome.classList.remove("sin-lugar");
    return;
  }
  const W = window.innerWidth;
  const H = window.innerHeight;
  const e = escenaHome.estado;
  const px = (e.ndcX * 0.5 + 0.5) * W;
  const py = (-e.ndcY * 0.5 + 0.5) * H;
  const radio = ((e.escala * 0.6) / MEDIO_ALTO) * (H / 2);
  const alto = burbujaHome.offsetHeight;
  const margen = 14;
  const cajas = textosHome.map((n) => n.getBoundingClientRect()).filter((r) => r.width && r.bottom > 0 && r.top < H);
  // Lo más a la derecha que llega el texto dentro de una franja horizontal de la pantalla
  const bordeTexto = (arriba, abajo, hasta) =>
    cajas.reduce((max, r) => (r.bottom > arriba - 8 && r.top < abajo + 8 && r.left < hasta ? Math.max(max, r.right + 18) : max), margen);

  const colocar = (derecha, abajo, ancho) => {
    burbujaHome.classList.add("izq");
    burbujaHome.classList.remove("sin-lugar");
    burbujaHome.style.left = "auto";
    burbujaHome.style.right = Math.round(W - derecha) + "px";
    burbujaHome.style.top = Math.round(abajo) + "px";
    burbujaHome.style.maxWidth = Math.round(ancho) + "px";
  };

  // 1) A la izquierda de la mascota
  const orilla = px - radio * 0.75 - 12;
  const abajoA = Math.min(H - margen, py + radio * (W < 720 ? 0.6 : 0.1));
  const anchoA = Math.min(W < 720 ? 300 : 380, orilla - bordeTexto(abajoA - alto, abajoA, orilla));
  if (anchoA >= (W < 720 ? 170 : 230)) return colocar(orilla, abajoA, anchoA);

  // 2) Arriba de la mascota, pegado al borde derecho
  const abajoB = py - radio - 6;
  const anchoB = Math.min(360, W - margen - bordeTexto(abajoB - alto, abajoB, W));
  if (anchoB >= 200) return colocar(W - margen, abajoB, anchoB);

  // 3) Sin lugar: se esconde un momento
  burbujaHome.classList.add("sin-lugar");
}

function animar(milisegundos) {
  const t = milisegundos / 1000;
  const dt = Math.min(0.05, t - tiempoPrevio);
  tiempoPrevio = t;

  scrollSuave += (window.scrollY / window.innerHeight - scrollSuave) * 0.08;

  document.documentElement.style.setProperty("--aurora-y", scrollSuave.toFixed(3));

  actualizarMascotaHome(scrollSuave);
  actualizarPlanta(t, scrollSuave);
  escenaHome.actualizar(t, dt);
  ubicarBurbuja();
  escenaHome.render();

  requestAnimationFrame(animar);
}

window.addEventListener("resize", () => {
  escenaHome.ajustar();
  medirDesfase();
});
window.addEventListener("load", medirDesfase);
medirDesfase();


$("#hero-title").innerHTML = "Agro-verse"
  .split("")
  .map(
    (letra, i) =>
      `<i aria-hidden="true" style="transition-delay: ${0.04 * i}s">${letra === " " ? "&nbsp;" : letra}</i>`
  )
  .join("");

const mejorReto = Math.max(...DATA.P.filter((p) => !p.p).map((p) => p.y));
$("#stat-reto").textContent = `Las mejores parcelas del reto llegan a ${Util.fmt(mejorReto, 1)} t/ha.`;

function contar(elemento) {
  const meta = Number(elemento.dataset.contar);
  const prefijo = elemento.dataset.prefijo || "";
  const sufijo = elemento.dataset.sufijo || "";
  const duracion = Paleta.movimientoReducido() ? 1 : 1600;
  const inicio = performance.now();

  const paso = (ahora) => {
    const k = clamp((ahora - inicio) / duracion, 0, 1);
    const valor = Math.round(meta * (1 - Math.pow(1 - k, 3)));

    elemento.textContent = prefijo + valor.toLocaleString("es-MX") + sufijo;
    if (k < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

const observarSecciones = new IntersectionObserver(
  (entradas) => {
    entradas.forEach((entrada) => {
      entrada.target.classList.toggle("in", entrada.isIntersecting);

      if (entrada.isIntersecting) {
        $$("[data-contar]", entrada.target).forEach((elemento) => {
          if (elemento.dataset.contado) return;
          elemento.dataset.contado = "1";
          contar(elemento);
        });
      }
    });
  },
  // Con rootMargin y no con un porcentaje: las secciones altas (la gráfica de 2025) nunca muestran el 35 %
  { rootMargin: "0px 0px -22% 0px", threshold: 0 }
);

let temporizadorDialogo;
let temporizadorOcultar;
let listo = false;

// El globo de diálogo se oculta solo unos segundos después de terminar de escribir, para no tapar el texto
function decirYOcultar(texto) {
  clearTimeout(temporizadorOcultar);
  Narrador.decir(texto).then((completo) => {
    if (completo) temporizadorOcultar = setTimeout(() => Narrador.callar(), 6500);
  });
}

const observarDialogo = new IntersectionObserver(
  (entradas) => {
    entradas.forEach((entrada) => {
      if (!entrada.isIntersecting || !listo) return;

      // El globo de diálogo taparía la animación del campo y la gráfica de 2025 (y, en celular, el mapa): ahí calla
      if (entrada.target.matches(".temporada, #crecimiento") || (entrada.target.matches(".donde, .margen-mascota") && window.innerWidth < 760)) {
        clearTimeout(temporizadorDialogo);
        clearTimeout(temporizadorOcultar);
        Narrador.callar();
        return;
      }

      clearTimeout(temporizadorDialogo);
      clearTimeout(temporizadorOcultar);
      temporizadorDialogo = setTimeout(() => decirYOcultar(entrada.target.dataset.say), 600);
    });
  },
  // Habla cuando la sección cruza la franja central de la pantalla, sea corta o larga
  { rootMargin: "-42% 0px -42% 0px", threshold: 0 }
);

$$(".section").forEach((seccion) => {
  observarSecciones.observe(seccion);
  observarDialogo.observe(seccion);
});

function inclinar(elemento, maximo) {
  if (Paleta.movimientoReducido()) return;

  elemento.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || e.buttons) return;

    const caja = elemento.getBoundingClientRect();
    const x = (e.clientX - caja.left) / caja.width - 0.5;
    const y = (e.clientY - caja.top) / caja.height - 0.5;

    elemento.style.setProperty("--ry", `${(x * maximo * 2).toFixed(2)}deg`);
    elemento.style.setProperty("--rx", `${(-y * maximo * 2).toFixed(2)}deg`);
  });

  elemento.addEventListener("pointerleave", () => {
    elemento.style.setProperty("--rx", "0deg");
    elemento.style.setProperty("--ry", "0deg");
  });
}

$$(".foto3d").forEach((foto) => inclinar(foto, 6));

const TEXTOS_HILERAS = {
  6: "Seis hileras: las tres espiguillas de cada nudo son fértiles.",
  2: "Dos hileras: solo la espiguilla central es fértil; las laterales quedan reducidas."
};

const panelHileras = $("#hileras");

function elegirHileras(valor) {
  panelHileras.dataset.h = valor;
  $("#hileras-texto").textContent = TEXTOS_HILERAS[valor];

  $$("button", panelHileras).forEach((boton) => {
    const activo = boton.dataset.h === String(valor);
    boton.classList.toggle("active", activo);
    boton.setAttribute("aria-pressed", String(activo));
  });
}

$$("button", panelHileras).forEach((boton) =>
  boton.addEventListener("click", () => elegirHileras(Number(boton.dataset.h)))
);
elegirHileras(6);


// Línea del tiempo: el capítulo ya no la usa (la historia la cuenta el globo), pero el código queda por si vuelve
if ($("#historia-tira")) {
  const tira = $("#historia-tira");
  const cartas = $$(".hito", tira);
  const riel = $("#tl-riel");
  const botonPrevio = $("#hist-prev");
  const botonSiguiente = $("#hist-next");

  let cartaActiva = -1;

  riel.style.setProperty("--n", cartas.length);

  cartas.forEach((carta, i) => {
    const punto = document.createElement("button");
    punto.type = "button";
    punto.className = "tl-punto";
    punto.setAttribute("aria-label", `${carta.dataset.corto}: ver esta época`);
    punto.innerHTML = `<b>${carta.dataset.corto}</b>`;
    punto.addEventListener("click", () => irACarta(i));
    riel.appendChild(punto);

    inclinar(carta, 4);
  });

  const puntos = $$(".tl-punto", riel);

  function irACarta(indice) {
    const i = clamp(indice, 0, cartas.length - 1);
    if (i === cartaActiva) return;

    tira.dataset.dir = i > cartaActiva ? "sig" : "ant";
    cartaActiva = i;

    cartas.forEach((carta, k) => carta.classList.toggle("activo", k === i));
    puntos.forEach((punto, k) => {
      punto.classList.toggle("activo", k === i);
      punto.classList.toggle("hecho", k < i);
      if (k === i) punto.setAttribute("aria-current", "true");
      else punto.removeAttribute("aria-current");
    });

    riel.style.setProperty("--p", cartas.length > 1 ? i / (cartas.length - 1) : 0);
    $("#tl-cuenta").textContent = `${i + 1} / ${cartas.length}`;
    botonPrevio.disabled = i === 0;
    botonSiguiente.disabled = i === cartas.length - 1;
  }

  botonPrevio.addEventListener("click", () => irACarta(cartaActiva - 1));
  botonSiguiente.addEventListener("click", () => irACarta(cartaActiva + 1));

  tira.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      irACarta(cartaActiva + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      irACarta(cartaActiva - 1);
    }
  });

  let gesto = null;

  tira.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    gesto = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener("pointerup", (e) => {
    if (!gesto) return;

    const dx = e.clientX - gesto.x;
    const dy = e.clientY - gesto.y;
    gesto = null;

    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      irACarta(cartaActiva + (dx < 0 ? 1 : -1));
    }
  });

  irACarta(0);
}

const burbujaMascota = $("#bubble");
const botonBurbuja = $("#bubble-toggle");

botonBurbuja.addEventListener("click", () => {
  const plegada = burbujaMascota.classList.toggle("plegada");

  botonBurbuja.textContent = plegada ? "Mostrar" : "Ocultar ✕";
  botonBurbuja.setAttribute("aria-expanded", String(!plegada));
});

function terminarCarga() {
  document.body.classList.add("ready");
  $$(".section")[0].classList.add("in");
  listo = true;

  escenaHome.brotar(performance.now() / 1000 + 0.4);
  // Solo saluda si la persona sigue en la portada
  setTimeout(() => window.scrollY < window.innerHeight * 0.5 && decirYOcultar($$(".section")[0].dataset.say), 2600);
}

// Entrada: el telón verde se levanta y la mascota brota (sin telón si se pidió reducir movimiento)
const telon = $("#c1-telon");
const sinMovimiento = Paleta.movimientoReducido();
setTimeout(terminarCarga, sinMovimiento ? 0 : 1100);
setTimeout(() => telon && telon.remove(), sinMovimiento ? 0 : 1800);

// Al capítulo 2 se pasa con un enlace normal: el telón de entrada del capítulo 2 hace la transición.
// (Antes aquí subía otro telón antes de cambiar de página y se veían dos seguidos.)

escenaHome.ajustar();
escenaHome.estado.monticulo = 1;
requestAnimationFrame(animar);