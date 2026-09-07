---
tipo: decision
seccion: "§3.11"
estado: cerrada
impacto: 2-alto
resuelta: "Un perfil compartido, un lead por cuenta"
---

# D27 · El mismo perfil invitado por dos cuentas

**Problema.** `duplicado_en[]` existe, así que pasa. ¿Se crean dos leads? Si sí, la conversación y el historial quedan partidos, y dos colaboradores pueden trabajar a la misma persona sin saberlo.

**Decidido (2026-09-06), como consecuencia de [[D01-base-compartida-vs-lead]].** Un `perfil`, un `lead` por cuenta.

- Cada lead tiene **su propia conversación**, y eso es correcto: son hilos distintos, en cuentas de LinkedIn distintas. Unificarlos sería mentir sobre lo que pasó.
- La ficha muestra un aviso **"también trabajado por DL"** con link al otro lead, para que nadie escriba dos veces sin saberlo.
- Las métricas de [[metricas]] cuentan **aceptaciones por lead** (una invitación aceptada es una invitación aceptada, salga de la cuenta que salga) pero **personas alcanzadas por perfil**, para no inflar el alcance.
- `no_contactar` en el perfil frena a las dos cuentas de una.

## Pendiente menor

Definir si el sistema **avisa antes** de invitar a un perfil que otra cuenta ya invitó, o si lo permite en silencio y solo lo marca después. Recomendación: avisar en el momento de armar la lista, porque el costo de invitar dos veces lo paga la reputación de la cuenta, no la base.
