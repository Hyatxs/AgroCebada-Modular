"use strict";
/* ------------------------------------------------------------------------ */
/* Cámara y animación del campo                                              */
/* ------------------------------------------------------------------------ */

const camaraPos = new THREE.Vector3(0, -73, 24);
const camaraMira = new THREE.Vector3(0, -100, 2);
const destinoPos = new THREE.Vector3();
const destinoMira = new THREE.Vector3();
const mirada = new THREE.Vector3();

function actualizarCamaraCampo(dt) {
  const parcela = parcelas[seleccion];
  const retrato = Math.max(1, 1.25 / camara.aspect);

  if (enfocado && parcela) {
    destinoPos.set(parcela.x * 0.9, -100 + 9.5 * retrato, parcela.z + 9.5 * retrato);
    destinoMira.set(parcela.x, -100, parcela.z);
  } else {
    destinoPos.set(0, -100 + 27 * retrato, 24 * retrato);
    destinoMira.set(0, -100, 2);
  }

  const k = 1 - Math.exp(-dt * 3);
  camaraPos.lerp(destinoPos, k);
  camaraMira.lerp(destinoMira, k);

  camara.position.set(camaraPos.x + puntero.x * 0.4, camaraPos.y + puntero.y * 0.25, camaraPos.z);
  mirada.copy(camaraMira);
  camara.lookAt(mirada);
}

function actualizarPaletaCampo(w) {
  const sueloColor = new THREE.Color(C.suelo);
  const color = new THREE.Color();

  parcelas.forEach((parcela, i) => {
    const ndvi = muestrear(parcela.n, w) / 1000;
    const verdor = clamp((ndvi - 0.18) / 0.55, 0, 1);

    color.set(parcela.p ? C.parcelaOro : C.parcelaVerde);
    color.lerp(sueloColor, 1 - Math.pow(verdor, 0.7));

    datosPaleta[i * 4] = color.r * 255;
    datosPaleta[i * 4 + 1] = color.g * 255;
    datosPaleta[i * 4 + 2] = color.b * 255;
    datosPaleta[i * 4 + 3] = 255;
  });

  color.set(C.parcelaVerde).lerp(sueloColor, 0.55).multiplyScalar(0.8);
  datosPaleta.set([color.r * 255, color.g * 255, color.b * 255, 255], ID_RELLENO * 4);
  texturaPaleta.needsUpdate = true;
}

function actualizarCampo(t, dt) {
  uniformes.uT.value = t;

  if (tweenSemana) {
    const k = clamp((performance.now() - tweenSemana.inicio) / tweenSemana.duracion, 0, 1);
    semana = mezcla(tweenSemana.desde, tweenSemana.hasta, Paleta.movimientoReducido() ? 1 : Util.suave(k));
    $("#week-slider").value = semana;

    if (k >= 1) {
      const resolver = tweenSemana.resolver;
      tweenSemana = null;
      resolver();
    }
  }

  if (semana !== semanaDibujada || recalcular) {
    const w = Math.min(50.99, semana);

    parcelas.forEach((parcela, i) => {
      const ndvi = muestrear(parcela.n, w) / 1000;
      const ideal = muestrear(DATA.opt.n, w) / 1000;
      const verdor = clamp((ndvi - 0.18) / 0.55, 0, 1);
      const alto = 0.08 + 1.35 * verdor * (0.7 + (0.3 * rendimientoNumerico(parcela)) / 5.6);
      const brecha = ideal > 0.3 ? Math.max(0, (ideal - ndvi) / ideal) : 0;
      const estres = clamp(brecha * 2.2, 0, 1);
      const [inicio, fin] = rangosTallos[i];

      attrAlto.fill(alto, inicio, fin);
      attrEstres.fill(estres, inicio, fin);
    });
    atributoAlto.needsUpdate = true;
    atributoEstres.needsUpdate = true;
    actualizarPaletaCampo(w);

    const s = Math.round(Math.min(51, semana));
    const clima = DATA.cli;

    $("#week-label").textContent = s + 1;
    $("#panel-climate").innerHTML = `Semana ${s + 1} · Tmín ${clima.tmin[s]}°C* ·
      Amplitud ${clima.amp[s]}°C* · GDD ${clima.gdd[s]}* · Nubosidad ${clima.cld[s]}%<br>* simulado`;

    const linea = $("#chart-now");
    if (linea) {
      const x = 10 + (semana / 51) * 340;
      linea.setAttribute("x1", x);
      linea.setAttribute("x2", x);
    }

    semanaDibujada = semana;
    recalcular = false;
  }

  uniformesSuelo.uHover.value = hover;
}

function animarSemana(desde, hasta, duracion) {
  return new Promise((resolver) => {
    if (tweenSemana) tweenSemana.resolver();
    tweenSemana = { desde, hasta, duracion, inicio: performance.now(), resolver };
  });
}

/* --- Selección con el puntero ------------------------------------------- */

const rayo = new THREE.Raycaster();
const vectorRayo = new THREE.Vector2();

function parcelaBajoPuntero() {
  vectorRayo.set(puntero.x, puntero.y);
  rayo.setFromCamera(vectorRayo, camara);

  const impactos = rayo.intersectObject(suelo);
  if (!impactos.length) return -1;

  const punto = impactos[0].point;
  const px = Math.floor((punto.x + ANCHO / 2) * PX);
  const py = Math.floor((ALTO / 2 - (punto.z - campo.position.z)) * PX);
  if (px < 0 || px >= TW || py < 0 || py >= TH) return -1;

  const id = idsCampo[py * TW + px];
  return id < parcelas.length ? id : -1;
}

