# Pendientes

Lo decidido y todavía no hecho. La especificación —cómo tiene que ser— está
entera en `docs/MANUAL.md`. Acá va sólo el control de qué falta.

Última revisión: **09/09/2026 · 23:40**, verificada contra el código, contra la
base y contra los logs de PocketBase. Los números de acá salen de consultas, no
de memoria.

> **El registro de errores** está en `docs/APRENDIZAJES.md`: los 35 que
> salieron mal, de dónde vinieron y cuántas veces volvieron. Lo que se puede
> volver a buscar solo, lo busca `node docs/revisar-aprendizajes.mjs`.

> **Cómo leer esto.**
> `[x]` hecho y verificado · `[ ]` falta · `[~]` a medias
> ⚠️ está mal hoy (no es una ausencia) · ❓ necesita una decisión de Augusto
> 🔒 bloqueado por algo que no es código

---

## Tablero

| Bloque | Hecho |
|---|---|
| 0 · Bugs vivos | **5 de 5** |
| 1 · Ficha (columna 2) | **5 de 5** |
| 2 · Mensajes destacados | **2 de 2** |
| 3 · Lista (columna 1) | **3 de 3** |
| 4 · Estados de proyecto | **2 de 2** |
| 5 · Usuarios | **3 de 3** |
| 6 · WA Personal | **3 de 3** |
| 7 · Agenda y Calendar | **7 de 7** |
| 8 · Integraciones y worker | 1 de 7 |
| 9 · Producción | 1 de 8 |
| 10 · Los datos | **7 de 10** |
| 11 · Las copias | **3 de 4** |

**Los bloques 0 a 7 están cerrados.** Lo que queda no es de programar: el
worker (8) es la otra mitad del producto y tres de sus cuatro items esperan
datos de Augusto; producción (9) espera credenciales y su visto bueno; y los
datos (10) son fusiones y limpiezas que se hacen desde la pantalla.

---

## 0 ter · La revisión de Augusto del 09/09 (tercera vuelta) — EL PLAN

Miró la agenda ya arreglada y dictó dieciocho cosas. Pidió expresamente que
esto se piense antes de tocar nada: *«quiero que te tomes más tiempo para poder
pensar el resultado, no quiero que lo hagas así de imprevisto»* y *«pensemos en
la estructura de los colores y los contrastes del resto del dashboard para
poder pensar mejor en los colores de este»*. Nada de acá está implementado
todavía. **Esperar el visto bueno del plan antes de empezar.**

**Cuatro de las dieciocho ya estaban en `APRENDIZAJES.md` y volvieron.** El
color de la agenda (7ª vuelta), un control nuevo en vez del que ya existe (6ª),
y decidir por el usuario (4ª y 5ª). Más una familia nueva, la **12 · aprobar
una descripción no es aprobar una pantalla**. Ya están registradas.

---

### Tanda 1 · El color — ✅ HECHA el 09/09

Augusto: *«es un verde demasiado fuerte»*, *«es como un gris»*, *«me gustaría
una paleta un poquito más clara; total, el fondo es bastante blanco»*.

**El hallazgo.** El resto del dashboard ya tiene una respuesta escrita, y la
agenda es el único lugar que no la usa. Todo el CRM colorea igual: **fondo de
tinte claro, texto saturado del mismo tono.**

| Ya en el producto | Contraste |
|---|---|
| `.fila-reunion-asistio` — `--success-light` + `--success` | 5.89:1 |
| `.fila-ultimo` — `--accent-light` + `--accent` | 4.94:1 |
| `.badge-meeting` | 6.78:1 |
| `.badge-await` | 6.37:1 |
| `.pastilla` — `--bg` + `--muted` | 5.93:1 |

**Bloque sólido con texto blanco no existe en ninguna otra parte del CRM.** La
agenda se inventó un idioma propio. Por eso podía estar aprobada por el chequeo
—5.80, 6.19, 6.05— y desentonar igual.

- [x] **Los estados pasan al idioma de la casa**: tinte claro + texto del mismo
      tono + una **guía saturada de 3px a la izquierda**, que es la que dice el
      estado de un vistazo sin que el bloque grite.
      «Programada» quedó en `--accent-hover` y no en `--accent`: el nombre son
      10px, y `--accent` daba 4.94:1 —pasa, pero justo— contra 6.51:1 del otro,
      sin cambiar de tono ni salir de los tokens.
      La **guía punteada** ganó significado: dice que no hubo reunión
      (cancelada) o que todavía no hay lead (sin conectar).

      | Estado | Fondo | Texto | Contraste |
      |---|---|---|---|
      | programada | `--accent-light` | `--accent` | **4.94:1** |
      | asistió | `--success-light` | `--success` | **5.89:1** |
      | no asistió | `--error-light` | `--error` | **5.30:1** |
      | cancelada | `--warning-light` | `--badge-await-text` | **6.59:1** |
      | de Google, sin lead | `--info-light` | `--muted` | **6.28:1** |
      | vinculado | `--teal-light` | `--accent` | **4.59:1** |

- [x] ⚠️ **La columna de hoy deja de ser `--accent-light`.** Es obligatorio, no
      estético: «programada» pasa a ser `--accent-light`, así que el bloque y la
      columna de hoy quedarían **del mismo color**. Es exactamente el error 2 del
      registro, que ya costó seis vueltas. Hoy se marca con el encabezado —que ya
      va en `--accent` y en negrita— y con la línea roja de ahora.
- [x] **La hora del bloque va en `--muted`, nunca en `--hint`.** Medido:
      `--hint` sobre `--accent-light` da **2.91:1** y sobre `--info-light`
      **3.35:1**. Los dos por debajo del piso.
- [x] **El hover no cambia de tono: profundiza.** `filter: brightness(.93)` y la
      guía de 3px a 5px. Bajar el brillo oscurece fondo y texto a la vez, así que
      el contraste se mantiene y no hace falta un token nuevo por estado. Los
      bloques que no responden a nada —el almuerzo— no tienen hover: diría «esto
      se puede tocar» y sería mentira. El mismo tinte un paso más
      oscuro y la guía izquierda más gruesa. **El azul queda descartado y no es
      capricho**: en este CRM el azul es LinkedIn (`--brand-linkedin`), y un
      evento azul al pasar el mouse se leería como «esto es de LinkedIn».
      ❓ Si igual lo querés azul, decilo y lo hago.
