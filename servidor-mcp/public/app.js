// Dashboard de portafolio de Sabbi.
// Los datos llegan comprimidos en el fragmento de la URL (#v1....). El
// navegador nunca envía el fragmento al servidor: todo se procesa aquí.
(function () {
  "use strict";

  var FUERA = { EMPRESA_PRIVADA: 1, EXCLUIR: 1 };
  var ESTADOS = {
    completa: ["Completa", "✓"],
    no_aplica: ["No aplica", "–"],
    en_progreso: ["En progreso · falta confirmar", "◐"],
    sin_datos: ["Sin información aún", "○"],
  };

  function e(x) {
    return String(x == null ? "" : x).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function usd(v) { return "US$ " + Math.round(v).toLocaleString("en-US"); }
  function pct(v) { return (v * 100).toFixed(1) + "%"; }

  async function decodificar(frag) {
    var s = frag.replace(/^v1\./, "").replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    var bin = atob(s), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return JSON.parse(await new Response(stream).text());
  }

  function cargarCategorias(data) {
    var cats = {};
    data.categorias.forEach(function (c) { cats[c.codigo] = c; });
    data.fuera_del_portafolio.forEach(function (c) {
      cats[c.codigo] = Object.assign({}, c, { grupo: "Fuera del portafolio", subgrupo: "", region: null });
    });
    return cats;
  }

  function calcular(estado, cats) {
    var tc = { USD: 1 };
    Object.keys(estado.tipos_cambio || {}).forEach(function (k) { tc[k.toUpperCase()] = Number(estado.tipos_cambio[k]); });
    var porCat = {}, filas = [];
    (estado.posiciones || []).forEach(function (p) {
      if (!cats[p.categoria]) return;
      var mon = (p.moneda || "USD").toUpperCase();
      var v = Number(p.monto) / (tc[mon] || NaN);
      if (!isFinite(v)) v = 0;
      porCat[p.categoria] = (porCat[p.categoria] || 0) + v;
      filas.push(Object.assign({}, p, { moneda: mon, usd: v }));
    });
    var total = 0;
    Object.keys(porCat).forEach(function (k) { if (!FUERA[k]) total += porCat[k]; });
    var secciones = {}, peru = 0, nSec = {};
    Object.keys(cats).forEach(function (cod) {
      var c = cats[cod];
      if (FUERA[cod]) return;
      var num = c.grupo.split(".")[0];
      var s = secciones[num] || (secciones[num] = { num: num, nombre: c.grupo.split(". ")[1], usd: 0, subgrupos: {}, orden: [] });
      var v = porCat[cod] || 0;
      s.usd += v;
      if (!s.subgrupos[c.subgrupo]) { s.subgrupos[c.subgrupo] = []; s.orden.push(c.subgrupo); }
      s.subgrupos[c.subgrupo].push({ nombre: c.nombre, usd: v, codigo: cod });
      if (c.region === "Perú") peru += v;
    });
    filas.forEach(function (f) {
      if (FUERA[f.categoria]) return;
      var n = cats[f.categoria].grupo.split(".")[0];
      nSec[n] = (nSec[n] || 0) + 1;
    });
    return { tc: tc, porCat: porCat, filas: filas, total: total, emp: porCat.EMPRESA_PRIVADA || 0,
             secciones: secciones, peru: peru, ext: total - peru, nSec: nSec };
  }

  function estadoSeccion(n, estado, d) {
    var conf = ((estado.secciones || {})[n] || {}).estado;
    if (conf === "completa" || conf === "no_aplica") return conf;
    return d.nSec[n] ? "en_progreso" : "sin_datos";
  }

  function donut(d, tema) {
    var r = 70, cx = 90, cy = 90, w = 26, circ = 2 * Math.PI * r, off = 0;
    var out = ['<circle cx="90" cy="90" r="70" fill="none" stroke="' + tema.colores.vacio + '" stroke-width="26"/>'];
    if (d.total > 0) {
      Object.keys(d.secciones).sort().forEach(function (n) {
        var frac = d.secciones[n].usd / d.total;
        if (frac <= 0) return;
        var largo = frac * circ;
        out.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + (tema.colores_secciones[n] || "#999") +
          '" stroke-width="' + w + '" stroke-dasharray="' + largo.toFixed(2) + " " + (circ - largo).toFixed(2) +
          '" stroke-dashoffset="' + (-off).toFixed(2) + '" transform="rotate(-90 90 90)"><title>' + e(d.secciones[n].nombre) + ": " + pct(frac) + "</title></circle>");
        off += largo;
      });
    }
    out.push('<text x="90" y="86" text-anchor="middle" class="d-lbl">Portafolio</text>');
    out.push('<text x="90" y="106" text-anchor="middle" class="d-val">' + e(d.total ? usd(d.total) : "Sin datos aún") + "</text>");
    return '<svg viewBox="0 0 180 180" class="donut" role="img" aria-label="Distribución por sección">' + out.join("") + "</svg>";
  }

  function render(estado, cats, tema, version) {
    var C = tema.colores, d = calcular(estado, cats), nums = Object.keys(d.secciones).sort();
    var root = document.documentElement.style;
    [["--p", C.primario], ["--a", C.acento], ["--bg", C.fondo], ["--card", C.tarjeta], ["--t", C.texto],
     ["--ts", C.texto_suave], ["--b", C.borde], ["--al", C.alerta], ["--v", C.vacio], ["--f", tema.fuente]]
      .forEach(function (x) { if (x[1]) root.setProperty(x[0], x[1]); });
    document.title = tema.titulo + (estado.cliente ? " — " + estado.cliente : "");

    var est = {}, completas = 0, enProg = [], sinDatos = [];
    nums.forEach(function (n) {
      est[n] = estadoSeccion(n, estado, d);
      if (est[n] === "completa" || est[n] === "no_aplica") completas++;
      if (est[n] === "en_progreso") enProg.push(d.secciones[n].nombre);
      if (est[n] === "sin_datos") sinDatos.push(d.secciones[n].nombre);
    });

    var chips = nums.map(function (n) {
      var s = d.secciones[n], E = ESTADOS[est[n]], cant = d.nSec[n] || 0;
      return '<div class="chip chip-' + est[n] + '"><span class="dot" style="background:' + tema.colores_secciones[n] + '"></span>' +
        '<span class="chip-n">' + e(s.nombre) + "</span>" +
        (cant ? '<span class="chip-x">' + usd(s.usd) + " · " + cant + " producto" + (cant !== 1 ? "s" : "") + "</span>" : "") +
        '<span class="chip-e">' + E[1] + " " + E[0] + "</span></div>";
    }).join("");
    var banner;
    if (enProg.length || sinDatos.length) {
      var partes = ["Portafolio en construcción: <b>" + completas + " de " + nums.length + "</b> secciones confirmadas."];
      if (enProg.length) partes.push("Con productos, falta confirmar que esté todo: <b>" + e(enProg.join(", ")) + "</b>.");
      if (sinDatos.length) partes.push("Sin información aún: <b>" + e(sinDatos.join(", ")) + "</b>.");
      banner = '<div class="banner">' + partes.join(" ") + "</div>";
    } else {
      banner = '<div class="banner ok">Portafolio completo: todas las secciones fueron revisadas.</div>';
    }

    var revisar = d.filas.filter(function (f) { return (f.confianza || "media").toLowerCase() === "baja"; });
    var patrimonio = d.total + d.emp;
    var nPos = d.filas.filter(function (f) { return !FUERA[f.categoria]; }).length;
    var kpis = [
      ["Portafolio de inversión", usd(d.total), nPos + " posiciones"],
      ["Perú / Extranjero", d.total ? pct(d.peru / d.total) + " / " + pct(d.ext / d.total) : "–", "por ubicación del activo"],
      ["Empresas privadas", patrimonio ? pct(d.emp / patrimonio) : "–", usd(d.emp) + " del patrimonio"],
      ["Por revisar", String(revisar.length), "posiciones con clasificación dudosa"],
    ].map(function (k) {
      return '<div class="kpi"><div class="kpi-l">' + e(k[0]) + '</div><div class="kpi-v">' + e(k[1]) + '</div><div class="kpi-s">' + e(k[2]) + "</div></div>";
    }).join("");

    var leyenda = nums.map(function (n) {
      var s = d.secciones[n], frac = d.total ? s.usd / d.total : 0;
      return '<div class="ley"><span class="dot" style="background:' + tema.colores_secciones[n] + '"></span><span class="ley-n">' + e(s.nombre) +
        '</span><span class="ley-p">' + pct(frac) + '</span><span class="ley-u">' + usd(s.usd) + "</span></div>";
    }).join("");

    var tarjetas = nums.map(function (n) {
      var s = d.secciones[n], color = tema.colores_secciones[n], fracS = d.total ? s.usd / d.total : 0, E = ESTADOS[est[n]];
      var agrupa = s.orden.some(function (sub) { return s.subgrupos[sub].length > 1; });
      var cuerpo = s.orden.map(function (sub) {
        var items = s.subgrupos[sub];
        var titulo = agrupa && !(items.length === 1 && items[0].nombre === sub) ? '<div class="sub">' + e(sub) + "</div>" : "";
        return titulo + items.map(function (it) {
          var f = d.total ? it.usd / d.total : 0, ancho = fracS ? f / fracS * 100 : 0;
          return '<div class="fila' + (it.usd ? "" : " vacio") + '"><div class="fila-n">' + e(it.nombre) + "</div>" +
            '<div class="barra"><div style="width:' + ancho.toFixed(1) + "%;background:" + color + '"></div></div>' +
            '<div class="fila-p">' + (it.usd ? pct(f) : "—") + '</div><div class="fila-u">' + (it.usd ? usd(it.usd) : "") + "</div></div>";
        }).join("");
      }).join("");
      return '<section class="card sec" style="border-top-color:' + color + '"><header><div><div class="sec-num" style="color:' + color + '">' + n +
        "</div><h3>" + e(s.nombre) + '</h3></div><div class="sec-tot"><div class="sec-p">' + pct(fracS) + '</div><div class="sec-u">' + usd(s.usd) +
        '</div><div class="sec-e est-' + est[n] + '">' + E[1] + " " + E[0] + "</div></div></header>" + cuerpo + "</section>";
    }).join("");

    var rev = revisar.length ? '<section class="card alerta"><h2>Por revisar</h2><ul>' + revisar.map(function (f) {
      return "<li><b>" + e(f.instrumento) + "</b> — " + e(f.nota || "Revisar clasificación") + "</li>";
    }).join("") + "</ul></section>" : "";

    var filas = d.filas.slice().sort(function (a, b) {
      return (FUERA[a.categoria] ? 1 : 0) - (FUERA[b.categoria] ? 1 : 0) || b.usd - a.usd;
    }).map(function (f) {
      var c = cats[f.categoria];
      var txt = FUERA[f.categoria] ? "Fuera del portafolio" :
        c.grupo.split(". ")[1] + " › " + (c.nombre === c.subgrupo ? c.nombre : c.subgrupo + " › " + c.nombre);
      var conf = (f.confianza || "media").toLowerCase();
      return "<tr><td>" + e(f.instrumento) + '<div class="tk">' + e(f.ticker_isin) + "</div></td><td>" + e(f.institucion) + "</td><td>" + e(txt) +
        '</td><td class="num">' + e(f.moneda) + " " + Math.round(Number(f.monto)).toLocaleString("en-US") + '</td><td class="num">' + usd(f.usd) +
        '</td><td><span class="conf conf-' + conf + '">' + e(conf) + '</span></td><td class="src">' + e(f.fuente) + "</td></tr>";
    }).join("");
    var detalle = filas ? '<details class="card"><summary>Ver detalle de las ' + d.filas.length + " posiciones</summary>" +
      '<div class="tabla"><table><thead><tr><th>Instrumento</th><th>Institución</th><th>Categoría</th><th class="num">Monto</th>' +
      '<th class="num">USD</th><th>Confianza</th><th>Fuente</th></tr></thead><tbody>' + filas + "</tbody></table></div></details>" : "";

    var tcTxt = Object.keys(estado.tipos_cambio || {}).map(function (k) { return k + ": " + estado.tipos_cambio[k]; }).join(" · ");
    var pie = "Generado por Sabbi · Portafolio v" + e(version) + " · Fecha de corte " + e(estado.fecha_corte || "s/f") +
      (tcTxt ? " · Tipo de cambio por US$1 — " + e(tcTxt) : "") + " · Montos a valor de mercado según los documentos entregados." +
      "<br>Tus datos están dentro de este enlace y no se guardan en ningún servidor. Guárdalo para volver a verlo.";

    document.getElementById("app").innerHTML =
      '<div class="top"><div class="top-in"><div class="marca">' + e(tema.marca) + '</div><div class="top-row"><div><h1>' + e(tema.titulo) +
      '</h1><div class="meta">' + e(estado.cliente || "") + " · Fecha de corte " + e(estado.fecha_corte || "s/f") +
      '</div></div><button class="btn" id="btn-excel">Descargar Excel</button></div></div></div>' +
      '<main class="wrap"><div class="card">' + banner + '<div class="chips">' + chips + "</div></div>" +
      '<div class="kpis">' + kpis + "</div>" +
      '<section class="card"><h2>Distribución por sección</h2><div class="dist">' + donut(d, tema) + "<div>" + leyenda + "</div></div></section>" +
      rev + '<h2 class="mt">Categorías y subcategorías</h2><div class="grid">' + tarjetas + "</div>" +
      '<div class="mt">' + detalle + '</div><div class="pie">' + pie + "</div></main>";

    var btn = document.getElementById("btn-excel");
    btn.addEventListener("click", function () {
      btn.disabled = true; btn.textContent = "Generando…";
      generarExcel(estado, cats, d).catch(function (err) {
        console.error(err); alert("No se pudo generar el Excel: " + err.message);
      }).finally(function () { btn.disabled = false; btn.textContent = "Descargar Excel"; });
    });
  }

  // ---------- Excel (plantilla oficial llena) ----------
  function cargarScript(src) {
    return new Promise(function (ok, mal) {
      if (window.ExcelJS) return ok();
      var s = document.createElement("script");
      s.src = src; s.onload = ok; s.onerror = function () { mal(new Error("no se pudo cargar " + src)); };
      document.head.appendChild(s);
    });
  }

  async function generarExcel(estado, cats, d) {
    await cargarScript("/vendor/exceljs.min.js");
    var buf = await (await fetch("/plantilla-portafolio-final.xlsx")).arrayBuffer();
    var wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    var ws = wb.getWorksheet("Sheet1");
    var A = "Arial", HEAD = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3864" } };
    var BAJA = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE4D6" } };
    var TOT = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } };

    var monedas = ["USD"].concat(Object.keys(d.tc).filter(function (m) { return m !== "USD"; }).sort());
    var rangoTC = "'Tipos de Cambio'!$A$5:$B$" + (4 + monedas.length);

    // Detalle
    var wd = wb.addWorksheet("Detalle Posiciones", { views: [{ state: "frozen", ySplit: 4 }] });
    wd.getCell("A1").value = "Detalle de posiciones — " + (estado.cliente || "Cliente");
    wd.getCell("A1").font = { name: A, size: 13, bold: true };
    wd.getCell("A2").value = "Fecha de corte: " + (estado.fecha_corte || "s/f") + " · Si cambias una categoría o un monto, Sheet1 se recalcula sola.";
    wd.getCell("A2").font = { name: A, size: 9, italic: true };
    var cols = ["#", "Institución", "Cuenta", "Instrumento", "Ticker / ISIN", "Código categoría", "Categoría plantilla", "Moneda",
                "Monto (moneda orig.)", "Monto USD", "Fuente (archivo / página)", "Confianza", "Nota / justificación"];
    var anchos = [5, 18, 14, 34, 16, 22, 52, 8, 18, 16, 28, 11, 60];
    cols.forEach(function (t, j) {
      var c = wd.getCell(4, j + 1); c.value = t; c.fill = HEAD;
      c.font = { name: A, size: 10, bold: true, color: { argb: "FFFFFFFF" } }; c.alignment = { wrapText: true, vertical: "middle" };
      wd.getColumn(j + 1).width = anchos[j];
    });
    var fila = 5;
    d.filas.forEach(function (p, i) {
      var c = cats[p.categoria], conf = (p.confianza || "media").toLowerCase();
      var etq = [c.grupo, c.subgrupo, c.nombre].filter(Boolean).join(" > ");
      var vals = [i + 1, p.institucion, p.cuenta, p.instrumento, p.ticker_isin, p.categoria, etq, p.moneda, Number(p.monto),
        { formula: "IFERROR(I" + fila + "/VLOOKUP(H" + fila + "," + rangoTC + ",2,FALSE),0)", result: p.usd },
        p.fuente, conf, p.nota];
      vals.forEach(function (v, j) {
        var cell = wd.getCell(fila, j + 1);
        cell.value = v == null ? null : v;
        cell.font = { name: A, size: 10, color: (j === 5 || j === 8) ? { argb: "FF0000FF" } : undefined };
        cell.alignment = { vertical: "top", wrapText: j === 3 || j === 6 || j === 12 };
        if (conf === "baja") cell.fill = BAJA;
      });
      wd.getCell(fila, 9).numFmt = "#,##0.00";
      wd.getCell(fila, 10).numFmt = "$#,##0.00";
      fila++;
    });
    var ultima = Math.max(fila - 1, 5);
    var rF = "$F$5:$F$" + ultima, rJ = "$J$5:$J$" + ultima;
    fila += 1;
    var tPort = fila;
    var totales = [
      ["Total Portafolio de Inversión (USD)", "SUM(" + rJ + ")-SUMIFS(" + rJ + "," + rF + ",\"EMPRESA_PRIVADA\")-SUMIFS(" + rJ + "," + rF + ",\"EXCLUIR\")", d.total],
      ["Acciones en Empresas Privadas (USD)", "SUMIFS(" + rJ + "," + rF + ",\"EMPRESA_PRIVADA\")", d.emp],
      ["Excluido (no suma)", "SUMIFS(" + rJ + "," + rF + ",\"EXCLUIR\")", d.porCat.EXCLUIR || 0],
      ["Patrimonio Generador de Ingresos (USD)", "J" + tPort + "+J" + (tPort + 1), d.total + d.emp],
    ];
    totales.forEach(function (t, k) {
      var r = tPort + k;
      wd.getCell(r, 7).value = t[0]; wd.getCell(r, 7).font = { name: A, size: 10, bold: true };
      var c = wd.getCell(r, 10); c.value = { formula: t[1], result: t[2] }; c.numFmt = "$#,##0.00"; c.font = { name: A, size: 10, bold: true };
      [7, 8, 9, 10].forEach(function (j) { wd.getCell(r, j).fill = TOT; });
    });
    var leyenda = tPort + totales.length + 1;
    wd.getCell(leyenda, 2).value = "Fila naranja = confianza baja: revisar la clasificación antes de enviar.";
    wd.getCell(leyenda, 2).font = { name: A, size: 10 };
    wd.getCell(leyenda + 1, 2).value = "Enlace para volver a ver o continuar este portafolio:";
    wd.getCell(leyenda + 1, 2).font = { name: A, size: 10, bold: true };
    wd.getCell(leyenda + 2, 2).value = { text: "Abrir mi dashboard", hyperlink: location.href };
    wd.getCell(leyenda + 2, 2).font = { name: A, size: 10, color: { argb: "FF0563C1" }, underline: true };

    // Tipos de cambio
    var wtc = wb.addWorksheet("Tipos de Cambio");
    wtc.getCell("A1").value = "Tipos de cambio usados (unidades de moneda por 1 USD)";
    wtc.getCell("A1").font = { name: A, size: 13, bold: true };
    wtc.getCell("A2").value = estado.fuente_tipos_cambio || "Fuente: indicada por el usuario o tomada de los estados de cuenta.";
    wtc.getCell("A2").font = { name: A, size: 9, italic: true };
    ["Moneda", "Por 1 USD"].forEach(function (t, j) {
      var c = wtc.getCell(4, j + 1); c.value = t; c.font = { name: A, size: 10, bold: true, color: { argb: "FFFFFFFF" } }; c.fill = HEAD;
    });
    monedas.forEach(function (m, i) {
      wtc.getCell(5 + i, 1).value = m; wtc.getCell(5 + i, 1).font = { name: A, size: 10 };
      var c = wtc.getCell(5 + i, 2); c.value = d.tc[m]; c.numFmt = "0.0000"; c.font = { name: A, size: 10, color: { argb: "FF0000FF" } };
    });
    wtc.getColumn(1).width = 12; wtc.getColumn(2).width = 14;


    // Plantilla: columna ACTUAL (D)
    var DET = "'Detalle Posiciones'!", totRef = DET + "$J$" + tPort;
    Object.keys(cats).forEach(function (cod) {
      var c = cats[cod];
      if (!c.celda || FUERA[cod]) return;
      ws.getCell(c.celda).value = {
        formula: "IFERROR(SUMIFS(" + DET + rJ + "," + DET + rF + ",\"" + cod + "\")/" + totRef + ",0)",
        result: d.total ? (d.porCat[cod] || 0) / d.total : 0,
      };
    });
    var empRef = DET + "$J$" + (tPort + 1);
    ws.getCell("D8").value = { formula: "IFERROR(" + empRef + "/(" + empRef + "+" + totRef + "),0)", result: (d.total + d.emp) ? d.emp / (d.total + d.emp) : 0 };

    wb.calcProperties = Object.assign(wb.calcProperties || {}, { fullCalcOnLoad: true });
    var out = await wb.xlsx.writeBuffer();
    var nombre = "Portafolio_" + (estado.cliente || "cliente").replace(/[^\wÀ-ÿ-]+/g, "_") + "_" + (estado.fecha_corte || "") + ".xlsx";
    var url = URL.createObjectURL(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    var a = document.createElement("a"); a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
  }

  // ---------- Inicio ----------
  async function iniciar() {
    var app = document.getElementById("app");
    var frag = location.hash.slice(1);
    if (!frag) {
      app.innerHTML = '<div class="vacio-total"><h2>Este enlace no tiene datos</h2>Pídele a Claude el enlace de tu dashboard.</div>';
      return;
    }
    try {
      var r = await Promise.all([decodificar(frag), fetch("/categorias.json").then(function (x) { return x.json(); }),
        fetch("/tema.json").then(function (x) { return x.json(); }),
        fetch("/meta.json").then(function (x) { return x.json(); }).catch(function () { return {}; })]);
      render(r[0], cargarCategorias(r[1]), r[2], r[3].version || "");
    } catch (err) {
      console.error(err);
      app.innerHTML = '<div class="vacio-total"><h2>No se pudo abrir el portafolio</h2>El enlace parece incompleto. Copia el enlace completo, incluida la parte después de “#”.</div>';
    }
  }
  window.addEventListener("hashchange", iniciar);
  iniciar();
})();
