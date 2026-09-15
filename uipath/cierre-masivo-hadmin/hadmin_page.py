"""
Interacciones con el DOM real de Hadmin (https://hadmin.gibobs.com/),
obtenidas con `playwright codegen` sobre el flujo real de cierre.

Este es el único archivo que depende de la estructura concreta de la
interfaz de Hadmin: si algo cambia en el DOM, se toca aquí.

Verificado en producción (ver logs/resultado_cierre_20260914_1342.csv):
más de 890 operaciones cerradas correctamente con estos selectores,
incluidos `confirmar_cierre` / `cancelar_modal`.

Fallo conocido, minoritario (~2% de las operaciones de esa tanda): en
`seleccionar_motivo`, el click sobre la opción del desplegable a veces
queda bloqueado 30s por un elemento que se superpone (`ant-modal-header`
o similar) y termina en TimeoutError. Cuando pasa, `procesar_operacion`
lo captura, lo registra como "error" en el log y sigue con la siguiente
operación sin tocar nada - basta con relanzar el robot para que la
reanudación reintente solo esas operaciones fallidas.

`pagina_es_login` detecta cuando Hadmin ha devuelto al usuario a la
pantalla de login (sesión no válida) en vez de a la operación buscada:
`robot_cierre_hadmin.py` la usa para cortar el lote al instante con un
aviso claro, en vez de agotar cada operación con un timeout de 30s
esperando una caja de búsqueda que nunca va a aparecer.
"""
import time

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError

DIALOG_NAME = "Cerrar hipoteca"


def click_texto_visible(page, texto, exact=True, timeout=5000):
    """Hace clic en la única coincidencia de texto que esté realmente
    visible. Algunos desplegables de Hadmin dejan momentáneamente un nodo
    duplicado (oculto) con el mismo texto mientras se abren/cierran, así
    que en vez de adivinar un índice fijo (nth), se espera activamente a
    que aparezca una opción visible y se hace clic en esa.

    Ant Design a veces deja ese duplicado técnicamente "visible" (no
    display:none) pero tapado por el layout del formulario en el punto
    exacto de clic, aunque a simple vista no se vea nada raro. En ese
    caso el clic "de ratón" normal de Playwright queda bloqueado con
    "intercepts pointer events" indefinidamente (hasta el timeout de 30s
    por defecto).

    Como fallback se reintenta con force=True: sigue siendo un clic de
    ratón real (dispara mousedown/mouseup/click de verdad en esa
    posición), solo que sin la comprobación previa de "¿hay algo
    encima?". Es importante que sea un clic real y no un `el.click()`
    por JS: los desplegables de Ant Design seleccionan la opción al
    `mousedown`, no al `click`, así que un `el.click()` sintético no
    activa la selección aunque no dé ningún error (se probó y fallaba
    en silencio: el desplegable se abría pero no quedaba nada
    seleccionado)."""
    locator = page.get_by_text(texto, exact=exact)
    limite = time.time() + timeout / 1000
    while time.time() < limite:
        for i in range(locator.count()):
            candidato = locator.nth(i)
            if candidato.is_visible():
                try:
                    candidato.click(timeout=2000)
                except PlaywrightTimeoutError:
                    candidato.click(timeout=2000, force=True)
                return
        page.wait_for_timeout(100)
    raise PlaywrightTimeoutError(f"No se encontró un elemento visible con texto '{texto}'")


def pagina_es_login(page, timeout=2500):
    """Detecta si la página actual es la pantalla de login de Gibobs
    ("Usuario" / "Contraseña" / "Acceder con gibobs") en vez del panel de
    Hadmin. Se usa como comprobación rápida antes de intentar buscar, para
    no esperar 30s por una caja de búsqueda que nunca va a aparecer si la
    sesión no es válida."""
    try:
        page.get_by_role("button", name="Acceder con gibobs").wait_for(
            state="visible", timeout=timeout
        )
        return True
    except PlaywrightTimeoutError:
        return False


def buscar_operacion(page, hp):
    """Escribe el HP en la barra de búsqueda superior (sin pulsar Enter)."""
    caja = page.get_by_role("textbox", name="Buscar...")
    caja.click()
    caja.fill("")
    caja.fill(hp)


