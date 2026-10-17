"use strict";
/* ------------------------------------------------------------------------ */
/* Recorrido: contexto → estados → viaje → campo                             */
/* ------------------------------------------------------------------------ */

let vista = "contexto";
let sesionViaje = 0;

const esquinaMascota = () => (camara.aspect < 1 ? -0.7 : -0.86);

function colocarMascotaPara(nombre) {
  const posiciones = {
    contexto: [-0.62, -0.4, 0.95],
    estados: [-0.8, -0.55, 0.75],
    campo: [esquinaMascota(), -0.7, 0.62],
  };
  mascota.mover(...posiciones[nombre]);
}

function mostrarVista(nombre) {
  vista = nombre;
  $("#vista-contexto").hidden = nombre !== "contexto";
  $("#vista-estados").hidden = nombre !== "estados" && nombre !== "viaje";
  $("#hud-campo").hidden = nombre !== "campo";
  $("#zoom-ctrl").hidden = nombre !== "contexto" && nombre !== "estados";
  lienzoGl.classList.toggle("arrastrable", nombre === "contexto" || nombre === "estados");
  if (nombre !== "campo") {
    $("#abrir-menu-campo").classList.remove("visible");
    $("#hud-campo").classList.remove("plegado");
  }

  if (VISTAS_GLOBO[nombre]) miradaGlobo.objetivo = vistaGloboAjustada(nombre);
  if (nombre !== "viaje") colocarMascotaPara(nombre === "campo" ? "campo" : nombre);
}

function datosContexto() {
  const total = DATA.P.length;
  const hectareas = DATA.P.reduce((suma, p) => suma + p.a, 0);
  const porPredecir = DATA.P.filter((p) => p.p).length;
  const mayor = Math.max(...DATA.P.map((p) => p.a));

  return { total, hectareas, porPredecir, conocidas: total - porPredecir, mayor };
}

function iniciarContexto() {
  const d = datosContexto();

  $("#datos-contexto").innerHTML = `
    <div class="dato"><b>${d.total}</b>parcelas</div>
    <div class="dato"><b>${Util.fmt(d.hectareas, 0)}</b>hectáreas en total</div>
    <div class="dato"><b>${Util.fmt(d.hectareas / d.total, 1)} ha</b>área promedio</div>
    <div class="dato"><b>${Util.fmt(d.mayor, 1)} ha</b>la más grande</div>
    <div class="dato"><b>${d.conocidas}</b>con rendimiento conocido</div>
    <div class="dato"><b>${d.porPredecir}</b>por predecir</div>`;

  mascota.colocar(-1.4, -0.4, 0.95);
  mascota.saltarA({ ndcX: -0.62, ndcY: -0.4, escala: 0.95, duracion: 1.4, giros: 1, altura: 1.2 });

  Util.esperar(1500).then(() => {
    if (vista !== "contexto") return;
    Narrador.decir(
      `Una parcela es un terreno agrícola con sus propios límites. En el reto hay ${d.total}, suman ${Util.fmt(d.hectareas, 0)} hectáreas y están en Puebla, Tlaxcala e Hidalgo. De ${d.conocidas} ya sabemos cuánto rindieron; las otras ${d.porPredecir} las tiene que predecir el modelo.`
    );
  });
}

function iniciarEstados() {
  Narrador.callar();
  estadoElegido = -1;
  brote.activo = false;
  pulso.visible = false;
  resaltarEstado(-1);
  mostrarVista("estados");

  $("#saltar-viaje").hidden = true;
  $$("#estados-lista button").forEach((b) => {
    b.disabled = false;
  });

  Narrador.decir(
    "Este es México con sus estados. Elige Puebla, Tlaxcala o Hidalgo y me planto ahí."
  );
}

function resaltarEstado(indice) {
  estadosGlobo.forEach((e, i) => {
    const activo = i === indice;

    e.nube.visible = activo;
    e.material.opacity = activo ? 1 : 0.9;
  });
}

