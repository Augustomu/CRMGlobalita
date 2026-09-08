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

### A.2 · El alcance del partner ahora es del servidor — ✅ **resuelto el 08/09**

`useControl` traía todos los proyectos, todas las reuniones y todos los leads, y
recién ahí aplicaba el alcance por casa. Al partner de Seng le llegaban los
datos de Globalita al navegador: bastaba abrir la pestaña de red.

Se cerró con lo mismo que la agenda —**las reglas filtran filas, las vistas
recortan columnas**— y las dos cosas hacían falta:

| | Qué se hizo |
|---|---|
| `proyecto` | `listRule` por casa contra `linea_control` |
| `reunion` | `listRule` por la línea de negocio de la cuenta del lead |
| `lead` | **negado al observador**: para lo suyo tiene la vista |
| `perfil` | negado al observador |
| `confirmado` (vista nueva) | los que confirmaron interés, sin teléfono, email ni links |
| `reunion_control` (vista nueva) | quién es y de qué cuenta salió, sin cómo contactarlo |

Las dos vistas hicieron falta porque negar `perfil` a secas dejaba la lista del
partner sin nombres: el `expand` respeta la regla de la colección relacionada.

**Medido:** con un espía sobre las respuestas de red, la sesión del partner ya
no recibe ni un `telefono`, `email`, `link_chat` ni `link_perfil` — lo único
que queda es su propio email en la respuesta del login. Antes aparecían en
`perfil`, `lead`, `proyecto` y `reunion`.

Y los números quedan donde tienen que quedar: el administrador ve 13 proyectos,
51 leads y 32 reuniones; el partner de Globalita 9/36/23; el de Seng 4/19/9.

Los otros dos casos del punto original se caen solos:

- `useLeads` — §3.6 dice que **los leads son compartidos** y que el
  administrador ve todos, así que un colaborador viéndolos todos es lo
  especificado. El que no tenía que verlos era el observador, y ahora no puede.
- `Automatizaciones` — el observador no llega a la pantalla (§6.3.1) y las
  reuniones que pide ya vienen acotadas por la regla nueva.

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

### B.1 · Las fechas no tenían hora — ✅ **resuelto el 08/09**

**Lo que dice el manual** (§3.2): el objeto `fechas` tiene `invitacion`,
`aceptacion`, `respuesta` y `ultimo_contacto` como **`timestamp`**, y agrega:
*«Requisito: guardar los timestamps crudos, no los textos»*.

**Lo que había**: los campos son `date` de PocketBase, y yo di por sentado que
eso era solo la fecha. **No lo es**: el tipo `date` de PocketBase guarda
`YYYY-MM-DD HH:MM:SS.sssZ`. No había que migrar nada. Lo que faltaba era que
los seeds escribieran la hora — la escribían siempre a medianoche — y que el
código la leyera.

Lo que se destrabó:

- **§5.5 — «Cuándo responden: distribución de respuestas por día de semana **y
  franja horaria**»**. Ahora la tarjeta dice «viernes última hora 23%» en vez de
  solo «viernes». `franjaDe()` y `cuandoRespondenDetallado()` en
  `core/rendimiento.ts`, con las cuatro franjas del manual (mañana 8–11,
  mediodía 11–14, tarde 14–17, última hora 17–20).
- **§3.2 — `demora_respuesta`** en lenguaje natural. La ficha muestra «8 h»,
  «5 h», «10 min», «18 días» y «escribió primero», que son exactamente los
  cinco casos que el prototipo trae escritos.

**Y de paso apareció que la fórmula estaba mal.** El manual (p. 6) define
`demora_respuesta = respuesta − aceptacion`. Yo la había implementado como
«desde el último envío», que es otra pregunta: la del manual mide cuánto tarda
alguien en engancharse después de aceptar, y por eso da «8 h» aunque entremedio
hayan salido tres R. Está en `core/analisis.ts` como `demoraDeRespuesta`, con
su test citando la página.

Dos detalles que salieron de comparar contra el prototipo:

- **Las horas se truncan, los días se redondean.** Alexandre aceptó 10:02 y
  contestó 18:40: son 8 h 38, y el prototipo lo dice «8 h». Lucía tardó 17 d
  20 h y el prototipo dice «18 días».
- **La cohorte promediaba en días enteros**, así que «8 h» y «40 h» valían las
  dos 0 y el promedio daba siempre cero. Ahora promedia en minutos y redacta al
  final.

