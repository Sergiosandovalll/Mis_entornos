/* ==========================================================================
   generador-caso2.js
   Generador de correos de prueba para el CASO 2 — Mailer-daemon.

   Genera:
     - 8 a 10 correos de rebote automático (mailer-daemon), variados en
       remitente, asunto y cuerpo.
     - 2 a 3 correos de control que NO son mailer-daemon (clientes reales
       preguntando por su hipoteca), para comprobar que el robot no los
       confunde con Caso 2.

   Cada correo generado tiene la forma:
     {
       from: "mailer-daemon@bancsabadell.com",
       fromName: "Mail Delivery Subsystem",
       to: "portalhipotecas@bancsabadell.com",
       subject: "...",
       body: "...",
       fecha: Date,
       caso: 2,                 // id del caso esperado (o null si no aplica)
       esMailerDaemon: true,    // atajo usado solo por el panel de casos
       comportamientoEsperado: "..." // texto para el panel de casos
     }
   ========================================================================== */

const MD_REMITENTES = [
  { email: "mailer-daemon@bancsabadell.com", nombre: "Mail Delivery Subsystem" },
  { email: "MAILER-DAEMON@mta-out01.bancsabadell.com", nombre: "Mail Delivery Subsystem" },
  { email: "postmaster@bancsabadell.com", nombre: "Postmaster" },
  { email: "postmaster@correo-externo.es", nombre: "Sistema de entrega de correo" },
  { email: "mailer-daemon@outlook.com", nombre: "Mail Delivery System" },
  { email: "MAILER-DAEMON@relay03.gibobs.com", nombre: "Mail Delivery Subsystem" },
  { email: "postmaster@protonmail.com", nombre: "Postmaster" },
  { email: "mailer-daemon@ext-smtp.bancsabadell.com", nombre: "Mail Delivery Subsystem" },
];

const MD_ASUNTOS = [
  "Undelivered Mail Returned to Sender",
  "Mail delivery failed: returning message to sender",
  "Entrega no realizada: devolución del mensaje al remitente",
  "Returned mail: see transcript for details",
  "No se pudo entregar el mensaje",
  "Delivery Status Notification (Failure)",
  "Aviso de entrega no realizada",
  "Undeliverable: mensaje devuelto",
];

// Direcciones "destino" ficticias a las que supuestamente no se pudo
// entregar el mensaje original (aparecen dentro del cuerpo del rebote).
const MD_DESTINOS_FALLIDOS = [
  "antiguo.cliente@dominio-caducado.com",
  "jgarcia_particular@correoinexistente.net",
  "buzon.baja@empresa-cerrada.es",
  "contacto@servidor-no-disponible.com",
  "info@dominio-erroneo.org",
  "recepcion@buzonlleno.com",
  "notificaciones@dominio-desconocido.es",
  "cliente.antiguo@servidorcaido.net",
];

const MD_CUERPOS = [
  (destino) =>
`This is the mail system at host mx1.bancsabadell.com.

I'm sorry to have to inform you that your message could not be
delivered to one or more recipients. It's attached below.

For further assistance, please send mail to postmaster.

<${destino}>: host smtp.dominio-caducado.com[203.0.113.42] said:
550 5.1.1 The email account that you tried to reach does not exist.
Please try double-checking the recipient's email address for typos
or unnecessary spaces. (in reply to RCPT TO command)

Reporting-MTA: dns; mx1.bancsabadell.com
Final-Recipient: rfc822; ${destino}
Action: failed
Status: 5.1.1
Diagnostic-Code: smtp; 550 5.1.1 User unknown`,

  (destino) =>
`Estimado usuario,

El sistema de entrega de correo le informa de que el siguiente mensaje
no pudo ser entregado a uno o más destinatarios:

  Destinatario: ${destino}
  Motivo: buzón inexistente o dominio no disponible

Este es un mensaje generado automáticamente. Por favor, no responda a
esta dirección.

--
Sistema de entrega de correo
bancsabadell.com`,

  (destino) =>
`Delivery has failed to these recipients or groups:

${destino}
Your message wasn't delivered because the recipient's email provider
rejected it. The email provider's servers or spam filters may block
this recipient's account until the sender is added to their approved
list.

Diagnostic information for administrators:

Generating server: mta-out01.bancsabadell.com

${destino}
Remote Server returned '550 5.4.1 Recipient address rejected: Access
denied'

Original message headers:
Received: from portalhipotecas@bancsabadell.com`,

  (destino) =>
`This is an automatically generated Delivery Status Notification.

THIS IS A WARNING MESSAGE ONLY.
YOU DO NOT NEED TO RESEND YOUR MESSAGE.

Delivery to the following recipient has been delayed:

    ${destino}

Message will be retried for 2 more day(s). If delivery is still not
successful, the message will be returned to you and no further
delivery attempts will be made.`,

  (destino) =>
`Se ha producido un error al intentar entregar su mensaje.

>>> ${destino}
<<< 550 5.1.1 <${destino}>: Recipient address rejected: User unknown
in virtual mailbox table

Este mensaje ha sido generado automáticamente por el servidor de
correo. No es necesario responder.

Reporting-MTA: dns; relay03.gibobs.com
Final-Recipient: rfc822; ${destino}
Action: failed
Status: 5.1.1`,

  (destino) =>
`Hi. This is the qmail-send program at mx2.correo-externo.es.
I'm afraid I wasn't able to deliver your message to the following
addresses. This is a permanent error; I've given up.

<${destino}>:
Sorry, no mailbox here by that name. (#5.1.1)

--- Below this line is a copy of the message.`,
];

