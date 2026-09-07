---
tipo: decision
seccion: "§3.2"
estado: abierta
impacto: 2-alto
recomendada: "historial_envios es la fuente; la conversación es lo espejado"
---

# D06 · `historial_envios` vs `mensajes_li`

**Problema.** Un R3 enviado aparece en los dos lados. Si la analítica lee ambos, cuenta doble; si lee uno solo, hay que decir cuál.

**Recomendación.** `historial_envios` es lo que **nosotros** programamos y mandamos: es la fuente de [[metricas]]. `mensajes_li[]` / `mensajes_wa[]` son el espejo del hilo real, incluidos los mensajes escritos a mano fuera del CRM. Se enlazan por `enviado_en` + canal, y la analítica **solo** lee `historial_envios`.