### B.1-bis · Los datos de demo no eran los del prototipo

Salió buscando dónde verificar lo anterior. Los seis leads de `pb_seed` tenían
nombres del prototipo pero cargos, empresas, ciudades, listas, páginas de
origen y **fechas inventadas**. El caso que lo delató: Alexandre respondía el
20/05 y su primer envío salía el 21/05 — la respuesta era anterior a todo lo
que le habíamos mandado, así que «qué paso lo trajo» no podía contestarse nunca
y «tardó en contestar» daba «—» para toda la base de demo.

Ahora los seis salen de `Dashboard.dc.html`: fechas con hora, listas, páginas,
etiquetas, y los envíos sacados de los hilos `mensajesLi`/`mensajesWa` — cada
saliente es un envío, con su hora y su canal.

### B.2 · La disponibilidad de la reunión no tenía en cuenta la duración — ✅ **resuelto el 08/09**

Se resolvió junto con la sección C, que es donde está el detalle.

**Lo que dice el prototipo**: un horario está ocupado si la reunión de `dur`
minutos **se solaparía** con un evento (`t < e.b && t + dur > e.a`), y el slot
solo existe si entra antes de las 18 (`t + dur <= 1080`).

**Lo que hay**: ocupado es **coincidencia exacta** con la hora de inicio de otra
reunión. Cambiar de 30 a 60 minutos no cambia ni un horario.

Ofrece las 14:30 para una reunión de una hora aunque a las 15:00 haya otra.

### B.3 · El buscador no ignoraba tildes — ✅ **resuelto el 08/09**

Apareció intentando abrir la ficha de Lucía. Escribir «Lucia» no traía a **Lucía
Gonçalves**; «Fernandez» no traía a **María Fernández Villagrán**. En una base
que es toda latinoamericana, eso es no tener buscador: hay que saber cómo está
cargado el nombre antes de poder buscarlo, que es justo lo que uno no sabe.

Lo llamativo es que la regla **ya existía** en `core/compartida.ts` y funcionaba
bien — pero solo en la Base compartida. Follow-up y el panel de partner
comparaban en crudo. Tres buscadores, dos comportamientos.

Ahora está en `core/busqueda.ts` (`sinAcentos`, `coincide`) y lo usan los tres.

### B.4 · `HOY` salía de UTC — ✅ **resuelto el 08/09**

`new Date().toISOString().slice(0, 10)` da el día en UTC, y eso está mal en todo
el continente: a las 21:00 en Buenos Aires ya es mañana en UTC. Con esa fecha la
lista marcaba como vencido lo que vence mañana, el calendario tachaba hoy como
si hubiera pasado, y «toca hoy» quedaba corrido un día — de noche, que es
justamente cuando se cierra el día de trabajo.

**No eran cinco apariciones: eran nueve.** Al ir a arreglar la de
`ListaContactos` aparecieron las mismas ocho líneas en Proyectos, Reuniones,
PanelProyecto, AbrirProyecto, EnviarMensaje, FichaLead, ProyectosDelLead y
Vencimientos. Dos pantallas (Agenda y FechaReunion) ya lo tenían bien, cada una
con su propia copia de la función correcta.

Ahora la regla está una sola vez, en `core/fecha.ts` (`diaLocal`), con su test.
De paso se fue `ddmm`, que estaba escrita cinco veces.

---

## C · El panel de horarios de la reunión — ✅ **resuelto el 08/09**

Era la divergencia más grande de diseño, y la que motivó la revisión.

| Manual / prototipo | Estaba | Ahora |
|---|---|---|
| Una fila **por hora** (09 a 17) | Grilla plana de `:00` y `:30`, de 08 a 19 | ✅ `filasPorHora()` |
| Cada fila muestra **los eventos de esa hora** como chips | No se mostraba ninguno | ✅ con rango y nombre |
| Un **chevron** despliega la hora en tramos de **15 min** | No existía | ✅ una hora abierta por vez |
| La hora sin huecos va **tachada** y deja de ser botón | Solo cambiaba de color | ✅ pasa a `<span>` |
| Tres mensajes distintos | Solo el primero | ✅ los tres en `mensajeDeHorarios()` |
| Los días llevan **título** con lo que hay ese día | Sin título | ✅ «3 bloques: 10:00–11:00, …» |
| **Selector de calendario** (§6.3) | No existía | ✅ suma el ajeno como «Ocupado» |
| **B.2** — el hueco se prueba por solapamiento | Coincidencia exacta de arranque | ✅ `t < e.b && t + dur > e.a` |

