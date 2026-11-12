#!/usr/bin/env python3
"""
Llena la plantilla de portafolio (Sheet1) a partir de un JSON de posiciones.

Uso:
    python llenar_plantilla.py posiciones.json salida.xlsx

Qué hace:
  1. Copia la plantilla original (assets/plantilla-portafolio-final.xlsx).
  2. Agrega la hoja "Detalle Posiciones" con cada posición, su categoría y su
     monto convertido a USD (por fórmula, usando la hoja "Tipos de Cambio").
  3. Escribe en las celdas de la columna ACTUAL (D) de Sheet1 una fórmula
     SUMIFS / total, de modo que si se corrige una categoría o un monto en el
     detalle, todo se recalcula solo.
  4. Imprime un resumen (JSON) con los porcentajes calculados en Python, para
     verificar y reportar sin depender de que el Excel se haya recalculado.

Formato del JSON de entrada: ver references/formato-entrada.md
"""
import json
import os
import shutil
import sys
from collections import defaultdict

from openpyxl import load_workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

AQUI = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(AQUI, "..", "assets")
PLANTILLA = os.path.join(ASSETS, "plantilla-portafolio-final.xlsx")
CATEGORIAS = os.path.join(ASSETS, "categorias.json")

HOJA_PLANTILLA = "Sheet1"
HOJA_DETALLE = "Detalle Posiciones"
HOJA_TC = "Tipos de Cambio"
HOJA_ESTADO = "_estado"

FUERA = {"EMPRESA_PRIVADA", "EXCLUIR"}
CONFIANZAS = {"alta", "media", "baja"}

FUENTE = "Arial"
F_NORMAL = Font(name=FUENTE, size=10)
F_BOLD = Font(name=FUENTE, size=10, bold=True)
F_TITULO = Font(name=FUENTE, size=13, bold=True)
F_INPUT = Font(name=FUENTE, size=10, color="0000FF")
F_HEADER = Font(name=FUENTE, size=10, bold=True, color="FFFFFF")
FILL_HEADER = PatternFill("solid", fgColor="1F3864")
FILL_BAJA = PatternFill("solid", fgColor="FCE4D6")
FILL_MEDIA = PatternFill("solid", fgColor="FFF2CC")
FILL_TOTAL = PatternFill("solid", fgColor="D9E1F2")
BORDE = Border(bottom=Side(style="thin", color="BFBFBF"))


def fallar(msg):
    print(json.dumps({"error": msg}, ensure_ascii=False))
    sys.exit(1)


def cargar_categorias():
    with open(CATEGORIAS, encoding="utf-8") as f:
        data = json.load(f)
    cats = {c["codigo"]: c for c in data["categorias"]}
    for c in data["fuera_del_portafolio"]:
        cats[c["codigo"]] = {**c, "grupo": "Fuera del portafolio", "subgrupo": "", "region": None}
    return cats


def etiqueta(cat):
    partes = [cat.get("grupo"), cat.get("subgrupo"), cat.get("nombre")]
    return " > ".join(p for p in partes if p)


def validar(entrada, cats, permitir_vacio=False):
    posiciones = entrada.get("posiciones") or []
    if not posiciones and not permitir_vacio:
        fallar("El JSON no tiene 'posiciones'.")
    tc = {k.upper(): float(v) for k, v in (entrada.get("tipos_cambio") or {}).items()}
    tc["USD"] = 1.0
    errores = []
    for i, p in enumerate(posiciones, 1):
        cod = p.get("categoria")
        if cod not in cats:
            errores.append(f"Posición {i} ({p.get('instrumento')}): categoría desconocida '{cod}'.")
        mon = (p.get("moneda") or "USD").upper()
        if mon not in tc:
            errores.append(f"Posición {i} ({p.get('instrumento')}): falta tipo de cambio para {mon}.")
        try:
            float(p.get("monto"))
        except (TypeError, ValueError):
            errores.append(f"Posición {i} ({p.get('instrumento')}): monto inválido '{p.get('monto')}'.")
        conf = (p.get("confianza") or "media").lower()
        if conf not in CONFIANZAS:
            errores.append(f"Posición {i}: confianza debe ser alta/media/baja.")
    if errores:
        fallar(" | ".join(errores))
    return tc


