# Manual de Diseño — Dashboard Globalita

> Este archivo es la UNICA fuente de verdad para decisiones de diseño.
> Antes de cualquier cambio visual, leer este archivo completo.
> Si un cambio contradice estas reglas, NO hacerlo.

---

## Filosofia

Minimalista, limpio, pasteles calidos. Suficientes colores para distinguir acciones y estados, pocos para no marear. Cada color tiene un significado funcional fijo.

---

## Paleta de colores funcionales

### Colores de accion y estado

| Token | Hex | Uso fijo | Donde aparece |
|-------|-----|----------|---------------|
| `--accent` | `#0F6E56` | Accion primaria, estado activo/running | Botones play, pills activas, borde card running, nav-tab activa |
| `--accent-hover` | `#085041` | Hover de accent | Botones hover |
| `--accent-light` | `#E1F5EE` | Fondo de elementos accent | Background pills, tags running, headers tabla |
| `--accent-border` | `#9FE1CB` | Borde de elementos accent | Borde pills activas |
| `--success` | `#6B9A7A` | Completado, exito | Etiqueta done, cuota completa |
| `--success-light` | `#F0F5F1` | Fondo success | Background pill done |
| `--success-border` | `#C5DCCB` | Borde success | Borde pill done |
| `--warning` | `#B8923E` | Pausado, atencion | Etiqueta paused, warning |
| `--warning-light` | `#FBF6EC` | Fondo warning | Background pill paused |
| `--warning-border` | `#E5D5B0` | Borde warning | Borde pill paused |
| `--info` | `#6B8099` | Informativo, enlace, neutral activo | Pills info, links, botones secundarios |
| `--info-light` | `#F0F3F6` | Fondo info | Background pills info |
| `--info-border` | `#C5D0DA` | Borde info | Borde pills info |
| `--error` | `#B35555` | Error, detenido, fallo | Etiqueta error/stopped, alertas |
| `--error-light` | `#F8F0F0` | Fondo error | Background pill error |
| `--error-border` | `#DCC0C0` | Borde error | Borde pill error |

### Colores base

| Token | Hex claro | Hex oscuro | Uso |
|-------|-----------|------------|-----|
| `--bg` | `#F5F4F0` | `#1A1916` | Fondo pagina |
| `--surface` | `#FAFAF7` | `#222018` | Cards, paneles, topbar |
| `--border` | `#E8E6DC` | `#3A3630` | Bordes generales |
| `--text` | `#2D2D2A` | `#F0ECE6` | Texto principal |
| `--muted` | `#7A7A72` | `#B1ADA1` | Texto secundario |
| `--hint` | `#ADAAA0` | `#8A8278` | Labels, placeholders |
| `--table-cell` | `#E8F5E9` | `#1E2E1E` | Fondo celdas de tablas (matrices), verde pastel sutil para distinguir del fondo de pagina |

---

## Regla de asociacion color-accion

**INMUTABLE.** Cada color tiene UN significado. No usar accent para errores ni error para exitos.

| Accion/Estado | Color a usar | Ejemplo |
|---------------|-------------|---------|
| Iniciar, ejecutar, activo | `--accent` | Boton play, borde running |
| Completado, exito | `--success` | Pill "45/250", estado done |
| Pausado, espera activa | `--warning` | Pill paused |
| Informacion, enlace, referencia | `--info` | Pill keywords, links, logs |
| Error, detenido, fallo | `--error` | Pill error, stopped |
| Inactivo, neutral, placeholder | `--hint` | Estado idle, textos secundarios |

---

## Tipografia

- **UI general:** `"Inter", system-ui, -apple-system, sans-serif`
- **Logs/consola:** `'Courier New', monospace`
- **Pesos:** 400 (normal), 500 (medium), 600 (semi-bold) — no otros
- **Escala fija:** 9, 10, 11, 12, 13, 14, 17px — no inventar tamaños

---

## Componentes

### Botones — forma estándar

Regla: TODOS los botones son cuadrados con border-radius 8px.

- Botones de acción pequeños (play, icon): 24×24px, radius 8px, padding 0, SVG 11-14px adentro
- Botones con texto: altura 28-32px, radius 8px, padding 4px 12px
- NO usar border-radius 50% (circular) salvo en avatares o status dots
- NO usar pill-shape (radius alto) salvo chips de filtros

Excepciones permitidas:
- Queue FAB (bottom-right flotante): circular 48×48 como señal visual
- Status dots: circulares 6-8px
- Avatar de perfiles LinkedIn: circular

### Botones de accion (play/stop en matrices)

- Tamaño: **14x14px**, border-radius 3px
- Play: fondo `--accent`, texto blanco, font-size 8px
- Stop: fondo `--error`, texto blanco
- Siempre al lado del nombre, nunca mas grande que el texto

### Pills de estado

- Padding: `2px 8px`, border-radius `12px`, font-size `10px`
- Running: fondo `--accent-light`, texto `--accent`, borde `--accent-border`
- Done: fondo `--success-light`, texto `--success`, borde `--success-border`
- Paused: fondo `--warning-light`, texto `--warning`, borde `--warning-border`
- Error: fondo `--error-light`, texto `--error`, borde `--error-border`
- Info/neutral: fondo `--info-light`, texto `--info`, borde `--info-border`

### Etiquetas de cuota (REEMPLAZAN "Completado")

Formato: `actual/limite tipo` — ejemplo: `45/250 semanal`
- Si actual < 50% del limite: color `--info`
- Si actual >= 50% y < 100%: color `--accent`
- Si actual >= 100%: color `--success`

**NUNCA mostrar "Completado" como texto.** Siempre mostrar progreso numerico.

### Cards

- Border-radius: `8px` (cards normales), `12px` (secciones)
- Sombra: `0 1px 4px rgba(0,0,0,.04)`
- Running: borde izquierdo 2px `--accent`
- Idle/done/stopped: opacity 0.55, filter saturate(0.3)
- Hover: outline 2px `--accent`, opacity 1

### Matrices (tablas)

- Sección wrapper (`.mx-section`): sin fondo propio — hereda el blanco del `.section` padre
- Tabla wrapper (`.mx-wrap`): `var(--surface)`, borde `.5px var(--border)`, border-radius 10px
- Fondo header `thead th`: `var(--surface)` (mismo que mx-wrap — NO var(--bg))
- Fondo celdas `tbody td`: `var(--surface)`
- Row labels en BODY (`tbody .mx-rlbl`): `var(--bg)` para distinguir de celdas de datos
- Row labels en HEADER (`thead .mx-rlbl`): `var(--surface)` — NO gris
- Separadores columnas: `1px solid var(--border)` (NO coral en separadores)
- Row labels (SES., TOT.): font-size 12px, font-weight 600, color `--muted`

#### Estructura del header de columna (3 filas fijas)

```
[mx-hd-top]   → emojis de acción / métricas (RESP/ENV/CONV) + botón log — centrado
[mx-hd-row]   → dot + nombre + play/stop — centrado
              → fecha inline a la derecha del play (font-size 10px, --hint)
```

- `mx-hd-top` tiene `border-bottom: .5px solid var(--border)` como separador visual
- La fecha va inline en `mx-hd-row` (NO en línea separada)

### Metric Cards — Invitaciones y Cancelación — `.mc-*`

Reemplaza al layout matrix/tabla en las secciones **Invitaciones diarias** y **Cancelación de invitaciones + mensaje**. Una card vertical por cuenta, con número hero y boxes SES/TOT.

Grid:
- `.mc-grid` — wrapper
- `.mc-grid-4` — 4 columnas (Invitaciones)
- `.mc-grid-3` — 3 columnas (Cancelación)
- Responsive: 2 cols <1100px, 1 col <700px

Card (`.mc-card`):
- Padding 12px (múltiplo de 4), `border-left .5px` entre cards (top en móvil)
- Estado running: `border-left: 2px solid var(--accent)` (sin `!important` — prolijo)
- Header en 2 líneas: dot + nombre + fecha + play (línea 1), 2 iconos clusters+log (línea 2)
- Play/Stop: 24×24 radius 8px, `.mc-play-go` con `--success-*`, `.mc-play-stop` con `--error-*`
- Iconos tools: 24×24 radius 8px, fondo `--surface`, hover `--bg`

Cuota (solo Invitaciones):
- `.mc-quota` con label `--muted` 11px + `.quota-bar` existente

Hero:
- `.mc-hero-n` → 17px weight 600 (MAX escala permitida). Colores: `--text` activo, `--hint` idle. SIN label debajo.