Las reglas están en `core/reunion.ts` con sus tests (`test/horarios.test.ts`), no
en el componente.

Tres cosas que salieron construyéndolo:

1. **El panel bloqueaba la agenda entera.** Traía `ocupado` sin filtro, o sea
   las reuniones de todo el mundo, y con eso el selector de calendario no tenía
   nada que sumar: ya estaba todo puesto. Ahora la base es lo propio (§6.3: el
   administrador ve todo, el colaborador lo suyo) y el calendario ajeno se
   agrega cuando se lo elige.

2. **Las reuniones del lead que se está mirando no se bloquean a sí mismas.**
   Si estás reagendando, el horario que querés liberar es justamente el que
   tiene.

3. **Cambiar la duración podía dejar elegido un horario que ya no entra.**
   Elegís 14:30 para media hora, lo pasás a una hora, y a las 15:00 hay otra
   reunión: 14:30 dejó de servir pero seguía marcado y el botón de confirmar
   seguía habilitado. El panel te dejaba agendar encima de algo que él mismo
   estaba mostrando.

Lo único que queda sin llegar es el mensaje «Sin disponibilidad ese día»: marca
los días bloqueados enteros en Google Calendar, y eso no existe hasta que la
cuenta esté conectada. La función lo contempla y el argumento va en `false`.

---

## D · Lo que falta de la especificación

Ordenado por cuánto se usa.

### D.1 · Escala de la columna 1 — ✅ **resuelto el 08/09**

80 filas, y de a 80 al acercarse al final del scroll (400 px antes, para que no
se vea el fondo vacío mientras dibuja). Cambiar el filtro o la búsqueda vuelve a
80 y sube el scroll. Elegir un lead que quedó fuera de la ventana la estira
hasta `i + 80` y recién entonces hace scroll, a un tercio del alto.

Está en `core/ventana.ts` con su test. No era una optimización prematura: con
los leads dibujados todos, cada tecla del buscador remontaba miles de filas y el
cursor iba atrás de lo que se escribía.

### D.2 · Anchos arrastrables (§9.4, también transversal) — ✅ **resuelto el 08/09**

Los tres: columna 1 (260–520, doble clic alterna 260/340), agenda (340–900,
doble clic vuelve a 560) y repositorio (300–620, doble clic vuelve a 400).
Arrastrables y persistidos en `localStorage`, con las reglas en
`core/anchos.ts` y el arrastre en `lib/useAncho.ts`.

El repositorio además **era un overlay modal** y §7.9 lo define como sidebar.
No era ponerle un divisor: había que rehacer su interior en una sola columna
—a 300 px el editor de dos columnas mediría 40— siguiendo
`RepositorioMensajes.dc.html`. Ahora cada mensaje es una tarjeta que se abre en
el lugar, con los tres idiomas siempre a la vista (cargados en firme, sin
cargar en punteado: con sólo los cargados no se ve qué falta traducir), la
estrella con su alcance, el filtro Todos/Favoritos y los destacados arriba.

Y §7.2 dice «Sidebars (una a la vez)»: abrir una cierra la otra. En una laptop
de 14" las dos juntas dejan la ficha en 300 px.

Lo que el modal tenía y el prototipo no —el paso de la cadencia, «hacer la
principal» (D16) y la vista previa con datos reales— quedó adentro del editor:
son reglas del manual (§5.2) que el mock del prototipo no necesitaba.

### D.3 · Conversaciones en la ficha (§3.2, §7.2, decisión cerrada #2)

El manual define `mensajes_li[]` y `mensajes_wa[]` en el lead, cada mensaje
`{ quien: 'in'|'out', texto, enviado_en, ack? }` con `ack ∈ enviado | entregado
| leido`. **No hay ninguna colección de mensajes en el modelo.**

Es la misma falta que hace que el Análisis del perfil no pueda mostrar el texto
del mensaje que trajo la respuesta. Las dos cosas se resuelven juntas.

### D.4 · Enviar mensaje (§7.2) — ✅ **resuelto el 08/09**

