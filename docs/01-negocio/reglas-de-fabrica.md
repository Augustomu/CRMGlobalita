---
tipo: regla
seccion: "§3.8, §5.9"
modulo: core/reglas.ts
etapa: 4
---

# Motor de reglas y reglas de fábrica

## Anatomía de una regla

`{ id, nombre, disparador, condicion?, accion, activa, corridas_semana }`

- **Disparadores:** se agrega una etiqueta · el lead responde · la reunión queda en no asistió · N días sin actividad · entra un lead nuevo.
- **Condiciones:** sin condición · de una cuenta · de un país · en una etapa.
- **Acciones:** fijar próximo contacto · cambiar la etapa · asignar a un colaborador · cargar mensaje a la cola · crear una tarea.

## Las dos de fábrica

Se pueden **apagar pero no borrar**:

1. **La etiqueta `Contacto` sugiere el próximo R.** Si el lead tiene `Contacto` y no tiene ninguna etiqueta en conflicto (`Reunión`, `Esperando confirmación`, `Aprobación del presupuesto`), el sistema **propone** el siguiente R en el chat.
2. **Enviar un R agrega la etiqueta `Recordatorio`** si todavía no la tiene.

## Hueco conocido

"Se agrega una etiqueta" como disparador más una acción que agrega etiquetas se realimenta. → [[D13-loops-de-reglas]]

