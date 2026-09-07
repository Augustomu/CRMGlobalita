---
tipo: decision
seccion: "§3.2 vs §3.11"
estado: cerrada
impacto: 1-bloqueante
resuelta: "Tabla perfil (identidad) + tabla lead (trabajo), una por cuenta"
---

# D01 · Base compartida vs Lead

**Problema.** `base_compartida` repite casi todos los campos de [[lead]]. Con 27.000 perfiles y 1.500 leads activos, la relación entre las dos define el esquema entero. El manual no dice si es tabla propia o proyección.

**Decidido (2026-09-06).** Dos tablas con responsabilidades distintas:

- **`perfil`** — la persona. Una fila por ser humano. `link_perfil` normalizado es la clave única (→ [[D02-clave-de-dedupe]]). Guarda identidad: nombre, cargo, empresa, web, industria, país, ciudad, resumen. Guarda también `no_contactar`.
- **`lead`** — la relación de trabajo entre una cuenta y un perfil. Una fila por par (perfil, cuenta). Guarda todo lo que avanza: etapa, estado de cadencia, próximo contacto, etiquetas, historial de envíos, conversaciones, reunión, asignación.

## Consecuencias

- La **base compartida es una consulta** sobre `perfil`, no una tabla que hay que sincronizar. Nunca puede quedar desactualizada.
- `duplicado_en[]` **desaparece como campo**: son los otros `lead` del mismo `perfil`.
- Los datos de identidad viven **en un solo lugar**. Corregir la empresa de alguien es una sola edición, aunque lo trabajen tres cuentas.
- **`no_contactar` vive en el perfil**, así que frena a las 10 cuentas de una. Es la única forma de cumplir un pedido de no contacto sin depender de que alguien lo replique. → [[D33-borrado-de-leads]]
- Los 27.412 perfiles y los 1.500 activos **no son dos poblaciones**: los activos son el subconjunto de leads en cadencia. El resto son los que nunca aceptaron, los cancelados y los agotados.
- Costo asumido: un join más en casi toda consulta de la lista. Con 27k filas es irrelevante.

## Qué NO cambia

La ficha del lead sigue mostrando y editando los campos de identidad como si fueran suyos. El usuario no tiene por qué enterarse de que hay dos tablas.
