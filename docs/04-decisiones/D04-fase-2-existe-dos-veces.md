---
tipo: decision
seccion: "§3.9 vs §5.1"
estado: cerrada
impacto: 2-alto
resuelta: "Fase 2 no es un estado: es estar en R5–R8. La etiqueta se deriva"
---

# D04 · Fase 2 existe dos veces

**Problema.** *Fase 2* era a la vez una `etapa` y una etiqueta del catálogo libre. Lo mismo con *Recordatorio* y *Reagendar*, que huelen a estado. Dos representaciones de lo mismo divergen en un mes.

**Decidido (2026-09-06), como consecuencia de [[D17-estado-de-cadencia]].** Fase 2 **deja de ser una etapa**. Es simplemente estar en R5–R8, o sea un lead que agotó R1–R4 sin responder.

- La interfaz sigue mostrando el chip **Fase 2**, porque el equipo piensa así. Pero es un cartel calculado, no un dato guardado.
- La **etiqueta** Fase 2 se sigue poniendo al enviar R4 (→ [[envio-de-mensaje]]), porque sirve para filtrar y porque es lo que el equipo ya hace a mano. La pone el sistema; nadie la escribe.
- *Recordatorio* queda como etiqueta pura: la agrega la regla de fábrica al enviar cualquier R (→ [[reglas-de-fabrica]]).
- *Reagendar* queda como etiqueta libre, sin significado para el motor.

**Regla general.** Si un dato decide qué hace el sistema, es un **estado**. Si solo sirve para filtrar y leer, es una **etiqueta**. Ninguna etiqueta cambia el comportamiento del motor.

