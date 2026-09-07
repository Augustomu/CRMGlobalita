# @crm/core

Todas las reglas de negocio, como funciones puras y sin entrada/salida.
Cada archivo implementa una nota de `docs/01-negocio/` y cada test cita la sección del manual.

Nada de acá sabe qué base de datos hay, ni si el envío lo dispara una persona o el worker.

## Qué hay implementado

| Archivo | Nota | Decisiones aplicadas |
|---|---|---|
| `cadencia.ts` | `docs/01-negocio/cadencia-r0-r8.md` | D15, D16, D17 |
| `dedupe.ts` | `docs/04-decisiones/D02-clave-de-dedupe.md` | D01, D02 |
| `permisos.ts` | `docs/01-negocio/permisos.md` | — |
| `telefono.ts` | `docs/01-negocio/normalizacion-telefono.md` | D29, D08 |
| `idioma.ts` | `docs/01-negocio/idioma-sugerido.md` | D09, D28 |
| `ruteo.ts` | `docs/01-negocio/ruteo-whatsapp.md` | D08 |

`telefono.ts` y `ruteo.ts` están acoplados a propósito: el teléfono vive en `perfil`
(D08), así que `ruteo.ts` recibe el valor ya normalizado por `telefono.ts` y no
vuelve a adivinar el país ni el formato.

## Qué falta y por qué

Nada pendiente de decisión en lo que ya existe. Los próximos módulos (`envio.ts`
compuesto, `reglas.ts`, `metricas.ts`, `reunion.ts`) llegan con sus etapas.

## Correr los tests

```
npm test
```

Node 24 ejecuta TypeScript directamente: no hay compilación ni dependencias.

