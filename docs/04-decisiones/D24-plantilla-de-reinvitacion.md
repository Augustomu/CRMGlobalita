---
tipo: decision
seccion: "§5.4, §5.2"
estado: abierta
impacto: 3-medio
recomendada: "Paso R0-recontacto"
---

# D24 · La plantilla de reinvitación

**Problema.** [[cancelacion-recontacto]] manda al lead a la cola "con la plantilla de reinvitación", pero el lookup de [[cadencia-r0-r8]] es por prefijo `R{n} · ` y no hay un número para esto.

**Recomendación.** Un paso propio `R0-recontacto` en la enumeración, tratado como R0 a todos los efectos (cupo, nota, cancelación) pero con su propia plantilla y su propia métrica de aceptación: interesa saber si la segunda vuelta convierte distinto que la primera. Encaja directo con [[D16-plantilla-por-paso]].

