---
tipo: regla
seccion: "§5.3, §3.4"
modulo: core/cupos.ts
etapa: 5
---

# Cupos, listas y ventana de envío

- El **cupo diario es por cuenta** (default 40, editable). **No hay cupo global.**
- El script trabaja la lista de **mayor prioridad** que todavía tenga páginas; cuando se agota, pasa a la siguiente automáticamente.
- **Objetivo semanal por cuenta: 200.** El contador se resetea los **lunes 00:01**. → [[D25-zona-horaria-de-corte]]
- Una cuenta con **sesión caída** queda en cero y sus envíos se acumulan. Hay que avisarlo: chip "sesión caída" más tarea automática sugerida. → [[sesiones-caidas]]

40 por día × 5 días hábiles = los 200 semanales. La coherencia es intencional.

## Lista de invitación

Pertenece a una cuenta. Campos: `fuente` (Sales Navigator o CSV importado), `prioridad` (1 es la más alta), `paginas_total`, `pagina_actual`, `perfiles_por_pagina` (25 en Sales Navigator).

Derivados: `restantes = (paginas_total − pagina_actual) × perfiles_por_pagina`; estado **agotada** / **en uso** (la de mayor prioridad con páginas) / **en espera**.

`pagina_actual` es **dato de la automatización**: se muestra, no se edita a mano. Las listas se reordenan con **flechas, no con drag** (son 2–3 por cuenta; el drag no ahorra pasos y las flechas ya son accesibles por teclado y touch).

El cupo de invitaciones, el tope de cancelaciones y la cola de seguimiento comparten la misma sesión de LinkedIn: → [[D31-un-solo-planificador-por-cuenta]]

