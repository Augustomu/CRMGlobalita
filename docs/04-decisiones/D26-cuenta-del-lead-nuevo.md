---
tipo: decision
seccion: "§5.8"
estado: abierta
impacto: 3-medio
recomendada: "La cuenta que recibió el mensaje"
---

# D26 · Qué cuenta lleva un lead creado desde WhatsApp

**Problema.** "Mover a FU" crea el lead, pero nada dice qué `cuenta` le corresponde, y la cuenta define desde qué sesión se le escribe. Tampoco hay etapa inicial para un lead que llegó sin invitación.

**Recomendación.** La cuenta es **la que recibió el mensaje** (cada sesión de WhatsApp pertenece a una cuenta), editable después. La etapa inicial es la del primer paso con el que se lo va a trabajar, no R0: nunca hubo invitación. `pagina_origen` queda en null, que es justamente para lo que existe.

