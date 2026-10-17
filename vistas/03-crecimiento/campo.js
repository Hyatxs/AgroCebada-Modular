"use strict";
/* ------------------------------------------------------------------------ */
/* Campo: parcelas irregulares                                               */
/* ------------------------------------------------------------------------ */

const campo = new THREE.Group();
campo.position.y = -100;
campo.visible = false;
escena.add(campo);

const TW = 1024;
const TH = 768;
const ANCHO = 40;
const ALTO = 30;
const PX = TW / ANCHO;
const FILA_PX = 7; // separación entre surcos, en píxeles de la textura
const ID_RELLENO = 127; // monte y linderos alrededor de las parcelas
const TOTAL_TALLOS = 20000;

let parcelas = [];
let idsCampo = new Uint8Array(TW * TH);
let angulosSurco = [];
let rangosTallos = [];

/* --- Suelo: un solo plano con mapa de identificadores -------------------- */

const texturaIds = new THREE.DataTexture(new Uint8Array(TW * TH * 4), TW, TH, THREE.RGBAFormat);
const texturaMapa = new THREE.DataTexture(new Uint8Array(TW * TH * 4), TW, TH, THREE.RGBAFormat);
const datosPaleta = new Uint8Array(128 * 4);
const texturaPaleta = new THREE.DataTexture(datosPaleta, 128, 1, THREE.RGBAFormat);

texturaIds.magFilter = texturaIds.minFilter = THREE.NearestFilter;
texturaMapa.magFilter = texturaMapa.minFilter = THREE.LinearFilter;
texturaPaleta.magFilter = texturaPaleta.minFilter = THREE.NearestFilter;
[texturaIds, texturaMapa, texturaPaleta].forEach((textura) => {
  textura.generateMipmaps = false;
  textura.needsUpdate = true;
});

const uniformesSuelo = {
  uMapa: { value: texturaMapa },
  uIds: { value: texturaIds },
  uPaleta: { value: texturaPaleta },
  uSel: { value: -1 },
  uHover: { value: -1 },
  uCamino: { value: new THREE.Color(C.camino) },
  uAcento: { value: new THREE.Color(C.rosa) },
  uPixel: { value: new THREE.Vector2(2 / TW, 2 / TH) },
};

const SHADER_SUELO_V = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SHADER_SUELO_F = `
  uniform sampler2D uMapa, uIds, uPaleta;
  uniform float uSel, uHover;
  uniform vec3 uCamino, uAcento;
  uniform vec2 uPixel;
  varying vec2 vUv;

  float identificador(vec2 uv) {
    return floor(texture2D(uIds, uv).r * 255.0 + 0.5);
  }

  void main() {
    vec4 mapa = texture2D(uMapa, vUv);
    float id = identificador(vUv);
    vec3 color = texture2D(uPaleta, vec2((id + 0.5) / 128.0, 0.5)).rgb * mapa.rgb;
    color = mix(color, uCamino, mapa.a);

    float sel = step(abs(id - uSel), 0.5);
    float hov = step(abs(id - uHover), 0.5);

    // Contorno de la parcela seleccionada
    float vecinos = max(
      max(abs(identificador(vUv + vec2(uPixel.x, 0.0)) - id), abs(identificador(vUv - vec2(uPixel.x, 0.0)) - id)),
      max(abs(identificador(vUv + vec2(0.0, uPixel.y)) - id), abs(identificador(vUv - vec2(0.0, uPixel.y)) - id))
    );
    float contorno = step(0.5, vecinos) * sel;

    color *= 1.0 + 0.1 * hov + 0.06 * sel;
    color = mix(color, uAcento, contorno * 0.95);
    gl_FragColor = vec4(color, 1.0);
  }
`;

const suelo = new THREE.Mesh(
  new THREE.PlaneGeometry(ANCHO, ALTO).rotateX(-Math.PI / 2),
  new THREE.ShaderMaterial({
    uniforms: uniformesSuelo,
    vertexShader: SHADER_SUELO_V,
    fragmentShader: SHADER_SUELO_F,
  })
);
campo.add(suelo);

