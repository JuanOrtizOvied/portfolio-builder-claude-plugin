// Autenticación OAuth del conector (opción 2: herramientas públicas, login solo
// para las herramientas protegidas).
//
// Supabase actúa como Authorization Server (emite los tokens); este Worker es el
// Resource Server (RFC 9728): publica los metadatos del recurso protegido y valida
// el JWT entrante contra el JWKS de Supabase. Claude descubre a Supabase a partir
// de los metadatos cuando recibe un 401.
import { createRemoteJWKSet, jwtVerify } from "jose";

// Proyecto Supabase. Ver odd/tasks/session-persistence-oauth.md.
export const EMISOR = "https://pecwcmjqeouiijzkmbpg.supabase.co/auth/v1";
const JWKS = createRemoteJWKSet(new URL(`${EMISOR}/.well-known/jwks.json`));

export interface Usuario {
  sub: string;
  email?: string;
}

// Metadatos del recurso protegido (RFC 9728). Apuntan al Authorization Server.
export function metadataRecursoProtegido(origen: string) {
  return {
    resource: `${origen}/mcp`,
    authorization_servers: [EMISOR],
    bearer_methods_supported: ["header"],
  };
}

// ¿La ruta pide los metadatos del recurso protegido? Claude puede pedirlos en la
// raíz o con el sufijo del recurso (…/oauth-protected-resource/mcp).
export function rutaMetadataRecurso(pathname: string): boolean {
  return (
    pathname === "/.well-known/oauth-protected-resource" ||
    pathname.startsWith("/.well-known/oauth-protected-resource/")
  );
}

// Reto 401 que dispara el flujo de login en Claude.
export function reto401(origen: string): Response {
  const metadata = `${origen}/.well-known/oauth-protected-resource/mcp`;
  return new Response(
    JSON.stringify({ error: "unauthorized", mensaje: "Inicia sesión para usar esta herramienta." }),
    {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "WWW-Authenticate": `Bearer resource_metadata="${metadata}"`,
      },
    },
  );
}

// Valida el Bearer token del header Authorization. Devuelve el usuario o null.
//
// NOTA DE SEGURIDAD (spike): valida firma (ES256), emisor y expiración, pero
// todavía NO valida la audiencia. Antes de producción hay que exigir
// aud = `${origen}/mcp` (RFC 8707) para evitar token passthrough. Ver T9.
export async function usuarioDeLaPeticion(req: Request): Promise<Usuario | null> {
  const auth = req.headers.get("Authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  try {
    const { payload } = await jwtVerify(m[1], JWKS, {
      issuer: EMISOR,
      algorithms: ["ES256"],
    });
    if (!payload.sub) return null;
    return {
      sub: String(payload.sub),
      email: typeof payload.email === "string" ? payload.email : undefined,
    };
  } catch {
    return null;
  }
}
