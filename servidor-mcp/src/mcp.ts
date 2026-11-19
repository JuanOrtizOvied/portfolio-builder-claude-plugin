// Servidor MCP mínimo (transporte "Streamable HTTP", respuestas JSON, sin estado).
import instrucciones from "../contenido/instrucciones.md";
import guia from "../contenido/guia-paso-a-paso.md";
import reglas from "../contenido/reglas-clasificacion.md";
import meta from "../package.json";
import { MIME_APP, VISTA_URI, htmlVista } from "./vista";
import { CATEGORIAS, Estado, FUERA, codificar, decodificar, etiqueta, resumir, validar } from "./portafolio";
import { Usuario, reto401, usuarioDeLaPeticion } from "./auth";
import { cargarPortafolio, guardarPortafolio } from "./almacen";

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
          categoria: { type: "string", description: "Código de categoría. Obtén la lista vigente con obtener_reglas_clasificacion; el servidor valida y rechaza los códigos desconocidos." },
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
      "Valida el portafolio, calcula los porcentajes por sección y subcategoría y muestra el dashboard en Claude (en el panel lateral cuando está disponible), con botón para descargar el Excel. También devuelve un enlace para abrirlo en el navegador. Envía siempre el estado COMPLETO. Los datos no se guardan en el servidor.",
    inputSchema: { type: "object", properties: { estado: esquemaEstado }, required: ["estado"] },
    annotations: { readOnlyHint: true },
    _meta: { ui: { resourceUri: VISTA_URI }, "ui/resourceUri": VISTA_URI },
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
  {
    name: "whoami",
    title: "Quién soy (prueba de login)",
    description:
      "Herramienta de prueba del inicio de sesión. Requiere cuenta: cuando la persona inicia sesión, devuelve su identificador de usuario. Úsala solo para verificar que el login con Supabase funciona.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: "guardar_mi_portafolio",
    title: "Guardar mi portafolio",
    description:
      "Guarda el portafolio de la persona en su cuenta para recuperarlo después desde otro chat. REQUIERE INICIAR SESIÓN. Úsala cuando la persona pida guardar su portafolio en su cuenta. Envía el estado COMPLETO.",
    inputSchema: { type: "object", properties: { estado: esquemaEstado }, required: ["estado"] },
  },
  {
    name: "cargar_mi_ultimo_portafolio",
    title: "Cargar mi último portafolio",
    description:
      "Recupera el último portafolio que la persona guardó en su cuenta y lo muestra en el dashboard. REQUIERE INICIAR SESIÓN. Úsala al inicio de un chat nuevo cuando la persona quiera retomar su portafolio guardado.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    _meta: { ui: { resourceUri: VISTA_URI }, "ui/resourceUri": VISTA_URI },
  },
];

// Herramientas que exigen cuenta (opción 2). El resto es público y anónimo.
const HERRAMIENTAS_PROTEGIDAS = new Set(["whoami", "guardar_mi_portafolio", "cargar_mi_ultimo_portafolio"]);

function necesitaLogin(cuerpo: any): boolean {
  const mensajes = Array.isArray(cuerpo) ? cuerpo : [cuerpo];
  return mensajes.some((m) => m?.method === "tools/call" && HERRAMIENTAS_PROTEGIDAS.has(m?.params?.name));
}

function texto(t: string, isError = false) {
  return { content: [{ type: "text", text: t }], ...(isError ? { isError: true } : {}) };
}

// Respuesta que hace que Claude muestre el dashboard (enlace + structuredContent).
async function resultadoDashboard(estado: Estado, origen: string, extra: Record<string, unknown> = {}) {
  const { tc } = validar(estado);
  const enlace = `${origen}/d#${await codificar(estado)}`;
  const resumen = resumir(estado, tc);
  return {
    ...texto(JSON.stringify({ version: VERSION, enlace_dashboard: enlace, resumen, ...extra }, null, 2)),
    structuredContent: { version: VERSION, enlace_dashboard: enlace, resumen, estado },
  };
}

