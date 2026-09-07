---
tipo: regla
seccion: "§5.6"
modulo: core/idioma.ts
etapa: 2
---

# Idioma sugerido

Se deduce del país del lead:

- **pt** — Brasil, Mozambique, Portugal, Angola.
- **es** — toda América Latina hispanohablante y España.
- **en** — default para cualquier otro país (no es una lista aparte que haya que mantener).

Se aceptan **códigos ISO-2 y nombres completos**, porque los CSV llegan de las dos formas.

## El idioma es una sugerencia, con override guardado (D09)

El lead tiene su propio campo `idioma`. Vacío = se usa la deducción por país. Cargado = manda, aunque el país diga otra cosa — resuelve al brasileño radicado en México, que con la sola inferencia se sugería mal para siempre. Se completa la primera vez que el usuario cambia el idioma al escribir.

## Países que faltaban (D28)

La lista original de `es` dejaba afuera a Ecuador, Venezuela y Centroamérica, y Portugal no estaba en ningún lado. Corregido: `pt` suma Portugal y Angola; `es` suma el resto de LATAM hispanohablante.

→ `idiomaSugerido()` e `idiomaEfectivo()` en `packages/core/src/idioma.ts`, 9 tests en `packages/core/test/idioma.test.ts`
