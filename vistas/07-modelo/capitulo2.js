"use strict";

/*
 * Capítulo 2 · El modelo. Orquesta la página:
 *   - telón de cambio de capítulo y entrada de las parcelas
 *   - historia con mapa fijo (las dos pistas del modelo)
 *   - carrera de modelos, simulador, resultados y preguntas guía
 *   - mascota acomodada en zonas libres (nunca encima del texto)
 * Todas las cifras salen de datos-modelo.js (salidas oficiales del NB07).
 */

(() => {
  // Cuando exista la página del capítulo 3, poner aquí su ruta y el botón aparece.
  const CAPITULO_3 = null; // p. ej. "vistas/08-credito/index.html"

  const datos = window.MODELO_HGP;
  const motor = MotorHGP.crear(datos);
  const fmt = Util.fmt;

  /* --- Cifras en el texto (data-cifra) ------------------------------------ */

  const contexto = {
    metricas: datos.metricas,
    modelo: { mu: motor.promedio },
    preguntas: datos.preguntas,
    q1: datos.preguntas.q1,
    mun: Object.fromEntries(datos.municipios.map((m) => [m.nombre, m.media])),
    parecido: { mitad: motor.distanciaConParecido(0.5), casi: motor.distanciaConParecido(0.05) },
  };

  $$("[data-cifra]").forEach((el) => {
    const valor = el.dataset.cifra.split(".").reduce((o, k) => (o == null ? o : o[k]), contexto);
    if (valor == null) return;
    const f = el.dataset.formato;
    if (typeof valor === "string") el.textContent = valor;
    else if (f === "m") el.textContent = String(Math.round((valor * 1000) / 10) * 10);
    else if (f === "pct") el.textContent = String(Math.round(valor * 100));
    else if (f === "de10") el.textContent = String(Math.round(valor * 10));
    else if (el.dataset.dec) el.textContent = fmt(valor, Number(el.dataset.dec));
    else el.textContent = String(valor);
  });

  // Botón al capítulo 3: un telón sube antes de cambiar de página (cambio de vista completo)
  const siguiente = $("#c2-siguiente");
  if (CAPITULO_3 && siguiente) {
    siguiente.href = CAPITULO_3;
    siguiente.hidden = false;
    siguiente.addEventListener("click", (e) => {
      if (Paleta.movimientoReducido() || e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      const salida = document.createElement("div");
      salida.className = "c2-salida";
      salida.innerHTML = '<span class="capitulo">Capítulo 3</span><span class="c2-telon-sub">Del rendimiento al crédito</span>';
      document.body.appendChild(salida);
      setTimeout(() => (location.href = siguiente.href), 750);
    });
  }

  /* --- Escena 3D a pantalla completa ------------------------------------ */

  // Una sola escena para la historia y el simulador. Al tocar una parcela, decide el simulador
  // (solo responde cuando su paso está activo).
  let simulador = null;
  const escenario = $(".c2-escenario");
  const mapa = crearVistaParcelas($("#c2-mapa"), datos, {
    alSeleccionar: (id) => simulador && simulador.alTocarParcela(id),
  });
  const es3D = typeof mapa.camaraHacia === "function";
  mapa.interactivo(false);

  // Parcela de ejemplo: la que más vecinas conocidas tiene a menos de 1 km
  const ejemplo = datos.parcelas
    .filter((p) => p.pred)
    .map((p) => ({ p, r: motor.predecir(p.id) }))
    .map((x) => ({ ...x, n: x.r.vecinasCercanas.filter((v) => v.parecido > 0.02).length }))
    .sort((a, b) => b.n - a.n)[0];
  const vecinasEjemplo = ejemplo.r.vecinasCercanas.filter((v) => v.parecido > 0.02);

  let curvaDibujada = false;

  /* Leyenda: solo lo que se ve en cada paso */
  function leyenda(claves) {
    $$("#c2-leyenda > *").forEach((el) => {
      const clave = el.classList.contains("c2-ley-rampa") ? "rampa" : [...el.classList].find((c) => c !== "c2-ley");
      el.hidden = !claves.includes(clave);
    });
  }
  const leyendaSimulador = () =>
    leyenda(simulador && simulador.revelado
      ? ["rampa", "por-predecir", "enlace-sube", "enlace-baja"]
      : ["conocida", "por-predecir", "enlace-sube", "enlace-baja"]);

  // Qué se ve en cada paso (la cámara la mueve el scroll, ver más abajo)
  const ESTADOS = {
    portada() {
      mapa.cambiarModo("categoria");
      mapa.mostrarEtiquetas(false);
      mapa.limpiarVecinas();
      mapa.resaltar(null);
      if (!es3D) mapa.verTodo();
      leyenda(["conocida", "por-predecir"]);
    },
    pregunta() {
      ESTADOS.portada();
    },
    municipio() {
      mapa.limpiarVecinas();
      mapa.resaltar(null);
      mapa.cambiarModo("municipio");
      mapa.mostrarEtiquetas(true);
      if (!es3D) mapa.verTodo();
      leyenda(["rampa"]);
    },
    vecinos() {
      mapa.mostrarEtiquetas(false);
      mapa.cambiarModo("rendimiento");
      mapa.limpiarVecinas();
      mapa.resaltar(ejemplo.p.id);
      mapa.mostrarVecinas(ejemplo.p, vecinasEjemplo, { neutro: true });
      if (!es3D) mapa.enfocarEn(ejemplo.p, 1.3);
      leyenda(["rampa", "por-predecir", "enlace-neutro"]);
      if (!curvaDibujada) {
        curvaDibujada = true;
        dibujarCurva();
      }
    },
    juntas() {
      mapa.mostrarEtiquetas(false);
      mapa.cambiarModo("rendimiento");
      mapa.resaltar(ejemplo.p.id);
      mapa.mostrarVecinas(ejemplo.p, vecinasEjemplo);
      if (!es3D) mapa.enfocarEn(ejemplo.p, 1.3);
      leyenda(["rampa", "por-predecir", "enlace-sube", "enlace-baja"]);
    },
    simulador() {
      simulador.activar();
      leyendaSimulador();
    },
  };

  function dibujarCurva() {
    const mitad = contexto.parecido.mitad;
    const casi = contexto.parecido.casi;
    Graficas.curvaParecido($("#c2-curva"), motor.curvaParecido(2), [
      { d_km: mitad, parecido: 0.5, texto: `la mitad a ${Math.round(mitad * 100) * 10} m` },
      { d_km: casi, parecido: 0.05, texto: `casi nada a ${Math.round(casi * 100) * 10} m` },
    ]);
  }

  const articulos = $$(".c2-paso");
  let pasoActual = null;
  function activarPaso(articulo) {
    const nombre = articulo.dataset.paso;
    if (nombre === pasoActual) return;
    if (pasoActual === "simulador") simulador.desactivar();
    pasoActual = nombre;
    articulos.forEach((a) => a.classList.toggle("activo", a === articulo));
    escenario.dataset.paso = nombre;
    mapa.elemento.dataset.paso = nombre;
    mapa.latido(nombre === "pregunta");
    ESTADOS[nombre]();
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
      // En móvil la escena ocupa la parte de arriba: el paso se activa cuando su texto asoma debajo
      { rootMargin: movil() ? "-60% 0px -32% 0px" : "-45% 0px -45% 0px" }
    );
    articulos.forEach((a) => observarPasos.observe(a));
  }
  vigilarPasos();

  /* --- Guion de cámara con el scroll -------------------------------------- */

  // Zona libre de la pantalla (lo que no tapa el texto), como fracción del ancho
  function zonaLibre() {
    const W = window.innerWidth;
    if (movil()) return { off: 0, fraccion: 1, simOff: 0, simFraccion: 1 };
    const texto = $(".c2-portada .c2-texto").getBoundingClientRect();
    const izq = Math.min(texto.right + 32, W * 0.6);
    const simIzq = $(".c2-sim-izq").getBoundingClientRect().right + 24;
    const simDer = $(".c2-sim-der").getBoundingClientRect().left - 24;
    return {
      off: izq / (2 * W),
      fraccion: (W - izq) / W,
      simOff: ((simIzq + simDer) / 2 - W / 2) / W,
      simFraccion: Util.clamp((simDer - simIzq) / W, 0.25, 1),
    };
  }

  // Un encuadre por paso: de lejos y bajo (paisaje) → todo el mapa → desde arriba → a ras de la parcela
  function encuadres() {
    const z = zonaLibre();
    const general = (o) => mapa.encuadreGeneral({ off: z.off, fraccion: z.fraccion, ...o });
    const parcela = (p, r, o) => mapa.encuadreParcela(p, r, { off: z.off, fraccion: z.fraccion, ...o });
    return {
      portada: general({ factor: 1.35, pitch: 0.42, yaw: -0.7 }),
      pregunta: general({ factor: 1.0, pitch: 0.78, yaw: -0.3 }),
      municipio: general({ factor: 1.0, pitch: 1.1, yaw: 0.05 }),
      vecinos: parcela(ejemplo.p, 0.85, { pitch: 0.82, yaw: 0.45 }),
      juntas: parcela(ejemplo.p, 0.75, { pitch: 0.62, yaw: 0.85 }),
      simulador: mapa.encuadreParcela(simulador.seleccion, 0.75, {
        pitch: 0.8, yaw: 0.35, off: z.simOff, fraccion: z.simFraccion,
      }),
    };
  }

  function ajustarSimulador() {
    const z = zonaLibre();
    mapa.fijarEncuadre({ off: z.simOff, fraccion: z.simFraccion, yaw: 0.35, pitch: 0.8 });
  }

  // Interpolación entre dos encuadres: la distancia cambia en escala logarítmica y el punto
  // de destino se mueve de modo que el sujeto final se acerque sin salir de cuadro.
  function mezclar(a, b, t) {
    const d = a.d * Math.pow(b.d / a.d, t);
    const w = Util.clamp(1 - (1 - t) * (d / a.d), 0, 1);
    const lin = (k) => a[k] + (b[k] - a[k]) * t;
    return {
      tx: a.tx + (b.tx - a.tx) * w,
      tz: a.tz + (b.tz - a.tz) * w,
      d, yaw: lin("yaw"), pitch: lin("pitch"), off: lin("off"),
    };
  }
  const suave = (u) => {
    const k = Util.clamp((u - 0.18) / 0.64, 0, 1); // pausa al principio y al final de cada tramo
    return k * k * (3 - 2 * k);
  };

  let rapidezGuion = 4;
  function guionCamara() {
    if (!es3D || !simulador) return;
    const linea = movil() ? 0.6 : 0.5;
    const vh = window.innerHeight;
    // Posición del scroll en la que cada paso queda "en foco"
    const anclas = articulos.map((a) => {
      const r = a.getBoundingClientRect();
      const foco = movil() ? r.top + 32 : a.dataset.paso === "simulador" ? r.top + vh / 2 : r.top + r.height / 2;
      return window.scrollY + foco - vh * linea;
    });
    const y = window.scrollY;
    const ultimo = anclas.length - 1;
    // Dentro del simulador, la cámara la mueve el simulador
    if (y >= anclas[ultimo]) return;
    const E = encuadres();
    const nombres = articulos.map((a) => a.dataset.paso);
    let obj;
    if (y <= anclas[0]) obj = E[nombres[0]];
    else {
      let i = 0;
      while (i < ultimo - 1 && y >= anclas[i + 1]) i++;
      const u = (y - anclas[i]) / Math.max(1, anclas[i + 1] - anclas[i]);
      obj = mezclar(E[nombres[i]], E[nombres[i + 1]], suave(u));
    }
    mapa.camaraHacia(obj, { rapidez: rapidezGuion });
  }

  let pendienteGuion = false;
  window.addEventListener("scroll", () => {
    if (pendienteGuion) return;
    pendienteGuion = true;
    requestAnimationFrame(() => {
      pendienteGuion = false;
      rapidezGuion = 4;
      guionCamara();
    });
  }, { passive: true });

  /* --- Diez modelos ------------------------------------------------------- */

  $("#c2-tipos").innerHTML = Object.entries(Graficas.TIPOS)
    .map(([clave, texto]) => `<span class="c2-fila tipo-${clave}">${texto}</span>`)
    .join("");

  let esquema = "main";
  let carrera = null;

  $$("[data-esquema]").forEach((b) =>
    b.addEventListener("click", () => {
      esquema = b.dataset.esquema;
      $$("[data-esquema]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      $$("[data-esquema-texto]").forEach((t) => (t.hidden = t.dataset.esquemaTexto !== esquema));
      if (carrera) carrera.mover(esquema);
    })
  );

  /* --- Simulador ---------------------------------------------------------- */

  simulador = crearSimulador($("#c2-simulador"), datos, motor, mapa);
  ajustarSimulador();
  $("#c2-simulador").addEventListener("predicciones", () => pasoActual === "simulador" && leyendaSimulador());

  /* --- Gráficas: se preparan antes de llegar y se animan al aparecer ------ */

  const conocidas = datos.parcelas.filter((p) => !p.pred);
  const porPredecir = datos.parcelas.filter((p) => p.pred);
  const P = datos.preguntas;
  const opcionesBarras = (etiqueta) => ({
    valor: (x) => x.mejora, maximo: 32, formato: (x) => `${fmt(x.mejora, 0)} %`, etiqueta,
  });

  // Cada gráfica, por su id. Si devuelve { entrada }, esa función arranca su animación.
  const GRAFICAS = {
    "c2-carrera": () => (carrera = Graficas.carreraModelos($("#c2-carrera"), datos.modelos, esquema)),
    "c2-dispersion": () => Graficas.dispersion($("#c2-dispersion"), conocidas, datos.metricas.rmse),
    "c2-oruga": () => Graficas.oruga($("#c2-oruga"), porPredecir, datos.modelo.q),
    "c2-q1": () => Graficas.barras($("#c2-q1"), P.q1.slice(0, 8), opcionesBarras("Mejora de cada índice")),
    "c2-q2": () => Graficas.barras($("#c2-q2"), P.q2, opcionesBarras("Mejora de cada variable climática")),
    "c2-q3": () => {
      const primeras = P.q3.slice(0, 4);
      const combos = [...primeras, ...P.q3_solas.filter((s) => !primeras.some((c) => c.nombre === s.nombre)).slice(0, 3)];
      return Graficas.puntosError($("#c2-q3"), combos, [{ valor: P.rmse_ubicacion, texto: "ubicación", clase: "" }]);
    },
  };
  const estadoGrafica = new Map(); // id -> { entrada, revelada }

  // Se dibuja antes de entrar en pantalla, con sus animaciones en pausa (clase c2-en-espera),
  // para que la página no salte; al volver a dibujar (cambio de tamaño) ya no se anima.
  function dibujarGrafica(id, redibujo = false) {
    const caja = document.getElementById(id);
    const revelada = Boolean(estadoGrafica.get(id) && estadoGrafica.get(id).revelada);
    caja.classList.toggle("c2-sin-animacion", redibujo && revelada);
    const r = GRAFICAS[id]();
    const entrada = r && typeof r.entrada === "function" ? r.entrada : null;
    estadoGrafica.set(id, { entrada, revelada });
    if (revelada) {
      if (entrada) entrada(false);
    } else caja.classList.add("c2-en-espera");
  }

  function revelarGrafica(id) {
    const e = estadoGrafica.get(id);
    if (!e || e.revelada) return;
    e.revelada = true;
    document.getElementById(id).classList.remove("c2-en-espera");
    if (e.entrada) e.entrada(!Paleta.movimientoReducido());
  }

  const prepararGraficas = new IntersectionObserver(
    (entradas) => entradas.forEach((e) => e.isIntersecting && !estadoGrafica.has(e.target.id) && dibujarGrafica(e.target.id)),
    { rootMargin: "0px 0px 70% 0px" } // con casi una pantalla de anticipación
  );
  const revelarGraficas = new IntersectionObserver(
    (entradas) => entradas.forEach((e) => {
      if (!e.isIntersecting) return;
      if (!estadoGrafica.has(e.target.id)) dibujarGrafica(e.target.id);
      revelarGrafica(e.target.id);
    }),
    { threshold: 0.2 } // arranca cuando se ve una quinta parte de la gráfica
  );
  Object.keys(GRAFICAS).forEach((id) => {
    const caja = document.getElementById(id);
    prepararGraficas.observe(caja);
    revelarGraficas.observe(caja);
  });

  // Cifras de resultados (±0.50, 8 de 10, 65 %): aparecen y cuentan desde cero
  function contar(nodo, ms, retraso) {
    const final = nodo.textContent.trim();
    const valor = parseFloat(final);
    if (!Number.isFinite(valor)) return;
    const dec = (final.split(".")[1] || "").length;
    nodo.textContent = fmt(0, dec);
    setTimeout(() => {
      const t0 = performance.now();
      const paso = (ahora) => {
        const k = Math.min(1, (ahora - t0) / ms);
        nodo.textContent = k < 1 ? fmt(valor * (1 - Math.pow(1 - k, 3)), dec) : final;
        if (k < 1) requestAnimationFrame(paso);
      };
      requestAnimationFrame(paso);
    }, retraso);
  }
  const observarCifras = new IntersectionObserver(
    (entradas, obs) => entradas.forEach((e) => {
      if (!e.isIntersecting) return;
      obs.unobserve(e.target);
      e.target.classList.add("visible");
      if (!Paleta.movimientoReducido()) $$("[data-cifra]", e.target).forEach((n, i) => contar(n, 1100, 150 + i * 180));
    }),
    { threshold: 0.4 }
  );
  $$(".c2-cifras").forEach((c) => observarCifras.observe(c));

  let temporizadorTamano;
  let anchoPrevio = window.innerWidth;
  window.addEventListener("resize", () => {
    clearTimeout(temporizadorTamano);
    temporizadorTamano = setTimeout(() => {
      ajustarSimulador();
      guionCamara();
      if (Math.abs(window.innerWidth - anchoPrevio) < 30) return;
      const cruzaMovil = (anchoPrevio <= 900) !== movil();
      anchoPrevio = window.innerWidth;
      if (cruzaMovil) vigilarPasos();
      estadoGrafica.forEach((_, id) => dibujarGrafica(id, true));
      if (curvaDibujada) dibujarCurva();
    }, 250);
  });

  /* --- Progreso e índice del capítulo ------------------------------------- */

  const barra = $(".c2-progreso");
  const enlacesIndice = $$(".c2-indice a");
  const seccionesIndice = enlacesIndice.map((a) => document.getElementById(a.hash.slice(1)));

  function actualizarProgreso() {
    const total = document.documentElement.scrollHeight - window.innerHeight;
    barra.style.setProperty("--progreso", total > 0 ? (window.scrollY / total).toFixed(4) : 0);
    const medio = window.innerHeight * 0.4;
    let actual = 0;
    seccionesIndice.forEach((s, i) => {
      if (s.getBoundingClientRect().top <= medio) actual = i;
    });
    enlacesIndice.forEach((a, i) => a.classList.toggle("actual", i === actual));
  }
  window.addEventListener("scroll", actualizarProgreso, { passive: true });
  actualizarProgreso();

  // Enlaces internos con <base href>: desplazamiento suave dentro de la página
  $$('a[href*="#c2-"]').forEach((a) =>
    a.addEventListener("click", (e) => {
      const destino = document.getElementById(a.hash.slice(1));
      if (!destino) return;
      e.preventDefault();
      destino.scrollIntoView({ behavior: Paleta.movimientoReducido() ? "auto" : "smooth" });
      history.replaceState(null, "", a.hash);
    })
  );

  /* --- Mascota: solo en pantallas anchas y en zonas libres ---------------- */

  const Mascota = (() => {
    const disponible = typeof THREE !== "undefined" && typeof crearEscenaMascota === "function";
    let escena = null;
    let objetivo = null; // función que devuelve {x, y} en px, o null para esconderla
    let dichos = new Set();
    let temporizador = null;
    let tPrevio = 0;

    const ancha = () => window.innerWidth >= 1000;
    const ESCALA = 0.3; // en reposo
    const ESCALA_HABLANDO = 0.44; // mientras tiene globo de diálogo
    let escalaActual = ESCALA;
    let hablando = false;
    let ultimoLugar = null;
    // Tiempo para leer el globo después de que termina de escribirse: ~85 ms por letra, mínimo 6 s
    const tiempoLectura = (texto) => Math.max(6000, texto.length * 85);

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

    function aNdc({ x, y }) {
      return { x: (x / window.innerWidth) * 2 - 1, y: -((y / window.innerHeight) * 2 - 1) };
    }

    // Lugar libre: abajo a la izquierda, bajo el texto del paso (si no lo tapa), o arriba a la
    // derecha de la etiqueta de cada sección (resto del capítulo). En el simulador se esconde.
    function lugarLibre() {
      const historia = $("#c2-historia").getBoundingClientRect();
      if (historia.bottom > window.innerHeight * 0.6) {
        if (window.innerHeight < 720 || pasoActual === "simulador") return null;
        const texto = $(".c2-paso.activo .c2-texto");
        if (!texto) return null;
        const r = texto.getBoundingClientRect();
        const y = window.innerHeight - 80;
        if (r.bottom > y - 170) return null; // el globo taparía el texto
        return { x: r.left + 30, y, zona: "historia" };
      }
      // Arriba a la derecha de la etiqueta de la sección: el globo queda en el margen superior
      for (const id of ["c2-modelos", "c2-resultados", "c2-preguntas", "c2-cierre"]) {
        const etiqueta = document.querySelector(`#${id} .kicker`);
        const r = etiqueta.getBoundingClientRect();
        if (r.top > 90 && r.top < window.innerHeight * 0.85) {
          const ancho = document.querySelector(`#${id} .c2-ancho`).getBoundingClientRect();
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
        // Mientras habla se queda en su último lugar libre, para no cortar el diálogo
        // (solo dentro de la historia, donde la escena está fija y ese lugar sigue libre)
        let lugar = ancha() ? lugarLibre() : null;
        const enHistoria = $("#c2-historia").getBoundingClientRect().bottom > window.innerHeight * 0.6;
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
        if (!completo) return; // lo interrumpió otro diálogo
        temporizador = setTimeout(() => {
          Narrador.callar();
          hablando = false;
        }, tiempoLectura(dicho));
      });
      escena.saltito();
    }

    return { iniciar, decir };
  })();

  // Diálogos de las secciones (fuera de la historia)
  const observarDialogos = new IntersectionObserver(
    (entradas) => entradas.forEach((e) => e.isIntersecting && Mascota.decir(e.target)),
    { threshold: 0.35 }
  );
  $$(".c2-seccion[data-say]").forEach((s) => observarDialogos.observe(s));

  /* --- Telón de entrada y arranque ---------------------------------------- */

  function arrancar() {
    // El telón se levanta solo con CSS (aunque algo falle en JS); aquí solo se retira del DOM
    const telon = $("#c2-telon");
    const reducido = Paleta.movimientoReducido();
    setTimeout(() => telon && telon.remove(), reducido ? 0 : 1800);
    // Llegada: la cámara arranca lejos y se acerca despacio al primer encuadre
    if (es3D) {
      const E = encuadres();
      mapa.camaraHacia({ ...E.portada, d: E.portada.d * 1.7, yaw: E.portada.yaw - 0.5, pitch: 0.3 }, { inmediato: true });
    }
    setTimeout(() => {
      mapa.entrada(1500);
      rapidezGuion = 1.1;
      guionCamara();
      Mascota.iniciar();
      // Si se llega con #simulador u otra ancla, ir directo
      if (location.hash && location.hash.startsWith("#c2-")) {
        const destino = document.getElementById(location.hash.slice(1));
        if (destino) destino.scrollIntoView();
      }
    }, reducido ? 0 : 900);
    if (!pasoActual) activarPaso($(".c2-portada"));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", arrancar);
  else arrancar();

  // Para depurar desde la consola
  window.Capitulo2 = { datos, motor, mapa, simulador };
})();