- [x] **Sacar los carteles de rato libre.** Textual: *«no me sirve y no quiero»*.
      Se va el render, se va el CSS `.agenda-libre`. **`core/huecos.ts` y sus
      17 tests se quedan**: la regla es correcta y no cuesta nada; lo que sobraba
      era ponerla en pantalla.
      ❓ El **contador de reuniones por día** y el **reloj de la línea de ahora**
      entraron en la misma tanda que los carteles. No dijo nada de ellos. Los
      dejo salvo que me digas que también se van.

**La auditoría de la tanda 1 contra `APRENDIZAJES.md`** (pedida por Augusto):

- ✅ **Familia 2 · el color.** Los 6 pares medidos, y no sólo en claro.
- ⚠️ **Y ahí apareció un agujero del propio chequeo: B leía SÓLO el tema
      claro.** Con bloques sólidos alcanzaba —el texto era blanco y el fondo
      saturado en los tres temas, así que medir uno medía los tres—; con tinte
      claro dejó de alcanzar, porque en oscuro y en noche esos tokens cambian de
      rol. **Se extendió el chequeo a los tres temas**: son 16 parejas × 3 = 48
      mediciones por corrida. Todas pasan; la más ajustada es «asistió» en tema
      oscuro con **4.85:1**.
- ✅ **Se probó que el chequeo DETECTA, no sólo que dice que sí.** Se rompió la
      hora a `--hint` a propósito: encontró las 4. Y se subió el piso a 5.0:
      encontró exactamente una, la del tema oscuro, con el número correcto.
      Un chequeo que nunca se vio fallar no es un chequeo.
- ✅ **Familia 3 · reglas muertas.** Chequeo C limpio. `porDiaSinFiltrar`, que
      existía sólo para los carteles, se fue con ellos.
- ✅ **Familia 4 · tokens.** Chequeo D limpio: ni un color literal ni un tamaño
      fuera de escala. Los seis estados salen de tokens que ya existían — no
      hizo falta inventar ninguno.
- ✅ **Familia 7 · dos lugares para lo mismo.** Sin restos de `agenda-libre`
      en el CSS, el JSX ni el manual. `core/huecos.ts` sigue con sus 17 tests.
- ✅ **Familia 10 · datos reales.** Ni un teléfono ni un correo en el diff.
- ✅ **Familia 12 · aprobar una descripción.** Aplica y se respetó: la tanda 1
      **sólo cambia lo que ya estaba y saca tinta**, que es el caso donde el
      «dale» por escrito alcanza. Si hubiera agregado algo a la pantalla, iba
      mostrado antes.
- 📝 **Se corrigió un comentario que había quedado mintiendo** en `Agenda.tsx`:
      decía que el mockup de Augusto «bajaba el contraste, que es lo contrario
      de lo que hacía falta». Era falso. La paleta clara del mockup era la
      dirección correcta; lo que faltaba no era subir el tono sino medir.

**Verificado**: 500 tests, `tsc` limpio, `vite build` verde, chequeo en 0.

---

### Tanda 2 · Que la agenda se pueda manejar

- [ ] **Arrastrar cualquier evento, incluidos los de Google.** Textual:
      *«mantengo apretado y quiero mover hacia abajo, no me deja. Eso debería
      ser una funcionalidad, y tiene que mandar una notificación a la persona»*.
      Hoy el arrastre existe sólo para las 288 reuniones del CRM y está
      **bloqueado para los 1.769 eventos externos**, o sea para casi toda su
      pantalla. La justificación estaba escrita —«el dueño del evento es
      Google»— y es la familia 8 del registro.
- [ ] ⚠️ **Y acá está el peligro real de esta tanda: el eco infinito.**
      `guardarEventoExterno()` escribe con `$app.save()`, que **sí dispara
      hooks**. Un hook de salida sobre `evento_externo` haría: Google → la
      sincronización escribe la fila → el hook la manda de vuelta a Google →
      Google la trae como cambio → … **con un mail al invitado en cada rebote.**
      El camino ya está probado en `aplicarEvento()`: **la escritura de entrada
      pasa a SQL plano**, que no dispara hooks, y el hook de salida queda sólo
      para lo que toca una persona. Sin esto, no se toca el arrastre.
- [ ] **Notificar al mover** con la regla que ya existe: si el inicio **ya pasó**
      es una corrección y Google no avisa; si es futuro, avisa.
- [ ] **Estirar cualquier evento**, de a 15 minutos. Ya funciona así para las
      reuniones del CRM (`DURACION_MINIMA = 15`); falta abrirlo a los externos.

---

### Tanda 3 · El tamaño y el encuadre

- [ ] **La semana está demasiado grande.** Medido: `ALTO_TRAMO = 22px` por cada
      15 minutos, o sea **88px por hora**. De 08:00 a 18:00 son **968px de alto**:
      no entra en una laptop de 14" y obliga a scrollear siempre. Google Calendar
      usa ~48px por hora y Outlook ~44. Propuesta: **`ALTO_TRAMO = 14`** (56px
      por hora) → el día entero en ~620px, la semana se ve de una.
      ⚠️ Contradice el prototipo, que dice 22. Manda lo que pidió Augusto, y el
      manual se actualiza en el mismo commit.
- [ ] **La diaria, como Google Calendar.** Textual: *«los eventos centrados y un
      ancho seteado, que le pongo diaria y automáticamente se me reduce»*. Hoy la
      única columna se estira a todo el ancho del panel. Va con ancho tope y
      centrada.
- [ ] **Revisar el diseño de la semana, no sólo achicarlo.** *«El diseño no me
      gusta, deberíamos pensar un diseño más simple»*. Con la tanda 1 puesta y el
      alto bajado, mirarlo de nuevo antes de seguir tocando.

---

### Tanda 4 · Conectar, y lo que ya está conectado

- [ ] **Hover en un evento sin conectar**: el **correo de la persona invitada** y
      un botón para conectar. Hoy el bloque «conectar» no tiene tarjeta: se toca y
      se abre el modal, sin ver antes de quién es.
      ⚠️ **A verificar primero contra la base**: `evento_externo` **no guarda el
      correo del invitado** (columnas: `calendario, titulo, inicio, duracion_min,
      zona, dia_entero, google_event_id, lead`). O se suma la columna y se trae
      `attendees` en la sincronización, o no hay correo que mostrar. Es el
      error 11 del registro —«no había dónde guardarlo»— y esta vez se mira el
      esquema **antes** de dibujar la pantalla.
