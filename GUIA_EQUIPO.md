# AgroCebada — Guía de colaboración

## Qué se preservó

- `index.html`, `mapa.html`, `modelo.html`, `glosario.html` y `referencias.html` conservan sus URLs y diseños.
- `backend/main.py`, `backend/modelo_ridge.py` y `backend/datos/parcelas.json` se conservaron sin modificaciones.
- La API continúa en el puerto 8000; abrir con Live Server en el puerto 5500.
- El mapa 3D y su animación conservan la implementación original: están juntos en `vistas/02-territorio/mapa.js`. La sección `03-crecimiento` es una página nueva que enlaza con el simulador existente; NO es una copia del simulador.
- Se excluyeron `.git/`, `.venv/`, respaldos `mapa-1.js` y `mapa_respaldo.js`, y páginas auxiliares de pruebas del ZIP de distribución. La versión original subida permanece sin cambios.

## Responsabilidades (sugerencia)

| Área | Archivos de trabajo | URL |
|---|---|---|
| 01 Introducción | `vistas/01-introduccion/` | `index.html` |
| 02 Territorio | `vistas/02-territorio/` | `mapa.html` |
| 03 Crecimiento | `vistas/03-crecimiento/` | `vistas/03-crecimiento/index.html` |
| 04 Clima | `vistas/04-clima/` | `vistas/04-clima/index.html` |
| 05 Preguntas | `vistas/05-preguntas/` | `vistas/05-preguntas/index.html` |
| 06 Interpretación | `vistas/06-interpretacion/` | `vistas/06-interpretacion/index.html` |
| 07 Modelo | `vistas/07-modelo/` | `modelo.html` |

Ver `recorrido.html` para abrir las siete secciones.

**Atención:** los módulos 01, 02 y 07 corresponden a páginas actualmente implementadas. El código del crecimiento está actualmente dentro del mapa. Las secciones 03 a 06 tienen páginas de trabajo nuevas (no sustituyen lo aprobado). No se afirma que todas las funcionalidades planeadas existan ya.

## Compartidos: coordinar cambios

`styles.css`, `common.js`, `data.js`, `paises.js`, `estados.js`, `modelo-core.js`, `mascota.js`, `config.js`, `conexion-api.js`, `backend/`.

Evitar editar archivos compartidos en ramas paralelas. Los cambios importantes se integran con pull requests.

## Ejecutar en Windows (CMD)

Terminal 1:

```cmd
cd backend
python -m venv .venv
.venv\Scripts\activate.bat
python -m pip install -r requirements.txt
uvicorn main:app --reload
```

Terminal 2: abrir la carpeta del proyecto en VS Code y ejecutar Live Server sobre `index.html` usando puerto 5500, o servir con `python -m http.server 5500` desde la raíz.

Comprobar:

- `http://127.0.0.1:8000/api/estado`
- `http://localhost:5500/index.html`
- `http://localhost:5500/mapa.html`
- `http://localhost:5500/modelo.html`
- `http://localhost:5500/recorrido.html`

## Git: flujo recomendado

1. No utilizar `git push` directo a `main`.
2. Cada integrante hace una rama propia: `git switch -c vista/04-clima` (ajustar nombre).
3. Editar su carpeta y probar en navegador.
4. `git add vistas/04-clima/` y `git commit -m "Desarrolla sección clima"`.
5. `git push -u origin vista/04-clima` (con permiso de escritura), luego abrir un pull request.
6. Revisar e integrar los cambios una vez que no rompan las páginas existentes.

El ZIP de entrega no incluye `.git`, por lo que es una copia para probar. Para aplicar los cambios al repositorio, hay que trasladarlos a una copia con Git bien configurado; NO reemplazar una carpeta `.git` existente.
