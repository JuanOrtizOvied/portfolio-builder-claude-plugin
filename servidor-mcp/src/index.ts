// Worker de Sabbi · Portafolio
//   /mcp        servidor MCP (lo que agrega cada persona como conector en Claude)
//   /d#...      dashboard (archivo estático public/d.html; los datos van en el fragmento)
//   /meta.json  versión vigente, la usa el dashboard para mostrarla en el pie
//   /           página de inicio con instrucciones (public/index.html)
import { manejarMcp, VERSION } from "./mcp";

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

    // Conector público: sin OAuth. Claude consulta estas rutas para saber si
    // hace falta autenticación; un 404 le indica que no.
    if (url.pathname.startsWith("/.well-known/")) return new Response("Not found", { status: 404 });

    return env.ASSETS.fetch(req);
  },
};