- [ ] **Hover en un evento ya conectado**: asistió / no asistió, cambiar la
      fecha, el correo, notas y «+». Es la misma tarjeta que ya tienen las
      reuniones del CRM: se reusa, no se escribe otra.
- [ ] **Un evento vinculado se ve como un enlace**, por defecto.

---

### Tanda 5 · Fuera de la agenda

- [ ] **Las fechas sin año**, al agendar una reunión y en el próximo contacto.
      Hoy son cuatro `<input type="date">` del navegador, que obligan a poner el
      año para agendar mañana. `FechaReunion` **ya tiene un calendario propio**,
      y su comentario dice textual *«el día se elige en un CALENDARIO, no en un
      `input type=date`»*. Se reusa ése. (Familia 4 del registro, 6ª vez.)
- [ ] **Cargar un teléfono a mano.** Hoy el chip vacío ofrece un solo camino,
      «Conectar un teléfono que ya está en la base». Si el número **no está en la
      base** no hay salida. Va el segundo camino **adentro del mismo modal**, no
      como un botón al lado: dos botones para lo mismo es la familia 7.
- [x] ✅ **Chats: filtrar los que no tengo agendados — RESUELTO, y no era lo
      que parecía.** Confirmó que es la pestaña de WhatsApp personal y pidió
      «cargá chats demo sin agendar para testear el botón».
      **El botón ya existía y funcionaba bien.** Lo que pasaba es que los cinco
      chats de demo tenían teléfonos inventados (`5493415550001..05`) que no son
      de ningún lead: o sea que **los cinco ya eran «no agendados»**. Apretar el
      filtro dejaba 5 de 5 y parecía muerto.
      Así que lo que faltaba era **lo contrario de lo pedido**: chats que SÍ
      estén agendados, para que el filtro tenga algo que sacar. Se cargaron
      cuatro con el teléfono de un lead real y dos más sin agendar.
      **Ahora el filtro pasa de 11 a 7 chats**, y se ve trabajar.
      🧹 **Para borrar cuando no hagan falta** (los borrados los hace Augusto):
      `9u1wrqb9co5u34b` `ehuyv6wbqx2ziep` `4jaia8b9svjw5la`
      `wvtipapkbrikpz9` `uro37cimtmkdp6x` `fg6lbce0cq4t7h5`.
      Todos tienen «(demo)» en el nombre.
- [ ] ❓ **Las flechas y la fecha de contacto, intercambiadas.** No encuentro
      flechas junto a una fecha de contacto en ninguna de las dos listas.
      Necesito saber qué pantalla es.
- [ ] ❓ **El emoji desalineado dentro del círculo.** Va con lo anterior: mismo
      lugar, misma revisión.
- [ ] **La línea verde de la vista Lista no sigue al perfil elegido.** El
      resaltado existe (`.agenda-lista-on`, pinta con `seleccionado === l.id`).
      La hipótesis: la vista Lista **sólo lista leads con seguimiento**, así que
      al elegir un perfil que no está en esa lista no se pinta nada y queda el
      anterior. Hay que reproducirlo antes de tocar.
- [ ] ✅ **El texto raro de la columna 2 — CONTESTADO, y ubicado.** Lo pegó:
      es el bloque `.reunion-evento` de `FechaReunion.tsx:711-729`, el que
      aparece al abrir «Fecha de reunión». Son cuatro cosas apiladas: el título
      que se va a crear («Jorge / Alejandro / Augusto»), el aviso de que falta el
      link de LinkedIn, y **tres renglones explicando el formato del título** y
      que el link es el del perfil y no el de Sales Navigator.
      **El diagnóstico**: los tres renglones son material de enseñanza puesto
      para siempre en la columna más apretada del CRM. Explican un formato que
      **Augusto inventó**: después de la primera vez no informan, ocupan.
      **La propuesta**: se quedan las dos cosas que sí dicen algo —el título de
      muestra, que deja ver qué se va a crear antes de crearlo, y el aviso del
      link faltante, que es accionable— y la explicación se va al `title` de la
      etiqueta «Evento que se crea en Google Calendar». Sigue estando para quien
      la necesite y deja de estar para quien no.
- [ ] ❓ **Jorge, Marcelo y Fabio como últimos editores en el demo.** Busqué los
      tres nombres en las 26 tablas de la base: aparecen sólo como leads y
      perfiles reales, en ningún campo de «editor». No están en el código de la
      app. **¿En qué pantalla los estás viendo?**

---

## 0 bis · La revisión de Augusto del 09/09 (segunda vuelta)

Miró la UI pantalla por pantalla y marcó lo que no cerraba. Lo que sigue es
lo que **quedó abierto**; lo arreglado está en el historial de git y en la
página de revisión.

- [x] **Conectar un evento del calendario con un lead.** Hecho el 09/09.
      Está en la agenda: un bloque de Google que sea de prospección y no
      tenga lead se toca y abre «Conectar con un lead».
      **Se conecta por PERSONA, no por evento.** Son 278 eventos sueltos pero
      **145 personas**: «FabriPT Catchup Herik» aparece 45 veces y «Brenno»
      38. Elegir el lead una vez engancha los 45 de una.
      Los leads se ordenan poniendo primero los que comparten una palabra
      entera del nombre — ordena, no elige: juntar a dos personas distintas
      es el error caro, el mismo de Duplicados.
      Si esa persona no es lead todavía, se crea desde ahí con el alta de
      siempre y queda conectada al volver. Hace falta: de las 145, **55 no
      tienen ningún lead parecido** (111 eventos).
      Conectado, el bloque se pinta verde y el clic abre la ficha. Sigue sin
      arrastrarse: el dueño del evento es Google.
      Migración `1788604000_evento_con_lead` (`evento_externo.lead`, y la
      regla de escritura para el dueño del calendario). El vínculo sobrevive
      a la sincronización: el reloj pisa título y horario, no el lead.
      Regla en `core/vincular.ts` con 20 tests que citan §7.6, y §7.6 del
      manual actualizado en el mismo commit.
