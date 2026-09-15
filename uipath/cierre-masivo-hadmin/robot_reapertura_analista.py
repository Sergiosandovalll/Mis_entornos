"""
Robot que recorre las operaciones de operaciones.csv y REABRE las que NO
estén asignadas a uno de los analistas permitidos.

Uso:
    python robot_reapertura_analista.py                  # dry-run (por defecto, no reabre nada)
    python robot_reapertura_analista.py --produccion      # reabre de verdad

Requiere haber ejecutado antes `python auth_setup.py` para generar
storage_state.json con la sesión iniciada (mismo storage_state.json que
robot_cierre_hadmin.py).

Cómo decide si una operación se queda cerrada o se reabre:
    1. Busca el HP y lee "Analista: Nombre Completo" directamente de la
       fila de resultado de la búsqueda (sin abrir la ficha).
    2. Normaliza el nombre encontrado y lo compara POR PALABRAS (sin
       tildes, sin mayúsculas) contra la lista de analistas permitidos.
       Cuenta como coincidencia si comparten al menos 2 palabras (o
       todas, si el nombre permitido tiene solo 2) - así "Cristina Pérez
       de Tudela Gely" coincide con "Cristina Perez" aunque no sea
       idéntico, pero un simple "Cristina" suelto no basta por sí solo.
    3. Si coincide con exactamente uno de la lista -> se queda cerrada.
    4. Si no coincide con ninguno -> se reabre (o "se reabriría" en
       dry-run).
    5. Si coincide con más de uno, o no se pudo leer el nombre -> NO se
       toca la operación; se registra como "dudosa" para revisión manual.
"""
import argparse
import csv
import glob
import os
import random
import re
import sys
import time
import unicodedata
from datetime import datetime

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

import hadmin_page as hp_page
import robot_cierre_hadmin as base  # reutiliza HADMIN_URL, STORAGE_STATE_PATH, leer_operaciones, captura, etc.

CSV_INPUT_DEFAULT = base.CSV_INPUT_DEFAULT
LOGS_DIR = base.LOGS_DIR
LOG_PREFIX = "resultado_reapertura_"

SESION_EXPIRADA = "SESION_EXPIRADA"

ANALISTAS_PERMITIDOS = [
    "Ludmila Yattah",
    "Sara Puig",
    "Cristina Perez",
    "María Laura",
    "Claudina Santana",
    "Ana Gisella Gonçalves",
    "Ana Mailen Morbello",
]


# ---------------------------------------------------------------------------
# Comparación de nombres
# ---------------------------------------------------------------------------


def normalizar(texto):
    texto = (texto or "").strip().lower()
    texto = "".join(
        c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn"
    )
    return re.sub(r"\s+", " ", texto)


def palabras(texto):
    return set(normalizar(texto).split())


def evaluar_analista(nombre_encontrado):
    """Devuelve (veredicto, detalle). veredicto en
    {"permitido", "no_permitido", "dudoso"}.

    Distingue coincidencia CONFIRMADA (2+ palabras en común, p.ej. nombre
    + apellido) de coincidencia PARCIAL (1 sola palabra en común, p.ej.
    solo el nombre de pila - pasa cuando la fila de resultado no trae
    apellido, o cuando el nombre de pila es compartido como "Ana"). Una
    coincidencia parcial NUNCA reabre por sí sola: se marca como dudosa,
    porque no hay apellido suficiente para descartar que sea justo esa
    persona de la lista."""
    if not nombre_encontrado:
        return "dudoso", "No se pudo leer el nombre del analista en la fila de resultado"

    palabras_encontrado = palabras(nombre_encontrado)
    confirmados = []
    parciales = []
    for permitido in ANALISTAS_PERMITIDOS:
        solapadas = palabras_encontrado & palabras(permitido)
        if len(solapadas) >= 2:
            confirmados.append(permitido)
        elif len(solapadas) >= 1:
            parciales.append(permitido)

    # Una coincidencia CONFIRMADA (2+ palabras) tiene más peso que una
    # PARCIAL (1 palabra, p.ej. el mismo nombre de pila compartido con
    # otra persona de la lista) - un solapamiento parcial con un tercero
    # no debe rebajar una coincidencia ya confirmada a "dudosa".
    if len(confirmados) == 1:
        return "permitido", f"Analista '{nombre_encontrado}' coincide con '{confirmados[0]}' de la lista"
    if len(confirmados) > 1:
        return "dudoso", f"Analista '{nombre_encontrado}' coincide claramente con varios de la lista: {confirmados}"
    if parciales:
        return "dudoso", (
            f"Analista '{nombre_encontrado}' solo coincide parcialmente (nombre de pila, "
            f"sin apellido suficiente) con {parciales} de la lista"
        )
    return "no_permitido", f"Analista '{nombre_encontrado}' no coincide ni siquiera parcialmente con ninguno de los 7 permitidos"


