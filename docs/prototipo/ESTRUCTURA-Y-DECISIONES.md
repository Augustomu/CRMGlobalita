# CRM de prospección — estructura y decisiones

Prototipo en Design Components. Entrada: `Dashboard.dc.html`.

## Secciones
- **Automatizaciones** (`Automatizaciones.dc.html`): secuencia R0→R5 con espera editable y pausa por paso, límites de envío (40 leads por día y cuenta, ventana horaria, días activos), reglas alrededor de la reunión y conteo "sale hoy".
- **Follow-up**: columna 1 `ListaContactos.dc.html` (ancho arrastrable 260–520 px, doble clic = compacto 260/340, persistido en `localStorage` bajo `om.anchoCol1`), columna 2 `FollowupDetalle.dc.html`, sidebars `Agenda.dc.html` y `RepositorioMensajes.dc.html`.
- **WA Personal** (`WhatsappPersonal.dc.html`): solo amigos y familia. Entrantes desconocidos con Mover a FU / Es personal / Agendar. Sin botón Ignorar y sin etiqueta "Personal" en la lista: la pestaña ya implica que es personal.

## Reglas del flujo de WhatsApp
- Si el teléfono del entrante coincide con una ficha ya cargada (últimos 8 dígitos), el mensaje entra solo al follow-up: la ficha queda en Sin leer con chip `wa`. En WA Personal solo se ve el aviso "Ya estaban en la base" con acceso a la ficha.
- Si no coincide: **Mover a FU** crea la ficha y salta a Follow-up → Sin leer; **Es personal** lo deja en la pestaña; **Agendar** pide nombre y lo guarda en la agenda.
- Un chat personal que resulta de trabajo se pasa con **Mover a FU** desde el encabezado del chat.
- Las conversaciones de leads no viven en WA Personal: están en la ficha y en la columna 1.

## Convenciones
- Conversación: switch `in | wa` en el header. Las dos conversaciones se abren en el mismo lugar, arriba de la lista (columna 1); el switch elige el canal. Al elegir un lead se abre sola en el canal que corresponde: WhatsApp si tiene teléfono cargado, LinkedIn si no. Los entrantes sin leer salen con borde ámbar y etiqueta "nuevo".
- Temas: claro, oscuro y noche (cálido, para trabajar de noche), en ciclo desde el botón del header.
- Enviar mensaje arranca en el mismo canal por la misma regla.
- Anchos arrastrables: columna 1 (260–520), agenda (340–900) y repositorio (300–620), cada uno con doble clic para volver al ancho normal y persistencia en `localStorage`.
- Los popovers grandes (filtros, próximo contacto, histórico) se posicionan con `position:fixed` calculado desde el botón, para que no los recorte el scroll de la columna.
- LinkedIn se pinta en azul (`--brand-linkedin`), WhatsApp en verde (`--brand-whatsapp`).
- Atajos: A guardar, S enviar, D próximo contacto, R fecha de reunión, F cambiar canal de envío, G abrir o cerrar la conversación, H abrir el chat real del canal elegido, V perfil, C deshacer. Dentro del calendario de próximo contacto, A S D F son 1 a 4 semanas.
- Edición de ficha: toda edición apila su estado anterior. Botón **Deshacer** en el header del detalle (Z); guardar limpia la pila. En el log de ediciones, los campos revertibles tienen botón **revertir**.
- Agenda: vista semanal de lunes a sábado (domingo no se muestra), 8 a 20 h, columna de hoy en acento, sábado en gris, arrastre y resize sobre bloques de 15 minutos.

## Backlog abierto (pedido del 05/09)

