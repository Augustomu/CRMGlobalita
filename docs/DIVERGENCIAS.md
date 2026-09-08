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

### A.1 · La agenda muestra las reuniones de todos — ✅ **resuelto el 08/09**

Se resolvió con una **colección de vista** `ocupado`, que expone solo
`id, calendario, inicio, duracion_min, zona`. Una regla de PocketBase no
servía: las reglas filtran FILAS y acá hacía falta filtrar COLUMNAS — el
colaborador tiene que recibir el horario y no el nombre.

Ahora:

- El colaborador pide `reunion` **con filtro** (`calendario = él || lead.asignado = él`), así que el detalle ajeno no le llega.
- Los horarios de otro calendario salen de `ocupado`: verificado en la respuesta de red, no viene `nombre`, ni `perfil`, ni `expand`.
- Se agregó el **switch de calendario** por administrador (§6.3, §8.6), y los bloques ajenos se dibujan grises, sin nombre, sin arrastre y sin tarjeta de hover.
- La ficha también pedía todas las reuniones para calcular disponibilidad, y el registro trae `titulo_evento` —que lleva el nombre del lead adentro—, `invitado_email` e `invitados_copia`. Ahora usa la misma vista.

### A.2 · El resto del alcance sigue siendo del lado del cliente

Lo de arriba arregla la agenda y la ficha. **Las demás pantallas filtran
después de recibir todo**, y eso sigue abierto:

- `useControl` trae todos los proyectos y todas las reuniones y recién ahí
  aplica el alcance por casa. Al partner de Seng le llegan los datos de
  Globalita, aunque no los dibuje. El comentario del archivo dice que se filtra
  «antes de que lleguen al navegador» y no es cierto.
- `useLeads` trae todos los leads y filtra por asignación en el cliente.
- `Automatizaciones` trae todas las reuniones y todos los envíos.

La solución de fondo es la misma en los tres casos: reglas de `listRule` en
las colecciones, o vistas como `ocupado` donde haga falta recortar columnas.
No se hizo ahora porque cambiar `listRule` toca todas las pantallas a la vez y
conviene hacerlo con las pantallas ya estables.

### A.1-bis · Lo que decía este documento antes

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

---

# Segunda pasada — 08/09/2026

Después de que Augusto planteara los roles Partner y los mensajes destacados.
Leídos de nuevo: el manual PDF entero, `EnviarMensaje.dc.html`,
`AdminUsuarios.dc.html`, `Control.dc.html`, `Dashboard.dc.html`,
`FechaReunion.dc.html` y `ListaContactos.dc.html`.

---

## F · Lo que Augusto pidió y NO está en ningún documento

Esto no son divergencias: son decisiones que faltan tomar. Las escribo acá
porque si se implementan sin cerrarlas, quedan mal.

### F.1 · El rol Partner con alcance por empresa propia

**Lo que pide Augusto**: dos partners distintos. Alejandro ve solo lo de
**Globalita / Fabript-PIV** y sus reuniones. Otro ve solo lo de **Seng**.

**Lo que dicen el manual y el prototipo**: hay **un** rol Observador, con preset
`control` + `verTodosLeads`, que ve **todos** los proyectos de las dos empresas
(§6.3.1, y `PORROL_OBS` en `Dashboard.dc.html:568`). No hay alcance por empresa
en ningún lado.

**Lo que ya existe en el código y nadie volvió a mirar**: la migración
`1788600800_control_por_linea.js` (06/09) agregó `users.linea_control` con
valores `ia | inversiones`, justamente para esto. Su comentario dice:
*«Globalita (ia) … SENG (inversiones) … El socio de IT de Globalita no tiene por
qué ver los proyectos de SENG, ni al revés»*.

**CORRECCIÓN a lo que escribí en la primera versión de esta sección.** Dije que
los dos vocabularios «no filtran por lo mismo». **Es falso** y lo verifiqué
después: `useControl.ts:28` tiene un puente `LINEA_DE_CASA`
(`globalita → ia`, `seng → inversiones`), y el filtro corre sobre la
`casa` **del proyecto**, no sobre la línea de la cuenta. El alcance del
partner **ya funciona hoy**, y además filtra antes de que los datos lleguen al
navegador. Lo que sigue siendo cierto es que tener dos nombres para un mismo
concepto es innecesario; no que esté mal filtrado.

