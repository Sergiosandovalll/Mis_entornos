/* ==========================================================================
   app.js
   Lógica principal del simulador de buzón tipo Outlook Web.

   IMPORTANTE — compatibilidad de selectores con el robot de UiPath
   (proyecto Buzon_PortalHipotecas_Simulacion). Ver README.md para el
   listado completo de ids. Resumen:
     - Cada correo de la lista:      <div id="email-item-<id>">
     - Botón "Responder a todos":    <button id="btn-responder-todos">
     - Cuadro de texto de respuesta: <textarea id="reply-textbox">
     - Botón de enviar:              <button id="btn-enviar">
     - Elemento enviado:             <div id="sent-item-<id>">
     - Título de la pestaña:         "Simulación Outlook Web*"
   ========================================================================== */

// ---------------------------------------------------------------------------
// Estado global
// ---------------------------------------------------------------------------
let bandejaEntrada = [];   // correos en la bandeja de entrada
let elementosEnviados = []; // correos ya respondidos (carpeta "Enviados")
let siguienteId = 1;
let idSeleccionado = null;
let carpetaActual = "inbox"; // "inbox" | "sent"

// ---------------------------------------------------------------------------
// Inicialización
// ---------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  poblarBandejaCaso2();
  render();
  vincularEventos();
});

function poblarBandejaCaso2() {
  const caso2 = obtenerCaso(2);
  const lote = caso2.generador(); // array sin ids
  bandejaEntrada = lote.map((correo) => ({
    ...correo,
    id: siguienteId++,
    leido: false,
  }));
}

function resetearBandeja() {
  bandejaEntrada = [];
  elementosEnviados = [];
  idSeleccionado = null;
  siguienteId = 1;
  poblarBandejaCaso2();
  carpetaActual = "inbox";
  render();
  mostrarToast("Bandeja regenerada con un nuevo lote de correos del Caso 2.");
}

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------
function vincularEventos() {
  document.getElementById("folder-inbox").addEventListener("click", () => cambiarCarpeta("inbox"));
  document.getElementById("folder-sent").addEventListener("click", () => cambiarCarpeta("sent"));

  document.getElementById("btn-reset-bandeja").addEventListener("click", resetearBandeja);

  document.getElementById("btn-panel-casos").addEventListener("click", abrirModalCasos);
  document.getElementById("btn-cerrar-modal").addEventListener("click", cerrarModalCasos);
  document.getElementById("modal-overlay").addEventListener("click", (e) => {
    if (e.target.id === "modal-overlay") cerrarModalCasos();
  });

  document.getElementById("btn-responder-todos").addEventListener("click", mostrarBloqueRespuesta);
  document.getElementById("btn-responder").addEventListener("click", mostrarBloqueRespuesta);
  document.getElementById("btn-descartar-respuesta").addEventListener("click", ocultarBloqueRespuesta);
  document.getElementById("btn-enviar").addEventListener("click", enviarRespuesta);
}

function cambiarCarpeta(carpeta) {
  carpetaActual = carpeta;
  idSeleccionado = null;
  document.getElementById("folder-inbox").classList.toggle("active", carpeta === "inbox");
  document.getElementById("folder-sent").classList.toggle("active", carpeta === "sent");
  render();
}

// ---------------------------------------------------------------------------
// Render principal
// ---------------------------------------------------------------------------
function render() {
  renderListaCorreos();
  renderPanelLectura();
  renderContadores();
}

function renderContadores() {
  const noLeidos = bandejaEntrada.filter((c) => !c.leido).length;
  document.getElementById("inbox-unread-count").textContent = noLeidos > 0 ? noLeidos : "";
  document.getElementById("sent-count").textContent = elementosEnviados.length > 0 ? elementosEnviados.length : "";
}

