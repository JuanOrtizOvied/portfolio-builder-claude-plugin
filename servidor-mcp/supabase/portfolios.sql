-- Tabla de persistencia por usuario para el conector MCP de Sabbi.
-- Aplicar en Supabase: Dashboard -> SQL Editor -> pegar este archivo -> Run.
-- (Proyecto: pecwcmjqeouiijzkmbpg)
--
-- Guarda el ÚLTIMO portafolio de cada usuario (una fila por usuario).
-- La identidad viene del OAuth de Supabase; RLS garantiza aislamiento por usuario.

create table if not exists public.portfolios (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  estado     jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.portfolios enable row level security;

-- Cada usuario solo puede ver y escribir su propia fila.
drop policy if exists "ver su portafolio" on public.portfolios;
create policy "ver su portafolio" on public.portfolios
  for select using (auth.uid() = user_id);

drop policy if exists "crear su portafolio" on public.portfolios;
create policy "crear su portafolio" on public.portfolios
  for insert with check (auth.uid() = user_id);

drop policy if exists "actualizar su portafolio" on public.portfolios;
create policy "actualizar su portafolio" on public.portfolios
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