**Lo que sí queda por resolver**: hay **dos vocabularios para la misma
división**.

| | Valores | Cuelga de | Origen |
|---|---|---|---|
| `linea_control` | `ia` \| `inversiones` | usuario (el alcance) | código, 06/09 |
| `casa` | `globalita` \| `seng` | proyecto (lo filtrado) | manual nuevo, §3.13.1 |

Los dos se cruzan en `LINEA_DE_CASA`. Funciona, pero obliga a leer dos
nombres para entender una sola idea.

**Recomendación**: quedarse con `casa`, que es lo que dice el manual y lo que
además es correcto — la casa la elige quien abre el proyecto, no se hereda de
la cuenta desde la que se invitó. Renombrar `linea_control` a `casa_control`
con los valores `globalita | seng`, y que el alcance del partner filtre por
`proyecto.casa`, no por `cuenta.linea_negocio`.

Falta decidir además:

- ¿El partner de Globalita ve **solo Fabript/PIV**, o también las parcerías?
  Augusto dijo «los leads que están con PIV», que es más angosto que la casa.
  Si es por tipo y no por casa, el alcance necesita dos campos.
- El manual le da `verTodosLeads` al Observador. Si el partner solo tiene que
  ver los leads que tienen proyecto suyo, ese permiso sobra y hay que
  reemplazarlo por un alcance.

### F.2 · «Estamos viendo el prototipo»

**Contradice al manual tal como está.** La decisión cerrada #21 dice: *«El tipo
prototipo no existe más: se fusionó con Fabript/PIV, y con él se eliminó la
pestaña Prototipos»*.

**Cómo se expresa hoy**: solo como **texto libre en el hilo del proyecto**. En
los datos de demo del prototipo aparece así: *«Demo del prototipo con datos
reales de dos líneas»*, *«Aprobaron el prototipo, pasa a implementación»*,
*«Arranque del prototipo, dos tableros»*. Es una actualización, no un estado.

Por eso el partner no lo puede ver de un vistazo: tiene que leer el hilo.

**Recomendación: un estado, no una etiqueta.** Tres razones:

1. Los siete estados ya son **normativos** (§5.12): cada uno define cuándo se
   aplica, y son lo que la tabla de Control muestra, filtra y cuenta en las
   tarjetas. Un partner que entra a ver «en qué está esto» lee el estado.
2. **Las etiquetas son del lead, no del proyecto** (§3.9). No existe el
   concepto de etiqueta de proyecto: habría que inventarlo.
3. «Viendo el prototipo» es un momento del trabajo, igual que «Propuesta
   enviada» o «Nuestra pelota». Pertenece a la misma serie.

Concretamente: un octavo estado **«Prototipo en revisión»**, entre «Propuesta
enviada» y «Nuestra pelota». Quedan dos cosas por decidir:

- ¿Cuenta como activo en la tarjeta «Activos»? (creo que sí)
- ¿Se congela a los 30 días sin movimiento? (creo que sí, es la misma regla)

**Contra**: con un estado no se pueden acumular dos cosas a la vez. Si un
proyecto puede estar «viendo el prototipo» *y* «esperando presupuesto» al mismo
tiempo, entonces sí hace falta una etiqueta de proyecto. Eso lo sabe Augusto,
no yo.

### F.3 · Dos cosas que no entendí y prefiero no adivinar

- **«La parte de reuniones que aplica solo para el perfil de Alberto Córdoba»**.
  Puede ser: (a) el partner de Seng ve solo las reuniones generadas desde la
  cuenta AL; (b) el dashboard de reuniones se filtra por cuenta; (c) otra cosa.
  El dato que hay: AL es la cuenta de Alberto y es la de `inversiones`/Seng
  (migración `1788600800`), y en Automatizaciones el prototipo aclara que
  *«Alberto Córdoba trabaja otro perfil (directores y gerentes financieros,
  CEOs) con la misma métrica, aparte del resto»*.

