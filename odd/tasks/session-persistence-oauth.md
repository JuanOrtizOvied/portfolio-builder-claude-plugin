# Feature: Session persistence via Supabase OAuth

**Project:** portfolio-builder-claude-plugin
**Feature ID:** session-persistence-oauth
**Created:** 2026-11-18
**Status:** Spike (de-risking) — not yet implemented

## Objective
Let a logged-in user persist their last portfolio and reload it from a new Claude
chat, by adding Supabase-backed OAuth identity to the currently public, stateless
MCP connector. Chosen model: **option 2 ("sign in when needed")** — classification
tools stay public and anonymous; only save/load requires an account.

## Problem
Today the connector is anonymous (`Sin inicio de sesión`, no OAuth). `actualizar_dashboard`
cannot know whose portfolio it is, and state lives only in the URL fragment
(`portafolio.ts` — never stored server-side). So a new chat starts blank. To persist
per-user, the server needs identity + storage.

## Why this approach
- Supabase provides the OAuth 2.1 authorization server + user accounts + DB + RLS in one
  product, removing the need to implement password hashing or a separate datastore.
- OAuth identifies every MCP `tools/call` via a Bearer token → the Worker learns `user_id`.
- Option 2 keeps the casual, public classification flow intact; login only gates persistence.

## Supabase facts (verified 2026-11-18, live)
- Project ref: `pecwcmjqeouiijzkmbpg` → base `https://pecwcmjqeouiijzkmbpg.supabase.co`
- OAuth server: ENABLED. DCR: ENABLED (registration_endpoint present).
- issuer: `https://pecwcmjqeouiijzkmbpg.supabase.co/auth/v1`
- jwks_uri: `https://pecwcmjqeouiijzkmbpg.supabase.co/auth/v1/.well-known/jwks.json`
- Signing: ES256 (ECC P-256). PKCE S256. grant_types: authorization_code, refresh_token.
- Authorization Path set to `/oauth/consent`. Site URL currently `http://localhost:3000` (must change).

## Scope
In scope: OAuth protected-resource metadata on the Worker, JWT validation against Supabase
JWKS, a protected tool that returns identity, a consent+login page served from the Worker,
and (after spike) per-user portfolio storage with save/load tools.
Out of scope: granular scopes (Supabase "coming soon"), multi-device sync beyond what OAuth
gives for free, social-provider setup beyond email/password for the spike.

## Constraints
- Keep existing public tools working anonymously (option 2).
- No password handling in our code — delegate to Supabase Auth.
- Worker is stateless Cloudflare Workers runtime; JWT verify must run there (jose or Web Crypto).
- Privacy promise changes for logged-in users: `mcp.ts:77` and dashboard footer must be updated.
- Cannot run `wrangler deploy` / tests in this env (no node_modules, no network) → verification
  of record is manual deploy + end-to-end test in Claude. TDD: runner missing; disclosed.

## Hard dependencies
- Consent + login page must be publicly reachable (Claude's browser hits it). Plan: serve it
  from the same Worker, and set Supabase **Site URL** to the Worker origin. (User dashboard action.)

## Tasks

### Spike (de-risk) — prove OAuth works end-to-end before building the feature
- [ ] T1 — Serve OAuth protected-resource metadata (RFC 9728) from the Worker; stop 404 on
      `/.well-known/oauth-protected-resource`; add a 401 + `WWW-Authenticate` helper. (index.ts, new auth.ts)
- [ ] T2 — Validate incoming Bearer JWT against Supabase JWKS (ES256); check iss/exp; extract `sub`. (auth.ts)
- [ ] T3 — Add spike protected tool `whoami`: anonymous call → HTTP 401 challenge; valid token → returns `sub`. (mcp.ts)
- [ ] T4 — Serve a minimal consent + login page at `/oauth/consent` from the Worker (browser,
      `@supabase/supabase-js`: sign-in, `getAuthorizationDetails`/`approve`/`deny`). (public/)
- [ ] T5 — User updates Supabase Site URL → Worker origin; manual E2E in Claude: add connector
      with "sign in when needed", call `whoami`, confirm login + `user_id` reaches the Worker.

### Feature (only if spike passes)
- [ ] T6 — Supabase table `portfolios` (user_id PK, state jsonb, updated_at) + RLS per user.
- [ ] T7 — `guardar_mi_portafolio` protected tool: upsert the user's state.
- [ ] T8 — `cargar_mi_ultimo_portafolio` protected tool: read the user's last state.
- [ ] T9 — Wire into instrucciones + dashboard; update privacy footer and tool descriptions.
- [ ] T10 — Polish consent/login UI with Sabbi brand.

## Acceptance criteria
- Public tools still callable without auth.
- Calling a protected tool anonymously triggers Claude's login flow (401 challenge).
- After login, the Worker validates the token and acts on the correct `user_id`.
- A new chat can reload the last saved portfolio for that user.

## Applicable checks
- Manual: `wrangler deploy` succeeds (user runs it).
- Manual E2E: connect in Claude, auth flow completes, protected tool returns identity.
- `node --check` on any plain JS served to the browser.
- TDD: strict mode configured but no test runner present in repo → disclosed; JWT-verify logic
  is the unit-testable piece if a runner is added.

## Route declaration
- T1–T3: security-sensitive, tightly-coupled, small files → author with close oversight.
- T4: browser page → single writer.
- Record commit identities per task as evidence.

## Progress log
- 2026-11-18: Supabase OAuth server verified live (discovery endpoint returns valid metadata,
  DCR enabled). Feature document created. No source code written yet.
