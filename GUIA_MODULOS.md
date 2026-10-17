# AgroCebada — separación real para trabajo en equipo

## Lo que **sí** se separó

`mapa.js` (antes ~2200 líneas) ahora solo carga módulos independientes y secuenciales. El código real reside en:

| Carpeta | Archivos / alcance |
|---|---|
| `vistas/01-introduccion/` | `home.js`, `capitulo2.js`, `factores.js`, estilos propios |
| `vistas/02-territorio/` | `globo.js`, `navegacion-mapa.js`, entrada `mapa.js` |
| `vistas/03-crecimiento/` | `campo.js`, `animacion-campo.js`, `historia-crecimiento.js` |
| `vistas/04-clima/` | Vista de trabajo y estilos propios (todavía en desarrollo) |
| `vistas/05-preguntas/` | Vista y lógica de preguntas (en desarrollo) |
| `vistas/06-interpretacion/` | `destino-cosecha.js` (simulación didáctica) y vista de interpretación |
| `vistas/07-modelo/` | `modelo.js`, `api-predicciones.js`, `panel-predicciones.js` |
| `vistas/compartido/` | `paleta-mapa.js`, `inicializacion-mapa.js` |

## Compatibilidad conservada

- `index.html`, `mapa.html`, `modelo.html` mantienen sus rutas originales.
- `conexion-api.js` sigue cargando `vistas/02-territorio/mapa.js` **después** de recibir los datos de FastAPI.
- El backend conserva los endpoints existentes y no se modificó.
- `styles.css`, `common.js`, `mascota.js`, `data.js`, `modelo-core.js`, `paises.js`, `estados.js` siguen compartidos. No los modifiquen simultáneamente sin coordinar.
- Los módulos del mapa utilizan **scripts clásicos** (no ES modules); sus variables globales léxicas y callbacks funcionan por carga secuencial. **No agreguen `type=module`, no reordenen las rutas** sin comprobar dependencias.
- Cada carpeta incluye `estilos.css` para que nuevas reglas específicas no se agreguen al CSS general. El CSS antiguo aún está en `styles.css` para conservar el aspecto aprobado.

## Límites de esta primera extracción

La estructura HTML del campo y del mapa permanece en `mapa.html`, y el CSS existente sigue en `styles.css`. Separarlos también, junto con su carga dinámica, implica una refactorización de plantillas y estilos más extensa. La extracción realizada separa **el código JavaScript real** de los ámbitos de trabajo sin rediseñar esas pantallas. Las secciones nuevas 4–6 no deben presentarse como funcionalidades terminadas.

## Trabajo con Git

Una rama por sección, por ejemplo `vista/crecimiento`. Los cambios en archivos compartidos deben revisarse mediante pull request. Nunca subir `.venv`, credenciales ni archivos temporales. Evitar `git push` directo a `main` si hay varias personas trabajando.

## Probar localmente

1. `cd backend`, crear `.venv`, instalar `requirements.txt`, `uvicorn main:app --reload`.
2. Desde la raíz del frontend: `python -m http.server 5500`.
3. Abrir `http://localhost:5500/index.html`, `mapa.html` y `modelo.html`.
4. Comprobar globo, campo, selección de parcela, GET predicción y POST por lote en Network.
5. Abrir `recorrido.html` para las siete secciones.
