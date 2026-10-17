"use strict";

/*
 * Mapa y parcelas.
 *
 *   contexto  → la mascota explica qué es una parcela
 *   estados   → globo con divisiones; se elige Puebla, Tlaxcala o Hidalgo
 *   viaje     → se resalta el estado, la mascota habla, salta girando y se
 *               encoge sobre él (sin scroll)
 *   campo     → parcelas irregulares; primero la mascota cuenta cómo creció
 *               la cebada (sin barra) y luego se abre la barra de semanas
 *
 * Las posiciones de las parcelas son ilustrativas: los CSV no traen
 * coordenadas. Forma y tamaño sí parten de datos reales (área en hectáreas).
 */

const C = { ...Paleta.actual };

/* ------------------------------------------------------------------------ */
/* Renderizador, escena y mascota                                            */
/* ------------------------------------------------------------------------ */

const renderizador = new THREE.WebGLRenderer({ canvas: $("#gl"), antialias: true, alpha: true });
const escena = new THREE.Scene();
const camara = new THREE.PerspectiveCamera(45, 1, 0.1, 300);
const mascota = crearEscenaMascota($("#mascot"));

renderizador.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

function ajustarTamano() {
  renderizador.setSize(window.innerWidth, window.innerHeight, false);
  camara.aspect = window.innerWidth / window.innerHeight;
  camara.updateProjectionMatrix();
  mascota.ajustar();
}

const puntero = mascota.puntero;

/* ------------------------------------------------------------------------ */
/* Geometría y utilidades geográficas                                        */
/* ------------------------------------------------------------------------ */

function puntoEnPoligono(x, y, poligono) {
  let dentro = false;

  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const [xi, yi] = poligono[i];
    const [xj, yj] = poligono[j];
    const cruza = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (cruza) dentro = !dentro;
  }
  return dentro;
}

function latLonAVector(lon, lat, radio) {
  const lambda = lon * D2R;
  const phi = lat * D2R;

  return new THREE.Vector3(
    radio * Math.cos(phi) * Math.sin(lambda),
    radio * Math.sin(phi),
    radio * Math.cos(phi) * Math.cos(lambda)
  );
}

const enMexico = (lon, lat) => CONTORNO_MEXICO.some((poligono) => puntoEnPoligono(lon, lat, poligono));

const enTierra = (lon, lat) =>
  Object.values(PAISES).some((poligono) => puntoEnPoligono(lon, lat, poligono));

function densificar(poligono) {
  const resultado = [];

  poligono.forEach((a, i) => {
    const b = poligono[(i + 1) % poligono.length];
    const pasos = Math.max(
      1,
      Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) / 0.4)
    );

    for (let p = 0; p < pasos; p++) {
      resultado.push([mezcla(a[0], b[0], p / pasos), mezcla(a[1], b[1], p / pasos)]);
    }
  });
  return resultado;
}

/* ------------------------------------------------------------------------ */
/* Globo con divisiones por estado                                           */
/* ------------------------------------------------------------------------ */

const RADIO = 3.0;
const globo = new THREE.Group();
escena.add(globo);

const crearNube = (vectores, color) =>
  new THREE.Points(
    new THREE.BufferGeometry().setFromPoints(vectores),
    new THREE.PointsMaterial({ color, size: 0.03 })
  );

const enEstados = (lon, lat, poligono) => puntoEnPoligono(lon, lat, poligono);

/** Nombre del estado en un punto (los enclaves se pintan encima, así que se revisan al revés). */
function estadoEnPunto(lon, lat) {
  for (let i = ESTADOS_MEXICO.length - 1; i >= 0; i--) {
    if (enEstados(lon, lat, ESTADOS_MEXICO[i].anillo)) return ESTADOS_MEXICO[i].nombre;
  }
  return null;
}

function crearPuntosGlobo() {
  const base = [];
  const TOTAL_BASE = 16000;

  for (let i = 0; i < TOTAL_BASE; i++) {
    const y = 1 - (2 * (i + 0.5)) / TOTAL_BASE;
    const radio = Math.sqrt(1 - y * y);
    const angulo = i * 2.39996;
    const lat = Math.asin(y) / D2R;
    const lon = Math.atan2(radio * Math.sin(angulo), radio * Math.cos(angulo)) / D2R;

    if (!enMexico(lon, lat) && enTierra(lon, lat)) base.push(latLonAVector(lon, lat, RADIO));
  }
  return { base };
}

/* --- Textura de México: estados con relleno y fronteras nítidas ----------- */

// Ventana geográfica de la textura (2:1 para poder usar mipmaps)
const TEXTURA = { lon0: -118.5, lon1: -86.5, lat0: 14, lat1: 33.2, ancho: 4096, alto: 2048 };

