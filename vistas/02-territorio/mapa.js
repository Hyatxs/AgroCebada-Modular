"use strict";
// Entrypoint compatible: se carga después de recibir parcelas y métricas de FastAPI.
// Cada módulo es un script clásico para compartir el estado del mapa sin cambiar su comportamiento.
(async function cargarModulosMapa() {
  const archivos = ["vistas/02-territorio/globo.js", "vistas/07-modelo/api-predicciones.js", "vistas/03-crecimiento/campo.js", "vistas/07-modelo/panel-predicciones.js", "vistas/03-crecimiento/animacion-campo.js", "vistas/compartido/paleta-mapa.js", "vistas/02-territorio/navegacion-mapa.js", "vistas/03-crecimiento/historia-crecimiento.js", "vistas/06-interpretacion/destino-cosecha.js", "vistas/compartido/inicializacion-mapa.js"];
  try {
    for (const ruta of archivos) {
      await new Promise((resolver, rechazar) => {
        const script = document.createElement("script");
        script.src = ruta;
        script.onload = resolver;
        script.onerror = () => rechazar(new Error(`No se pudo cargar ${ruta}`));
        document.body.appendChild(script);
      });
    }
  } catch (error) {
    console.error("Error al inicializar los módulos del mapa:", error);
    const contador = document.getElementById("loader-count");
    if (contador) contador.textContent = "Error";
  }
})();
