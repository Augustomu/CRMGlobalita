---
tipo: decision
seccion: "§5.10, §9.2"
estado: abierta
impacto: 2-alto
recomendada: "Deshacer revierte los campos, no el mensaje, y lo dice"
---

# D21 · Deshacer un envío

**Problema.** [[envio-de-mensaje]] mete el envío en la pila de deshacer como una sola edición, pero el mensaje ya está en el teléfono del prospecto. El usuario cree que canceló algo que no se puede cancelar.

**Recomendación.** "Deshacer" revierte los campos locales (etiquetas, próximo contacto, entrada del historial marcada como anulada) y **nunca** el envío, con un texto explícito: *"El mensaje ya salió. Se revierten los cambios en la ficha."* Distinto es un envío **en cola pero no enviado**: ese sí se cancela de verdad, y conviene una ventana corta de arrepentimiento antes de que salga.

