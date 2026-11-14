# Reglas de clasificación

Cada posición se asigna a **un código** de `assets/categorias.json`. Si un fondo mezcla varias categorías, se divide en varias filas (ver "Fondos multiactivo"). Ante la duda entre dos códigos, elige el más probable, pon `confianza: "baja"` y explica la duda en `nota`.

## Orden de decisión

1. **¿Es un negocio propio o familiar (acciones de una empresa no listada que la persona controla o donde trabaja)?** → `EMPRESA_PRIVADA` (no entra al portafolio, alimenta D8).
2. **¿Es una deuda, un saldo negativo, un margen, una tarjeta, o un activo de uso personal (casa donde vive, auto)?** → `EXCLUIR`. La vivienda principal **no** es inversión salvo que la persona diga lo contrario; las propiedades alquiladas sí lo son.
3. **¿Es efectivo o casi efectivo?** → `CASH`.
4. **¿Cotiza en bolsa o es un fondo mutuo / ETF / bono negociable?** → Mercados Públicos (sección 4) u Otros (sección 5).
5. **¿Es un fondo cerrado, un compromiso de capital, una LP o un vehículo con llamadas de capital?** → Mercados Privados (sección 2).
6. **¿Es una coinversión puntual en un proyecto o préstamo específico con un grupo de inversionistas (no un fondo)?** → Club Deals (sección 3).
7. **¿Es un inmueble que la persona posee directamente (a su nombre o vía sociedad propia)?** → Inversiones Directas (sección 1).

## 1. Inversiones Directas

| Situación | Código |
|---|---|
| Departamento o casa en Perú alquilada o como inversión | `RE_PE_RESIDENCIAL` |
| Oficina en Perú | `RE_PE_OFICINAS` |
| Local comercial, almacén, terreno industrial en Perú | `RE_PE_COMERCIAL` |
| Cualquier inmueble fuera de Perú | `RE_EXTRANJERO` |

Valor: el valor comercial que indique la persona o la última tasación. Si no hay valor, **pregunta**; no inventes.

## 2. Mercados Privados (fondos)

| Señales en el documento | Código |
|---|---|
| Private credit, direct lending, mezzanine, fondos de factoring/deuda privada | `PM_PRIVATE_DEBT` |
| Buyout, growth equity, "Private Equity", secundarios de PE | `PM_PRIVATE_EQUITY` |
| Venture, seed, early stage, fondos de startups | `PM_VENTURE_CAPITAL` |
| Fondos inmobiliarios privados (no listados), FIRBI no listado | `PM_REAL_ESTATE` |
| Hedge funds, estrategias long/short, macro, multi-strategy, fondos de fondos de HF | `PM_HEDGE_FUNDS` |
| Fondos de infraestructura privada | `PM_INFRAESTRUCTURA` |

Usar el **NAV / valor de mercado** reportado (no el compromiso total). Si solo hay compromiso y llamadas, usar el capital llamado neto de distribuciones y marcar `confianza: "media"`.

## 3. Club Deals (coinversiones directas, no fondos)

| | Perú | Extranjero |
|---|---|---|
| Proyecto inmobiliario | `CD_RE_PERU` | `CD_RE_EXTRANJERO` |
| Préstamo / deuda privada puntual | `CD_DEUDA_PERU` | `CD_DEUDA_EXTRANJERO` |
| Cualquier otro (empresa, startup puntual, etc.) | `CD_OTROS_PERU` | `CD_OTROS_EXTRANJERO` |

## 4. Mercados Públicos

### Renta Variable

| Instrumento | Código |
|---|---|
| Acciones individuales de EE. UU. con capitalización > ~US$10 mil millones; ETFs/fondos S&P 500, Nasdaq-100, Total US Market, Dow (SPY, VOO, IVV, QQQ, VTI, DIA) | `RV_US_LARGE_CAP` |
| Acciones de EE. UU. < ~US$10 mil millones; ETFs Russell 2000, S&P 400/600, mid/small cap (IWM, IJH, IJR, VB, VO) | `RV_US_MID_SMALL` |
| Europa, Japón, UK, Canadá, Australia, etc.; ETFs EAFE / Developed ex-US (EFA, VEA, IEFA, EWJ, VGK) | `RV_DESARROLLADOS` |
| China, India, Brasil, México, Chile, Taiwán, Corea, etc.; ETFs EM (EEM, VWO, IEMG) | `RV_EMERGENTES` |
| Acciones de la BVL, ADRs de empresas peruanas (Credicorp BAP, Southern Copper SCCO*, Buenaventura BVN), ETF EPU, fondos mutuos de renta variable Perú | `RV_PERU` |

