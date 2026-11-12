#!/usr/bin/env python3
"""
Genera un dashboard HTML autocontenido del portafolio a partir del archivo de
estado (mismo formato que posiciones.json, ver references/formato-entrada.md).

Uso:
    python generar_dashboard.py estado.json dashboard.html [--excel Portafolio.xlsx]

- Funciona con el portafolio a medias: muestra el avance por sección y lo que falta.
- Colores, fuente y marca salen de assets/tema.json.
- Con --excel, el archivo se incrusta en la página y aparece el botón "Descargar Excel".
"""
import base64
import html
import json
import math
import os
import sys
from collections import defaultdict

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from llenar_plantilla import FUERA, cargar_categorias, validar  # noqa: E402

ASSETS = os.path.join(AQUI, "..", "assets")
PLUGIN_JSON = os.path.join(AQUI, "..", "..", "..", ".claude-plugin", "plugin.json")

# Estado que se muestra por sección:
#  - completa / no_aplica: la persona lo confirmó.
#  - en_progreso: ya hay productos cargados, pero falta que confirme que es todo.
#  - sin_datos: aún no hay nada ni confirmación.
ESTADOS = {
    "completa": ("Completa", "✓"),
    "no_aplica": ("No aplica", "–"),
    "en_progreso": ("En progreso · falta confirmar", "◐"),
    "sin_datos": ("Sin información aún", "○"),
}


def estado_seccion(n, sec_estado, datos):
    confirmado = (sec_estado.get(n) or {}).get("estado")
    if confirmado in ("completa", "no_aplica"):
        return confirmado
    return "en_progreso" if datos["n_por_seccion"].get(n) else "sin_datos"


def e(x):
    return html.escape("" if x is None else str(x))


def usd(v):
    return f"US$ {v:,.0f}"


def pct(v):
    return f"{v * 100:.1f}%"


def version_plugin():
    try:
        with open(PLUGIN_JSON, encoding="utf-8") as f:
            return json.load(f).get("version", "")
    except OSError:
        return ""


def calcular(entrada, cats, tc):
    por_cat = defaultdict(float)
    filas = []
    for p in entrada.get("posiciones", []):
        mon = (p.get("moneda") or "USD").upper()
        v = float(p["monto"]) / tc[mon]
        por_cat[p["categoria"]] += v
        filas.append({**p, "moneda": mon, "usd": v})
    total = sum(v for k, v in por_cat.items() if k not in FUERA)
    n_por_seccion = defaultdict(int)
    for f in filas:
        if f["categoria"] not in FUERA:
            n_por_seccion[cats[f["categoria"]]["grupo"].split(".")[0]] += 1
    emp = por_cat.get("EMPRESA_PRIVADA", 0.0)

    secciones = {}
    for cod, c in cats.items():
        if cod in FUERA:
            continue
        num = c["grupo"].split(".")[0]
        s = secciones.setdefault(num, {"num": num, "nombre": c["grupo"].split(". ", 1)[1],
                                       "usd": 0.0, "subgrupos": {}})
        v = por_cat.get(cod, 0.0)
        s["usd"] += v
        s["subgrupos"].setdefault(c["subgrupo"], []).append({"nombre": c["nombre"], "usd": v, "codigo": cod})

    peru = sum(por_cat.get(k, 0) for k, c in cats.items() if k not in FUERA and c.get("region") == "Perú")
    return {"total": total, "emp": emp, "secciones": secciones, "filas": filas,
            "peru": peru, "ext": total - peru, "por_cat": por_cat, "n_por_seccion": n_por_seccion}