- [x] **Vista Lista: el botón de «no sé».** Es el tercer botón, «–», al lado
      del ✓ y la ✕. Archiva la confirmación sin afirmar nada de la reunión:
      la fecha sigue en la columna «Última» y la reunión sigue en el histórico.
      Campo `reunion.confirmacion_archivada` (migración 1788603900).
      Hoy hay **0 archivadas de 173 en `sin_dato`**: está puesto y sin usar.
- [x] **Vista Lista: cambiar la fecha sin abrir la ficha.** Se toca la fecha de
      la columna «Última» y se corrige ahí. Se ve como texto y se delata con un
      subrayado punteado al pasar por encima: la fila ya tiene diez columnas y
      no aguantaba un botón más.
      ⚠️ **Y de paso se arregló algo que estaba mal desde antes**: cambiar el
      horario de una reunión mandaba `sendUpdates=all` **siempre**, así que
      corregir la fecha de una reunión de hace ocho meses le habría mandado al
      lead «tu reunión se movió». Ahora la regla es del horario y no de la
      pantalla: **si el inicio ya pasó, Google no notifica**.
- [x] **Las tres ideas del mockup del 09/09 que valían la pena.** Los ratos
      libres («2 h 30 libre») entre bloque y bloque, el contador de reuniones
      en la cabecera del día, y la línea roja de la hora actual con su reloj.
      La regla de los huecos está en `core/huecos.ts` con 17 tests que citan
      §7.6 — funde los ocupados que se pisan, recorta lo que asoma fuera de la
      franja y no anuncia nada por debajo de media hora.
      **Del mockup NO se tomó la paleta**: sus eventos son más pálidos que los
      nuestros, y adoptarla habría deshecho justo lo que Augusto venía pidiendo.
      Tampoco el popup al hacer clic — §7.6 ya decidió al revés.
- [x] **Editar o crear un mensaje desde «Destacar mensajes».** Tres cosas, el
      mismo cuadro: el **lápiz** de cada fila corrige el texto de ese idioma
      —completa, no pisa: las otras claves de `textos` quedan como estaban—;
      los que **no tienen texto en ese idioma ahora aparecen** abajo y marcados,
      en vez de desaparecer del filtro; y **«Escribir un mensaje nuevo»** crea
      uno sin salir. Se fue el cartel que mandaba al Repositorio.
- [ ] **El diseño de los chips destacados.** Augusto: «no me gusta cómo
      queda». Falta que diga qué le molesta —el alto, el borde, el tilde—.
- [x] **«Conectar un teléfono de la base» ya no es un botón aparte.** Es el
      propio chip de Teléfono cuando está vacío: se toca el chip y se abre el
      buscador. Era la misma cosa pedida en dos lugares, y el botón de abajo
      Augusto no lo encontró. Con número cargado, el chip vuelve a ser un chip.

---

## 0 · Bugs vivos — lo que hoy está mal

- [x] **«Cuentas conectadas» ya no miente.** Dice *5 LinkedIn · 5/7 WhatsApp* y
      **no hay ninguna sesión real**. Los estados salen de `cuenta.estado_sesion`
      y `cuenta.sesion_wa`, que son valores del seed de demo. Verificado contra
      la base: cinco en `activa`, una en `caida`, una en `sin_vincular`, todas
      inventadas.
      **Cómo se arregla bien**: el estado no puede ser un campo que alguien
      escribió una vez; tiene que salir de la sesión de verdad (el worker) y
      llevar fecha de última señal. Mientras el worker no exista, lo honesto es
      que **todas digan «sin vincular»** y que la pantalla diga por qué.
- [x] **El switch de canal manda.** Hoy el canal lo
      calcula `canalDe()` desde la cadencia y la pastilla sólo lo informa.
      Se arregla junto con 1.2.
- [x] **Tareas muestra sólo las propias.** `Tareas.tsx` pide la colección entera
      sin filtrar por `usuario`: un colaborador ve —y puede borrar— las del
      administrador.
- [x] **El link de perfil abre con el Chrome de la cuenta de origen** (antes salía con el perfil personal), no con la cuenta de
      origen del lead. Se decide junto con 7.7 (qué Chrome abre qué).
- [x] **La sincronización con Google no llegaba nunca.** `sincronizar()` elegía
      el calendario mirando sólo `lead.asignado`, vacío en los 242 leads.

---

## 1 · Ficha del lead — columna 2

- [x] **1.1 · Sacar el botón de WhatsApp del header.** Está en
      `FichaLead.tsx:513`. Ir al chat pasa a ser una sola acción, abajo.
- [x] **1.2 · Switch LinkedIn/WhatsApp + botón «ir al chat» en Enviar mensaje.**
      El botón es una flecha en diagonal hacia arriba (↗) y **respeta el
      switch**: en LinkedIn abre LinkedIn, en WhatsApp abre WhatsApp. Esto
      reemplaza el bug del canal que no manda: el switch pasa a decidir de
      verdad, no a informar.
- [x] **1.3 · Una sola fila de R.** Todos los pasos R0…R8 juntos, con tilde los
      enviados y sin tilde los que no, **más un hueco para agregar un chip de
      mensaje destacado**.
- [x] **1.4 · Borrar el bloque de abajo.** Hoy repite R0 y R1 con el nombre
      completo y tiene otro botón de destacados. Se va entero: quedan sólo los
      títulos cortos, `R1`, `R2`, `R3`.
- [x] **1.5 · El idioma, en dos letras al lado de «Enviar mensaje»**: `PT`, `EN`,
      `ES`. Sin la palabra «idioma» adelante.

---

## 2 · Mensajes destacados

- [x] **2.1 · Preguntar el alcance al destacar.** Hoy destaca sin preguntar.
      Tiene que ofrecer **sólo este perfil / toda la cuenta (ej. Bruno) / todas
      las cuentas**. El modelo ya lo soporta (`estaDestacadaPara` y
      `escribirAlcance`, `EnviarMensaje.tsx:114-136`); falta el paso que pregunta.
- [x] **2.2 · Filtrar por idioma del chat por defecto.** Al agregar un destacado,
      mostrar los del idioma configurado en ese chat. Si se cambia el idioma, la
      lista cambia sola.

