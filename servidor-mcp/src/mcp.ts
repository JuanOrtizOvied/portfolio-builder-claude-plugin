// Servidor MCP mínimo (transporte "Streamable HTTP", respuestas JSON, sin estado).
import instrucciones from "../contenido/instrucciones.md";
import guia from "../contenido/guia-paso-a-paso.md";
import reglas from "../contenido/reglas-clasificacion.md";
import meta from "../package.json";
import { CATEGORIAS, CODIGOS, Estado, FUERA, codificar, decodificar, etiqueta, resumir, validar } from "./portafolio";

const VERSIONES_PROTOCOLO = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
export const VERSION = meta.version;

const esquemaEstado = {
  type: "object",
  description: "Estado COMPLETO del portafolio (todas las posiciones acumuladas, no solo las nuevas).",
  properties: {
    cliente: { type: "string", description: "Nombre de la persona." },
    fecha_corte: { type: "string", description: "Fecha de corte de los documentos, AAAA-MM-DD." },
    tipos_cambio: {
      type: "object",
      description: "Unidades de cada moneda por 1 USD. Ej.: {\"PEN\": 3.75}. USD no hace falta.",
      additionalProperties: { type: "number" },
    },
    fuente_tipos_cambio: { type: "string" },
    secciones: {
      type: "object",
      description: "Avance por sección, claves \"1\" a \"6\" como en la plantilla. Solo 'completa' o 'no_aplica' si la persona lo confirmó.",
      additionalProperties: {
        type: "object",
        properties: { estado: { type: "string", enum: ["pendiente", "completa", "no_aplica"] } },
        required: ["estado"],
      },
    },
    posiciones: {
      type: "array",
      items: {
        type: "object",
        properties: {
          institucion: { type: "string" },
          cuenta: { type: "string" },
          instrumento: { type: "string" },
          ticker_isin: { type: "string" },
          categoria: { type: "string", enum: CODIGOS, description: "Código de categoría (ver obtener_reglas_clasificacion)." },
          monto: { type: "number", description: "Valor de mercado en la moneda original." },
          moneda: { type: "string", description: "ISO: USD, PEN, EUR…" },
          fuente: { type: "string", description: "Archivo y página de donde sale el dato." },
          confianza: { type: "string", enum: ["alta", "media", "baja"] },
          nota: { type: "string", description: "Por qué se eligió la categoría." },
        },
        required: ["instrumento", "categoria", "monto"],
      },
    },
  },
  required: ["posiciones"],
};

const HERRAMIENTAS = [
  {
    name: "obtener_instrucciones",
    title: "Instrucciones para armar el portafolio",
    description:
      "LLAMA ESTA HERRAMIENTA PRIMERO cuando alguien quiera armar, clasificar, continuar o actualizar su portafolio de inversión, o suba estados de cuenta, capturas, PDFs o factsheets de sus inversiones. Devuelve el flujo paso a paso y la guía vigente de Sabbi.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: "obtener_reglas_clasificacion",
    title: "Reglas y categorías",
    description:
      "Devuelve las categorías y subcategorías de la plantilla de Sabbi con sus códigos y las reglas para clasificar cada producto. Llámala antes de clasificar el primer producto de la conversación.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: "actualizar_dashboard",
    title: "Actualizar dashboard",
    description:
      "Valida el portafolio, calcula los porcentajes por sección y subcategoría y devuelve el enlace del dashboard (con botón para descargar el Excel). Envía siempre el estado COMPLETO. Los datos no se guardan en el servidor: viajan dentro del enlace.",
    inputSchema: { type: "object", properties: { estado: esquemaEstado }, required: ["estado"] },
    annotations: { readOnlyHint: true },
  },
  {
    name: "leer_enlace",
    title: "Retomar desde un enlace",
    description:
      "Recupera el estado del portafolio a partir de un enlace de dashboard generado antes (contiene '#v1.'). Úsala cuando la persona pegue su enlace para continuar o actualizar.",
    inputSchema: {
      type: "object",
      properties: { enlace: { type: "string", description: "El enlace completo del dashboard." } },
      required: ["enlace"],
    },
    annotations: { readOnlyHint: true },
  },
];

