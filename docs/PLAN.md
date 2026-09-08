# Plan de trabajo

Decidido el 07/09/2026.

## Qué es cada cosa

> **El prototipo es la especificación, no el código de producción.**

`docs/_bundle/CRM de prospeccion.html` contiene las 29 pantallas en Design
Components. `support.js` es el runtime **compilado** que viene adentro: existe
para que los `.dc.html` se abran y se puedan revisar en un navegador, y nada
más. No es la base de la app y no se parchea — si una parte del runtime no
alcanza, esa parte ya la estamos reimplementando nativa.

La app se escribe en **nuestro stack**: React + TypeScript en `apps/web`,
PocketBase en `packages/db`, las reglas en `packages/core` con sus tests.

### La jerarquía de fuentes

| Fuente | Manda en |
|---|---|
| `docs/MANUAL.md` | las **reglas**: modelo, cadencia, permisos, integraciones |
| `docs/MANUAL-control-proyectos.md` | el anexo: Proyecto, Control, rol Observador |
| `docs/prototipo/ESTRUCTURA-Y-DECISIONES.md` | por qué cada cosa es como es |
| El prototipo (`.dc.html`) | lo **visual y el comportamiento**: medidas, densidad, flujos |

Para leer el prototipo: `node docs/desempacar.mjs` regenera `docs/prototipo/`
(gitignored) desde el bundle.

---

## El shell, cerrado

`Dashboard.dc.html` es el único header vigente. Las capturas con marca
«Globalita» y pestañas Tareas / Agenda / Reglas / Cuentas **se descartan**:
«Globalita» es una de las dos empresas propias dentro de Control —la otra es
Seng— no la marca del producto; y Tareas, Agenda y Reglas son paneles del
header, no pestañas de navegación.

**Pestañas**, armadas según los permisos del usuario:
`Automatizaciones · Control · Follow-up · WA Personal · Usuarios`

**A la derecha, sueltos:** notificaciones · tareas · agenda · tema · chip de
sesión.
**En el menú `···`:** cuentas conectadas · vencimientos · base compartida ·
repositorio · reglas · atajos.

---

## Estado

Lo medido está en `docs/AUDITORIA.md`, hecha leyendo el bundle entero.
Punto de partida: de 29 pantallas, **9 al día, 4 a medias, 16 sin construir**.

**Bloque A: cerrado. Bloque B: cerrado — las 16 pantallas están construidas,
con sus reglas en `core/` y sus datos de demo.** 264 tests.

---

## El orden

Decidido por Augusto: **primero todo el diseño, con datos falsos, para poder
verlo entero. Las integraciones al final.**

El criterio es que mirar las 29 pantallas con datos adentro es lo unico que
permite decidir si el diseño esta bien ANTES de invertir en la plomeria. Una
integracion sobre una pantalla que despues cambia es trabajo tirado.

Cada pantalla que falta necesita tres cosas: su coleccion, sus datos de demo y
la pantalla. Las tres van juntas.

### A · Terminar Follow-up

Es la pantalla de todos los dias y esta casi entera.

- **A.1** Aviso de cambios sin guardar (§9.3) — ✅ hecho
- **A.2** Los seis filtros que faltan: orden, reunion, rol, pais, ciudad,
  etiquetas. Hoy hay dos de ocho.
- **A.3** El header como lo fijo Augusto: sueltos notificaciones, tareas,
  agenda, tema y sesion; al menu de tres puntos: cuentas conectadas, vencimientos, base
  compartida, repositorio, reglas y atajos. Lo que todavia no existe va
  **deshabilitado con el motivo** (§9.7), no oculto.
- **A.4** El calendario de proximo contacto por carga: dias pintados contra el
  tope diario y atajos A/S/D/F de 1 a 4 semanas con su corrimiento. Es una
  regla: va a packages/core con tests.

### B · Las pantallas que faltan, con datos falsos — ✅ cerrado

Por cuanto se usan:

1. **Agenda** — tres vistas, arrastre de 15 minutos ✅
2. **Tareas** — grilla con estrellas de prioridad ✅
3. **Cola de envios** — al pie de la columna 1, con la cuenta regresiva ✅
4. **Automatizaciones** — invitaciones, cancelacion, seguimiento ✅
5. **WA Personal** — chats y entrantes desconocidos ✅
6. **Base compartida** — perfiles ya invitados ✅
7. **Importar CSV** — los tres pasos ✅
8. **Reglas y acciones** — disparador → condicion → accion ✅

Y los paneles chicos de la ficha: Editar links ✅ · Confirmar reunion ✅ ·
Analisis del perfil ✅ · Panel de etiquetas completo ✅ · Evento de agenda ✅
(quedo cubierto por la tarjeta hover de la Agenda).

**Lo que se omitio a proposito**, por depender de datos que todavia no existen
(CLAUDE.md regla 6 — se omite y se anota, no se reemplaza por algo inventado):

- **El texto del mensaje que logro la respuesta** (Analisis del perfil). El CRM
  no guarda el hilo de la conversacion; se lee en el chat real. Lo que si se
  construyo es *que paso* la trajo, que sale de los envios registrados.
- **Las franjas horarias de "Cuando responden"** (Automatizaciones).
  `f_respuesta` guarda solo la fecha. Se muestra por dia, que es dato real.
- **Guardar un contacto en Gmail** (WA Personal). Necesita la conexion de
  Google. El boton queda a la vista y apagado.

### C · Completar las que estan a medias — ✅ cerrado

- **Usuarios**: pestaña Actividad ✅, asignacion en lote ✅, reparto por
  cuenta ✅.
- **Repositorio**: destacados con alcance por cuenta ✅, orden arrastrable ✅,
  baja de variantes ✅.
- **Vencimientos**: chip de idioma detectado ✅.
- **Duplicados**: **no habia que rehacerla.** La auditoria decia que estaba en
  un estilo viejo, pero mirandola con datos adentro esta al dia: la
  comparacion lado a lado, los campos en desacuerdo marcados, la vista previa
  de la fusion y las tres salidas. Lo que faltaba era el dato — sin un solo
  perfil marcado siempre decia "no hay duplicados pendientes". Se sembraron
  los tres casos que la base real produce.

  **Hallazgo del seed**: el duplicado por slug igual NO existe y no hace falta
  contemplarlo. `perfil.slug` tiene indice unico, asi que el segundo no llega
  a guardarse. Es la unica clase de duplicado que el modelo ya previene solo.

### D · Recien ahi: escala e integraciones

- **El volumen real.** Hoy useLeads hace getFullList: trae los 6.165 leads
  y los dibuja todos. Hay que medirlo con volumen de verdad y decidir si
  alcanza con traer todo una vez —lo que hace que el buscador sea instantaneo,
  como esta especificado— o si el filtrado se mueve al servidor.
- **Google Calendar**: el cliente OAuth, que es de Augusto.
- **Baileys**: WhatsApp y LinkedIn.
- **CSV** y **Gmail**.

---

## Nota sobre un rodeo que se dio

Durante unas horas se probó servir el prototipo como front-end y se borró
`apps/web`. Augusto lo aclaró: el prototipo es la especificación. Se restauró
todo desde el historial sin pérdida. Queda anotado porque la prueba dejó dos
cosas útiles:

- El prototipo **corre** servido como estático, con cero errores de consola.
  Sirve para mirarlo al lado de lo construido, que es para lo que está.
- Los datos de demo del prototipo están en 304 renglones de constantes al medio
  de `Dashboard.dc.html`: son la mejor referencia de qué forma tiene cada cosa.