def donut(secciones, total, tema):
    r, cx, cy, w = 70, 90, 90, 26
    circ = 2 * math.pi * r
    partes = [f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{tema["colores"]["vacio"]}" stroke-width="{w}"/>']
    offset = 0.0
    if total > 0:
        for num in sorted(secciones):
            frac = secciones[num]["usd"] / total
            if frac <= 0:
                continue
            largo = frac * circ
            color = tema["colores_secciones"].get(num, "#999")
            partes.append(
                f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{color}" stroke-width="{w}" '
                f'stroke-dasharray="{largo:.2f} {circ - largo:.2f}" stroke-dashoffset="{-offset:.2f}" '
                f'transform="rotate(-90 {cx} {cy})"><title>{e(secciones[num]["nombre"])}: {pct(frac)}</title></circle>')
            offset += largo
    centro = usd(total) if total else "Sin datos aún"
    partes.append(f'<text x="{cx}" y="{cy - 4}" text-anchor="middle" class="d-lbl">Portafolio</text>')
    partes.append(f'<text x="{cx}" y="{cy + 16}" text-anchor="middle" class="d-val">{e(centro)}</text>')
    return f'<svg viewBox="0 0 180 180" class="donut" role="img" aria-label="Distribución por sección">{"".join(partes)}</svg>'


def html_dashboard(entrada, datos, tema, excel_b64, excel_nombre):
    C = tema["colores"]
    total = datos["total"]
    sec_estado = entrada.get("secciones") or {}
    nums = sorted(datos["secciones"])
    estados = {n: estado_seccion(n, sec_estado, datos) for n in nums}
    completas = sum(1 for n in nums if estados[n] in ("completa", "no_aplica"))
    en_progreso = [datos["secciones"][n]["nombre"] for n in nums if estados[n] == "en_progreso"]
    sin_datos = [datos["secciones"][n]["nombre"] for n in nums if estados[n] == "sin_datos"]
    revisar = [f for f in datos["filas"] if (f.get("confianza") or "media").lower() == "baja"]

    # Avance
    chips = []
    for n in nums:
        est = estados[n]
        etq, ico = ESTADOS[est]
        cant = datos["n_por_seccion"].get(n, 0)
        extra = (f'<span class="chip-x">{usd(datos["secciones"][n]["usd"])} · {cant} producto{"s" if cant != 1 else ""}</span>'
                 if cant else "")
        chips.append(f'<div class="chip chip-{est}"><span class="dot" style="background:{tema["colores_secciones"].get(n)}"></span>'
                     f'<span class="chip-n">{e(datos["secciones"][n]["nombre"])}</span>{extra}'
                     f'<span class="chip-e">{ico} {etq}</span></div>')
    if en_progreso or sin_datos:
        partes = [f'Portafolio en construcción: <b>{completas} de {len(nums)}</b> secciones confirmadas.']
        if en_progreso:
            partes.append(f'Con productos, falta confirmar que esté todo: <b>{e(", ".join(en_progreso))}</b>.')
        if sin_datos:
            partes.append(f'Sin información aún: <b>{e(", ".join(sin_datos))}</b>.')
        banner = f'<div class="banner">{" ".join(partes)}</div>'
    else:
        banner = '<div class="banner ok">Portafolio completo: todas las secciones fueron revisadas.</div>'

    # KPIs
    patrimonio = total + datos["emp"]
    kpis = [
        ("Portafolio de inversión", usd(total), f'{len([f for f in datos["filas"] if f["categoria"] not in FUERA])} posiciones'),
        ("Perú / Extranjero", f'{pct(datos["peru"] / total) if total else "–"} / {pct(datos["ext"] / total) if total else "–"}', "por ubicación del activo"),
        ("Empresas privadas", pct(datos["emp"] / patrimonio) if patrimonio else "–", f'{usd(datos["emp"])} del patrimonio'),
        ("Por revisar", str(len(revisar)), "posiciones con clasificación dudosa"),
    ]
    kpi_html = "".join(f'<div class="kpi"><div class="kpi-l">{e(a)}</div><div class="kpi-v">{e(b)}</div><div class="kpi-s">{e(c)}</div></div>'
                       for a, b, c in kpis)

    # Leyenda del donut
    leyenda = []
    for n in nums:
        s = datos["secciones"][n]
        frac = s["usd"] / total if total else 0
        leyenda.append(f'<div class="ley"><span class="dot" style="background:{tema["colores_secciones"].get(n)}"></span>'
                       f'<span class="ley-n">{e(s["nombre"])}</span><span class="ley-p">{pct(frac)}</span>'
                       f'<span class="ley-u">{usd(s["usd"])}</span></div>')

    # Tarjetas por sección con todas las subcategorías
    tarjetas = []
    for n in nums:
        s = datos["secciones"][n]
        color = tema["colores_secciones"].get(n)
        frac_s = s["usd"] / total if total else 0
        cuerpo = []
        # Títulos de subgrupo solo si la sección realmente agrupa varias
        # subcategorías bajo un mismo título (p. ej. Real Estate Perú).
        agrupa = any(len(items) > 1 for items in s["subgrupos"].values())
        for sub, items in s["subgrupos"].items():
            mostrar_sub = agrupa and not (len(items) == 1 and items[0]["nombre"] == sub)
            if mostrar_sub:
                cuerpo.append(f'<div class="sub">{e(sub)}</div>')
            for it in items:
                f_ = it["usd"] / total if total else 0
                vacio = " vacio" if it["usd"] == 0 else ""
                ancho = max(f_ / frac_s * 100, 0) if frac_s else 0
                cuerpo.append(
                    f'<div class="fila{vacio}"><div class="fila-n">{e(it["nombre"])}</div>'
                    f'<div class="barra"><div style="width:{ancho:.1f}%;background:{color}"></div></div>'
                    f'<div class="fila-p">{pct(f_) if it["usd"] else "—"}</div>'
                    f'<div class="fila-u">{usd(it["usd"]) if it["usd"] else ""}</div></div>')
        est = estados[n]
        etq, ico = ESTADOS[est]
        tarjetas.append(
            f'<section class="card sec" style="border-top-color:{color}"><header>'
            f'<div><div class="sec-num" style="color:{color}">{e(n)}</div><h3>{e(s["nombre"])}</h3></div>'
            f'<div class="sec-tot"><div class="sec-p">{pct(frac_s)}</div><div class="sec-u">{usd(s["usd"])}</div>'
            f'<div class="sec-e est-{est}">{ico} {etq}</div></div></header>{"".join(cuerpo)}</section>')

    # Por revisar
    rev_html = ""
    if revisar:
        items = "".join(f'<li><b>{e(f.get("instrumento"))}</b> — {e(f.get("nota") or "Revisar clasificación")}</li>' for f in revisar)
        rev_html = f'<section class="card alerta"><h2>Por revisar</h2><ul>{items}</ul></section>'

    # Detalle
    filas = []
    for f in sorted(datos["filas"], key=lambda x: (x["categoria"] in FUERA, -x["usd"])):
        c = CATS[f["categoria"]]
        cat_txt = "Fuera del portafolio" if f["categoria"] in FUERA else f'{c["grupo"].split(". ", 1)[1]} › {c["nombre"] if c["nombre"] == c["subgrupo"] else c["subgrupo"] + " › " + c["nombre"]}'
        conf = (f.get("confianza") or "media").lower()
        filas.append(f'<tr><td>{e(f.get("instrumento"))}<div class="tk">{e(f.get("ticker_isin"))}</div></td>'
                     f'<td>{e(f.get("institucion"))}</td><td>{e(cat_txt)}</td>'
                     f'<td class="num">{e(f["moneda"])} {float(f["monto"]):,.0f}</td><td class="num">{usd(f["usd"])}</td>'
                     f'<td><span class="conf conf-{conf}">{e(conf)}</span></td><td class="src">{e(f.get("fuente"))}</td></tr>')
    detalle = (f'<details class="card"><summary>Ver detalle de las {len(filas)} posiciones</summary>'
               f'<div class="tabla"><table><thead><tr><th>Instrumento</th><th>Institución</th><th>Categoría</th>'
               f'<th class="num">Monto</th><th class="num">USD</th><th>Confianza</th><th>Fuente</th></tr></thead>'
               f'<tbody>{"".join(filas)}</tbody></table></div></details>') if filas else ""

    boton = ""
    if excel_b64:
        boton = (f'<a class="btn" download="{e(excel_nombre)}" '
                 f'href="data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,{excel_b64}">'
                 f'Descargar Excel</a>')

    tcs = entrada.get("tipos_cambio") or {}
    tc_txt = " · ".join(f"{k}: {v}" for k, v in tcs.items())
    pie = (f'Generado por portafolio-builder v{e(version_plugin())} · Fecha de corte {e(entrada.get("fecha_corte") or "s/f")}'
           + (f' · Tipo de cambio por US$1 — {e(tc_txt)}' if tc_txt else "")
           + ' · Montos a valor de mercado según los documentos entregados.')

    css = f"""
:root{{--p:{C['primario']};--a:{C['acento']};--bg:{C['fondo']};--card:{C['tarjeta']};--t:{C['texto']};
--ts:{C['texto_suave']};--b:{C['borde']};--al:{C['alerta']};--v:{C['vacio']}}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--t);font-family:{tema['fuente']};font-size:14px;line-height:1.45}}
.top{{background:var(--p);color:#fff;padding:28px 32px 64px}}
.top-in,.wrap{{max-width:1160px;margin:0 auto}}
.marca{{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--a);font-weight:700}}
.top h1{{margin:6px 0 4px;font-size:28px;font-weight:650;letter-spacing:-.01em}}
.top .meta{{opacity:.75}}
.top-row{{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap}}
.btn{{background:var(--a);color:var(--p);text-decoration:none;font-weight:700;padding:10px 18px;border-radius:8px;white-space:nowrap}}
.btn:hover{{filter:brightness(1.07)}}
.wrap{{padding:0 32px 40px;margin-top:-40px}}
.card{{background:var(--card);border:1px solid var(--b);border-radius:12px;padding:20px;margin-bottom:16px}}
.banner{{background:#FFF7E8;border:1px solid #F1D9A8;color:#6A4A10;border-radius:10px;padding:12px 16px;margin-bottom:12px}}
.banner.ok{{background:#EEF6EF;border-color:#C6E0C9;color:#2D5A34}}
.chips{{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}}
.chip{{border:1px solid var(--b);border-radius:10px;padding:10px;background:var(--card);display:flex;flex-direction:column;gap:4px}}
.chip-n{{font-weight:600;font-size:13px}}.chip-e{{font-size:12px;color:var(--ts)}}
.chip-x{{font-size:12px;color:var(--t);font-variant-numeric:tabular-nums}}
.chip-completa .chip-e{{color:#2D7A3A}}.chip-en_progreso{{border-color:#E8C27A;background:#FFFBF2}}.chip-en_progreso .chip-e{{color:#9A6A12}}
.chip-sin_datos{{border-style:dashed}}
.dot{{display:inline-block;width:10px;height:10px;border-radius:50%;flex:none}}
.kpis{{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}}
.kpi{{background:var(--card);border:1px solid var(--b);border-radius:12px;padding:16px 18px}}
.kpi-l{{color:var(--ts);font-size:12px;text-transform:uppercase;letter-spacing:.06em}}
.kpi-v{{font-size:24px;font-weight:700;margin:4px 0;font-variant-numeric:tabular-nums}}.kpi-s{{color:var(--ts);font-size:12px}}
.dist{{display:grid;grid-template-columns:220px 1fr;gap:28px;align-items:center}}
.donut{{width:200px;height:200px}}.d-lbl{{font-size:10px;fill:var(--ts)}}.d-val{{font-size:15px;font-weight:700;fill:var(--t)}}
.ley{{display:grid;grid-template-columns:14px 1fr 70px 130px;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--b)}}
.ley:last-child{{border:0}}.ley-p{{text-align:right;font-weight:700;font-variant-numeric:tabular-nums}}.ley-u{{text-align:right;color:var(--ts);font-variant-numeric:tabular-nums}}
h2{{font-size:16px;margin:0 0 12px}}
.grid{{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}}
.sec{{border-top:4px solid;margin:0}}
.sec header{{display:flex;justify-content:space-between;gap:12px;margin-bottom:10px}}
.sec h3{{margin:0;font-size:17px}}.sec-num{{font-weight:800;font-size:12px}}
.sec-tot{{text-align:right}}.sec-p{{font-size:20px;font-weight:700;font-variant-numeric:tabular-nums}}.sec-u{{color:var(--ts);font-size:12px}}
.sec-e{{font-size:11px;margin-top:2px;color:var(--ts)}}.est-completa{{color:#2D7A3A}}.est-en_progreso{{color:#9A6A12}}
.sub{{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--ts);margin:10px 0 2px;font-weight:600}}
.fila{{display:grid;grid-template-columns:1.6fr 1fr 56px 100px;gap:10px;align-items:center;padding:5px 0}}
.fila-n{{font-size:13px}}.fila-p{{text-align:right;font-weight:600;font-variant-numeric:tabular-nums}}
.fila-u{{text-align:right;color:var(--ts);font-size:12px;font-variant-numeric:tabular-nums}}
.barra{{height:8px;background:var(--v);border-radius:4px;overflow:hidden}}.barra div{{height:100%;border-radius:4px}}
.fila.vacio .fila-n,.fila.vacio .fila-p{{color:#B0ADA4;font-weight:400}}
.alerta{{border-left:4px solid var(--al)}}.alerta ul{{margin:0;padding-left:18px}}.alerta li{{margin:4px 0}}
details summary{{cursor:pointer;font-weight:600}}
.tabla{{overflow-x:auto;margin-top:12px}}table{{width:100%;border-collapse:collapse;font-size:13px}}
th{{text-align:left;color:var(--ts);font-weight:600;font-size:12px;border-bottom:1px solid var(--b);padding:8px}}
td{{padding:8px;border-bottom:1px solid var(--b);vertical-align:top}}.num{{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}}
.tk{{color:var(--ts);font-size:11px}}.src{{color:var(--ts);font-size:12px}}
.conf{{font-size:11px;padding:2px 8px;border-radius:10px;background:var(--v)}}.conf-baja{{background:#FBE3CF;color:#8A4A0F}}.conf-alta{{background:#E3F0E5;color:#2D5A34}}
.pie{{color:var(--ts);font-size:12px;text-align:center;margin-top:24px}}
.mt{{margin-top:16px}}
@media (max-width:900px){{.chips{{grid-template-columns:repeat(3,1fr)}}.kpis{{grid-template-columns:repeat(2,1fr)}}.grid,.dist{{grid-template-columns:1fr}}.donut{{margin:auto;display:block}}}}
@media (max-width:520px){{.top,.wrap{{padding-left:16px;padding-right:16px}}.chips{{grid-template-columns:repeat(2,1fr)}}.fila{{grid-template-columns:1.4fr 1fr 50px}}.fila-u{{display:none}}}}
"""
    return f"""<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(tema['titulo'])} — {e(entrada.get('cliente') or '')}</title><style>{css}</style></head>
<body>
<div class="top"><div class="top-in"><div class="marca">{e(tema['marca'])}</div>
<div class="top-row"><div><h1>{e(tema['titulo'])}</h1>
<div class="meta">{e(entrada.get('cliente') or '')} · Fecha de corte {e(entrada.get('fecha_corte') or 's/f')}</div></div>{boton}</div></div></div>
<main class="wrap">
<div class="card">{banner}<div class="chips">{''.join(chips)}</div></div>
<div class="kpis">{kpi_html}</div>
<section class="card"><h2>Distribución por sección</h2><div class="dist">{donut(datos['secciones'], total, tema)}<div>{''.join(leyenda)}</div></div></section>
{rev_html}
<h2 class="mt">Categorías y subcategorías</h2>
<div class="grid">{''.join(tarjetas)}</div>
<div class="mt">{detalle}</div>
<div class="pie">{pie}</div>
</main></body></html>"""


CATS = {}


def main():
    args = sys.argv[1:]
    excel = None
    if "--excel" in args:
        i = args.index("--excel")
        excel = args[i + 1]
        del args[i:i + 2]
    if len(args) != 2:
        print(json.dumps({"error": "Uso: python generar_dashboard.py estado.json dashboard.html [--excel archivo.xlsx]"}))
        sys.exit(1)
    with open(args[0], encoding="utf-8") as f:
        entrada = json.load(f)
    with open(os.path.join(ASSETS, "tema.json"), encoding="utf-8") as f:
        tema = json.load(f)
    CATS.update(cargar_categorias())
    tc = validar(entrada, CATS, permitir_vacio=True)
    datos = calcular(entrada, CATS, tc)

    b64 = nombre = None
    if excel:
        with open(excel, "rb") as f:
            b64 = base64.b64encode(f.read()).decode()
        nombre = os.path.basename(excel)

    with open(args[1], "w", encoding="utf-8") as f:
        f.write(html_dashboard(entrada, datos, tema, b64, nombre))
    print(json.dumps({"archivo": args[1], "total_usd": round(datos["total"], 2),
                      "posiciones": len(datos["filas"]), "excel_incrustado": bool(excel)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
