---
tipo: decision
seccion: "§3.2"
estado: abierta
impacto: 3-medio
recomendada: "Medir contra la primera reunión agendada"
---

# D11 · `demora_reunion` con reuniones reagendadas

**Problema.** Si la reunión se reagenda dos veces, `reunion.fecha − respuesta` mide contra la última fecha, no contra el momento en que se logró agendar. Es el número que vas a mirar todas las semanas.

**Recomendación.** Medir contra la **primera** reunión agendada (la más vieja entre `historial[]` y la actual). Lo que interesa es cuánto tardó la conversación en convertir, no cuántas veces se movió después.

