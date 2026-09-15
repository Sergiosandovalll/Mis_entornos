"""
Comprobación rápida y SIN abrir el navegador de cuántas operaciones del
CSV siguen pendientes de cierre REAL (no cuenta verificaciones de
dry-run, solo "Cerrada correctamente"). Lee operaciones.csv y todos los
logs en logs/.

Uso:
    python verificar_pendientes.py                  # usa operaciones.csv
    python verificar_pendientes.py --csv otro.csv
"""
import argparse
import csv
import os
import sys

import robot_cierre_hadmin as robot


def cerradas_de_verdad():
    """Mismo criterio que robot_cierre_hadmin.cargar_ya_ok: solo cuentan
    las filas 'ok' cuyo detalle NO empieza por '[DRY-RUN]'."""
    ok = set()
    for log in robot.todos_los_logs():
        with open(log, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for fila in reader:
                if fila.get("estado") == "ok" and not (fila.get("detalle") or "").startswith("[DRY-RUN]"):
                    ok.add(fila.get("id_operacion"))
    return ok


def main():
    parser = argparse.ArgumentParser(description="Comprueba cuántas operaciones del CSV siguen sin cerrar de verdad")
    parser.add_argument("--csv", default=robot.CSV_INPUT_DEFAULT)
    args = parser.parse_args()

    if not os.path.exists(args.csv):
        sys.exit(f"No existe el CSV de entrada '{args.csv}'.")

    operaciones, duplicados = robot.leer_operaciones(args.csv)
    cerradas = cerradas_de_verdad()
    pendientes = [op["id_operacion"] for op in operaciones if op["id_operacion"] not in cerradas]

    print(f"CSV: {args.csv}")
    print(f"  Operaciones únicas: {len(operaciones)}")
    print(f"  Duplicados omitidos: {len(duplicados)}")
    print(f"  Cerradas de verdad (según logs/): {len(operaciones) - len(pendientes)}")
    print(f"  Pendientes: {len(pendientes)}")

    if pendientes:
        print("\nIDs todavía pendientes:")
        for hp in pendientes:
            print(f"  {hp}")
        sys.exit(1)

    print("\n✅ Todas las operaciones únicas del CSV están cerradas de verdad.")


if __name__ == "__main__":
    main()
