---
tipo: regla
seccion: "§5.7"
modulo: core/telefono.ts
etapa: 2
---

# Normalización de teléfono

Al guardar se le agrega el código de país según el país del lead:

| País | Código | País | Código |
|---|---|---|---|
| Brasil | 55 | Perú | 51 |
| México | 52 | Paraguay | 595 |
| Argentina | 54 | Bolivia | 591 |
| Uruguay | 598 | Mozambique | 258 |
| Chile | 56 | Portugal | 351 |
| Colombia | 57 | España | 34 |

Con teléfono cargado, la ficha muestra un acceso directo a `wa.me/<solo dígitos>`. **Sin teléfono, las acciones de WhatsApp quedan deshabilitadas, no ocultas** (§9.7).

## Hueco conocido

"Agregar el código" asume que el número viene sin él, y los CSV llegan con todo: con código, con 0 de larga distancia, con 15 argentino. Y `wa.me` para Argentina necesita el 9 después del 54. → [[D29-normalizacion-real-e164]]

