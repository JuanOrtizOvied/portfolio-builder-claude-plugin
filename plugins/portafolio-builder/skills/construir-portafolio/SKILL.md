---
name: construir-portafolio
description: Acompaña paso a paso a una persona a armar su portafolio de inversión a partir de sus estados de cuenta, capturas, PDFs y factsheets, clasifica cada producto en las categorías y subcategorías de Sabbi (Inversiones Directas, Mercados Privados, Club Deals, Mercados Públicos, Otros, Cash) y entrega un dashboard con el Excel descargable. Úsala cuando alguien suba documentos de inversiones o pida armar, clasificar, continuar o actualizar su portafolio, o pegue un enlace de su dashboard.
---

# Construir portafolio (Sabbi)

Todo el trabajo se hace con el conector **Sabbi Portafolio**. Las instrucciones, las reglas de clasificación y el diseño del dashboard viven en ese conector, para que siempre estén en su última versión.

1. Llama a la herramienta `obtener_instrucciones` del conector **antes de responder** y sigue exactamente lo que devuelve.
2. Antes de clasificar el primer producto, llama a `obtener_reglas_clasificacion`.
3. Genera el dashboard solo con `actualizar_dashboard`: no armes tú el dashboard ni el Excel con código.

Si las herramientas del conector no están disponibles, no intentes hacer el trabajo por tu cuenta. Explícale a la persona cómo activarlo:

- Si ya lo agregó: en el chat, abre el menú de herramientas (botón **+** o el ícono de conectores) y activa **Sabbi Portafolio**.
- Si no lo ha agregado: entra a **Customize → Connectors → + → Add custom connector**, pon de nombre **Sabbi Portafolio** y como URL `https://sabbi-portafolio.TU-SUBDOMINIO.workers.dev/mcp`. Luego abre un chat nuevo.