def hay_resultado(page, hp):
    """Localiza el resultado de búsqueda de la operación.

    Se filtra por el HP exacto (no solo por el prefijo "HP-") porque la
    ficha de un cliente puede mostrar un bloque "Otras operaciones" con
    hipotecas hermanas del mismo cliente, cuyos enlaces usan el mismo
    patrón de texto y pueden quedar en la página al buscar la siguiente
    operación, dando falsos "2 elementos encontrados"."""
    return page.get_by_role("link", name=hp)


def abrir_resultado(page, hp):
    hay_resultado(page, hp).click()


def click_finalizar(page):
    boton = page.get_by_role("button", name="Finalizar")
    boton.wait_for(state="visible", timeout=5000)
    # La ficha carga en dos fases: primero aparecen los botones
    # deshabilitados mientras termina de cargar, luego se activan. Se le da
    # un margen antes de concluir que sigue deshabilitado de verdad (ya
    # cerrada) en vez de que sea solo la carga inicial de la página.
    limite = time.time() + 5
    while time.time() < limite and boton.is_disabled():
        page.wait_for_timeout(200)
    if boton.is_disabled():
        raise PlaywrightTimeoutError("El botón 'Finalizar' está deshabilitado")
    boton.click()
    dialogo = page.get_by_role("dialog", name=DIALOG_NAME)
    dialogo.wait_for(state="visible", timeout=5000)
    return dialogo


def seleccionar_cerrar_tareas_si(page):
    page.locator("#NotesPostpone").click()
    click_texto_visible(page, "Si", exact=True)
    page.wait_for_timeout(300)


def seleccionar_solicitante_gibobs(page):
    page.locator("#requestReason").click()
    click_texto_visible(page, "Por solicitud de Gibobs", exact=False)
    page.wait_for_timeout(300)


def seleccionar_motivo(page, motivo):
    """El desplegable de Motivo solo existe una vez elegido el solicitante
    "Por solicitud de Gibobs". Se abre haciendo clic en su placeholder
    ("Seleccione") y se elige la opción por su texto.

    A esta altura del formulario, "Cerrar tareas" y "Solicitante" ya están
    rellenos, así que el único "Seleccione" que debería quedar en el
    diálogo es el de Motivos. Se comprueba tras el clic que ha
    desaparecido: si sigue ahí, el clic no llegó a seleccionar nada de
    verdad (visto en la práctica: el desplegable se abre pero no marca
    ninguna opción) y se lanza un error en vez de seguir como si nada."""
    page.get_by_text("Seleccione").click()
    page.wait_for_timeout(300)
    click_texto_visible(page, motivo, exact=True)
    page.wait_for_timeout(300)

    if page.get_by_text("Seleccione", exact=True).count() > 0:
        raise PlaywrightTimeoutError(
            f"El motivo '{motivo}' no quedó seleccionado: el desplegable "
            "sigue mostrando el placeholder 'Seleccione'"
        )


def rellenar_contenido(page, dialogo, texto):
    """El editor de "Contenido" es un Draft.js (contenteditable gestionado
    por JS): no soporta rellenarse asignando el valor directamente
    (.fill()), hay que escribir con el teclado simulado tras enfocarlo."""
    bloque = dialogo.locator(".public-DraftStyleDefault-block").first
    bloque.click()
    page.keyboard.type(texto)


def confirmar_cierre(page, dialogo):
    """Pulsa 'Cerrar' en el modal: aplica el cierre real.

    Comprueba que el diálogo se cierra de verdad tras el clic. Si algún
    campo quedó mal relleno (por ejemplo el motivo, ver
    `seleccionar_motivo`), Hadmin puede bloquear el envío con una
    validación y dejar el modal abierto; sin esta comprobación eso se
    hubiera reportado igualmente como "ok"."""
    dialogo.get_by_role("button", name="Cerrar", exact=True).click()
    dialogo.wait_for(state="hidden", timeout=5000)


def cancelar_modal(page, dialogo):
    """Pulsa 'Cancelar' en el modal: no aplica ningún cambio."""
    dialogo.get_by_role("button", name="Cancelar", exact=True).click()