async function llamarHerramienta(nombre: string, args: any, origen: string, usuario: Usuario | null) {
  switch (nombre) {
    case "whoami": {
      // manejarMcp ya devolvió 401 si no había token válido; aquí usuario existe.
      if (!usuario) return texto("No autenticado.", true);
      return texto(
        JSON.stringify(
          { sub: usuario.sub, email: usuario.email ?? null, nota: "Token validado por el Worker contra Supabase." },
          null,
          2,
        ),
      );
    }

    case "guardar_mi_portafolio": {
      if (!usuario) return texto("Necesitas iniciar sesión para guardar tu portafolio.", true);
      const estado: Estado = args?.estado;
      const { errores } = validar(estado);
      if (errores.length) return texto(`No guardé nada. Corrige y vuelve a intentar:\n- ${errores.join("\n- ")}`, true);
      try {
        await guardarPortafolio(usuario, estado);
        return texto(JSON.stringify({ ok: true,
          mensaje: "Tu portafolio quedó guardado en tu cuenta. En un chat nuevo pide 'cargar mi último portafolio' para retomarlo." }, null, 2));
      } catch (e: any) {
        return texto(`No pude guardar tu portafolio: ${e?.message || e}`, true);
      }
    }

    case "cargar_mi_ultimo_portafolio": {
      if (!usuario) return texto("Necesitas iniciar sesión para cargar tu portafolio.", true);
      try {
        const fila = await cargarPortafolio(usuario);
        if (!fila) return texto("Todavía no tienes ningún portafolio guardado en tu cuenta.");
        return await resultadoDashboard(fila.estado as Estado, origen, {
          actualizado: fila.updated_at,
          nota: "Este es tu último portafolio guardado. Ya se muestra en el dashboard.",
        });
      } catch (e: any) {
        return texto(`No pude cargar tu portafolio: ${e?.message || e}`, true);
      }
    }

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
      const { errores } = validar(estado);
      if (errores.length) return texto(`No se generó el dashboard. Corrige y vuelve a llamar:\n- ${errores.join("\n- ")}`, true);
      // Guardado automático: si la persona inició sesión, cada actualización del
      // dashboard persiste su portafolio. Anónimo = solo se muestra (tool pública).
      let nota = "El dashboard ya se muestra en el chat o en el panel lateral. Da también el enlace para guardarlo.";
      if (usuario) {
        try {
          await guardarPortafolio(usuario, estado);
          nota = "El dashboard ya se muestra y tu portafolio quedó guardado en tu cuenta automáticamente.";
        } catch (e: any) {
          nota = `El dashboard ya se muestra, pero no pude guardar en tu cuenta: ${e?.message || e}`;
        }
      }
      return await resultadoDashboard(estado, origen, { nota, guardado: !!usuario });
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

async function atender(msg: any, origen: string, usuario: Usuario | null): Promise<any | null> {
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
        capabilities: { tools: { listChanged: false }, resources: { listChanged: false } },
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
      const r = await llamarHerramienta(params?.name, params?.arguments, origen, usuario);
      return r ? ok(r) : err(-32602, `Herramienta desconocida: ${params?.name}`);
    }
    case "resources/list":
      return ok({ resources: [{ uri: VISTA_URI, name: "Dashboard del portafolio", mimeType: MIME_APP }] });
    case "resources/templates/list":
      return ok({ resourceTemplates: [] });
    case "resources/read": {
      if (params?.uri !== VISTA_URI) return err(-32002, `Recurso no encontrado: ${params?.uri}`);
      return ok({
        contents: [{
          uri: VISTA_URI,
          mimeType: MIME_APP,
          text: htmlVista(origen, VERSION),
          _meta: {
            ui: {
              // La vista carga app.js, ExcelJS y la plantilla desde este mismo servidor.
              csp: { resourceDomains: [origen], connectDomains: [origen] },
              // Pide a Claude abrirla en el panel lateral derecho.
              preferredDisplayMode: "fullscreen",
            },
          },
        }],
      });
    }
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
  // Opción 2: solo las herramientas protegidas exigen cuenta. Si la petición
  // llama a una de ellas sin un token válido, devolvemos 401 para que Claude
  // inicie el flujo OAuth con Supabase.
  const usuario = await usuarioDeLaPeticion(req);
  if (necesitaLogin(cuerpo) && !usuario) return reto401(origen);

  const lote = Array.isArray(cuerpo);
  const respuestas = (await Promise.all((lote ? cuerpo : [cuerpo]).map((m: any) => atender(m, origen, usuario)))).filter(Boolean);
  if (!respuestas.length) return new Response(null, { status: 202 });
  return Response.json(lote ? respuestas : respuestas[0]);
}
