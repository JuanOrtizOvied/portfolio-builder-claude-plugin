// Lógica del portafolio: validación, resumen y codificación del enlace.
import categoriasData from "../public/categorias.json";

export interface Categoria {
  codigo: string;
  grupo: string;
  subgrupo: string;
  nombre: string;
  celda: string | null;
  region: string | null;
}

export interface Posicion {
  institucion?: string;
  cuenta?: string;
  instrumento: string;
  ticker_isin?: string;
  categoria: string;
  monto: number;
  moneda?: string;
  fuente?: string;
  confianza?: "alta" | "media" | "baja";
  nota?: string;
}

export interface Estado {
  cliente?: string;
  fecha_corte?: string;
  tipos_cambio?: Record<string, number>;
  fuente_tipos_cambio?: string;
  secciones?: Record<string, { estado: string }>;
  posiciones: Posicion[];
}

export const FUERA = new Set(["EMPRESA_PRIVADA", "EXCLUIR"]);

export const CATEGORIAS: Record<string, Categoria> = (() => {
  const out: Record<string, Categoria> = {};
  for (const c of categoriasData.categorias as Categoria[]) out[c.codigo] = c;
  for (const c of categoriasData.fuera_del_portafolio as any[]) {
    out[c.codigo] = { ...c, grupo: "Fuera del portafolio", subgrupo: "", region: null };
  }
  return out;
})();

export const CODIGOS = Object.keys(CATEGORIAS);

export function etiqueta(c: Categoria): string {
  return [c.grupo, c.subgrupo, c.nombre].filter(Boolean).join(" > ");
}

export function validar(estado: Estado): { errores: string[]; tc: Record<string, number> } {
  const errores: string[] = [];
  if (!estado || typeof estado !== "object") return { errores: ["Falta el objeto 'estado'."], tc: {} };
  const tc: Record<string, number> = { USD: 1 };
  for (const [k, v] of Object.entries(estado.tipos_cambio || {})) {
    const n = Number(v);
    if (!(n > 0)) errores.push(`Tipo de cambio inválido para ${k}: ${v}`);
    tc[k.toUpperCase()] = n;
  }
  (estado.posiciones || []).forEach((p, i) => {
    const id = `Posición ${i + 1} (${p?.instrumento ?? "sin nombre"})`;
    if (!CATEGORIAS[p?.categoria]) errores.push(`${id}: categoría desconocida '${p?.categoria}'.`);
    if (!Number.isFinite(Number(p?.monto))) errores.push(`${id}: monto inválido '${p?.monto}'.`);
    const mon = (p?.moneda || "USD").toUpperCase();
    if (!(mon in tc)) errores.push(`${id}: falta tipo de cambio para ${mon} en 'tipos_cambio'.`);
    if (p?.confianza && !["alta", "media", "baja"].includes(p.confianza))
      errores.push(`${id}: confianza debe ser alta, media o baja.`);
  });
  for (const [k, v] of Object.entries(estado.secciones || {})) {
    if (!["1", "2", "3", "4", "5", "6"].includes(k)) errores.push(`Sección desconocida '${k}' (usa "1" a "6").`);
    if (!["pendiente", "completa", "no_aplica"].includes(v?.estado))
      errores.push(`Sección ${k}: estado debe ser pendiente, completa o no_aplica.`);
  }
  return { errores, tc };
}

export function resumir(estado: Estado, tc: Record<string, number>) {
  const porCat: Record<string, number> = {};
  for (const p of estado.posiciones || []) {
    const usd = Number(p.monto) / tc[(p.moneda || "USD").toUpperCase()];
    porCat[p.categoria] = (porCat[p.categoria] || 0) + usd;
  }
  const total = Object.entries(porCat).filter(([k]) => !FUERA.has(k)).reduce((a, [, v]) => a + v, 0);
  const emp = porCat["EMPRESA_PRIVADA"] || 0;
  const secciones: Record<string, { nombre: string; usd: number; pct: number; estado: string }> = {};
  let peru = 0;
  for (const c of Object.values(CATEGORIAS)) {
    if (FUERA.has(c.codigo)) continue;
    const num = c.grupo.split(".")[0];
    const s = (secciones[num] ||= { nombre: c.grupo.split(". ")[1], usd: 0, pct: 0, estado: estado.secciones?.[num]?.estado || "pendiente" });
    s.usd += porCat[c.codigo] || 0;
    if (c.region === "Perú") peru += porCat[c.codigo] || 0;
  }
  for (const s of Object.values(secciones)) s.pct = total ? +(s.usd / total * 100).toFixed(2) : 0;
  const subcategorias = Object.values(CATEGORIAS)
    .filter((c) => !FUERA.has(c.codigo) && porCat[c.codigo])
    .map((c) => ({ codigo: c.codigo, categoria: etiqueta(c), usd: +porCat[c.codigo].toFixed(2), pct: total ? +(porCat[c.codigo] / total * 100).toFixed(2) : 0 }));
  const r = (x: number) => +x.toFixed(2);
  return {
    total_portafolio_usd: r(total),
    empresas_privadas_usd: r(emp),
    pct_empresas_privadas_del_patrimonio: emp + total ? r(emp / (emp + total) * 100) : 0,
    excluido_usd: r(porCat["EXCLUIR"] || 0),
    geografia_pct: { "Perú": total ? r(peru / total * 100) : 0, Extranjero: total ? r((total - peru) / total * 100) : 0 },
    secciones,
    subcategorias,
    revisar_confianza_baja: (estado.posiciones || []).filter((p) => p.confianza === "baja").map((p) => p.instrumento),
  };
}

// --- Enlace: el estado viaja comprimido en el fragmento (#) de la URL. ---
// El navegador nunca envía el fragmento al servidor, así que los datos no
// quedan registrados en Cloudflare.

function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function transformar(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

export async function codificar(estado: Estado): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(estado));
  return "v1." + b64urlEncode(await transformar(json, new CompressionStream("deflate-raw")));
}

export async function decodificar(enlace: string): Promise<Estado> {
  const frag = enlace.includes("#") ? enlace.slice(enlace.indexOf("#") + 1) : enlace;
  const datos = frag.startsWith("v1.") ? frag.slice(3) : frag;
  const bytes = await transformar(b64urlDecode(datos), new DecompressionStream("deflate-raw"));
  return JSON.parse(new TextDecoder().decode(bytes));
}