### Cerrado el 05/09
- Agenda: semanal sin domingo; arrastre a bloques de 15 minutos también en semanal (se calcula la posición dentro de la celda); arrastre de la vista diaria arreglado (se pasa `dataTransfer` y el estado se aplica diferido); resize de duración en las dos vistas con manija más grande; hover sobre el evento con asistió / no asistió / cambiar horario / pegar foto; bloqueos de Google Calendar con nombre del evento en semanal y diaria; popup del evento reducido a fecha y hora.
- Vista Lista: columnas más angostas para que no se corte, WhatsApp deshabilitado cuando el lead no tiene teléfono, y el botón de filtro es un ciclo de tres estados (todos → con check → sin check).
- Popovers grandes con `position:fixed` calculado (filtros, próximo contacto, histórico).
- Atajos: A guardar, S enviar, D próximo contacto, R reunión, F canal de envío, G conversación, H chat real, V perfil, C deshacer.
- Cadencia R1–R8 (15 / 15 / 21 / 28 días y Fase 2 a 3 meses) aplicada en Vencimientos y en la propuesta al enviar.
- Vencimientos: etiquetas arriba, tarjetas de vencía / próximo contacto / recomendado con la regla, mensajes destacados listados con su idioma e idioma detectado por país.
- Enviar mensaje: al enviar carga la etiqueta Recordatorio y propone la próxima fecha (aceptar o cargar a mano), con chip de idioma sugerido.
- Cuentas conectadas: el botón del header muestra LinkedIn y WhatsApp, con QR por cuenta y vincular otro número.
- Tareas: la fila es una grilla — check, nombre, fechas, vencimiento, etiquetas, alertas y prioridad quedan en columnas rectas.
- Reunión: el botón de reenviar el evento es una flecha grande con el calendario encima.

