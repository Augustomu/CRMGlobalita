---
tipo: entidad
seccion: "§3.2"
etapa: 1
---

# Lead

La entidad central del sistema, tal como la describe el manual (§3.2). Fechas sueltas en ISO `YYYY-MM-DD`; marcas de tiempo con zona.

> **El esquema real ya no es una sola tabla.** [[D01-base-compartida-vs-lead]] separó esto en `perfil` (la persona: identidad, incluido el teléfono desde [[D08-telefono-como-clave]]) y `lead` (el trabajo de una cuenta puntual con esa persona). Esta nota describe los campos por lo que significan; el campo que dice "identidad" vive hoy en `perfil`, no acá. Ver [[base-compartida]] para el detalle del split.

## Identidad y origen (hoy en `perfil`, salvo `cuenta`/`lista`/`pagina_origen`/`nota_r0`)

| Campo | Tipo | Notas |
|---|---|---|
| `nombre` | string | tal como figura en LinkedIn; puede traer el cargo adentro. **No truncar en el dato, truncar en la vista.** |
| `cargo` | string | ver [[D22-rol-significa-dos-cosas]] |
| `empresa`, `web`, `industria` | string | |
| `pais` | string | nombre completo o ISO-2 → [[idioma-sugerido]] |
| `ciudad` | string | |
| `cuenta` | fk [[cuenta]] | desde qué cuenta se lo trabaja. Esto sí es del `lead`, no del `perfil`: es justamente lo que varía entre relaciones. |
| `lista` | string | descripción del origen. Del `lead`: cada cuenta tiene su propia lista de origen. |
| `pagina_origen` | int? | de qué página salió; null si vino de referido o entrante. Del `lead`. Habilita "qué páginas rinden". |
| `nota_r0` | bool | si la invitación salió con nota. Del `lead`. Habilita "si la nota mejora la aceptación". |

## Contacto

- **En `perfil`** (identidad de la persona): `telefono` (→ [[normalizacion-telefono]], [[D08-telefono-como-clave]]), `foto` (se pega del portapapeles).
- **En `lead`** (propio de esta relación): `email`/`email2`/`email3`, `link_chat` (el hilo de conversación es de esta cuenta puntual). `link_perfil` ya no es un campo suelto: es de donde sale `perfil.slug` → [[D02-clave-de-dedupe]].

## Estado de la cadencia

`etapa` (R0…R8, R0-recontacto), `situacion` (en_curso, contesto, pausado, agotado, esperando_recontacto, descartado — → [[D17-estado-de-cadencia]]), `proximo_contacto`, `sin_leer_li` / `sin_leer_wa` (dos flags, uno por canal → [[D05-sin-leer-por-canal]]), `etiquetas[]`, `nota`.

`etapa` sola no alcanzaba para representar todos los estados reales; por eso ahora son dos ejes. Fase 2 dejó de ser un valor de `etapa`: es estar en R5–R8 → [[D04-fase-2-existe-dos-veces]].

## Fechas medidas

`invitacion`, `aceptacion`, `respuesta`, `ultimo_contacto`. Derivados al leer: `demora_respuesta` = respuesta − aceptación, `demora_reunion` = reunión − respuesta.

**Requisito: guardar los timestamps crudos, no los textos.** Todos los "8 h" y "cada 6 días" del prototipo se calculan al leer.

## Historial de envíos

`historial_envios[]` = `{ r, enviado_en, canal, plantilla_id?, idioma, texto }`. Es **la base de toda la analítica** de [[metricas]]: guardar el `texto` realmente enviado permite comparar variantes.

Se solapa con `mensajes_li[]` / `mensajes_wa[]` → [[D06-historial-vs-conversacion]].

## Resto

`reunion` (→ [[reunion-y-avisos]]), `historial[]` de reuniones, `mensajes_li[]` y `mensajes_wa[]` (→ [[conversaciones]]), `log[]` de ediciones (→ [[deshacer-y-revertir]]).

