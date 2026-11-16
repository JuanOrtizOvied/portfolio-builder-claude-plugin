// Vista del dashboard dentro de Claude (MCP App).
// Claude la muestra en el chat o en el panel lateral derecho y le entrega el
// resultado de `actualizar_dashboard` (structuredContent).
import css from "../public/dashboard.css";
import categorias from "../public/categorias.json";
import tema from "../public/tema.json";

export const VISTA_URI = "ui://sabbi-portafolio/dashboard";
export const MIME_APP = "text/html;profile=mcp-app";

const js = (x: unknown) => JSON.stringify(x).replace(/</g, "\\u003c");

export function htmlVista(origen: string, version: string): string {
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sabbi · Portafolio</title>
<style>${css}
.acciones{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.btn-sec{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.45);font:inherit;font-weight:600;padding:9px 14px;border-radius:8px;cursor:pointer}
.btn-sec:hover{border-color:#fff}
.compacto .top{padding:20px 16px 52px}.compacto .wrap{padding:0 12px 24px}
.compacto .chips{grid-template-columns:repeat(2,1fr)}.compacto .kpis{grid-template-columns:repeat(2,1fr)}
.compacto .grid,.compacto .dist{grid-template-columns:1fr}.compacto .donut{margin:auto;display:block}
.compacto .fila{grid-template-columns:1.4fr 1fr 50px}.compacto .fila-u{display:none}
</style></head>
<body>
<div id="app"><div class="vacio-total">Preparando tu dashboard…</div></div>
<script>
window.SABBI_EMBED = true;
window.SABBI_BASE = ${js(origen)};
window.SABBI_DATOS = { categorias: ${js(categorias)}, tema: ${js(tema)}, version: ${js(version)} };
</script>
<script src="${origen}/app.js?v=${version}"></script>
<script type="module">
import { App } from "${origen}/vendor/ext-apps-app.js?v=${version}";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const app = new App({ name: "Sabbi Portafolio", version: SABBI_DATOS.version },
                    { availableDisplayModes: ["inline", "fullscreen"] });
const cats = Sabbi.cargarCategorias(SABBI_DATOS.categorias);
let ultimo = null;

function aBase64(buf) {
  const bytes = new Uint8Array(buf); let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

async function excel(estado) {
  if (app.getHostCapabilities()?.downloadFile) {
    const x = await Sabbi.construirExcel(estado, cats);
    const r = await app.downloadFile({ contents: [{ type: "resource",
      resource: { uri: "file:///" + x.nombre, mimeType: XLSX, blob: aBase64(x.buffer) } }] });
    if (!r?.isError) return;
  }
  // Respaldo: abrir el dashboard en el navegador, que descarga el Excel solo.
  await app.openLink({ url: ultimo.enlace_dashboard.replace("/d#", "/d?descargar=1#") });
}

function ajustar() {
  const ctx = app.getHostContext();
  const ancho = ctx?.containerDimensions?.width ?? document.documentElement.clientWidth;
  document.body.classList.toggle("compacto", ancho < 760);
  const exp = document.getElementById("btn-expandir");
  if (exp) exp.hidden = !(ctx?.availableDisplayModes?.includes("fullscreen")) || ctx?.displayMode === "fullscreen";
}

function dibujar(sc) {
  if (!sc || !sc.estado) return;
  ultimo = sc;
  const estado = Object.assign({}, sc.estado, { __enlace: sc.enlace_dashboard });
  Sabbi.render(estado, cats, SABBI_DATOS.tema, sc.version || SABBI_DATOS.version, { onExcel: () => excel(estado) });
  const fila = document.querySelector(".top-row");
  const btnExcel = document.getElementById("btn-excel");
  const acciones = document.createElement("div");
  acciones.className = "acciones";
  acciones.innerHTML = '<button class="btn-sec" id="btn-expandir" hidden>Abrir en panel</button>' +
                       '<button class="btn-sec" id="btn-abrir">Abrir en el navegador</button>';
  fila.replaceChild(acciones, btnExcel);
  acciones.appendChild(btnExcel);
  document.getElementById("btn-abrir").onclick = () => app.openLink({ url: sc.enlace_dashboard });
  document.getElementById("btn-expandir").onclick = () => app.requestDisplayMode({ mode: "fullscreen" }).then(ajustar);
  ajustar();
}

app.ontoolresult = (r) => dibujar(r.structuredContent);
app.addEventListener("hostcontextchanged", ajustar);
await app.connect();
ajustar();
</script>
</body></html>`;
}