### Sigue abierto
- Nada del pedido del 05/09 queda abierto. El modo oscuro se revisó (acento aclarado a #6fc3b8 para que el texto sobre acento cumpla contraste) y se agregó un tercer tema **noche** (cálido, menos contraste); el botón del header cicla claro → oscuro → noche.
- Los mensajes entrantes sin leer se destacan dentro de la conversación con borde ámbar y etiqueta "nuevo", además del destaque de plantillas del repositorio.
- Enviar mensaje: los chips de destacados insertan el texto real de la plantilla en el idioma sugerido, y **Destacar este mensaje** guarda lo escrito en el repositorio (nombre + alcance: todas las cuentas o solo la cuenta actual), desde donde vuelve como chip.

## Backlog nuevo (pedido del 05/09, segunda ronda)

### Cerrado
- Base de datos compartida: nuevo ícono en el header, `BaseCompartida.dc.html` — tabla única de perfiles invitados con buscador, filtro por cuenta/etapa, marca de duplicados entre cuentas y nota sobre Alberto Córdoba.
- Agenda: hover con ficha completa (nombre, empresa, cuenta, hora+duración, estado, acciones, notas, links) en diaria y semanal; horario en vivo al arrastrar ("soltar en 12:45") en pasos de 15 min en las dos vistas.
- Enviar mensaje: rediseño completo — chips de destacados que **reemplazan** el mensaje (no lo concatenan), arrastrables para reordenar; popup "Destacar mensajes" como checklist sobre TODOS los mensajes del repositorio (no solo los ya destacados), detecta el idioma del chat, guarda para la cuenta activa y agrega los chips; se puede corregir destildando y volviendo a guardar. "Guardar" (antes "guardar como mensaje nuevo") crea el mensaje en el repositorio al toque y después pregunta si cargarlo en otro idioma y si destacarlo.
- Repositorio de mensajes conectado de una punta a la otra: cualquier edición (nombre, texto, estrella, orden, alta/baja) se ve al instante en Enviar mensaje y en Vencimientos — antes quedaba solo local al Repositorio.
- Importar CSV: reconoce países como código de 2 letras (BR/MX/MZ → Brasil/México/Mozambique) además del nombre completo; el idioma sugerido detecta Mozambique como portugués.
- Ctrl+Z / Cmd+Z deshace la última edición de la ficha (además del atajo C).
- Vencimientos: los chips de mensajes destacados son ahora pastillas chicas (R+nombre corto) en fila, no tarjetas grandes.
- Notificaciones: badge en el header (junto a Cuentas conectadas) con el total de mensajes sin leer entre Follow-up y WA Personal; al abrirlo lista cada uno con su canal (LI/WA) y salta a la ficha o a la pestaña correspondiente.
- WA Personal: botón "Mover a FU" también en cada fila de la lista de chats (antes solo estaba en el header del chat abierto), con un punto ámbar para los chats sin leer.
- Automatizaciones: sección de métricas semanales por cuenta (enviadas, aceptadas, conversión de la semana anterior, objetivo 200), reset lunes 00:01, cancelación de invitaciones a los 90 días con etapa Recontacto y espera de 60 días, y tabla de control R1–R8 (toca enviar / enviados / en qué mensaje respondieron).

### Sigue abierto
- Nada del pedido del 05/09 queda abierto (segunda ronda incluida). El modo oscuro se revisó (acento aclarado a #6fc3b8 para que el texto sobre acento cumpla contraste) y se agregó un tercer tema **noche** (cálido, menos contraste); el botón del header cicla claro → oscuro → noche.
- Base compartida: nombre y empresa son ahora links directos (perfil de LinkedIn y página de la empresa) en vez de íconos aparte; la columna "Lugar y resumen" quedó separada en "Lugar" y "Resumen"; doble clic en "último R" abre el historial completo R1→R4 debajo de la fila.
- Vencimientos: las tres tarjetas (vencía/próximo/recomendado) quedaron en dos — Vencimiento y Próximo contacto (con la regla de cadencia al lado) — el campo editable de próximo contacto sigue abajo con el atajo "usar recomendado".
- **Guardar como comando general**: implementado en el límite de navegación — cambiar de sección (Automatizaciones/Follow-up/WA Personal) o de lead con cambios sin guardar dispara el mismo aviso de "cambios sin guardar", con opciones de descartar o volver. Los campos de la ficha se siguen viendo en vivo mientras los editás (no se ocultan hasta guardar) porque perder ese preview sería un retroceso de UX; lo que ahora no pasa es cruzar de sección sin decidir qué hacer con lo pendiente.

## Usuarios, login y permisos (pedido del 06/09)

- **Login** (`Login.dc.html`): usuario/email + contraseña (demo: `demo`), "mantener la sesión abierta" persiste en `localStorage` bajo `om.sesion`; el Dashboard lee esa clave al montar y muestra el CRM o el login. Cerrar sesión desde el chip de sesión en el header.
- **Administración** (`AdminUsuarios.dc.html`): sección **Usuarios** en el header, visible solo para el rol Administrador. Lista de usuarios (alta, suspender/reactivar, baja, reenviar invitación), rol, cuentas de envío habilitadas, asignación de leads y tabla de permisos por rol. Invitar con dos métodos: link por email (queda `pendiente`) o contraseña temporal (entra `activo`).
- **Roles fijos**: Administrador (todo) y Colaborador. El colaborador solo ve las tabs **Follow-up** y **WA Personal**, más tareas y agenda. Sin automatizaciones, sin base compartida, sin vencimientos, sin repositorio ni mensajes destacados, sin cuentas conectadas/QR, sin cola de envíos (`conCola` en `ListaContactos`).
- **Leads asignados**: mapa `ASIGNACIONES` (leadId → userId) en `Dashboard.dc.html`; los leads sin entrada quedan del administrador, y los que crea un usuario (WA entrante, CSV) quedan de quien los creó. El colaborador solo ve sus leads en Follow-up, vencimientos y notificaciones.
- **Agenda del colaborador**: sus reuniones más las del administrador como bloqueos "Reunión con {lead}" con nombre y horario (`Component.agendaAjena`). Al agendar elige a qué calendario va.
- **Ver el CRM como**: el admin puede entrar a la vista de un colaborador desde el chip de sesión (no persiste; "Volver a mi usuario" regresa a admin).
- Usuarios de demo: Alberto Córdoba (admin), Sofía Ferrer (activo), Bruno Etchart (pendiente), Vera Molina (suspendido).
- **Permisos editables por usuario** (ronda 06/09): la ficha de usuario ya no tiene "cuentas de envío habilitadas" (no aplica). El rol es el preset y cada permiso se puede prender o apagar por usuario (`usuario.permisos`, con "por rol / editado" y botón para volver al rol). Claves: verTodosLeads, enviarMensajes, colaEnvios, importarLeads, automatizaciones, vencimientos, repositorio, baseCompartida, cuentasConectadas, usuarios, tareas, agenda. `Component.puede(usuario, clave)` está en `Dashboard.dc.html` y en `AdminUsuarios.dc.html`; el Dashboard arma tabs, íconos y props (`conCola`, `conImportar`, `conEnvio`, repositorio, agenda) a partir de eso.
- **Asignación masiva** (`AdminUsuarios`, botón "Asignar en lote"): panel con filtro por cuenta (chips con el conteo de cada una), país, ciudad, industria y buscador por nombre/empresa/cargo; "Seleccionar los N que coinciden" alcanza a todos los que pasan el filtro, no solo a los 40 visibles; check por fila para el uno por uno; botones Asignar N a {usuario} y Devolver al administrador. La ficha del usuario muestra el reparto por cuenta (AL 3 · DL 12).
- **Asignación de leads**: en Usuarios se listan solo los leads asignados (cruz para devolverlos al admin) y se agregan buscando por nombre; en la columna 2 del Follow-up, la ficha tiene el chip "Asignado a" para reasignar el lead a cualquier usuario.
- **Header**: los íconos menos usados (cuentas conectadas, vencimientos, base compartida, repositorio, atajos) viven en el menú "···"; quedan sueltos notificaciones, tareas, agenda, tema y el chip de sesión, todos de 28 px con `flex-shrink:0` y sin `flex-wrap`.

## Ronda 06/09 (segunda vuelta)

- Agenda: el popup del evento se eliminó — todo vive en el hover (nombre, empresa, cuenta, hora, estado, asistió / no asistió, foto, notas, links) y ahí mismo se cambian **horario e** **fecha** con dos campos; clic en el evento abre la ficha del lead. En la vista semanal el evento se desplaza dentro de la celda según los minutos, así un movimiento a :15 / :30 / :45 se ve.
- Agenda del colaborador: switch **Mi calendario / Calendario de {admin}**. En el calendario del admin las reuniones ajenas figuran como **Ocupado**, sin nombre ni detalle.
- Agendar: la sección Reunión de la ficha suma chips **Agendar en** (mi calendario / calendario del admin) antes de elegir día y hora; con el calendario del admin la disponibilidad suma sus días tomados.
- Colaborador sin: importar CSV / carga masiva de teléfonos, cola de envíos, Enviar mensaje, mensajes destacados, base compartida, vencimientos, automatizaciones, cuentas conectadas.
- El chip de sesión de un colaborador tiene "Volver a la vista del administrador" (atajo de la demo).
- **Log de actividad**: la sección Usuarios tiene dos pestañas — Usuarios y **Actividad** (`Component.ACTIVIDAD` en `AdminUsuarios.dc.html`): cuándo, usuario, acción, sobre qué lead y canal, con filtro por usuario. Registra ingresos, envíos, ediciones de ficha, reuniones y cambios de permisos; retención 90 días.

## Auditoría 06/09 (alto de las secciones)

- Las secciones que se montan con `dc-import` a pantalla completa (Automatizaciones, WA Personal, Usuarios) quedaban con el alto de su contenido y el sobrante se cortaba sin scroll: por eso las métricas semanales, la cancelación a 90 días y el control R1–R8 de Automatizaciones no se veían aunque estaban en el código. Regla: el mount lleva `style="width:100%;height:calc(100vh - 44px)"` (44 px = header) y la raíz de la sección usa `height:100%;min-height:0` en lugar de `flex:1`. Los overlays (`BaseCompartida`, `Vencimientos`) son `position:fixed` y no llevan estilo en el mount.

## Ronda 06/09 (tercera vuelta)

- Asignación en lote: país/ciudad/industria ahora son checklists (multi-selección, combinables), no un select de un solo valor — se pueden elegir varias ciudades y varias industrias a la vez.
- Los leads son compartidos: el administrador siempre ve todos, sin necesidad de "devolver" nada. Se sacó el botón "Devolver al administrador" del panel de lote; reasignar es directo desde la lista (icono de persona en la ficha del usuario) o desde la columna 2.
- Follow-up columna 1: fila de chips nueva para filtrar por colaborador (todos / cada colaborador activo), visible solo para el administrador. Cada lead asignado muestra un chip chico con el nombre del colaborador.

## Ronda 06/09 (cuarta vuelta)

- Agenda semanal: al arrastrar, se pintan **todos los cuadros que abarca la duración** del evento (no solo el de destino), y el chip del header sigue mostrando "soltar en HH:MM" en pasos de 15 min. La diaria pinta el mismo rango.
- Agenda: la vista Lista tiene el filtro de check como **caja sin texto** en tres estados — caja vacía (todos), caja con check (con check), caja con cruz (sin check).
- Datos de demo: María F. (hoy 16:00) y Herik Pires (hoy 09:30) tienen reunión el 04/09, así la vista diaria no queda vacía.
- Teléfono: al editarlo se normaliza con **código de país** según el país del lead (`Component.CODIGOS` + `normalizarTel` en `FollowupDetalle`); con teléfono cargado, el header de la columna 2 muestra un botón verde que abre el chat de WhatsApp de ese número.
- Automatizaciones: **Reglas y acciones rápidas** (disparador → condición → acción, con on/off y corridas de la semana: etiqueta Caliente, respuesta recibida, no asistió, silencio 45 días, lead importado), **recordatorio de reunión configurable** (ninguno / 2 / 3 / 4 h antes) y **Cuentas de invitación** con 10 slots, estado de sesión, cupo diario editable por cuenta y avance semanal.

## Ronda 06/09 (quinta vuelta)

- **Automatizaciones** se reorganizó en tres grupos con pestañas: **Invitaciones** (10 cuentas con cupo diario propio + ventana de envío), **Cancelación** (días sin aceptar, espera de recontacto, tope de cancelaciones por día y cola por cuenta) y **Seguimiento** (cadencia R1–R8 editable, control R1–R8 y avisos de reunión). Se eliminó la tarjeta "Secuencia de prospección" (R0 vive dentro de Invitaciones). La columna derecha queda fija: Sale hoy, métricas semanales y "Datos que faltan".
- **Reglas y acciones rápidas** salió de Automatizaciones a su propio panel (`ReglasAcciones.dc.html`), en el menú "···" al lado de Atajos de teclado, con alta de reglas nuevas (disparador → condición → acción).
- **Header**: Vencimientos de mensajes y Repositorio de mensajes volvieron a ser iconos sueltos de acceso rápido (ya no están en el menú "···").
- **Columna 2**: botón de **acciones rápidas** (rayo) con todas las acciones del lead agrupadas — ficha (guardar, deshacer), contacto (enviar, cambiar canal, abrir el chat real, ver perfil), seguimiento (próximo contacto, reunión, análisis) y asignación — cada una con su atajo.

## Ronda 06/09 (sexta vuelta)

- **Invitaciones**: cada cuenta se despliega y muestra sus **listas con prioridad** (orden 1, 2, …), la **última página vista** editable sobre el total, los perfiles restantes estimados y el chip *agotada / con páginas*. El cupo diario por cuenta es el que manda; el script toma la lista de prioridad más alta que todavía tenga páginas. Se eliminó la tarjeta "Ventana de envío" y la de "Datos que faltan".
- **Sale hoy** dejó de ser global: es una tabla **por cuenta** (invitaciones / seguimiento / cancelaciones), con AMU en cero por sesión caída.
- **Cancelación**: se agregó "Vuelven a la cola de envío" — cuántos leads cancelados cumplen la espera hoy, esta semana y la próxima, por cuenta, con el total listo para reinvitar.
- **Seguimiento**: los nombres de R1–R8 son editables. El control de los R pasó a **Rendimiento por R** con toca / enviados / respuestas / **tasa de conversión** en barra, más tres tarjetas de análisis: cuándo responden (día y franja horaria), perfiles con más reuniones y industrias que más convierten.
- **Alrededor de la reunión** salió de Automatizaciones al panel de **Reglas y acciones rápidas** (con el recordatorio configurable).

## Ronda 06/09 (pendientes cerrados)

- **Datos para analítica real**: cada lead tiene ahora `historialEnvios` (se completa al enviar un mensaje desde la ficha: R, fecha+hora, canal, primeros 80 caracteres del texto usado — entra a la pila de deshacer como cualquier otro campo), `paginaOrigen` (de qué página de la lista salió, `null` si es referido/entrante) y `notaR0` (si la invitación llevó nota). Con eso alcanza para construir "qué variante convierte más" y "de qué página vienen los que más avanzan" sin una pantalla nueva — son campos de datos, listos para leer desde Automatizaciones cuando haga falta.
- **Reordenar listas de invitación**: se queda con flechas (no drag). Las listas por cuenta son 2–3 ítems; drag no ahorra pasos ahí y las flechas ya son accesibles por teclado/touch sin librería adicional.
- **Escala real**: `ListaContactos` ya no renderiza todos los leads filtrados de una — arranca en 80 y suma de 80 en 80 al acercarse al final del scroll (`visibleCount`); si seleccionás un lead fuera de la ventana visible, la ventana se expande sola antes de hacer scroll a él. Cubre la lista para 1500+ leads sin paginado visible ni librería de virtualización.
- **Calendario con 2+ admins**: dejó de asumir un solo administrador. `calendarios` lista un ítem por cada usuario con rol Administrador ("Calendario de {nombre}"), y los bloques "Ocupado" que ve un colaborador se calculan por admin elegido (sus propias reuniones, no las de terceros). Si se suma un segundo admin aparece solo, sin tocar código.

## Control de proyectos — rol Observador (pedido del 07/09)

- **Rol nuevo `Observador`** (solo lectura, para IT/socio: Alejandro Ruiz). Permisos por rol: `control`, `agenda`, `verTodosLeads`. No ve Follow-up, WA Personal, automatizaciones, cola, cuentas conectadas ni edita nada. `Component.PORROL_OBS` en `Dashboard.dc.html`, `Component.PORROL.Observador` en `AdminUsuarios.dc.html`; el rol se elige en la ficha de usuario como los otros dos y cada permiso sigue siendo editable por usuario.
- `PERMS` sumó tres claves: `control`, `followup`, `waPersonal` — Follow-up y WA Personal ahora son permisos como el resto (antes eran fijos), así el Observador puede quedarse sin ellos.
- **`Control.dc.html`**: sección "Control" en el header, con tres pestañas.
  - **Proyectos**: entidad nueva `PROYECTOS` (un lead puede tener varios). Campos: tipo (`Venta de PIB` / `Parcería` / `Prototipo`), estado, país, ciudad, industria, rol del contacto, cuenta, responsable, abierto, último movimiento, próximo paso, `hilo` (qué se habló, fecha + texto) y nota. Tabla + tarjetas de resumen + filtros por tipo y estado.
  - **Estados definidos**: Sin hablar · En conversación · Propuesta enviada (pelota de ellos) · Nuestra pelota · Congelado (+30 días sin movimiento) · Cerrado ganado · Cerrado perdido. La leyenda con la regla de cada uno está al pie de la vista.
  - **Reuniones**: rango 1 / 3 / 6 meses, tarjetas (total, asistieron, no asistió, reagendadas, derivaron en proyecto, promedio semanal), gráfico de barras por mes y "agrupar por" (país, ciudad, industria, rol, empresa, cuenta, quién la generó, estado) en barras horizontales, más la tabla con fecha, hora + duración, con quién, cargo, empresa, lugar, industria, cuenta, quién generó, estado y nota.
  - **Prototipos**: tres columnas — En curso / Congelados / Cerrados — con antigüedad del último movimiento, reuniones, último hecho y próximo paso.
  - Clic en un proyecto (tabla o tarjeta de prototipo) abre un panel derecho de solo lectura: datos del contacto y la empresa, hilo de "qué se habló", reuniones del proyecto y notas del equipo.
- Datos de demo propios de `Control.dc.html` (`PROYECTOS`, `REUNIONES` de abril a septiembre 2026). Los cinco proyectos que vienen de leads del CRM llevan `leadId`; los demás no tienen lead asociado.

### Segunda vuelta del 07/09

- `Venta de PIB` pasó a llamarse **Fabript/PIV** (tipo y nombres de proyecto).
- Columna **Últ. reunión** con fecha y estado; si la única reunión es futura dice `programada DD/MM` (nunca "sin reuniones" con conteo mayor a cero).
- **Icono de notas** por fila, conectado a la nota "Acerca de" de la ficha más la última nota del proyecto (hover), prendido en acento cuando hay notas.
- **Tira de avance** en una segunda línea de cada fila: carrusel horizontal con próximas acciones (ámbar), actualizaciones de la más nueva a la más vieja y notas. En el panel del proyecto lo mismo dividido en tres columnas: Notas · Actualización del proyecto · Próximas acciones.
- Se eliminó la pestaña **Prototipos**; el tipo Prototipo se fusionó con Fabript/PIV (era lo mismo).

### Tercera vuelta del 07/09 — dos empresas

- Los proyectos se dividen primero por **empresa propia** (`casa`, `Component.CASAS`): **Globalita** (tipos Fabript/PIV y Parcería) y **Seng**, la empresa de inversiones (tipo Inversión). Los proyectos sin `casa` se leen como Globalita.
- Filtros de Proyectos: fila **Empresa** (Todas / Globalita / Seng) arriba de **Tipo**; los chips de tipo muestran solo los tipos de la empresa elegida y sus conteos se calculan sobre ese subconjunto.
- La columna de la tabla es **Empresa y tipo**: nombre de la empresa propia en mayúsculas chicas sobre la pastilla del tipo.
- El tipo `prototipo` desapareció; sus tres proyectos de demo pasaron a Fabript/PIV y se sumaron dos proyectos Seng (Plásticos Del Litoral, Cerámica Andina).
- Reuniones: filas numeradas y cuatro métricas nuevas — **conversión** reunión→proyecto, empresas distintas, duración promedio — más cortes por **día de la semana** y **franja horaria**. Las barras por mes muestran en banda oscura la porción que derivó en proyecto.
- Reuniones también filtran por **empresa propia**: chips Todas / Globalita / Seng / Sin proyecto (la casa se toma del proyecto asociado; las reuniones sin proyecto quedan en "Sin proyecto"). El filtro alcanza tarjetas, barras por mes, cortes y tabla; la columna Empresa muestra la casa debajo y "agrupar por" suma la opción **Empresa propia**.
- Header del Observador: solo chip de usuario y tema (`puedeNotifs`, `puedeMas` en `Dashboard.dc.html`); el permiso `agenda` salió de su preset. La sección inicial de un usuario es la primera de sus permitidas, no `Follow-up` fijo.
- **Lead → proyecto**: acciones rápidas de la ficha → grupo "Control de proyectos" → *Abrir proyecto Fabript/PIV* / *de parcería*. Copia país, ciudad, industria, cargo, cuenta y nota; queda En conversación y aparece al instante en Control (`proyectosExtra` en `Dashboard.dc.html`, prop `extra` en `Control.dc.html`). Manual a propósito: automático al agendar llenaría Control de proyectos vacíos.
- La especificación de todo esto para subir a GitHub está en **`MANUAL-control-proyectos.md`** (anexo de `MANUAL.md`).

## Pendientes y decisiones abiertas
1. **Conectar Gmail** queda como estado de interfaz simple (toggle en WA Personal), sin pantalla de permisos ni elección de cuenta — decidido así para el prototipo.
2. **Automatizaciones** ya lee las plantillas R0–R8 desde `RepositorioMensajes` (por convención de nombre «R{n} · …») — un solo lugar de verdad.
3. Los chats de leads siguen fuera de WA Personal. Decisión tomada; revisar solo si el usuario lo pide.
4. "Seguimiento de prototipo": descartado, fue un malentendido.

## Datos de demo (fechas fijas)
Hoy es 04/09/2026. Los contactos, entrantes, sesiones de WhatsApp (5 de 6, AMU caída) y la cola de envíos están en constantes estáticas dentro de `Dashboard.dc.html`.
