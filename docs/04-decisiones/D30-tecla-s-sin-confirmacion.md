---
tipo: decision
seccion: "§9.1"
estado: abierta
impacto: 3-medio
recomendada: "Ventana de arrepentimiento de 5 segundos"
---

# D30 · La tecla S envía sin confirmar

**Problema.** **S** manda el mensaje a un prospecto real, es irreversible, y está al lado de la **A** de guardar.

**Recomendación.** No pedir confirmación (mataría la velocidad, que es el punto de los atajos): en su lugar, el envío entra a la cola con una **ventana de 5 segundos** y un aviso *"Enviando… deshacer"*. Cubre el error de tipeo sin agregar un clic a los cientos de envíos que sí son intencionales. Se conecta con [[D21-deshacer-un-envio]].

