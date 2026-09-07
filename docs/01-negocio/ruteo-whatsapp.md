---
tipo: regla
seccion: "§5.8"
modulo: core/ruteo.ts
etapa: 2
---

# Ruteo de WhatsApp entrante

Cuando llega un mensaje de un número desconocido:

**Si los últimos 8 dígitos coinciden con un lead ya cargado** → el mensaje entra **solo al follow-up**: el lead pasa a `sin_leer` con chip `wa`. En WA Personal solo se muestra el aviso "Ya estaban en la base" con acceso a la ficha. **No se crea nada nuevo.**

**Si no coincide** → queda como *entrante* en WA Personal, con tres salidas:

- **Mover a FU** — crea el lead y salta a Follow-up → Sin leer. → [[D26-cuenta-del-lead-nuevo]]
- **Es personal** — se queda como chat personal.
- **Agendar** — pide nombre y lo guarda en la agenda.

Un chat personal que después resulta de trabajo se pasa con **Mover a FU** desde el encabezado del chat y también desde la fila de la lista.

## Por qué 8 dígitos y no el número completo

Esquiva los dos problemas de formato de la región: el `9` que Argentina necesita después del 54 y el noveno dígito de los móviles brasileños. Es un match deliberadamente laxo. Su costo: dos leads pueden coincidir. → [[D08-telefono-como-clave]]

## Decisión cerrada

Las conversaciones de leads **no viven en WA Personal**. Están en la ficha y en la columna 1 del follow-up.

