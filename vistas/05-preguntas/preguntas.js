"use strict";
// Solo controla las respuestas de esta vista. No utiliza archivos del mapa.
document.querySelectorAll(".pregunta button").forEach((boton)=>{
  boton.addEventListener("click",()=>{
    const destino=document.getElementById(boton.getAttribute("aria-controls"));
    const abierto=boton.getAttribute("aria-expanded")==="true";
    destino.hidden=abierto;boton.setAttribute("aria-expanded",String(!abierto));
    boton.textContent=abierto?"Ver explicación":"Ocultar explicación";
  });
});
