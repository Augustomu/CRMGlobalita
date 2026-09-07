---
tipo: decision
seccion: "§3.2, §5.1"
estado: cerrada
impacto: 1-bloqueante
resuelta: "Dos ejes: etapa (dónde está) y situacion (qué hacer con él)"
---

# D17 · `etapa` no alcanza como estado

**Problema.** El lead guarda un solo dato de avance. Un lead que respondió sigue diciendo "R2", igual que uno que nunca contestó. Uno que agotó R8 dice "Fase 2", igual que uno que recién entra a Fase 2 y todavía tiene cuatro pasos por delante. Un cancelado esperando los 60 días no tiene dónde vivir.

**Decidido (2026-09-06).** Dos ejes independientes:

- **`etapa`** — dónde está en el recorrido: R0…R8.
- **`situacion`** — qué hay que hacer con él.

## Las seis situaciones

| Situación | Qué significa | ¿Sale algo automático? |
|---|---|---|
| `en_curso` | sigue la cadencia normalmente | sí, cuando vence |
| `contesto` | respondió; el seguimiento pasa a ser manual | no |
| `pausado` | frenado a propósito (por el paso o por el lead) | no |
| `agotado` | terminó R8 sin respuesta | no |
| `esperando_recontacto` | invitación cancelada; cumple los 60 días y vuelve como Recontacto | sí, al cumplirse la espera |
| `descartado` | no target, o pidió no ser contactado | **nunca** |

## Qué resuelve

- **"¿A quién le toca hoy?"** pasa a ser una sola consulta: `situacion = en_curso AND proximo_contacto <= hoy`.
- Los **cancelados** ya tienen dónde vivir, junto con `cancelada_en` de [[D03-fecha-de-cancelacion]].
- **Fase 2** deja de ser una etapa y pasa a ser lo que realmente es: estar en R5–R8. Se muestra como chip en la interfaz, pero no es un estado aparte. → [[D04-fase-2-existe-dos-veces]]
- **`descartado`** le da salida a los que no sirven, que hoy no la tienen. → [[D33-borrado-de-leads]]

## `descartado` y `no_contactar`

Son dos cosas distintas y hace falta tener las dos:

- **`situacion = descartado`** es del [[D01-base-compartida-vs-lead|lead]]: esta cuenta no lo trabaja más. Lleva motivo (no target, empresa equivocada, pidió no ser contactado).
- **`no_contactar`** es del **perfil**: nadie lo contacta, desde ninguna de las 10 cuentas, nunca. Se prende cuando la persona lo pide, y descarta todos sus leads de una.

La etiqueta *No target* sigue existiendo para filtrar, pero la que manda es la situación: una etiqueta la puede sacar cualquiera, y no debería alcanzar para que alguien vuelva a la cola de reinvitación.
