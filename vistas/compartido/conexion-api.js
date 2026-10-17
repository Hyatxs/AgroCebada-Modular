
"use strict";

async function conectarBackend() {
  const API_URL = window.AGRO_CONFIG?.API_URL;

  if (!API_URL) {
    throw new Error("No se encontró la configuración de la API");
  }

  // Obtener las parcelas
  const respuestaParcelas = await fetch(
    `${API_URL}/api/parcelas`
  );

  if (!respuestaParcelas.ok) {
    throw new Error(
      `Error al consultar parcelas: ${respuestaParcelas.status}`
    );
  }

  const datosParcelas = await respuestaParcelas.json();

  if (
    !Array.isArray(datosParcelas.parcelas) ||
    datosParcelas.parcelas.length !== 197
  ) {
    throw new Error("La API no devolvió las 197 parcelas esperadas");
  }

  // Obtener las métricas del modelo Ridge
  const respuestaMetricas = await fetch(
    `${API_URL}/api/modelo/metricas`
  );

  if (!respuestaMetricas.ok) {
    throw new Error(
      `Error al consultar métricas: ${respuestaMetricas.status}`
    );
  }

  const datosMetricas = await respuestaMetricas.json();

  if (
    !datosMetricas.metricas ||
    !Number.isFinite(datosMetricas.metricas.rmse) ||
    !Number.isFinite(datosMetricas.metricas.r2) ||
    !Number.isFinite(datosMetricas.metricas.mae) ||
    !Number.isInteger(datosMetricas.metricas.n)
  ) {
    throw new Error("Las métricas recibidas no son válidas");
  }

  // Guardar los datos obtenidos desde Python
  DATA.P = datosParcelas.parcelas;
  window.metricasBackend = datosMetricas.metricas;

  console.log(
    `AgroCebada: ${DATA.P.length} parcelas cargadas desde FastAPI`
  );

  console.log(
    "Métricas del modelo Ridge obtenidas desde Python:",
    window.metricasBackend
  );
}


// Iniciar el mapa cuando el backend esté listo
window.iniciarAgroCebada = async function () {
  try {
    await conectarBackend();

    const script = document.createElement("script");
    script.src = "vistas/02-territorio/mapa.js";

    script.onerror = () => {
      mostrarErrorConexion(
        "No se pudo cargar mapa.js"
      );
    };

    document.body.appendChild(script);

  } catch (error) {
    console.error("Error al iniciar AgroCebada:", error);

    mostrarErrorConexion(
      "No se pudieron cargar los datos desde FastAPI. Revisa el backend."
    );
  }
};


// Mostrar errores en la pantalla de carga
function mostrarErrorConexion(mensajeError) {
  const contador = document.getElementById("loader-count");
  const loader = document.getElementById("loader");

  if (contador) {
    contador.textContent = "Error";
  }

  if (loader) {
    const mensaje = document.createElement("p");
    mensaje.textContent = mensajeError;
    loader.appendChild(mensaje);
  }
}