\* Southern Copper cotiza en NYSE pero es operación principalmente peruana/mexicana: clasificar como `RV_PERU` con `confianza: "media"` y nota.

**Fondos globales** (MSCI World, ACWI, VT, URTH): dividir según la composición regional del factsheet (típicamente ~60-70 % US Large Cap, resto Desarrollados y Emergentes). Si no hay factsheet, usar la última composición publicada que conozcas, `confianza: "media"`, y decirlo en la nota.

**Fondos sectoriales/temáticos** (XLK, ARKK, SOXX): región del índice, normalmente `RV_US_LARGE_CAP`.

### Renta Fija

| Instrumento | Código |
|---|---|
| Treasuries, T-Notes, T-Bonds, TIPS; ETFs TLT, IEF, SHY, GOVT, TIP | `RF_US_TREASURIES` |
| Bonos corporativos con rating AAA a BBB-; ETFs LQD, VCIT, IGIB; agencias y municipales de EE. UU. | `RF_INVESTMENT_GRADE` |
| Bonos corporativos BB+ o menor, sin rating de emisores de mercados desarrollados; ETFs HYG, JNK | `RF_HIGH_YIELD` |
| Soberanos o corporativos de emergentes fuera de Latam; ETFs EMB, PCY, EMLC (globales EM) | `RF_EMERGENTES` |
| Bonos de emisores latinoamericanos (excepto Perú): México, Chile, Colombia, Brasil… | `RF_LATAM` |
| Bonos soberanos del Perú (globales o soberanos en soles), corporativos peruanos, fondos mutuos de renta fija Perú | `RF_PERU` |

Prioridad de criterio: **país del emisor > rating**. Un bono de una empresa peruana con rating BB va a `RF_PERU`, no a `RF_HIGH_YIELD`.

**Fondos de bonos agregados** (AGG, BND): dividir según factsheet (Treasuries vs. corporativos IG; los MBS van a `RF_INVESTMENT_GRADE`).

## 5. Otros

| Instrumento | Código |
|---|---|
| BTC, ETFs/ETPs de bitcoin (IBIT, FBTC, GBTC) | `CRIPTO_BITCOIN` |
| ETH, ETFs de ether (ETHA) | `CRIPTO_ETHEREUM` |
| Cualquier otra cripto; stablecoins (USDT, USDC) → `CASH` | `CRIPTO_OTRAS` |
| Oro físico, ETFs de oro (GLD, IAU, GLDM) | `COMMODITY_ORO` |
| Plata, petróleo, fondos de commodities diversificados (SLV, USO, DBC) | `COMMODITY_OTROS` |

Acciones de **mineras de oro** (GDX, Newmont) son renta variable, **no** commodity.

## 6. Cash y Equivalentes → `CASH`

Saldos en cuenta corriente/ahorros, depósitos a plazo, fondos money market, T-Bills con vencimiento ≤ 12 meses mantenidos como liquidez (si el estado de cuenta los muestra como "cash equivalents"), sweep accounts, stablecoins.

Nota: la plantilla suma todo el `CASH` como **Perú** en la división geográfica. Si la mayor parte del cash está fuera, menciónalo en el resumen final.

## Fondos multiactivo

Fondos balanceados, target-date, fondos de AFP (Fondo 1/2/3), fondos mutuos mixtos: **dividir** en varias filas usando la composición del factsheet. Cada fila lleva el mismo `instrumento` con un sufijo, p. ej. "Fondo Balanceado X (porción RV US)", con el monto proporcional y la nota "Split según factsheet de <fecha>, <x> %". La suma de las porciones debe igualar el valor total del fondo.

Fondos de AFP / pensión obligatoria: **preguntar** si la persona quiere incluirlos (muchos asesores los excluyen porque no son disponibles). Por defecto, excluir con `EXCLUIR` y mencionarlo.

## Valor a usar

- Siempre el **valor de mercado** a la fecha de corte, no el costo.
- Incluir intereses devengados solo si el estado de cuenta los suma al valor de mercado.
- Si hay dos estados de cuenta de fechas distintas, usar el más reciente y avisar.
- No duplicar: un ETF que aparece en el resumen y en el detalle del mismo estado de cuenta se cuenta una sola vez.