/** Posición y tamaño del estado en pantalla, para que la mascota salte sobre él. */
function medirEstadoEnPantalla(indice) {
  const vectores = ESTADOS_OBJETIVO[indice].poligono.map(([lon, lat]) =>
    latLonAVector(lon, lat, RADIO + 0.02).applyMatrix4(globo.matrixWorld).project(camara)
  );
  const xs = vectores.map((v) => v.x);
  const ys = vectores.map((v) => v.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const anchoPx = ((maxX - minX) / 2) * window.innerWidth;
  const altoPx = ((maxY - minY) / 2) * window.innerHeight;
  const radioPx = (Math.min(anchoPx, altoPx) / 2) * 0.9;
  const pxPorEscala = (0.6 / MEDIO_ALTO) * (window.innerHeight / 2);

  return {
    ndcX: (minX + maxX) / 2,
    ndcY: (minY + maxY) / 2,
    escala: clamp(radioPx / pxPorEscala, 0.14, 0.6),
  };
}

async function elegirEstado(indice) {
  if (vista !== "estados") return;

  vista = "viaje";
  $("#zoom-ctrl").hidden = true;
  lienzoGl.classList.remove("arrastrable");
  const sesion = ++sesionViaje;
  const cancelado = () => sesion !== sesionViaje;
  const estado = ESTADOS_OBJETIVO[indice];

  estadoElegido = indice;
  resaltarEstado(indice);
  marcadores.forEach((b, i) => b.classList.toggle("active", i === indice));
  $$("#estados-lista button").forEach((b) => {
    b.disabled = true;
  });
  $("#saltar-viaje").hidden = false;

  // El estado se resalta y la cámara se acerca
  const punto = latLonAVector(estado.lon, estado.lat, RADIO + 0.02);
  brote.base.copy(punto);
  brote.normal.copy(punto).normalize();
  pulso.position.copy(punto);
  brote.activo = true;
  brote.tiempo = 0;
  miradaGlobo.objetivo = { lon: estado.lon, lat: estado.lat, z: 3.55 };

  Narrador.callar();
  mascota.saltito();
  await Util.esperar(1700);
  if (cancelado()) return;

  // La cebada cuenta algo del estado
  await Narrador.decir(estado.dato);
  if (cancelado()) return;
  await Util.esperar(700);
  if (cancelado()) return;

  // Salta girando sobre su eje y se hace chiquita sobre el estado
  const destino = medirEstadoEnPantalla(indice);
  await mascota.saltarA({ ...destino, duracion: 1.6, giros: 2, altura: 1.8 });
  if (cancelado()) return;

  const lista = zonaDe(indice);
  Narrador.decir(`¡Aquí me planto! ${estado.nombre}: ${lista.length} parcelas. Vamos a verlas.`);
  await Util.esperar(2200);
  if (cancelado()) return;

  entrarCampo(indice);
}

async function entrarCampo(indice) {
  sesionViaje++;
  const sesion = sesionViaje;
  Narrador.callar();

  $("#saltar-explicacion").hidden = true;
  $("#wipe").classList.add("on");
  await Util.esperar(Paleta.movimientoReducido() ? 50 : 750);

  cargarZona(indice);
  $("#state-markers").hidden = true;
  mostrarVista("campo");
  $("#timeline").classList.remove("visible");
  $("#panel").classList.remove("visible");
  $("#vista-general").hidden = true;

  // Cámara lejos del suelo, lista para el recorrido
  camaraPos.set(0, -100 + 40, 34);
  camaraMira.set(0, -100, 2);

  mascota.saltarA({ ndcX: esquinaMascota(), ndcY: -0.7, escala: 0.62, duracion: 1.3, giros: 1, altura: 1 });
  $("#wipe").classList.remove("on");
  await Util.esperar(900);
  if (sesion !== sesionViaje) return;

  contarCrecimiento(indice);
}