function texto(t: string, isError = false) {
  return { content: [{ type: "text", text: t }], ...(isError ? { isError: true } : {}) };
}

async function llamarHerramienta(nombre: string, args: any, origen: string) {
  switch (nombre) {
    case "obtener_instrucciones":
      return texto(`Versión vigente del conector: ${VERSION}\n\n${instrucciones}\n\n---\n\n${guia}`);

    case "obtener_reglas_clasificacion": {
      const lista = Object.values(CATEGORIAS)
        .map((c) => `- \`${c.codigo}\` — ${etiqueta(c)}${FUERA.has(c.codigo) ? " (no suma al portafolio)" : ""}`)
        .join("\n");
      return texto(`## Códigos de categoría válidos\n\n${lista}\n\n---\n\n${reglas}`);
    }

    case "actualizar_dashboard": {
      const estado: Estado = args?.estado;
      const { errores, tc } = validar(estado);
      if (errores.length) return texto(`No se generó el dashboard. Corrige y vuelve a llamar:\n- ${errores.join("\n- ")}`, true);
      const enlace = `${origen}/d#${await codificar(estado)}`;
      const resumen = resumir(estado, tc);
      return texto(JSON.stringify({ version: VERSION, enlace_dashboard: enlace, resumen }, null, 2));
    }

    case "leer_enlace": {
      try {
        const estado = await decodificar(String(args?.enlace || ""));
        return texto(JSON.stringify({ version: VERSION, estado }, null, 2));
      } catch {
        return texto("No pude leer ese enlace. Pide a la persona que copie el enlace completo del dashboard (incluida la parte después de '#').", true);
      }
    }
  }
  return null;
}

async function atender(msg: any, origen: string): Promise<any | null> {
  const { id, method, params } = msg || {};
  const esNotificacion = id === undefined || id === null;
  const ok = (result: any) => ({ jsonrpc: "2.0", id, result });
  const err = (code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

  if (esNotificacion) return null; // notifications/initialized, cancelled, etc.

  switch (method) {
    case "initialize": {
      const pedida = params?.protocolVersion;
      return ok({
        protocolVersion: VERSIONES_PROTOCOLO.includes(pedida) ? pedida : VERSIONES_PROTOCOLO[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "sabbi-portafolio", title: "Sabbi · Portafolio", version: VERSION },
        instructions:
          "Conector de Sabbi para armar portafolios de inversión. Ante cualquier pedido sobre armar, clasificar o continuar un portafolio, llama primero a obtener_instrucciones.",
      });
    }
    case "ping":
      return ok({});
    case "tools/list":
      return ok({ tools: HERRAMIENTAS });
    case "tools/call": {
      const r = await llamarHerramienta(params?.name, params?.arguments, origen);
      return r ? ok(r) : err(-32602, `Herramienta desconocida: ${params?.name}`);
    }
    case "resources/list":
      return ok({ resources: [] });
    case "prompts/list":
      return ok({ prompts: [] });
    default:
      return err(-32601, `Método no soportado: ${method}`);
  }
}

export async function manejarMcp(req: Request): Promise<Response> {
  const origen = new URL(req.url).origin;
  if (req.method !== "POST") {
    return new Response("Este endpoint MCP solo acepta POST.", { status: 405, headers: { Allow: "POST" } });
  }
  let cuerpo: any;
  try {
    cuerpo = await req.json();
  } catch {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON inválido" } }, { status: 400 });
  }
  const lote = Array.isArray(cuerpo);
  const respuestas = (await Promise.all((lote ? cuerpo : [cuerpo]).map((m: any) => atender(m, origen)))).filter(Boolean);
  if (!respuestas.length) return new Response(null, { status: 202 });
  return Response.json(lote ? respuestas : respuestas[0]);
}
