"use strict";
/* ------------------------------------------------------------------------ */
/* Datos de las parcelas                                                     */
/* ------------------------------------------------------------------------ */

const VARIABLES = [
  { clave: "n", nombre: "NDVI" },
  { clave: "e", nombre: "EVI" },
  { clave: "l", nombre: "LAI" },
  { clave: "f", nombre: "FAPAR" },
  { clave: "d", nombre: "DSWI" },
];
const TIPOS_ESTRES = ["Hídrico", "Térmico", "Helada", "Plaga", "Incendio"];
const TIPOS_SUELO = ["Vertisol", "Feozem", "Regosol", "Cambisol", "Luvisol"];

const MAX_PARCELAS = 66;

// Rango global de cada variable, para que la gráfica no cambie de escala
const rangos = {};
VARIABLES.forEach(({ clave }) => {
  let min = Infinity;
  let max = -Infinity;

  DATA.P.forEach((parcela) => {
    parcela[clave].forEach((valor) => {
      min = Math.min(min, valor);
      max = Math.max(max, valor);
    });
  });
  rangos[clave] = [min, max];
});

function muestrear(serie, semanaActual) {
  const i = Math.min(50, Math.floor(semanaActual));
  return serie[i] + (serie[i + 1] - serie[i]) * (semanaActual - i);
}

const zonaDe = (zona) => DATA.P.slice(zona * MAX_PARCELAS, (zona + 1) * MAX_PARCELAS);

/* --- Modelo (se calcula una vez, en el navegador) ------------------------- */

const modelo = {
  validacion: window.metricasBackend,
};

const API_PREDICCIONES = `${window.AGRO_CONFIG.API_URL}/api/predicciones`;
const resultadosPython = new Map();
const solicitudesActivas = new Map();
const reveladas = new Set();
const rendimientoVisual = Modelo.promedio(DATA.P.filter((p) => !p.p).map((p) => p.y));
let prediccionMasivaActiva = false;

const estaRevelada = (parcela) => !parcela.p || (reveladas.has(parcela.id) && Number.isFinite(parcela.pred));
// Rendimiento provisional exclusivamente para el alto de los tallos 3D.
const rendimientoNumerico = (parcela) => parcela.p
  ? (Number.isFinite(parcela.pred) ? parcela.pred : rendimientoVisual)
  : parcela.y;

async function solicitarPrediccion(idParcela) {
  if (resultadosPython.has(idParcela)) return resultadosPython.get(idParcela);
  if (solicitudesActivas.has(idParcela)) return solicitudesActivas.get(idParcela);

  const solicitud = (async () => {
    const respuesta = await fetch(`${API_PREDICCIONES}/${encodeURIComponent(idParcela)}`);
    if (!respuesta.ok) throw new Error(`FastAPI respondió HTTP ${respuesta.status}`);
    const datos = await respuesta.json();
    if (datos.id !== idParcela || datos.tipo !== "prediccion" ||
        !Number.isFinite(datos.rendimiento_estimado) ||
        !Array.isArray(datos.contribuciones) || datos.contribuciones.length !== 7 ||
        !datos.contribuciones.every((a) => Number.isFinite(a.aporte))) {
      throw new Error(`Respuesta inválida de FastAPI para ${idParcela}`);
    }
    resultadosPython.set(idParcela, datos);
    return datos;
  })();
  solicitudesActivas.set(idParcela, solicitud);
  try {
    return await solicitud;
  } finally {
    solicitudesActivas.delete(idParcela);
  }
}

function aplicarPrediccion(parcela, datos) {
  parcela.pred = datos.rendimiento_estimado;
  parcela.aportes = datos.contribuciones;
  reveladas.add(parcela.id);
}

