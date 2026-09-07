---
tipo: decision
seccion: "§5.7"
estado: cerrada
impacto: 2-alto
resuelta: "Normalizador propio para los 12 países; teléfono inválido no bloquea al lead"
---

# D29 · Normalización real del teléfono

**Problema.** "Agregar el código de país" asume que el número viene sin él, y los CSV llegan con todo: con código, con 0 de larga distancia, con el 15 argentino. Y `wa.me` para Argentina necesita el **9** después del 54, si no el link no abre para ningún lead argentino.

**Decidido (2026-09-07).**

1. **Un normalizador propio**, no una librería genérica de e.164 mundial: el alcance son los 12 países de la tabla §5.7, con reglas fijas y conocidas. Una dependencia pesada para un problema acotado no se justifica. → `packages/core/src/telefono.ts`
2. **Un teléfono que no se puede normalizar bien no bloquea nada.** El lead se crea igual, marcado `telefono_valido: false`. El botón de WhatsApp queda deshabilitado con el motivo a la vista (§9.7: deshabilitado con motivo, no oculto). Nunca se pierde un lead real por un formato raro en el CSV.
3. **El original nunca se pierde**: se guarda en `telefono_raw` tal como vino, para poder revisarlo y corregirlo a mano.
4. **`paraWhatsApp()` es una función aparte** de la normalización: aplica las dos rarezas de la región (el 9 argentino, el 9° dígito de los celulares brasileños en formato viejo) solo al armar el link de `wa.me`, sin tocar el valor E.164 guardado.

## Consecuencia de esquema: el teléfono se mudó a `perfil`

Al resolver esto junto con [[D08-telefono-como-clave]], quedó claro que el teléfono es un dato de **identidad de la persona**, no de la relación con una cuenta puntual — a diferencia del email, que sí puede variar según a quién se lo diste. Se movió de `lead` a `perfil`. Ver el detalle en D08.

## Qué NO se hizo

No se resolvió la detección de líneas fijas vs. móviles de Brasil con certeza absoluta: la heurística (8 dígitos, empieza en 6-9) puede fallar en casos raros. Ante la duda, no se inventa: si no calza el patrón esperado, se deja el número como vino y se marca para revisar.
