"use strict";
/* ------------------------------------------------------------------------ */
/* Fondo y paleta                                                            */
/* ------------------------------------------------------------------------ */

const colorGlobo = new THREE.Color(C.fondoGlobo);
const colorCampo = new THREE.Color(C.fondoCampo);
const colorFondo = new THREE.Color();
let pasoFondo = 0;

function actualizarFondo(dt) {
  pasoFondo += ((vista === "campo" ? 1 : 0) - pasoFondo) * (1 - Math.exp(-dt * 4));
  colorFondo.copy(colorGlobo).lerp(colorCampo, pasoFondo);
  document.documentElement.style.setProperty("--sky", `#${colorFondo.getHexString()}`);
}

function aplicarPaleta() {
  colorGlobo.set(C.fondoGlobo);
  colorCampo.set(C.fondoCampo);
  nubeBase.material.color.set(C.puntos);
  dibujarTexturaMexico();
  esferaOceano.material.color.set(C.oceano);
  materialFronteras.color.set(C.rosa);
  materialesPulso.forEach((m) => m.color.set(C.rosa));

  estadosGlobo.forEach((e) => {
    e.nube.material.color.set(C.rosa);
    e.material.color.set(C.rosa);
  });

  uniformes.cA.value.set(C.talloVerde);
  uniformes.cB.value.set(C.talloOro);
  uniformes.cD.value.set(C.seco);
  uniformesSuelo.uCamino.value.set(C.camino);
  uniformesSuelo.uAcento.value.set(C.rosa);
  recalcular = true;
}

window.addEventListener("paleta", (evento) => {
  Object.assign(C, evento.detail);
  aplicarPaleta();
});

