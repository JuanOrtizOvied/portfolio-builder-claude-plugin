# Sabbi · Portafolio para Claude

Claude acompaña a la persona paso a paso: sube sus estados de cuenta, capturas, PDFs y factsheets cuando los tenga, y Claude clasifica cada producto en las categorías y subcategorías de la plantilla de Sabbi (Inversiones Directas, Mercados Privados, Club Deals, Mercados Públicos, Otros, Cash). El resultado es un **dashboard** con un botón para **descargar el Excel**.

## Cómo está armado

```
servidor-mcp/   ← EL CEREBRO. Un servidor en Cloudflare con las reglas, categorías,
                  guía y diseño del dashboard. Claude lo consulta cada vez.
                  Cambias algo aquí, haces push y TODOS lo ven al instante.

plugins/        ← Un plugin mínimo que solo le dice a Claude "usa el conector de Sabbi".
                  Casi nunca necesita cambios.
```

Cada persona agrega el conector **una sola vez**. Desde ahí, cualquier cambio que publiques le llega en su próxima consulta, sin sincronizar nada ni reinstalar.

**Privacidad:** el dashboard es una página de tu servidor, pero los datos de la persona viajan dentro del propio enlace, en la parte después del `#`. El navegador nunca envía esa parte al servidor, así que Cloudflare no guarda ni ve los portafolios. Como el diseño se carga desde el servidor cada vez, **hasta los enlaces antiguos se ven con la versión vigente**.

---

## 1. Publicar el servidor en Cloudflare (una sola vez)

### Opción A — desde el panel de Cloudflare, con despliegue automático (recomendada)

1. Crea una cuenta gratuita en [dash.cloudflare.com](https://dash.cloudflare.com).
2. Ve a **Workers & Pages → Create** y elige importar un repositorio de GitHub (**Import a repository**). Autoriza a Cloudflare a leer tu repositorio.
3. Selecciona este repositorio y configura:
   - **Root directory / Path:** `servidor-mcp`
   - **Deploy command:** `npx wrangler deploy` (suele venir por defecto)
4. Haz clic en **Deploy**. Al terminar, Cloudflare te da una URL del tipo
   `https://sabbi-portafolio.TU-SUBDOMINIO.workers.dev`

A partir de ahí, **cada push a `main` vuelve a publicar el servidor solo** (tarda alrededor de un minuto).

### Opción B — desde la terminal

```bash
cd servidor-mcp
npm install
npx wrangler login     # abre el navegador para iniciar sesión en Cloudflare
npx wrangler deploy
```

### Después de publicar

Abre `https://sabbi-portafolio.TU-SUBDOMINIO.workers.dev/`. Es la página de bienvenida con las instrucciones y la URL exacta del conector. **Esa es la página que les compartes a tus usuarios.**

Luego reemplaza `TU-SUBDOMINIO` por tu subdominio real en estos dos archivos y haz push:
- `plugins/portafolio-builder/.mcp.json`
- `plugins/portafolio-builder/skills/construir-portafolio/SKILL.md`

---

## 2. Para usuarios: activar (una sola vez)

1. En claude.ai o en la app de escritorio, abre **Customize → Connectors**.
2. Haz clic en **+ → Add custom connector**.
3. Nombre: **Sabbi Portafolio**. URL: `https://sabbi-portafolio.TU-SUBDOMINIO.workers.dev/mcp`
4. Haz clic en **Add**. No pide usuario ni contraseña.

Después, en un chat nuevo con el conector activado:

> Quiero armar mi portafolio

Para continuar otro día, basta con pegar en un chat nuevo el enlace del dashboard.

*(Opcional)* También pueden instalar el plugin desde este repositorio: Customize → Plugins → + → Add marketplace → Add from a repository. El plugin ayuda a que Claude use el conector en cuanto alguien suba documentos de inversión. El conector funciona igual sin él.

---

## 3. Publicar cambios (el día a día)

| Quiero cambiar… | Archivo |
|---|---|
| Colores, marca o título del dashboard | `servidor-mcp/public/tema.json` |
| Cómo se clasifica un producto | `servidor-mcp/contenido/reglas-clasificacion.md` |
| Las preguntas o el orden de la guía | `servidor-mcp/contenido/guia-paso-a-paso.md` |
| El flujo general que sigue Claude | `servidor-mcp/contenido/instrucciones.md` |
| Categorías o subcategorías | `servidor-mcp/public/categorias.json` y `servidor-mcp/public/plantilla-portafolio-final.xlsx` (las celdas deben coincidir) |
| El diseño del dashboard o el Excel | `servidor-mcp/public/d.html` y `servidor-mcp/public/app.js` |

Pasos:
1. Edita el archivo (desde la web de GitHub también se puede).
2. Sube la versión en `servidor-mcp/package.json` (por ejemplo, `2.0.0` → `2.0.1`). Es la que aparece en el pie del dashboard.
3. Anota el cambio en `CHANGELOG.md`.
4. Commit y push a `main`. Con la opción A, Cloudflare publica solo. Con la opción B, corre `npx wrangler deploy`.

### Demo de actualización

1. En `servidor-mcp/public/tema.json` cambia `"acento": "#C9A227"` por `"#2A9D8F"`.
2. Sube la versión a `2.0.1` en `servidor-mcp/package.json` y haz push.
3. Espera a que Cloudflare termine de publicar (alrededor de un minuto) y **recarga cualquier dashboard abierto**, incluso uno creado antes: el botón ya sale verde azulado y el pie dice v2.0.1.

---

## Probar en local

```bash
cd servidor-mcp
npm install
npx wrangler dev        # http://localhost:8787
```

- Página de inicio: `http://localhost:8787/`
- Endpoint MCP: `http://localhost:8787/mcp`
- Los datos ficticios para probar están en `ejemplos/`.

## Estructura

```
servidor-mcp/
  src/index.ts                 rutas del Worker (/mcp, /meta.json, archivos públicos)
  src/mcp.ts                   servidor MCP: herramientas que usa Claude
  src/portafolio.ts            validación, resumen y codificación del enlace
  contenido/instrucciones.md   flujo que sigue Claude
  contenido/guia-paso-a-paso.md
  contenido/reglas-clasificacion.md
  public/index.html            página de bienvenida (instrucciones para usuarios)
  public/d.html, app.js        dashboard y generación del Excel en el navegador
  public/categorias.json       categorías ↔ celdas de la plantilla
  public/tema.json             colores y marca
  public/plantilla-portafolio-final.xlsx
  public/vendor/exceljs.min.js librería para generar el Excel
  wrangler.toml, package.json  configuración de Cloudflare
plugins/portafolio-builder/    plugin mínimo (skill + .mcp.json)
.claude-plugin/marketplace.json
ejemplos/                      datos ficticios
CHANGELOG.md
```

No subas a este repositorio documentos ni datos de clientes.