/* --- Tallos de cebada (instancias) --------------------------------------- */

const attrPosicion = new Float32Array(TOTAL_TALLOS * 3);
const attrParcela = new Float32Array(TOTAL_TALLOS);
const attrAzar = new Float32Array(TOTAL_TALLOS);
const attrTipo = new Float32Array(TOTAL_TALLOS);
const attrAlto = new Float32Array(TOTAL_TALLOS);
const attrEstres = new Float32Array(TOTAL_TALLOS);

const geometriaTallo = new THREE.CylinderBufferGeometry(0.014, 0.032, 1, 4, 5);
geometriaTallo.translate(0, 0.5, 0);

const geometriaTallos = new THREE.InstancedBufferGeometry();
geometriaTallos.index = geometriaTallo.index;
geometriaTallos.setAttribute("position", geometriaTallo.attributes.position);
geometriaTallos.instanceCount = TOTAL_TALLOS;

function agregarAtributo(nombre, datos, tamano, dinamico) {
  const atributo = new THREE.InstancedBufferAttribute(datos, tamano);
  if (dinamico) atributo.setUsage(THREE.DynamicDrawUsage);
  geometriaTallos.setAttribute(nombre, atributo);
  return atributo;
}

const atributosFijos = [
  agregarAtributo("aOff", attrPosicion, 3),
  agregarAtributo("aPar", attrParcela, 1),
  agregarAtributo("aR", attrAzar, 1),
  agregarAtributo("aTy", attrTipo, 1),
];
const atributoAlto = agregarAtributo("aH", attrAlto, 1, true);
const atributoEstres = agregarAtributo("aS", attrEstres, 1, true);

const uniformes = {
  uT: { value: 0 },
  uSel: { value: 0 },
  cA: { value: new THREE.Color(C.talloVerde) },
  cB: { value: new THREE.Color(C.talloOro) },
  cD: { value: new THREE.Color(C.seco) },
};

const SHADER_VERTICE = `
  attribute vec3 aOff;
  attribute float aPar, aR, aTy, aH, aS;
  uniform float uT, uSel;
  varying float vT, vS, vSel, vTy;

  void main() {
    float alto = aH * (0.8 + 0.4 * aR);
    float t = position.y;
    vec3 p = position;

    p.xz *= 1.0 + 2.6 * smoothstep(0.8, 0.86, t) * (1.0 - smoothstep(0.97, 1.0, t));
    p.y *= alto;

    float viento = sin(uT * 1.6 + aOff.x * 0.7 + aOff.z * 0.5 + aR * 6.0) * 0.1
                 + sin(uT * 0.7 + aOff.z) * 0.06;
    float doblez = (viento + aS * 0.55) * t * t * alto;
    p.x += doblez;
    p.z += doblez * 0.4 * sin(aR * 9.0);
    p += aOff;

    vT = t;
    vS = aS;
    vTy = aTy;
    vSel = abs(aPar - uSel) < 0.5 ? 1.0 : 0.0;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const SHADER_FRAGMENTO = `
  uniform vec3 cA, cB, cD;
  varying float vT, vS, vSel, vTy;

  void main() {
    vec3 color = mix(cA, cB, vTy);
    color = mix(color * 0.7, color * 1.15, vT);
    color = mix(color, vec3(0.95, 0.82, 0.45), smoothstep(0.8, 0.9, vT) * 0.5);
    color = mix(color, cD, clamp(vS * 1.2, 0.0, 1.0));
    color += vSel * 0.16;
    gl_FragColor = vec4(color, 1.0);
  }
