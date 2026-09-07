---
tipo: regla
seccion: "§9.2, §9.3"
modulo: core/edicion.ts
etapa: 1
---

# Deshacer, revertir y cambios sin guardar

## Log de ediciones

`log[]` = `{ editado_en, usuario_id, campo, antes, despues }`. En la ficha, cada campo revertible tiene su propio botón **revertir**.

## Pila de deshacer

- Toda edición de la ficha apila su estado anterior.
- El botón **Deshacer** del header del detalle saca el último cambio; **guardar limpia la pila**.
- Un envío de mensaje entra como **una sola edición**, aunque toque varios campos → [[envio-de-mensaje]], [[D21-deshacer-un-envio]].

## Cambios sin guardar

Cambiar de sección o de lead con cambios pendientes dispara el aviso, con opciones de **descartar** o **volver**. Los campos se siguen viendo en vivo mientras se editan; lo que no puede pasar es cruzar de sección sin decidir qué hacer con lo pendiente.

