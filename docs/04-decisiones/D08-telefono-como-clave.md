---
tipo: decision
seccion: "§5.8"
estado: cerrada
impacto: 2-alto
resuelta: "El teléfono se mudó a perfil: ruteo por identidad, no por heurística de dígitos"
---

# D08 · Teléfono como clave de ruteo

**Problema.** El manual enruta un WhatsApp entrante por los últimos 8 dígitos del teléfono. Si dos leads coinciden, el ruteo es ambiguo; y con el teléfono guardado en `lead`, cada relación de trabajo tenía su propia copia, sin ninguna que mandara.

**Decidido (2026-09-07), a partir de una idea de Augusto: unificar la identidad en vez de parchear el emparejamiento.**

El teléfono se mudó de `lead` a **`perfil`**: es un dato de la persona, no de la relación con una cuenta puntual. Con eso, un WhatsApp entrante se busca **una sola vez**, contra una sola tabla, con el valor ya normalizado por [[D29-normalizacion-real-e164]]. El truco de los últimos 8 dígitos deja de ser el mecanismo principal: la búsqueda es por el E.164 completo. → `packages/core/src/ruteo.ts`

## Los cuatro resultados posibles

| Resultado | Cuándo | Qué pasa |
|---|---|---|
| `desconocido` | ningún perfil coincide | entrante nuevo, las tres salidas de §5.8 (Mover a FU / Es personal / Agendar) |
| `conocido_en_esta_cuenta` | coincide un perfil y ya tiene lead en la cuenta que recibió el mensaje | entra directo al follow-up, `sin_leer_wa = true`, **no se crea nada** — la regla original de §5.8, intacta |
| `conocido_otra_cuenta` | coincide un perfil, pero su(s) lead(s) son de otra cuenta (o no tiene ninguno todavía) | **no se auto-asigna**: la persona que atiende el entrante ve quién es y decide. "Mover a FU" acá crea un lead nuevo bajo esta cuenta, enlazado al **mismo** perfil — nunca uno duplicado |
| `ambiguo` | el teléfono coincide con más de un perfil (dato sucio: línea compartida, error de carga) | queda para elegir a mano, con los candidatos a la vista. Nunca se le cuelga el mensaje al lead equivocado |

## Por qué `conocido_otra_cuenta` no se auto-asigna

Es la pieza nueva que no estaba en el manual original. Con el esquema de [[D01-base-compartida-vs-lead]] y [[D27-mismo-perfil-dos-cuentas]], un perfil puede tener leads en varias cuentas. Si Wellington (trabajado por AL) escribe a la cuenta DL, cruzar de cuenta sin que nadie lo vea rompería el aislamiento entre cuentas que el resto del sistema respeta. Por eso queda como entrante — pero uno **pre-identificado**, no uno ciego: la interfaz ya sabe quién es y con qué cuenta habla.

## Qué desapareció con este cambio

- La ambigüedad por últimos-8-dígitos, que era el problema original: ahora solo puede pasar si **dos perfiles distintos** de verdad comparten el mismo E.164, un caso mucho más raro que dos leads con formato de teléfono parecido.
- La necesidad de reglas de desempate complicadas: quedan solo 4 resultados, cada uno con una sola acción.

## Índice

`perfil.telefono` es índice **no único** (igual que `huella` en D02): dos perfiles pueden compartir un teléfono por error de carga, y eso no debe bloquear la escritura — debe sugerir revisión, no impedirla.