---

## 3 · Lista de contactos — columna 1

- [x] **3.1 · El icono de WhatsApp, sólo si hay WhatsApp.** Hoy aparece en gris
      cuando no hay. Si no hay número, no va nada.
- [x] **3.2 · Sin próximo contacto: vacío**, sin texto de relleno.
- [x] **3.3 · La fecha de la última reunión, con color**: verde si asistió, rojo
      si no asistió, gris si todavía no pasó.

---

## 4 · Estados de proyecto

- [x] **4.1 · Hoy no hay dónde editarlos**, y por eso Augusto no los encontró:
      los siete están fijos en `core/proyecto.ts` (`ESTADOS_ACTIVOS`,
      `ESTADOS_CERRADOS`). No existe pantalla.
- [x] **4.2 · Administrador de estados**: crear, editar y borrar, con **nombre y
      qué significa cada uno** — la leyenda del pie sale de ahí (§3.13.2 del
      manual). Accesible desde Control y desde la ficha del lead.

---

## 5 · Usuarios

- [x] **5.1 · Permisos visibles y editables al dar de alta.** Al elegir rol
      (administrador / colaborador / observador) tiene que mostrarse **la lista
      completa de permisos de ese preset**, y poder tocarlos para esa persona.
      Lo que se cambia queda marcado como **permiso especial**, para que se vea
      que esa persona no tiene el preset puro.
- [x] **5.2 · El correo, debajo del perfil en la columna 1.** Hoy está en el
      header.
- [x] **5.3 · «Reiniciar contraseña» junto a «Eliminar»**, en el box de accesos
      rápidos de la columna 1.

---

## 6 · WA Personal

- [x] **6.1 · Filtro rápido de contactos no agendados**: los que están en el
      teléfono y no existen como lead.
- [x] **6.2 · Marcar personal / trabajo**, como filtro.
- [x] **6.3 · Leído / no leído.** Sin más vueltas: son amigos y familia, no hay
      cadencia ni estados.

---

## 7 · Agenda y Google Calendar

- [x] **7.1 · Conectado.** `augustou@globalita.io`, con `refresh_token` guardado.
      El correo se resuelve leyendo el id del calendario, sin pedir el alcance
      `email` —que habría obligado a reconectar a todos—.
- [x] **7.2 · Sincronización de ida y vuelta.** El CRM escribe en Google (y le
      avisa al lead, `sendUpdates=all`) y un reloj cada cinco minutos trae lo que
      cambió allá. En la primera corrida real **corrigió 65 duraciones**: el
      importador había puesto 30 minutos por defecto y las reuniones eran de 45,
      60 y 20.
- [x] **7.3 · Traer TODOS los eventos del calendario, no sólo las reuniones del
      CRM.** Hoy la agenda dibuja lo que está en `reunion`; Augusto quiere ver su
      día y su semana completos, como en Google. Es una fuente de eventos nueva:
      los que no son leads existen para no agendar encima.
- [x] **7.4 · La vista Lista, desde septiembre del año pasado.** Hoy sólo está lo
      importado; hay que traer el histórico completo del calendario.
- [x] **7.5 · Una fila por lead en Lista, con la última reunión.** Si con la
      misma persona hubo cinco reuniones se muestra **una sola** —la última— y
      las otras cuatro viven en el histórico de esa ficha. Hoy la vista ya ordena
      de la más nueva a la más vieja, pero no agrupa.
- [x] **7.6 · Confirmar asistencia de las pasadas.** Las 173 en `sin_dato` tienen
      que poder marcarse asistió/no asistió, y las pasadas mostrarse
      **archivadas**: son historia, no pendientes.
- [x] **7.7 · «Abrir» tiene que usar un Chrome específico**, el que tiene la
      sesión de LinkedIn de Augusto. Un navegador no se elige desde una página
      web: hace falta que lo abra el worker o un handler local. **Falta decidir
      cómo.**

---

## 8 · Integraciones y worker

- [x] **8.1 · Google Calendar** (bloque 7).
- [ ] 🔒 **8.2 · `apps/worker/` está vacío.** Es la mitad del producto que no
      existe: hoy el CRM registra lo que se hace a mano, no manda un mensaje ni
      invita a nadie. De acá cuelgan LinkedIn, WhatsApp, el estado real de las
      sesiones (bloque 0) y el Chrome de 7.7.
- [ ] 🔒 **8.3 · LinkedIn.** Augusto tiene que pasar **las URLs de los perfiles**
      y **cuál es el Chrome que tiene conectado**. Sin eso no se puede empezar.
      Es donde está el 90% de la operación y lo que completa empresa e industria.
      **Dijo el 09/09 que ya tiene las sesiones de Chrome abiertas.** Lo que hace
      falta es el **mapa perfil de Chrome → cuenta**: cuál de los perfiles
      («Default», «Profile 1», «Profile 2»…) tiene abierta cada una de las nueve
      cuentas (AL, DL, FR, ED, AU, AMU, BR, AC, DP). Hoy la configuración
      `navegador` tiene un solo valor, `{"lista":"Default"}`, así que **el CRM
      cree que hay un solo Chrome**.
      ⚠️ **Lo que NO hay que mandar por chat**: contraseñas, cookies de sesión,
      tokens ni códigos de verificación. Con el nombre del perfil alcanza; la
      sesión se usa desde el Chrome que ya está abierto en su máquina.
- [ ] 🔒 **8.4 · Las listas de prospección.** Las tiene que pasar Augusto.
- [ ] 🔒 **8.5 · WhatsApp con Baileys.** Una sola cuenta, según Augusto.
      Pedido el 09/09: *«desarrollar la Baileys para conectar WhatsApp»*.
      Lo que implica, en orden: `apps/worker/` desde cero (hoy está vacío) →
      Baileys con la sesión en disco y el QR servido por una ruta del CRM →
      la cola de envíos (`cola`, 0 filas) → el tope diario por cuenta (hoy 30,
      configurable) → y el enganche con los chats entrantes, que ya tienen tabla
      (`entrante`, 4 filas) y pantalla.
      ⚠️ **Baileys no es una API oficial de WhatsApp.** Una cuenta que manda de
      más se bloquea, y el tope diario existe por eso. Antes de conectar el
      número de verdad hay que decidir **con qué número se prueba**.
