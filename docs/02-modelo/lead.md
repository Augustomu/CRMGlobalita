---
tipo: entidad
seccion: "§3.2"
etapa: 1
---

# Lead

La entidad central y el objeto más grande del sistema. Fechas sueltas en ISO `YYYY-MM-DD`; marcas de tiempo con zona.

## Identidad y origen

| Campo | Tipo | Notas |
|---|---|---|
| `nombre` | string | tal como figura en LinkedIn; puede traer el cargo adentro. **No truncar en el dato, truncar en la vista.** |
| `cargo` | string | ver [[D22-rol-significa-dos-cosas]] |
| `empresa`, `web`, `industria` | string | |
| `pais` | string | nombre completo o ISO-2 → [[idioma-sugerido]] |
| `ciudad` | string | |
| `cuenta` | fk [[cuenta]] | desde qué cuenta se lo trabaja |
| `lista` | string | descripción del origen |
| `pagina_origen` | int? | de qué página salió; null si vino de referido o entrante. Habilita "qué páginas rinden". |
| `nota_r0` | bool | si la invitación salió con nota. Habilita "si la nota mejora la aceptación". |

## Contacto

`telefono` (→ [[normalizacion-telefono]]), `email`/`email2`/`email3`, `link_perfil`, `link_chat`, `foto` (se pega del portapapeles).

## Estado de la cadencia

`etapa` (R0…R8, Fase 2, Recontacto), `proximo_contacto`, `sin_leer`, `canal_sin_leer` (in/wa), `etiquetas[]`, `nota`.

`etapa` no alcanza para representar todos los estados reales → [[D17-estado-de-cadencia]]. `sin_leer` no soporta no leídos en los dos canales a la vez → [[D05-sin-leer-por-canal]].

## Fechas medidas

`invitacion`, `aceptacion`, `respuesta`, `ultimo_contacto`. Derivados al leer: `demora_respuesta` = respuesta − aceptación, `demora_reunion` = reunión − respuesta.

**Requisito: guardar los timestamps crudos, no los textos.** Todos los "8 h" y "cada 6 días" del prototipo se calculan al leer.

## Historial de envíos

`historial_envios[]` = `{ r, enviado_en, canal, plantilla_id?, idioma, texto }`. Es **la base de toda la analítica** de [[metricas]]: guardar el `texto` realmente enviado permite comparar variantes.

Se solapa con `mensajes_li[]` / `mensajes_wa[]` → [[D06-historial-vs-conversacion]].

## Resto

`reunion` (→ [[reunion-y-avisos]]), `historial[]` de reuniones, `mensajes_li[]` y `mensajes_wa[]` (→ [[conversaciones]]), `log[]` de ediciones (→ [[deshacer-y-revertir]]).

