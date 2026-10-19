"use strict";

/*
 * Campo de cebada pintado en <canvas>: cielo, sierra al fondo, surcos en perspectiva y plantas que crecen
 * (hojas, macollos, tallos y espigas con aristas), lluvia, un tractor en la siembra y la cosechadora al final.
 *
 * Lo usan «Cómo crece» (vistas/03-crecimiento/seccion-crecimiento.js) y «2025, un año atípico»
 * (vistas/01-introduccion/temporada.js), para que las dos partes cuenten la misma temporada.
 *
 *   const campo = CampoCebada.crear(lienzo, { semilla: 7 });
 *   campo.dibujar({ crece, cosecha, sembrando, verde, maleza, lluvia, nubes, humedad, otono, t });
 *
 * Todos los valores van de 0 a 1 (sembrando = -1 cuando no hay tractor). «crece» es la etapa del cultivo:
 * 0 terreno sembrado · 0.12 plántula · 0.3 macollos · 0.5 encañe · 0.62 espiga · 0.78 grano lleno · 0.92 seco.
 *
 * CampoCebada.etapas(fen) y CampoCebada.estado(dia, fen) traducen una fecha (día del año) a esos valores a partir
 * del inicio, el pico y el fin del verdor (NB03). Las etapas son aproximadas: floración a los 45–57 días de
 * emerger y madurez a los 94–115 días de la siembra (INIFAP).
 */

