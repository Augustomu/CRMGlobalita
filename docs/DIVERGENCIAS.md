# Divergencias — lo construido vs. la especificación

Fecha: **08/09/2026**. Contra:

- **`CRM Globalita manual.pdf`** (32 páginas, subido el 08/09 10:09, commit `41b43e8`) — leído entero.
- **`docs/_bundle/CRM de prospeccion.html`** (07/09 17:58, commit `d0f55ca`) — desempacado con `node docs/desempacar.mjs`.

Empezó porque Augusto marcó que el selector de horario de la reunión no era el
del diseño. Tenía razón, y al revisar apareció más.

**El manual nuevo confirma varias cosas que yo había anotado como «no se puede
construir todavía» y resulta que sí, con otro modelo de datos.** Eso está en la
sección B.

---

## A · Lo que expone datos que no debería

### A.1 · La agenda muestra las reuniones de todos, con nombre y empresa

**Lo que dice el manual** (§6.3 y §8.6): la agenda de un colaborador muestra sus
reuniones, más las de cada administrador **como bloques «Ocupado», sin nombre ni
detalle**. Un switch elige qué calendario mira: *Mi calendario* o *Calendario de
{admin}*, un ítem por cada usuario con rol Administrador.

**Lo que hay**: `useAgenda.ts` hace `getFullList` de **todas** las reuniones con
`expand: 'lead.perfil,lead.cuenta,lead.asignado'`, sin filtrar por usuario.
Cualquier colaborador ve con quién se reúne el administrador, de qué empresa y
de qué cuenta.

No alcanza con ocultarlo en la pantalla: los datos ya viajaron al navegador. Es
el mismo criterio que ya está aplicado para el Observador en `App.tsx` —«si
igual se bajaran, estarían en su navegador aunque ninguna pantalla los
dibuje»—, y acá no se aplicó.

Es la única de la lista que es un problema de datos y no de diseño.

---

## B · Lo que hace que un número falte o mienta

### B.1 · Las fechas son `date` y el manual pide `timestamp`

**Lo que dice el manual** (§3.2): el objeto `fechas` tiene `invitacion`,
`aceptacion`, `respuesta` y `ultimo_contacto` como **`timestamp`**, y agrega:
*«Requisito: guardar los timestamps crudos, no los textos»*.

**Lo que hay**: `f_invitacion`, `f_aceptacion`, `f_respuesta` son `date` en la
migración `1788600000`.

Dos cosas que el manual pide y que hoy no se pueden calcular por esto:

- **§5.5 — «Cuándo responden: distribución de respuestas por día de semana **y
  franja horaria**»**. Yo lo construí solo por día y lo anoté como «la hora no
  está en los datos». Era cierto, pero la causa es esta decisión de modelo, no
  una limitación real. Con `timestamp` se puede.
- **§3.2 — `demora_respuesta` y `demora_reunion`**, derivados que se muestran en
  lenguaje natural («8 h», «18 días»). Con solo la fecha, «8 h» no existe.

Corregirlo es cambiar cuatro campos a `date` con hora y volver a poblarlos.

### B.2 · La disponibilidad de la reunión no tiene en cuenta la duración

**Lo que dice el prototipo**: un horario está ocupado si la reunión de `dur`
minutos **se solaparía** con un evento (`t < e.b && t + dur > e.a`), y el slot
solo existe si entra antes de las 18 (`t + dur <= 1080`).

**Lo que hay**: ocupado es **coincidencia exacta** con la hora de inicio de otra
reunión. Cambiar de 30 a 60 minutos no cambia ni un horario.

Ofrece las 14:30 para una reunión de una hora aunque a las 15:00 haya otra.

### B.3 · `HOY` sale de UTC en la lista de contactos

`ListaContactos.tsx:8` usa `new Date().toISOString().slice(0, 10)`. Cerca de la
medianoche clasifica mal qué está vencido, y los filtros de la columna 1 quedan
corridos un día.

Es el mismo bug de zona que ya apareció cuatro veces en otras pantallas. Esta es
la quinta.

---

## C · El panel de horarios de la reunión

Es lo que motivó la revisión y es la divergencia más grande de diseño.

| Manual / prototipo | Construido |
|---|---|
| Una fila **por hora** (09 a 17) | Grilla plana de `:00` y `:30`, de 08 a 19 |
| Cada fila muestra **los eventos de esa hora** como chips: `14:00–14:30 · Reunión con Alexandre` | No se muestra ningún evento |
| Un **chevron** despliega la hora en tramos de **15 min** | No existe |
| La hora sin huecos va **tachada** y deja de ser botón | Solo cambia de color |
| Tres mensajes: «Elegí un día…», «Sin disponibilidad ese día», «Sin huecos de N min ese día» | Solo el primero |
| Los días llevan **título** con lo que hay ese día | Sin título |
| **Selector de calendario** (§6.3): *Mi calendario* / *Calendario de {admin}*, y la disponibilidad suma los días de ese calendario | No existe |

---

## D · Lo que falta de la especificación

Ordenado por cuánto se usa.

### D.1 · Escala de la columna 1 (§7.2, §11 «transversal desde el día uno»)

La lista tiene que renderizar **80 leads y sumar de 80 en 80** al acercarse al
final del scroll; si se selecciona un lead fuera de la ventana, la ventana se
expande antes de hacer scroll a él. Hoy se dibujan todos.