function renderListaCorreos() {
  const lista = document.getElementById("email-list");
  const titulo = document.getElementById("list-title");
  const subtitulo = document.getElementById("list-subtitle");
  lista.innerHTML = "";

  if (carpetaActual === "inbox") {
    titulo.textContent = "Bandeja de entrada";
    subtitulo.textContent = `${bandejaEntrada.length} correo(s) — Caso 2 (mailer-daemon) en simulación`;

    if (bandejaEntrada.length === 0) {
      lista.innerHTML = `<div class="email-list-empty">No hay correos. Pulsa "Generar más / Resetear bandeja".</div>`;
      return;
    }

    bandejaEntrada.forEach((correo) => {
      lista.appendChild(crearFilaCorreo(correo));
    });
  } else {
    titulo.textContent = "Elementos enviados";
    subtitulo.textContent = `${elementosEnviados.length} correo(s) enviado(s)`;

    if (elementosEnviados.length === 0) {
      lista.innerHTML = `<div class="email-list-empty">Todavía no se ha enviado ninguna respuesta.</div>`;
      return;
    }

    elementosEnviados.forEach((enviado) => {
      lista.appendChild(crearFilaEnviado(enviado));
    });
  }
}

function crearFilaCorreo(correo) {
  const div = document.createElement("div");
  div.id = `email-item-${correo.id}`;
  // Nota: deliberadamente NO se añade ninguna clase que delate si el
  // correo es mailer-daemon o no (ni color, ni badge) — el objetivo del
  // simulador es comprobar si el robot lo identifica solo, sin pistas
  // visuales. Esa información solo está disponible en el "Panel de casos".
  div.className = "email-item" + (correo.leido ? "" : " unread");
  if (correo.id === idSeleccionado) div.classList.add("selected");
  div.dataset.emailId = correo.id;

  const inicial = (correo.fromName || correo.from || "?").trim().charAt(0).toUpperCase();
  const preview = correo.body.replace(/\s+/g, " ").trim().slice(0, 90);

  div.innerHTML = `
    <div class="email-item-avatar">${inicial}</div>
    <div class="email-item-main">
      <div class="email-item-top">
        <span class="email-item-from" id="email-from-${correo.id}">${escapeHtml(correo.fromName)} &lt;${escapeHtml(correo.from)}&gt;</span>
        <span class="email-item-date">${formatearFecha(correo.fecha)}</span>
      </div>
      <div class="email-item-subject" id="email-subject-${correo.id}">${escapeHtml(correo.subject)}</div>
      <div class="email-item-preview">${escapeHtml(preview)}${correo.body.length > 90 ? "…" : ""}</div>
      <div id="email-body-${correo.id}" hidden>${escapeHtml(correo.body)}</div>
    </div>
  `;

  div.addEventListener("click", () => seleccionarCorreo(correo.id));
  return div;
}

function crearFilaEnviado(enviado) {
  const div = document.createElement("div");
  div.id = `sent-item-${enviado.id}`;
  div.className = "email-item";

  div.innerHTML = `
    <div class="email-item-avatar">Y</div>
    <div class="email-item-main">
      <div class="email-item-top">
        <span class="email-item-from">Para: ${escapeHtml(enviado.to)}</span>
        <span class="email-item-date">${formatearFecha(enviado.fecha)}</span>
      </div>
      <div class="email-item-subject">RE: ${escapeHtml(enviado.subject)}</div>
      <div class="email-item-preview">${escapeHtml(enviado.body.replace(/\s+/g, " ").trim().slice(0, 90))}</div>
    </div>
  `;
  return div;
}

function seleccionarCorreo(id) {
  idSeleccionado = id;
  const correo = bandejaEntrada.find((c) => c.id === id);
  if (correo) correo.leido = true;
  ocultarBloqueRespuesta();
  render();
}

// ---------------------------------------------------------------------------
// Panel de lectura
// ---------------------------------------------------------------------------
function renderPanelLectura() {
  const vacio = document.getElementById("reading-pane-empty");
  const contenido = document.getElementById("reading-pane-content");

  const correo = carpetaActual === "inbox"
    ? bandejaEntrada.find((c) => c.id === idSeleccionado)
    : null;

  const btnResponder = document.getElementById("btn-responder");
  const btnResponderTodos = document.getElementById("btn-responder-todos");
  const btnReenviar = document.getElementById("btn-reenviar");

  if (!correo) {
    vacio.hidden = false;
    contenido.hidden = true;
    btnResponder.disabled = true;
    btnResponderTodos.disabled = true;
    btnReenviar.disabled = true;
    return;
  }

  vacio.hidden = true;
  contenido.hidden = false;
  btnResponder.disabled = false;
  btnResponderTodos.disabled = false;
  btnReenviar.disabled = false;

  document.getElementById("rp-subject-display").textContent = correo.subject;
  document.getElementById("rp-avatar").textContent = (correo.fromName || correo.from || "?").trim().charAt(0).toUpperCase();
  document.getElementById("rp-from-name").textContent = correo.fromName;
  document.getElementById("rp-from-email").textContent = `<${correo.from}>`;
  document.getElementById("rp-to").textContent = correo.to;
  document.getElementById("rp-date").textContent = formatearFecha(correo.fecha, true);
  document.getElementById("rp-body").textContent = correo.body;

  // Elementos de compatibilidad (espejo del correo seleccionado)
  document.getElementById("rp-from-compat").textContent = correo.from;
  document.getElementById("rp-subject-compat").textContent = correo.subject;
  document.getElementById("rp-body-compat").textContent = correo.body;

  document.getElementById("reply-to-hint").textContent = `Para: ${correo.from}`;
}

