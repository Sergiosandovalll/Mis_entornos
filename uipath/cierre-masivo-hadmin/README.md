# Robot de cierre masivo de operaciones en Hadmin

Automatiza con Playwright el cierre de operaciones en **Hadmin**
(`https://hadmin.gibobs.com/`, no es Persefone, sin Citrix), rellenando el
modal "Cerrar hipoteca" con los mismos valores fijos para cada HP de un
listado.

## Estado actual

**Verificado en producción.** En la primera tanda real (14/09) se
cerraron correctamente ~896 de ~914 operaciones únicas con estos
selectores, incluidos los botones "Cerrar" y "Cancelar" del modal.

Fallo conocido y minoritario (~2% de esa tanda): en `seleccionar_motivo`,
el click sobre la opción del desplegable a veces queda bloqueado por un
elemento que se superpone (`ant-modal-header` u otro `div` del layout) y
Playwright termina en `TimeoutError` a los 30s. Cuando pasa:

- El robot lo captura, lo registra como `error` en el log y sigue con la
  siguiente operación **sin haber tocado nada** de esa (no llegó a pulsar
  "Cerrar").
- Basta con volver a lanzar `python robot_cierre_hadmin.py --produccion`
  sobre el mismo `operaciones.csv`: al reanudar, salta las que ya quedaron
  `ok` y reintenta solo las que dieron `error`.
- Un par de HP también fallaron por una carrera con la navegación
  (`Page.goto` interrumpido o con timeout) justo al recargar Hadmin entre
  operación y operación; el mismo reintento por reanudación los resuelve.

Si este fallo se vuelve más frecuente, una mejora pendiente y de bajo
riesgo sería, en `seleccionar_motivo` (`hadmin_page.py`), añadir un
reintento con `scroll_into_view_if_needed()` antes del click, o seleccionar
la opción por teclado (escribir el texto y pulsar Enter) si el desplegable
soporta búsqueda.

### Si algo cambia en la interfaz de Hadmin

Todo lo que depende del DOM real vive en `hadmin_page.py` (no en
`robot_cierre_hadmin.py`). Para volver a capturar selectores:

```bash
playwright codegen https://hadmin.gibobs.com/
```

haz el flujo a mano y actualiza la función correspondiente en
`hadmin_page.py`.

## Instalación

```bash
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium
```

## Uso

### 1. Iniciar sesión (una vez, o cuando caduque)

```bash
python auth_setup.py
```

Se abre un navegador. Inicia sesión manualmente en Hadmin y pulsa Enter en
la terminal cuando ya estés dentro. Esto guarda `storage_state.json` (no se
sube a git) para que las siguientes ejecuciones no pidan login.

### 2. Preparar el CSV de entrada

Copia `operaciones.example.csv` como `operaciones.csv` (tampoco se sube a
git, puede contener HPs reales de clientes) con al menos la columna
`id_operacion`:

```csv
id_operacion,motivo,contenido
HP-000123456,,
```

Las columnas `motivo` y `contenido` son opcionales: si vienen vacías o no
existen, se usan los valores fijos por defecto (`Ilocalizable` y el texto
estándar de contenido).

### 3. Ejecutar en modo simulación (por defecto)

```bash
python robot_cierre_hadmin.py
```

Busca cada operación, abre la ficha, rellena el modal y **cancela sin
confirmar**. Sirve para verificar selectores y flujo sin tocar nada real.

### 4. Ejecutar en producción (cierre real)

```bash
python robot_cierre_hadmin.py --produccion
```

Solo con este flag explícito el robot pulsa "Cerrar" de verdad.

### Otras opciones

- `--csv ruta.csv` — usar un CSV distinto de `operaciones.csv`.
- `--headless` — ejecutar sin ventana de navegador visible.

### Reanudar tras un corte (o tras errores puntuales)

Si el proceso se corta a mitad, o terminó con algún `error` puntual, al
volver a lanzarlo se detecta automáticamente el último log en `logs/` y se
pregunta si quieres continuar (omitiendo las operaciones ya marcadas `ok`,
reintentando el resto) o empezar de cero.

## Salida

Cada ejecución genera `logs/resultado_cierre_YYYYMMDD_HHMM.csv` con columnas
`id_operacion, estado (ok/error/omitida), detalle`. Los HP duplicados en el
CSV de entrada también quedan registrados ahí como `omitida`.

También se guardan capturas de pantalla paso a paso en `debug/` para poder
revisar después qué se veía en cada operación sin depender de verlo en
directo.

## Seguridad

- `storage_state.json`, `operaciones.csv`, `logs/` y `debug/` están en
  `.gitignore`: **nunca se suben al repositorio**. `storage_state.json`
  contiene la sesión autenticada (cookies + token); `operaciones.csv` y
  `logs/` pueden traer HPs reales; `debug/` puede contener capturas con
  datos personales del cliente (nombre, teléfono, email) tal y como se ven
  en la ficha de Hadmin.
- Si `storage_state.json` caduca (el token dura pocas horas), vuelve a
  ejecutar `python auth_setup.py`.