Boxes SES/TOT:
- Label `.mc-bx-label` 9px uppercase `--hint`, con sub-span "(N ses)" en TOT
- `.mc-boxes` grid con border radius 8px, divisores `.5px solid var(--border)`
- `.mc-bx2/.mc-bx3/.mc-bx4/.mc-bx5` según cantidad de columnas
- Celda `.mc-cell-n` 13px weight 500, `.mc-cell-total` usa `--accent`, `.mc-cell-idle` usa `--hint`
- Label `.mc-cell-l` 9px uppercase `--hint`
- Hover celda: `--accent-light`

Reglas fijas del layout (NO negociables):
- SIN tag de estado — el dot comunica running/idle
- SIN icono de mensaje estándar (sobre) — solo clusters + log
- SIN label debajo del hero
- SIN columna TOTAL en boxes SES (el hero ya es el total de sesión)
- CON columna TOTAL en boxes TOT (histórico distinto al hero)

### BD Cancelados — overlay `🗄️` + badge `♻️`

Nueva feature en bloque **Invitaciones Diarias** (tab Automatizaciones). Lee `cancelados-db.json`, permite ver perfiles retirados y reintegrarlos a 2da chance tras 90 días.

**Emojis (registro):**
- `🗄️` — botón header: abre overlay "BD Cancelados" (semántica: archivo histórico, único propósito en la UI)
- `♻️` — badge dentro overlay, perfiles con `diasDesde >= 90` (semántica: re-engagement, único propósito)

No reusar estos emojis en otros contextos para evitar confusión.

**Botón header** (`.sg-header-btn` existente):
- Posición: junto a botones del header del bloque Invitaciones Diarias
- Tamaño: 28×28 radius 8px (estándar)
- Hover: unificado (`--accent` + border `--accent-br`)
- Filter grayscale en emoji (regla monocolor)

**Overlay** (`.claw-*` pattern existente, como otros overlays del dashboard):
- Backdrop semi-opaco
- Panel centrado, radius 12px, `--surface`
- Header: título "BD Cancelados" + contador total + close button
- Tabs/filtros: "Todos" / "Listos 2da chance (N)" / "Skip"
- Tabla (`.mc-*` pattern):
  - Columnas: Nombre | Cuenta | Cargo | Días | Acciones
  - Fila con badge `♻️ 2da chance` si `diasDesde >= 90` y `!skip`
  - Acción Skip: botón 28×28 con tooltip, POST `/api/cancelados-db/skip`
- Empty state: texto `--hint` 11px

**Endpoints consumidos:**
- `GET /api/cancelados-db` — lista completa
- `GET /api/cancelados-db/listos` — solo `diasDesde >= 90`, `!skip` y `!prioridadBaja`
- `POST /api/cancelados-db/skip` — body `{key, skip:true}`

**Cero hardcodes**: todo con `var(--*)` del `:root` existente. Sin colores nuevos.

### Informe Aceptación — overlay `📊`

Feature en header del bloque **Invitaciones Diarias**. Calcula tasa de aceptación histórica cruzando `history.json` + `contactados-mexico.json` + `cancelados-db.json`.

**Emoji:** `📊` — gráfico de barras, semántica "informe/métricas". Único propósito en la UI.

**Botón header** (`.mx-pill mx-pill-gray`):
- Posición: junto a `🗄️ Cancelados` en header Invitaciones
- Label: `📊 Informe` + tasa global en badge

**Overlay** (`.pop-overlay` existente):
- Header: título "📊 Informe de Aceptación" + close
- Sección 1 — **Global**: enviadas / aceptadas / canceladas / pendientes / % tasa
- Sección 2 — **Por cuenta**: tabla Alejandro/David/Francisco/Edith con columnas (Enviadas, Aceptadas, %, Canceladas)
- Sección 3 — **Por grupo**: Gerente / Consultor / US / MX
- Sección 4 — **Por semana** (últimas 8): mini serie (número por semana)

**Cálculo:**
- enviadas = Σ `history[invitar-*].sessions[].sent`
- aceptadas = count `contactados-mexico.json` filtrado por `cuenta`
- canceladas = count `cancelados-db.json` filtrado por `cuenta`
- pendientes = enviadas − aceptadas − canceladas
- tasa = aceptadas / (aceptadas + canceladas) × 100 (excluye pendientes)

**Endpoint:** `GET /api/informe-aceptacion` → JSON con las 4 secciones.

### Scoring binario SI/NO — feature backend (F4)

Filtro AI binario antes de gastar cuota. Evalúa perfil contra `keywords_include / keywords_exclude` del cluster y decide si se envía la invitación.

**Emoji semántico:** `⚖️` (balanza) — uso futuro en UI cuando se exponga métrica. Hoy es **feature backend-only**.

**Helper:** `scorePerfilBinario(textoCompleto, cluster, grupo)` en `invitar-agent.js`:
- Tier: `groq` (llama-3.1-8b-instant, free)
- Prompt: "Eres filtro binario de leads B2B. Dado perfil LinkedIn: ... Contexto cluster: ..."
- Respuesta AI: `"SI: razon"` o `"NO: razon"` (máx 8 palabras)
- **Fail-open**: en error de AI, parse fail, o texto < 20 chars → retorna `{ score: 'SI' }` (no bloquea envío)
- Retorno: `{ score: 'SI'|'NO', reason: string }`

**Integración (2 puntos):**
- Loop F2 principal (`procesarPerfilesConScroll`): entre `verificarEstadoPerfil === 'candidato'` y `enviarInvitacion`
- Loop C1 rescan (`revisarPaginaCompleta`): misma ubicación lógica

**Opt-in config** — `invitar-config.json`:
```json
{ "scoring": { "enabled": false } }
```
Default `false` (no rompe flujo actual). Activar con `true` cuando se quiera validar.

**Persistencia NO-skip:** `skipped-scored.json` (read-merge-write con `.bak`):
```json
{
  "url_normalizada": {
    "nombre": "...", "empresa": "", "url": "...",
    "cuenta": "...", "grupo": "...", "cluster": "...",
    "reason": "no encaja por X", "fecha": "ISO"
  }
}
```

**Endpoint:** `GET /api/skipped-scored` → JSON completo de la DB.

**Efecto:** cuando `score === 'NO'`, se hace `guardarSkippedScored()` + `continue` (salta perfil, no gasta cuota).

### AUTO-CAN F2 — Log de corridas (`cancelados-runs.json`)

Feature backend en `cancelar-invitaciones.js`. Cada ejecución del agente de cancelación registra una entrada en `cancelados-runs.json` con métricas agregadas.

**Archivo:** `cancelados-runs.json` (raíz del repo, NO borrar — rules--seguridad.md).

**Estructura:**
```json
{
  "runs": [
    {
      "id": "run-1712345678901",
      "fechaInicio": "2026-04-19T14:30:00.000Z",
      "fechaFin":    "2026-04-19T14:42:15.000Z",
      "duracionSec": 735,
      "modo": "normal",
      "flowsProcesados": ["invitar-alejandro", "invitar-david"],
      "porFlow": {
        "invitar-alejandro": { "detectadas": 120, "retiradas": 87, "errores": 2, "cuenta": "alejandro" },
        "invitar-david":     { "detectadas": 45,  "retiradas": 30, "errores": 0, "cuenta": "david" }
      },
      "totales": { "detectadas": 165, "retiradas": 117, "errores": 2 }
    }
  ]
}
```

**Helper:** `guardarRun(runData)` en `cancelar-invitaciones.js`:
- Read-merge-write con `.bak` (rules--concurrencia.md)
- Append-only: preserva todas las runs anteriores, agrega la nueva al final
- Cap histórico: mantiene últimas 200 runs (elimina más antiguas FIFO)

**Trigger:** al final de `main()`, después de procesar todos los flows, antes del `console.log("✅ Limpieza completada.")`.

**Modo:** `"test"` si `--test` flag, `"normal"` en corrida completa.

**Endpoint:** `GET /api/cancelados-runs` — retorna últimas 50 runs para overlay de métricas (F4).

### AUTO-CAN F3 — Groq patrón de rechazo post-run

Al final de cada corrida (post-`guardarRun`), analiza los perfiles cancelados en esta run usando Groq (`ai-router` tier `groq`) para extraer patrón común de rechazo. El patrón se guarda dentro del objeto `run` en `cancelados-runs.json`.

**Trigger:** dentro de `main()`, ANTES de `guardarRun()` (evita race con doble write). Si `totales.retiradas > 0` se llama `analizarPatronRechazo(runStart)` y el resultado se incluye en el `runData` pasado a `guardarRun`.

