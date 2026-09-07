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

## Vive en el perfil, no en el lead (D08, D29)

El teléfono es un dato de la **persona**, no de la relación con una cuenta puntual: se guarda en `perfil.telefono`, no en `lead`. Así un WhatsApp entrante se busca una sola vez para el sistema entero. → [[ruteo-whatsapp]], [[D08-telefono-como-clave]]

## Normalización real (D29)

Un normalizador propio, sin librería de terceros — el alcance son los 12 países de la tabla, no el mundo entero:

1. Si ya viene con el código del país adelante, no se toca.
2. Se saca el 0 de larga distancia.
3. Argentina: el 15 va después del código de área ("011 15-1234-5678"), no al principio — se saca de ahí, no del inicio del número.
4. Se antepone el código del país deducido de `pais` (acepta ISO-2 y nombre completo, igual que [[idioma-sugerido]]).

Un teléfono que no da un número válido **no bloquea nada**: el lead se crea igual, con `telefono_valido: false` y el original guardado en `telefono_raw`. El botón de WhatsApp queda deshabilitado con el motivo a la vista, no oculto.

## `paraWhatsApp()`: las dos rarezas de la región

Separado de la normalización, solo al armar el link de `wa.me`:

- **Argentina** necesita el **9** después del 54, o el link no abre para ningún lead argentino.
- **Brasil**: los celulares llevan un 9° dígito antes del número de 8 cifras. Los que vienen en formato viejo (sin ese 9) se completan cuando el patrón es reconocible (8 dígitos empezando en 6–9, rango móvil).

→ `packages/core/src/telefono.ts`, 15 tests en `packages/core/test/telefono.test.ts`