def hoja_tipos_cambio(wb, tc, entrada):
    ws = wb.create_sheet(HOJA_TC)
    ws["A1"] = "Tipos de cambio usados (unidades de moneda por 1 USD)"
    ws["A1"].font = F_TITULO
    ws["A2"] = entrada.get("fuente_tipos_cambio") or "Fuente: indicada por el usuario o tomada de los estados de cuenta."
    ws["A2"].font = Font(name=FUENTE, size=9, italic=True)
    ws["A4"], ws["B4"] = "Moneda", "Por 1 USD"
    for c in ("A4", "B4"):
        ws[c].font, ws[c].fill = F_HEADER, FILL_HEADER
    monedas = ["USD"] + sorted(m for m in tc if m != "USD")
    for i, m in enumerate(monedas, 5):
        ws.cell(i, 1, m).font = F_NORMAL
        c = ws.cell(i, 2, tc[m])
        c.font = F_INPUT  # input editable
        c.number_format = "0.0000"
    ws.column_dimensions["A"].width = 12
    ws.column_dimensions["B"].width = 14
    return f"'{HOJA_TC}'!$A$5:$B${4 + len(monedas)}"


def hoja_detalle(wb, entrada, cats, rango_tc):
    ws = wb.create_sheet(HOJA_DETALLE)
    ws["A1"] = f"Detalle de posiciones — {entrada.get('cliente') or 'Cliente'}"
    ws["A1"].font = F_TITULO
    ws["A2"] = (f"Fecha de corte: {entrada.get('fecha_corte') or 's/f'}  ·  "
                "Montos en azul = tomados de los documentos (editables). "
                "Si cambias una categoría o un monto, Sheet1 se recalcula sola.")
    ws["A2"].font = Font(name=FUENTE, size=9, italic=True)

    cols = ["#", "Institución", "Cuenta", "Instrumento", "Ticker / ISIN", "Código categoría",
            "Categoría plantilla", "Moneda", "Monto (moneda orig.)", "Monto USD",
            "Fuente (archivo / página)", "Confianza", "Nota / justificación"]
    anchos = [5, 18, 14, 34, 16, 22, 52, 8, 18, 16, 28, 11, 60]
    for j, (t, w) in enumerate(zip(cols, anchos), 1):
        c = ws.cell(4, j, t)
        c.font, c.fill = F_HEADER, FILL_HEADER
        c.alignment = Alignment(wrap_text=True, vertical="center")
        ws.column_dimensions[get_column_letter(j)].width = w
    ws.freeze_panes = "A5"

    fila = 5
    for i, p in enumerate(entrada["posiciones"], 1):
        cat = cats[p["categoria"]]
        mon = (p.get("moneda") or "USD").upper()
        conf = (p.get("confianza") or "media").lower()
        valores = [i, p.get("institucion"), p.get("cuenta"), p.get("instrumento"),
                   p.get("ticker_isin"), p["categoria"], etiqueta(cat), mon,
                   float(p["monto"]),
                   f"=IFERROR(I{fila}/VLOOKUP(H{fila},{rango_tc},2,FALSE),0)",
                   p.get("fuente"), conf, p.get("nota")]
        for j, v in enumerate(valores, 1):
            c = ws.cell(fila, j, v)
            c.font = F_NORMAL
            c.border = BORDE
            c.alignment = Alignment(vertical="top", wrap_text=j in (4, 7, 13))
        ws.cell(fila, 9).font = F_INPUT
        ws.cell(fila, 6).font = Font(name=FUENTE, size=10, color="0000FF")
        ws.cell(fila, 9).number_format = "#,##0.00"
        ws.cell(fila, 10).number_format = "$#,##0.00"
        if conf == "baja":
            for j in range(1, len(cols) + 1):
                ws.cell(fila, j).fill = FILL_BAJA
        elif conf == "media":
            ws.cell(fila, 12).fill = FILL_MEDIA
        fila += 1
    ultima = fila - 1

    rF = f"$F$5:$F${ultima}"
    rJ = f"$J$5:$J${ultima}"
    fila += 1
    totales = [
        ("Total Portafolio de Inversión (USD)",
         f"=SUM({rJ})-SUMIFS({rJ},{rF},\"EMPRESA_PRIVADA\")-SUMIFS({rJ},{rF},\"EXCLUIR\")"),
        ("Acciones en Empresas Privadas (USD)", f"=SUMIFS({rJ},{rF},\"EMPRESA_PRIVADA\")"),
        ("Excluido (no suma)", f"=SUMIFS({rJ},{rF},\"EXCLUIR\")"),
        ("Patrimonio Generador de Ingresos (USD)", f"=J{fila}+J{fila + 1}"),
    ]
    celdas = {}
    for k, (txt, f) in enumerate(totales):
        r = fila + k
        ws.cell(r, 7, txt).font = F_BOLD
        c = ws.cell(r, 10, f)
        c.font = F_BOLD
        c.number_format = "$#,##0.00"
        for j in (7, 8, 9, 10):
            ws.cell(r, j).fill = FILL_TOTAL
        celdas[k] = f"'{HOJA_DETALLE}'!$J${r}"

    leyenda = fila + len(totales) + 1
    ws.cell(leyenda, 2, "Leyenda:").font = F_BOLD
    ws.cell(leyenda + 1, 2, "Fila naranja = confianza baja: revisar la clasificación antes de enviar.").font = F_NORMAL
    ws.cell(leyenda + 2, 2, "Celda amarilla en 'Confianza' = confianza media.").font = F_NORMAL
    ws.cell(leyenda + 3, 2, "Códigos válidos: ver assets/categorias.json del plugin.").font = F_NORMAL

    return {
        "rF": f"'{HOJA_DETALLE}'!{rF}",
        "rJ": f"'{HOJA_DETALLE}'!{rJ}",
        "total_portafolio": celdas[0],
        "total_empresas": celdas[1],
    }


