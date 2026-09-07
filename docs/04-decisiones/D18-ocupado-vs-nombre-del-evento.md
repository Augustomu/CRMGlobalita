---
tipo: decision
seccion: "§6.3 vs §7.6"
estado: abierta
impacto: 2-alto
recomendada: "Nombre solo en el calendario propio"
---

# D18 · "Ocupado" contra el nombre del evento

**Problema.** §6.3 dice que el colaborador ve las reuniones del admin como *Ocupado* sin nombre ni detalle. §7.6 dice que los bloqueos de Google Calendar se muestran **con el nombre del evento**. Si el calendario del admin se lee por Google, el colaborador termina viendo los títulos.

**Recomendación.** El nombre se muestra **solo en el calendario propio**. Todo lo que viene de otro usuario se colapsa a un bloque *Ocupado* del lado del servidor, antes de mandarlo al navegador.

