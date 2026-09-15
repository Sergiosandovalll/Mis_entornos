"""
Diagnóstico (solo lectura, no toca ni envía nada): ¿pywinauto puede ver
el árbol de controles (UI Automation) de la ventana publicada por
Citrix? Esto determina si se puede automatizar por selectores reales
(como hicimos con Playwright en Hadmin) o si habría que ir por clics de
imagen/coordenadas de pantalla, mucho más frágil.

Uso:
    1. Instala pywinauto:  pip install pywinauto
    2. Deja la ventana de la app de Citrix (el webmail) ABIERTA y
       enfocada (haz clic en ella para que esté en primer plano).
    3. Ejecuta:  python diagnostico_citrix.py
    4. Elige el número de esa ventana en la lista.
    5. Pégame TODA la salida que imprima (los "controles" que liste, o
       el mensaje de error si no ve nada).
"""
import sys

from pywinauto import Desktop
from pywinauto.application import Application


def main():
    ventanas = Desktop(backend="uia").windows()
    print(f"Se han encontrado {len(ventanas)} ventanas de nivel superior:\n")
    for i, w in enumerate(ventanas):
        try:
            titulo = w.window_text()
        except Exception:
            titulo = "(sin título / error al leerlo)"
        try:
            clase = w.friendly_class_name()
        except Exception:
            clase = "?"
        print(f"[{i}] {titulo!r}  clase={clase}")

    print("\nEscribe el número de la ventana de Citrix/webmail a inspeccionar:")
    idx = int(input("> ").strip())
    handle = ventanas[idx].handle

    # Desktop().windows() devuelve wrappers "sueltos" que en algunas
    # versiones de pywinauto no traen print_control_identifiers. Nos
    # conectamos a la ventana por su handle para obtener el objeto
    # correcto (WindowSpecification) que sí lo tiene.
    app = Application(backend="uia").connect(handle=handle)
    dlg = app.window(handle=handle)

    print(f"\nInspeccionando: {dlg.window_text()!r}\n" + "-" * 60)
    try:
        dlg.print_control_identifiers(depth=4)
    except Exception as e:
        print(f"No se pudo leer el árbol de controles: {e}")
        print(
            "\n⚠ Esto probablemente significa que Citrix NO expone la "
            "accesibilidad de esa ventana: solo veríamos píxeles, no "
            "controles reales. Tocaría ir por clics de imagen/coordenadas."
        )
        return

    print(
        "\n✅ Si arriba ves controles reales (botones, campos de texto, "
        "enlaces...) con nombres reconocibles, hay buenas posibilidades "
        "de automatizar por selectores en vez de coordenadas de pantalla."
    )


if __name__ == "__main__":
    sys.exit(main())
