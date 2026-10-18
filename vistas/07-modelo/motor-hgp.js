"use strict";

/*
 * Motor del GP jerárquico (modelo final del NB07), sin dependencias.
 *
 *   rendimiento = promedio de las parcelas conocidas
 *               + efecto del municipio        (varianza s2_municipio)
 *               + ajuste de las vecinas       (Matérn 3/2, alcance ~0.3 km)
 *               + ruido                       (s2_ruido)
 *
 * Con los parámetros oficiales reproduce las 59 predicciones entregadas
 * (diferencia ≤ 0.0005 t/ha, el redondeo del CSV).
 *
 * Uso:
 *   const motor = MotorHGP.crear(window.MODELO_HGP);
 *   motor.predecir("AGC_003");                    // parcela por predecir
 *   motor.predecir("AGC_002", { aCiegas: true }); // modo prueba: no ve su rendimiento
 *   motor.predecirTodas();                        // las 59 parcelas
 */

const MotorHGP = (() => {
  const RAIZ3 = Math.sqrt(3);
  const matern32 = (d, alcance) => {
    const r = (RAIZ3 * d) / alcance;
    return (1 + r) * Math.exp(-r);
  };

  function cholesky(A, n) {
    const L = new Float64Array(n * n);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        let s = A[i * n + j];
        for (let k = 0; k < j; k++) s -= L[i * n + k] * L[j * n + k];
        if (i === j) {
          if (s <= 0) throw new Error("La matriz del modelo no es definida positiva");
          L[i * n + i] = Math.sqrt(s);
        } else {
          L[i * n + j] = s / L[j * n + j];
        }
      }
    }
    return L;
  }

  function resolver(L, n, b) {
    const z = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let s = b[i];
      for (let k = 0; k < i; k++) s -= L[i * n + k] * z[k];
      z[i] = s / L[i * n + i];
    }
    const x = new Float64Array(n);
    for (let i = n - 1; i >= 0; i--) {
      let s = z[i];
      for (let k = i + 1; k < n; k++) s -= L[k * n + i] * x[k];
      x[i] = s / L[i * n + i];
    }
    return x;
  }

  const distancia = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  /** Ajusta el GP (con parámetros fijos) a un conjunto de parcelas conocidas. */
  function condicionar(conocidas, p) {
    const n = conocidas.length;
    const K = new Float64Array(n * n);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        let v = p.s2s * matern32(distancia(conocidas[i], conocidas[j]), p.alcance);
        if (conocidas[i].mun === conocidas[j].mun) v += p.s2m;
        if (i === j) v += p.s2n;
        K[i * n + j] = v;
        K[j * n + i] = v;
      }
    }
    const L = cholesky(K, n);
    const mu = conocidas.reduce((s, c) => s + c.y_obs, 0) / n;
    const alfa = resolver(L, n, Float64Array.from(conocidas, (c) => c.y_obs - mu));
    return { conocidas, n, L, mu, alfa };
  }

  function crear(datos) {
    const M = datos.modelo;
    const p = { s2m: M.s2_municipio, s2s: M.s2_espacial, alcance: M.alcance_km, s2n: M.s2_ruido };
    const q = M.q;
    const [umbralBajo, umbralAlto] = M.umbrales_riesgo;
    const parcelas = datos.parcelas;
    const porId = new Map(parcelas.map((x) => [x.id, x]));
    const conocidas = parcelas.filter((x) => !x.pred);
    const completo = condicionar(conocidas, p);
    const cache = new Map();

    const ajuste = (excluir) => {
      if (!excluir) return completo;
      if (!cache.has(excluir)) {
        cache.set(excluir, condicionar(conocidas.filter((c) => c.id !== excluir), p));
      }
      return cache.get(excluir);
    };

    const riesgoDe = (media, p20) => {
      const caida = (media - p20) / media;
      return caida < umbralBajo ? "Bajo" : caida < umbralAlto ? "Medio" : "Alto";
    };

    /** Predicción en un punto {x, y, mun} con su desglose completo. */
    function predecirEn(objetivo, { excluir = null } = {}) {
      const C = ajuste(excluir);
      const { n, conocidas: T, alfa, L, mu } = C;
      const k = new Float64Array(n);
      let municipio = 0;
      let vecinas = 0;
      const aportes = [];

      for (let i = 0; i < n; i++) {
        const d = distancia(objetivo, T[i]);
        const parecido = matern32(d, p.alcance);
        const ks = p.s2s * parecido;
        const km = T[i].mun === objetivo.mun ? p.s2m : 0;
        k[i] = ks + km;
        municipio += km * alfa[i];
        const aporte = ks * alfa[i];
        vecinas += aporte;
        if (parecido > 0.002) {
          aportes.push({ id: T[i].id, d_km: d, parecido, aporte, y_obs: T[i].y_obs, mun: T[i].mun });
        }
      }

      const v = resolver(L, n, k);
      let varianza = p.s2m + p.s2s + p.s2n;
      for (let i = 0; i < n; i++) varianza -= k[i] * v[i];
      const sd = Math.sqrt(Math.max(varianza, 1e-12));
      const media = mu + municipio + vecinas;
      const p20 = media + q.p20 * sd;
      aportes.sort((a, b) => a.d_km - b.d_km);

      return {
        media, sd, base: mu, municipio, vecinas,
        p10: media + q.p10 * sd, p20, p80: media + q.p80 * sd, p90: media + q.p90 * sd,
        riesgo: riesgoDe(media, p20),
        vecinasCercanas: aportes,
      };
    }

    /** Predice una parcela por ID. aCiegas: en una parcela conocida, esconde su rendimiento. */
    function predecir(id, { aCiegas = false } = {}) {
      const parcela = porId.get(id);
      if (!parcela) throw new Error(`No existe la parcela ${id}`);
      const prueba = !parcela.pred && aCiegas;
      const inicio = performance.now();
      const r = predecirEn(parcela, { excluir: prueba ? id : null });
      return { parcela, prueba, real: parcela.pred ? null : parcela.y_obs, ms: performance.now() - inicio, ...r };
    }

    function predecirTodas() {
      const inicio = performance.now();
      const resultados = parcelas.filter((x) => x.pred).map((x) => ({ parcela: x, ...predecirEn(x) }));
      return { resultados, ms: performance.now() - inicio };
    }

    /** Curva de parecido entre dos parcelas según su distancia (0 a maxKm). */
    const curvaParecido = (maxKm = 2, pasos = 120) =>
      Array.from({ length: pasos + 1 }, (_, i) => {
        const d = (maxKm * i) / pasos;
        return { d_km: d, parecido: matern32(d, p.alcance) };
      });

    /** Distancia a la que el parecido cae a un valor dado (búsqueda binaria). */
    function distanciaConParecido(objetivo) {
      let a = 0;
      let b = 20 * p.alcance;
      for (let i = 0; i < 60; i++) {
        const m = (a + b) / 2;
        if (matern32(m, p.alcance) > objetivo) a = m;
        else b = m;
      }
      return (a + b) / 2;
    }

    return {
      parametros: p,
      promedio: completo.mu,
      predecir,
      predecirEn,
      predecirTodas,
      curvaParecido,
      distanciaConParecido,
      parcelas,
      porId,
    };
  }

  return { crear, matern32 };
})();

if (typeof module !== "undefined") module.exports = MotorHGP;