`;

const tallos = new THREE.Mesh(
  geometriaTallos,
  new THREE.ShaderMaterial({
    uniforms: uniformes,
    vertexShader: SHADER_VERTICE,
    fragmentShader: SHADER_FRAGMENTO,
    side: THREE.DoubleSide,
  })
);
tallos.frustumCulled = false;
campo.add(tallos);

/* --- Construcción del campo de una zona ---------------------------------- */

// Ruido determinista por píxel (para el grano del suelo)
const ruidoPixel = (x, y) => (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0;
const ruido01 = (x, y) => (ruidoPixel(x, y) % 1000) / 1000;

/**
 * Reparte el terreno entre las parcelas: cada una tiene una semilla, y su
 * "peso" depende de su área real, así las grandes ocupan más. Los bordes se
 * deforman con ondas suaves para que no sean rectas.
 */
function repartirTerreno(lista, azar) {
  const n = lista.length;
  const columnas = Math.ceil(Math.sqrt((n * ANCHO) / ALTO));
  const filas = Math.ceil(n / columnas);
  const cw = ANCHO / columnas;
  const ch = ALTO / filas;
  const areaMedia = lista.reduce((suma, p) => suma + p.a, 0) / n;

  const celdas = [];
  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < columnas; c++) {
      const i = f * columnas + c;
      celdas.push({
        x: (c + 0.5 + (azar() - 0.5) * 0.6) * cw - ANCHO / 2,
        z: (f + 0.5 + (azar() - 0.5) * 0.6) * ch - ALTO / 2,
        id: i < n ? i : ID_RELLENO,
        peso: i < n ? clamp(Math.sqrt(lista[i].a / areaMedia), 0.7, 1.45) : 0.8,
      });
    }
  }

  const ids = new Uint8Array(TW * TH);
  const suma = lista.map(() => ({ x: 0, z: 0, n: 0 }));

  for (let py = 0; py < TH; py++) {
    const z = ALTO / 2 - py / PX;

    for (let px = 0; px < TW; px++) {
      const x = px / PX - ANCHO / 2;
      let id = ID_RELLENO;

      if (px >= 8 && px < TW - 8 && py >= 8 && py < TH - 8) {
        const wx = x + Math.sin(z * 1.3 + 1.7) * 0.35 + Math.sin(z * 3.1 + x * 0.7) * 0.15;
        const wz = z + Math.sin(x * 1.1 + 0.4) * 0.35 + Math.sin(x * 2.7 - z * 0.9) * 0.15;
        const c0 = Math.floor((wx + ANCHO / 2) / cw);
        const f0 = Math.floor((wz + ALTO / 2) / ch);
        let mejor = Infinity;

        for (let df = -2; df <= 2; df++) {
          const f = f0 + df;
          if (f < 0 || f >= filas) continue;

          for (let dc = -2; dc <= 2; dc++) {
            const c = c0 + dc;
            if (c < 0 || c >= columnas) continue;

            const celda = celdas[f * columnas + c];
            const dx = wx - celda.x;
            const dz = wz - celda.z;
            const distancia = (dx * dx + dz * dz) / (celda.peso * celda.peso);

            if (distancia < mejor) {
              mejor = distancia;
              id = celda.id;
            }
          }
        }
      }

      ids[py * TW + px] = id;
      if (id !== ID_RELLENO) {
        suma[id].x += x;
        suma[id].z += z;
        suma[id].n += 1;
      }
    }
  }

  return { ids, suma };
}

/** Textura con surcos, rayado de las parcelas por predecir y linderos. */
function hornearMapa(ids, lista, angulos) {
  const datos = texturaMapa.image.data;
  const datosIds = texturaIds.image.data;

  for (let py = 0; py < TH; py++) {
    for (let px = 0; px < TW; px++) {
      const k = py * TW + px;
      const id = ids[k];

      const derecha = px < TW - 1 ? ids[k + 1] : id;
      const abajo = py < TH - 1 ? ids[k + TW] : id;
      const izquierda = px > 0 ? ids[k - 1] : id;
      const arriba = py > 0 ? ids[k - TW] : id;
      const borde = id !== derecha || id !== abajo || id !== izquierda || id !== arriba;

      let brillo;
      if (id === ID_RELLENO) {
        brillo = 0.9;
      } else {
        const angulo = angulos[id];
        const v = -px * Math.sin(angulo) + py * Math.cos(angulo);
        const surco = 0.5 + 0.5 * Math.cos((2 * Math.PI * v) / FILA_PX);

        brillo = 0.82 + 0.18 * surco;
        if (lista[id].p && (px + py) % 15 < 2) brillo *= 0.84;
      }
      brillo *= 0.95 + 0.1 * ruido01(px, py);

      datos[k * 4] = datos[k * 4 + 1] = datos[k * 4 + 2] = Math.min(255, brillo * 255);
      datos[k * 4 + 3] = borde ? 230 : 0;

      datosIds[k * 4] = id;
      datosIds[k * 4 + 3] = 255;
    }
  }
  texturaMapa.needsUpdate = true;
  texturaIds.needsUpdate = true;
}

/** Tallos en hileras siguiendo el rumbo de los surcos de cada parcela. */
function sembrarTallos(ids, lista, angulos, azar) {
  const cubos = lista.map(() => []);
  let total = 0;
  let intentos = 0;

  while (total < TOTAL_TALLOS && intentos < TOTAL_TALLOS * 8) {
    intentos++;

    const px = 12 + azar() * (TW - 24);
    const py = 12 + azar() * (TH - 24);
    const id = ids[Math.floor(py) * TW + Math.floor(px)];
    if (id >= lista.length) continue;

    const seno = Math.sin(angulos[id]);
    const coseno = Math.cos(angulos[id]);
    const u = px * coseno + py * seno;
    const v = Math.round((-px * seno + py * coseno) / FILA_PX) * FILA_PX;

    const qx = u * coseno - v * seno + (azar() - 0.5) * 1.2;
    const qy = u * seno + v * coseno + (azar() - 0.5) * 1.2;
    if (qx < 4 || qx >= TW - 4 || qy < 4 || qy >= TH - 4) continue;

    // Que no se salgan de su parcela (se revisan los lados)
    const misma = [
      ids[Math.floor(qy) * TW + Math.floor(qx)],
      ids[Math.floor(qy) * TW + Math.floor(qx + 3)],
      ids[Math.floor(qy) * TW + Math.floor(qx - 3)],
      ids[Math.floor(qy + 3) * TW + Math.floor(qx)],
      ids[Math.floor(qy - 3) * TW + Math.floor(qx)],
    ].every((valor) => valor === id);
    if (!misma) continue;

    cubos[id].push(qx / PX - ANCHO / 2, ALTO / 2 - qy / PX);
    total++;
  }

  // Volcado ordenado por parcela
  attrAlto.fill(0);
  attrEstres.fill(0);
  attrPosicion.fill(0);
  attrPosicion.forEach((_, i) => {
    if (i % 3 === 1) attrPosicion[i] = -1000;
  });

  const rangos_ = [];
  let n = 0;

  cubos.forEach((coordenadas, id) => {
    const inicio = n;

    for (let k = 0; k < coordenadas.length; k += 2) {
      attrPosicion.set([coordenadas[k], 0, coordenadas[k + 1]], n * 3);
      attrParcela[n] = id;
      attrAzar[n] = azar();
      attrTipo[n] = lista[id].p;
      n++;
    }
    rangos_.push([inicio, n]);
  });

  atributosFijos.forEach((atributo) => {
    atributo.needsUpdate = true;
  });
  return rangos_;
}

function cargarZona(zona) {
  const lista = zonaDe(zona);
  const azar = Util.crearRng(zona * 913 + 17);

  angulosSurco = lista.map(() => azar() * Math.PI);

  const { ids, suma } = repartirTerreno(lista, azar);
  idsCampo = ids;
  hornearMapa(ids, lista, angulosSurco);
  rangosTallos = sembrarTallos(ids, lista, angulosSurco, azar);

  parcelas = lista.map((parcela, i) => {
    const centro = suma[i];
    const resultado = resultadosPython.get(parcela.id);

    return {
      ...parcela,
      pred: resultado ? resultado.rendimiento_estimado : null,
      aportes: resultado ? resultado.contribuciones : null,
      x: centro.n ? centro.x / centro.n : 0,
      z: centro.n ? centro.z / centro.n : 0,
      radio: Math.sqrt(centro.n / Math.PI) / PX,
    };
  });

  recalcular = true;
  hover = -1;
  enfocado = false;
  actualizarBotonPredecir();
  seleccionar(0);
}

