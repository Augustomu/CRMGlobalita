# @crm/core

Todas las reglas de negocio, como funciones puras y sin entrada/salida.
Cada archivo implementa una sección de `docs/MANUAL.md` y cada test la cita.

Nada de acá sabe qué base de datos hay, ni si el envío lo dispara una persona o el worker.

## Qué hay implementado

| Archivo | Sección del manual | Decisiones aplicadas |
|---|---|---|
| `cadencia.ts` | §5.1 | D15, D16, D17 |
| `dedupe.ts` | §14 · D02 | D01, D02 |
| `permisos.ts` | §6 | — |
| `telefono.ts` | §5.7 | D29, D08 |
| `idioma.ts` | §5.6 | D09, D28 |
| `ruteo.ts` | §5.8 | D08 |
| `plantilla.ts` | §3.5 | D16 |
| `envio.ts` | §5.10 | D15, D16, D17 |

`telefono.ts` y `ruteo.ts` están acoplados a propósito: el teléfono vive en `perfil`
(D08), así que `ruteo.ts` recibe el valor ya normalizado por `telefono.ts` y no
vuelve a adivinar el país ni el formato.

## Qué falta y por qué

Nada pendiente de decisión en lo que ya existe. Los próximos módulos (`reglas.ts`,
`metricas.ts`, `reunion.ts`, `cupos.ts`, `cancelacion.ts`) llegan con sus etapas.

## Correr los tests

```
npm test
```

Node 24 ejecuta TypeScript directamente: no hay compilación ni dependencias.

