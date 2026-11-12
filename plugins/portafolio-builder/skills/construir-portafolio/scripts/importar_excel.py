#!/usr/bin/env python3
"""
Retoma un portafolio a partir de un Excel generado antes por este plugin.

Uso:
    python importar_excel.py Portafolio_anterior.xlsx estado.json

Toma las posiciones de la hoja "Detalle Posiciones" y los tipos de cambio de la
hoja "Tipos de Cambio" (así se respetan las correcciones que la persona haya
hecho a mano en el Excel) y recupera de la hoja oculta "_estado" lo demás
(cliente, fecha de corte, avance por sección).
"""
import json
import sys

from openpyxl import load_workbook


def main():
    if len(sys.argv) != 3:
        print(json.dumps({"error": "Uso: python importar_excel.py archivo.xlsx estado.json"}))
        sys.exit(1)
    wb = load_workbook(sys.argv[1], data_only=False)
    if "Detalle Posiciones" not in wb.sheetnames:
        print(json.dumps({"error": "Este Excel no fue generado por el plugin (no tiene 'Detalle Posiciones')."},
                         ensure_ascii=False))
        sys.exit(1)

    estado = {}
    if "_estado" in wb.sheetnames:
        ws = wb["_estado"]
        trozos = [ws.cell(r, 1).value or "" for r in range(1, ws.max_row + 1)]
        try:
            estado = json.loads("".join(trozos))
        except ValueError:
            estado = {}

    tc = {}
    if "Tipos de Cambio" in wb.sheetnames:
        ws = wb["Tipos de Cambio"]
        r = 5
        while ws.cell(r, 1).value:
            tc[str(ws.cell(r, 1).value).upper()] = float(ws.cell(r, 2).value)
            r += 1
    tc.pop("USD", None)

    ws = wb["Detalle Posiciones"]
    claves = ["institucion", "cuenta", "instrumento", "ticker_isin", "categoria", None,
              "moneda", "monto", None, "fuente", "confianza", "nota"]
    posiciones = []
    r = 5
    while isinstance(ws.cell(r, 1).value, (int, float)):
        p = {}
        for j, k in enumerate(claves, 2):
            if k:
                v = ws.cell(r, j).value
                p[k] = v if v is not None else ""
        p["monto"] = float(p["monto"])
        posiciones.append(p)
        r += 1

    estado["posiciones"] = posiciones
    estado["tipos_cambio"] = tc
    with open(sys.argv[2], "w", encoding="utf-8") as f:
        json.dump(estado, f, ensure_ascii=False, indent=2)
    print(json.dumps({"estado": sys.argv[2], "posiciones": len(posiciones),
                      "cliente": estado.get("cliente"), "secciones": estado.get("secciones")},
                     ensure_ascii=False))


if __name__ == "__main__":
    main()
