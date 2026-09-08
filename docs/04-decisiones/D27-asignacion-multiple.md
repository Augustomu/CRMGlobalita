---
tipo: decision
estado: cerrada
seccion: "3.6, 6.5"
impacto: alto
fecha: 2026-09-08
---

# D27 · Un lead se asigna a varios: responsable y acompañantes

## La pregunta

`lead.asignado` era de a uno. Varias personas trabajan el mismo lead, y hacía
falta que todas lo vieran en su lista.

La pregunta no era si permitirlo, sino **si los asignados son iguales**.

## La decisión

No son iguales:

- **Responsable**: uno solo. Es el que aparece en la columna 1 —donde hay lugar
  para un chip— y el que responde por el seguimiento.
- **Acompañantes**: los que también lo trabajan y lo ven en su lista.

## Por qué no todos iguales

Con todos iguales hay que elegir a cuál mostrar en la lista, y esa elección la
terminaría haciendo el orden alfabético. Un lead que es de todos no es de
nadie: cuando algo se atrasa tiene que haber uno a quien preguntarle.

## Lo que arrastra

- `verTodosLeads` pasa a leerse *«sin esto sólo ve los leads en los que
  figura»* — como responsable o como acompañante.
- §3.6 no cambia: sin asignación explícita el lead es del administrador, y el
  administrador ve todos.
- En la lista y en la ficha, tocar el chip del agente abre la lista de gente.
  Con varios, un icono y el detalle al pasar por encima.
- El modelo ya tiene `nivel_asignacion`, que probablemente alcance para
  distinguir responsable de acompañante sin agregar un campo.
