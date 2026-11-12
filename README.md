# Plugins de Sabbi para Claude

Este repositorio es un **marketplace de plugins** para Claude. Contiene:

| Plugin | Qué hace |
|---|---|
| `portafolio-builder` | Guía a la persona paso a paso: sube sus estados de cuenta, capturas, PDFs y factsheets cuando los tenga, y Claude clasifica cada producto en las categorías y subcategorías de la plantilla (Inversiones Directas, Mercados Privados, Club Deals, Mercados Públicos, Otros, Cash). El resultado es un dashboard con el Excel descargable. |

---

## Para usuarios: instalar (una sola vez)

Necesitas un plan de pago de Claude (Pro, Max, Team o Enterprise).

### En la app de Claude (web o escritorio)

1. Abre **Customize** en la barra lateral izquierda y entra a la pestaña **Plugins**.
2. En **Personal plugins**, haz clic en **+** → **Add marketplace** → **Add from a repository**.
3. Pega: `USUARIO-GITHUB/NOMBRE-REPO` (lo reemplaza el administrador; ver abajo) y haz clic en **Sync**.
4. En **Browse plugins** → pestaña **Personal**, instala **portafolio-builder**.

### En Claude Code

```
/plugin marketplace add USUARIO-GITHUB/NOMBRE-REPO
/plugin install portafolio-builder@sabbi-plugins
```

Luego activa la actualización automática: `/plugin` → pestaña **Marketplaces** → `sabbi-plugins` → **Enable auto-update**.

### Cómo usarlo

En una conversación nueva escribe algo como:

> Quiero armar mi portafolio.

No necesitas tener todo listo. Sube lo que tengas a mano (una captura, un PDF). Claude lo clasifica, te muestra el dashboard con tu avance y te pide lo siguiente, sección por sección. Al final tienes el dashboard completo con el botón **Descargar Excel**.

Si quieres seguir otro día, sube el último Excel que te dio Claude y escribe *"continuemos mi portafolio"*.

---

## Para el administrador: publicar cambios

Todo cambio que se suba a la rama `main` de este repositorio llega a quienes instalaron el marketplace.

1. Edita lo que necesites:
   - Instrucciones del flujo: `plugins/portafolio-builder/skills/construir-portafolio/SKILL.md`
   - Reglas de clasificación: `.../references/reglas-clasificacion.md`
   - Categorías y celdas: `.../assets/categorias.json`
   - Plantilla: `.../assets/plantilla-portafolio-final.xlsx` (si mueves filas, actualiza las celdas en `categorias.json`)
   - Colores y marca del dashboard: `.../assets/tema.json`
   - Cómo guía Claude a la persona: `.../references/guia-paso-a-paso.md`
2. **Sube el número de versión** en ambos archivos (deben coincidir):
   - `plugins/portafolio-builder/.claude-plugin/plugin.json` → `"version"`
   - `.claude-plugin/marketplace.json` → `"version"` del plugin
3. Anota el cambio en `CHANGELOG.md`.
4. Haz commit y push a `main`.

Sin el cambio de versión, Claude puede considerar que no hay nada nuevo y no actualizar.

### Ejemplo de actualización: cambiar un color

Es la forma más simple de demostrar que las actualizaciones llegan a todos:

1. En `assets/tema.json` cambia `"acento": "#C9A227"` por otro color, por ejemplo `"#2A9D8F"` (verde azulado).
2. Sube la versión a `1.1.1` en `plugin.json` y `marketplace.json`.
3. Commit y push.
4. Cualquier usuario que genere un dashboard después de que su Claude se sincronice verá el nuevo color en el botón y en la marca. El pie del dashboard muestra la versión con la que se generó (*Generado por portafolio-builder v1.1.1*), así se puede comprobar qué versión tiene cada persona.

### Probar antes de publicar

- **Excel:** `python plugins/portafolio-builder/skills/construir-portafolio/scripts/llenar_plantilla.py ejemplos/posiciones-ejemplo.json prueba.xlsx`
- **Dashboard a medio avance:** `python plugins/portafolio-builder/skills/construir-portafolio/scripts/generar_dashboard.py ejemplos/estado-parcial.json prueba-parcial.html`
- **Dashboard final con Excel:** `python plugins/portafolio-builder/skills/construir-portafolio/scripts/generar_dashboard.py ejemplos/posiciones-ejemplo.json prueba.html --excel prueba.xlsx`
- **Plugin completo en Claude Code:** `claude --plugin-dir ./plugins/portafolio-builder`
- **Validar manifiestos:** `claude plugin validate .`

### Privacidad

El repositorio debe ser **público** para que cuentas personales lo puedan agregar. No subas aquí documentos ni datos de clientes. Solo deben estar la plantilla vacía, las reglas, los scripts y los ejemplos ficticios.

---

## Estructura

```
.claude-plugin/marketplace.json        catálogo del marketplace
plugins/portafolio-builder/
  .claude-plugin/plugin.json           manifiesto del plugin
  skills/construir-portafolio/
    SKILL.md                           flujo que sigue Claude
    references/guia-paso-a-paso.md     cómo guiar a la persona, sección por sección
    references/reglas-clasificacion.md cómo clasificar cada instrumento
    references/formato-entrada.md      formato del archivo de avance (estado.json)
    assets/categorias.json             códigos de categoría ↔ celdas de la plantilla
    assets/tema.json                   colores y marca del dashboard
    assets/plantilla-portafolio-final.xlsx
    scripts/generar_dashboard.py       genera el dashboard (parcial o final)
    scripts/llenar_plantilla.py        genera el Excel final
    scripts/importar_excel.py          retoma el avance desde un Excel anterior
ejemplos/estado-parcial.json           datos ficticios: portafolio a medias
ejemplos/posiciones-ejemplo.json       datos ficticios: portafolio completo
CHANGELOG.md                           historial de versiones
```