**Helper:** `analizarPatronRechazo(runStart)` en `cancelar-invitaciones.js`:
- Tier AI: `groq` (llama-3.1-8b-instant, free). Decisión: forzamos `groq` en vez de `auto` porque Groq tiene latencia baja, free tier, y no depende de Ollama local corriendo
- Input: `cancelados-db.json`. Filtro: `max(fechaCancelacion, ultimaCancelacion) >= runStart.toISOString()` — captura re-cancelaciones de esta corrida
- Ordena perfiles por fecha más reciente descendente y toma 30 (más recientes si run tuvo >30 cancelaciones)
- Prompt ES: "Analiza estos N perfiles cancelados de invitaciones LinkedIn B2B... Identifica patrón común en MÁXIMO 2 frases"
- `maxTokens: 200`, slice final `300` chars como cap duro
- Fail-open: try/catch global retorna `{ resumen: '', error }` sin romper el script

**Estructura agregada a la run (dentro de `cancelados-runs.json`):**
```json
"patronRechazo": {
  "resumen": "Predominan gerentes de recursos humanos y perfiles senior de consultoría académica.",
  "muestraN": 27,
  "fechaAnalisis": "2026-04-19T14:43:12.000Z"
}
```

**Log emoji:** `🧠` (inteligencia/análisis). NO usar `📊` para no colisionar con AUTO-INV F2 "Informe Aceptación".

**Utilidad:** en F4 (overlay métricas) se muestra este resumen como insight post-corrida. Futuro: feedback loop a clusters (keywords_exclude) semi-automático.

### AUTO-CAN F4 — Overlay métricas cancelación — `📉`

Feature UI en header del bloque **Cancelación** (sección outreach del dashboard).

**Emoji:** `📉` — gráfico descendente, semántica "retirar/cancelar". Único propósito en la UI.

**Botón header** (`.mx-pill mx-pill-gray`):
- Posición: junto al label "Cancelación" en `section-header` de `sec-outreach`
- Label: `📉 Métricas` + total runs registradas
- onclick: `openMetricasCancelacion()`

**Overlay** (reutiliza `.pop-overlay`):
- Header: `📉 Métricas de Cancelación` + close
- Sección 1 — **Totales histórico** (últimas 50 runs):
  - Total runs ejecutadas
  - Total invitaciones retiradas
  - Total errores acumulados
  - Duración promedio por run
- Sección 2 — **Por cuenta** (agregado): Alejandro / David / Francisco / Edith con columnas (Detectadas, Retiradas, Errores, Tasa %)
- Sección 3 — **Última run**: fecha, duración, modo (test/normal), totales + patrón de rechazo (🧠) si existe
- Sección 4 — **Historial 50 runs**: tabla compacta (fecha, modo, totales, duración)

**Endpoint:** `GET /api/cancelados-runs` (ya existe desde F2) — retorna `{ runs: [últimas 50], total: N }`.

**Cálculo tasa:** `retiradas / detectadas * 100` (por cuenta, agregado sobre todas las runs). Cap 100%.

**Estado cuando no hay runs:** overlay muestra mensaje "Sin corridas registradas aún — ejecuta `node cancelar-invitaciones.js` para empezar".

### AUTO-CAN F8 — Cancelación por performance de cuenta — `🧠`

Análisis de performance para marcar cancelados de cuentas con baja tasa de aceptación como "prioridad baja". **Requiere aprobación humana explícita.**

**Contexto:** si una cuenta (ej Alejandro) tiene <10% tasa de aceptación histórica, sus cancelados probablemente no son buenos candidatos para re-engagement. F8 permite marcarlos `prioridadBaja:true` → F7 los filtra del re-engagement automático (o UI los muestra apartes).

**Decisión de alcance MVP:**
- **Unidad de análisis = `cuenta`** (no cluster granular), porque `cancelados-db.json` no guarda `cluster` (solo `cuenta`, `cargo`, `nombre`, `url`). Granularidad por cuenta es suficiente para el insight accionable.
- Umbral default: **10% tasa de aceptación**. Configurable en UI (slider futuro, hoy fijo).
- **NO ejecuta automático**: la tabla muestra análisis, usuario clickea "Aplicar prioridad baja a cuenta X" → confirm → POST.

**Backend (dashboard-server.js):**

```
GET  /api/cancelados-db/cluster-analysis
  → {
      analisis: [
        {cuenta: "alejandro", tasa: 8, enviadas: 150, aceptadas: 12,
         nCancelados: 38, nCanceladosBaja: 0, recomendacion: "baja"},
        {cuenta: "david", tasa: 22, enviadas: 200, aceptadas: 44,
         nCancelados: 25, nCanceladosBaja: 0, recomendacion: "normal"},
        ...
      ],
      umbral: 10
    }

POST /api/cancelados-db/aplicar-prioridad
  Body: {cuenta: "alejandro"}
  → Marca db[k].prioridadBaja=true + db[k].prioridadBajaFecha en todos
    los cancelados de esa cuenta. Retorna {ok, cuenta, afectados: N}.

POST /api/cancelados-db/aplicar-prioridad (reset)
  Body: {cuenta: "alejandro", reset: true}
  → Elimina los flags prioridadBaja + prioridadBajaFecha (revert limpio).
```

**Cruce con `/api/informe-aceptacion`:** F8 reusa la lógica existente — toma `porCuenta[cuenta].tasa` y cuenta cancelados por cuenta. Sin recomputar nada.

**Estructura cancelados-db.json enriquecida F8:**
```json
{
  "...url...": {
    "...previous fields...",
    "prioridadBaja": true,
    "prioridadBajaFecha": "2026-04-19T..."
  }
}
```

**Frontend — Overlay Análisis por cuenta 🧠:**

Botón nuevo en header Cancelación: `🧠 Análisis` — abre overlay.

Overlay:
- **Header**: umbral = 10% + explicación
- **Tabla**:
  | Cuenta | Enviadas | Aceptadas | Tasa | Cancelados | Con prioridad baja | Recomendación | Acción |
  |---|---|---|---|---|---|---|---|
  | Alejandro | 150 | 12 | 8% 🔴 | 38 | 0 | Marcar baja | [Aplicar] |
  | David | 200 | 44 | 22% 🟢 | 25 | 0 | Normal | — |
  | Francisco | 80 | 3 | 4% 🔴 | 15 | 15 | Ya aplicado | [Revert] |
  | Edith | 120 | 18 | 15% 🟢 | 22 | 0 | Normal | — |

- **Footer**: texto explicativo "Los perfiles con prioridadBaja serán filtrados del re-engagement automático. Sin efecto en invitaciones nuevas."

- Click "Aplicar" → confirm dialog: "¿Marcar 38 cancelados de Alejandro como prioridad baja?" → POST → refresh
- Click "Revert" (solo si nCanceladosBaja > 0) → confirm → POST con reset:true → refresh

**Emoji `🧠` — CANÓNICO GLOBAL:** propósito único en todo el dashboard = **análisis AI + recomendaciones AI** (razonamiento, patrones, insights, sugerencias generadas por ai-router). Usos actuales: AUTO-CAN F3 (patrón rechazo Groq), AUTO-CAN F8 (performance por cuenta), CLUSTER F2 MOD (recomendación de clusters). No colisiona con ♻️ ⏳ 📉 ✨ 🔍 🏷️ 🔄 🗄️ 📊 ⚖️. **Regla:** cualquier feature futura que use AI para analizar o recomendar DEBE usar `🧠` — no crear emoji nuevo.

**Edge cases:**
- Cuenta sin enviadas (tasa = 0/0) → tasa 0% pero nCancelados puede ser 0 también → fila visible, recomendacion = "normal" (no marcar baja si no hay cancelados afectados)
- Cuenta con tasa entre umbral-1 y umbral+1 → frontend muestra badge amarillo 🟡 (zona gris)
- Aplicar dos veces → idempotente (ya están en true, no cambia nada, `afectados: 0`)
- Reset parcial — no soportado en MVP (revert afecta TODA la cuenta de una)

### AUTO-CAN F7 — Re-engagement pipeline 90d + score — `♻️`

Pipeline para dar segunda oportunidad a cancelados viejos (>=90 días). Filtrado AI + aprobación humana → cola.json.

**Contexto:** después de 90d, el contexto del perfil cambió (nuevo rol, nueva empresa, LinkedIn ya olvidó la invitación original). El candidato puede volver a ser relevante. F7 propone candidatos, el usuario aprueba uno a uno antes de reinvitar.

