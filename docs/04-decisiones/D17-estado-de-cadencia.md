---
tipo: decision
seccion: "§3.2, §5.1"
estado: abierta
impacto: 1-bloqueante
recomendada: "Eje estado_cadencia separado de etapa"
---

# D17 · `etapa` no alcanza como estado

**Problema.** Un lead que responde sale de la cadencia pero su `etapa` sigue diciendo R3. Uno que terminó R8 "queda en Fase 2", igual que uno que recién entró. Uno cancelado esperando recontacto no tiene dónde vivir. No se puede distinguir "esperando R5" de "agotado".

**Recomendación.** Dos ejes:

- `etapa` = en qué paso está (R0…R8).
- `estado_cadencia` = **activa** / **detenida_por_respuesta** / **pausada** / **agotada** / **cancelada_esperando_recontacto** / **fase_2**.

Resuelve de paso [[D03-fecha-de-cancelacion]] y [[D04-fase-2-existe-dos-veces]]. Es la decisión que más consultas simplifica.

