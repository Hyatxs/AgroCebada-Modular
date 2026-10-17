"use strict";
/* ------------------------------------------------------------------------ */
/* Bucle principal y eventos                                                 */
/* ------------------------------------------------------------------------ */

let tiempoPrevio = 0;

function animar(milisegundos) {
  const t = milisegundos / 1000;
  const dt = Math.min(0.05, t - tiempoPrevio);
  tiempoPrevio = t;

  const enCampo = vista === "campo";
  globo.visible = !enCampo;
  campo.visible = enCampo;

  if (enCampo) {
    actualizarCamaraCampo(dt);
  } else {
    camara.position.set(puntero.x * 0.06, puntero.y * 0.04, miradaGlobo.z);
    camara.lookAt(0, 0, 0);
  }
  camara.updateMatrixWorld();

  actualizarGlobo(t, dt);
  actualizarMarcadores();
  actualizarFondo(dt);
  mascota.actualizar(t, dt);
  if (enCampo) actualizarCampo(t, dt);

  renderizador.render(escena, camara);
  mascota.render();
  requestAnimationFrame(animar);
}

window.addEventListener("resize", ajustarTamano);

window.addEventListener("pointermove", (evento) => {
  if (vista !== "campo") {
    hover = -1;

    // Sobre el mapa: la semilla crece al pasar por Puebla, Tlaxcala o Hidalgo
    const sobreMapa = vista === "estados" && estadoElegido < 0 && evento.target.id === "gl" && !arrastre;
    const nombre = sobreMapa ? estadoBajoPantalla(evento.clientX, evento.clientY) : null;

    Cursor.grande(ESTADOS_OBJETIVO.some((e) => e.nombre === nombre));
    return;
  }
  hover = parcelaBajoPuntero();
  Cursor.grande(hover >= 0);
});

window.addEventListener("click", (evento) => {
  if (evento.target.id !== "gl" || vista !== "campo" || hover < 0) return;

  seleccionar(hover, true);
  enfocado = true;
  $("#vista-general").hidden = false;
});

window.addEventListener("keydown", (evento) => {
  if (vista !== "campo" || evento.target.closest("input, button")) return;

  if (evento.key === "ArrowRight" || evento.key === "ArrowLeft") {
    const paso = evento.key === "ArrowRight" ? 1 : -1;
    seleccionar((seleccion + paso + parcelas.length) % parcelas.length, true);
    enfocado = true;
    $("#vista-general").hidden = false;
  }
});

$("#week-slider").addEventListener("input", (evento) => {
  if (tweenSemana) {
    const resolver = tweenSemana.resolver;
    tweenSemana = null;
    resolver();
  }
  semana = Number(evento.target.value);
});

$("#reproducir").addEventListener("click", async () => {
  const desde = semana >= 47 ? 14 : semana;
  await animarSemana(desde, 48, (48 - desde) * 220);
});

$("#ir-estados").addEventListener("click", iniciarEstados);
$("#volver-contexto").addEventListener("click", () => {
  Narrador.callar();
  mostrarVista("contexto");
  Narrador.decir("Aquí estamos de nuevo. Cuando quieras, elige un estado.");
});
$("#saltar-viaje").addEventListener("click", () => entrarCampo(estadoElegido));
$("#volver-estados").addEventListener("click", volverAEstados);
$("#vista-general").addEventListener("click", () => {
  enfocado = false;
  $("#vista-general").hidden = true;
});
$("#repetir-historia").addEventListener("click", () => {
  if (estadoElegido < 0) return;

  sesionViaje++;
  contarCrecimiento(estadoElegido);
});
$("#saltar-explicacion").addEventListener("click", saltarHistoria);

// Menú lateral del campo: se puede plegar para ver todo el terreno
$("#plegar-menu").addEventListener("click", () => {
  $("#hud-campo").classList.add("plegado");
  $("#abrir-menu-campo").classList.add("visible");
});
$("#abrir-menu-campo").addEventListener("click", () => {
  $("#hud-campo").classList.remove("plegado");
  $("#abrir-menu-campo").classList.remove("visible");
});
$("#predecir-todas").addEventListener("click", predecirTodas);
$("#ver-cosecha").addEventListener("click", abrirCosecha);
$("#cerrar-cosecha").addEventListener("click", cerrarCosecha);
$("#modal-cosecha").addEventListener("click", (evento) => {
  if (evento.target.id === "modal-cosecha") cerrarCosecha();
});
$("#cosecha-rend").addEventListener("input", (evento) => actualizarCosecha(Number(evento.target.value)));
document.addEventListener("keydown", (evento) => {
  if (evento.key !== "Escape") return;

  if (!$("#modal-cosecha").hidden) cerrarCosecha();
  else if (!$("#saltar-explicacion").hidden) saltarHistoria();
});

// Lista accesible de estados (además de los puntos sobre el mapa)
ESTADOS_OBJETIVO.forEach((estado, indice) => {
  const lista = zonaDe(indice);
  const porPredecir = lista.filter((p) => p.p).length;
  const boton = document.createElement("button");

  boton.innerHTML = `${estado.nombre} <small>${lista.length} parcelas · ${porPredecir} por predecir</small>`;
  boton.addEventListener("click", () => elegirEstado(indice));
  $("#estados-lista").appendChild(boton);
});

/* --- Carga --------------------------------------------------------------- */

function terminarCarga() {
  $("#loader").classList.add("done");
  mascota.mostrar();
  iniciarContexto();
}

let progresoCarga = 0;
const intervaloCarga = setInterval(() => {
  progresoCarga = Math.min(100, progresoCarga + 5);
  $("#loader-count").textContent = progresoCarga;

  if (progresoCarga >= 100) {
    clearInterval(intervaloCarga);
    terminarCarga();
  }
}, 40);

ajustarTamano();
crearBotonesDeVariable();
mostrarVista("contexto");
Object.assign(miradaGlobo, vistaGloboAjustada("contexto"));
requestAnimationFrame(animar);

// Modo accesible: se puede volver a ver el recorrido sin la historia
$("#timeline").addEventListener("dblclick", saltarHistoria);