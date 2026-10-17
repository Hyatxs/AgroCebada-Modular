"use strict";
/* ------------------------------------------------------------------------ */
/* Estado del campo, semana y gráfica                                        */
/* ------------------------------------------------------------------------ */

let seleccion = 0;
let hover = -1;
let semana = 14;
let semanaDibujada = -1;
let variableActiva = "n";
let recalcular = true;
let enfocado = false;
let tweenSemana = null;

function eventosEstres(parcela) {
  const referencia = DATA.opt.n;
  const candidatos = [];

  for (let w = 20; w <= 46; w++) {
    const brecha = (referencia[w] - parcela.n[w]) / referencia[w];
    const esMinimoLocal = parcela.n[w] <= parcela.n[w - 1] && parcela.n[w] <= parcela.n[w + 1];

    if (brecha > 0.2 && esMinimoLocal) candidatos.push([w, brecha]);
  }

  return candidatos
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .sort((a, b) => a[0] - b[0])
    .map(([w], k) => ({
      semana: w,
      tipo: TIPOS_ESTRES[(Util.hashTexto(parcela.id) + w + k) % TIPOS_ESTRES.length],
    }));
}

function dibujarGrafica() {
  const parcela = parcelas[seleccion];
  const [min, max] = rangos[variableActiva];
  const referencia = DATA.opt[variableActiva];

  const X = (w) => 10 + (w / 51) * 340;
  const Y = (v) => 140 - ((v - min) / (max - min)) * 125;
  const trazo = (serie) => serie.map((v, i) => `${i ? "L" : "M"}${X(i)},${Y(v)}`).join("");

  const marcasEstres = eventosEstres(parcela)
    .map(
      (e) => `
        <line x1="${X(e.semana)}" x2="${X(e.semana)}" y1="10" y2="140"
              stroke="var(--ink)" stroke-opacity=".3" stroke-dasharray="3 4"/>
        <text x="${X(e.semana) + 3}" y="20" font-size="10" fill="var(--ink)">${e.tipo}*</text>`
    )
    .join("");

  $("#chart").innerHTML = `
    <line x1="10" x2="350" y1="140" y2="140" stroke="var(--line)" stroke-width="2"/>
    <path d="${trazo(referencia)}" fill="none" stroke="var(--green)" stroke-width="3"/>
    ${marcasEstres}
    <path d="${trazo(parcela[variableActiva])}" fill="none" stroke="var(--gold)"
          stroke-width="3.5" stroke-linecap="round"/>
    <line id="chart-now" x1="10" x2="10" y1="10" y2="140" stroke="var(--gold)" stroke-width="2"/>`;

  semanaDibujada = -1;
}

/* --- Panel de la parcela y predicción interactiva ------------------------ */

function cajaPrediccion(parcela) {
  if (!parcela.p) return "";

  if (!estaRevelada(parcela) || !Array.isArray(parcela.aportes)) {
    return `
      <div class="prediccion">
        Esta parcela es de las que el modelo debe predecir.
        <div class="panel-acciones">
          <button id="btn-predecir" class="principal">🔮 Predecir con el modelo</button>
        </div>
      </div>`;
  }

  const margen = modelo.validacion.rmse;
  const maximo = Math.max(...parcela.aportes.map((a) => Math.abs(a.aporte)), 0.01);
  const filas = parcela.aportes
    .slice(0, 3)
    .map((a) => {
      const ancho = Math.round((Math.abs(a.aporte) / maximo) * 100);
      const signo = a.aporte >= 0 ? "+" : "−";

      return `
        <div class="aporte">
          <span>${a.nombre}</span>
          <span><div class="barra-aporte ${a.aporte < 0 ? "neg" : ""}" style="width:${ancho}%"></div>
          ${signo}${Util.fmt(Math.abs(a.aporte), 2)}</span>
        </div>`;
    })
    .join("");

  return `
    <div class="prediccion">
      Predicción del modelo
      <div class="valor" id="valor-pred">${Util.fmt(parcela.pred, 2)} <small>t/ha</small></div>
      <small>Margen típico ±${Util.fmt(margen, 2)} t/ha · R² ${Util.fmt(modelo.validacion.r2, 2)}
      (validación cruzada)</small>
      <div style="margin-top:6px">Lo que más pesó (t/ha):</div>
      ${filas}
    </div>`;
}