- [ ] **8.6 · Testear la integración con Calendar de punta a punta.** Pedido el
      09/09. Hoy 8.1 está marcado hecho porque el código está y sincroniza —hay
      1.769 eventos traídos y 3 ya vinculados a un lead— pero **nunca se probó
      el circuito completo con una reunión de verdad**. La lista:
      crear una reunión desde el CRM y ver que aparezca en Google con el título
      «Nombre / Cuenta / Augusto» · que le llegue la invitación al invitado ·
      moverla desde la agenda y ver que avise · **moverla desde Google y ver que
      el CRM la traiga** (es el camino de vuelta, el que puede hacer eco) ·
      cancelarla de los dos lados · y que el `syncToken` sobreviva a todo eso
      sin volver a pedir los 5.000 eventos.

---

## 9 · Producción

- [x] **9.1 · Los datos reales salieron del bundle y del historial.** Eran 6
      teléfonos, 2 nombres y 1 correo de contactos de verdad, usados como
      datos de ejemplo en las maquetas. Se reemplazaron por inventados y el
      historial de git se reescribió: el bundle viejo ya no está en ningún
      commit del remoto, verificado después del push.
      `docs/enmascarar.mjs` lo deja resuelto para la próxima exportación —
      va a volver a pasar, porque las maquetas salen con lo que haya en
      pantalla—: compara contra la base en vez de adivinar, y sin base se
      niega a correr antes que dar un falso «está limpio».
      ⚠️ **Dos cosas siguen siendo ciertas.** GitHub puede conservar el
      objeto viejo un tiempo aunque ya no lo alcance ninguna rama; para
      borrarlo del todo hay que pedírselo a su soporte. Y lo que estuvo
      público, estuvo público: esto corta hacia adelante, no borra lo que
      alguien ya haya clonado.
- [ ] ⚠️ **9.1 bis · Hay un token de GitHub escrito en claro dentro de
      `globalita-automation/.git/config`.** Encontrado el 09/09 al mirar los
      remotes: el `origin` de ese repositorio es una URL con un
      `github_pat_…` adentro, o sea **una credencial viva guardada en texto
      plano en el disco**. El repositorio es privado, así que no está publicado
      — pero cualquier copia de esa carpeta se lleva el token, y con él se
      entra a **todos** los repos a los que ese token alcance.
      **Qué hacer**: revocarlo en GitHub (Settings → Developer settings →
      Personal access tokens) y dejar el remote sin credencial:
      `git remote set-url origin https://github.com/Augustomu/globalita-automation.git`.
      La autenticación ya la resuelve `gh`, que está instalado y logueado.
      **Es la misma familia que 9.1**: un secreto que quedó escrito donde no
      correspondía. Aquel era público y éste no, pero el arreglo es igual de
      barato mientras nadie lo copió.
- [ ] **9.2 · SMTP de Hostinger** (`deploy/PASO-A-PASO.md`, paso 4.5). Sin eso,
      dar de alta a alguien falla.
- [ ] **9.2 bis · Testear el envío de mail de verdad.** Pedido el 09/09. No
      alcanza con configurar el SMTP: hay que **dar de alta a un usuario y ver
      llegar la invitación**. Es el único camino de alta que existe —nunca se
      fija una contraseña por nosotros, se manda el link— así que si el mail no
      sale, **no se puede sumar a nadie al CRM**. Hoy hay 2 usuarios: Augusto y
      uno de demo en estado «pendiente», que es justamente una invitación que
      nunca se pudo mandar.
      Se prueba contra una casilla propia antes que contra la de un colaborador.
- [ ] ⚠️ **9.3 · Esto estaba desactualizado: el CRM YA ESTÁ EN PRODUCCIÓN.**
      Verificado el 09/09: `https://crm.globalita.tech/api/health` devuelve
      **200** y la raíz también. O sea que hay un PocketBase vivo en el VPS con
      **su propia base**, separada de la de la PC.
      Lo que falta ahora no es publicar: es **saber en qué estado está**.
- [ ] **9.5 · Revisar que PocketBase de producción funcione bien.** Pedido el
      09/09. Qué mirar: que el servicio arranque solo después de un reboot
      (`crm-globalita.service`) · que la versión desplegada sea la de ahora y no
      una de hace semanas · que las migraciones estén todas aplicadas —incluida
      `1788604000_evento_con_lead`, la del vínculo evento↔lead— · que las reglas
      de API sean las mismas que en local, sobre todo que `google_cuenta` siga
      con **todas las reglas en `null`** para que el `refresh_token` no salga
      nunca por la API · y **cuántos registros tiene**, que hoy no lo sabe nadie.
- [ ] **9.6 · Revisar que el guardado de base de datos funcione.** Pedido el
      09/09. `deploy/backup.sh` existe y está bien escrito —usa
      `VACUUM INTO`, que copia sin parar el servicio ni arriesgar una copia a
      medio escribir, y retiene 14 días— pero **nadie verificó que el cron esté
      instalado y corriendo en el VPS**. Un script de backup que no corre es
      peor que ninguno, porque uno cree que está cubierto.
      Va con `deploy/traer-backup.sh`: bajar una copia y **abrirla**. Una copia
      que no se restauró nunca es una copia que no se sabe si sirve.
- [ ] **9.4 · Backups del VPS.** Un snapshot del proveedor cubre lo que las tres
      copias no cubren: que se rompa el servidor, no la PC.
      **09/09 · Hostinger ofreció crear un snapshot manual del VPS 1961198.**
      Tres cosas que definen la respuesta:
      1. **Se conserva uno solo**: crear el nuevo **pisa el anterior**. Antes de
         confirmar hay que saber si ya hay uno y de cuándo.
      2. **Expira en 1 día.** No es un backup: es un botón de deshacer para algo
         que uno está por hacer. Y sí hay algo por hacer —9.5 y 9.6—, así que
         el momento es bueno.
      3. ⚠️ **No cubre el CRM de la PC.** Los 242 leads, las 288 reuniones y los
         1.769 eventos están en `.pb/pb_data` de la máquina de Augusto. De eso
         se ocupan las copias por hora y Drive. **El snapshot protege el
         servidor, no los contactos** — conviene tenerlo claro para no quedarse
         tranquilo con la cobertura equivocada.
      Lo que **sí** protege y no está en ningún otro lado: la base de producción,
      la configuración de nginx y **`/etc/crm-globalita.env`, que tiene las
      credenciales de Google**. Ese archivo ya se perdió una vez con el formateo.
      → **La copia automática semanal es la que hay que dejar activa.** Es la de
      largo plazo; el snapshot es puntual.

