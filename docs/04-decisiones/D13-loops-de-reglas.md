---
tipo: decision
seccion: "§3.8"
estado: abierta
impacto: 2-alto
recomendada: "Profundidad 1 y sin re-disparo en la misma transacción"
---

# D13 · Loops en el motor de reglas

**Problema.** El disparador "se agrega una etiqueta" más una acción que agrega etiquetas o cambia la etapa se realimenta. `corridas_semana` sugiere que hay contador, pero no hay tope.

**Recomendación.** Una regla disparada por otra regla no dispara una tercera (profundidad 1). Ningún cambio hecho por una regla la vuelve a disparar dentro de la misma transacción. Tope duro de corridas por regla y por semana, con aviso cuando se alcanza.

