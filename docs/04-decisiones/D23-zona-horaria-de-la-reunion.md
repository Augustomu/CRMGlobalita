---
tipo: decision
seccion: "§3.2, §8.3"
estado: abierta
impacto: 2-alto
recomendada: "Guardar timestamp con zona + zona del lead"
---

# D23 · Zona horaria de la reunión

**Problema.** La reunión guarda `fecha` y `hora` sueltas, con leads en Brasil, México y Argentina y sincronización a Google Calendar. Sin zona explícita, la reunión se agenda mal apenas el lead no está en tu huso.

**Recomendación.** Guardar el inicio como timestamp con zona más la zona en que se agendó. La agenda muestra la hora local del usuario; la ficha muestra además la del lead ("15:00 tu hora · 14:00 la de él") para no citar a nadie a las 7 de la mañana.

