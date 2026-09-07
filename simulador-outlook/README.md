# Simulador de buzón — Outlook Web (portalhipotecas@bancsabadell.com)

Simulador **local, estático** (HTML/CSS/JS, sin backend ni base de datos)
que imita la interfaz de Outlook Web para poder generar correos de prueba
y verificar, sin tocar el buzón real, cómo los detecta y gestiona el robot
de UiPath del proyecto `Buzon_PortalHipotecas_Simulacion`.

Esta primera fase implementa **únicamente el Caso 2 (mailer-daemon)**. El
resto de los 13 casos del flujo quedan como estructura de datos preparada
(`js/casos.js`) para completarse en fases futuras.

---

## 1. Cómo arrancarlo

No requiere instalación de dependencias. Basta un servidor estático local
(no se puede abrir con `file://` directamente por restricciones de módulos
en algunos navegadores, así que usa siempre `http://localhost`).

Desde la carpeta `simulador-outlook/`:

```bash
python -m http.server 8080
```

y abre <http://localhost:8080> en el navegador.

Alternativas equivalentes si no tienes Python:

```bash
npx serve .
# o
npx http-server -p 8080
```

La pestaña del navegador se titula **"Simulación Outlook Web —
portalhipotecas@bancsabadell.com"**, que empieza por `Simulación Outlook
Web`, tal y como espera el robot (identificación de ventana por título
`Simulación Outlook Web*`).

---

## 2. Qué verás

- **Barra superior**: nombre del buzón simulado, botón para abrir el
  **panel de casos** y botón para **regenerar la bandeja**.
- **Cinta de acciones**: Responder, Responder a todos, Reenviar (Nuevo
  correo, Eliminar y Reenviar son solo decorativos en esta fase).
- **Panel de carpetas**: Bandeja de entrada / Elementos enviados.
- **Lista de correos** (columna central): remitente en negrita si no
  está leído, asunto y vista previa. **Deliberadamente no muestra ninguna
  pista visual** (etiqueta, color de avatar, etc.) de qué caso es cada
  correo — el objetivo es comprobar si el robot lo identifica solo. Esa
  información solo está disponible en el "Panel de casos" (para tu propia
  revisión, no para el robot).
- **Panel de lectura** (derecha): remitente, destinatario, fecha y cuerpo
  completo del correo seleccionado, con el bloque de respuesta debajo del
  botón "Responder a todos".
- **Panel de casos** (botón "📋 Panel de casos"): tabla con, por cada
  correo de la bandeja actual, el caso esperado y qué debería hacer el
  robot — para comparar rápido después de una prueba.

Al pulsar **"🔄 Generar más / Resetear bandeja"** se vacía la bandeja de
entrada y la de enviados, y se genera un nuevo lote aleatorio de correos
del Caso 2 (8-10 mailer-daemon + 2-3 de control), para poder repetir
pruebas sin arrastrar el estado anterior.

---

## 3. Cómo comprobar si el robot actuó bien (Caso 2)

Para cada correo que en el **panel de casos** aparezca marcado como
**"Caso 2 · Mailer-daemon"** (recuerda: esa etiqueta no se muestra en la
bandeja, solo en el panel), lo correcto es que el robot:

1. Lo detecte como mailer-daemon (remitente `mailer-daemon@...`,
   `postmaster@...`, o nombre de remitente tipo "Mail Delivery
   Subsystem" / "Sistema de entrega de correo"; asunto de rebote
   automático).
2. **No responda** — no debe aparecer ninguna fila `sent-item-<id>` en la
   carpeta "Elementos enviados" con el mismo `<id>` que ese correo.
3. **No** busque al cliente en Persefone (no simulado en esta fase, pero
   es parte del criterio de éxito).

Para los correos marcados como **"Sin caso (control)"** en el panel, lo
correcto es que el robot **no los ignore ni los trate como
mailer-daemon** — deberán gestionarse según el caso que les corresponda
en fases futuras.

Abre el **panel de casos** después de cada prueba para revisar, correo a
correo, si el resultado en "Elementos enviados" coincide con lo esperado.

---

## 4. Compatibilidad de selectores con el robot de UiPath

Se han mantenido **exactamente** los ids del simulador anterior para que
el robot ya construido pueda apuntar a esta interfaz sin rehacer
selectores:

| Elemento | id | Notas |
|---|---|---|
| Fila de un correo en la lista | `email-item-<id>` | `<id>` es el id numérico del correo (empieza en 1 y se reasigna en cada reset) |
| Botón "Responder a todos" | `btn-responder-todos` | Habilitado solo con un correo seleccionado |
| Cuadro de texto de respuesta | `reply-textbox` | Aparece tras pulsar "Responder a todos" |
| Botón "Enviar" | `btn-enviar` | Mueve la respuesta a "Elementos enviados" |
| Título de la pestaña/ventana | `Simulación Outlook Web…` | Para identificar la ventana por título |

### Ids nuevos añadidos en esta versión (documentados para el robot o para inspección manual)

| Elemento | id | Contenido |
|---|---|---|
| Remitente visible en la fila de la lista | `email-from-<id>` | `Nombre <correo@dominio>` |
| Asunto visible en la fila de la lista | `email-subject-<id>` | Asunto del correo |
| Cuerpo completo (oculto, para lectura por automatización sin necesidad de abrir el correo) | `email-body-<id>` | Texto completo del cuerpo |
| Elemento en la carpeta "Enviados" tras responder | `sent-item-<id>` | `<id>` coincide con el del correo original respondido — si un correo de Caso 2 aparece aquí, el robot falló |
| Botón "Responder" (individual) | `btn-responder` | Abre el mismo bloque de respuesta que "Responder a todos" |
| Botón "Reenviar" | `btn-reenviar` | Decorativo en esta fase (deshabilitado sin acción) |
| Carpeta Bandeja de entrada / Enviados | `folder-inbox` / `folder-sent` | Botones de navegación entre carpetas |
| Botón resetear bandeja | `btn-reset-bandeja` | Regenera el lote de correos de prueba |
| Botón panel de casos | `btn-panel-casos` | Abre el modal con la tabla de casos esperados |

> Nota: `email-body-<id>` está oculto visualmente (`hidden`) en la fila
> de la lista para no romper el diseño, pero su contenido es accesible
> por el DOM (`Get Text` / `Get Attribute` en UiPath) sin necesidad de
> hacer clic en el correo. El cuerpo también es visible de forma normal
> en el panel de lectura al seleccionar el correo.

---

## 5. Estructura del proyecto

```
simulador-outlook/
├── index.html                 # estructura de la interfaz
├── css/
│   └── styles.css             # estilos tipo Outlook Web (M365)
├── js/
│   ├── casos.js                # estructura de los 13 casos del flujo
│   ├── generador-caso2.js      # generador de correos de prueba del Caso 2
│   └── app.js                  # lógica de la interfaz (render, eventos, envío)
└── README.md
```

### `js/casos.js`

Array `CASOS` con los 13 casos del flujo (nombre, descripción y si están
implementados). Solo el **Caso 2** tiene `implementado: true` y un
`generador` asignado (desde `generador-caso2.js`). Para añadir un caso
nuevo en una fase futura:

1. Crea un archivo `js/generador-casoN.js` con la lógica de generación de
   correos de ese caso (mismo formato de objeto que usa
   `generarLoteCaso2`: `from`, `fromName`, `to`, `subject`, `body`,
   `fecha`, `caso`, `comportamientoEsperado`).
2. En ese archivo, engancha el generador con:
   ```js
   obtenerCaso(N).generador = () => generarLoteCasoN();
   obtenerCaso(N).implementado = true;
   ```
3. Inclúyelo en `index.html` con un `<script>` antes de `js/app.js`.
4. Decide en `app.js` cómo se mezclan/seleccionan los distintos casos al
   poblar la bandeja (en esta fase, `poblarBandejaCaso2()` solo usa el
   Caso 2; en fases futuras puede generalizarse a "poblar con los casos
   seleccionados").

### `js/generador-caso2.js`

Contiene las plantillas de remitentes, asuntos y cuerpos de mailer-daemon
(variados, en español e inglés, con formato técnico de rebote SMTP
realista), los correos de control que no son mailer-daemon, y la función
`generarLoteCaso2(cantidadMailerDaemon, cantidadControl)` que devuelve un
lote mezclado y barajado.

### `js/app.js`

Estado en memoria (`bandejaEntrada`, `elementosEnviados`), render de la
lista/panel de lectura/modal, y los manejadores de "Responder a todos" →
"Enviar" que mueven el correo a la carpeta "Elementos enviados".

---

## 6. Añadir correos de prueba a mano

Para añadir un correo suelto sin pasar por el generador (por ejemplo para
un caso puntual que quieras probar ya), abre la consola del navegador
(F12) con la página cargada y ejecuta algo como:

```js
bandejaEntrada.unshift({
  id: siguienteId++,
  from: "cliente.prueba@example.com",
  fromName: "Cliente de Prueba",
  to: "portalhipotecas@bancsabadell.com",
  subject: "Asunto de prueba",
  body: "Cuerpo del correo de prueba…",
  fecha: new Date(),
  caso: null,               // o el número de caso si aplica
  esMailerDaemon: false,
  comportamientoEsperado: "Descripción de lo que debería hacer el robot.",
  leido: false,
});
render();
```

También puedes editar directamente `MD_REMITENTES`, `MD_ASUNTOS`,
`MD_CUERPOS`, `MD_DESTINOS_FALLIDOS` o `CONTROL_NO_MD` en
`js/generador-caso2.js` para ampliar las variaciones que se generan por
defecto al resetear la bandeja.

---

## 7. Próximas fases

Completar, uno a uno, los generadores de los Casos 1 y 3-13 siguiendo el
mismo patrón que `generador-caso2.js`, y extender `app.js` para permitir
elegir qué combinación de casos poblar en la bandeja en cada prueba.