El manual lo pone entre las cuatro cosas transversales *«desde el día uno»* y
avisa: *«meterlos al final cuesta el triple»*.

### D.2 · Anchos arrastrables (§9.4, también transversal)

Columna 1 (260–520), agenda (340–900) y repositorio (300–620), cada uno con
doble clic para volver al ancho normal y persistencia local. Hoy los tres son
fijos.

### D.3 · Conversaciones en la ficha (§3.2, §7.2, decisión cerrada #2)

El manual define `mensajes_li[]` y `mensajes_wa[]` en el lead, cada mensaje
`{ quien: 'in'|'out', texto, enviado_en, ack? }` con `ack ∈ enviado | entregado
| leido`. **No hay ninguna colección de mensajes en el modelo.**

Es la misma falta que hace que el Análisis del perfil no pueda mostrar el texto
del mensaje que trajo la respuesta. Las dos cosas se resuelven juntas.

### D.4 · Enviar mensaje (§7.2)

Faltan cuatro cosas del bloque:

- Los chips de destacados **arrastrables para reordenar**.
- **«Destacar mensajes»**: checklist sobre *todos* los mensajes del repositorio,
  que guarda para la cuenta activa.
- **«Guardar»**: crea el mensaje en el repositorio desde acá.
- Después de guardar, preguntar si **cargarlo en otro idioma** y si destacarlo.

### D.5 · Agenda (§7.6)

- **Resize** del bloque para cambiar la duración (15 a 180 min, en pasos de 15).
- Los **filtros** por estado de check y por cuenta.
- La vista **Lista** completa: foto pegada del portapapeles, links, etiquetas, y
  el filtro de check como caja de tres estados (vacía / check / cruz).
- Los bloqueos de Google Calendar con el nombre del evento.

### D.6 · El shell (§4, §7.1, §7.10)

- **Cuentas conectadas / QR** por cuenta — hoy figura como «falta» en el menú.
- **Notificaciones**: hay campana con badge, falta el popover que lista cada uno
  con su canal (LI/WA) y salta a la ficha o a la pestaña.
- **Atajos de teclado**: falta el popover que los lista. *Los atajos en sí están
  todos implementados* (`useAtajos.ts`: a s d r f g h v c z ctrl+z).
- **Ver el CRM como otro usuario** (§6.4), desde el chip de sesión.
- El botón `···` se muestra siempre; §7.1 pide que aparezca solo si el usuario
  tiene al menos una de las herramientas que contiene.

### D.7 · Detalles menores

- **Tareas**: el manual (§3.7 y §7.10) las quiere con `etiquetas[]` en la fila.
  El campo existe, no se dibuja.
- **Actividad**: retención de 90 días (§3.10, decisión #14). No está.
- **Regla**: el manual pide `corridas_semana`; hay `corridas` sin ventana.
- **Usuarios de demo**: el manual nombra a Alejandro Ruiz como observador; el
  seed tiene otros nombres.

---

## E · Lo que sí coincide

Para que la lista de arriba se lea en contexto. Verificado contra el manual:

- Cadencia R0–R8 con esperas configurables, pausa por paso, Fase 2 a los 90
  días, y el lead que responde sale de la cadencia automática (§5.1).
- El texto sale **siempre** del repositorio, y si no hay se avisa (§5.2).
- Cupos por cuenta sin cupo global, objetivo semanal, reset lunes 00:01 (§5.3).
- Cancelación a 90 / recontacto a 60 / tope 30 por día y cuenta, con la tabla de
  quiénes vuelven hoy, esta semana y la próxima (§5.4).
- **Aceptadas por fecha de aceptación**, no de envío, y aclarado en la vista
  (§5.5, decisión #10).
- En R0 la conversión es aceptación y se marca distinto (§5.5).
- Idioma sugerido por país, aceptando ISO-2 y nombre completo (§5.6).
- Normalización de teléfono con código de país, y WhatsApp deshabilitado con
  motivo en vez de oculto (§5.7, §9.7).
- Ruteo de entrantes con las tres salidas, y el conocido que solo avisa (§5.8).
- Las dos reglas de fábrica, que se apagan pero no se borran (§5.9).
- Al enviar: registro, etiqueta Recordatorio, fecha **propuesta** y no fijada, y
  todo como una sola edición (§5.10, decisión #7).
- Siete estados de proyecto, Congelado automático a los 30 días, los dos
  cerrados terminales, y la leyenda al pie (§5.12).
- Lead → proyecto **manual** desde acciones rápidas (§5.13, decisión #17).
- Las 15 claves de permiso y la resolución rol-como-preset (§6.1, §6.2).
- Asignación en lote con filtros multi-selección y «seleccionar los N» que
  alcanza a todos, no a los visibles (§6.5).
- **Las listas de invitación se reordenan con flechas, no con drag**
  (decisión #5), y el repositorio sí con drag (§7.9).
- Control de solo lectura con su pastilla, para todos los roles (§7.11,
  decisión #22).
- Los tres temas y el aviso de cambios sin guardar (§9.3, §9.6).

---

## Por qué pasó

Construí mirando el marcado de cada `.dc.html` y no la lógica de su
`renderVals`, que es donde están las reglas. El marcado muestra *qué se ve*; la
lógica dice *cuándo y por qué*. De ahí salen las tres divergencias de la
sección B, que son las que hacen que un número esté mal en vez de que una
pantalla se vea distinta.

La relectura de ahora se hizo al revés: primero la lógica y el manual, después
la pantalla.