const lienzoMexico = document.createElement("canvas");
lienzoMexico.width = TEXTURA.ancho;
lienzoMexico.height = TEXTURA.alto;

const texturaMexico = new THREE.CanvasTexture(lienzoMexico);
texturaMexico.generateMipmaps = true;
texturaMexico.minFilter = THREE.LinearMipmapLinearFilter;
texturaMexico.magFilter = THREE.LinearFilter;
texturaMexico.anisotropy = Math.min(8, renderizador.capabilities.getMaxAnisotropy());

const aPixelX = (lon) => ((lon - TEXTURA.lon0) / (TEXTURA.lon1 - TEXTURA.lon0)) * TEXTURA.ancho;
const aPixelY = (lat) => ((TEXTURA.lat1 - lat) / (TEXTURA.lat1 - TEXTURA.lat0)) * TEXTURA.alto;

function trazarPoligono(g, anillo) {
  g.beginPath();
  anillo.forEach(([lon, lat], i) => {
    if (i) g.lineTo(aPixelX(lon), aPixelY(lat));
    else g.moveTo(aPixelX(lon), aPixelY(lat));
  });
  g.closePath();
}

function dibujarTexturaMexico() {
  const g = lienzoMexico.getContext("2d");
  const color = (hex) => new THREE.Color(hex);
  const aCss = (c) => `#${c.getHexString()}`;

  // Tres tonos suaves para que los vecinos se distingan sin depender de la línea
  const tonos = [
    aCss(color(C.puntos).lerp(color(C.sky), 0.42)),
    aCss(color(C.puntos).lerp(color(C.sky), 0.62)),
    aCss(color(C.puntos).lerp(color(C.oceano), 0.25)),
  ];
  const tonoReto = aCss(color(C.oro).lerp(color(C.sky), 0.28));

  g.clearRect(0, 0, TEXTURA.ancho, TEXTURA.alto);
  g.save();

  // Todo se recorta con el contorno del país
  g.beginPath();
  CONTORNO_MEXICO.forEach((poligono) => {
    poligono.forEach(([lon, lat], i) => {
      if (i) g.lineTo(aPixelX(lon), aPixelY(lat));
      else g.moveTo(aPixelX(lon), aPixelY(lat));
    });
    g.closePath();
  });
  g.clip();

  g.lineJoin = "round";
  ESTADOS_MEXICO.forEach((estado, i) => {
    const esReto = ESTADOS_OBJETIVO.some((e) => e.nombre === estado.nombre);

    trazarPoligono(g, estado.anillo);
    g.fillStyle = esReto ? tonoReto : tonos[i % tonos.length];
    g.fill();
    g.lineWidth = 4;
    g.strokeStyle = aCss(color(C.borde));
    g.globalAlpha = 0.95;
    g.stroke();
    g.globalAlpha = 1;
  });
  g.restore();

  // Costa
  g.lineWidth = 4;
  g.strokeStyle = aCss(color(C.borde));
  CONTORNO_MEXICO.forEach((poligono) => {
    trazarPoligono(g, poligono);
    g.stroke();
  });
  texturaMexico.needsUpdate = true;
}

const puntosGlobo = crearPuntosGlobo();
const nubeBase = crearNube(puntosGlobo.base, C.puntos);

const esferaOceano = new THREE.Mesh(
  new THREE.SphereGeometry(2.97, 48, 32),
  new THREE.MeshBasicMaterial({ color: C.oceano })
);

// Parche de esfera con la textura, solo sobre la ventana de México
const parcheMexico = new THREE.Mesh(
  new THREE.SphereGeometry(
    RADIO + 0.006,
    128,
    64,
    (TEXTURA.lon0 + 90) * D2R,
    (TEXTURA.lon1 - TEXTURA.lon0) * D2R,
    (90 - TEXTURA.lat1) * D2R,
    (TEXTURA.lat1 - TEXTURA.lat0) * D2R
  ),
  new THREE.MeshBasicMaterial({ map: texturaMexico, transparent: true, depthWrite: false })
);
globo.add(nubeBase, esferaOceano, parcheMexico);
dibujarTexturaMexico();

const materialFronteras = new THREE.LineBasicMaterial({ color: C.rosa, transparent: true, opacity: 0.55 });

Object.values(PAISES).forEach((poligono) => {
  const vectores = densificar(poligono).map(([lon, lat]) => latLonAVector(lon, lat, RADIO + 0.012));
  globo.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(vectores), materialFronteras));
});

