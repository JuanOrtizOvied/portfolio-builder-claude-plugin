# Formato del JSON de entrada para `scripts/llenar_plantilla.py`

```json
{
  "cliente": "Nombre Apellido",
  "fecha_corte": "2026-10-31",
  "tipos_cambio": { "PEN": 3.75, "EUR": 0.92 },
  "fuente_tipos_cambio": "SBS, tipo de cambio venta al 31/10/2026",
  "secciones": {
    "1": {"estado": "pendiente"},
    "2": {"estado": "no_aplica"},
    "3": {"estado": "pendiente"},
    "4": {"estado": "completa"},
    "5": {"estado": "pendiente"},
    "6": {"estado": "completa"}
  },
  "posiciones": [
    {
      "institucion": "Interactive Brokers",
      "cuenta": "U1234567",
      "instrumento": "Vanguard S&P 500 ETF",
      "ticker_isin": "VOO",
      "categoria": "RV_US_LARGE_CAP",
      "monto": 125430.55,
      "moneda": "USD",
      "fuente": "IBKR_oct2026.pdf, pág. 3",
      "confianza": "alta",
      "nota": "ETF del S&P 500"
    }
  ]
}
```

| Campo | Obligatorio | Detalle |
|---|---|---|
| `cliente`, `fecha_corte` | recomendado | Aparecen en el encabezado del detalle. |
| `tipos_cambio` | si hay monedas ≠ USD | **Unidades de la moneda por 1 USD** (PEN 3.75 significa S/ 3.75 = US$1). USD se agrega solo. |
| `fuente_tipos_cambio` | recomendado | De dónde salió el tipo de cambio. |
| `secciones` | recomendado | Avance por sección (1 a 6, como en la plantilla): `pendiente`, `completa` o `no_aplica`. Lo usa el dashboard para mostrar qué falta. |
| `posiciones[].categoria` | sí | Código exacto de `assets/categorias.json`. |
| `posiciones[].monto` | sí | Valor de mercado en la moneda original (número, sin separadores). |
| `posiciones[].moneda` | no (USD) | Código ISO: USD, PEN, EUR… |
| `posiciones[].confianza` | no (media) | `alta` (dato y categoría claros), `media` (alguna inferencia), `baja` (dudoso: revisar). |
| `posiciones[].fuente` | recomendado | Archivo y página/ubicación, para trazabilidad. |
| `posiciones[].nota` | recomendado | Por qué se eligió esa categoría, sobre todo si no es obvia. |

Este mismo archivo es el **estado** del portafolio: se va completando turno a turno y lo usan los tres scripts (`generar_dashboard.py`, `llenar_plantilla.py` e `importar_excel.py`, que lo reconstruye desde un Excel anterior).

El script valida categorías, montos y tipos de cambio antes de escribir; si algo falla devuelve `{"error": "..."}` y no genera el archivo.
