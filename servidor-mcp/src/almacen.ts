// Persistencia del portafolio por usuario, sobre la API REST de Supabase (PostgREST).
//
// El Worker reenvía el JWT del usuario como Authorization, así que la Row Level
// Security de la tabla `portfolios` (auth.uid() = user_id) garantiza que cada
// quien solo toca su propia fila. No se usa la service_role key.
import { SUPABASE_ANON_KEY, SUPABASE_URL, Usuario } from "./auth";

const REST = `${SUPABASE_URL}/rest/v1`;

function cabeceras(usuario: Usuario): Record<string, string> {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${usuario.token}`,
    "Content-Type": "application/json",
  };
}

// Guarda (o reemplaza) el último portafolio del usuario. Una fila por usuario.
export async function guardarPortafolio(usuario: Usuario, estado: unknown): Promise<void> {
  const r = await fetch(`${REST}/portfolios?on_conflict=user_id`, {
    method: "POST",
    headers: { ...cabeceras(usuario), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ user_id: usuario.sub, estado, updated_at: new Date().toISOString() }),
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
}

// Devuelve el último portafolio guardado del usuario, o null si no tiene.
export async function cargarPortafolio(
  usuario: Usuario,
): Promise<{ estado: any; updated_at: string } | null> {
  const r = await fetch(
    `${REST}/portfolios?user_id=eq.${encodeURIComponent(usuario.sub)}&select=estado,updated_at&limit=1`,
    { headers: cabeceras(usuario) },
  );
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  const filas = (await r.json()) as Array<{ estado: any; updated_at: string }>;
  return filas?.[0] ?? null;
}
