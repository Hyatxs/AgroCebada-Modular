"use strict";
/* --- Cómo creció la cebada (sin barra de semanas) ------------------------ */

function fasesDeCrecimiento(zona, nombre) {
  const lista = zonaDe(zona);
  const media = Array.from({ length: 52 }, (_, w) => Modelo.promedio(lista.map((p) => p.n[w])) / 1000);

  let pico = 20;
  for (let w = 20; w <= 48; w++) if (media[w] > media[pico]) pico = w;

  const base = Math.min(...media.slice(14, pico + 1));
  const alcanza = (fraccion) => {
    for (let w = 14; w <= pico; w++) if (media[w] >= base + fraccion * (media[pico] - base)) return w;
    return pico;
  };
  const arranque = alcanza(0.15);
  const medio = alcanza(0.6);

  return [
    {
      desde: 14,
      hasta: arranque,
      texto: `Así creció la cebada en ${nombre}. En la semana ${15}, el campo apenas arranca: se ve mucha tierra y el NDVI promedio es de ${Util.fmt(media[14], 2)}.`,
    },
    {
      desde: arranque,
      hasta: medio,
      texto: `Hacia la semana ${arranque + 1} brotan las plantas, sacan hojas y macollan. El NDVI sube rápido: ya vale ${Util.fmt(media[medio], 2)}.`,
    },
    {
      desde: medio,
      hasta: pico,
      texto: `En la semana ${pico + 1} llega el pico de vigor, con NDVI de ${Util.fmt(media[pico], 2)}. Si una parcela queda por debajo de la curva ideal, sus tallos se doblan: eso es estrés.`,
    },
    {
      desde: pico,
      hasta: 48,
      texto: "Después el grano se llena, la planta se seca y llega la cosecha. Cada parcela cierra el ciclo con un rendimiento distinto.",
    },
  ];
}

async function contarCrecimiento(indice) {
  const sesion = sesionViaje;
  const cancelado = () => sesion !== sesionViaje || vista !== "campo";

  $("#timeline").classList.remove("visible");
  $("#panel").classList.remove("visible");
  semana = 14;
  recalcular = true;
  $("#saltar-explicacion").hidden = false;

  const fases = fasesDeCrecimiento(indice, ESTADOS_OBJETIVO[indice].nombre);

  for (const fase of fases) {
    const hablando = Narrador.decir(fase.texto);
    const avanza = animarSemana(fase.desde, fase.hasta, 4600);
    await Promise.all([hablando, avanza]);
    if (cancelado()) return;
    await Util.esperar(450);
    if (cancelado()) return;
  }

  // Ahora sí: se abre la barra para recapitular
  $("#saltar-explicacion").hidden = true;
  $("#timeline").classList.add("visible");
  $("#panel").classList.add("visible");
  Narrador.decir(
    "Ahora te toca a ti. Mueve la barra de semanas para recapitular, toca una parcela y descubre cómo le fue. Las rayadas son las que debo predecir."
  );
}

function saltarHistoria() {
  sesionViaje++;
  $("#saltar-explicacion").hidden = true;
  if (tweenSemana) {
    const resolver = tweenSemana.resolver;
    tweenSemana = null;
    resolver();
  }
  Narrador.callar();
  semana = 36;
  recalcular = true;
  $("#week-slider").value = semana;
  $("#timeline").classList.add("visible");
  $("#panel").classList.add("visible");
  Narrador.decir("Sin problema. Toca una parcela o mueve la barra de semanas para explorar el campo.");
}

function volverAEstados() {
  sesionViaje++;
  $("#saltar-explicacion").hidden = true;
  Narrador.callar();
  tweenSemana = null;

  $("#wipe").classList.add("on");
  Util.esperar(600).then(() => {
    $("#timeline").classList.remove("visible");
    $("#panel").classList.remove("visible");
    $("#state-markers").hidden = false;
    miradaGlobo.lon = ESTADOS_OBJETIVO[estadoElegido].lon;
    miradaGlobo.lat = ESTADOS_OBJETIVO[estadoElegido].lat;
    miradaGlobo.z = 3.55;
    iniciarEstados();
    $("#wipe").classList.remove("on");
  });
}