**Decisión de alcance:**
- F7 **escribe** a `cola.json` (TODO-list de URLs aprobadas con `reengagement:true`) — el consumo por `invitar-agent.js` queda fuera de scope de esta feature
- **Score usa `cargo`** del cancelado (no re-scrape del perfil) — si cargo vacío, scorePerfilBinario devuelve `SI` (fail-open)
- Pasar `cluster=null, grupo=''` a scorePerfilBinario (cancelados-db no guarda estos campos)

**Backend (dashboard-server.js):**

```
GET  /api/cancelados-db/listos    → ya existe (F1). Retorna {url: perfil con diasDesde}
POST /api/cancelados-db/score     → nuevo. Corre scorePerfilBinario en todos los listos sin score.
                                     Body: {} (sin params). Devuelve {scoreados:N, si:N, no:N, errores:N}
POST /api/cancelados-db/aprobar   → nuevo. Body: {key} (url normalizada).
                                     Marca aprobado:true, fechaAprobado, push a cola.json.
POST /api/cancelados-db/skip      → ya existe (F1). Body: {key, skip:bool}.
```

**Estructura cancelados-db.json enriquecida F7:**
```json
{
  "https://linkedin.com/in/juan-perez": {
    "nombre": "Juan Perez", "url": "...", "cuenta": "alejandro", "cargo": "CFO",
    "fechaCancelacion": "2026-01-10T...", "intentos": 1, "skip": false,
    "scoreSegundaOportunidad": "SI",
    "scoreReason": "cargo matching buy-persona",
    "scoreFecha": "2026-04-19T...",
    "aprobado": true,
    "aprobadoFecha": "2026-04-19T..."
  }
}
```

**Estructura cola.json (entry F7):**
```json
[
  {"url":"...","cuenta":"alejandro","nombre":"Juan Perez","cargo":"CFO",
   "reengagement":true,"fechaAprobado":"2026-04-19T...","source":"F7-cancelados-db"}
]
```

**Frontend — Overlay Re-engagement ♻️:**

Botón nuevo en el bloque Cancelación (junto a F4 📉): `♻️ Re-engagement (N)` — muestra total de listos >=90d sin skip.

Click → overlay con:
- **Header**: total listos / scoreados / aprobados
- **Acciones**: botón `Scorear todos` (llama POST /score) → progreso lineal "Scoreando N/M"
- **Lista** (tabla compacta):
  | Nombre | Cuenta | Cargo | Días | Score | Acciones |
  |---|---|---|---|---|---|
  | Juan Perez | Alejandro | CFO | 98 | ✅ SI | [Aprobar] [Skip] |
  | María L. | David | RR.HH. | 104 | ❌ NO: rol no target | [Aprobar] [Skip] |
  | Pedro S. | Edith | — | 92 | ⏳ Sin scorear | — |
- **Filtro**: All / Sin scorear / SI no aprobado / Aprobado
- **Aprobar**: POST /aprobar → row pasa a estado "✅ En cola" — botón desaparece
- **Skip**: POST /skip → row desaparece de la lista

**CSS clases nuevas:**
```css
.can-reeng-btn      { /* botón ♻️ en header cancelación */ }
.can-reeng-row      { /* row tabla overlay */ }
.can-reeng-badge-si { background:var(--success-light);color:var(--success) }
.can-reeng-badge-no { background:var(--error-light);color:var(--error) }
.can-reeng-badge-pend { background:var(--bg);color:var(--muted) }
.can-reeng-action   { /* [Aprobar] [Skip] buttons */ }
```

**Emoji `♻️`:** propósito "re-engagement / segunda oportunidad". No colisiona con 🔍 🏷️ 🔄 🗄️ 📊 ⚖️ 🧠 📉 ⏳ ✨.

**Edge cases:**
- 0 listos → overlay muestra "Sin cancelados >=90d todavía" + botón cerrar
- scorePerfilBinario puede tardar (groq AI) → loading state con progreso
- Aprobado y ya en cola.json → idempotente (no duplicar si ya existe por URL normalizada)
- `cargo` vacío → score = SI (fail-open) con razón "no_text" — usuario decide manual
- cola.json no se deduplica con pending-email / history de invitar-agent — F7 solo guarda, integración futura

### AUTO-CAN F6 — Alerta cuota pending liberada — `✨`

Notificación visible post-corrida en el **bloque Cancelación** del dashboard.

**Contexto:** LinkedIn limita ~1000 invitaciones pending por cuenta. Al cancelar invitaciones viejas, se libera "espacio pending" → el usuario puede agregar más perfiles al pipeline de `invitar-agent.js`.

**Arquitectura:**
1. **Agent side** (`cancelar-invitaciones.js`): al finalizar (antes del finally del reportProgress cleanup), si `totales.retiradas > 0`, agregar al patch:
   ```json
   "ultimaLiberacion": {
     "fecha": "2026-04-19T15:45:00Z",
     "retiradas": 8,
     "porCuenta": { "alejandro": 5, "david": 3, "francisco": 0, "edith": 0 }
   }
   ```
   Se persiste en `status/cancelar-invitaciones.json` via `/api/update`.

2. **Frontend** (`dashboard.html`): en render(), si `canStat.ultimaLiberacion && fecha < 6h atrás && retiradas > 0`:
   - Renderizar banner compacto después de `can-progress-wrap` (o debajo del header si no hay progreso activo)
   - Formato: `✨ Última corrida liberó {N} cuotas pending · alejandro: 5, david: 3 · hace {X}min` + botón ×
   - Botón × escribe `localStorage.setItem('canLibBanner_' + fechaISO, '1')` → banner suprimido para esa corrida

**CSS clases nuevas:**
```css
.can-liberada-wrap { padding:6px 12px;font-size:10px;color:var(--muted);border-bottom:.5px solid var(--border);background:var(--accent-light);display:flex;align-items:center;gap:8px }
.can-liberada-label { flex:1;font-variant-numeric:tabular-nums }
.can-liberada-close { background:none;border:none;cursor:pointer;color:var(--muted);font-size:14px;line-height:1;padding:0 4px }
```

**Emoji `✨`:** único propósito "cuota liberada / disponibilidad". No colisiona con ⏳ 📉 🧠.

**Edge cases:**
- `retiradas === 0` → no renderizar (nada liberado)
- fecha > 6h → banner expira automáticamente
- user clicks × → suprimido solo para esa corrida (próxima corrida lo re-mostrará con nuevo timestamp)
- Múltiples cuentas con 0 retiradas se omiten del listado

### AUTO-CAN F5 — Barra progreso tiempo real cancelación — `⏳`

Feature UX visible en el **header del bloque Cancelación** (sección outreach del dashboard).

**Objetivo:** mientras corre `cancelar-invitaciones.js`, el usuario ve en vivo cuánto se procesó vs cuánto queda, por cuenta activa. Al terminar, la barra desaparece.

**Arquitectura:**
1. **Agent side** (`cancelar-invitaciones.js`): durante `cleanupFlow(flow)` reporta progreso vía POST `/api/update` con:
   ```json
   {
     "id": "cancelar-invitaciones",
     "patch": {
       "running": true,
       "currentFlow": "alejandro",
       "progress": {
         "detectadas": 42,
         "procesadas": 15,
         "retiradas": 12,
         "errores": 1,
         "inicio": "2026-04-19T15:30:00Z"
       }
     }
   }
   ```
   Frecuencia: una vez tras "detectadas" inicial, luego cada 5 invitaciones procesadas (o al finalizar cada flow).
   Al terminar toda la corrida: `{ running: false, progress: null }`.

2. **Server side** (`dashboard-server.js`): `POST /api/update` ya existe — persiste en `status/cancelar-invitaciones.json`. Sin cambios.

3. **Frontend** (`dashboard.html`): polling ya activo (render() cada 2.5s lee `/api/status`). Cuando `cancelarInvitaciones.running === true` y `progress.detectadas > 0`:
   - Renderizar barra compacta en header del bloque Cancelación, debajo del botón `📉 Métricas`
   - Formato: `⏳ {currentFlow}: {procesadas}/{detectadas} · {retiradas} retiradas · {errores} err`
   - Barra visual: `<div class="can-progress-bar">` con width dinámico `= procesadas / detectadas * 100%`
   - Al terminar (`running: false`), barra se oculta automáticamente (render la reevalúa)