# ---------------------------------------------------------------------------
# Logs / reanudación (mismo patrón que robot_cierre_hadmin.py)
# ---------------------------------------------------------------------------


def todos_los_logs():
    return sorted(glob.glob(os.path.join(LOGS_DIR, f"{LOG_PREFIX}*.csv")))


def preguntar_reanudar():
    logs = todos_los_logs()
    if not logs:
        return False
    respuesta = input(
        f"Se encontraron {len(logs)} log(s) anterior(es) de reapertura en '{LOGS_DIR}/'. "
        "¿Continuar y omitir las operaciones ya resueltas (permitido/reabierta), "
        "o empezar de cero? [continuar/cero]: "
    ).strip().lower()
    return respuesta.startswith("cont")


def cargar_ya_resueltas(reanudar):
    """Solo cuentan como resueltas las filas con un veredicto DEFINITIVO
    y REAL: 'permitido' (se queda cerrada, no depende de --produccion) o
    'reabierta' de una ejecución --produccion real. Las 'dudosa' y los
    "[DRY-RUN] se reabriría" no cuentan - hay que volver a pasar por
    ellas."""
    if not reanudar:
        return set()
    resueltas = set()
    for log in todos_los_logs():
        with open(log, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for fila in reader:
                detalle = fila.get("detalle") or ""
                if fila.get("estado") == "ok" and (
                    "se queda cerrada" in detalle or detalle.startswith("Reabierta:")
                ):
                    resueltas.add(fila.get("id_operacion"))
    print(f"Reanudando: {len(resueltas)} operaciones ya resueltas se omitirán.")
    return resueltas


def nombre_log():
    os.makedirs(LOGS_DIR, exist_ok=True)
    nombre = datetime.now().strftime(f"{LOG_PREFIX}%Y%m%d_%H%M.csv")
    return os.path.join(LOGS_DIR, nombre)


# ---------------------------------------------------------------------------
# Lógica principal
# ---------------------------------------------------------------------------


def procesar_operacion(page, hp, produccion):
    """Devuelve (estado, detalle). estado en {"ok", "dudosa", "omitida", "error"}."""
    try:
        page.goto(base.HADMIN_URL)

        if hp_page.pagina_es_login(page):
            base.captura(page, hp, "00_sesion_expirada")
            return "error", (
                f"{SESION_EXPIRADA}: Hadmin devolvió la pantalla de login en vez del "
                f"panel (url: {page.url}). Ejecuta 'python auth_setup.py' y vuelve a "
                "lanzar el robot: retomará donde se quedó."
            )

        hp_page.buscar_operacion(page, hp)

        resultado = hp_page.hay_resultado(page, hp)
        try:
            resultado.first.wait_for(state="visible", timeout=8000)
        except PlaywrightTimeoutError:
            return "omitida", "No se encontró resultado de búsqueda para el HP"

        nombre = hp_page.analista_en_resultado(page, hp)
        veredicto, detalle = evaluar_analista(nombre)

        if veredicto == "permitido":
            return "ok", f"Se queda cerrada: {detalle}"

        if veredicto == "dudoso":
            base.captura(page, hp, "dudosa")
            return "dudosa", detalle

        # veredicto == "no_permitido" -> hay que reabrir
        if not produccion:
            return "ok", f"[DRY-RUN] Se reabriría: {detalle}"

        hp_page.abrir_resultado(page, hp)
        base.captura(page, hp, "antes_de_reabrir")
        hp_page.reabrir_operacion(page)
        base.captura(page, hp, "reabierta")
        return "ok", f"Reabierta: {detalle}"

    except Exception as exc:
        base.captura(page, hp, "99_error")
        try:
            url_actual = page.url
        except Exception:
            url_actual = "?"
        return "error", f"{exc} (url: {url_actual})"


def main():
    parser = argparse.ArgumentParser(
        description="Reabre operaciones cuyo analista no esté en la lista permitida"
    )
    parser.add_argument("--csv", default=CSV_INPUT_DEFAULT)
    parser.add_argument("--produccion", action="store_true", help="Reabre de verdad (por defecto es dry-run)")
    parser.add_argument("--headless", action="store_true")
    args = parser.parse_args()

    if not os.path.exists(base.STORAGE_STATE_PATH):
        sys.exit(f"No existe '{base.STORAGE_STATE_PATH}'. Ejecuta primero: python auth_setup.py")
    if not os.path.exists(args.csv):
        sys.exit(f"No existe el CSV de entrada '{args.csv}'.")

    operaciones, duplicados = base.leer_operaciones(args.csv)

    reanudar = preguntar_reanudar()
    ya_resueltas = cargar_ya_resueltas(reanudar)
    pendientes = [op for op in operaciones if op["id_operacion"] not in ya_resueltas]

    modo = "PRODUCCIÓN (reabre de verdad)" if args.produccion else "DRY-RUN (simulación, no reabre nada)"
    print(f"\nAnalistas permitidos: {ANALISTAS_PERMITIDOS}")
    print(f"Modo: {modo}. Operaciones a procesar: {len(pendientes)} (de {len(operaciones)} en el CSV)\n")

    log_path = nombre_log()
    with sync_playwright() as p:
        launch_args = ["--headless=new"] if args.headless else []
        browser = p.chromium.launch(headless=args.headless, args=launch_args)
        context = browser.new_context(storage_state=base.STORAGE_STATE_PATH)
        page = context.new_page()
        page.goto(base.HADMIN_URL)

        if hp_page.pagina_es_login(page):
            browser.close()
            sys.exit(
                "La sesión guardada no es válida (Hadmin muestra el login). "
                "Ejecuta 'python auth_setup.py' e inténtalo de nuevo."
            )

        with open(log_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["id_operacion", "estado", "detalle"])

            for hp in duplicados:
                writer.writerow([hp, "omitida", "Duplicado en el CSV de entrada"])
            f.flush()

            total = len(pendientes)
            for idx, op in enumerate(pendientes, start=1):
                hp = op["id_operacion"]
                estado, detalle = procesar_operacion(page, hp, args.produccion)
                writer.writerow([hp, estado, detalle])
                f.flush()

                print(f"[{idx}/{total}] {hp}: {estado} - {detalle}")

                if detalle.startswith(SESION_EXPIRADA):
                    print(
                        f"\n⚠ Sesión caducada a mitad de la tanda ({idx}/{total}). "
                        "Ejecuta 'python auth_setup.py' y vuelve a lanzar el robot: "
                        "retomará justo donde se quedó."
                    )
                    break

                time.sleep(random.uniform(1, 3))

        browser.close()

    print(f"\nLog guardado en '{log_path}'.")


if __name__ == "__main__":
    main()
