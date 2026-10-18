"use strict";

/*
 * Simulador del capítulo 2: corre el GP jerárquico en el navegador para una
 * parcela y anima cómo se arma su predicción:
 *   punto de partida → su municipio → sus vecinas → rango de confianza
 * En modo prueba, el modelo no ve el rendimiento de una parcela conocida y al
 * final se compara con el valor real.
 */

function crearSimulador(raiz, datos, motor, mapa) {
  const fmt = (v, d = 2) => Util.fmt(v, d);
  const signo = (v, d = 2) => (Math.abs(v) < 0.005 ? Util.fmt(0, d) : (v >= 0 ? "+" : "−") + Util.fmt(Math.abs(v), d));
  const esperar = (ms) => (Paleta.movimientoReducido() ? Promise.resolve() : Util.esperar(ms));

  const parcelas = datos.parcelas;
  const porPredecir = parcelas.filter((p) => p.pred);
  const conocidas = parcelas.filter((p) => !p.pred);
  const media = motor.promedio;

  const $r = (sel) => raiz.querySelector(sel);
  const entrada = $r("#c2-buscar");
  const lista = $r("#c2-lista-parcelas");
  const botonEjecutar = $r("#c2-ejecutar");
  const botonAzar = $r("#c2-azar");
  const botonesModo = [...raiz.querySelectorAll("[data-modo-sim]")];
  const ficha = $r(".c2-ficha");
  const pasos = [...raiz.querySelectorAll(".c2-paso-sim")];
  const resultado = $r(".c2-resultado");
  const nota = $r(".c2-sim-nota");
  const regla = $r(".c2-regla");

  let modoPrueba = false;
  let seleccion = porPredecir[0].id;
  let ejecucion = 0; // para cancelar animaciones si el usuario vuelve a ejecutar

  // La escena 3D es compartida con la historia: el simulador solo la mueve cuando está activo
  let activo = false;
  let ultimaCorrida = null; // { id, cercanas } para volver a dibujar al regresar
  let prediccionesReveladas = false;
  const M = () => (activo ? mapa : null);

  /** Toque en una parcela del mapa (lo llama la escena). */
  function alTocarParcela(id) {
    if (!activo) return;
    const p = motor.porId.get(id);
    if (p.pred === modoPrueba) cambiarModo(!p.pred);
    elegir(id, true);
  }

  function activar() {
    if (activo) return;
    activo = true;
    mapa.interactivo(true);
    mapa.mostrarEtiquetas(false);
    mapa.latido(false);
    mapa.cambiarModo(prediccionesReveladas ? "rendimiento" : "categoria");
    mapa.limpiarVecinas();
    mapa.resaltar(seleccion);
    mapa.enfocarEn(motor.porId.get(seleccion), 0.75);
    if (ultimaCorrida && ultimaCorrida.id === seleccion) {
      mapa.mostrarVecinas(motor.porId.get(seleccion), ultimaCorrida.cercanas);
    }
  }

  function desactivar() {
    activo = false;
    mapa.interactivo(false);
  }

  /* --- Regla de t/ha ------------------------------------------------------ */

  const R = { min: 1.5, max: 6.0 };
  let reglaSvg, xR, capaRegla;

  function dibujarRegla() {
    const { svg, ancho } = Graficas.lienzo(regla, 92, "Predicción sobre una regla de rendimiento");
    reglaSvg = svg;
    xR = Graficas.escala(R.min, R.max, 16, ancho - 16);
    const eje = crearElementoSvg("g", { class: "c2-eje" }, svg);
    crearElementoSvg("line", { x1: xR(R.min), x2: xR(R.max), y1: 58, y2: 58, class: "c2-regla-linea" }, eje);
    for (let v = 2; v <= 6; v += 0.5) {
      const entero = v % 1 === 0;
      crearElementoSvg("line", { x1: xR(v), x2: xR(v), y1: 58, y2: entero ? 66 : 62, class: "c2-regla-marca" }, eje);
      if (entero) Graficas.texto(eje, xR(v), 82, fmt(v, 0), { "text-anchor": "middle" });
    }
    Graficas.texto(eje, xR(R.max), 82, "t/ha", { "text-anchor": "end", dx: 0, dy: 0, class: "c2-eje-titulo", opacity: 0 });
    capaRegla = crearElementoSvg("g", {}, svg);
  }

  function limpiarRegla() {
    if (capaRegla) capaRegla.innerHTML = "";
  }

  // fila 0: etiqueta arriba (punto de partida y predicción) · fila 1: más abajo (valor real)
  function marcaRegla(valor, clase, etiqueta, fila = 0) {
    const g = crearElementoSvg("g", { class: `c2-regla-pin ${clase}`, transform: `translate(${xR(valor)},0)` }, capaRegla);
    crearElementoSvg("line", { y1: fila === 0 ? 26 : 44, y2: 58, class: "c2-regla-asta" }, g);
    crearElementoSvg("circle", { cy: 58, r: 5.5 }, g);
    if (etiqueta) Graficas.texto(g, 0, fila === 0 ? 20 : 40, etiqueta, { "text-anchor": "middle", class: "c2-regla-texto" });
    return g;
  }

  function flechaRegla(desde, hasta, clase) {
    const y = 58;
    const d = `M${xR(desde)},${y} C${xR(desde)},${y - 26} ${xR(hasta)},${y - 26} ${xR(hasta)},${y - 4}`;
    const p = crearElementoSvg("path", { d, class: `c2-regla-flecha ${clase}` }, capaRegla);
    const largo = p.getTotalLength ? p.getTotalLength() : 100;
    p.style.strokeDasharray = largo;
    p.style.strokeDashoffset = largo;
    requestAnimationFrame(() => requestAnimationFrame(() => (p.style.strokeDashoffset = 0)));
    return p;
  }

  function bandaRegla(p10, p90, p20) {
    const g = crearElementoSvg("g", { class: "c2-regla-banda" }, capaRegla);
    const r = crearElementoSvg("rect", { x: xR(p10), y: 52, width: xR(p90) - xR(p10), height: 12, rx: 6 }, g);
    r.style.transformOrigin = `${(xR(p10) + xR(p90)) / 2}px 58px`;
    crearElementoSvg("line", { x1: xR(p20), x2: xR(p20), y1: 48, y2: 68, class: "c2-regla-p20" }, g);
  }

  /* --- Selección ---------------------------------------------------------- */

  function opcionesLista() {
    const fuente = modoPrueba ? conocidas : porPredecir;
    lista.innerHTML = fuente.map((p) => `<option value="${p.id}">${p.mun}</option>`).join("");
    entrada.placeholder = fuente[0].id;
  }

  function cambiarModo(prueba) {
    modoPrueba = prueba;
    botonesModo.forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.modoSim === "prueba") === prueba)));
    raiz.classList.toggle("modo-prueba", prueba);
    botonEjecutar.textContent = prueba ? "▶ Ponerlo a prueba" : "▶ Ejecutar el modelo";
    opcionesLista();
  }

  function describirParcela(p) {
    $r(".c2-ficha-id").textContent = p.id;
    $r(".c2-ficha-meta").textContent = `${p.mun}, ${p.edo} · ${fmt(p.ha, 1)} ha`;
    $r(".c2-ficha-estado").textContent = p.pred ? "Rendimiento desconocido" : modoPrueba ? "El modelo no verá su rendimiento" : "Rendimiento conocido";
  }

  function reiniciarFicha() {
    pasos.forEach((li) => {
      li.classList.remove("activo", "hecho");
      li.querySelector(".c2-paso-valor").textContent = "";
      li.querySelector(".c2-paso-detalle").textContent = li.dataset.detalle || "";
    });
    resultado.hidden = true;
    nota.textContent = "";
    limpiarRegla();
  }

  function elegir(id, ejecutar = false) {
    const p = motor.porId.get(id);
    if (!p) return;
    seleccion = id;
    entrada.value = id;
    describirParcela(p);
    reiniciarFicha();
    ultimaCorrida = null;
    M()?.limpiarVecinas();
    M()?.resaltar(id);
    M()?.enfocarEn(p, 0.75);
    if (ejecutar) ejecutarModelo();
  }

  /* --- Ejecución animada -------------------------------------------------- */

  async function animarNumero(nodo, desde, hasta, formatear, ms = 600) {
    if (Paleta.movimientoReducido()) return (nodo.textContent = formatear(hasta));
    const t0 = performance.now();
    await new Promise((resolver) => {
      const paso = (ahora) => {
        const k = Util.clamp((ahora - t0) / ms, 0, 1);
        nodo.textContent = formatear(desde + (hasta - desde) * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(paso);
        else resolver();
      };
      requestAnimationFrame(paso);
    });
  }

  function activarPaso(i) {
    pasos.forEach((li, j) => {
      li.classList.toggle("activo", j === i);
      li.classList.toggle("hecho", j < i);
    });
  }

  // En móvil la ficha queda debajo de los controles: se acerca justo bajo la escena fija
  function mostrarFichaEnMovil() {
    if (window.innerWidth > 900 || !activo) return;
    const escenario = document.querySelector(".c2-escenario");
    const bajoEscena = escenario ? escenario.getBoundingClientRect().bottom : 0;
    const arriba = ficha.getBoundingClientRect().top;
    if (arriba > bajoEscena + 8 && arriba < window.innerHeight - 120) return; // ya se ve
    window.scrollBy({ top: arriba - bajoEscena - 12, behavior: Paleta.movimientoReducido() ? "auto" : "smooth" });
  }

  async function ejecutarModelo() {
    mostrarFichaEnMovil();
    const id = seleccion;
    const yo = ++ejecucion;
    const vigente = () => yo === ejecucion;
    const p = motor.porId.get(id);
    const r = motor.predecir(id, { aCiegas: modoPrueba && !p.pred });

    reiniciarFicha();
    M()?.limpiarVecinas();
    M()?.resaltar(id);
    M()?.enfocarEn(p, 0.75);
    botonEjecutar.disabled = true;
    ficha.classList.add("corriendo");

      // parecido > 0.02 equivale a ~1 km: la misma regla para el texto y las líneas del mapa
    const cercanas = r.vecinasCercanas.filter((v) => v.parecido > 0.02);
    const valores = pasos.map((li) => li.querySelector(".c2-paso-valor"));
    const detalles = pasos.map((li) => li.querySelector(".c2-paso-detalle"));

    // 1. Punto de partida
    activarPaso(0);
    detalles[0].textContent = `Promedio de las ${r.prueba ? conocidas.length - 1 : conocidas.length} parcelas conocidas.`;
    const pinBase = marcaRegla(r.base, "base", fmt(r.base));
    await animarNumero(valores[0], 0, r.base, (v) => `${fmt(v)} t/ha`);
    await esperar(450);
    if (!vigente()) return;

    // 2. Su municipio
    activarPaso(1);
    M()?.marcarMunicipio(p.mun);
    const mismas = conocidas.filter((c) => c.mun === p.mun && !(r.prueba && c.id === p.id));
    if (mismas.length === 0) {
      detalles[1].textContent = `No hay otras parcelas conocidas en ${p.mun}: el modelo no puede usar esta pista.`;
    } else {
      const mediaMun = mismas.reduce((s, c) => s + c.y_obs, 0) / mismas.length;
      const dif = mediaMun - r.base;
      const comparacion = Math.abs(dif) < 0.05 ? "rinde casi igual que el promedio" : dif > 0 ? "rinde más que el promedio" : "rinde menos que el promedio";
      const cautela = mismas.length < 4 ? " Con tan pocas parcelas, el modelo corrige con cautela." : "";
      detalles[1].textContent =
        `${p.mun} ${comparacion}: ${fmt(mediaMun)} t/ha en ${mismas.length} parcela${mismas.length === 1 ? "" : "s"} conocida${mismas.length === 1 ? "" : "s"}.${cautela}`;
    }
    flechaRegla(r.base, r.base + r.municipio, r.municipio >= 0 ? "sube" : "baja");
    await animarNumero(valores[1], 0, r.municipio, (v) => signo(v));
    await esperar(650);
    if (!vigente()) return;

    // 3. Sus vecinas
    activarPaso(2);
    M()?.marcarMunicipio(null);
    M()?.mostrarVecinas(p, cercanas);
    ultimaCorrida = { id, cercanas };
    if (cercanas.length === 0) {
      detalles[2].textContent = "No hay parcelas conocidas a menos de 1 km: se queda con lo que dice el municipio y el rango se abre.";
    } else {
      const mayor = [...cercanas].sort((a, b) => Math.abs(b.aporte) - Math.abs(a.aporte))[0];
      detalles[2].textContent =
        `${cercanas.length} parcela${cercanas.length === 1 ? "" : "s"} conocida${cercanas.length === 1 ? "" : "s"} a menos de 1 km. ` +
        `La que más pesa, ${mayor.id} a ${Math.round(mayor.d_km * 1000)} m, rindió ${fmt(mayor.y_obs)} t/ha.`;
    }
    flechaRegla(r.base + r.municipio, r.media, r.vecinas >= 0 ? "sube" : "baja");
    await animarNumero(valores[2], 0, r.vecinas, (v) => signo(v));
    await esperar(700);
    if (!vigente()) return;

    // 4. Rango de confianza
    activarPaso(3);
    detalles[3].textContent = `8 de cada 10 veces, el rendimiento real cae entre ${fmt(r.p10)} y ${fmt(r.p90)} t/ha.`;
    bandaRegla(r.p10, r.p90, r.p20);
    marcaRegla(r.media, "final", fmt(r.media));
    if (Math.abs(r.media - r.base) < 0.45) pinBase.querySelector("text").style.opacity = "0";
    valores[3].textContent = `${fmt(r.p10)} – ${fmt(r.p90)}`;
    await esperar(500);
    if (!vigente()) return;
    activarPaso(4);

    // Resultado
    const riesgo = r.riesgo.toLowerCase();
    let real = "";
    if (r.prueba) {
      marcaRegla(r.real, "real", `real ${fmt(r.real)}`, 1);
      const error = r.real - r.media;
      const dentro = r.real >= r.p10 && r.real <= r.p90;
      real = `
        <div class="c2-dato-res real"><span>Rendimiento real</span><b>${fmt(r.real)}</b></div>
        <div class="c2-dato-res ${Math.abs(error) <= datos.metricas.rmse ? "bien" : "mal"}"><span>Diferencia</span><b>${signo(error)}</b></div>
        <p class="c2-veredicto">${dentro ? "El valor real cayó dentro del rango." : "El valor real quedó fuera del rango: pasa en 2 de cada 10 parcelas."}</p>`;
    }
    resultado.innerHTML = `
      <div class="c2-dato-res principal"><span>Predicción</span><b>${fmt(r.media)}</b><small>t/ha</small></div>
      <div class="c2-dato-res"><span>Rendimiento financiable (P20)</span><b>${fmt(r.p20)}</b></div>
      <div class="c2-dato-res"><span>Riesgo</span><b class="c2-chip riesgo-${riesgo}">${r.riesgo}</b></div>
      ${real}`;
    resultado.hidden = false;
    nota.textContent = `Calculado en tu navegador en ${r.ms < 1 ? "menos de 1" : fmt(r.ms, 0)} ms con el modelo real.`;
    if (!r.prueba && p.pred && Math.abs(r.media - p.est) > 0.001) {
      nota.textContent += " (Revisar: no coincide con el archivo entregado.)";
    }

    botonEjecutar.disabled = false;
    ficha.classList.remove("corriendo");
    raiz.dispatchEvent(new CustomEvent("simulacion", { detail: r, bubbles: true }));
  }

  /* --- Las 59 a la vez ---------------------------------------------------- */

  async function predecirTodas() {
    const boton = $r("#c2-todas");
    const salida = $r("#c2-todas-resultado");
    boton.disabled = true;
    ultimaCorrida = null;
    M()?.limpiarVecinas();
    M()?.resaltar(null);
    M()?.verTodo();
    const { resultados, ms } = motor.predecirTodas();
    const diferencia = Math.max(...resultados.map((x) => Math.abs(x.media - x.parcela.est)));
    await esperar(700);
    prediccionesReveladas = true;
    if (M()) await mapa.revelarPredicciones(resultados, 2200);
    else mapa.fijarPredicciones(resultados);
    raiz.dispatchEvent(new CustomEvent("predicciones", { bubbles: true }));
    salida.innerHTML =
      `<b>${resultados.length} predicciones en ${fmt(ms, 0)} ms.</b> ` +
      `Coinciden con las que entregamos al reto (diferencia máxima ${fmt(diferencia, 4)} t/ha). ` +
      `El color es el rendimiento estimado: más oscuro, más alto.`;
    boton.disabled = false;
  }

  /* --- Eventos ------------------------------------------------------------ */

  botonesModo.forEach((b) =>
    b.addEventListener("click", () => {
      cambiarModo(b.dataset.modoSim === "prueba");
      const fuente = modoPrueba ? conocidas : porPredecir;
      elegir(fuente[Math.floor(Math.random() * fuente.length)].id);
    })
  );

  entrada.addEventListener("change", () => {
    const id = entrada.value.trim().toUpperCase().replace(/^(\d+)$/, (n) => `AGC_${n.padStart(3, "0")}`);
    const p = motor.porId.get(id);
    if (!p) {
      nota.textContent = `No encuentro «${entrada.value}». Usa un ID de AGC_001 a AGC_197.`;
      return;
    }
    if (p.pred === modoPrueba) cambiarModo(!p.pred);
    elegir(id);
  });

  botonAzar.addEventListener("click", () => {
    const fuente = modoPrueba ? conocidas : porPredecir;
    elegir(fuente[Math.floor(Math.random() * fuente.length)].id, true);
  });

  botonEjecutar.addEventListener("click", ejecutarModelo);
  $r("#c2-todas").addEventListener("click", predecirTodas);
  $r("#c2-ver-todo").addEventListener("click", () => {
    M()?.resaltar(null);
    M()?.limpiarVecinas();
    M()?.verTodo();
  });

  let anchoRegla = 0;
  new ResizeObserver(() => {
    const ancho = Math.round(regla.clientWidth);
    if (Math.abs(ancho - anchoRegla) < 8) return;
    anchoRegla = ancho;
    dibujarRegla();
    if (resultado.hidden === false) ejecutarModelo();
  }).observe(regla);

  cambiarModo(false);
  dibujarRegla();
  // Parcela inicial: una por predecir con varias vecinas, para que la primera corrida luzca
  const inicial = porPredecir
    .map((p) => ({ p, n: motor.predecir(p.id).vecinasCercanas.filter((v) => v.parecido > 0.02).length }))
    .sort((a, b) => b.n - a.n)[0].p;
  elegir(inicial.id);

  return {
    elegir, ejecutarModelo, activar, desactivar, alTocarParcela,
    get seleccion() { return seleccion; },
    get revelado() { return prediccionesReveladas; },
  };
}
