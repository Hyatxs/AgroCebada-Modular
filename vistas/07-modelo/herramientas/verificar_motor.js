// Verifica el motor contra las predicciones oficiales del NB07.
const fs = require('fs');
global.window = {};
global.performance = require('perf_hooks').performance;
eval(fs.readFileSync(process.argv[2], 'utf8'));            // datos-modelo.js -> window.MODELO_HGP
const MotorHGP = require(process.argv[3]);
const datos = window.MODELO_HGP;
const t0 = performance.now();
const motor = MotorHGP.crear(datos);
const t1 = performance.now();
const { resultados, ms } = motor.predecirTodas();
let maxMedia = 0, maxSd = 0, maxP20 = 0, riesgoDistinto = [];
for (const r of resultados) {
  const of = r.parcela;
  maxMedia = Math.max(maxMedia, Math.abs(r.media - of.est));
  maxSd = Math.max(maxSd, Math.abs(r.sd - of.sd));
  if (r.riesgo !== of.riesgo) riesgoDistinto.push(`${of.id} ${r.riesgo}≠${of.riesgo}`);
  const suma = r.base + r.municipio + r.vecinas;
  if (Math.abs(suma - r.media) > 1e-9) throw new Error('el desglose no suma');
}
console.log(`ajuste ${(t1 - t0).toFixed(1)} ms; 59 predicciones en ${ms.toFixed(1)} ms`);
console.log(`max |Δ| media ${maxMedia.toFixed(5)} · sd ${maxSd.toFixed(5)} · riesgo distinto: ${riesgoDistinto.join(', ') || 'ninguno'}`);
const t2 = performance.now();
let se = 0, n = 0;
for (const p of datos.parcelas.filter((x) => !x.pred)) { const r = motor.predecir(p.id, { aCiegas: true }); se += (r.media - r.real) ** 2; n++; }
console.log(`prueba a ciegas (dejando una fuera, parámetros fijos): RMSE ${Math.sqrt(se / n).toFixed(4)} en ${(performance.now() - t2).toFixed(0)} ms`);
const e = motor.predecir('AGC_003');
console.log('AGC_003', e.media.toFixed(3), 'base', e.base.toFixed(3), 'mun', e.municipio.toFixed(3), 'vec', e.vecinas.toFixed(3), 'riesgo', e.riesgo, 'vecinas', e.vecinasCercanas.length);
console.log('parecido 0.5 a', motor.distanciaConParecido(0.5).toFixed(3), 'km; 0.05 a', motor.distanciaConParecido(0.05).toFixed(3), 'km');