---

## 10 · Los datos

Contado contra la base, no de memoria.

- [x] **Los cruces Calendar ↔ WhatsApp están hechos.** 76 perfiles absorbidos,
      **75 leads con teléfono** donde a la mañana había 2.
- [x] **Integridad verificada**: ningún lead cuelga de un perfil absorbido,
      ninguna reunión sin lead, ningún lead sin perfil.
- [x] **La separación de perfiles funciona**: se usó 5 veces.
- [x] **El slot 1 es Alejandro**, no Alberto. Corregido con migración.
- [x] **Las 288 reuniones tienen `calendario`.**
- [x] **La bandeja de Duplicados quedó vacía.** Contado con el mismo filtro que
      usa la pantalla (`posible_duplicado_de` no vacío y `fusionado_en = ""`):
      **0 perfiles**. El par «Jorge» / «Jorge Lara Huerta» se resolvió.
- [ ] ⚠️ **6 perfiles todavía juntan a dos personas**: Luiz, Jorge, Carlos, Juan,
      Ricardo y Wellington tienen leads con correos distintos.
- [x] **Los dos CSV entraron enteros.** Comprobado número por número el 09/09:
      `gerentes.csv` (228 filas) y `consultores.csv` (20) dan **239 teléfonos
      distintos, y los 239 están en la base**. No falta ninguno por importar.
      Lo que queda no es de importación: **167 de esos teléfonos son perfiles
      sin lead** y **166 leads no tienen teléfono**. Eso se cruza a mano desde
      el chip de Teléfono, porque el cruce automático por nombre exacto ya se
      agotó y adivinar de más junta a dos personas distintas.
- [ ] ⚠️ **Los leads de WhatsApp no tienen correo, y no lo tienen en ningún
      lado.** Los dos CSV son exports de Google Contacts de 19 columnas y ninguna
      es de correo: son nombre, teléfono, organización y notas. No se perdió al
      importar, nunca estuvo. Sale de otra exportación o del scan de LinkedIn.
- [ ] **Limpieza de demo**: 12 tareas del seed, 11 actividades, y 2 leads de
      prueba míos («Prueba Alta 41577», «Nueva Persona 09271»).
- [ ] ❓ **`AC` (Alberto Córdova) no existe como cuenta.** Si alguna vez hay leads
      suyos, hay que crearla con su cupo y línea de negocio.

---

## 11 · Las copias de seguridad

Esto no salió de la UI: salió de mirar los logs de PocketBase y las tareas
programadas de Windows.

> **09/09/2026 · Cambió el destino.** Augusto: *«la copia de los datos quiero
> que se haga en GitHub solamente; local no quiero nada, no sirve de nada, si
> se rompe la computadora perdí todo»*. Tiene razón y ya le pasó: el formateo
> de septiembre se llevó 5042 contactos. **GitHub es ahora el destino que
> decide si la copia salió bien.**

- [x] ✅ **La copia va a GitHub, al repo PRIVADO `Augustomu/globalita-data`.**
      Creado el 09/09 para esto y **no puede dejar de ser privado**: adentro hay
      242 leads con nombre, teléfono y correo de personas reales, más los CSV de
      la importación.
      ⚠️ **No va al repo del CRM**, que es **público**. Lo que se publica no se
      despublica: alcanza con que alguien lo clone antes de que uno se dé cuenta.
      Esa parte no es negociable y no la decide un script.
      **Qué sube y cada cuánto**:
      `json/` crudo **cada hora** —es texto, así que git guarda la diferencia
      entre una hora y la siguiente en unos KB en vez de un archivo entero— y
      `sqlite/data-AAAA-MM-DD.db.gz` **una por día**: 1,5 MB comprimidos a
      **316 KB**. La base es binaria, así que cada versión es un archivo
      completo; por hora el repo crecería 2,8 GB al año y por día, 117 MB.
      **No sube `auxiliary.db`**, los logs de PocketBase: 15 de los 18 MB de
      cada copia, y no sirven para restaurar nada.
      `.gitattributes` con `* -text`, porque **una copia tiene que volver byte
      por byte** y un CSV que vuelve con CRLF no es el mismo archivo.
      Guarda: si los perfiles cayeron más del 20%, no sube y avisa
      (`CRM_FORZAR=1` para forzar cuando la caída es real).
- [x] ✅ **Probado restaurando, no sólo subiendo.** Se clonó el repo privado en
      una carpeta limpia, se descomprimió la base y se abrió:
      `integrity_check = ok` y los conteos dan **242 leads, 489 perfiles, 288
      reuniones, 1.769 eventos externos**. Una copia que no se restauró nunca
      es una copia que no se sabe si sirve.
- [x] ⚠️ **Y de paso apareció algo grave: Drive desmontado cortaba TODO.**
      `snapshot-crm.js` hacía `fail()` si la carpeta de Google Drive no
      existía —que es exactamente lo que pasa cuando la máquina arranca y Drive
      todavía no sincronizó— **antes de hacer ninguna otra copia**. O sea que
      con Drive caído no se guardaba nada en ningún lado. Ahora avisa y sigue.
      Verificado el 09/09: la carpeta `G:\Mi unidad\Globalita-Backup` **no
      existe en este momento**, así que esto estaba pasando de verdad, no en
      teoría.

- [x] **La copia local por hora funciona.** `Globalita-SnapshotCRM` corre cada
      hora y deja una copia fechada en `~/globalita-backups/crm/`. Están las
      de las 17, 18, 19, 20 y 21 UTC, completas (sqlite + json + manifiesto),
      con `integrity=ok` y sin errores de claves foráneas.
- [ ] **La copia del VPS no se verificó nunca.** Va con 9.6: el script está,
      falta confirmar que el cron corra y que una copia bajada se abra. Las tres
      copias que hoy funcionan —local por hora, GitHub y Drive— son todas **de la
      base de la PC**. La base de producción no tiene ninguna verificada.