// Estados del reto: contorno propio y, si se eligen, relleno con puntos
const estadosGlobo = ESTADOS_OBJETIVO.map((estado) => {
  const puntos = [];
  const [lons, lats] = [estado.poligono.map((p) => p[0]), estado.poligono.map((p) => p[1])];
  const tlaxcala = ESTADOS_MEXICO.find((e) => e.nombre === "Tlaxcala").anillo;

  for (let lon = Math.min(...lons); lon <= Math.max(...lons); lon += estado.paso) {
    for (let lat = Math.min(...lats); lat <= Math.max(...lats); lat += estado.paso) {
      const dentro = puntoEnPoligono(lon, lat, estado.poligono);
      const enTlaxcala = estado.nombre !== "Tlaxcala" && puntoEnPoligono(lon, lat, tlaxcala);

      if (dentro && !enTlaxcala) puntos.push(latLonAVector(lon, lat, RADIO + 0.01));
    }
  }

  const nube = crearNube(puntos, C.rosa);
  nube.visible = false;

  const material = new THREE.LineBasicMaterial({ color: C.rosa, transparent: true, opacity: 0.9 });
  const vectores = densificar(estado.poligono).map(([lon, lat]) =>
    latLonAVector(lon, lat, RADIO + 0.016)
  );
  const contorno = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(vectores), material);

  globo.add(nube, contorno);
  return { nube, contorno, material };
});

/* --- Pulso sobre el estado elegido --------------------------------------- */

function texturaCanvas(dibujar) {
  const lienzo = document.createElement("canvas");
  lienzo.width = lienzo.height = 128;
  dibujar(lienzo.getContext("2d"));
  return new THREE.CanvasTexture(lienzo);
}

const texturaAnillo = texturaCanvas((g) => {
  g.strokeStyle = "#fff";
  g.lineWidth = 6;
  g.beginPath();
  g.arc(64, 64, 56, 0, Math.PI * 2);
  g.stroke();
});