const CampoCebada = (() => {
  const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
  const mezcla = (a, b, t) => a + (b - a) * t;
  const suave = (x) => x * x * (3 - 2 * x);
  const tramo = (v, a, b) => limitar((v - a) / (b - a), 0, 1);
  const mezclaColor = (a, b, t) => [mezcla(a[0], b[0], t), mezcla(a[1], b[1], t), mezcla(a[2], b[2], t)];
  const escalar = (c, k) => [Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k)];
  const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  function rampa(paradas, t) {
    if (t <= paradas[0][0]) return paradas[0][1];
    for (let i = 1; i < paradas.length; i++) {
      if (t <= paradas[i][0]) {
        const [t0, c0] = paradas[i - 1];
        const [t1, c1] = paradas[i];
        return mezclaColor(c0, c1, (t - t0) / (t1 - t0));
      }
    }
    return paradas[paradas.length - 1][1];
  }
  function azar(semilla) {
    let s = semilla | 0;
    return () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Paleta natural (no depende del tema: es una «ventana» al campo)
  const C = {
    cieloAlto: [118, 171, 212],
    cieloHorizonte: [236, 228, 208],
    nubladoAlto: [132, 144, 152],
    nubladoHorizonte: [206, 207, 199],
    sierraLejos: [128, 146, 166],
    sierraCerca: [96, 120, 92],
    sueloSeco: [156, 126, 92],
    sueloMojado: [98, 76, 58],
    verdeOscuro: [48, 88, 42],
    verde: [78, 126, 56],
    verdeClaro: [132, 170, 82],
    amarillo: [186, 176, 82],
    dorado: [212, 174, 92],
    paja: [198, 172, 122],
    maleza: [96, 146, 70],
  };

  /* --- Etapas del cultivo a partir del verdor -------------------------------------- */

  const NOMBRES = [
    ["siembra", "Siembra"],
    ["emergencia", "Emergencia"],
    ["macollo", "Amacollamiento"],
    ["encane", "Encañe"],
    ["espiga", "Espigamiento y floración"],
    ["llenado", "Llenado de grano"],
    ["madurez", "Madurez"],
    ["cosecha", "Cosecha"],
  ];
  const CRECE = [0, 0.04, 0.12, 0.3, 0.5, 0.62, 0.78, 0.92, 1];

  /** fen = { inicio, pico, fin } en día del año. Devuelve las 8 etapas con sus días. */
  function etapas({ inicio: I, pico: P, fin: F }) {
    const L1 = P - I;
    const L2 = F - P;
    const lim = [I - 20, I - 8, I + 0.05 * L1, I + 0.42 * L1, I + 0.62 * L1, I + 0.86 * L1, P + 0.28 * L2, P + 0.62 * L2, F];
    return NOMBRES.map(([clave, nombre], i) => ({ clave, nombre, desde: lim[i], hasta: lim[i + 1], c0: CRECE[i], c1: CRECE[i + 1] }));
  }

  /** Estado del campo en un día. */
  function estado(dia, fen) {
    const E = etapas(fen);
    if (dia < E[0].desde) return { crece: 0, cosecha: 0, sembrando: -1, etapa: -1 };
    if (dia >= E[7].hasta) return { crece: 1, cosecha: 1, sembrando: -1, etapa: 7 };
    const i = E.findIndex((e) => dia < e.hasta);
    const e = E[i];
    const u = (dia - e.desde) / (e.hasta - e.desde);
    return {
      crece: e.c0 + (e.c1 - e.c0) * u,
      cosecha: e.clave === "cosecha" ? suave(u) : 0,
      sembrando: e.clave === "siembra" ? u : -1,
      etapa: i,
    };
  }

  /* --- El lienzo ------------------------------------------------------------------- */

  function crear(lienzo, opciones = {}) {
    const ctx = lienzo.getContext("2d");
    const op = { semilla: 7, horizonte: 0.42, espacio: 1, ...opciones };
    let W = 0;
    let H = 0;
    let dpr = 1;
    let G = null; // geometría fija (sierra, surcos, plantas, nubes, gotas)

    function ajustar() {
      const caja = lienzo.getBoundingClientRect();
      const w = Math.max(2, Math.round(caja.width));
      const h = Math.max(2, Math.round(caja.height));
      const d = Math.min(2, window.devicePixelRatio || 1);
      if (w === W && h === H && d === dpr && G) return false;
      W = w;
      H = h;
      dpr = d;
      lienzo.width = Math.round(W * dpr);
      lienzo.height = Math.round(H * dpr);
      preparar();
      return true;
    }

    function preparar() {
      const r = azar(op.semilla);
      const yh = H * op.horizonte;

      // Sierra: dos capas de crestas suaves; en la de atrás, un volcán ancho
      const cresta = (amp, frec, base, volcan) => {
        const fases = [r() * 6, r() * 6, r() * 6, r() * 6];
        const pts = [];
        for (let x = -10; x <= W + 10; x += Math.max(3, W / 160)) {
          let y = 0;
          y += Math.sin(x * frec + fases[0]) * 0.55;
          y += Math.sin(x * frec * 2.3 + fases[1]) * 0.28;
          y += Math.sin(x * frec * 5.1 + fases[2]) * 0.12;
          y += Math.sin(x * frec * 11.7 + fases[3]) * 0.05;
          let alto = base - amp * (0.55 + 0.45 * y);
          if (volcan) {
            const dx = (x - W * volcan.x) / (W * volcan.ancho);
            alto -= H * volcan.alto * Math.exp(-dx * dx * 2.2);
          }
          pts.push([x, alto]);
        }
        return pts;
      };
      const sierraLejos = cresta(H * 0.07, 6 / W, yh - H * 0.015, { x: 0.28, ancho: 0.2, alto: 0.11 });
      const sierraCerca = cresta(H * 0.035, 11 / W, yh + 1, null);

      // Surcos en perspectiva: distancia D (1 = el más cercano); en pantalla, y = horizonte + k / D
      const filas = [];
      const espacio = H * 0.075 * op.espacio;
      for (let i = 0, D = 1; D < 18; i++, D = 1 + i * 0.3 * (1 + i * 0.13)) {
        const s = 1 / D;
        const y = yh + (H * 1.05 - yh) * s;
        const nivel = s >= 0.42 ? "detalle" : s >= 0.11 ? "medio" : "lejos";
        const plantas = [];
        if (nivel !== "lejos") {
          const paso = Math.max(nivel === "detalle" ? 9 : 3.2, espacio * s);
          for (let x = -paso; x < W + paso; x += paso) {
            plantas.push({
              x: x + (r() - 0.5) * paso * 0.7,
              y: y + (r() - 0.5) * 3 * s,
              alto: 0.82 + r() * 0.3,
              macollos: 2 + Math.floor(r() * 3.2),
              abre: 0.09 + r() * 0.08,
              inclina: (r() - 0.5) * 0.16,
              fase: r() * 6.28,
              lado: r() < 0.5 ? -1 : 1,
              maleza: r(),
            });
          }
        }
        filas.push({ s, y, nivel, plantas, tono: 0.93 + r() * 0.1 });
      }
      filas.reverse(); // de lejos a cerca

      // Nubes: grupos de bocanadas suaves (degradados radiales, sin bordes)
      const nubes = Array.from({ length: 7 }, (_, i) => ({
        x: r() * W,
        y: H * (0.04 + r() * 0.2),
        tam: H * (0.07 + r() * 0.08),
        vel: 2 + r() * 5,
        orden: r(),
        bocanadas: Array.from({ length: 7 }, () => [(r() - 0.5) * 2.4, (r() - 0.6) * 0.7, 0.55 + r() * 0.6]),
        umbral: i / 7,
      }));
      const gotas = Array.from({ length: 260 }, () => ({ x: r(), y: r(), largo: 0.6 + r() * 0.8, vel: 0.8 + r() * 0.5 }));
      const terrones = Array.from({ length: 90 }, () => ({ x: r(), fila: r(), tam: 0.4 + r() * 0.9 }));

      G = { yh, sierraLejos, sierraCerca, filas, nubes, gotas, terrones };
    }

    /* --- Partes del dibujo --------------------------------------------------------- */

    function poligono(pts, abajo) {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], abajo);
      for (const [x, y] of pts) ctx.lineTo(x, y);
      ctx.lineTo(pts[pts.length - 1][0], abajo);
      ctx.closePath();
    }

    function cielo(e, horizonte) {
      const g = ctx.createLinearGradient(0, 0, 0, G.yh);
      g.addColorStop(0, css(mezclaColor(C.cieloAlto, C.nubladoAlto, e.nubes)));
      g.addColorStop(1, css(horizonte));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, G.yh + 4);

      // Sol: un resplandor, sin disco duro
      const sol = 1 - e.nubes * 0.85;
      if (sol > 0.05) {
        const sx = W * 0.8;
        const sy = H * 0.14;
        const rg = ctx.createRadialGradient(sx, sy, 0, sx, sy, H * 0.55);
        rg.addColorStop(0, `rgba(255,246,214,${0.95 * sol})`);
        rg.addColorStop(0.08, `rgba(255,236,190,${0.6 * sol})`);
        rg.addColorStop(0.35, `rgba(255,226,170,${0.18 * sol})`);
        rg.addColorStop(1, "rgba(255,226,170,0)");
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, W, G.yh + 4);
      }
    }

    function nubes(e) {
      const gris = mezclaColor([255, 255, 255], [138, 146, 154], limitar(e.lluvia * 0.9 + e.nubes * 0.15, 0, 1));
      const cuantas = e.nubes;
      for (const n of G.nubes) {
        if (n.umbral > cuantas + 0.08) continue;
        const peso = limitar((cuantas + 0.08 - n.umbral) / 0.2, 0, 1);
        const ancho = W + n.tam * 6;
        const x = ((n.x + e.t * n.vel) % ancho) - n.tam * 3;
        for (const [dx, dy, k] of n.bocanadas) {
          const px = x + dx * n.tam;
          const py = n.y + dy * n.tam;
          const rad = n.tam * k * (1 + e.lluvia * 0.4);
          const g = ctx.createRadialGradient(px, py - rad * 0.2, 0, px, py, rad);
          g.addColorStop(0, css(escalar(gris, 1.04), 0.62 * peso));
          g.addColorStop(0.55, css(gris, 0.38 * peso));
          g.addColorStop(1, css(gris, 0));
          ctx.fillStyle = g;
          ctx.fillRect(px - rad, py - rad, rad * 2, rad * 2);
        }
      }
    }

    function sierra(horizonte) {
      const lejos = mezclaColor(horizonte, C.sierraLejos, 0.42);
      const g1 = ctx.createLinearGradient(0, G.yh - H * 0.2, 0, G.yh);
      g1.addColorStop(0, css(escalar(lejos, 0.96)));
      g1.addColorStop(1, css(mezclaColor(lejos, horizonte, 0.45)));
      ctx.fillStyle = g1;
      poligono(G.sierraLejos, G.yh + 2);
      ctx.fill();

      const cerca = mezclaColor(horizonte, C.sierraCerca, 0.55);
      const g2 = ctx.createLinearGradient(0, G.yh - H * 0.07, 0, G.yh);
      g2.addColorStop(0, css(cerca));
      g2.addColorStop(1, css(mezclaColor(cerca, horizonte, 0.3)));
      ctx.fillStyle = g2;
      poligono(G.sierraCerca, G.yh + 3);
      ctx.fill();
    }

    // Colores del cultivo según la etapa
    function colores(c, verde) {
      const seco = tramo(c, 0.66, 0.9);
      const dora = tramo(c, 0.7, 0.92);
      const viveza = 0.75 + 0.25 * verde;
      const hoja = rampa([[0, mezclaColor(C.verde, C.verdeClaro, 0.25)], [0.45, mezclaColor(C.verde, C.amarillo, 0.4)], [0.75, C.dorado], [1, C.paja]], seco);
      return {
        hojaClara: escalar(hoja, 1.16 * viveza + 0.12),
        hojaOscura: escalar(hoja, 0.74 * viveza + 0.1),
        tallo: rampa([[0, C.verde], [0.6, C.amarillo], [1, C.dorado]], dora),
        espiga: rampa([[0, [182, 200, 116]], [0.45, [212, 202, 122]], [1, [226, 188, 104]]], dora),
        arista: rampa([[0, [216, 226, 172]], [1, [240, 218, 156]]], dora),
        dosel: rampa([[0, C.verde], [0.5, C.amarillo], [1, C.dorado]], Math.max(seco, dora)),
      };
    }

    // Altura relativa de la planta en cada etapa
    const altura = (c) =>
      c < 0.04 ? 0 : c < 0.12 ? mezcla(0.02, 0.12, tramo(c, 0.04, 0.12)) : c < 0.3 ? mezcla(0.12, 0.3, tramo(c, 0.12, 0.3)) : c < 0.5 ? mezcla(0.3, 0.86, suave(tramo(c, 0.3, 0.5))) : mezcla(0.86, 1, tramo(c, 0.5, 0.62));

    function hoja(ruta, bx, by, dir, largo, caida, ancho) {
      const sx = Math.sin(dir);
      const cy = -Math.cos(dir);
      const tx = bx + sx * largo;
      const ty = by + cy * largo + caida;
      const kx = bx + sx * largo * 0.55;
      const ky = by + cy * largo * 0.72;
      // normal en la base
      const nx = -cy;
      const ny = sx;
      ruta.moveTo(bx + (nx * ancho) / 2, by + (ny * ancho) / 2);
      ruta.quadraticCurveTo(kx + nx * ancho * 0.45, ky + ny * ancho * 0.45, tx, ty);
      ruta.quadraticCurveTo(kx - nx * ancho * 0.45, ky - ny * ancho * 0.45, bx - (nx * ancho) / 2, by - (ny * ancho) / 2);
      ruta.closePath();
    }

    function espiga(rutaGrano, rutaArista, x, y, dir, largo, lleno) {
      const ux = Math.sin(dir);
      const uy = -Math.cos(dir);
      const nx = -uy;
      const ny = ux;
      const granos = 7;
      const izq = [];
      const der = [];
      for (let i = 0; i <= granos; i++) {
        const f = i / granos;
        const ax = x + ux * largo * f;
        const ay = y + uy * largo * f;
        const bulto = largo * 0.11 * (0.75 + 0.5 * lleno) * (i % 2 ? 1 : 0.6) * (1 - f * 0.35);
        izq.push([ax + nx * bulto, ay + ny * bulto]);
        der.push([ax - nx * bulto * (i % 2 ? 0.6 : 1), ay - ny * bulto * (i % 2 ? 0.6 : 1)]);
        if (i > 0) {
          // aristas: largas y finas, abiertas hacia arriba
          const la = largo * (1.2 + 0.35 * (1 - f));
          const abre = (i % 2 ? 1 : -1) * 0.16;
          const dx = Math.sin(dir + abre);
          const dy = -Math.cos(dir + abre);
          const px = ax + nx * bulto * (i % 2 ? 1 : -1);
          const py = ay + ny * bulto * (i % 2 ? 1 : -1);
          rutaArista.moveTo(px, py);
          rutaArista.quadraticCurveTo(px + dx * la * 0.5 + nx * 0.6, py + dy * la * 0.5 + ny * 0.6, px + dx * la, py + dy * la);
        }
      }
      rutaGrano.moveTo(x, y);
      for (const [px, py] of izq) rutaGrano.lineTo(px, py);
      rutaGrano.lineTo(x + ux * largo * 1.04, y + uy * largo * 1.04);
      for (let i = der.length - 1; i >= 0; i--) rutaGrano.lineTo(der[i][0], der[i][1]);
      rutaGrano.closePath();
    }

    function fila(f, e, col, horizonte, frente) {
      const s = f.s;
      const neblina = Math.pow(1 - s, 2) * 0.55;
      const conNeblina = (c) => mezclaColor(c, horizonte, neblina);
      const hBase = H * 0.46 * s;
      const alt = altura(e.crece);
      const t = e.t;

      if (f.nivel === "lejos") {
        if (alt <= 0.01 && e.maleza <= 0.01) return;
        // Dosel lejano: una franja con borde irregular
        const h = Math.max(1, hBase * Math.max(alt, e.maleza * 0.12));
        const corte = frente;
        const cubre = Math.min(1, 0.2 + Math.max(alt, e.maleza * 0.5) * 1.3);
        const tramoDosel = (x0, x1, color, alto) => {
          if (x1 <= x0) return;
          ctx.fillStyle = css(mezclaColor(conNeblina(color), horizonte, 0.15), cubre);
          ctx.beginPath();
          ctx.moveTo(x0, f.y);
          for (let x = x0; x <= x1 + 4; x += 4) ctx.lineTo(x, f.y - alto * (0.85 + 0.15 * Math.sin(x * 0.7 + f.y)));
          ctx.lineTo(x1, f.y + 1);
          ctx.closePath();
          ctx.fill();
        };
        const colorDosel = alt > 0.01 ? col.dosel : C.maleza;
        tramoDosel(0, Math.min(W, corte), colorDosel, h);
        if (corte < W) tramoDosel(Math.max(0, corte), W, C.paja, Math.max(0.6, hBase * 0.05));
        return;
      }

      const grosor = Math.max(0.6, (f.nivel === "detalle" ? 2.2 : 2.6) * s);
      const tallos = new Path2D();
      const hojasClaras = new Path2D();
      const hojasOscuras = new Path2D();
      const granos = new Path2D();
      const aristas = new Path2D();
      const rastrojo = new Path2D();
      const pasto = new Path2D();
      const seco = tramo(e.crece, 0.66, 0.9);
      const espigaVisible = tramo(e.crece, 0.5, 0.6);
      const lleno = tramo(e.crece, 0.62, 0.8);
      const nodo = tramo(e.crece, 0.62, 0.9);
      const macolla = tramo(e.crece, 0.12, 0.3);

      for (const p of f.plantas) {
        if (p.x > frente) {
          // Rastrojo después de la cosechadora
          const hr = hBase * 0.06;
          for (let k = -1; k <= 1; k++) {
            rastrojo.moveTo(p.x + k * 2 * s, p.y);
            rastrojo.lineTo(p.x + k * 2.6 * s + p.inclina * 4, p.y - hr * (0.8 + 0.3 * Math.abs(k)));
          }
          continue;
        }
        // Verdor temprano (maleza) antes de la siembra
        if (e.maleza > 0.02 && p.maleza < e.maleza) {
          const hm = hBase * 0.07 * (0.6 + e.maleza);
          for (let k = -2; k <= 2; k++) {
            pasto.moveTo(p.x + k * 3 * s, p.y);
            pasto.quadraticCurveTo(p.x + k * 4 * s, p.y - hm * 0.6, p.x + k * 5.5 * s + Math.sin(t + p.fase) * s, p.y - hm);
          }
        }
        if (alt <= 0.001) continue;

        const h = hBase * alt * p.alto;
        const viento = Math.sin(t * 1.5 + p.fase + p.x * 0.004) * 0.05 * (0.35 + alt) + Math.sin(t * 0.37 + p.x * 0.001) * 0.035 * alt;
        const n = 1 + Math.round((p.macollos - 1) * macolla);
        const medio = (n - 1) / 2;

        for (let k = 0; k < n; k++) {
          const a = (k - medio) * p.abre * (0.6 + 0.6 * macolla) + p.inclina + viento;
          const hk = h * (k === Math.round(medio) ? 1 : 0.9 - 0.04 * Math.abs(k - medio));
          const tx = p.x + Math.sin(a) * hk;
          const ty = p.y - Math.cos(a) * hk;
          const kx = p.x + Math.sin(a * 0.4) * hk * 0.5;
          const ky = p.y - hk * 0.55;

          if (alt > 0.2) {
            tallos.moveTo(p.x, p.y);
            tallos.quadraticCurveTo(kx, ky, tx, ty);
          }

          // Hojas: salen a lo largo del tallo y se arquean; al secarse cuelgan
          const nHojas = f.nivel === "detalle" ? (alt < 0.12 ? 2 : 3) : 2;
          for (let j = 0; j < nHojas; j++) {
            const fr = alt < 0.2 ? 0.02 : [0.1, 0.32, 0.52][j];
            const bx = mezcla(mezcla(p.x, kx, fr), mezcla(kx, tx, fr), fr);
            const by = mezcla(mezcla(p.y, ky, fr), mezcla(ky, ty, fr), fr);
            const lado = (j + k) % 2 ? 1 : -1;
            const largo = H * 0.46 * s * p.alto * (0.07 + 0.22 * Math.min(1, alt * 1.6)) * (1 - 0.12 * j) * (1 - 0.2 * seco);
            const dir = a + lado * (0.34 + 0.18 * j + 0.45 * seco);
            const caida = largo * (0.18 + 0.3 * seco + 0.1 * j);
            if (f.nivel === "detalle") {
              hoja(lado > 0 ? hojasClaras : hojasOscuras, bx, by, dir, largo, caida, Math.max(0.9, largo * 0.065));
            } else {
              tallos.moveTo(bx, by);
              tallos.quadraticCurveTo(bx + Math.sin(dir) * largo * 0.6, by - Math.cos(dir) * largo * 0.7, bx + Math.sin(dir) * largo, by - Math.cos(dir) * largo + caida);
            }
          }

          // Espiga con aristas: sale en el espigamiento y se inclina al llenarse
          if (espigaVisible > 0) {
            const largo = H * 0.46 * s * p.alto * 0.17 * espigaVisible;
            const dir = a + p.lado * (nodo * 0.95 + 0.05);
            if (f.nivel === "detalle") {
              espiga(granos, aristas, tx, ty, dir, largo, lleno);
            } else {
              granos.moveTo(tx, ty);
              granos.lineTo(tx + Math.sin(dir) * largo, ty - Math.cos(dir) * largo);
            }
          }
        }
      }

      // Pintar la fila (de atrás hacia adelante dentro de la fila no hace falta: es delgada)
      ctx.lineCap = "round";
      if (e.maleza > 0.02) {
        ctx.strokeStyle = css(conNeblina(C.maleza), 0.9);
        ctx.lineWidth = Math.max(0.5, 1.2 * s);
        ctx.stroke(pasto);
      }
      if (f.nivel === "detalle") {
        ctx.fillStyle = css(conNeblina(col.hojaOscura));
        ctx.fill(hojasOscuras);
        ctx.strokeStyle = css(conNeblina(col.tallo));
        ctx.lineWidth = grosor;
        ctx.stroke(tallos);
        ctx.fillStyle = css(conNeblina(col.hojaClara));
        ctx.fill(hojasClaras);
        if (espigaVisible > 0) {
          ctx.strokeStyle = css(conNeblina(col.arista), 0.9);
          ctx.lineWidth = Math.max(0.4, 0.7 * s);
          ctx.stroke(aristas);
          ctx.fillStyle = css(conNeblina(col.espiga));
          ctx.fill(granos);
          ctx.strokeStyle = css(conNeblina(escalar(col.espiga, 0.72)), 0.6);
          ctx.lineWidth = Math.max(0.3, 0.5 * s);
          ctx.stroke(granos);
        }
      } else {
        ctx.strokeStyle = css(conNeblina(mezclaColor(col.hojaOscura, col.tallo, 0.4)));
        ctx.lineWidth = grosor;
        ctx.stroke(tallos);
        if (espigaVisible > 0) {
          ctx.strokeStyle = css(conNeblina(col.espiga));
          ctx.lineWidth = Math.max(1.2, 4.4 * s);
          ctx.stroke(granos);
        }
      }
      ctx.strokeStyle = css(conNeblina(C.paja));
      ctx.lineWidth = Math.max(0.5, 1.4 * s);
      ctx.stroke(rastrojo);
    }

    function suelo(e, horizonte) {
      const tierra = mezclaColor(C.sueloSeco, C.sueloMojado, e.humedad);
      const g = ctx.createLinearGradient(0, G.yh, 0, H);
      g.addColorStop(0, css(mezclaColor(tierra, horizonte, 0.55)));
      g.addColorStop(0.35, css(mezclaColor(tierra, horizonte, 0.15)));
      g.addColorStop(1, css(escalar(tierra, 0.92)));
      ctx.fillStyle = g;
      ctx.fillRect(0, G.yh, W, H - G.yh);

      // Surcos: lomos claros y fondos oscuros, cada vez más juntos hacia el horizonte
      for (let i = 0; i < G.filas.length - 1; i++) {
        const a = G.filas[i];
        const b = G.filas[i + 1];
        const neb = Math.pow(1 - a.s, 2) * 0.5;
        const alto = b.y - a.y;
        ctx.fillStyle = css(mezclaColor(escalar(tierra, 0.82 * a.tono), horizonte, neb), 0.7);
        ctx.fillRect(0, a.y - alto * 0.12, W, Math.max(0.6, alto * 0.22));
        ctx.fillStyle = css(mezclaColor(escalar(tierra, 1.08 * a.tono), horizonte, neb), 0.5);
        ctx.fillRect(0, a.y + alto * 0.18, W, Math.max(0.5, alto * 0.3));
      }
      // Terrones en los surcos cercanos
      ctx.fillStyle = css(escalar(tierra, 0.72), 0.55);
      for (const tr of G.terrones) {
        const f = G.filas[G.filas.length - 1 - Math.floor(tr.fila * 4)];
        if (!f) continue;
        const r = tr.tam * 2.2 * f.s;
        ctx.beginPath();
        ctx.ellipse(tr.x * W, f.y + 2 * f.s, r * 1.6, r * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    /* --- Máquinas ------------------------------------------------------------------- */

    function rueda(x, y, r, giro) {
      const g = ctx.createRadialGradient(x - r * 0.25, y - r * 0.25, r * 0.1, x, y, r);
      g.addColorStop(0, "#4a4a46");
      g.addColorStop(0.7, "#262624");
      g.addColorStop(1, "#141412");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      // dibujo de la llanta
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.lineWidth = Math.max(1, r * 0.12);
      for (let k = 0; k < 10; k++) {
        const a = giro + (k * Math.PI) / 5;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * r * 0.82, y + Math.sin(a) * r * 0.82);
        ctx.lineTo(x + Math.cos(a) * r * 0.98, y + Math.sin(a) * r * 0.98);
        ctx.stroke();
      }
      const rin = ctx.createRadialGradient(x - r * 0.1, y - r * 0.1, 0, x, y, r * 0.5);
      rin.addColorStop(0, "#e9d9a8");
      rin.addColorStop(1, "#a08850");
      ctx.fillStyle = rin;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.42, 0, Math.PI * 2);
      ctx.fill();
    }

    function caja(x, y, w, h, radio, c1, c2) {
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, c1);
      g.addColorStop(1, c2);
      ctx.fillStyle = g;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, w, h, radio);
      else ctx.rect(x, y, w, h);
      ctx.fill();
    }

    function polvo(x, y, tam, e, cantidad, color) {
      for (let k = 0; k < cantidad; k++) {
        const fase = (e.t * 0.8 + k / cantidad) % 1;
        const px = x + (k % 2 ? 1 : -1) * fase * tam * 0.6 + Math.sin(k * 3.1) * tam * 0.3;
        const py = y - fase * tam * 0.9;
        const r = tam * (0.25 + fase * 0.6);
        const g = ctx.createRadialGradient(px, py, 0, px, py, r);
        g.addColorStop(0, css(color, 0.35 * (1 - fase)));
        g.addColorStop(1, css(color, 0));
        ctx.fillStyle = g;
        ctx.fillRect(px - r, py - r, r * 2, r * 2);
      }
    }

    function sombra(x, y, w, h) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, w);
      g.addColorStop(0, "rgba(30,24,18,0.35)");
      g.addColorStop(1, "rgba(30,24,18,0)");
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, h / w);
      ctx.translate(-x, -y);
      ctx.fillStyle = g;
      ctx.fillRect(x - w, y - w, w * 2, w * 2);
      ctx.restore();
    }

    // Tractor con sembradora, hacia la derecha
    function tractor(x, y, s, e) {
      const k = H * 0.0022 * s * 100;
      const giro = e.t * 4;
      sombra(x - k * 0.2, y, k * 1.1, k * 0.18);
      polvo(x - k * 1.25, y - k * 0.05, k * 0.5, e, 5, [150, 120, 90]);
      // sembradora
      caja(x - k * 1.45, y - k * 0.42, k * 0.62, k * 0.26, k * 0.05, "#6d6a5f", "#4a473f");
      ctx.strokeStyle = "#3d3a33";
      ctx.lineWidth = Math.max(1, k * 0.04);
      for (let d = 0; d < 4; d++) {
        ctx.beginPath();
        ctx.moveTo(x - k * (1.4 - d * 0.16), y - k * 0.16);
        ctx.lineTo(x - k * (1.36 - d * 0.16), y - k * 0.02);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(x - k * 0.83, y - k * 0.3);
      ctx.lineTo(x - k * 0.55, y - k * 0.26);
      ctx.stroke();
      // cuerpo
      caja(x - k * 0.62, y - k * 0.62, k * 0.62, k * 0.34, k * 0.06, "#d0623f", "#93391f");
      caja(x - k * 0.05, y - k * 0.5, k * 0.58, k * 0.24, k * 0.07, "#d86c46", "#9c4024");
      caja(x - k * 0.58, y - k * 1.0, k * 0.44, k * 0.4, k * 0.06, "rgba(200,225,235,0.75)", "rgba(120,150,165,0.75)");
      ctx.strokeStyle = "#5b2414";
      ctx.lineWidth = Math.max(1, k * 0.05);
      ctx.strokeRect(x - k * 0.58, y - k * 1.0, k * 0.44, k * 0.4);
      ctx.beginPath();
      ctx.moveTo(x + k * 0.32, y - k * 0.5);
      ctx.lineTo(x + k * 0.32, y - k * 0.82);
      ctx.stroke();
      polvo(x + k * 0.32, y - k * 0.86, k * 0.25, e, 3, [120, 120, 120]);
      rueda(x - k * 0.42, y - k * 0.3, k * 0.32, giro);
      rueda(x + k * 0.38, y - k * 0.17, k * 0.18, giro * 1.7);
    }

    // Cosechadora, hacia la izquierda: plataforma de corte con molinete, cuerpo, tolva, cabina y tubo de descarga
    function cosechadora(x, y, s, e) {
      const k = H * 0.0021 * s * 100;
      const giro = -e.t * 3;
      sombra(x + k * 1.3, y, k * 1.7, k * 0.22);
      polvo(x + k * 2.75, y - k * 0.6, k * 0.8, e, 7, [214, 190, 130]);
      // plataforma de corte, baja y al frente
      caja(x, y - k * 0.4, k * 0.72, k * 0.3, k * 0.06, "#b44a31", "#71281a");
      ctx.fillStyle = "#5a2014";
      ctx.beginPath();
      ctx.moveTo(x - k * 0.08, y - k * 0.1);
      ctx.lineTo(x + k * 0.2, y - k * 0.12);
      ctx.lineTo(x + k * 0.12, y - k * 0.03);
      ctx.closePath();
      ctx.fill();
      polvo(x + k * 0.1, y - k * 0.15, k * 0.45, e, 5, [222, 196, 132]);
      // molinete que gira sobre la plataforma
      const mx = x + k * 0.36;
      const my = y - k * 0.62;
      const mr = k * 0.28;
      ctx.strokeStyle = "rgba(96,32,20,0.95)";
      ctx.lineWidth = Math.max(1, k * 0.04);
      for (let b = 0; b < 6; b++) {
        const a = giro + (b * Math.PI) / 3;
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.lineTo(mx + Math.cos(a) * mr, my + Math.sin(a) * mr);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(mx + Math.cos(a) * mr, my + Math.sin(a) * mr, k * 0.035, 0, Math.PI * 2);
        ctx.stroke();
      }
      // canal de alimentación hacia el cuerpo
      ctx.fillStyle = "#8f3420";
      ctx.beginPath();
      ctx.moveTo(x + k * 0.6, y - k * 0.38);
      ctx.lineTo(x + k * 0.92, y - k * 0.82);
      ctx.lineTo(x + k * 1.05, y - k * 0.62);
      ctx.lineTo(x + k * 0.72, y - k * 0.14);
      ctx.closePath();
      ctx.fill();
      // cuerpo y tolva
      caja(x + k * 0.85, y - k * 1.28, k * 1.75, k * 0.95, k * 0.14, "#cf5a3e", "#8c301d");
      caja(x + k * 1.25, y - k * 1.55, k * 1.15, k * 0.32, k * 0.1, "#c25038", "#87301d");
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(x + k * 0.92, y - k * 1.2, k * 1.6, k * 0.08);
      // cabina de vidrio
      caja(x + k * 0.72, y - k * 1.86, k * 0.56, k * 0.6, k * 0.08, "rgba(210,232,242,0.85)", "rgba(112,142,158,0.85)");
      ctx.strokeStyle = "#5e1f12";
      ctx.lineWidth = Math.max(1, k * 0.045);
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x + k * 0.72, y - k * 1.86, k * 0.56, k * 0.6, k * 0.08);
      else ctx.rect(x + k * 0.72, y - k * 1.86, k * 0.56, k * 0.6);
      ctx.stroke();
      // tubo de descarga recogido
      ctx.lineCap = "round";
      ctx.lineWidth = Math.max(1.5, k * 0.09);
      ctx.strokeStyle = "#7a2817";
      ctx.beginPath();
      ctx.moveTo(x + k * 2.45, y - k * 1.42);
      ctx.lineTo(x + k * 1.5, y - k * 1.72);
      ctx.stroke();
      rueda(x + k * 1.2, y - k * 0.42, k * 0.44, giro);
      rueda(x + k * 2.25, y - k * 0.28, k * 0.28, giro * 1.5);
    }

    function lluvia(e) {
      if (e.lluvia < 0.03) return;
      const n = Math.round(G.gotas.length * e.lluvia);
      ctx.strokeStyle = `rgba(214,226,236,${0.28 + 0.2 * e.lluvia})`;
      ctx.lineWidth = Math.max(0.6, H * 0.0018);
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const g = G.gotas[i];
        const y = ((g.y + e.t * g.vel * 1.4) % 1) * H * 1.1 - H * 0.05;
        const x = ((g.x * W + y * 0.18) % W + W) % W;
        const largo = H * 0.035 * g.largo;
        ctx.moveTo(x, y);
        ctx.lineTo(x + largo * 0.18, y + largo);
      }
      ctx.stroke();
      ctx.fillStyle = `rgba(196,204,210,${0.16 * e.lluvia})`;
      ctx.fillRect(0, 0, W, H);
    }

    /* --- Dibujo completo ----------------------------------------------------------- */

    function dibujar(entrada) {
      if (!G) ajustar();
      const e = { crece: 0, cosecha: 0, sembrando: -1, verde: 0.5, maleza: 0, lluvia: 0, nubes: 0.3, humedad: 0.3, otono: 0, t: 0, ...entrada };
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const horizonte = mezclaColor(mezclaColor(C.cieloHorizonte, C.nubladoHorizonte, e.nubes), [240, 214, 170], e.otono * 0.35);

      cielo(e, horizonte);
      nubes(e);
      sierra(horizonte);
      suelo(e, horizonte);

      const col = colores(e.crece, e.verde);
      const frente = e.cosecha > 0 ? W * 1.12 - W * 1.3 * e.cosecha : Infinity;
      const nFilas = G.filas.length;
      const filaMaquina = nFilas - 2; // la segunda fila más cercana
      for (let i = 0; i < nFilas; i++) {
        fila(G.filas[i], e, col, horizonte, frente);
        if (i === filaMaquina) {
          const f = G.filas[i];
          if (e.sembrando >= 0 && e.sembrando <= 1) tractor(-W * 0.1 + W * 1.25 * e.sembrando, f.y + 2, f.s, e);
          if (e.cosecha > 0 && e.cosecha < 1) cosechadora(frente, f.y + 2, f.s, e);
        }
      }
      lluvia(e);

      // Luz de la temporada: cálida en otoño
      if (e.otono > 0.01) {
        ctx.fillStyle = `rgba(255,196,120,${0.1 * e.otono})`;
        ctx.fillRect(0, 0, W, H);
      }
    }

    ajustar();
    return { ajustar, dibujar };
  }

  return { crear, etapas, estado };
})();
