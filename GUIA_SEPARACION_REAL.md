# AgroCebada · Separación del frontend por vistas

## Páginas canónicas y responsables
- `vistas/01-introduccion/index.html`: Storytime e introducción. JS: `home.js`, `capitulo2.js`, `factores.js`.
- `vistas/02-territorio/index.html`: mapa 3D, globo, selección y **contenedor de la simulación integrada**. JS: `globo.js`, `navegacion-mapa.js`, `mapa.js` (cargador).
- `vistas/03-crecimiento/`: implementación del campo 3D (`campo.js`, `animacion-campo.js`, `historia-crecimiento.js`) utilizada **dentro del mapa**. `index.html` es una página informativa de acceso; **no es una escena 3D independiente**.
- `vistas/04-clima/`: vista independiente de contenido por desarrollar.
- `vistas/05-preguntas/`: preguntas guía.
- `vistas/06-interpretacion/`: interpretación, destino de cosecha, glosario, referencias.
- `vistas/07-modelo/index.html`: explicación del modelo. El panel de predicción y las llamadas a FastAPI integradas en mapa están en `panel-predicciones.js` y `api-predicciones.js`.
- `vistas/compartido/`: estilos generales, datos de navegador, mascota, navegación, configuración de API y utilidades compartidas.

## Compatibilidad
Los enlaces antiguos `index.html`, `mapa.html`, `modelo.html`, `glosario.html`, `referencias.html` y `recorrido.html` redirigen a las páginas nuevas para conservar marcadores de navegador. **No se debe editar su HTML**: cambiar la página canónica de cada sección.

Se usa `<base href="../../">` en las páginas canónicas para mantener rutas relativas consistentes con el origen del servidor. Servir siempre desde la carpeta `agrocebada/`, nunca abrir archivos con `file://`.

## Separación sin duplicar el mapa
El globo, las parcelas, el crecimiento y las predicciones requieren conservar una misma escena WebGL, selección de parcelas y línea de tiempo. Por eso la pantalla `02-territorio/index.html` monta el conjunto, **pero el código del campo y del modelo reside realmente en sus respectivas carpetas**. La independencia visual total del mapa y el campo requeriría una refactorización adicional del estado de Three.js; dividirlos en HTML separados sin ello rompería las transiciones. Esta entrega no pretende esa independencia todavía.

## Ejecutar
Backend, desde `backend/`: `python -m uvicorn main:app --reload` tras instalar `requirements.txt` en un entorno virtual.
Frontend, desde raíz `agrocebada/`: `python -m http.server 5500`.

- Inicio: http://localhost:5500/vistas/01-introduccion/index.html
- Mapa: http://localhost:5500/vistas/02-territorio/index.html
- Modelo: http://localhost:5500/vistas/07-modelo/index.html
- Recorrido: http://localhost:5500/vistas/recorrido.html

## Colaboración
Cada integrante edita primero su carpeta. Los cambios en `vistas/compartido/`, la pantalla contenedora del mapa o FastAPI se coordinan en una solicitud de integración (pull request). Evitar subir `.venv`, respaldos y archivos locales.
