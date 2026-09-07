---
tipo: decision
seccion: "§5.2 vs §5.5"
estado: cerrada
impacto: 1-bloqueante
resuelta: "Campo paso independiente del nombre; varias plantillas por paso, una por defecto"
---

# D16 · Una plantilla por paso, o varias

**Problema.** Dos cosas en el mismo lugar:

1. La automatización busca la plantilla **por el prefijo del nombre** (`R3 · …`), y el nombre es editable. El día que alguien renombra, R3 se queda sin texto y no hay error visible: simplemente deja de salir.
2. §5.5 quiere medir *qué variante convierte*, lo que exige más de una plantilla por paso. Con el lookup por nombre, dos plantillas con el mismo prefijo son ambiguas.

**Decidido (2026-09-06).**

- La plantilla lleva un campo **`paso`** (R0…R8, `R0-recontacto`, `agradecimiento`) **independiente del nombre**. El nombre pasa a ser libre y puramente descriptivo: renombrar ya no rompe nada.
- **Puede haber varias plantillas por paso**, con una marcada **por defecto**.

## Cómo se comporta

| Dónde | Qué texto usa |
|---|---|
| [[vencimientos]] | precarga la **por defecto** del paso que toca |
| Ficha del lead | precarga la por defecto; las demás del paso aparecen como chips para elegir |
| Automatización | usa siempre la **por defecto** |

Como `historial_envios` ya guarda `plantilla_id` y el `texto` enviado, comparar cuál convierte sale solo, sin agregar nada al modelo. → [[metricas]]

## Relación con los mensajes destacados

Los "mensajes destacados" de §7.9 y las variantes por paso son **la misma necesidad vista dos veces**: tener a mano varios textos para el mismo momento de la conversación. Se unifican: destacar una plantilla es hacerla visible como chip; el `paso` es lo que dice en qué momento aparece.

## Caso sin plantilla

Si un paso no tiene ninguna plantilla, **se avisa y no se inventa texto** (regla de §5.2). En la pantalla de Automatizaciones el paso aparece marcado como incompleto.
