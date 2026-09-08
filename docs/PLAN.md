# Plan de trabajo — el prototipo pasa a ser el front-end

Decidido el 07/09/2026. Reemplaza al plan anterior de reescribir el prototipo
en React.

## La decisión

El prototipo de Design Components **es** la interfaz. No se reescribe: se sirve.
Se le enchufan los datos reales y las escrituras, y nada más.

**Por qué.** Se intentó lo otro. Reescribir a mano en React producía algo que
funcionaba pero se veía distinto, y cada ronda terminaba en «esto no es lo que
diseñé». La densidad, las medidas y el comportamiento ya están resueltos en el
prototipo; copiarlos a mano es introducir error en cada paso.

**Qué se contradice.** `CAMBIOS-COMPLETOS-DISENO.md` pide React modular. Esta
decisión lo deja sin efecto para la capa visual. Queda escrito acá para que
dentro de dos semanas no parezca un olvido.

**Qué se probó antes de decidir.** El prototipo se sirvió como estático y se
abrió en un navegador real: las cinco secciones, la conversación, la ficha, el
calendario y la cola de envíos funcionan, con cero errores de consola. El
runtime (`support.js`) tiene ciclo de vida completo — `componentDidMount`,
`componentDidUpdate`, `setState`, `props`, `refs` — así que puede pedir datos.

---

## El problema que hay que resolver bien: los re-exports

Augusto sigue diseñando en Design Components y va a exportar versiones nuevas.
Si el enchufe de datos vive **adentro** de `Dashboard.dc.html`, cada export
nuevo lo pisa.

La regla, entonces:

> **El código de datos vive en archivos aparte. Los `.dc.html` se tocan lo
> mínimo indispensable.**

En la práctica: los 304 renglones de `static CONTACTOS = [...]` y compañía se
reemplazan por una línea cada uno (`static CONTACTOS = []` + una carga en
`componentDidMount`). Todo lo demás —el fetch, el mapeo, las escrituras— vive en
`pb_public/datos.js`.

Un export nuevo se aplica corriendo `node deploy/enchufar.mjs`, que vuelve a
hacer ese reemplazo mecánico y avisa si el prototipo cambió de forma tal que ya
no encaja.

---

## Qué se tira y qué se queda

### Se tira

| | |
|---|---|
| `apps/web/` | 6.429 líneas de TypeScript/React + 2.355 de CSS |

Se va entero. Lo reemplaza el prototipo. Sigue en el historial de git por si
hace falta mirar cómo estaba resuelto algo.

**La única pérdida real:** la pantalla de **Duplicados**, que es mía y el
prototipo no tiene. Sus reglas NO se pierden: viven en
`packages/core/src/dedupe.ts` y `fusion.ts`, con tests. Hay que rehacer la
pantalla en formato DC (fase 3).

### Se queda

| | Por qué |
|---|---|
| `packages/core/` | las reglas de negocio, 158 tests. Pasan a correr del lado del servidor |
| `packages/db/` | esquema, 11 migraciones, hooks de PocketBase, Google Calendar |
| `docs/` | manual, auditoría, decisiones |
| `deploy/` | publicación al VPS |
| `packages/db/recuperacion/` | los scripts que recuperaron los 298 eventos |

---

## Las fases

### Fase 0 — Limpiar *(esta)*

- Borrar `apps/web/`.
- El prototipo pasa a `pb_public/`, **con los archivos sueltos trackeados en
  git**. Deja de ser un zip: cuando el HTML es el código fuente, git tiene que
  poder mostrar qué cambió entre una versión y la siguiente.
- El bundle se conserva en `docs/_bundle/` como el original tal como llegó.
- Actualizar `CLAUDE.md`, el mapa, los scripts y el deploy.

### Fase 1 — Follow-up con datos reales

Es la pantalla de todos los días; si funciona, el resto es repetir.

1. `pb_public/datos.js` — capa fina contra la API de PocketBase.
2. Login real contra la colección `users` (hoy la contraseña es `demo`).
3. `static CONTACTOS` → los leads de verdad, con su perfil, cuenta y etiquetas.
4. Las escrituras de la ficha: editar campos, etiquetas, próximo contacto.
5. Agendar reunión contra la colección `reunion` (el hook de Google ya existe).

### Fase 2 — El resto de lo que ya tiene backend

Control · Usuarios y permisos · Vencimientos · Repositorio de mensajes.
Las cuatro tienen colecciones y reglas hechas.

### Fase 3 — Lo que necesita modelo nuevo

Agenda · Tareas · WA Personal · Automatizaciones · Base compartida · Cola de
envíos · Importar CSV · Reglas. Cada una necesita su colección y, varias, su
módulo en `core/`: `cupos`, `cancelacion`, `reglas`, `tarea`, `agenda`,
`actividad`.

Acá también entra rehacer **Duplicados** en formato DC.

### Fase 4 — Lo que no depende de mí

- El cliente OAuth de Google Cloud, para que la disponibilidad del calendario
  salga de la agenda real.
- La decisión sobre el repositorio público y el histórico ya expuesto.
- Baileys: WhatsApp y LinkedIn.

---

## Lo que hace falta de Augusto

1. **El `dc-runtime`**, si lo tiene. `support.js` dice *«GENERATED — do not
   edit. Rebuild with `cd dc-runtime && bun run build`»*. Sin el fuente, un
   límite del runtime no se puede arreglar. Con él, deja de ser un riesgo.
2. **Cuál de los dos shells vale**: el de `Dashboard.dc.html` (sin marca, cinco
   pestañas) o el de las capturas con marca «Globalita» y pestañas Tareas /
   Agenda / Reglas / Cuentas.