// Correos "normales" de control — NO son mailer-daemon. Sirven para
// comprobar que el robot no los ignora ni los confunde con Caso 2.
const CONTROL_NO_MD = [
  {
    from: "maria.lopez83@gmail.com",
    fromName: "María López",
    subject: "Consulta sobre el estado de mi hipoteca",
    body:
`Buenos días,

Escribo para saber en qué punto se encuentra el estudio de mi
hipoteca, ya que hace unos días subí la documentación solicitada y
todavía no he recibido novedades.

¿Podrían indicarme el estado actual?

Gracias de antemano,
María López`,
  },
  {
    from: "jrodriguez.colaborador@inmobiliariaejemplo.es",
    fromName: "Javier Rodríguez",
    subject: "Duda sobre operación de cliente compartido",
    body:
`Hola,

Soy agente inmobiliario y tengo un cliente derivado a través de
vuestra plataforma. Quería preguntar si hay alguna novedad sobre su
expediente antes de la próxima cita con él.

Un saludo,
Javier`,
  },
  {
    from: "carlos.fernandez.92@hotmail.com",
    fromName: "Carlos Fernández",
    subject: "Documentación adicional para mi solicitud",
    body:
`Buenas tardes,

¿Podrían confirmarme si les ha llegado bien el último documento que
envié la semana pasada? Quiero asegurarme de que todo está en orden
antes de la firma.

Un saludo,
Carlos`,
  },
];

/**
 * Baraja un array (Fisher-Yates) sin mutar el original.
 */
function _barajar(array) {
  const copia = [...array];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function _fechaAleatoriaReciente() {
  const ahora = Date.now();
  const haceMs = Math.floor(Math.random() * 1000 * 60 * 60 * 72); // hasta 72h atrás
  return new Date(ahora - haceMs);
}

/**
 * Genera un lote de correos de prueba del Caso 2 (mailer-daemon) mezclado
 * con 2-3 correos de control que no son mailer-daemon.
 *
 * @param {number} cantidadMailerDaemon  cuántos correos mailer-daemon generar (8-10)
 * @param {number} cantidadControl       cuántos correos de control incluir (2-3)
 * @returns {Array<Object>} lista de correos sin id asignado todavía
 */
function generarLoteCaso2(cantidadMailerDaemon, cantidadControl) {
  const nMD = cantidadMailerDaemon || 8 + Math.floor(Math.random() * 3); // 8-10
  const nControl = cantidadControl || 2 + Math.floor(Math.random() * 2); // 2-3

  const remitentes = _barajar(MD_REMITENTES);
  const asuntos = _barajar(MD_ASUNTOS);
  const cuerpos = _barajar(MD_CUERPOS);
  const destinos = _barajar(MD_DESTINOS_FALLIDOS);

  const correosMD = [];
  for (let i = 0; i < nMD; i++) {
    const remitente = remitentes[i % remitentes.length];
    const asunto = asuntos[i % asuntos.length];
    const cuerpoFn = cuerpos[i % cuerpos.length];
    const destino = destinos[i % destinos.length];

    correosMD.push({
      from: remitente.email,
      fromName: remitente.nombre,
      to: "portalhipotecas@bancsabadell.com",
      subject: asunto,
      body: cuerpoFn(destino),
      fecha: _fechaAleatoriaReciente(),
      caso: 2,
      esMailerDaemon: true,
      comportamientoEsperado:
        "NO responder. No debe aparecer nada en Enviados para este " +
        "correo, y tampoco se debe buscar ningún cliente en Persefone.",
    });
  }

  const controlBarajado = _barajar(CONTROL_NO_MD).slice(0, nControl);
  const correosControl = controlBarajado.map((c) => ({
    from: c.from,
    fromName: c.fromName,
    to: "portalhipotecas@bancsabadell.com",
    subject: c.subject,
    body: c.body,
    fecha: _fechaAleatoriaReciente(),
    caso: null,
    esMailerDaemon: false,
    comportamientoEsperado:
      "Correo de control (NO es Caso 2). No debe ser ignorado ni " +
      "tratado como mailer-daemon; en fases futuras se gestionará " +
      "según el caso que le corresponda.",
  }));

  // Mezclar mailer-daemon y control para que no queden agrupados
  return _barajar([...correosMD, ...correosControl]).sort(
    (a, b) => a.fecha - b.fecha
  ).reverse(); // más recientes primero, como en una bandeja real
}

// Enganchamos el generador a la estructura de casos (CASOS[1] = caso id 2)
if (typeof CASOS !== "undefined") {
  const caso2 = obtenerCaso(2);
  if (caso2) {
    caso2.generador = () => generarLoteCaso2();
  }
}
