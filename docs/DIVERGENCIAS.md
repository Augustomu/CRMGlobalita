# Divergencias — lo construido vs. el prototipo

Fecha: **08/09/2026**. Contra `docs/_bundle/CRM de prospeccion.html` (subido el
07/09 17:58, commit `d0f55ca`), desempacado con `node docs/desempacar.mjs`.

Se empezó porque Augusto marcó que el selector de horario de la reunión no era
el del diseño. **Tenía razón**: el bundle está al día y el que quedó viejo es
el código. Al revisarlo aparecieron más.

Esta lista es de **primera pasada**, sobre las pantallas que pude contrastar
regla por regla. No está cerrada.

---

## 1 · FechaReunion — el selector de horario

Es la que motivó la revisión y la que más diverge: el panel de horarios está
construido con otra idea.

| Lo que dice el prototipo | Lo que hay construido |
|---|---|
| Una fila **por hora** (09 a 17) | Grilla plana de `:00` y `:30`, de 08 a 19 |
| Cada fila muestra **los eventos de esa hora** como chips, con rango y título: `14:00–14:30 · Reunión con Alexandre` | No se muestra ningún evento, solo un `title` que dice «ya hay una reunión a esa hora» |
| Un **chevron** despliega la hora en tramos de **15 min** | No hay tramos de 15 ni despliegue |
| La hora entera ocupada va **tachada** y deja de ser botón | Se dibuja igual, solo cambia el color |
| Los huecos se calculan **según la duración elegida**: `t + dur <= 1080`, y ocupado es **solape** (`t < e.b && t + dur > e.a`) | Ocupado es **coincidencia exacta** con el inicio de otra reunión. Cambiar de 30 a 60 min no cambia nada |
| Tres mensajes distintos: «Elegí un día…», «Sin disponibilidad ese día», «Sin huecos de N min ese día» | Solo el primero |
| Los días del calendario llevan **título** con lo que hay ese día | Sin título |
| **Selector de calendario**: se puede mirar el de otra persona y sus días ocupados se suman | No existe |

## 2 · ListaContactos

- **No está la ventana de 80.** §7.2 es explícito: «renderiza 80 leads y suma
  de 80 en 80 al acercarse al final del scroll; si se selecciona un lead fuera
  de la ventana visible, la ventana se expande antes de hacer scroll a él».
  Hoy se dibujan todos. Con 189 de demo no se nota; con 1.500+ sí.
- **`HOY` sale de `toISOString()`**, o sea UTC. Es el mismo bug de zona que ya
  apareció cuatro veces en otras pantallas: cerca de la medianoche clasifica
  mal qué está vencido. Los filtros de la lista quedan corridos un día.

## 3 · EnviarMensaje

Lo que el prototipo tiene y falta:

- Los chips de destacados son **arrastrables para reordenar**.
- **«Destacar mensajes»**: una checklist sobre *todos* los mensajes del
  repositorio, que guarda la selección **para la cuenta activa**.
- **«Guardar»** crea el mensaje en el repositorio desde acá.
- Después de guardar, pregunta si **cargarlo en otro idioma**.

Los chips con alcance por cuenta sí se construyeron (commit `C.2`), pero son
estáticos: se ven y se aplican, no se reordenan ni se administran desde acá.

## 4 · Conversaciones — un hueco del modelo, no de la pantalla

El prototipo recibe `mensajesLi` y `mensajesWa`: **da por hecho que el CRM
guarda los hilos**. En nuestro modelo no hay ninguna colección de mensajes por
lead — `chat_personal.mensajes` es solo para WA Personal.

Por eso hoy el panel de conversación dice «el hilo todavía no se guarda en el
CRM» y el Análisis del perfil no puede mostrar el texto del mensaje que trajo
la respuesta. **Las dos cosas son la misma falta.**

Es una decisión de modelo, no un detalle de UI: si los hilos tienen que vivir
en el CRM, hace falta una colección `mensaje` y decidir quién la llena.

## 5 · Agenda

- **No están los filtros** del prototipo (`fCheck` por estado y `fCuentas` por
  cuenta).
- **No se puede cambiar la duración arrastrando** el borde del evento
  (`Math.max(15, Math.min(180, base + pasos * 15))`).
- Las notas sí están.

## 6 · El shell (Dashboard)

Cuatro cosas del estado del prototipo que no existen:

- **Cuentas conectadas** (`SesionesWa.dc.html`): el QR y el estado de sesión
  por cuenta. Hoy figura como «falta» en el menú.
- **Atajos de teclado**: figura como «falta».
- **Panel de notificaciones**: hay campana con contador, no hay panel.
- **«Ver como»** (suplantar a otro usuario) desde Usuarios.
- Un reloj en el header.

## 7 · Tareas

Las tareas del prototipo llevan **etiquetas** y se muestran en la fila. El
campo está en la colección y en el tipo, pero no se dibuja.

---

## Cómo leer esto

Nada de esto es «se rompió»: son pantallas que funcionan y están conectadas,
construidas contra una lectura incompleta del prototipo. La de FechaReunion es
la más grave porque cambia cómo se agenda, que es el objetivo de toda la
cadencia.

El orden por impacto, si hubiera que elegir:

1. **FechaReunion** — se usa todos los días y hoy oculta información que el
   diseño muestra (qué hay en cada hora).
2. **ListaContactos** — la ventana de 80 y el bug de zona.
3. **EnviarMensaje** — administrar destacados desde donde se escribe.
4. **Conversaciones** — decidir si los hilos viven en el CRM.
5. El resto.