function seleccionar(indice, anunciar) {
  seleccion = indice;
  uniformes.uSel.value = indice;
  uniformesSuelo.uSel.value = indice;

  const parcela = parcelas[indice];
  const eventos = eventosEstres(parcela);
  const sueloTipo = TIPOS_SUELO[Util.hashTexto(parcela.id) % TIPOS_SUELO.length];
  const etiqueta = parcela.p
    ? '<b style="color: var(--gold)">Por predecir</b>'
    : '<b style="color: var(--green)">Rendimiento conocido</b>';
  const estres = eventos.length
    ? " · Estrés*: " + eventos.map((e) => `${e.tipo} sem. ${e.semana + 1}`).join(", ")
    : "";

  const rendimiento = estaRevelada(parcela) ? `${Util.fmt(rendimientoNumerico(parcela), 2)} t/ha` : "? t/ha";

  $("#panel-title").textContent = `${parcela.id} · ${rendimiento}`;
  $("#panel-info").innerHTML = `${etiqueta} · ${Util.fmt(parcela.a, 2)} ha<br>
    <small>Suelo INEGI*: ${sueloTipo}${estres}<br>* simulado</small>`;
  $("#prediccion-caja").innerHTML = cajaPrediccion(parcela);
  $("#ver-cosecha").disabled = !estaRevelada(parcela);

  const botonPredecir = $("#btn-predecir");
  if (botonPredecir) botonPredecir.addEventListener("click", () => predecirParcela(indice));

  dibujarGrafica();

  if (anunciar) {
    const picos = eventos.length
      ? `Tuvo ${eventos.length} picos de estrés.`
      : "No tuvo picos de estrés importantes.";

    if (parcela.p && !estaRevelada(parcela)) {
      Narrador.decir(
        `${parcela.id} mide ${Util.fmt(parcela.a, 1)} hectáreas y es de las que el modelo debe predecir. ¡Toca «Predecir» para ver su estimación!`
      );
    } else {
      const verbo = parcela.p ? "el modelo predice" : "rindió";
      Narrador.decir(
        `${parcela.id}: ${verbo} ${Util.fmt(rendimientoNumerico(parcela), 2)} toneladas por hectárea, en ${Util.fmt(parcela.a, 1)} hectáreas. ${picos}`
      );
    }
  }
}

async function predecirParcela(indice) {
  const parcela = parcelas[indice];
  if (!parcela || !parcela.p || estaRevelada(parcela)) return;

  const boton = $("#btn-predecir");
  if (boton) boton.disabled = true;
  $("#prediccion-caja").innerHTML = '<div class="prediccion">Consultando modelo en Python…</div>';

  try {
    const datos = await solicitarPrediccion(parcela.id);
    aplicarPrediccion(parcela, datos);
    console.log(`Predicción obtenida de FastAPI: ${parcela.id}`, datos);
    mascota.saltito();
    await Util.esperar(Paleta.movimientoReducido() ? 50 : 900);

    recalcular = true;
    actualizarBotonPredecir();
    if (parcelas[indice] !== parcela || seleccion !== indice) return;
    seleccionar(indice, false);

    const elemento = $("#valor-pred");
    if (elemento && elemento.firstChild) {
      const inicio = performance.now();
      const animarNumero = (ahora) => {
        const k = clamp((ahora - inicio) / 800, 0, 1);
        if (seleccion === indice && parcelas[indice] === parcela && elemento.isConnected) {
          elemento.firstChild.textContent = Util.fmt(
            mezcla(2, parcela.pred, 1 - Math.pow(1 - k, 3)), 2
          ) + " ";
          if (k < 1) requestAnimationFrame(animarNumero);
        }
      };
      requestAnimationFrame(animarNumero);
    }

    Narrador.decir(`El modelo en Python estima ${Util.fmt(parcela.pred, 2)} toneladas por hectárea para ${parcela.id}.`);
  } catch (error) {
    console.error(`No se pudo predecir ${parcela.id}:`, error);
    if (parcelas[indice] === parcela && seleccion === indice) {
      seleccionar(indice, false);
      const caja = $("#prediccion-caja");
      const mensaje = document.createElement("small");
      mensaje.textContent = "No se pudo consultar FastAPI. Revisa el servidor e intenta nuevamente.";
      caja.appendChild(mensaje);
    }
  }
}