function mostrarBloqueRespuesta() {
  if (idSeleccionado === null) return;
  const bloque = document.getElementById("reply-block");
  bloque.hidden = false;
  document.getElementById("reply-textbox").value = "";
  document.getElementById("reply-textbox").focus();
}

function ocultarBloqueRespuesta() {
  const bloque = document.getElementById("reply-block");
  if (bloque) bloque.hidden = true;
}

function enviarRespuesta() {
  const correo = bandejaEntrada.find((c) => c.id === idSeleccionado);
  if (!correo) return;

  const texto = document.getElementById("reply-textbox").value.trim();
  if (!texto) {
    mostrarToast("Escribe una respuesta antes de enviar.");
    return;
  }

  elementosEnviados.push({
    id: correo.id,
    to: correo.from,
    subject: correo.subject,
    body: texto,
    fecha: new Date(),
  });

  ocultarBloqueRespuesta();
  mostrarToast(`Respuesta enviada a ${correo.from}.`);
  render();
}

// ---------------------------------------------------------------------------
// Modal — Panel de casos
// ---------------------------------------------------------------------------
function abrirModalCasos() {
  const cuerpo = document.getElementById("modal-body");

  if (bandejaEntrada.length === 0) {
    cuerpo.innerHTML = `<p>No hay correos en la bandeja actualmente.</p>`;
  } else {
    const filas = bandejaEntrada
      .map((c) => {
        const casoInfo = c.caso ? obtenerCaso(c.caso) : null;
        const pillClase = c.esMailerDaemon ? "md" : "otro";
        const pillTexto = c.esMailerDaemon ? `Caso ${c.caso}` : "Sin caso (control)";
        return `
          <tr>
            <td><strong>#${c.id}</strong></td>
            <td>${escapeHtml(c.fromName)}<br><span style="color:var(--gris-texto-suave)">${escapeHtml(c.from)}</span></td>
            <td>${escapeHtml(c.subject)}</td>
            <td><span class="caso-pill ${pillClase}">${pillTexto}</span>${casoInfo ? `<div style="margin-top:4px">${escapeHtml(casoInfo.nombre)}</div>` : ""}</td>
            <td>${escapeHtml(c.comportamientoEsperado)}</td>
          </tr>
        `;
      })
      .join("");

    cuerpo.innerHTML = `
      <p style="font-size:12.5px;color:var(--gris-texto-suave)">
        Referencia rápida para comparar, tras una prueba del robot, si actuó
        correctamente con cada correo de la bandeja actual.
      </p>
      <table class="caso-tabla">
        <thead>
          <tr>
            <th>ID</th>
            <th>Remitente</th>
            <th>Asunto</th>
            <th>Caso esperado</th>
            <th>Comportamiento correcto del robot</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    `;
  }

  document.getElementById("modal-overlay").hidden = false;
}

function cerrarModalCasos() {
  document.getElementById("modal-overlay").hidden = true;
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
function escapeHtml(str) {
  if (str === undefined || str === null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatearFecha(fecha, larga) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  const opciones = larga
    ? { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" };
  return d.toLocaleString("es-ES", opciones);
}

let toastTimeout = null;
function mostrarToast(mensaje) {
  const toast = document.getElementById("toast");
  toast.textContent = mensaje;
  toast.hidden = false;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.hidden = true;
  }, 3200);
}
