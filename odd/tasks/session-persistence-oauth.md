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

## GOTCHA: two Workers / name mismatch (found 2026-11-18)
- `wrangler.toml` name has ALWAYS been `sabbi-portafolio` → `wrangler deploy` targets
  `https://sabbi-portafolio.sabbi-tecnologia.workers.dev`. New code lives here (verified).
- The Claude connector points at `https://portfolio-builder-claude-plugin.sabbi-tecnologia.workers.dev/mcp`,
  a DIFFERENT Worker serving OLD code (v2.1.2, no metadata). No local CI deploys it → almost
  certainly a Cloudflare dashboard Git integration (Workers Builds) named after the repo.
- Decision pending: which URL is canonical going forward. Feature forces a reconnect anyway
  (auth mode → "sign in when needed"), so the URL choice is flexible. For the spike, standardize
  on `sabbi-portafolio.*` (directly deployable via `wrangler deploy`).

## Tasks

### Spike (de-risk) — prove OAuth works end-to-end before building the feature
- [x] T1 — Serve OAuth protected-resource metadata (RFC 9728) from the Worker; stop 404 on
      `/.well-known/oauth-protected-resource`; add a 401 + `WWW-Authenticate` helper. (index.ts, new auth.ts)
      VERIFIED LIVE 2026-11-18 on `https://sabbi-portafolio.sabbi-tecnologia.workers.dev/.well-known/oauth-protected-resource/mcp`
      → returns `{resource, authorization_servers:[supabase], bearer_methods_supported}`. `jose` bundles fine on Workers.
- [x] T2 — Validate incoming Bearer JWT against Supabase JWKS (ES256); check iss/exp; extract `sub`. (auth.ts)
      VERIFIED via T5: `whoami` returned real sub + email.
- [x] T3 — Add spike protected tool `whoami`: anonymous call → HTTP 401 challenge; valid token → returns `sub`. (mcp.ts)
      VERIFIED via T5.
- [x] T4 — Serve a minimal consent + login page at `/oauth/consent` from the Worker (browser,
      `@supabase/supabase-js`: sign-in, `getAuthorizationDetails`/`approve`/`deny`). (public/oauth/consent.html)
      Committed `2fd8485`. VERIFIED served + full flow via T5. supabase-js pinned only to @2 (spike).
- [x] T5 — User updates Supabase Site URL → Worker origin; manual E2E in Claude: add connector
      with "sign in when needed", call `whoami`, confirm login + `user_id` reaches the Worker.
      PASSED 2026-11-18. Connector auth "Sign in when needed" + OAuth client "Register automatically" (DCR,
      NOT Claude's CIMD). `whoami` returned sub=466df317-16ad-423a-9ae6-354be0244555, email juan@sabbi.com.

**SPIKE COMPLETE — all unknowns resolved. OAuth end-to-end works. Proceeding to feature phase.**

### Feature (only if spike passes)
- [x] T6 — Supabase table `portfolios` (user_id PK, state jsonb, updated_at) + RLS per user.
      SQL at `servidor-mcp/supabase/portfolios.sql` (commit `591e1a1`). APPLIED by user 2026-11-18.
- [~] T7 — `guardar_mi_portafolio` protected tool: upsert the user's state. Code committed `984ce10`.
      Worker forwards user JWT to Supabase REST (RLS). Pending: deploy + live test.
- [~] T8 — `cargar_mi_ultimo_portafolio` protected tool: read the user's last state + render dashboard.
      Code committed `984ce10`. Pending: deploy + live test. RISK: confirm `sb_publishable_` key works
      as REST `apikey`, and that the OAuth access token authorizes PostgREST (RLS auth.uid()).
- [ ] T9 — Wire into instrucciones + dashboard; update privacy footer and tool descriptions.
- [ ] T10 — Polish consent/login UI (Sabbi brand; fix card centering). Remove the self-registration
      ("Crear una") toggle — users are provisioned manually, not self-signup.

### User-provisioning decision (2026-11-18)
Users are created manually by the admin (Dashboard → Authentication > Users → Add user, or Admin API),
and self-signup is disabled (Authentication > Sign In / Providers → Email → turn off "Allow new users
to sign up"). No user table is hand-built; Supabase `auth.users` is built-in. Consent page keeps login
only (no sign-up).

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
  DCR enabled). Feature document created.
- 2026-11-18: T1–T3 code written and committed on branch `feat/session-persistence-oauth`
  (commit `f772d51`). New `src/auth.ts` (protected-resource metadata, 401 challenge, ES256 JWT
  verify against Supabase JWKS, extract `sub`); `index.ts` serves the metadata; `mcp.ts` adds the
  protected `whoami` tool + login gate; `package.json` adds `jose`. Route: inline (small, coupled,
  security-sensitive). Decision: consent/login page will be served from the same Worker; Site URL
  → Worker origin (user dashboard action, pending). NOT yet checked off: no deploy/typecheck
  possible in this env (no node_modules/network); verification of record is `wrangler deploy` +
  the T5 end-to-end test. Token audience validation deferred to T9 (noted in code).