function pendientesDeZona() {
  return parcelas.filter((p) => p.p && !estaRevelada(p));
}

function actualizarBotonPredecir() {
  const total = parcelas.filter((p) => p.p).length;
  const pendientes = pendientesDeZona().length;
  const boton = $("#predecir-todas");

  boton.textContent = pendientes ? `Predecir las ${pendientes} pendientes` : `Las ${total} ya están predichas ✓`;
  boton.disabled = pendientes === 0 || prediccionMasivaActiva;
}


async function predecirTodas() {
  const pendientes = pendientesDeZona();
  if (!pendientes.length) return;

  const boton = $("#predecir-todas");
  boton.disabled = true;
  boton.textContent = "Consultando Python...";

  try {
    const respuesta = await fetch(
      `${API_PREDICCIONES}/lote`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ids: pendientes.map(p => p.id)
        })
      }
    );

    if (!respuesta.ok) {
      throw new Error(`Error HTTP ${respuesta.status}`);
    }

    const datos = await respuesta.json();

    if (
      !Array.isArray(datos.predicciones) ||
      datos.predicciones.length !== pendientes.length
    ) {
      throw new Error("Respuesta incompleta del backend");
    }

    const resultados = new Map(
      datos.predicciones.map(p => [p.id, p])
    );

    for (const parcela of pendientes) {
      const resultado = resultados.get(parcela.id);

      if (
        !resultado ||
        resultado.tipo !== "prediccion" ||
        !Number.isFinite(resultado.rendimiento_estimado) ||
        !Array.isArray(resultado.contribuciones)
      ) {
        throw new Error(
          `Predicción inválida para ${parcela.id}`
        );
      }
    }

    mascota.saltito();

    for (const parcela of pendientes) {
      const resultado = resultados.get(parcela.id);

      parcela.pred = resultado.rendimiento_estimado;
      parcela.aportes = resultado.contribuciones;

      reveladas.add(parcela.id);
    }

    recalcular = true;
    actualizarBotonPredecir();
    seleccionar(seleccion, false);

    const valores = parcelas
      .filter(p => p.p && Number.isFinite(p.pred))
      .map(p => p.pred);

    const promedio = Modelo.promedio(valores);

    Narrador.decir(
      `Listo: ${pendientes.length} nuevas predicciones desde Python. ` +
      `Los rendimientos estimados van de ` +
      `${Util.fmt(Math.min(...valores), 1)} a ` +
      `${Util.fmt(Math.max(...valores), 1)} toneladas por hectárea, ` +
      `con un promedio de ${Util.fmt(promedio, 1)}.`
    );

    console.log(
      "Predicciones masivas obtenidas desde FastAPI:",
      datos
    );

  } catch (error) {
    console.error("Error en predicción masiva:", error);

    Narrador.decir(
      "No pude consultar las predicciones. Revisa la conexión con Python e inténtalo nuevamente."
    );

  } finally {
    actualizarBotonPredecir();
  }
}


function crearBotonesDeVariable() {
  const contenedor = $("#var-chips");

  VARIABLES.forEach(({ clave, nombre }) => {
    const boton = document.createElement("button");
    boton.textContent = nombre;
    boton.classList.toggle("active", clave === variableActiva);
    boton.addEventListener("click", () => {
      variableActiva = clave;
      $$("button", contenedor).forEach((b) => b.classList.toggle("active", b === boton));
      dibujarGrafica();
    });
    contenedor.appendChild(boton);
  });
}