**CSS clases nuevas:**
```css
.can-progress-wrap { margin-top:6px; font-size:10px; color:var(--muted); }
.can-progress-bar { height:4px; background:var(--border); border-radius:2px; overflow:hidden; margin-top:3px; }
.can-progress-fill { height:100%; background:var(--accent); transition:width 300ms ease-out; }
```

**Semántica emoji `⏳`:** único propósito "corrida en curso" dentro de outreachSection. No colisiona con ♻️ 📊 ⚖️ 🧠 📉.

**Edge cases:**
- `detectadas === 0`: no renderizar barra (agente aún calculando)
- `progress` ausente: no renderizar
- Múltiples corridas consecutivas: cada flow sobrescribe `currentFlow` + `progress` en el mismo status file
- Si el agente cae a mitad: `running` queda `true` stale. Mitigación futura: `inicio` timestamp + TTL en frontend (>10min → ignorar)

### Flow de mensajes (columnas verticales por cuenta) — `.fl-*`

Reemplaza al layout de matriz para bloque de follow-up M1..M8. 4 columnas full-width (una por cuenta), métricas apiladas.

Clases (definidas en `dashboard.html` <style>):
- `.fl-wrap` — wrapper full-width
- `.fl-total-strip` — summary strip arriba con label "Cuentas linkedin · N activas" + totales
- `.fl-grid` — grid de 4 columnas (`repeat(4,minmax(0,1fr))`), gap 12px. Responsive: 2 cols <1200px, 1 col <640px
- `.fl-col` — card por cuenta, `--surface`, border 12px, padding 12px
- `.fl-hd` — header flex: play (24×24 circular) → nombre (14px/500) → cluster (24×24 8px radius)
- `.fl-date` — fecha última corrida, indentada 32px, 11px `--hint`, tabular-nums
- `.fl-rows` + `.fl-row` — filas M1..M8, zebra con `:nth-child(even)` + `--bg`
- `.fl-mk` — label M (11px/500, uppercase, `--muted`, width 28px)
- `.fl-metric` — cada métrica env/resp/conv en columna: valor 13px + label 11px lowercase
- `.fl-mval.conv` — valor de conv en `--success`
- `.fl-mval.dim` — valores en cero con `--hint`

Botones:
- `.fl-play` — circular 24×24, `--success-light` bg, `--success-br` border. Estado `.running` usa tokens `--error-*`
- `.fl-cluster` — cuadrado 24×24 radius 8px, mismos colores que `.fl-play`. Contiene SVG grid 2×2 stroke 2.4. Onclick llama a `fuClusterPicker(account)` (stub hasta implementar popover)

### Topbar y navegacion

- Height: 52px, fondo `--surface`, borde inferior `--border`
- Tabs: font-size 13px, activa con borde inferior `--accent`
- FAB (boton flotante): 48px, fondo `--accent`, sombra

---

## Spacing

Multiplos de 4px: 4, 8, 12, 16, 20, 24, 32, 48. No inventar espaciados.

## Transiciones

- Standard: `150ms ease-out`
- Scale (botones): `100ms ease-out`

## Border

- `.5px` bordes normales
- `1px` bordes accent/funcionales
- `2px` barra lateral de estado en cards

---

## Prohibiciones

