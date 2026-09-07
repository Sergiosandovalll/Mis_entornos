/* ==========================================================================
   casos.js
   Estructura de datos de los 13 casos del flujo de gestión del buzón
   portalhipotecas@bancsabadell.com.

   Cada caso tiene:
     - id: número de caso (1-13)
     - nombre: nombre corto
     - descripcion: qué caracteriza al correo / qué debe hacer el robot
     - implementado: boolean — si esta fase ya genera correos de prueba
     - generador: función que devuelve un array de correos de prueba
                  (solo existe si implementado === true)

   Fases futuras deben rellenar "generador" para cada caso y marcar
   "implementado: true". No se debe romper la forma de este objeto.
   ========================================================================== */

const CASOS = [
  {
    id: 1,
    nombre: "Remitente colaborador (primera vez)",
    descripcion:
      "La primera vez que escribe un colaborador, se le responde con la " +
      "dirección de correo correcta a la que debe dirigirse; a partir de " +
      "ahí, no se le contesta más.",
    implementado: false,
    generador: null,
  },
  {
    id: 2,
    nombre: "Mailer-daemon (correo no entregado)",
    descripcion:
      "Correo de rebote automático (mailer-daemon / postmaster / Mail " +
      "Delivery Subsystem). NO se contesta nunca y no se busca al cliente " +
      "en Persefone.",
    implementado: true,
    generador: null, // se asigna en generador-caso2.js -> CASOS[1].generador
  },
  {
    id: 3,
    nombre: "Cliente no localizado en Persefone",
    descripcion:
      "El cliente no se encuentra en Persefone; se responde pidiendo DNI, " +
      "email o teléfono para poder localizarlo.",
    implementado: false,
    generador: null,
  },
  {
    id: 4,
    nombre: "Correo con adjuntos",
    descripcion:
      "El correo trae documentación adjunta; se responde con una " +
      "plantilla explicando que debe subir la documentación por su " +
      "plataforma.",
    implementado: false,
    generador: null,
  },
  {
    id: 5,
    nombre: "Regla por palabra clave",
    descripcion:
      "El cuerpo contiene una palabra clave relevante (ya subió " +
      "documentación, no puede acceder a la plataforma, insiste en " +
      "contacto, RGPD / borrar datos, pregunta por vinculaciones si es " +
      "colaborador, etc.) y dispara una respuesta específica.",
    implementado: false,
    generador: null,
  },
  {
    id: 6,
    nombre: "Escenario genérico",
    descripcion:
      "Ninguna palabra clave coincide; se usa una respuesta genérica.",
    implementado: false,
    generador: null,
  },
  {
    id: 7,
    nombre: "Correo ya gestionado",
    descripcion:
      "La última nota en Persefone es posterior a la fecha del correo: no " +
      "se crea tarea nueva.",
    implementado: false,
    generador: null,
  },
  {
    id: 8,
    nombre: "Reabrir operación (cierre reversible)",
    descripcion:
      "La operación está cerrada con un código de cierre reversible " +
      "(NCX): se reabre.",
    implementado: false,
    generador: null,
  },
  {
    id: 9,
    nombre: "Cerrada sin reabrir",
    descripcion:
      "La operación está cerrada por otro motivo (no reversible): no se " +
      "reabre.",
    implementado: false,
    generador: null,
  },
  {
    id: 10,
    nombre: "Flujo normal",
    descripcion:
      "La operación está abierta: se sigue el proceso normal de gestión.",
    implementado: false,
    generador: null,
  },
  {
    id: 11,
    nombre: "Regla directa de tasación",
    descripcion:
      "El correo menciona \"tasación\": la tarea va directa al Analista.",
    implementado: false,
    generador: null,
  },
  {
    id: 12,
    nombre: "Operación ya cualificada",
    descripcion:
      "Se revisa la pestaña Oferta (estado del RECO) y la pestaña " +
      "Documentación para decidir si la tarea va al Analista / Gestor " +
      "documental o a otra persona.",
    implementado: false,
    generador: null,
  },
  {
    id: 13,
    nombre: "Cascada general de asignación",
    descripcion:
      "Plan ROPO, detección de \"quali\" (mismo nombre en Analista y " +
      "Gestor documental), y asignación según el estado del RECO.",
    implementado: false,
    generador: null,
  },
];

function obtenerCaso(id) {
  return CASOS.find((c) => c.id === id) || null;
}
