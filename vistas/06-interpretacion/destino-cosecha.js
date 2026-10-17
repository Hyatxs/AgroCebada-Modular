"use strict";
/* ------------------------------------------------------------------------ */
/* Destino de la cosecha                                                     */
/* ------------------------------------------------------------------------ */

const DESTINOS = [
  {
    min: 4.5,
    icono: "🍺",
    nombre: "Maltería y cervecería",
    y: 70,
    texto:
      "Con rendimientos altos suele haber granos grandes y parejos: lo que busca la industria maltera para hacer cerveza.",
  },
  {
    min: 3.5,
    icono: "🥣",
    nombre: "Alimento y harinas",
    y: 170,
    texto:
      "Un rendimiento medio va a hojuelas, harinas y alimentos balanceados para animales de granja.",
  },
  {
    min: 0,
    icono: "🐄",
    nombre: "Forraje y paja",
    y: 270,
    texto: "Si la cosecha rinde poco, el grano y la paja terminan como forraje o ensilado para el ganado.",
  },
];

const destinoPara = (rendimiento) => DESTINOS.find((d) => rendimiento >= d.min);

const cosecha = { activa: false, destino: DESTINOS[0], total: 0 };

function dibujarEscenaCosecha() {
  const parcela = parcelas[seleccion];

  const destinos = DESTINOS.map((d) => {
    const activo = d === cosecha.destino;
    return `
      <g opacity="${activo ? 1 : 0.35}">
        <path d="M150,170 C300,170 380,${d.y} 560,${d.y}" fill="none"
              stroke="${activo ? "var(--gold)" : "var(--line)"}" stroke-width="${activo ? 5 : 3}"
              stroke-dasharray="${activo ? "" : "6 8"}" ${activo ? 'id="ruta-activa"' : ""}/>
        <rect x="560" y="${d.y - 34}" width="150" height="68" rx="18" fill="var(--card)"
              stroke="${activo ? "var(--gold)" : "var(--line)"}" stroke-width="${activo ? 3 : 1.5}"/>
        <text x="585" y="${d.y + 12}" font-size="34">${d.icono}</text>
        <text x="630" y="${d.y - 4}" font-size="11" font-weight="700" fill="var(--ink)">${d.nombre.split(" ")[0]}</text>
        <text x="630" y="${d.y + 12}" font-size="11" fill="var(--ink)">${d.nombre.split(" ").slice(1).join(" ")}</text>
      </g>`;
  }).join("");

  $("#cosecha-svg").innerHTML = `
    ${destinos}
    <rect x="20" y="120" width="130" height="100" rx="14" fill="var(--${parcela.p ? "gold" : "green"})" opacity=".85"/>
    <g stroke="var(--sky)" stroke-opacity=".5" stroke-width="2">
      ${[0, 1, 2, 3, 4, 5].map((i) => `<line x1="${34 + i * 20}" y1="128" x2="${34 + i * 20}" y2="212"/>`).join("")}
    </g>
    <text x="85" y="238" text-anchor="middle" font-size="12" fill="var(--ink)">${parcela.id}</text>
    <g id="cosecha-grupo"></g>`;
}

function actualizarCosecha(rendimiento) {
  const parcela = parcelas[seleccion];
  cosecha.destino = destinoPara(rendimiento);
  cosecha.total = rendimiento * parcela.a;

  const camiones = Math.max(1, Math.ceil(cosecha.total / 30));

  $("#cosecha-valor").textContent = `${Util.fmt(rendimiento, 1)} t/ha`;
  $("#cosecha-resumen").textContent =
    `${parcela.id}: ${Util.fmt(rendimiento, 1)} t/ha × ${Util.fmt(parcela.a, 1)} ha ≈ ${Util.fmt(cosecha.total, 1)} toneladas, ` +
    `unos ${camiones} ${camiones === 1 ? "camión" : "camiones"} de ~30 t.`;
  $("#cosecha-texto").innerHTML = `<b>${cosecha.destino.icono} ${cosecha.destino.nombre}.</b> ${cosecha.destino.texto}`;

  dibujarEscenaCosecha();
}

function animarCosecha() {
  if (!cosecha.activa) return;

  const ruta = $("#ruta-activa");
  const grupo = $("#cosecha-grupo");
  if (!ruta || !grupo) return requestAnimationFrame(animarCosecha);

  const largo = ruta.getTotalLength();
  const cantidad = clamp(Math.round(cosecha.total / 2), 6, 28);
  const duracion = Paleta.movimientoReducido() ? 1e9 : 5000;
  const ahora = performance.now();

  let contenido = "";
  for (let i = 0; i < cantidad; i++) {
    const fase = ((ahora / duracion + i / cantidad) % 1) * 1;
    const punto = ruta.getPointAtLength(fase * largo);
    const girando = (ahora / 3 + i * 40) % 360;

    contenido += `<ellipse cx="${punto.x}" cy="${punto.y + Math.sin(fase * 20 + i) * 4}" rx="6" ry="3"
      fill="var(--gold)" stroke="var(--ink)" stroke-width="1" transform="rotate(${girando} ${punto.x} ${punto.y})"/>`;
  }

  const camion = ruta.getPointAtLength(((ahora / duracion) % 1) * largo * 0.95);
  contenido += `<text x="${camion.x - 14}" y="${camion.y - 10}" font-size="26">🚚</text>`;

  grupo.innerHTML = contenido;
  requestAnimationFrame(animarCosecha);
}

function abrirCosecha() {
  const parcela = parcelas[seleccion];
  if (!estaRevelada(parcela)) return;

  const rendimiento = Math.round(clamp(rendimientoNumerico(parcela), 2, 5.6) * 10) / 10;

  $("#cosecha-rend").value = rendimiento;
  $("#modal-cosecha").hidden = false;
  actualizarCosecha(rendimiento);

  cosecha.activa = true;
  animarCosecha();
  $("#cerrar-cosecha").focus();

  Narrador.decir(
    `Así viaja la cosecha de ${parcela.id}. Mueve el control para ver adónde iría con otro rendimiento.`
  );
}

function cerrarCosecha() {
  cosecha.activa = false;
  $("#modal-cosecha").hidden = true;
  $("#ver-cosecha").focus();
}

