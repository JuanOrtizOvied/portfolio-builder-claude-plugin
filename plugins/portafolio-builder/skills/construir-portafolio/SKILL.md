---
name: construir-portafolio
description: Acompaña paso a paso a una persona a armar su portafolio de inversión a partir de sus estados de cuenta, capturas, PDFs y factsheets, clasifica cada producto en las categorías y subcategorías de la plantilla (Inversiones Directas, Mercados Privados, Club Deals, Mercados Públicos, Otros, Cash) y entrega un dashboard con el Excel descargable. Úsala cuando alguien suba documentos de inversiones o pida armar, clasificar, continuar o actualizar su portafolio.
---

# Construir portafolio (modo guiado)

El objetivo es que la persona termine con **un dashboard de su portafolio clasificado en las 6 secciones de la plantilla y todas sus subcategorías**, con el Excel como descarga opcional. Muchas personas llegan con información incompleta, así que el portafolio se arma **por partes**: en cada turno se procesa lo que suban, se muestra el avance y se pide lo siguiente.

Archivos de esta skill (rutas relativas a su directorio base):

| Archivo | Para qué |
|---|---|
| `references/guia-paso-a-paso.md` | Cómo guiar a la persona: orden de las secciones, preguntas y tono. **Léelo al empezar.** |
| `references/reglas-clasificacion.md` | Cómo decidir la categoría de cada producto. **Léelo antes de clasificar.** |
| `references/formato-entrada.md` | Formato de `estado.json`, el archivo de avance. |
| `assets/categorias.json` | Códigos de categoría válidos ↔ celdas de la plantilla. |
| `assets/tema.json` | Colores y marca del dashboard. |
| `assets/plantilla-portafolio-final.xlsx` | Plantilla oficial; nunca la edites a mano. |
| `scripts/generar_dashboard.py` | Genera el dashboard HTML (también a medio avance). |
| `scripts/llenar_plantilla.py` | Genera el Excel final con la plantilla llena. |
| `scripts/importar_excel.py` | Recupera el avance desde un Excel generado antes. |

## Ciclo de cada turno

1. **Retomar o empezar.**
   - Si ya existe `estado.json` en el directorio de trabajo, cárgalo.
   - Si la persona sube un Excel generado antes por este plugin, recupera el avance con `python <dir-skill>/scripts/importar_excel.py archivo.xlsx estado.json`.
   - Si no hay nada, crea `estado.json` con `cliente`, `fecha_corte`, `secciones` (las 6 en `pendiente`) y `posiciones: []`, y da la bienvenida según la guía.

2. **Procesar lo nuevo.** Lee **todos** los archivos que subió en este turno. Extrae cada posición con su valor de mercado, moneda, institución y página o ubicación. Revisa también las secciones de cash y "otros activos". No adivines números ilegibles: pregúntalos.

3. **Clasificar.** Asigna a cada posición un código de `assets/categorias.json` según `references/reglas-clasificacion.md`. Si no reconoces un ticker, ISIN o fondo, búscalo antes de clasificarlo. Divide los fondos globales o mixtos según su factsheet. Explica en `nota` toda clasificación que no sea obvia.

4. **Guardar.** Agrega las posiciones a `estado.json`. Si llega un documento más reciente de la misma cuenta, reemplaza las posiciones anteriores de esa cuenta y avisa. Actualiza `secciones` solo con lo que la persona confirmó.

5. **Mostrar el avance.**
   ```bash
   python <dir-skill>/scripts/generar_dashboard.py estado.json dashboard.html
   ```
   Publica `dashboard.html` como artifact si tienes la herramienta (y en los turnos siguientes actualiza ese mismo artifact); si no, envíalo como archivo. Acompáñalo de un resumen corto: qué se agregó, las dudas puntuales y **la siguiente pregunta** de la lista de verificación de la guía.

6. **Cerrar** cuando las 6 secciones estén en `completa` o `no_aplica`:
   ```bash
   python <dir-skill>/scripts/llenar_plantilla.py estado.json "Portafolio_<Nombre>_<AAAA-MM-DD>.xlsx"
   python <dir-skill>/scripts/generar_dashboard.py estado.json dashboard.html --excel "Portafolio_<Nombre>_<AAAA-MM-DD>.xlsx"
   ```
   - Si `llenar_plantilla.py` imprime `suma_pct` distinto de 100 (± 0,05), revisa antes de entregar.
   - Si tienes la skill de Excel (xlsx) con `recalc.py`, recalcula el archivo y confirma que no haya errores y que `Sheet1!D94` = 100 %.
   - Entrega el **dashboard como resultado principal**, con el botón "Descargar Excel" incluido, y el Excel también como archivo aparte.
   - Recuérdale a la persona que en el Excel le toca completar las columnas en blanco (retornos y portafolio deseado) y seguir las instrucciones de envío de la plantilla.

La persona puede pedir el Excel en cualquier momento, aunque esté incompleto: genéralo y avisa qué secciones faltan.

## Reglas

- **Nunca inventes montos.** Todo número sale de un documento o de la persona.
- Usa siempre **valor de mercado** a la fecha de corte, no el costo.
- Los porcentajes se calculan sobre el Portafolio de Inversión; `EMPRESA_PRIVADA` y `EXCLUIR` no entran en ese total.
- Una sección solo se marca `completa` o `no_aplica` cuando la persona lo confirma.
- Los documentos tienen datos financieros personales: no los compartas fuera de la conversación.
- Los colores y la marca del dashboard salen de `assets/tema.json`; no los cambies por tu cuenta.