const materialesPulso = [];
function crearSpritePulso(textura) {
  const material = new THREE.SpriteMaterial({
    map: textura,
    color: C.rosa,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  materialesPulso.push(material);

  const sprite = new THREE.Sprite(material);
  sprite.renderOrder = 10;
  return sprite;
}

const pulso = new THREE.Group();
pulso.visible = false;
globo.add(pulso);
const ondasPulso = [0, 1, 2].map(() => crearSpritePulso(texturaAnillo));
pulso.add(...ondasPulso);

const brote = { base: new THREE.Vector3(), normal: new THREE.Vector3(0, 1, 0), tiempo: 99, activo: false };

/* --- Marcadores HTML sobre el globo -------------------------------------- */

let estadoElegido = -1;

const marcadores = ESTADOS_OBJETIVO.map((estado, indice) => {
  const boton = document.createElement("button");
  boton.className = "state-marker";
  boton.textContent = estado.nombre;
  boton.addEventListener("click", () => elegirEstado(indice));
  $("#state-markers").appendChild(boton);
  return boton;
});

// Nombres de los demás estados: aparecen al acercarse
const ESTADOS_CHICOS = ["Colima", "Morelos", "Ciudad de México", "Aguascalientes"];

const etiquetasEstados = ESTADOS_MEXICO.filter(
  (estado) => !ESTADOS_OBJETIVO.some((objetivo) => objetivo.nombre === estado.nombre)
).map((estado) => {
  const span = document.createElement("span");

  span.className = "etiqueta-estado";
  span.textContent = estado.nombre;
  $("#state-markers").appendChild(span);
  return { estado, span, chico: ESTADOS_CHICOS.includes(estado.nombre) };
});

/** Proyecta un punto del globo a la pantalla; devuelve null si está al otro lado. */
function proyectarEnGlobo(lon, lat) {
  const posicion = latLonAVector(lon, lat, RADIO).applyMatrix4(globo.matrixWorld);
  const haciaCamara = camara.position.clone().sub(posicion);

  if (posicion.clone().normalize().dot(haciaCamara) <= 0) return null;

  const pantalla = posicion.project(camara);
  return {
    x: (pantalla.x * 0.5 + 0.5) * window.innerWidth,
    y: (-pantalla.y * 0.5 + 0.5) * window.innerHeight,
  };
}

function actualizarMarcadores() {
  const enGlobo = vista === "estados" || vista === "contexto";
  const visibles = vista === "estados" && estadoElegido < 0;
  const distancia = miradaGlobo.z - RADIO;

  marcadores.forEach((boton, i) => {
    const punto = visibles ? proyectarEnGlobo(ESTADOS_OBJETIVO[i].lon, ESTADOS_OBJETIVO[i].lat) : null;

    if (punto) {
      boton.style.left = punto.x + "px";
      boton.style.top = punto.y + "px";
    }
    boton.style.display = punto ? "block" : "none";
  });

  etiquetasEstados.forEach(({ estado, span, chico }) => {
    const mostrar = enGlobo && distancia < (chico ? 1.7 : 3.2);
    const punto = mostrar ? proyectarEnGlobo(estado.etiqueta[0], estado.etiqueta[1]) : null;

    if (punto) {
      span.style.left = punto.x + "px";
      span.style.top = punto.y + "px";
    }
    span.style.display = punto ? "block" : "none";
  });
}

/* ------------------------------------------------------------------------ */
/* Control libre del globo: arrastrar, zoom con rueda o pellizco, botones    */
/* ------------------------------------------------------------------------ */

const lienzoGl = $("#gl");
const punterosActivos = new Map();
let arrastre = null;
let distanciaPellizco = 0;

const puedeInteractuar = () => vista === "contexto" || vista === "estados";

function gradosPorPixel() {
  const distancia = Math.max(0.3, miradaGlobo.z - RADIO);
  const unidadesPorPixel = (2 * Math.tan(22.5 * D2R) * distancia) / window.innerHeight;

  return unidadesPorPixel / RADIO / D2R;
}

/** factor < 1 acerca, factor > 1 aleja (se mide desde la superficie). */
function zoomPor(factor, inmediato = false) {
  const objetivo = miradaGlobo.objetivo;

  objetivo.z = clamp(RADIO + (objetivo.z - RADIO) * factor, ZOOM_MIN, ZOOM_MAX);
  if (inmediato) miradaGlobo.z = objetivo.z;
}

function moverVista(dx, dy) {
  const grados = gradosPorPixel();
  const objetivo = miradaGlobo.objetivo;

  objetivo.lon -= dx * grados;
  objetivo.lat = clamp(objetivo.lat + dy * grados, -70, 75);
  miradaGlobo.lon = objetivo.lon;
  miradaGlobo.lat = objetivo.lat;
}

function restablecerVista() {
  miradaGlobo.objetivo = vistaGloboAjustada(vista === "contexto" ? "contexto" : "estados");
}

/** Estado bajo un punto de la pantalla (nombre) o null. */
function estadoBajoPantalla(clientX, clientY) {
  const rayoGlobo = new THREE.Raycaster();
  rayoGlobo.setFromCamera(
    new THREE.Vector2((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1),
    camara
  );

  const punto = new THREE.Vector3();
  if (!rayoGlobo.ray.intersectSphere(new THREE.Sphere(new THREE.Vector3(), RADIO), punto)) return null;

  globo.worldToLocal(punto);
  const lat = Math.asin(clamp(punto.y / RADIO, -1, 1)) / D2R;
  const lon = Math.atan2(punto.x, punto.z) / D2R;

  return estadoEnPunto(lon, lat);
}

lienzoGl.addEventListener("pointerdown", (evento) => {
  if (!puedeInteractuar()) return;

  lienzoGl.setPointerCapture(evento.pointerId);
  punterosActivos.set(evento.pointerId, { x: evento.clientX, y: evento.clientY });
  arrastre = { movido: 0 };

  if (punterosActivos.size === 2) {
    const [a, b] = [...punterosActivos.values()];
    distanciaPellizco = Math.hypot(a.x - b.x, a.y - b.y);
  }
  lienzoGl.classList.add("arrastrando");
});

lienzoGl.addEventListener("pointermove", (evento) => {
  const previo = punterosActivos.get(evento.pointerId);
  if (!previo || !puedeInteractuar()) return;

  const dx = evento.clientX - previo.x;
  const dy = evento.clientY - previo.y;
  punterosActivos.set(evento.pointerId, { x: evento.clientX, y: evento.clientY });

  if (punterosActivos.size === 2) {
    const [a, b] = [...punterosActivos.values()];
    const distancia = Math.hypot(a.x - b.x, a.y - b.y);

    if (distanciaPellizco > 0) zoomPor(distanciaPellizco / distancia, true);
    distanciaPellizco = distancia;
    if (arrastre) arrastre.movido += 10;
    return;
  }

  if (arrastre) arrastre.movido += Math.abs(dx) + Math.abs(dy);
  moverVista(dx, dy);
});

function soltarPuntero(evento) {
  const eraToque = arrastre && arrastre.movido < 6 && punterosActivos.size === 1;

  punterosActivos.delete(evento.pointerId);
  if (!punterosActivos.size) {
    arrastre = null;
    lienzoGl.classList.remove("arrastrando");
  }
  distanciaPellizco = 0;

  if (eraToque && evento.type === "pointerup") elegirEnMapa(evento.clientX, evento.clientY);
}

lienzoGl.addEventListener("pointerup", soltarPuntero);
lienzoGl.addEventListener("pointercancel", soltarPuntero);

lienzoGl.addEventListener(
  "wheel",
  (evento) => {
    if (!puedeInteractuar()) return;

    evento.preventDefault();
    zoomPor(Math.exp(evento.deltaY * 0.0012));
  },
  { passive: false }
);

function elegirEnMapa(x, y) {
  if (vista !== "estados" || estadoElegido >= 0) return;

  const nombre = estadoBajoPantalla(x, y);
  if (!nombre) return;

  const indice = ESTADOS_OBJETIVO.findIndex((e) => e.nombre === nombre);
  if (indice >= 0) elegirEstado(indice);
  else Narrador.decir(`${nombre}. En este reto solo hay parcelas en Puebla, Tlaxcala e Hidalgo. ¡Elige uno de esos!`);
}

$("#zoom-mas").addEventListener("click", () => zoomPor(0.7));
$("#zoom-menos").addEventListener("click", () => zoomPor(1.4));
$("#zoom-reset").addEventListener("click", restablecerVista);

window.addEventListener("keydown", (evento) => {
  if (!puedeInteractuar() || evento.target.closest("input")) return;

  if (evento.key === "+" || evento.key === "=") zoomPor(0.7);
  if (evento.key === "-" || evento.key === "_") zoomPor(1.4);
});

/* ------------------------------------------------------------------------ */
/* Cámara del globo                                                          */
/* ------------------------------------------------------------------------ */

// México ocupa buena parte de la pantalla; la vista queda algo hacia el este
// para que el panel de la derecha no tape el mapa.
const VISTAS_GLOBO = {
  contexto: { lon: -98.5, lat: 23, z: 5.6 },
  estados: { lon: -97.5, lat: 23.2, z: 4.4 },
};

const ZOOM_MIN = RADIO + 0.35;
const ZOOM_MAX = 12;

const miradaGlobo = { lon: -98.5, lat: 23, z: 5.6, objetivo: { ...VISTAS_GLOBO.contexto } };

/** En pantallas angostas se aleja un poco para que quepa todo el país. */
function vistaGloboAjustada(nombre) {
  const vista = { ...VISTAS_GLOBO[nombre] };
  const factor = Math.max(1, 1.15 / camara.aspect);

  vista.z = RADIO + (vista.z - RADIO) * factor;
  return vista;
}

function actualizarGlobo(t, dt) {
  const k = 1 - Math.exp(-dt * 2.4);
  const objetivo = miradaGlobo.objetivo;
  const deriva = vista === "contexto" && !arrastre ? Math.sin(t * 0.25) * 3 : 0;

  miradaGlobo.lon += (objetivo.lon + deriva - miradaGlobo.lon) * k;
  miradaGlobo.lat += (objetivo.lat - miradaGlobo.lat) * k;
  miradaGlobo.z += (objetivo.z - miradaGlobo.z) * k;

  globo.rotation.y = -miradaGlobo.lon * D2R;
  globo.rotation.x = miradaGlobo.lat * D2R;
  globo.updateMatrixWorld();

  const distancia = Math.max(0.3, miradaGlobo.z - RADIO);
  const altoPantalla = window.innerHeight;
  const px = (pixeles) => (pixeles * 2 * distancia) / altoPantalla;

  nubeBase.material.size = px(2.2);
  estadosGlobo.forEach((e) => {
    e.nube.material.size = px(3.6);
  });

  actualizarPulso(dt);
}

function actualizarPulso(dt) {
  if (!brote.activo) return;
  brote.tiempo += dt;

  const mundo = pulso.position.clone().applyMatrix4(globo.matrixWorld);
  const normal = brote.normal.clone().transformDirection(globo.matrixWorld);
  pulso.visible = normal.dot(camara.position.clone().sub(mundo)) > 0;
  if (!pulso.visible) return;

  const px = (2 * Math.tan(22.5 * D2R) * camara.position.distanceTo(mundo)) / window.innerHeight;
  const k = Math.min(1, brote.tiempo * 1.4);
  const entrada = Math.max(0, 1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2));

  ondasPulso.forEach((onda, i) => {
    const fase = (brote.tiempo / 2.4 + i / 3) % 1;
    onda.scale.setScalar((10 + 90 * fase) * px * entrada);
    onda.material.opacity = Math.pow(1 - fase, 1.5) * 0.9 * Math.min(1, k * 2);
  });
}

