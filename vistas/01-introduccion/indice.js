"use strict";

/*
 * Índice del capítulo 1: las partes del recorrido.
 *   - Escritorio: riel de puntos a la derecha (sin números); el punto de la parte actual crece y la línea se
 *     llena con el avance. El nombre de la parte se asoma al pasar el ratón o al llegar a ella.
 *   - Celular: una pastilla arriba («3/4 · Cómo crece») que abre la lista.
 * Las partes son los elementos con data-parte; al tocar una, la página se desliza hasta ella.
 */

(() => {
  const nav = document.getElementById("indice");
  const partes = [...document.querySelectorAll("[data-parte]")].sort((a, b) => a.dataset.parte - b.dataset.parte);
  if (!nav || !partes.length) return;

  nav.innerHTML = `
    <button type="button" class="ix-chip" aria-expanded="false" aria-controls="ix-lista">
      <span class="ix-chip-num"></span><span class="ix-chip-txt"></span>
    </button>
    <ol class="ix-lista" id="ix-lista">
      ${partes
        .map(
          (p) => `<li><a href="#${p.id}" data-ir="${p.dataset.parte}">
            <span class="ix-punto" aria-hidden="true"></span>
            <span class="ix-txt">${p.dataset.parteTitulo}</span>
          </a></li>`
        )
        .join("")}
    </ol>
    <span class="ix-linea" aria-hidden="true"><i></i></span>`;

  const enlaces = [...nav.querySelectorAll("a")];
  const chip = nav.querySelector(".ix-chip");
  const linea = nav.querySelector(".ix-linea i");
  const fin = document.getElementById("continuar");
  let actual = -1;
  let temporizadorAnuncio;

  function irA(i) {
    const destino = partes[i];
    if (!destino) return;
    const reducido = typeof Paleta !== "undefined" && Paleta.movimientoReducido();
    const y = destino.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.12;
    window.scrollTo({ top: Math.max(0, y), behavior: reducido ? "auto" : "smooth" });
    nav.classList.remove("abierto");
    chip.setAttribute("aria-expanded", "false");
  }

  enlaces.forEach((a, i) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      irA(i);
    })
  );
  chip.addEventListener("click", () => {
    const abierto = nav.classList.toggle("abierto");
    chip.setAttribute("aria-expanded", String(abierto));
  });

  function actualizar() {
    const H = window.innerHeight;
    const centro = window.scrollY + H * 0.5;
    const tops = partes.map((p) => p.getBoundingClientRect().top + window.scrollY);
    let i = -1;
    tops.forEach((t, k) => {
      if (t <= centro) i = k;
    });
    // Visible después de la portada y hasta el final del capítulo
    const finTop = fin ? fin.getBoundingClientRect().top + window.scrollY : Infinity;
    nav.classList.toggle("visible", window.scrollY > H * 0.6 && centro < finTop + H * 0.4);

    // Avance dentro del capítulo: de la primera parte al final
    const desde = tops[0];
    const hasta = finTop;
    const avance = Math.min(1, Math.max(0, (centro - desde) / Math.max(1, hasta - desde)));
    linea.style.transform = `scaleY(${avance.toFixed(3)})`;
    nav.style.setProperty("--avance", avance.toFixed(3));

    if (i === actual) return;
    actual = i;
    enlaces.forEach((a, k) => {
      a.classList.toggle("activo", k === i);
      a.classList.toggle("hecho", k < i);
      if (k === i) a.setAttribute("aria-current", "step");
      else a.removeAttribute("aria-current");
    });
    const p = partes[Math.max(0, i)];
    chip.querySelector(".ix-chip-num").textContent = `${Math.max(1, i + 1)}/${partes.length}`;
    chip.querySelector(".ix-chip-txt").textContent = p.dataset.parteTitulo;
    // La etiqueta de la parte nueva se asoma un momento en el riel
    clearTimeout(temporizadorAnuncio);
    enlaces.forEach((a) => a.classList.remove("anuncia"));
    if (enlaces[i]) {
      enlaces[i].classList.add("anuncia");
      temporizadorAnuncio = setTimeout(() => enlaces[i] && enlaces[i].classList.remove("anuncia"), 2600);
    }
    chip.classList.remove("cambio");
    void chip.offsetWidth; // reinicia la animación
    chip.classList.add("cambio");
  }

  let pendiente = false;
  const programar = () => {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(() => {
      pendiente = false;
      actualizar();
    });
  };
  window.addEventListener("scroll", programar, { passive: true });
  window.addEventListener("resize", programar);
  window.addEventListener("load", programar);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("abierto")) {
      nav.classList.remove("abierto");
      chip.setAttribute("aria-expanded", "false");
      chip.focus();
    }
  });
  actualizar();
})();
