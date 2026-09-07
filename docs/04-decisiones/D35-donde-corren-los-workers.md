---
tipo: decision
estado: cerrada
impacto: 1-bloqueante
resuelta: "Todo en VPS de Hostinger"
---

# D35 · Dónde corren los workers

**Decidido.** VPS de Hostinger: base, API, web y los 10 workers.

**El riesgo que se asume.** Las sesiones de LinkedIn pasan a operar desde un datacenter, no desde la IP de siempre. Es el mayor riesgo operativo del proyecto y no desaparece: se administra. Las mitigaciones concretas están en [[riesgo-linkedin]], y la más importante es empezar con **una sola cuenta durante dos semanas** antes de mover las diez.

**Pendiente de confirmar:** región del VPS (São Paulo si está disponible), dominio y recursos. Ver [[deploy]].
