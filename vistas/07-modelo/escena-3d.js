"use strict";

/*
 * Escena 3D del capítulo 2, a pantalla completa: una maqueta con las 197 parcelas.
 *
 * - Mapa esquemático: las parcelas se acercaron entre sí para verlas juntas (forma y tamaño reales;
 *   distancias en pantalla no). datos-modelo.js trae el desplazamiento de cada parcela
 *   (herramientas/compactar_mapa.py). El modelo nunca usa estas posiciones.
 * - Relieve: elevación INEGI de cada parcela, suavizada y exagerada, con bordes de tierra y sombra.
 *   Cada parcela es una loseta que sigue la pendiente (plano ajustado a su superficie).
 * - Parcelas con el estilo del esqueleto: surcos, rayado en las por predecir y tallos que se mecen
 *   (verdes las conocidas, dorados las por predecir).
 * - Cámara con guion: objetivo, distancia, giro, inclinación y corrimiento lateral de lente (para
 *   que el texto quepa a un lado sin taparla). La página la mueve con el scroll.
 *
 * Si no hay WebGL o three.js no cargó, crearVistaParcelas usa el mapa SVG plano.
 */

const EXAGERACION = 2.0; // relieve vertical
const ELEV_REF = 2700; // m s. n. m.

function crearEscena3D(contenedor, datosOriginales, opciones = {}) {
  /* --- Parcelas en el mapa compacto -------------------------------------- */

  const municipiosLista = datosOriginales.municipios;
  const municipios = new Map(municipiosLista.map((m) => [m.nombre, m]));
  const parcelas = datosOriginales.parcelas.map((p) => ({
    ...p,
    x: p.x + (p.dx || 0),
    y: p.y + (p.dy || 0),
    poly: [p.poly[0].map(([x, y]) => [x + (p.dx || 0), y + (p.dy || 0)])],
    elev: p.elev ?? municipios.get(p.mun).elev,
  }));
  const N = parcelas.length;
  const indice = new Map(parcelas.map((p, i) => [p.id, i]));
  const deId = (pOid) => parcelas[indice.get(typeof pOid === "string" ? pOid : pOid.id)];

  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  parcelas.forEach((p) => p.poly[0].forEach(([x, z]) => {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }));
  const centro = { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 };
  const total = { x: minX, y: minZ, w: maxX - minX, h: maxZ - minZ };

  /* --- Renderizador ------------------------------------------------------- */

  const lienzo = document.createElement("canvas");
  lienzo.className = "c2-lienzo-3d";
  contenedor.appendChild(lienzo);
  const capaEtiquetas = document.createElement("div");
  capaEtiquetas.className = "c2-etiquetas-3d";
  contenedor.appendChild(capaEtiquetas);

  const renderizador = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true });
  renderizador.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(36, 1, 0.01, 500);
  const niebla = new THREE.Fog(0xffffff, 30, 120);
  escena.fog = niebla;

  const C = () => Paleta.actual;
  const color = (hex) => new THREE.Color(hex);
  const conNiebla = (u) => Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), u);

  /* --- Relieve: una maqueta con bordes de tierra -------------------------- */

  // Ruido de valor determinista (textura leve del terreno)
  const azarSemilla = Util.crearRng(2026);
  const tablaRuido = Array.from({ length: 512 }, () => azarSemilla());
  const hash2 = (i, j) => tablaRuido[((i * 73856093) ^ (j * 19349663)) & 511];
  function ruido(x, z) {
    const i = Math.floor(x), j = Math.floor(z);
    const fx = x - i, fz = z - j;
    const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
    const a = hash2(i, j), b = hash2(i + 1, j), c = hash2(i, j + 1), d = hash2(i + 1, j + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  const fbm = (x, z) => ruido(x, z) * 0.6 + ruido(x * 2.3 + 7, z * 2.3 + 3) * 0.4;

  const alturaElev = (elev) => ((elev - ELEV_REF) / 1000) * EXAGERACION;

  // Altura: elevación INEGI de las parcelas, suavizada (promedio gaussiano de 450 m, con un
  // respaldo lejano para los bordes) y una ondulación muy leve
  const DOS_SIGMA2 = 2 * 0.45 * 0.45;
  function alturaSuave(x, z) {
    let suma = 0, pesos = 0;
    for (let i = 0; i < N; i++) {
      const p = parcelas[i];
      const d2 = (p.x - x) ** 2 + (p.y - z) ** 2;
      const w = Math.exp(-d2 / DOS_SIGMA2) + 1e-4 / ((d2 + 1) * (d2 + 1));
      suma += w * p.hElev;
      pesos += w;
    }
    return suma / pesos;
  }
  parcelas.forEach((p) => (p.hElev = alturaElev(p.elev)));

  // La maqueta: el rectángulo de las parcelas más un margen
  const MARGEN = 0.5;
  const T = { x0: minX - MARGEN, z0: minZ - MARGEN, w: maxX - minX + 2 * MARGEN, h: maxZ - minZ + 2 * MARGEN };

  // La superficie suave se calcula en una rejilla gruesa (100 m) y se interpola: es mucho más rápido
  const GRUESA = 0.1;
  const GX = Math.ceil(T.w / GRUESA) + 1, GZ = Math.ceil(T.h / GRUESA) + 1;
  const suave = new Float32Array((GX + 1) * (GZ + 1));
  for (let j = 0; j <= GZ; j++) {
    for (let i = 0; i <= GX; i++) suave[j * (GX + 1) + i] = alturaSuave(T.x0 + i * GRUESA, T.z0 + j * GRUESA);
  }
  function alturaBase(x, z) {
    const fi = Util.clamp((x - T.x0) / GRUESA, 0, GX - 1e-6);
    const fj = Util.clamp((z - T.z0) / GRUESA, 0, GZ - 1e-6);
    const i = Math.floor(fi), j = Math.floor(fj);
    const u = fi - i, v = fj - j;
    const k = j * (GX + 1) + i;
    const h = suave[k] * (1 - u) * (1 - v) + suave[k + 1] * u * (1 - v) + suave[k + GX + 1] * (1 - u) * v + suave[k + GX + 2] * u * v;
    return h + (fbm(x / 0.9, z / 0.9) - 0.5) * 0.04;
  }
  const celda = 0.035;
  const SX = Math.ceil(T.w / celda), SZ = Math.ceil(T.h / celda);
  T.w = SX * celda; T.h = SZ * celda;
  const alturas = new Float32Array((SX + 1) * (SZ + 1));
  for (let j = 0; j <= SZ; j++) {
    for (let i = 0; i <= SX; i++) alturas[j * (SX + 1) + i] = alturaBase(T.x0 + i * celda, T.z0 + j * celda);
  }

  const dentro = (x, z, anillo) => {
    let si = false;
    for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
      const [xi, zi] = anillo[i], [xj, zj] = anillo[j];
      if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) si = !si;
    }
    return si;
  };

  // Cada parcela es una loseta plana que sigue la pendiente del terreno (un plano ajustado a su
  // superficie); bajo ella el terreno no sobresale.
  const ALTO_LOSETA = 0.01;
  parcelas.forEach((p) => {
    p.radio = Math.sqrt((p.ha / 100) / Math.PI);
    const anillo = p.poly[0];
    const xs = anillo.map((q) => q[0]), zs = anillo.map((q) => q[1]);
    const bx0 = Math.min(...xs), bx1 = Math.max(...xs), bz0 = Math.min(...zs), bz1 = Math.max(...zs);
    // Plano por mínimos cuadrados con muestras dentro del polígono (y sus vértices)
    const muestras = anillo.map(([x, z]) => [x, z]);
    const paso = Math.max(0.02, Math.max(bx1 - bx0, bz1 - bz0) / 8);
    for (let x = bx0; x <= bx1; x += paso) for (let z = bz0; z <= bz1; z += paso) if (dentro(x, z, anillo)) muestras.push([x, z]);
    let sxx = 0, sxz = 0, szz = 0, sx = 0, sz = 0, sh = 0, sxh = 0, szh = 0;
    muestras.forEach(([x, z]) => {
      const u = x - p.x, v = z - p.y, h = alturaBase(x, z);
      sxx += u * u; sxz += u * v; szz += v * v; sx += u; sz += v; sh += h; sxh += u * h; szh += v * h;
    });
    const n = muestras.length;
    const a0 = sh / n;
    const cu = sxh - sx * a0, cv = szh - sz * a0;
    const det = sxx * szz - sxz * sxz;
    p.pb = det > 1e-9 ? (cu * szz - cv * sxz) / det : 0;
    p.pc = det > 1e-9 ? (cv * sxx - cu * sxz) / det : 0;
    p.h = a0 - p.pb * (sx / n) - p.pc * (sz / n);
    const plano = (x, z) => p.h + p.pb * (x - p.x) + p.pc * (z - p.y);
    const i0 = Math.max(0, Math.floor((bx0 - T.x0) / celda) - 1);
    const i1 = Math.min(SX, Math.ceil((bx1 - T.x0) / celda) + 1);
    const j0 = Math.max(0, Math.floor((bz0 - T.z0) / celda) - 1);
    const j1 = Math.min(SZ, Math.ceil((bz1 - T.z0) / celda) + 1);
    const e = celda * 0.75;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const x = T.x0 + i * celda, z = T.z0 + j * celda;
        if (dentro(x, z, anillo) || dentro(x + e, z, anillo) || dentro(x - e, z, anillo) || dentro(x, z + e, anillo) || dentro(x, z - e, anillo)) {
          const k = j * (SX + 1) + i;
          alturas[k] = Math.min(alturas[k], plano(x, z) - 0.002);
        }
      }
    }
  });
  /** Altura de la cara de arriba de una loseta en (x, z). */
  const topeEn = (p, x, z) => p.h + p.pb * (x - p.x) + p.pc * (z - p.y) + ALTO_LOSETA;

  let alturaMin = Infinity;
  for (let k = 0; k < alturas.length; k++) alturaMin = Math.min(alturaMin, alturas[k]);
  const BASE = alturaMin - 0.32; // fondo de la maqueta

  function alturaEn(x, z) {
    const fi = Util.clamp((x - T.x0) / celda, 0, SX - 1e-6);
    const fj = Util.clamp((z - T.z0) / celda, 0, SZ - 1e-6);
    const i = Math.floor(fi), j = Math.floor(fj);
    const u = fi - i, v = fj - j;
    const k = j * (SX + 1) + i;
    const a = alturas[k], b = alturas[k + 1], c = alturas[k + SX + 1], d = alturas[k + SX + 2];
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
  }

  const geoTerreno = new THREE.PlaneGeometry(T.w, T.h, SX, SZ).rotateX(-Math.PI / 2);
  {
    const pos = geoTerreno.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      // PlaneGeometry rotada: x crece hacia la derecha, z hacia el frente
      const x = pos.getX(k) + T.x0 + T.w / 2;
      const z = pos.getZ(k) + T.z0 + T.h / 2;
      const i = Math.round((x - T.x0) / celda), j = Math.round((z - T.z0) / celda);
      pos.setXYZ(k, x, alturas[j * (SX + 1) + i], z);
    }
    geoTerreno.computeVertexNormals();
  }

  const uniformesTerreno = {
    cCampo: { value: new THREE.Color() },
    cCampo2: { value: new THREE.Color() },
    cMonte: { value: new THREE.Color() },
    cLinea: { value: new THREE.Color() },
    uOrigen: { value: new THREE.Vector2(T.x0, T.z0) },
    uDetalle: { value: 1 },
  };
  const terreno = new THREE.Mesh(
    geoTerreno,
    new THREE.ShaderMaterial({
      uniforms: conNiebla(uniformesTerreno),
      fog: true,
      extensions: { derivatives: true },
      vertexShader: `
        varying vec3 vP, vN;
        #include <fog_pars_vertex>
        void main() {
          vP = position; vN = normal;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform vec3 cCampo, cCampo2, cMonte, cLinea;
        uniform vec2 uOrigen;
        uniform float uDetalle;
        varying vec3 vP, vN;
        #include <fog_pars_fragment>
        float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float rn(vec2 p) {
          vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
        }
        void main() {
          vec3 n = normalize(vN);
          vec2 q = vP.xz - uOrigen;
          // Campos vecinos: mosaico suave y de poco contraste (no compite con las parcelas).
          // Cada zona de ~1.3 km tiene su propio rumbo y tamaño de campo.
          vec2 zona = floor(q / 1.3);
          float ang = (h21(zona) - 0.5) * 1.4;
          mat2 R = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
          vec2 r = R * q + vec2(h21(zona + 2.7), h21(zona + 5.1)) * 0.5;
          vec2 tam = vec2(0.22 + 0.16 * h21(zona + 1.3), 0.15 + 0.1 * h21(zona + 8.8));
          vec2 id = floor(r / tam);
          float h = h21(id + zona * 17.0);
          vec3 c = mix(cCampo, cCampo2, h * 0.9);
          c *= 0.97 + 0.06 * rn(q * 1.7);
          vec2 f = abs(fract(r / tam) - 0.5) * tam;
          vec2 borde = (tam * 0.5 - f) / max(fwidth(r), vec2(1e-5));
          float lindero = 1.0 - clamp(min(borde.x, borde.y) * 0.7, 0.0, 1.0);
          c = mix(c, cLinea, lindero * 0.13 * uDetalle);
          // Laderas: monte
          c = mix(c, cMonte, smoothstep(0.9, 0.72, n.y) * 0.7);
          // Curvas de nivel cada 25 m reales; se apagan si quedan muy juntas
          float nivel = vP.y / (0.025 * ${EXAGERACION.toFixed(2)});
          float fw = fwidth(nivel);
          float curva = 1.0 - clamp(abs(fract(nivel) - 0.5) / max(fw, 1e-5), 0.0, 1.0);
          c = mix(c, cLinea, curva * 0.16 * (1.0 - smoothstep(0.15, 0.4, fw)));
          float luz = 0.62 + 0.45 * max(dot(n, normalize(vec3(-0.45, 0.8, 0.4))), 0.0);
          gl_FragColor = vec4(c * luz, 1.0);
          #include <fog_fragment>
        }`,
    })
  );
  escena.add(terreno);

  // Bordes de la maqueta: tierra en capas
  const geoBordes = (() => {
    const pos = [], nor = [];
    const lado = (pts, nx, nz) => {
      for (let k = 0; k < pts.length - 1; k++) {
        const [xa, za] = pts[k], [xb, zb] = pts[k + 1];
        const ya = alturaEn(xa, za), yb = alturaEn(xb, zb);
        pos.push(xa, ya, za, xa, BASE, za, xb, BASE, zb, xa, ya, za, xb, BASE, zb, xb, yb, zb);
        for (let r = 0; r < 6; r++) nor.push(nx, 0, nz);
      }
    };
    const x1 = T.x0 + T.w, z1 = T.z0 + T.h;
    const filaX = (z) => Array.from({ length: SX + 1 }, (_, i) => [T.x0 + i * celda, z]);
    const filaZ = (x) => Array.from({ length: SZ + 1 }, (_, j) => [x, T.z0 + j * celda]);
    lado(filaX(z1), 0, 1);
    lado(filaX(T.z0).reverse(), 0, -1);
    lado(filaZ(T.x0), -1, 0);
    lado(filaZ(x1).reverse(), 1, 0);
    // fondo
    pos.push(T.x0, BASE, T.z0, x1, BASE, T.z0, x1, BASE, z1, T.x0, BASE, T.z0, x1, BASE, z1, T.x0, BASE, z1);
    for (let r = 0; r < 6; r++) nor.push(0, -1, 0);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    return g;
  })();
  const uniformesBordes = { cTierra: { value: new THREE.Color() }, cOscura: { value: new THREE.Color() }, uBase: { value: BASE } };
  const bordes = new THREE.Mesh(
    geoBordes,
    new THREE.ShaderMaterial({
      uniforms: conNiebla(uniformesBordes),
      fog: true,
      side: THREE.DoubleSide,
      vertexShader: `
        varying vec3 vP, vN;
        #include <fog_pars_vertex>
        void main() {
          vP = position; vN = normal;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform vec3 cTierra, cOscura;
        uniform float uBase;
        varying vec3 vP, vN;
        #include <fog_pars_fragment>
        void main() {
          float prof = vP.y - uBase;
          float capa = sin(prof * 70.0 + sin((vP.x + vP.z) * 9.0) * 0.8);
          vec3 c = mix(cOscura, cTierra, smoothstep(0.0, 0.5, prof));
          c *= 0.93 + 0.07 * capa;
          float luz = 0.7 + 0.3 * max(dot(normalize(vN), normalize(vec3(-0.45, 0.6, 0.6))), 0.0);
          gl_FragColor = vec4(c * luz, 1.0);
          #include <fog_fragment>
        }`,
    })
  );
  escena.add(bordes);

  // Sombra suave bajo la maqueta
  const sombra = (() => {
    const lienzoSombra = document.createElement("canvas");
    lienzoSombra.width = lienzoSombra.height = 128;
    const g = lienzoSombra.getContext("2d");
    const grad = g.createRadialGradient(64, 64, 20, 64, 64, 64);
    grad.addColorStop(0, "rgba(0,0,0,0.55)");
    grad.addColorStop(0.6, "rgba(0,0,0,0.25)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(T.w * 1.45, T.h * 1.45).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(lienzoSombra), transparent: true, depthWrite: false, opacity: 0.35, fog: false })
    );
    m.position.set(T.x0 + T.w / 2 + 0.25, BASE - 0.25, T.z0 + T.h / 2 + 0.3);
    return m;
  })();
  escena.add(sombra);

  /* --- Parcelas (losetas sobre su terraza) -------------------------------- */

  const azar = Util.crearRng(20261017);
  const posiciones = [], normales = [], aId = [], aTipo = [], aAng = [], aRnd = [];
  const verticesPorParcela = [];
  const ESPESOR = 0.22; // la loseta baja hasta tapar el terreno de su terraza

  parcelas.forEach((p, i) => {
    const forma = new THREE.Shape(p.poly[0].map(([x, z]) => new THREE.Vector2(x, -z)));
    const geo = new THREE.ExtrudeGeometry(forma, { depth: ESPESOR, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, p.h + ALTO_LOSETA - ESPESOR, 0);
    const pos = geo.attributes.position.array;
    for (let k = 0; k < pos.length; k += 3) pos[k + 1] += p.pb * (pos[k] - p.x) + p.pc * (pos[k + 2] - p.y);
    const nor = geo.attributes.normal.array;
    const angulo = azar() * Math.PI;
    const rnd = azar();
    const inicio = posiciones.length / 3;
    for (let k = 0; k < pos.length; k++) { posiciones.push(pos[k]); normales.push(nor[k]); }
    const n = pos.length / 3;
    for (let k = 0; k < n; k++) { aId.push(i); aTipo.push(p.pred ? 1 : 0); aAng.push(angulo); aRnd.push(rnd); }
    verticesPorParcela.push([inicio, n]);
    p.angulo = angulo;
    p.tope = p.h + ALTO_LOSETA;
    geo.dispose();
  });

  const geoLosetas = new THREE.BufferGeometry();
  geoLosetas.setAttribute("position", new THREE.Float32BufferAttribute(posiciones, 3));
  geoLosetas.setAttribute("normal", new THREE.Float32BufferAttribute(normales, 3));
  geoLosetas.setAttribute("aId", new THREE.Float32BufferAttribute(aId, 1));
  geoLosetas.setAttribute("aTipo", new THREE.Float32BufferAttribute(aTipo, 1));
  geoLosetas.setAttribute("aAng", new THREE.Float32BufferAttribute(aAng, 1));
  geoLosetas.setAttribute("aRnd", new THREE.Float32BufferAttribute(aRnd, 1));
  const totalVertices = posiciones.length / 3;
  const colLosetas = new Float32Array(totalVertices * 3);
  const atenLosetas = new Float32Array(totalVertices);
  geoLosetas.setAttribute("aColor", new THREE.BufferAttribute(colLosetas, 3));
  geoLosetas.setAttribute("aAten", new THREE.BufferAttribute(atenLosetas, 1));

  const uniformesLosetas = {
    uT: { value: 0 }, uSel: { value: -1 }, uHover: { value: -1 },
    uAcento: { value: new THREE.Color() }, uDetalle: { value: 1 }, uPulso: { value: 0 }, uEntrada: { value: 1 },
  };
  const losetas = new THREE.Mesh(
    geoLosetas,
    new THREE.ShaderMaterial({
      uniforms: conNiebla(uniformesLosetas),
      fog: true,
      transparent: true,
      vertexShader: `
        attribute float aId, aTipo, aAng, aRnd, aAten;
        attribute vec3 aColor;
        uniform float uEntrada;
        varying vec3 vColor, vP, vN;
        varying float vId, vTipo, vAng, vAten;
        #include <fog_pars_vertex>
        void main() {
          vColor = aColor; vId = aId; vTipo = aTipo; vAng = aAng; vAten = aAten;
          vP = position; vN = normal;
          vec3 p = position;
          float k = clamp(uEntrada * 1.6 - aRnd * 0.6, 0.0, 1.0);
          p.y += (1.0 - k) * (1.0 - k) * 5.0;
          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform float uT, uSel, uHover, uDetalle, uPulso;
        uniform vec3 uAcento;
        varying vec3 vColor, vP, vN;
        varying float vId, vTipo, vAng, vAten;
        #include <fog_pars_fragment>
        void main() {
          vec3 c = vColor;
          vec3 n = normalize(vN);
          float arriba = step(0.5, n.y);
          float v = -vP.x * sin(vAng) + vP.z * cos(vAng);
          float surco = 0.5 + 0.5 * cos(6.2831853 * v / 0.014);
          c *= mix(1.0, 0.84 + 0.16 * surco, uDetalle * arriba);
          float raya = step(fract((vP.x + vP.z) / 0.045), 0.16);
          c *= 1.0 - vTipo * raya * 0.22 * arriba;
          float luz = 0.6 + 0.45 * max(dot(n, normalize(vec3(-0.45, 0.8, 0.4))), 0.0);
          c *= mix(luz * 0.85, 1.0, arriba);
          float sel = step(abs(vId - uSel), 0.5);
          float hov = step(abs(vId - uHover), 0.5);
          c *= 1.0 + 0.12 * hov + 0.08 * sel;
          c = mix(c, uAcento, sel * (1.0 - arriba) * 0.9);
          c = mix(c, uAcento, vTipo * uPulso * (0.5 + 0.5 * sin(uT * 4.0)) * 0.45 * arriba);
          c = mix(c, vec3(dot(c, vec3(0.33))), vAten * 0.7);
          gl_FragColor = vec4(c, 1.0 - vAten * 0.5);
          #include <fog_fragment>
        }`,
    })
  );
  escena.add(losetas);

  /* --- Tallos de cebada (sombreado del esqueleto) ------------------------- */

  const DENSIDAD = 2000; // tallos por km²
  const lista = [];
  const rangosTallos = [];
  parcelas.forEach((p, i) => {
    const anillo = p.poly[0];
    const xs = anillo.map((q) => q[0]), zs = anillo.map((q) => q[1]);
    const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
    const objetivo = Math.max(14, Math.round((p.ha / 100) * DENSIDAD));
    const inicio = lista.length;
    const s = Math.sin(p.angulo), c = Math.cos(p.angulo);
    let intentos = 0;
    while (lista.length - inicio < objetivo && intentos < objetivo * 30) {
      intentos++;
      let x = x0 + azar() * (x1 - x0), z = z0 + azar() * (z1 - z0);
      const v = Math.round((-x * s + z * c) / 0.014) * 0.014;
      const u = x * c + z * s;
      x = u * c - v * s + (azar() - 0.5) * 0.003;
      z = u * s + v * c + (azar() - 0.5) * 0.003;
      if (!dentro(x, z, anillo)) continue;
      lista.push([x, topeEn(p, x, z), z, i, p.pred ? 1 : 0, azar()]);
    }
    rangosTallos.push([inicio, lista.length]);
  });

  const nT = lista.length;
  const geoTallo = new THREE.CylinderBufferGeometry(0.0014, 0.003, 1, 4, 5);
  geoTallo.translate(0, 0.5, 0);
  const geoTallos = new THREE.InstancedBufferGeometry();
  geoTallos.index = geoTallo.index;
  geoTallos.setAttribute("position", geoTallo.attributes.position);
  geoTallos.instanceCount = nT;
  const tOff = new Float32Array(nT * 3), tPar = new Float32Array(nT), tTy = new Float32Array(nT);
  const tR = new Float32Array(nT), tH = new Float32Array(nT), tA = new Float32Array(nT);
  lista.forEach(([x, y, z, i, ty, r], k) => { tOff.set([x, y, z], k * 3); tPar[k] = i; tTy[k] = ty; tR[k] = r; });
  geoTallos.setAttribute("aOff", new THREE.InstancedBufferAttribute(tOff, 3));
  geoTallos.setAttribute("aPar", new THREE.InstancedBufferAttribute(tPar, 1));
  geoTallos.setAttribute("aTy", new THREE.InstancedBufferAttribute(tTy, 1));
  geoTallos.setAttribute("aR", new THREE.InstancedBufferAttribute(tR, 1));
  const atribAlto = new THREE.InstancedBufferAttribute(tH, 1); atribAlto.setUsage(THREE.DynamicDrawUsage);
  const atribAten = new THREE.InstancedBufferAttribute(tA, 1); atribAten.setUsage(THREE.DynamicDrawUsage);
  geoTallos.setAttribute("aH", atribAlto);
  geoTallos.setAttribute("aA", atribAten);

  const uniformesTallos = {
    uT: { value: 0 }, uSel: { value: -1 }, uEscala: { value: 0 }, uFraccion: { value: 1 },
    cA: { value: new THREE.Color() }, cB: { value: new THREE.Color() },
  };
  const tallos = new THREE.Mesh(
    geoTallos,
    new THREE.ShaderMaterial({
      uniforms: conNiebla(uniformesTallos),
      fog: true,
      side: THREE.DoubleSide,
      vertexShader: `
        attribute vec3 aOff;
        attribute float aPar, aR, aTy, aH, aA;
        uniform float uT, uSel, uEscala, uFraccion;
        varying float vT, vSel, vTy, vA;
        #include <fog_pars_vertex>
        void main() {
          if (aR > uFraccion) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
          float alto = aH * (0.8 + 0.4 * aR) * uEscala;
          float t = position.y;
          vec3 p = position;
          p.xz *= 1.0 + 2.6 * smoothstep(0.8, 0.86, t) * (1.0 - smoothstep(0.97, 1.0, t));
          p.xz *= max(0.35, uEscala / 0.04);
          p.y *= alto;
          float viento = sin(uT * 1.6 + aOff.x * 700.0 + aOff.z * 500.0 + aR * 6.0) * 0.1
                       + sin(uT * 0.7 + aOff.z * 300.0) * 0.06;
          float doblez = viento * t * t * alto;
          p.x += doblez;
          p.z += doblez * 0.4 * sin(aR * 9.0);
          p += aOff;
          vT = t; vTy = aTy; vA = aA;
          vSel = abs(aPar - uSel) < 0.5 ? 1.0 : 0.0;
          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `
        uniform vec3 cA, cB;
        varying float vT, vSel, vTy, vA;
        #include <fog_pars_fragment>
        void main() {
          vec3 color = mix(cA, cB, vTy);
          color = mix(color * 0.7, color * 1.15, vT);
          color = mix(color, vec3(0.95, 0.82, 0.45), smoothstep(0.8, 0.9, vT) * 0.5);
          color += vSel * 0.16;
          color = mix(color, vec3(dot(color, vec3(0.33))), vA * 0.7);
          gl_FragColor = vec4(color, 1.0);
          #include <fog_fragment>
        }`,
    })
  );
  tallos.frustumCulled = false;
  escena.add(tallos);

  /* --- Capas de explicación ---------------------------------------------- */

  const grupoAnillos = new THREE.Group();
  const grupoArcos = new THREE.Group();
  const grupoMarca = new THREE.Group();
  escena.add(grupoAnillos, grupoArcos, grupoMarca);

  /* --- Estado y colores --------------------------------------------------- */

  let modo = "categoria";
  const valorPintado = new Map();
  let seleccion = -1;
  let hover = -1;
  let municipioMarcado = null;
  const etiquetas = [];
  let etiquetasMunicipio = false;
  const alturasObjetivo = new Float32Array(N);
  const alturasActuales = new Float32Array(N);

  function colorParcela(p) {
    if (modo === "municipio") return color(colorRendimiento(municipios.get(p.mun).media));
    if (modo === "rendimiento") {
      const v = p.pred ? valorPintado.get(p.id) : p.y_obs;
      if (v != null) return color(colorRendimiento(v));
    }
    return color(p.pred ? C().parcelaOro : C().parcelaVerde);
  }

  function alturaTallo(p) {
    let v = null;
    if (modo === "municipio") v = municipios.get(p.mun).media;
    else if (modo === "rendimiento") v = p.pred ? valorPintado.get(p.id) : p.y_obs;
    if (v == null) return p.pred ? 0.55 : 0.8;
    return 0.25 + 0.75 * Util.clamp((v - 1.8) / 3.8, 0, 1);
  }

  function pintar() {
    parcelas.forEach((p, i) => {
      const cl = colorParcela(p);
      const [inicio, n] = verticesPorParcela[i];
      const aten = municipioMarcado && (p.mun !== municipioMarcado || p.pred) && i !== seleccion ? 1 : 0;
      for (let k = inicio; k < inicio + n; k++) {
        colLosetas[k * 3] = cl.r; colLosetas[k * 3 + 1] = cl.g; colLosetas[k * 3 + 2] = cl.b;
        atenLosetas[k] = aten;
      }
      alturasObjetivo[i] = alturaTallo(p);
      const [t0, t1] = rangosTallos[i];
      tA.fill(aten, t0, t1);
    });
    geoLosetas.attributes.aColor.needsUpdate = true;
    geoLosetas.attributes.aAten.needsUpdate = true;
    atribAten.needsUpdate = true;
    contenedor.dataset.modo = modo;
  }

  function aplicarPaleta() {
    const pal = C();
    // La maqueta flota sobre el color de la página
    const cielo = color(pal.sky);
    renderizador.setClearColor(cielo);
    niebla.color.copy(cielo);
    const campo = color(pal.fondoCampo), suelo = color(pal.suelo), verde = color(pal.green);
    const oscuro = Paleta.tema === "oscuro" || cielo.getHSL({}).l < 0.4;
    uniformesTerreno.cCampo.value.copy(campo).lerp(suelo, oscuro ? 0.3 : 0.4);
    uniformesTerreno.cCampo2.value.copy(campo).lerp(suelo, oscuro ? 0.22 : 0.3).lerp(verde, 0.14);
    uniformesTerreno.cMonte.value.copy(verde).lerp(suelo, 0.5).multiplyScalar(oscuro ? 0.75 : 0.85);
    uniformesTerreno.cLinea.value.copy(suelo).multiplyScalar(oscuro ? 1.25 : 0.7);
    uniformesBordes.cTierra.value.copy(suelo).lerp(campo, 0.15);
    uniformesBordes.cOscura.value.copy(suelo).multiplyScalar(0.55);
    uniformesLosetas.uAcento.value.set(pal.rosa);
    uniformesTallos.cA.value.set(pal.talloVerde);
    uniformesTallos.cB.value.set(pal.talloOro);
    pintar();
  }

  /* --- Cámara con guion --------------------------------------------------- */

  // obj: {tx, tz, d, yaw (rad), pitch (rad), off (fracción del ancho, + = sujeto a la derecha)}
  const objetivo = { tx: centro.x, tz: centro.z, d: 30, yaw: -0.4, pitch: 0.5, off: 0 };
  const actual = { ...objetivo };
  let suavidad = 3.2;
  const puntero = { x: 0, y: 0 };

  const tanMedio = () => Math.tan(((camara.fov * Math.PI) / 180) / 2);

  /** Distancia para que un ancho (km) quepa en una fracción del ancho de pantalla. */
  function distanciaPara(anchoKm, altoKm, fraccion = 1) {
    const aspecto = camara.aspect || 1;
    const porAncho = anchoKm / fraccion / (2 * tanMedio() * aspecto);
    const porAlto = altoKm / (2 * tanMedio());
    return Math.max(porAncho, porAlto) * 1.05;
  }

  // Borde de la maqueta (arriba y abajo) para encuadrarla completa
  const contorno = (() => {
    const pts = [];
    const x1 = T.x0 + T.w, z1 = T.z0 + T.h;
    for (let k = 0; k <= 12; k++) {
      const fx = T.x0 + (T.w * k) / 12, fz = T.z0 + (T.h * k) / 12;
      [[fx, T.z0], [fx, z1], [T.x0, fz], [x1, fz]].forEach(([x, z]) => pts.push(new THREE.Vector3(x, alturaEn(x, z), z)));
    }
    [[T.x0, T.z0], [x1, T.z0], [T.x0, z1], [x1, z1]].forEach(([x, z]) => pts.push(new THREE.Vector3(x, BASE, z)));
    return pts;
  })();
  const camPrueba = new THREE.PerspectiveCamera(36, 1, 0.01, 1000);
  const vecPrueba = new THREE.Vector3();

  /** Toda la maqueta dentro de la zona libre de la pantalla (deja sitio arriba para la barra). */
  function encuadreGeneral({ yaw = 0, pitch = 0.95, off = 0, fraccion = 1, factor = 1 } = {}) {
    const obj = { tx: T.x0 + T.w / 2, tz: T.z0 + T.h / 2, d: 10, yaw, pitch, off };
    // zona libre en coordenadas de pantalla (-1..1): centrada en 2·off, de ancho 2·fraccion
    const xMin = 2 * off - fraccion + 0.05, xMax = 2 * off + fraccion - 0.05, yMin = -0.72, yMax = 0.74;
    camPrueba.fov = camara.fov;
    camPrueba.aspect = camara.aspect || 1;
    const cabe = (d) => {
      situarCamara(camPrueba, { ...obj, d }, 0, 0);
      camPrueba.updateMatrixWorld();
      return contorno.every((pt) => {
        vecPrueba.copy(pt).project(camPrueba);
        return vecPrueba.z < 1 && vecPrueba.x > xMin && vecPrueba.x < xMax && vecPrueba.y > yMin && vecPrueba.y < yMax;
      });
    };
    let lo = 0.5, hi = 400;
    for (let it = 0; it < 26; it++) {
      const medio = Math.sqrt(lo * hi);
      if (cabe(medio)) hi = medio; else lo = medio;
    }
    obj.d = hi * factor;
    return obj;
  }

  function encuadreParcela(pOid, radioKm = 1.3, { yaw = 0.35, pitch = 0.85, off = 0, fraccion = 1 } = {}) {
    const p = deId(pOid);
    return { tx: p.x, tz: p.y, d: distanciaPara(2 * radioKm, 2 * radioKm * 0.9, fraccion), yaw, pitch, off };
  }

  function camaraHacia(obj, { inmediato = false, rapidez = 3.2 } = {}) {
    Object.assign(objetivo, obj);
    suavidad = rapidez;
    if (inmediato || Paleta.movimientoReducido()) Object.assign(actual, objetivo);
  }

  const vecTmp = new THREE.Vector3();
  /** Coloca una cámara según un encuadre {tx, tz, d, yaw, pitch, off}. */
  function situarCamara(cam, e, dyaw, dy) {
    const d = e.d;
    const ty = alturaEn(e.tx, e.tz);
    const yaw = e.yaw + dyaw;
    cam.position.set(
      e.tx + d * Math.sin(yaw) * Math.cos(e.pitch),
      ty + d * Math.sin(e.pitch) + dy * d,
      e.tz + d * Math.cos(yaw) * Math.cos(e.pitch)
    );
    vecTmp.set(e.tx, ty, e.tz);
    cam.lookAt(vecTmp);
    // Desplazamiento lateral como corrimiento de lente: el sujeto queda a la derecha (off > 0)
    // sin girar la cámara, para que el mapa no se vea torcido.
    cam.setViewOffset(cam.aspect, 1, -e.off * cam.aspect, 0, cam.aspect, 1);
    cam.near = Math.max(0.005, d * 0.01);
    cam.far = d * 10;
    cam.updateProjectionMatrix();
    return 2 * d * Math.tan(((cam.fov * Math.PI) / 180) / 2) * cam.aspect;
  }

  function colocarCamara(dt) {
    const k = 1 - Math.exp(-dt * suavidad);
    actual.tx += (objetivo.tx - actual.tx) * k;
    actual.tz += (objetivo.tz - actual.tz) * k;
    actual.d *= Math.pow(objetivo.d / actual.d, k);
    actual.yaw += (objetivo.yaw - actual.yaw) * k;
    actual.pitch += (objetivo.pitch - actual.pitch) * k;
    actual.off += (objetivo.off - actual.off) * k;

    const d = actual.d;
    const anchoVista = situarCamara(camara, actual, puntero.x * 0.04, puntero.y * 0.015);
    niebla.near = d * 1.4;
    niebla.far = d * 4;

    uniformesLosetas.uDetalle.value = Util.clamp((10 - anchoVista) / 4, 0, 1);
    uniformesTerreno.uDetalle.value = Util.clamp((14 - anchoVista) / 6, 0, 1);
    uniformesTallos.uEscala.value = 0.04 * Util.clamp((8 - anchoVista) / 3.5, 0, 1);
    tallos.visible = uniformesTallos.uEscala.value > 0.0005;
    return (
      Math.abs(objetivo.d / actual.d - 1) > 0.002 || Math.abs(objetivo.tx - actual.tx) > 0.002 ||
      Math.abs(objetivo.tz - actual.tz) > 0.002 || Math.abs(objetivo.yaw - actual.yaw) > 0.001 ||
      Math.abs(objetivo.pitch - actual.pitch) > 0.001 || Math.abs(objetivo.off - actual.off) > 0.001
    );
  }

  // Compatibilidad con la interfaz del mapa plano
  let desplazamientoPorDefecto = 0;
  let fraccionPorDefecto = 1;
  const enfoqueDefecto = { yaw: 0.35, pitch: 0.85 };
  const enfocarEn = (pOid, radioKm = 1.4) =>
    camaraHacia(encuadreParcela(pOid, radioKm, { ...enfoqueDefecto, off: desplazamientoPorDefecto, fraccion: fraccionPorDefecto }));
  const verTodo = () =>
    camaraHacia(encuadreGeneral({ off: desplazamientoPorDefecto, fraccion: fraccionPorDefecto }));
  const enfocar = (rect) =>
    camaraHacia({ tx: rect.x + rect.w / 2, tz: rect.y + rect.h / 2, d: distanciaPara(rect.w, rect.h, fraccionPorDefecto), yaw: 0, pitch: 0.9, off: desplazamientoPorDefecto });
  function fijarEncuadre({ off = 0, fraccion = 1, yaw, pitch } = {}) {
    desplazamientoPorDefecto = off;
    fraccionPorDefecto = fraccion;
    if (yaw != null) enfoqueDefecto.yaw = yaw;
    if (pitch != null) enfoqueDefecto.pitch = pitch;
  }

  /* --- Marcas ------------------------------------------------------------- */

  function limpiarGrupo(g) {
    while (g.children.length) {
      const h = g.children.pop();
      h.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    }
  }
  function quitarEtiquetas(grupo) {
    for (let i = etiquetas.length - 1; i >= 0; i--) {
      if (etiquetas[i].grupo === grupo) { etiquetas[i].el.remove(); etiquetas.splice(i, 1); }
    }
  }
  function etiqueta(html, pos, grupo, clase = "", prioridad = 0) {
    const el = document.createElement("span");
    el.className = `c2-etq3d ${clase}`;
    el.innerHTML = html;
    capaEtiquetas.appendChild(el);
    etiquetas.push({ pos, el, grupo, prioridad, ancho: 0, alto: 0 });
    etiquetas.sort((a, b) => b.prioridad - a.prioridad);
  }

  function resaltar(pOid) {
    seleccion = pOid ? indice.get(typeof pOid === "string" ? pOid : pOid.id) : -1;
    uniformesLosetas.uSel.value = seleccion;
    uniformesTallos.uSel.value = seleccion;
    limpiarGrupo(grupoMarca);
    if (seleccion >= 0) {
      const p = parcelas[seleccion];
      grupoMarca.add(new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(p.poly[0].map(([x, z]) => new THREE.Vector3(x, topeEn(p, x, z) + 0.003, z))),
        new THREE.LineBasicMaterial({ color: C().rosa })
      ));
      const aguja = new THREE.Mesh(new THREE.CylinderBufferGeometry(0.004, 0.004, 1, 6).translate(0, 0.5, 0), new THREE.MeshBasicMaterial({ color: C().rosa }));
      const cabeza = new THREE.Mesh(new THREE.SphereBufferGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: C().rosa }));
      aguja.position.set(p.x, p.tope, p.y);
      cabeza.position.set(p.x, p.tope, p.y);
      aguja.userData.pin = true;
      cabeza.userData.cabeza = p.tope;
      grupoMarca.add(aguja, cabeza);
    }
    pintar();
  }

  function anillos(pOid, radiosKm = []) {
    limpiarGrupo(grupoAnillos);
    quitarEtiquetas("anillos");
    const p = deId(pOid);
    radiosKm.forEach((r, i) => {
      const pts = [];
      for (let k = 0; k <= 128; k++) {
        const a = (k / 128) * Math.PI * 2;
        const x = p.x + Math.cos(a) * r, z = p.y + Math.sin(a) * r;
        pts.push(new THREE.Vector3(x, alturaEn(x, z) + 0.02, z));
      }
      const linea = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineDashedMaterial({ color: C().ink, dashSize: r * 0.06, gapSize: r * 0.05, transparent: true, opacity: 0.7 })
      );
      linea.computeLineDistances();
      linea.userData.crece = { inicio: performance.now() + i * 250 };
      linea.material.opacity = 0;
      grupoAnillos.add(linea);
      const x = p.x, z = p.y - r;
      etiqueta(r < 1 ? `${Math.round(r * 1000)} m` : `${r} km`, new THREE.Vector3(x, alturaEn(x, z) + 0.03, z), "anillos", "anillo");
    });
  }

  /**
   * Arcos de cada vecina a la parcela. Normal: verde si sube la predicción, rosa si la baja.
   * neutro: todos del color de la tinta (solo muestra quiénes son). Las etiquetas dicen la
   * distancia real (el mapa es esquemático), en las vecinas que más se parecen.
   */
  function mostrarVecinas(pOid, vecinas, { neutro = false, etiquetas = 5 } = {}) {
    limpiarGrupo(grupoArcos);
    quitarEtiquetas("vecinas");
    const p = deId(pOid);
    const tope = Math.max(0.05, ...vecinas.map((v) => Math.abs(v.aporte)));
    const conEtiqueta = new Set([...vecinas].sort((a, b) => b.parecido - a.parecido).slice(0, etiquetas).map((v) => v.id));
    vecinas.forEach((v, i) => {
      const q = deId(v.id);
      if (!q) return;
      const a = new THREE.Vector3(q.x, q.tope, q.y);
      const b = new THREE.Vector3(p.x, p.tope, p.y);
      const medio = a.clone().add(b).multiplyScalar(0.5);
      medio.y += a.distanceTo(b) * 0.38 + 0.03;
      const curva = new THREE.QuadraticBezierCurve3(a, medio, b);
      const geo = new THREE.TubeGeometry(curva, 40, 0.003 + 0.009 * Math.sqrt(v.parecido), 6, false);
      const tubo = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: neutro ? C().ink : v.aporte >= 0 ? C().green : C().rosa, transparent: true,
        opacity: neutro ? 0.35 + 0.6 * Math.sqrt(v.parecido) : 0.4 + 0.6 * Math.min(1, Math.abs(v.aporte) / tope),
      }));
      if (conEtiqueta.has(v.id)) {
        const cima = curva.getPoint(0.5);
        etiqueta(`${Math.round(v.d_km * 1000)} m`, cima, "vecinas", "distancia", 100 + v.parecido);
      }
      if (!Paleta.movimientoReducido()) {
        geo.setDrawRange(0, 0);
        tubo.userData.dibujo = { inicio: performance.now() + i * 70, total: geo.index.count };
      }
      grupoArcos.add(tubo);
    });
  }

  function limpiarVecinas() {
    limpiarGrupo(grupoArcos);
    limpiarGrupo(grupoAnillos);
    quitarEtiquetas("anillos");
    quitarEtiquetas("vecinas");
    municipioMarcado = null;
    pintar();
  }

  function marcarMunicipio(nombre) {
    municipioMarcado = nombre || null;
    pintar();
  }

  // Etiqueta de municipio: sobre su grupo de parcelas más grande
  const sitioMunicipio = new Map();
  municipiosLista.forEach((m) => {
    const porGrupo = new Map();
    parcelas.filter((p) => p.mun === m.nombre).forEach((p) => {
      if (!porGrupo.has(p.grupo)) porGrupo.set(p.grupo, []);
      porGrupo.get(p.grupo).push(p);
    });
    const mayor = [...porGrupo.values()].sort((a, b) => b.length - a.length)[0];
    if (!mayor) return;
    const x = mayor.reduce((s, p) => s + p.x, 0) / mayor.length;
    const z = mayor.reduce((s, p) => s + p.y, 0) / mayor.length;
    sitioMunicipio.set(m.nombre, new THREE.Vector3(x, alturaEn(x, z) + 0.25, z));
  });

  function mostrarEtiquetas(si) {
    if (si === etiquetasMunicipio) return;
    etiquetasMunicipio = si;
    quitarEtiquetas("municipios");
    if (!si) return;
    municipiosLista.filter((m) => m.n_entren >= 3).forEach((m) => {
      etiqueta(`${m.nombre}<b>${Util.fmt(m.media, 1)} t/ha</b>`, sitioMunicipio.get(m.nombre), "municipios", "municipio", m.n_entren);
    });
  }

  function cambiarModo(nuevo) { modo = nuevo; pintar(); }
  function fijarPredicciones(lista_) { lista_.forEach(({ parcela, media }) => valorPintado.set(parcela.id, media)); }

  function revelarPredicciones(lista_, duracion = 1800) {
    modo = "rendimiento";
    if (Paleta.movimientoReducido() || duracion === 0) { fijarPredicciones(lista_); pintar(); return Promise.resolve(); }
    const orden = [...lista_].sort((a, b) => deId(a.parcela).x - deId(b.parcela).x);
    return new Promise((resolver) => {
      orden.forEach(({ parcela, media }, i) => {
        setTimeout(() => {
          valorPintado.set(parcela.id, media);
          pintar();
          if (i === orden.length - 1) resolver();
        }, (duracion * i) / orden.length);
      });
    });
  }

  let latidoActivo = false;
  const latido = (si) => (latidoActivo = si);

  let entradaInicio = 0, entradaDuracion = 0;
  function entrada(duracion = 1800) {
    if (Paleta.movimientoReducido()) return;
    entradaInicio = performance.now();
    entradaDuracion = duracion;
    uniformesLosetas.uEntrada.value = 0;
  }

  /* --- Puntero ------------------------------------------------------------ */

  const rayo = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function parcelaBajo(e) {
    const caja = lienzo.getBoundingClientRect();
    ndc.set(((e.clientX - caja.left) / caja.width) * 2 - 1, -((e.clientY - caja.top) / caja.height) * 2 + 1);
    rayo.setFromCamera(ndc, camara);
    const impacto = rayo.intersectObject(losetas)[0];
    return impacto ? geoLosetas.attributes.aId.array[impacto.face.a] : -1;
  }
  let interactivo = Boolean(opciones.alSeleccionar);
  lienzo.addEventListener("pointermove", (e) => {
    const caja = lienzo.getBoundingClientRect();
    puntero.x = ((e.clientX - caja.left) / caja.width) * 2 - 1;
    puntero.y = -(((e.clientY - caja.top) / caja.height) * 2 - 1);
    if (!interactivo) return;
    const id = parcelaBajo(e);
    if (id !== hover) {
      hover = id;
      uniformesLosetas.uHover.value = hover;
      lienzo.style.cursor = hover >= 0 ? "pointer" : "";
    }
    if (hover >= 0 && typeof Graficas !== "undefined") {
      const p = parcelas[hover];
      const extra = p.pred
        ? valorPintado.has(p.id) ? `predicción ${Util.fmt(valorPintado.get(p.id), 2)} t/ha` : "por predecir"
        : `${Util.fmt(p.y_obs, 2)} t/ha`;
      Graficas.mostrarTip(e, `<b>${p.id}</b> · ${p.mun}<br>${extra}`);
    } else if (typeof Graficas !== "undefined") Graficas.ocultarTip();
  });
  lienzo.addEventListener("pointerleave", () => {
    hover = -1; uniformesLosetas.uHover.value = -1; puntero.x = puntero.y = 0;
    if (typeof Graficas !== "undefined") Graficas.ocultarTip();
  });
  let toque = false;
  lienzo.addEventListener("pointerdown", (e) => (toque = e.pointerType !== "mouse"));
  lienzo.addEventListener("click", (e) => {
    if (!interactivo) return;
    const id = parcelaBajo(e);
    if (id >= 0 && opciones.alSeleccionar) opciones.alSeleccionar(parcelas[id].id);
    // En pantallas táctiles no hay "salir con el puntero": la etiqueta se va sola
    if (toque && typeof Graficas !== "undefined") setTimeout(() => Graficas.ocultarTip(), 1400);
  });

  /* --- Bucle -------------------------------------------------------------- */

  let visible = true;
  let tPrevio = performance.now();
  new IntersectionObserver((e) => (visible = e[0].isIntersecting)).observe(contenedor);

  function ajustar() {
    const w = contenedor.clientWidth || 1, h = contenedor.clientHeight || 1;
    renderizador.setSize(w, h, false);
    camara.aspect = w / h;
    camara.updateProjectionMatrix();
  }
  new ResizeObserver(ajustar).observe(contenedor);

  let promedioDt = 1 / 60, cuadrosMedidos = 0, nivelCalidad = 0;
  function vigilarRendimiento(dt) {
    promedioDt += (dt - promedioDt) * 0.05;
    if (++cuadrosMedidos < 90 || promedioDt < 0.04 || nivelCalidad >= 2) return;
    nivelCalidad++;
    cuadrosMedidos = 0;
    renderizador.setPixelRatio(1);
    uniformesTallos.uFraccion.value = nivelCalidad === 1 ? 0.5 : 0.25;
    ajustar();
  }

  const proy = new THREE.Vector3();
  function cuadro(ahora) {
    requestAnimationFrame(cuadro);
    const dt = Math.min(0.3, (ahora - tPrevio) / 1000);
    tPrevio = ahora;
    if (!visible || document.hidden) return;
    const t = ahora / 1000;
    colocarCamara(dt);
    uniformesLosetas.uT.value = t;
    uniformesTallos.uT.value = t;
    uniformesLosetas.uPulso.value += ((latidoActivo ? 1 : 0) - uniformesLosetas.uPulso.value) * Math.min(1, dt * 4);

    if (entradaDuracion) {
      const k = Util.clamp((ahora - entradaInicio) / entradaDuracion, 0, 1);
      uniformesLosetas.uEntrada.value = k;
      if (k >= 1) entradaDuracion = 0;
    }

    let creciendo = false;
    for (let i = 0; i < N; i++) {
      const dif = alturasObjetivo[i] - alturasActuales[i];
      if (Math.abs(dif) > 0.002) {
        alturasActuales[i] += dif * Math.min(1, dt * 3.5);
        const [t0, t1] = rangosTallos[i];
        tH.fill(alturasActuales[i], t0, t1);
        creciendo = true;
      }
    }
    if (creciendo) atribAlto.needsUpdate = true;

    grupoAnillos.children.forEach((l) => {
      const k = Util.clamp((ahora - l.userData.crece.inicio) / 600, 0, 1);
      l.material.opacity = 0.7 * k;
    });
    grupoArcos.children.forEach((tubo) => {
      const d = tubo.userData.dibujo;
      if (!d) return;
      const k = Util.clamp((ahora - d.inicio) / 700, 0, 1);
      tubo.geometry.setDrawRange(0, Math.floor((d.total * k) / 3) * 3);
    });
    grupoMarca.children.forEach((o) => {
      if (o.userData.pin) o.scale.set(actual.d * 0.1, actual.d * 0.055, actual.d * 0.1);
      if (o.userData.cabeza != null) {
        o.scale.setScalar(actual.d * 0.0065 * (1 + 0.15 * Math.sin(t * 4)));
        o.position.y = o.userData.cabeza + actual.d * 0.055;
      }
    });

    const w = contenedor.clientWidth, h = contenedor.clientHeight;
    const puestas = [];
    etiquetas.forEach((e) => {
      proy.copy(e.pos).project(camara);
      const x = ((proy.x + 1) / 2) * w, y = ((1 - proy.y) / 2) * h;
      if (!e.ancho) { e.ancho = e.el.offsetWidth; e.alto = e.el.offsetHeight; }
      const caja = { x0: x - e.ancho / 2 - 4, x1: x + e.ancho / 2 + 4, y0: y - e.alto - 2, y1: y + 2 };
      const fuera = proy.z > 1 || Math.abs(proy.x) > 1.05 || Math.abs(proy.y) > 1.05;
      const choca = puestas.some((c) => c.x0 < caja.x1 && caja.x0 < c.x1 && c.y0 < caja.y1 && caja.y0 < c.y1);
      if (!fuera && !choca) puestas.push(caja);
      e.el.style.opacity = fuera || choca ? "0" : "";
      e.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
    });

    renderizador.render(escena, camara);
    vigilarRendimiento(dt);
  }

  window.addEventListener("paleta", aplicarPaleta);
  ajustar();
  aplicarPaleta();
  camaraHacia(encuadreGeneral({ factor: 2.4, pitch: 0.45, yaw: -0.5 }), { inmediato: true });
  requestAnimationFrame(cuadro);

  return {
    elemento: contenedor,
    tipo: "3d",
    total,
    // guion de cámara
    camaraHacia, encuadreGeneral, encuadreParcela, fijarEncuadre,
    // interfaz común con el mapa plano
    enfocar, enfocarEn, verTodo,
    resaltar, anillos, mostrarVecinas, limpiarVecinas, marcarMunicipio,
    revelarPredicciones, fijarPredicciones, cambiarModo,
    entrada, latido, mostrarEtiquetas,
    interactivo: (si) => (interactivo = si),
    get modo() { return modo; },
    get _camara() { return { objetivo: { ...objetivo }, actual: { ...actual } }; },
    _pantalla(id) {
      const p = deId(id);
      proy.set(p.x, topeEn(p, p.x, p.y), p.y).project(camara);
      const caja = lienzo.getBoundingClientRect();
      return { x: caja.left + ((proy.x + 1) / 2) * caja.width, y: caja.top + ((1 - proy.y) / 2) * caja.height };
    },
  };
}

/** Escena 3D si hay WebGL; si no, el mapa SVG plano con las mismas posiciones compactas. */
function crearVistaParcelas(contenedor, datos, opciones = {}) {
  const hayWebGL = (() => {
    try {
      const c = document.createElement("canvas");
      return Boolean(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl")));
    } catch (error) {
      return false;
    }
  })();
  if (typeof THREE !== "undefined" && hayWebGL) {
    try {
      return crearEscena3D(contenedor, datos, opciones);
    } catch (error) {
      console.warn("Escena 3D no disponible; se usa el mapa plano.", error);
      contenedor.innerHTML = "";
    }
  }
  const compacto = {
    ...datos,
    parcelas: datos.parcelas.map((p) => ({
      ...p, x: p.x + (p.dx || 0), y: p.y + (p.dy || 0),
      poly: [p.poly[0].map(([x, y]) => [x + (p.dx || 0), y + (p.dy || 0)])],
    })),
  };
  const porId = new Map(compacto.parcelas.map((p) => [p.id, p]));
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("aria-hidden", "true");
  contenedor.appendChild(svg);
  const mapa = crearMapaParcelas(svg, compacto, opciones);
  const a = (p) => porId.get(typeof p === "string" ? p : p.id);
  return Object.assign({}, mapa, {
    elemento: contenedor,
    tipo: "svg",
    latido: (si) => svg.classList.toggle("latiendo", si),
    enfocarEn: (p, r) => mapa.enfocarEn(a(p), r),
    anillos: (p, r) => mapa.anillos(a(p), r),
    mostrarVecinas: (p, v) => mapa.mostrarVecinas(a(p), v),
    resaltar: (p) => mapa.resaltar(p ? (typeof p === "string" ? p : p.id) : null),
    fijarEncuadre: () => {},
    interactivo: () => {},
  });
}
