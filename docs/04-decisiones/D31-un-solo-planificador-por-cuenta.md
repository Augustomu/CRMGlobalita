---
tipo: decision
seccion: "§5.3, §8.1"
estado: cerrada
impacto: 1-bloqueante
resuelta: "Un planificador por cuenta; mensajes primero, invitaciones últimas"
---

# D31 · Un solo planificador por cuenta

**Problema.** Invitaciones (40/día), cancelaciones (30/día) y mensajes de cadencia comparten **la misma sesión de LinkedIn**. Como tres procesos sueltos se pisan, se amontonan y disparan justamente los límites que los cupos quieren evitar.

**Decidido (2026-09-06).** Un **único planificador por cuenta**: arma el plan del día y lo ejecuta espaciado, con intervalos irregulares, dentro de la franja laboral.

## Orden de prioridad

1. **Mensajes de la cadencia que vencen.** Alguien que ya aceptó y está esperando vale más que un desconocido nuevo.
2. **Avisos de reunión** (confirmación 24 h, aviso 1 h 30, agradecimiento).
3. **Cancelaciones** de invitaciones vencidas.
4. **Invitaciones nuevas**, con el cupo que quede.

Lo que se posterga son invitaciones, que mañana salen igual. Un lead caliente esperando respuesta no se posterga.

## Sesión caída

- **No sale nada.** Todo se acumula, no se pierde. → [[sesiones-caidas]]
- Se muestra el chip "sesión caída" y se crea la tarea sugerida para revincular.
- Al revincular, **no hay ráfaga de recuperación**: se retoma al ritmo normal del día. Una ráfaga después de tres días muertos es exactamente el patrón que dispara verificaciones. → [[riesgo-linkedin]]
- Lo acumulado se va drenando en los días siguientes, siempre respetando el cupo diario.

## Nota de contexto

Como hoy **la mayoría de los mensajes se mandan a mano** (→ [[D15-fase-2-mas-28-o-mas-90]]), la competencia real por la sesión es baja: el planificador va a estar mayormente ocupado con invitaciones y cancelaciones. Esto igual queda decidido ahora porque cambia la forma del worker, y meterlo después es reescribirlo.