- [ ] ⚠️ **La copia de Drive está congelada desde esta mañana.** `crm-snapshot`
      en `G:\Mi unidad\Globalita-Backup` es del **09/09 a las 14:42 UTC** y
      tiene **692 perfiles**; la base de ahora tiene 489. El script no la pisa
      porque tiene una guarda —no sobrescribe Drive si la base cayó más del
      20%— y **está haciendo bien su trabajo**: por eso la tarea de Windows
      devuelve código 2 cada hora.
      **La caída es legítima, verificado el 09/09**: los 692 eran 188 perfiles
      del seed de demo más una importación duplicada. Comparado teléfono por
      teléfono, de los 395 números que había **155 eran del seed inventado y
      240 eran reales**; hoy hay 242 reales. **No se perdió ninguna persona de
      verdad.** Lo único que no volvió son 98 perfiles de una sola palabra
      («Josimar», «Waldemiro») que salían de títulos del calendario, y que hoy
      son justamente los eventos sin lead del punto de arriba.
      **Mientras tanto se hizo una copia que no pisa nada**:
      `crm-snapshot-2026-09-09T21-05-48` en la misma carpeta de Drive, con la
      base de hoy (489 perfiles, 242 leads, 288 reuniones). La vieja sigue ahí.
      ✅ **La pregunta se cerró sola al mover la copia a GitHub.** Drive dejó de
      ser la copia que importa y **ya no decide el código de salida**: la tarea
      horaria deja de devolver error. La carpeta vieja de Drive **no se toca** —
      no se borra nada— y queda como acompañante, si algún día Drive vuelve a
      montarse.

---

## 12 · La auditoría de la hoja de estilos (09/09)

Se hizo después de encontrar, por tercera vez, una regla vieja que había
quedado **debajo** de la nueva y la pisaba en silencio. En vez de buscar a
ojo se escribieron dos comprobaciones que recorren el archivo entero.

- [x] **Selectores que se pisan a sí mismos: eran 8, quedaron 0.** Cinco
      reglas estaban declaradas dos veces y la primera no se aplicaba nunca
      (`.cc-aviso`, `.fila-reunion` y sus tres variantes, `.repo-vacio`,
      `.repo-destacar`, `.repo-alcance`, `.agenda-hora-col`, `.usuario-rapidos`).
      Es el mismo mecanismo que dejó el nombre de las reuniones invisible
      durante tres rondas. Se borraron las muertas; las que ganaban no se
      tocaron, así que no cambia nada en pantalla.
- [x] **Tamaños de texto fuera de escala: eran 2, quedaron 0.** CLAUDE.md
      fija 9/10/11/12/13/14/17px. Había un `8px` en el chevron de la hora y un
      `15px` en el punto de sin leer —éste lo puse yo al agrandarlo—. Quedaron
      en 9 y 14.
- [x] **Colores sueltos: eran 2, quedaron 0.** Los dos fondos oscuros de los
      overlays estaban escritos a mano. Ahora son `--velo` y `--velo-suave`
      en `design-tokens.css`, con los mismos valores: se nombran, no se
      cambian.
- [x] **Un token fantasma.** `var(--rule-fuerte, var(--border))` aparecía dos
      veces y `--rule-fuerte` **no está definido en ningún lado**: las dos caían
      en el fallback. Se lee como si hiciera algo y no hacía nada.
- [x] **Los ratos libres mentían con el filtro de cuenta puesto.** Se
      calculaban sobre los eventos VISIBLES, así que filtrando por «BR»
      aparecía «2 h libre» encima de una reunión de AL que seguía estando.
      Ese cartel termina en dos reuniones a la misma hora, que es el error que
      la agenda existe para evitar. Ahora se calculan sobre todos los eventos.
      El contador de la cabecera sí respeta el filtro, y está bien que lo
      haga: ahí la pregunta es «cuántas de esta cuenta».

Las dos comprobaciones son scripts de una sola pasada; conviene volver a
correrlas después de cada tanda de cambios de diseño.

---

## Deuda técnica anotada

- ⚠️ **Una regla del repo está escrita dos veces, y es la única.**
  `cambioDeGoogle()` vive en `core/sincronizar.ts` con nueve tests, y
  `pb_hooks/google.js` tiene un espejo en JavaScript plano porque el motor JS de
  PocketBase no puede cargar TypeScript. Lo que impide que se separen es
  `espejo-del-hook.test.ts`, que carga el archivo del hook de verdad y le exige
  la misma respuesta en diez casos. **Si se toca una, se tocan las dos.** La
  salida limpia sería un paso de build que compile core a JS para los hooks.
- **La lista de leads trae todo de una vez.** `useLeads.ts` usa `getFullList`
  y §7.2 pide renderizar de a 80 sumando al hacer scroll. Con 242 leads entra
  sin problema y la regla de paginado ya está en `core` con sus tests; lo que
  falta es conectarla. Se vuelve un problema arriba de ~1.500 leads.
- **No hay login de pruebas.** Al borrar `alberto@globalita.test` se perdió la
  sesión con la que se verificaban las pantallas: las comprobaciones visuales las
  tiene que hacer Augusto hasta que haya un usuario de pruebas.
- ~~**La cuenta `_superusers` falla todos los días.**~~ **Resuelto, y no era del
  CRM.** Es `backup-online.js` de `globalita-automation`, que corre cada hora y
  busca el PocketBase de Globalita probando los puertos 8090, 8091 y 8092. El
  8090 lo tiene ahora el CRM, así que prueba con la clave de Globalita, le
  dicen que no, y sigue con el siguiente puerto. El propio script lo tiene
  anotado en un comentario. La tarea termina en 0. **No hay que hacer nada.**
- ~~**`evento_externo` no tiene campo `lead`.**~~ Resuelto el 09/09 con la
  migración `1788604000_evento_con_lead`.
- ⚠️ **Había un resto de la versión pálida del bloque de calendario pisando a
  la nueva.** Tres reglas de `estilos.css` quedaron del intento anterior y,
  por venir después en el archivo, ganaban: el hover volvía el bloque a
  `--info-light` y el nombre quedaba en `--text`, o sea texto oscuro sobre
  fondo oscuro. Explica por qué la vista semanal se seguía viendo mal después
  de «arreglarla» dos veces. Sacadas el 09/09.
