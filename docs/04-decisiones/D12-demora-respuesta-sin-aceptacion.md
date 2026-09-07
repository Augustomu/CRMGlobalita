---
tipo: decision
seccion: "§3.2"
estado: abierta
impacto: 4-bajo
recomendada: "Medir desde el primer contacto nuestro"
---

# D12 · `demora_respuesta` sin aceptación

**Problema.** `respuesta − aceptacion` queda nulo o negativo para los leads que nunca aceptaron una invitación: referidos, entrantes de WhatsApp, y los que escribieron ellos primero.

**Recomendación.** Si no hay `aceptacion`, medir desde el primer envío nuestro (`historial_envios[0].enviado_en`). Si tampoco hay, el lead escribió primero: `demora_respuesta` no aplica y se muestra vacío, no cero.