Las cuatro están: los chips arrastrables, la checklist «+ destacados» que
guarda **el delta** para la cuenta activa —tocar un mensaje destacado en otra
cuenta no puede sacárselo—, «Guardar en el repositorio», y el panel que después
pregunta por el otro idioma y por el destaque.

### D.5 · Agenda (§7.6) — ✅ **resuelto el 08/09**

- **Resize** del bloque: 15 a 180 minutos, de a 22 px por tramo de 15
  (`duracionAlEstirar` en `core/reunion.ts`, con test). Se cuenta por PASOS y
  no por píxeles: sin eso la duración termina en 37 minutos, que no es un
  horario que exista. Y el bloque ahora **mide lo que dura** — con todos del
  mismo alto, una reunión de dos horas y una de quince se ven igual.
- **Filtro por cuenta**, además del de check que ya estaba. Con seis cuentas
  trabajando, la semana es una pared de bloques.
- La vista **Lista** completa, con las nueve columnas de §7.6: check, última,
  próximo contacto **editable**, foto **pegada del portapapeles**, cuenta y
  nombre, nueva reunión, notas (se despliegan debajo de la fila), links de
  perfil y WhatsApp, y etiquetas.

La foto se pega y no se sube porque de LinkedIn la foto se copia, no se
descarga: bajarla es abrir la imagen en otra pestaña, guardarla y después
buscarla.

Queda **un solo punto** de los originales: los bloqueos de Google Calendar con
el nombre del evento. Eso no es una omisión, es que la cuenta no está conectada
todavía — y los bloques de OTRO calendario nunca van a llevar nombre, porque
§6.3 dice que de un calendario ajeno se ve cuándo está tomado y nada más.

### D.6 · El shell (§4, §7.1, §7.10) — ✅ **resuelto el 08/09**

- **Cuentas conectadas**: una fila por cuenta con el estado de LinkedIn y de
  WhatsApp, en verde / ámbar / gris para leerlo sin leer la palabra, y el
  encabezado diciendo cuántas tienen algo caído. Es la pantalla desde la que se
  ve por qué la cola no sale. **El QR se dice que falta y por qué**: lo emite la
  sesión de WhatsApp Web, que vive en el worker; un botón de «Vincular» que no
  vincula nada sería peor que no tenerlo.
- **Notificaciones**: el popover lista cada sin-leer con su canal y salta a la
  ficha abriendo esa conversación. Un lead con los dos canales aparece **dos
  veces**, una por canal: son dos conversaciones y se contestan en lugares
  distintos. Antes la campana llevaba a la subtab «Sin leer», que es una lista
  de leads y no dice por dónde entró cada uno.
- **Atajos de teclado**: el popover con los once. Estaban todos implementados;
  lo que faltaba era decir cuáles son — un atajo que nadie sabe que existe no
  es un atajo.
- **Ver el CRM como otro usuario** (§6.4): desde el chip de sesión, con una
  barra que no se puede perder de vista mientras dura y «Volver a mi usuario».
  No persiste entre recargas, como pide el manual. Y dice lo que hace de
  verdad: cambia lo que se DIBUJA, no con qué permisos se pide — las peticiones
  siguen saliendo con la sesión del administrador.
- El **`···` sólo aparece** si el usuario tiene alguna de las herramientas que
  contiene. Medido: al observador le quedan exactamente los dos controles que
  §7.1 nombra, **tema y chip de usuario**.

### D.7 · Detalles menores — ✅ **resuelto el 08/09**

- **Tareas** con `etiquetas` en la fila (§3.7, §7.10). El campo existía y no se
  dibujaba, así que una tarea etiquetada se veía igual que una sin etiquetar. Y
  el seed no le ponía ninguna: ahora ocho de doce llevan, y cuatro no — una
  lista donde todas tienen etiqueta no muestra que la columna puede estar
  vacía, que es el caso más común.