- **«Los perfiles que les interesó la propuesta»** para el partner de Seng.
  ¿Es un estado del proyecto («Propuesta enviada» ya existe), o es una
  condición del lead? Si es del lead, hoy se expresaría con `situacion:
  contesto` o con la etiqueta `Caliente`.

---

## G · Mensajes destacados — confirmado, y es más de lo que pensaba

Augusto tiene razón. El bloque del prototipo (`EnviarMensaje.dc.html`) es:

**Fila de chips de acceso rápido** — sin rótulo, sin colapsable:

- Cada chip es **arrastrable**, muestra el nombre, el **idioma en 8 px acento**,
  y una **× para sacarlo**.
- Un botón punteado **«+ destacados»** abre el modal.
- Un hint: *«arrastrá para ordenar · clic reemplaza el mensaje»*.
- A la derecha, la pastilla del idioma sugerido.

**Modal «Destacar mensajes»** (400 px, centrado): *«para {cuenta}»*, la
explicación *«se guardan en {idioma} y quedan como chips arriba»*, una fila por
mensaje del repositorio con check, nombre, idioma, alcance y preview, el conteo
de seleccionados, «Guardar», y una nota de cómo corregir un destaque.

**Debajo del textarea**: un botón **«Guardar»** con icono de estrella que guarda
el texto escrito como **mensaje nuevo del repositorio**. Después de guardar
aparece un panel que pregunta:

- *«¿Cargarlo en otro idioma?»* con los idiomas que faltan y su textarea.
- *«¿Destacarlo?»* → «Todas las cuentas» / «Solo {cuenta}» / «Ahora no».

**Lo que construí**: una fila de chips estáticos con el rótulo «Destacados». Sin
el botón «+ destacados», sin ×, sin arrastre, sin idioma en el chip, sin el hint,
y sin nada del flujo de guardar al repositorio.

### G.1 · Y los bloques de la ficha tampoco son los que pide el manual

§7.2: *«Bloques colapsables: Datos · Contacto · Fecha de reunión · **Etiquetas**
· **Log de ediciones** · Análisis del perfil»*. Son **seis**.

Lo que hay: tres colapsables (Datos, Contacto, Análisis) más Fecha de reunión
como bloque propio. **Etiquetas es un popover** desde un botón del encabezado y
**Log de ediciones es un overlay**. Los dos tendrían que ser bloques de la ficha.

---

## H · Inconsistencias del propio prototipo

No son mías: el prototipo se contradice consigo mismo y con el manual. Conviene
arreglarlas del lado del documento.

1. **`AdminUsuarios.dc.html:531`** describe al Observador como *«Entra a Control
   de proyectos (proyectos, reuniones **y prototipos**) **y a la agenda**»*.
   Pero su propio preset es `{ control, verTodosLeads }` — **sin agenda** — y el
   manual §6.3.1 dice explícitamente que el Observador **no ve agenda**. Además
   «prototipos» ya no existe (decisión #21). El texto quedó viejo por dos lados.

2. **`AdminUsuarios.dc.html:374`**: la clave `control` se describe como
   *«Proyectos, reuniones **y prototipos**, sin editar»*. Mismo resto viejo.

3. **`Control.dc.html:11`** usa la clave de tipo **`pib`**; el manual §3.13 dice
   **`fabript_piv`**. La etiqueta visible es la misma («Fabript/PIV»), pero la
   clave difiere. Mi código sigue al manual.


---

## Por qué pasó

Construí mirando el marcado de cada `.dc.html` y no la lógica de su
`renderVals`, que es donde están las reglas. El marcado muestra *qué se ve*; la
lógica dice *cuándo y por qué*. De ahí salen las tres divergencias de la
sección B, que son las que hacen que un número esté mal en vez de que una
pantalla se vea distinta.

La relectura de ahora se hizo al revés: primero la lógica y el manual, después
la pantalla.
