# Historial de cambios

Cada versión publicada aquí llega a todas las personas que instalaron el plugin.

## 2.0.0 — 2026-11-12

**Cambio de arquitectura: actualizaciones al instante**
- Toda la lógica pasa a un **servidor MCP en Cloudflare** (`servidor-mcp/`): instrucciones, reglas, categorías, guía y diseño del dashboard. Cada persona lo agrega una sola vez como conector y desde ahí siempre usa la última versión, sin sincronizar nada.
- El **dashboard** ahora es una página del servidor. Los datos viajan dentro del enlace (después del `#`) y no se guardan en ningún servidor. Los enlaces antiguos se ven con el diseño vigente.
- El **Excel** se genera en el navegador con el botón "Descargar Excel", sobre la plantilla oficial.
- Para **retomar**, basta con pegar el enlace del dashboard en un chat nuevo.
- El plugin queda mínimo: solo le indica a Claude que use el conector.

## 1.1.1 — 2026-11-12

**Correcciones**
- El avance por sección ahora distingue tres estados: **Sin información aún**, **En progreso · falta confirmar** (ya hay productos cargados, pero la persona no confirmó que sea todo) y **Completa / No aplica**. Antes, una sección con datos aparecía como "Pendiente".
- Cada tarjeta del avance muestra el monto y la cantidad de productos cargados.
- En Mercados Privados, el título "Deuda Privada" ya no aparece encima de Private Equity, Venture Capital y las demás subcategorías.
- Claude pregunta si ya está todo apenas agrega productos a una sección.

## 1.1.0 — 2026-11-12

**Nuevo**
- **Modo guiado:** el plugin acompaña a la persona paso a paso. Puede subir sus documentos de a pocos; en cada paso ve lo que ya se clasificó, lo que falta y la siguiente pregunta.
- **Dashboard** como resultado principal: las 6 secciones con todas sus subcategorías, la distribución, la división Perú/Extranjero, el avance por sección y las posiciones por revisar.
- **Botón "Descargar Excel"** dentro del dashboard, con la plantilla oficial llena.
- **Retomar otro día:** basta con subir el último Excel generado por el plugin para continuar donde se quedó.
- **Tema visual editable** en `assets/tema.json` (colores, marca y título).

**Cambios**
- El Excel guarda el avance en una hoja oculta (`_estado`) para poder retomarlo.

## 1.0.0 — 2026-11-11

- Primera versión: clasificación de posiciones y llenado de la plantilla Excel.