- **Actividad**: retención de 90 días (§3.10, decisión #14), en
  `pb_hooks/retencion.pb.js`. Corre a las 3 de la mañana, dentro de PocketBase:
  si dependiera de que alguien tenga el CRM abierto, la tabla crecería mientras
  nadie mira, que es cuando más crece. Registra cuántas borró — un barrido
  silencioso que un día borra de más no deja rastro de haber corrido.
- **Regla**: `corridas` pasó a `corridas_semana` (§3.8), con su migración. El
  acumulado no dice nada: una regla que corrió 4.000 veces desde marzo y
  ninguna desde el lunes se ve igual de viva que una que corre todos los días.
- **Usuarios de demo**: Alejandro Ruiz ya está en el seed como observador. El
  punto estaba viejo.

### D.8 · Y una que apareció escribiendo el panel de atajos

El panel que lista los atajos prometía «Esc · cerrar el panel abierto», y
Escape sólo cerraba **dos overlays de siete**. Una tecla que funciona a veces
es peor que una que no funciona: se la aprende y después falla justo cuando se
confía en ella.

Ahora está en `lib/useEscape.ts` y la usan los seis: Tareas, Repositorio,
Cuentas conectadas, Reglas, Base compartida y Duplicados. Con el mismo cuidado
que ya tenía el repositorio: si hay cambios sin guardar, Escape no los tira.

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

### G.1 · Los bloques de la ficha — ✅ **resuelto el 08/09**

§7.2: *«Bloques colapsables: Datos · Contacto · Fecha de reunión · **Etiquetas**
· **Log de ediciones** · Análisis del perfil»*. Son **seis**, y ahora son seis,
en ese orden.

Etiquetas era un popover y el log un overlay. Los dos se consultan MIENTRAS se
trabaja el lead —qué etiquetas tiene, qué se le tocó antes de volver a
tocarlo— y las dos formas tapan justamente lo que uno está mirando. Los botones
que los abrían salieron del encabezado, que en §7.2 no los lista.

**Acá el manual y el prototipo no dicen lo mismo.** En
`FollowupDetalle.dc.html` sólo Datos y Contacto son colapsables; Análisis y Log
son overlays y Etiquetas un popover. El manual es del 08/09/2026 y es explícito
en los seis, así que mandó el manual. Queda anotado en §H.

De paso: la colección `edicion` estaba **vacía en la demo**, así que el bloque
decía siempre «sin ediciones registradas» y no había forma de ver si andaba.
Ahora tiene las once entradas que el prototipo trae en el `log` de cada
contacto.

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

4. **Wellington Abner Simoes es dos personas distintas según la pantalla.** En
   `Dashboard.dc.html:380` es «Gerente de Operaciones, Opus CM, Construcción
   Manufactura, Sao Paulo»; en `Control.dc.html:572` la industria es
   «Construcción **/** Manufactura». Diferencia menor, pero es la misma ficha.

5. **`fechas.ultimoContacto` no coincide con los hilos de mensajes.** El manual
   lo define como «último envío nuestro». Para Alexandre el campo dice 13/08,
   pero su `mensajesWa` tiene salientes del 18/08 y del 28/08. Para Lucía dice
   27/08, que es el día en que contestó **ella** — no hay ningún saliente ese
   día. Tomé el hilo, que es el dato concreto, y derivé el campo de ahí.

6. **La etapa no cuadra con la cantidad de envíos.** Alexandre está en R3 con
   cuatro salientes en el hilo; Herik está en Fase 2 y su análisis dice «4
   mensajes desde R0», pero su hilo tiene uno solo. Sembré lo que el hilo
   muestra: es lo único verificable.

7. **La ficha: seis bloques o dos.** El manual §7.2 enumera seis colapsables
   —Datos, Contacto, Fecha de reunión, Etiquetas, Log de ediciones, Análisis—;
   `FollowupDetalle.dc.html` tiene dos, y resuelve Etiquetas con un popover y
   Análisis y Log con overlays. Seguí al manual: es del 08/09/2026 y es
   explícito.

8. **`demoraRespuesta: 'mismo día'` para Gonzalo** (`Dashboard.dc.html:467`),
   que no aceptó ninguna invitación y cuyo primer mensaje es entrante. El propio
   prototipo usa **«escribió primero»** para el mismo caso en los leads de WA
   Personal (líneas 977 y 993). Implementé «escribió primero», que es lo que
   pasó; «mismo día» no se deriva de ningún par de timestamps.


---

## Por qué pasó

Construí mirando el marcado de cada `.dc.html` y no la lógica de su
`renderVals`, que es donde están las reglas. El marcado muestra *qué se ve*; la
lógica dice *cuándo y por qué*. De ahí salen las tres divergencias de la
sección B, que son las que hacen que un número esté mal en vez de que una
pantalla se vea distinta.

La relectura de ahora se hizo al revés: primero la lógica y el manual, después
la pantalla.
