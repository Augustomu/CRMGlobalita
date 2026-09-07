---
tipo: decision
seccion: "§5.4"
estado: cerrada
impacto: 2-alto
resuelta: "Campo cancelada_en + situacion esperando_recontacto"
---

# D03 · Falta `cancelada_en`

**Problema.** [[cancelacion-recontacto]] define cancelar a los 90 días y esperar 60, pero el modelo no guarda cuándo se canceló. Sin ese timestamp no se puede calcular la tabla "vuelven a la cola" ni saber a quién le toca hoy.

**Decidido (2026-09-06), como consecuencia de [[D17-estado-de-cadencia]].**

- El lead guarda `cancelada_en`.
- Su situación pasa a `esperando_recontacto`.
- La consulta de recontacto es `situacion = esperando_recontacto AND cancelada_en + espera <= hoy`.
- La tabla de Automatizaciones → Cancelación (hoy / esta semana / la próxima, por cuenta) sale de esa misma consulta con tres rangos de fecha.

Al volver, el lead pasa a `en_curso` con etapa `R0-recontacto` (→ [[D24-plantilla-de-reinvitacion]]).

