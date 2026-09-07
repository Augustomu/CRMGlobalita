---
tipo: decision
seccion: "§5.7"
estado: abierta
impacto: 2-alto
recomendada: "Parseo E.164 con libphonenumber"
---

# D29 · Normalización real del teléfono

**Problema.** "Agregar el código de país" asume que el número viene sin él, y los CSV llegan con todo: con código, con 0 de larga distancia, con el 15 argentino. Y `wa.me` para Argentina necesita el **9** después del 54, si no el link no abre para ningún lead argentino.

**Recomendación.** Parsear con `libphonenumber` usando el país del lead como región por defecto, guardar en E.164, y una función aparte `paraWhatsApp()` que aplique las dos rarezas de la región: agregar el 9 argentino y contemplar el noveno dígito brasileño. Guardar también el número tal como vino, para poder revisar los que no parsean en vez de perderlos.