- NO usar colores fuera de esta paleta
- NO usar gradientes, blur, backdrop-filter
- NO agregar fuentes fuera de Inter y Courier New
- NO usar pesos fuera de 400/500/600
- NO mostrar "Completado" como texto — siempre cuota numerica
- NO hacer botones play mas grandes que 14x14 en matrices
- NO usar colores diferentes para separadores de columnas (siempre --border)
- NO agregar emojis en CSS/HTML salvo cuando el usuario lo aprueba explícitamente
- Emojis aprobados: 💬 (&#x1F4AC;) = acciones de mensaje/config, 🔍 (&#x1F50D;) = keywords

---

## Dark mode

Cada token base tiene su version oscura (ver tabla de colores base).
Los colores funcionales se mantienen iguales pero con fondos oscuros:
- `--accent-light` → `#2E2A20`
- `--success-light` → `#202E24`
- `--warning-light` → `#2E2A1A`
- `--info-light` → `#1E242E`
- `--error-light` → `#2E2020`
- Bordes funcionales → `#3A3630` (todos iguales en dark)

---

## Divergencia conocida: dashboard.html vs este manual

**Estado:** 2026-04-11 — TODOS los tokens unificados entre manual y dashboard.html.

| Token | Valor | Estado |
|-------|-------|--------|
| `--accent` | `#0F6E56` | UNIFICADO |
| `--surface` | `#FAFAF7` | UNIFICADO |
| `--text` | `#2D2D2A` | UNIFICADO |
| `--border` | `#E8E6DC` | UNIFICADO |
| `--error` | `#B35555` | UNIFICADO |
| `--info` | `#6B8099` | UNIFICADO |

No hay divergencias pendientes.

---

## Responsive

Breakpoints recomendados:
- `768px` — apilar paneles, reducir padding
- `1100px` — grid 2 cols en vez de 3
- `700px` — grid 1 col, topbar compacto

Aplicados en: dashboard.html (700px, 1100px), mockup-seguimiento.html (768px)

---

## REGLA OBLIGATORIA — Todo cambio UX respeta UI

> Ver `rules--ui-design.md` para el checklist completo.

**Resumen ejecutivo:**
1. SOLO variables CSS de `:root` — cero hex hardcodeados
2. Border-radius: 12px secciones, 8px botones, 10px iconos
3. Spacing: multiplos de 4px
4. Font sizes: 9/10/11/12/13/14/17px
5. Emojis: SIEMPRE monocolor (filter grayscale)
6. Nuevo color → agregarlo a `:root` Y a este archivo

**Cualquier PR que viole estas reglas debe ser rechazado.**

---

## Deprecaciones

Registro de features removidos del dashboard con razón y fecha.

### SYNC CRM — 2026-04-19 (DEPRECADO — implementado)

**Razón:** Dashboard reemplaza al CRM externo (Google Sheets Fabript). Ya no hay features nuevos sobre CRM; el dashboard gestiona el estado directamente.

**Removido del dashboard (commit sync-removal 2026-04-19):**
- Nav button `#sb-crmsync` (CRM Sync) + floating panel `#fp-crmsync`
- CSS `.sg-sync-btn` + hover
- JS huérfano: `openCrmPopup`, `popFilter`, `_lastSyncPerfiles`, `runCrmSync`, `renderSyncPopup`, `crmTogProf`, `renderTotalPopup`, `loadCrmHistory`, `saveAllProfiles`
- JS activo: `_fpCrmRun`, `fpCrmSyncAll`, `fpCrmLoad`
- Endpoints: `POST /api/crm-sync`, `GET /api/crm-history`, stubs `POST /api/crm/sheets`, `POST /api/crm/calendar`
- Referencias en `jarvis/intent-classifier.js` y `scripts/health-check.js`
- Refs en `test-botones-render.js` y `test-panel-ancestors.js`

**NO removido (queda disponible manual):**
- `CalendarioyCRM/fabript_sync.py` — script Python intacto, ejecutable con `python fabript_sync.py`
- Carpeta `CalendarioyCRM/` completa (credentials, token, config)
- Endpoint `GET /api/alertas-sheet` en dashboard-server.js (sigue leyendo CalendarioyCRM/credentials.json)
- Toggle nuevo `#fp-ag-crm` (checkbox "Sincronizar al CRM Fabript" en panel Agendar) — sigue activo

**Impacto:** Sin dependencias internas del dashboard. El sync Calendar→Sheets sigue disponible ejecutando el script a mano o via checkbox nuevo del panel Agendar. -190 líneas netas (dashboard.html -101, dashboard-server.js -89).

---

### CLUSTER F2 MOD — Recomendaciones AI de clusters (2026-04-19) — IMPLEMENTADO (pendiente audit cycle 2)

**Origen:** Plan V2 Dashboard Funciones (feedback 2026-04-19). V1 proponía F2 "Crear cluster automáticamente". Feedback usuario: V2 F2 MOD = **solo sugerencia pasiva**, NO ejecución automática. Guidance adicional: "lo sumaría dentro de la parte de cluster como un emoji de informe".

**Emoji:** `🧠` (canónico, ver AUTO-CAN F8). Reusa semántica "análisis AI + recomendaciones" — NO crear emoji nuevo.

**Ubicación exacta:** `panel-sidebar-clusters` → `cl-list` → `cl-list-title` (dashboard.html:10354-10359). Botón nuevo entre `.cl-list-title-text` y `.cl-rescan-btn`.

```
┌─ Clusters ────────────────────────┐  ← cl-list-title
│ Clusters         [🧠] [🔄]        │
├───────────────────────────────────┤
│ [buscar...]               [+]     │  ← cl-list-hd
├───────────────────────────────────┤
│ ◦ Cluster gerente MC JL...        │  ← cl-list-body
```

**Botón** (reusa clase `.cl-rescan-btn` para coherencia visual):
- Tamaño: 12×12 icono, padding 4px (mismo que rescan)
- Posición: a la IZQUIERDA del botón rescan (rescan queda como último)
- Emoji `🧠` con `filter:grayscale(1)` (regla monocolor)
- `title="Generar recomendación de cluster con AI"`
- `onclick="clOpenRecomendacion()"`
- Hover unificado (ya heredado de `.cl-rescan-btn:hover`)

**Flujo técnico:**
1. Click → spinner 500ms en botón (disabled mientras corre)
2. Frontend → `POST /api/clusters/recomendar` (nuevo endpoint)
3. Backend:
   - Lee `clusters.json` (schema legacy: keyed-by-cuenta, para detección duplicados)
   - Lee `clusters-ui.json` (schema real UI: array plano, fuente canónica) — MERGE ambos en detección
   - Lee `history.json` (últimas 30 días de perfiles procesados)
   - Lee `quota-invitar.json` (cuotas + limit_reached por cuenta)
   - Llama `ai.ask(prompt, { tier: 'thinking' })` con payload consolidado
   - Prompt pide: JSON con `{nombre, region, cuenta_sugerida, keywords, exclude, justificacion}` — justificación 2-3 frases explicando por qué este cluster es valioso y qué gap cubre
4. Frontend recibe → muestra modal `.msg-modal` (reusa pattern)

**Schema real `clusters-ui.json` (fuente canónica UI):**

Array plano. Cada cluster:
```json
{
  "id": "rec-TIMESTAMP",
  "nombre": "Recomendación: <nombre AI>",
  "automatizacion": "invitaciones",
  "activo": false,
  "keywords": [{"text":"gerente ops","disabled":false}],
  "exclude":  [{"text":"recruiter","disabled":false}],
  "region": "MX-CDMX",
  "cuentas": ["alejandro"],
  "vinculos": {},
  "mensajes": {"es":"","en":"","pt":""},
  "_recomendado": true,
  "_justificacion": "2-3 frases"
}
```

Campos obligatorios: `id`, `nombre`, `automatizacion`, `activo`, `keywords[]`, `exclude[]`, `region`, `cuentas[]`, `vinculos{}`, `mensajes{es,en,pt}`.
Campos marcadores: `_recomendado:true` + `_justificacion` → UI los muestra con badge distintivo.

**Frontend push (dashboard.html `clCrearClusterRecomendado`):**
- `_clData` es array plano (`var _clData = []`), NO keyed-by-cuenta
- Push directo: `_clData.push(nuevo)` — NO `_clData[cuenta].push(...)` (bug: crea propiedad string en array, se pierde en stringify)

**Modal** (`#cluster-recomendacion-modal`, reusa `.msg-modal-overlay` + `.msg-modal`):
- Header: `🧠 Recomendación de cluster` + close button
- Body:
  - Badge AI tier usado: "Analizado con GPT-OSS 120B (thinking)"
  - Card preview del cluster propuesto (nombre, país/estado, keywords, exclude)
  - Bloque justificativa con borde `border-left:2px solid var(--accent)` (mismo estilo que línea 4420 "Patrón Groq")
  - Botones footer:
    - "Cancelar" (`.msg-modal-btn secondary`) → cierra sin crear
    - "Crear cluster inactivo" (`.msg-modal-btn primary`) → POST `/api/clusters-ui` con cluster nuevo + `activo:false` + `nombre: "Recomendación: " + data.nombre` + campo `_recomendado:true` + campo `_justificacion:data.justificacion`
- Después de crear: cerrar modal, `clRenderList()` refresca lista, cluster aparece en el grupo "Inactivos" con prefijo "Recomendación:" visible

**Motor AI:**
- Tier primario: `thinking` (GPT-OSS 120B free, razonamiento) — el más poderoso sin pago
- Fallback cascade: `thinking` → `long` (Gemini 2.5 Flash) → `quality` (Claude Sonnet 4, solo si usuario autoriza costo)
- Timeout: 90s (thinking tier)
- Prompt en español, pide salida JSON estricta

**Backend endpoint nuevo:**

```
POST /api/clusters/recomendar
  → body: {} (sin params, usa toda la data disponible)
  → response: {
      cluster: { nombre, region, cuenta_sugerida, keywords, exclude },
      justificacion: "string 2-3 frases",
      tier_usado: "thinking" | "long",
      latencyMs: 12500,
      clusters_existentes: [...]  // merge de clusters.json + clusters-ui.json (para trace)
    }
  → error: { error: "ai_unavailable", detail: "..." }
```

**tier_usado captura:** `ai.ask()` retorna `string`, NO objeto. Capturar tier MANUAL en try/catch:
```js
let tierUsed = 'thinking';
let aiResp;
try { aiResp = await ai.ask(prompt, { tier: 'thinking' }); }
catch(e) { tierUsed = 'long'; aiResp = await ai.ask(prompt, { tier: 'long' }); }
```
NO hacer `aiResp.tier` — no existe.

**Edge cases:**
- Si AI no responde (todos los tiers fallan) → modal muestra error: "AI no disponible. Probar más tarde."
- Si cluster propuesto duplica uno existente (match por nombre+país+grupo) → AI debe detectarlo, si no lo hace el endpoint valida antes de responder y retorna error "cluster_duplicado"
- Si JSON malformado del AI → parser con try/catch, fallback: mostrar texto plano en modal con opción "Reintentar"

**Estética — respeta reglas:**
- Cero hardcodes color (todo `var(--*)`)
- Botón reusa `.cl-rescan-btn` (sin clase nueva)
- Modal reusa `.msg-modal` (sin clase nueva)
- Hover unificado (heredado)
- Emoji canónico `🧠` (regla línea 444 de este documento)

**Preserva:**
- No modifica `clusters.json` existentes
- Cluster recomendado sale `activo:false` → no afecta flujo F1-F7 del agente
- Usuario puede activar/rechazar/editar después manualmente

**Implementado 2026-04-19.** Fixes aplicados tras audit cycle 1:
- `_clData.push()` (flat array, no keyed-by-cuenta)
- Schema clusters-ui.json respetado (keywords/exclude como `[{text,disabled}]`)
- `tierUsed` capturado manual (NO `aiResp.tier`)
- Detección duplicados lee AMBOS archivos (clusters.json + clusters-ui.json)
- Pendiente audit cycle 2 para validar fixes + warning inline styles modal.

---

### AGENDAR F1 MOD — Redirect AUTO CRM → WhatsApp follow-up (2026-04-19) — PENDIENTE

**Origen:** Plan V2 Dashboard Funciones (feedback 2026-04-19). V1 F1 proponía "Redirect a CRM Fabript tras agendar". V2 F1 MOD: CRM deprecado → push AUTO a **panel WhatsApp follow-up del dashboard**.

**Decisión UX (feedback 2026-04-19):** SIN botón de confirmación, SIN toast de acción. Agendar = push automático a WA. Toast informativo pasivo.

**Trigger:** respuesta OK de `POST /api/agendar` en los dos formularios existentes:
1. Panel sidebar `fp-agendar` → `fpAgendarSubmit()` (dashboard.html:5573)
2. Formulario completo → `submitAgendar()` (dashboard.html:4934)

**Cambio de UX post-agendar:**
- Antes: `showToast('Reunion agendada: NOMBRE', 'success')` → fin
- Después: `showToast('Reunion agendada: NOMBRE · agregado a WhatsApp', 'success')` + push automático silencioso a cola WA. NO abre panel WA por default (no interrumpe flujo actual del usuario).

**Payload a WhatsApp:** Mismo que el botón de agendar envía al backend `/api/agendar`. WhatsApp recibe TODO el payload de la reunión (no solo nombre/linkedin). Incluye:
- `nombre`, `linkedin`, `telefono` (si está)
- `fecha_reunion`, `tipo` (Online/Presencial)
- Si Presencial: `lugar`, `pre_reunion_min`, `duracion_min`, `movilizacion_min` (ver F3 MOD)
- `contexto: 'reunion_agendada'`
- Timestamp de creación

**Implementación:**

```js
// Tras POST /api/agendar OK
showToast('Reunion agendada: ' + name + ' · agregado a WhatsApp', 'success');

// Push AUTO a cola WA (fire-and-forget, no bloquea UI)
if (typeof waAddToQueue === 'function') {
  waAddToQueue({
    nombre: name,
    linkedin: url,
    telefono: tel || '',
    contexto: 'reunion_agendada',
    fecha_reunion: fecha,
    tipo: tipo,
    lugar: lugar || null,
    pre_reunion_min: preMin || null,
    duracion_min: durMin || null,
    movilizacion_min: movMin || null,
    created_at: new Date().toISOString()
  });
}
```

**Función nueva `waAddToQueue(contacto)`:**
- POST `/api/wa/queue` con payload completo (schema above)
- Fire-and-forget: si falla, log console.warn, NO muestra error al usuario (el toast ya confirmó agendado)
- Endpoint ya existe (`/api/wa/queue`), se extiende schema para aceptar campos presencial
- Frontend NO refresca panel WA automáticamente (usuario lo ve cuando abra panel)

**NO cambios requeridos en:**
- Endpoint `POST /api/agendar` (queda igual)
- Checkbox `fp-ag-crm` (sync a Sheets — feature separada)

**Preserva:**
- Flujo actual de agendar (insert reunion, calendar, bulk mode)
- Campos existentes del formulario
- `showToast()` comportamiento por default

**Estética:** SIN elementos UI nuevos. Solo mensaje del toast extendido con sufijo "· agregado a WhatsApp". Cero botones nuevos, cero overlays.

---

### AGENDAR F3 MOD — Variables reunión presencial (2026-04-19) — PENDIENTE

**Origen:** Plan V2 Dashboard Funciones (feedback 2026-04-19). V1 F3 proponía "análisis de tiempo pre/post reunión". V2 F3 MOD: ampliar campos del formulario para reuniones presenciales con input manual + estimaciones automáticas.

**Campos nuevos (solo visibles cuando `tipo === 'Presencial'`):**

1. **Lugar** — `<input type="text">`, libre. Placeholder: "Cafetería / Oficina cliente / Home office / ...". Guardado como `lugar` en payload.
2. **Tiempo pre-reunión (llegar)** — `<input type="number">`, minutos. **Default 45** (feedback 2026-04-19). Placeholder: "Minutos para llegar al lugar".
3. **Duración estimada** — `<input type="number">`, minutos. **Default 90** (feedback 2026-04-19: presencial típico 90 min). Placeholder: "Duración de la reunión".
4. **Tiempo movilización (salir)** — `<input type="number">`, minutos. **Default 45** (feedback 2026-04-19). Placeholder: "Minutos para salir y llegar a próxima".

**Total bloqueo agenda presencial default:** 45+90+45 = **180 min (3h)** por reunión.

**UI:**

Actualmente el form tiene un tab Online/Presencial (agMode). Cuando `agMode === 'presencial'`, desplegar sección extra (`.ag-presencial-extra`) con los 4 campos en 2x2 grid usando `.fp-grid-2` existente:

```
┌────────────────┬────────────────┐
│ Lugar          │ Pre-reunión    │
│ [text]         │ [15 min]       │
├────────────────┼────────────────┤
│ Duración       │ Movilización   │
│ [60 min]       │ [30 min]       │
└────────────────┴────────────────┘
```

**Backend:**

`POST /api/agendar` recibe 4 campos nuevos en payload:
```json
{
  ...campos_actuales,
  "tipo": "Presencial",
  "lugar": "Cafetería Starbucks Polanco",
  "pre_reunion_min": 15,
  "duracion_min": 60,
  "movilizacion_min": 30
}
```

Si `tipo === 'Online'`, los 4 campos son ignorados/null.

**Google Calendar integration:**

Si la reunión sincroniza al Calendar (flujo actual), el evento se crea con:
- `start`: `fecha` (sin cambios)
- `end`: `fecha + duracion_min` (en lugar del default 60)
- `description`: incluye "Lugar: X | Pre: Y min | Buffer: Z min"

Eventos de buffer (pre + movilización) NO se crean como eventos separados en MVP — solo se registran en el payload de la reunión principal. Extensión futura: crear eventos "Traslado" automáticos.

**Estética:** 
- Reusa `.fp-input`, `.fp-grid-2`, `.fp-btn-primary` existentes
- Cero hardcodes color
- Toggle Online/Presencial ya usa clases existentes (`.ag-mode-tab` o similar)
- La sección extra aparece con transición suave (`display:none` → `display:block`) — sin animaciones custom

**No en scope MVP:**
- Auto-sugerencia de duración por tipo de lugar (ej oficina cliente → 90 min) — deferido
- Análisis de patrones históricos para predecir buffer — deferido a feature futura
- Mapa con ruta estimada — deferido

**Preserva:**
- Campos actuales del formulario
- Flujo de `fpAgendarSubmit()` y `submitAgendar()`
- Validaciones actuales (nombre + fecha obligatorios)
- Compatibilidad con agendar Online (sin cambios)

---

### AGENDAR F4 NEW — Historial de reuniones por contacto WhatsApp (2026-04-19) — APROBADO (implementación pendiente)

**Origen:** Feedback 2026-04-19. Clarificación crítica del usuario:

> "Con un lead puedo tener más de una reunión. En general TODOS los leads terminan en WhatsApp, es el lugar donde hablo con la mayoría. Desde WhatsApp puedo tener más de una reunión. Es raro que desde LinkedIn tenga más de una reunión, siempre trato de moverlos a WhatsApp."

**Insight arquitectural:** WhatsApp es el **hub central de conversación**. LinkedIn es solo la puerta de entrada (invitar → mensaje → pasar a WA). El historial de reuniones se acumula en el contexto del contacto WhatsApp, NO en el lead LinkedIn.

**Decisión derivada:**

1. **Ubicación primaria: panel WhatsApp** (cada card de cola WA muestra "Última reunión: DD/MM · Online" + contador "3 reuniones")
2. **Ubicación secundaria: sgBuildCard** (panel seguimiento — si el lead tiene reuniones agendadas desde otro flujo)
3. **NO en listas LinkedIn follow-up** (M1-M8, li-fu) — el usuario confirmó que desde LinkedIn típicamente hay 0-1 reunión, no vale agregar UI que casi siempre está vacía

**Problema que resuelve:** Hoy en panel WhatsApp no hay trazabilidad de reuniones previas. Usuario ve un contacto y no sabe si ya tuvo 0, 1 o 5 reuniones con él ni cuándo fue la última.

**Recomendación propuesta (para que usuario confirme):**

1. **Ubicación:** Panel WhatsApp (card contacto) + sgBuildCard (secundario). NO en LinkedIn follow-up.
2. **Detalle del box:** Nivel medio — "📅 Última reunión: 15/04 · Online (45 min)" + contador "3 reuniones totales". Click → expande historial con link a Calendar.
3. **Schema:** Opción B — archivo separado `reuniones-contactos.json`:
   ```json
   {
     "linkedin:juan-perez-123": [
       {"fecha":"2026-04-15T15:00","tipo":"Online","duracion_min":45,"calendar_id":"abc"},
       {"fecha":"2026-04-10T10:00","tipo":"Presencial","lugar":"Café Palermo","pre_reunion_min":45,"duracion_min":90,"movilizacion_min":45}
     ]
   }
   ```
   - Key: linkedin URL normalizada (fallback: teléfono si no hay LI)
   - Ventaja: escala sin inflar history.json; fácil de query por contacto; no interfiere con schemas existentes
4. **Fuente de escritura:** `/api/agendar` hace push al array del contacto (read-merge-write por concurrencia)
5. **Fuente de lectura:** nuevo endpoint `GET /api/reuniones?contacto=linkedin:...` devuelve array

**Impacto sobre F1 MOD:** el payload que va a WhatsApp ya incluye `fecha_reunion`, `tipo`, etc. F4 persiste eso en `reuniones-contactos.json` para que panel WA lo muestre. F1 ya implementado queda compatible (no requiere cambios).

**Scope MVP:**
- Archivo `reuniones-contactos.json` + endpoint POST `/api/agendar` extiende para push (read-merge-write)
- Endpoint GET `/api/reuniones` para consultar
- Panel WA: función `waRenderContactoCard()` renderiza box si `reuniones.length > 0`
- `sgBuildCard()`: mismo box

**No en scope MVP:**
- Sync bidireccional con Calendar (borrar del calendar no borra del history — feature futura)
- Notificaciones "próxima reunión en X horas"
- Análisis de patrones (conversión, recurrencia)

**Preserva:**
- history.json, profiles.json sin cambios
- Flujo actual de agendar
- Contactos sin reuniones: box no aparece

**Pendiente:** usuario confirma los 3 puntos (ubicación, detalle, schema) antes de implementar.

**Implementado 2026-04-19.** Desviación del spec por seguridad:
- `reuniones.json` ya existía con schema legacy `[...]` usado por 4 endpoints (POST /api/agendar, POST /api/auto-agendar, POST /api/aprobar-reunion, POST /api/guardar-perfil). Sobrescribir rompería esos flujos.
- **Decisión:** archivo nuevo `reuniones-contactos.json` con schema keyeado. `reuniones.json` legacy intacto.
- GET /api/reuniones sin query: comportamiento legacy (array); con `?contacto=` | `?linkedin=` | `?telefono=`: historial nuevo keyeado (ordenado DESC).

---

### AUTO-INV F5 — Cuota dinámica desde clusters (2026-04-19) — IMPLEMENTADO (pendiente audit cycle 2)

**Decisión:** Opción A — `capCuenta(cuenta)` lee cluster activo de la cuenta desde `clusters.json` y devuelve el total de invitaciones objetivo. Si no hay cluster activo → default 100.

**Razón:** Hoy `CUOTA_TOTAL` está hardcodeado en `invitar-agent.js:73-78` (alejandro 100, david 100, francisco 100, edith 100). Usuario quiere editar clusters desde UI y que el agente respete ese total automáticamente, sin hardcode.

**Flujo nuevo:**
1. Dashboard: usuario edita cluster activo de una cuenta → clusters.json actualizado
2. Agente arranca: `capCuenta(cuenta)` lee `clusters.json` → busca cluster activo → suma objetivos por grupo (gerente, consultor, etc) → devuelve total
3. Si no hay cluster activo → fallback 100
4. `invitar-agent.js:LimitReached detection` sigue igual — si LinkedIn frena antes, registra limit_reached

**Preserva:**
- BUG-D3 FIX (lastPage per cuenta+búsqueda, resume entre runs)
- limit_reached semanal registro en `quota-invitar.json`
- Resto del flujo F1-F7 intacto

**Pendiente implementar en próximo bloque** (NO en el commit SYNC removal).

---

### AUTO-INV F5.1 MOD — Cap por sesión (no diario) (2026-04-19)

**Decisión:** El tope de invitaciones aplica **por sesión** (una ejecución del script), no por día. Cluster `cuota` = cap de esa sesión. Si el usuario corre el script 5 veces en un mismo día → manda hasta 5 × cluster.cuota invitaciones acumuladas.

**Razón:** Hoy `totalEnviado()` suma `state.counts[cuenta]` (histórico diario persistido en `quota-invitar.json`). Si alejandro envía 50 en una sesión, al relanzar en el mismo día ya está en 50/50 y corta hasta mañana. El modelo mental del usuario es: cluster define target **por lanzamiento**, no por día calendario.

**Cambio quirúrgico mínimo** en `invitar-agent.js`:
1. Agregar variable módulo `const _sessionByCuenta = {};` (contador en memoria, por cuenta, se pierde al terminar proceso).
2. `totalEnviado(state, cuenta)` **intacto** (sigue siendo histórico del día desde state.counts). Se usa para logs/dashboard, NO como cap.
3. Nueva función `sesionEnviado(cuenta)` → devuelve `_sessionByCuenta[cuenta] || 0`.
4. `quedanInvitaciones(state, cuenta)` pasa a comparar `sesionEnviado(cuenta) < capCuenta(cuenta)` (cap por sesión, no por histórico).
5. Incrementar `_sessionByCuenta[cuenta]++` en cada invitación exitosa, alongside del `_sessionCounts[grupo]++` existente (L880, L904, L2103, L2150).
6. Reset `_sessionByCuenta[cuenta] = 0` al arrancar `runAccount(cuenta)` (~L1944).
7. Logs muestran ambos: `Día: {histórico} | Sesión: {session}/{cap}`.

**Preserva (NO tocar):**
- `state.counts[cuenta][grupo]` sigue persistiendo en `quota-invitar.json` → usado para historial/estadísticas futuras (F2 informe aceptación, UI, etc).
- `cargarCuota()` con BUG-D3 FIX intacto (lastPage, limit_reached cross-day).
- `guardarCuotaSafe()` mutex sin cambios.
- `calcularPlan()` sin cambios (sigue usando clusters de F5).

**Semántica:**
- `_sessionByCuenta` → cap por sesión (RAM, no persiste).
- `state.counts` → historial de envíos persistido (log, no cap).
- `quedanInvitaciones()` compara `_sessionByCuenta < capCuenta()` → tope por sesión.

**Pendiente:** implementación + audit cycle.

---

### CLUSTER UNIFICADO — Single Source of Truth (2026-04-19)

**Decisión:** `clusters-ui.json` es la tabla única. NO crear schema nuevo ni campo `accion` — el schema existente usa `automatizacion: "invitaciones" | "cancelacion" | "seguimiento"`.

**Principio del usuario:** el cluster define **a quién** se ejecuta (targeting: keywords, región, rol, tamaño empresa). La **acción** la define el bloque de script (invitar-agent, cancelar-invitaciones, agent-inversores). NO se edita "acción" en el cluster; se edita quién.

**Campos agregados al schema existente:**
- `rol`: "gerente" | "consultor" | "inversor" (NUEVO, canalizador)
- `departamentos`: array opcional de strings (NUEVO) — departamentos/áreas visibles en perfil LinkedIn (ej: "Operaciones", "Producción", "Calidad"). Útil para afinar targeting.
- `industria`: string opcional (NUEVO) — industria LinkedIn (ej: "Industrial Machinery", "Manufacturing").

**Descartado:** `tamano_empresa` — no se refleja en perfiles LinkedIn al conectar, no aporta al targeting visible. Si en el futuro se necesita, usar filtro dentro de SalesNav al armar la lista, NO persistir en cluster.

**Filtros a exportar desde SalesNav (import 1x):** geografía (pais/region/estado) + industria + departamentos + títulos a incluir (keywords_include) + títulos a excluir (keywords_exclude). TODOS los filtros de la lista SalesNav van al cluster para que sea reproducible.

**Regla UI:**
- `automatizacion === "invitaciones"` → mensaje nota conexión (editable en cluster).
- `automatizacion === "cancelacion"` → mensaje M1 pre-cancelación (editable en cluster, enviado antes de retirar).
- `automatizacion === "seguimiento"` → mensaje InMail (vive en cluster o tabla externa, TBD).

**Cuotas objetivo 70/30 por cuenta:**
| Cuenta | Gerente | Consultor | Total sesión |
|---|---|---|---|
| alejandro | 70 | 30 | 100 |
| david | 70 | 30 | 100 |
| francisco | 70 | 30 | 100 |
| edith | 70 | 30 | 100 |

**Ajustes requeridos `clusters-ui.json`:**
- `cl_ger_mxlatam` → cuotas 100 → 70 (alejandro/francisco/edith)
- `cl_con_mxlatam` → cuotas 40 → 30 (alejandro/francisco/edith)
- `cl_ger_sp` → cuota david 70 (ya ok)
- **Nuevo**: `cl_con_sp` (Consultor SP, cuota david 30) — NO existe actualmente
- Agregar `rol` y `tamano_empresa` a todos
- Verificar M1 en clusters cancelación (placeholder si vacío)

**Fuente de datos (import vs sync):**
**Decisión: import 1x + editar dashboard.** No sincronización continua. Botón UI "Importar CSV SalesNav" (futuro, no en este ciclo).

**Impacto por bloque de script:**
1. `invitar-agent.js` → lee clusters `automatizacion='invitaciones'`, usa `vinculos[cuenta].cuota` como cap sesión (F5.1).
2. `cancelar-invitaciones.js` → nuevo: lee clusters `automatizacion='cancelacion'`, valida perfil contra keywords/pais/rol, envía `mensajes.{lang}` como M1, luego retira.
3. `agent-inversores.js` → lee mensaje de clusters-ui.json según cuenta+rol, elimina MESSAGE_{ES,EN,PT} hardcoded.
4. Dashboard → UI expone `rol`, `tamano_empresa`, y botón "cluster adherido" por cuenta.

**Feature adicional pedida:** cada cuenta en UI muestra qué cluster(s) tiene adherido (por automatización). Implementación: derivar de `cluster.cuentas[]` y `cluster.vinculos[cuenta]`, agrupar por cuenta.
