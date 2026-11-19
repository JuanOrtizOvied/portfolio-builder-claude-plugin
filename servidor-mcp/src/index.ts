// Worker de Sabbi · Portafolio
//   /mcp        servidor MCP (lo que agrega cada persona como conector en Claude)
//   /d#...      dashboard (archivo estático public/d.html; los datos van en el fragmento)
//   /meta.json  versión vigente, la usa el dashboard para mostrarla en el pie
//   /           página de inicio con instrucciones (public/index.html)
import { manejarMcp, VERSION } from "./mcp";
import { metadataRecursoProtegido, rutaMetadataRecurso } from "./auth";

interface Env {
  ASSETS: Fetcher;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === "/mcp" || url.pathname === "/mcp/") return manejarMcp(req);

    if (url.pathname === "/meta.json") {
      return Response.json({ version: VERSION }, { headers: { "Cache-Control": "no-store" } });
    }

    // Recurso protegido (RFC 9728): Claude lee estos metadatos para descubrir el
    // Authorization Server (Supabase) cuando una herramienta protegida devuelve 401.
    if (rutaMetadataRecurso(url.pathname)) {
      return Response.json(metadataRecursoProtegido(url.origin), {
        headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" },
      });
    }

    // El resto de /.well-known/ no existe: el Authorization Server es Supabase,
    // no este Worker, y se descubre vía los metadatos de arriba.
    if (url.pathname.startsWith("/.well-known/")) return new Response("Not found", { status: 404 });

    return env.ASSETS.fetch(req);
  },
};