def llenar_plantilla(ws, cats, refs):
    for cod, cat in cats.items():
        celda = cat.get("celda")
        if not celda or cod in FUERA:
            continue
        ws[celda] = (f"=IFERROR(SUMIFS({refs['rJ']},{refs['rF']},\"{cod}\")"
                     f"/{refs['total_portafolio']},0)")
    ws["D8"] = (f"=IFERROR({refs['total_empresas']}/"
                f"({refs['total_empresas']}+{refs['total_portafolio']}),0)")


def resumen_python(entrada, cats, tc):
    por_cat = defaultdict(float)
    for p in entrada["posiciones"]:
        usd = float(p["monto"]) / tc[(p.get("moneda") or "USD").upper()]
        por_cat[p["categoria"]] += usd
    total_port = sum(v for k, v in por_cat.items() if k not in FUERA)
    emp = por_cat.get("EMPRESA_PRIVADA", 0.0)
    filas = []
    peru = ext = 0.0
    for cod, cat in cats.items():
        if cod in FUERA or por_cat.get(cod, 0) == 0:
            continue
        pct = por_cat[cod] / total_port if total_port else 0
        filas.append({"codigo": cod, "categoria": etiqueta(cat), "celda": cat["celda"],
                      "usd": round(por_cat[cod], 2), "pct": round(pct * 100, 2)})
        if cat["region"] == "Perú":
            peru += pct
        else:
            ext += pct
    bajas = [p.get("instrumento") for p in entrada["posiciones"]
             if (p.get("confianza") or "media").lower() == "baja"]
    return {
        "total_portafolio_usd": round(total_port, 2),
        "empresas_privadas_usd": round(emp, 2),
        "pct_empresas_privadas_D8": round(emp / (emp + total_port) * 100, 2) if (emp + total_port) else 0,
        "excluido_usd": round(por_cat.get("EXCLUIR", 0.0), 2),
        "por_categoria": filas,
        "suma_pct": round(sum(f["pct"] for f in filas), 2),
        "geografia_pct": {"Perú": round(peru * 100, 2), "Extranjero": round(ext * 100, 2)},
        "revisar_confianza_baja": bajas,
    }


def main():
    if len(sys.argv) != 3:
        fallar("Uso: python llenar_plantilla.py posiciones.json salida.xlsx")
    entrada_path, salida = sys.argv[1], sys.argv[2]
    with open(entrada_path, encoding="utf-8") as f:
        entrada = json.load(f)
    cats = cargar_categorias()
    tc = validar(entrada, cats)

    # Guarda el estado completo dentro del Excel (hoja oculta) para poder
    # retomar el avance en otra conversación con importar_excel.py.
    estado_json = json.dumps(entrada, ensure_ascii=False)

    shutil.copyfile(PLANTILLA, salida)
    os.chmod(salida, 0o644)
    wb = load_workbook(salida)
    if HOJA_PLANTILLA not in wb.sheetnames:
        fallar(f"La plantilla no tiene la hoja '{HOJA_PLANTILLA}'.")
    for nombre in (HOJA_DETALLE, HOJA_TC, HOJA_ESTADO):
        if nombre in wb.sheetnames:
            del wb[nombre]

    rango_tc = hoja_tipos_cambio(wb, tc, entrada)
    refs = hoja_detalle(wb, entrada, cats, rango_tc)
    llenar_plantilla(wb[HOJA_PLANTILLA], cats, refs)
    oculta = wb.create_sheet(HOJA_ESTADO)
    # Celdas de máx. 32.767 caracteres: se parte el JSON en trozos.
    for i in range(0, len(estado_json), 30000):
        oculta.cell(i // 30000 + 1, 1, estado_json[i:i + 30000])
    oculta.sheet_state = "hidden"
    # Orden: plantilla primero, luego el detalle y los tipos de cambio.
    wb._sheets = [wb[HOJA_PLANTILLA], wb[HOJA_DETALLE], wb[HOJA_TC], oculta]
    wb.active = 0
    wb.calculation.fullCalcOnLoad = True  # Excel recalcula al abrir
    wb.save(salida)

    res = resumen_python(entrada, cats, tc)
    res["archivo"] = salida
    print(json.dumps(res, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
