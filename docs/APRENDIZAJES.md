# Registro de errores

Todo lo que salió mal en este CRM, con de dónde vino y cuántas veces volvió.

**Para qué sirve.** No es una lista de culpas: es el material del que salen las
reglas de `CLAUDE.md` y los chequeos de `docs/revisar-aprendizajes.mjs`. Un
error que aparece una vez es un descuido; uno que aparece cinco es una regla
que falta. La columna que importa es **cuántas veces**.

**Cómo se hizo.** Reconstruido desde el historial de git (134 commits), los
logs de PocketBase y la base, el 09/09/2026. No de memoria.

**Tercera vuelta, 09/09/2026 · noche.** Augusto revisó la agenda ya arreglada
y **cuatro cosas volvieron**. Están marcadas «volvió» en el tablero y sumadas
en el número de veces de su familia. Ninguna de las cuatro la puede ver un
script: las cuatro son de criterio.

**Cómo se comprueba.** `node docs/revisar-aprendizajes.mjs` vuelve a buscar los
que se pueden buscar solos. Al 09/09/2026 **no aparece ninguno** — y eso es
justamente el límite del chequeo: los colores nuevos daban 5.80:1, 6.19:1 y
6.05:1, todos aprobados, y aun así estaban mal.

---

## El tablero

| # | Familia | Veces | ¿Se puede chequear solo? | Estado |
|---|---|---|---|---|
| 1 | Borrar datos sin que nadie lo pida | **1** (10 ejecuciones) | no | cerrado con regla |
| 2 | El color de la agenda | **8** | sí · B | **volvió** |
| 3 | Una regla vieja pisando a la nueva | **3** (14 reglas) | sí · C | cerrado |
| 4 | Un control nuevo en vez del que ya existe | **6** | sí · D | **volvió** |
| 5 | El scope de los handlers de PocketBase | **2** | sí · E | cerrado |
| 6 | Programar contra el modelo imaginado | **11** | **no** | **volvió** |
| 7 | Pedir la misma cosa en dos lugares | **5** | no | práctica |
| 8 | Decidir por el usuario | **5** | no | **volvió ×2** |
| 9 | Trampas de las APIs | **5** | no | documentado |
| 10 | Datos reales en un repo público | **1** | parcial | cerrado |
| 11 | No había dónde guardarlo | **1** (pedido 4 veces) | no | cerrado |
| 12 | Aprobar una descripción no es aprobar una pantalla | **2** | no | **volvió** |
| 13 | Una regla aplicada fuera de donde vale | **2** | sí · D | **nueva** |

**48 incidentes.** Los cuatro que se pueden mecanizar son los que más se
repitieron: 19 de los 48. Pero el saldo de las últimas vueltas es al revés: de
los 13 nuevos, **dos** los podía atajar un script — y uno de esos dos lo atajó
de verdad, el mismo día (la familia 13).

**Lo del 11/09 merece una línea aparte.** Tres de los siete nuevos estaban
tapando lo mismo —la agenda de Google— al mismo tiempo, y desde la pantalla los
tres se veían idénticos: «los contactos siguen sin agendarse». Augusto lo
reportó **tres veces**. Cuando un síntoma vuelve por tercera vez, la pregunta
ya no es «qué arreglo ahora» sino «cuántas causas distintas tiene esto»: la
primera vez se arregló una de las tres y se dio por cerrado.

---

## 1 · Borrar datos sin que nadie lo pida

> **1 vez · 10 ejecuciones · 546 registros perdidos**

**El problema.** El 08/09/2026 se corrió `node packages/db/dev.mjs --reset`
unas diez veces mientras se trabajaba en otra cosa. Se perdieron los **248
contactos y las 298 reuniones** que Augusto había importado. Nadie se dio
cuenta hasta que él preguntó, **dos días después**.

**De dónde vino.** De tratar un comando destructivo como parte de la rutina de
«reiniciar el entorno». Nadie lo pidió. La instrucción de fondo era «seguí
trabajando», y eso se leyó como permiso para hacer, cuando era permiso para
hacer, no para borrar.

**Cómo se resolvió.** Commit `76d3e86`:

- `--reset` **se niega solo** cuando hay datos que no son de demo.
- Copia obligatoria antes de tocar nada, siempre.
- Para arrancar limpio se usa **otra carpeta**: `PB_DATOS=.pb/pb_data_limpia`.
- Es la **primera sección de `CLAUDE.md`**, antes que cualquier otra cosa.

**Cómo está hoy.** 27 copias fechadas en `.pb/copias/`, una copia por hora en
`~/globalita-backups/crm/` y dos copias fuera de la máquina en Drive.

---

## 2 · El color de la agenda

> **8 vueltas.** El error más caro del proyecto, y el que más tardó en verse —
> y el único que se repitió **el mismo día** en que se escribió su regla.

Augusto lo reportó tres veces con las mismas palabras —«los colores son muy
tenues»— y las tres primeras respuestas fueron arreglos del lugar equivocado.

| # | Qué se hizo | Por qué no alcanzó |
|---|---|---|
| 1 | Doce franjas del mismo blanco separadas por medio píxel | Para saber si un bloque caía a las 11 o a las 12 había que contar desde arriba |
| 2 | Se agregó una banda alterna por hora, en `--bg` | **`--bg` era el color de los eventos**: el bloque y el fondo eran el mismo beige y el evento desaparecía |
| 3 | Se sacaron las bandas, columna clara y bloques sólidos | Iba bien, pero seguía sin ser la causa |
| 4 | — | **Tres reglas de la versión pálida habían quedado después de las nuevas** y ganaban: el hover devolvía el bloque a `--info-light` con el nombre en `--text`. Texto oscuro sobre fondo oscuro |
| 5 | Se midió | **La causa real**: `--surface` (#FAF7F1) sobre `--success-light` (#E8F5EB) = **1.1:1**, cuando lo mínimo legible es 4.5:1. En **tres de los cuatro estados** el nombre de la reunión era invisible |
| 6 | Los cuatro estados sólidos | El ámbar no daba: `--warning` con texto blanco queda en **4.38:1**. Lo encontró el chequeo automático, no una persona |
| 8 | — | **Lo volví a cometer el mismo día.** El campo de día y mes nuevo puso el texto vacío en `--hint`: **3.42:1** sobre `--surface`. Horas después de escribir en este registro que `--hint` no da. Lo encontró el chequeo B, y sólo porque se agregó la pareja a la tabla — sin esa línea habría pasado en silencio |
| 7 | — | **Se pasó de largo para el otro lado.** *«Es un verde demasiado fuerte»*, *«es como un gris»*, *«me gustaría una paleta un poquito más clara»*. Los números estaban bien —5.80, 6.19, 6.05— y el resultado igual estaba mal |

**De dónde vino.** De tres cosas, y la tercera es la que explica por qué el
péndulo fue de una punta a la otra:

1. **Buscar el contraste en el fondo y no en el bloque.** El contraste de una
   agenda no sale de la columna: sale de los bloques. Los tres primeros
   intentos jugaron con el fondo.
2. **Nunca calcular el número.** «Se ve tenue» se trató como una opinión de
   diseño durante tres rondas. Era una medición: 1.1:1. Un minuto de cuenta lo
   habría cerrado la primera vez.
3. **Diseñar el color de la agenda mirando la agenda.** Las seis vueltas se
   discutieron dentro de la pantalla, sin abrir ninguna otra. Y el resto del
   dashboard ya tenía la respuesta escrita: **tinte claro de fondo, texto
   saturado del mismo tono**. Así están `.fila-reunion-asistio` (5.89:1),
   `.fila-ultimo` (4.94:1), `.badge-meeting` (6.78:1), `.badge-await`
   (6.37:1) y `.pastilla` (5.93:1). **Bloque sólido con texto blanco no
   existe en ninguna otra parte del CRM.** La agenda se inventó un idioma de
   color propio, y por eso podía estar aprobada por el chequeo y desentonar
   igual. Esto es la familia 4 disfrazada de familia 2.

**Cómo se resolvió.**

- Los cuatro estados con contraste **calculado**: programada 5.80:1, asistió
  6.19:1, no asistió 6.05:1.
- **Cancelada va al revés** —fondo claro, texto oscuro, 12.83:1— y no por
  capricho: es la única de las cuatro donde la reunión **no pasó**, así que no
  tiene por qué gritar como las tres que sí ocurrieron.
- Lo que **no** era una reunión dejó de gritar: el almuerzo y el focus time
  estaban sólidos en el gris más oscuro de la paleta y le peleaban atención a
  las reuniones. Van rayados. **No era que las reuniones fueran tenues: era
  que todo gritaba igual.**
- Chequeo **B** en `revisar-aprendizajes.mjs`.

**Lo que enseñó la octava, que es distinto de las siete anteriores.** Escribir
la regla no alcanza, ni siquiera el mismo día: el que la escribió la rompió a
las pocas horas eligiendo un token por cómo se ve el nombre —«hint» suena a
texto secundario— y no por el número. **Lo único que lo atajó fue la tabla del
chequeo B**, y sólo porque se le sumó la línea del bloque nuevo. La regla de
oro de esa tabla —«un bloque de color nuevo suma una línea acá»— dejó de ser
burocracia el día que se cumplió.

Y una trampa de la tabla misma: **el primer selector tiene que ser el que trae
el FONDO**. Se anotó `.campo-dia-vacio`, que sólo pone `color`, y el chequeo
la saltó en silencio — una pareja mal escrita se ve igual que una pareja que
pasa. Ahora dice `.campo-dia select`.

**La lección, en dos líneas.** Cuando alguien dice «no se ve», medilo antes de
opinar. Y cuando el número da bien y igual se ve mal, el problema no es el
contraste: es que esa pantalla se está pintando con una paleta que el producto
no usa en ningún otro lado. **4.5:1 es el piso, no el criterio.**

---

## 3 · Una regla vieja pisando a la nueva

> **3 veces · 14 reglas muertas**

**El problema.** Una regla de CSS queda declarada dos veces. La segunda gana
por venir después en el archivo, así que la primera **no se aplica nunca** —
pero sigue ahí, leyéndose como si hiciera algo.

| # | Dónde | Cuántas |
|---|---|---|
| 1 | `.agenda-evento-calendario` — el hover pálido pisando al sólido | 3 reglas |
| 2 | La auditoría del 09/09: `.cc-aviso`, `.fila-reunion` y sus tres variantes, `.repo-vacio`, `.repo-destacar`, `.repo-alcance`, `.agenda-hora-col`, `.usuario-rapidos` | 11 reglas |
| 3 | `.agenda-evento-cancelada .agenda-evento-hora`, el mismo día | 1 — **atajada por el chequeo antes de subirla** |

**De dónde vino.** De editar **agregando al final del archivo** en vez de
modificar la regla que ya existe. Con 6.500 líneas de CSS escritas en tandas,
buscar la regla original cuesta más que escribir una nueva abajo — y funciona,
hasta que alguien vuelve a tocar la de arriba.

**Cómo se resolvió.** Chequeo **C**: agrupa por selector y avisa cuando el
mismo selector declara la misma propiedad con dos valores distintos. Eran 8,
quedaron 0. Se borraron las muertas y no se tocaron las que ganaban, así que
no cambió nada en pantalla.

**Nota.** Este error es el que hizo invisible el error 2 durante una vuelta
entera. Los errores se tapan entre ellos.

---

## 4 · Un control nuevo en vez del que ya existe

> **6 veces**

**El problema.** Construir a mano un control que el producto ya tiene.

| # | Qué pasó | Cómo se veía |
|---|---|---|
| 1 | El switch de canal | Un rectángulo de 3px con **azul de marca**, cuando el CRM es verde y todo tiene radio 8px |
| 2 | El checklist de permisos | Un `<input type=checkbox>` del navegador, que **en Windows sale azul** |
| 3 | El punto de sin leer | `15px`, cuando la escala del producto es 9/10/11/12/13/14/17 |
| 4 | El chevron de la hora | `8px`, por debajo del piso de la escala |
| 5 | Los fondos de los overlays | `rgba(0,0,0,.45)` escrito a mano, más un token `--rule-fuerte` **que no existe en ningún lado** y siempre caía en el fallback |
| 6 | Las fechas de la agenda | Cuatro `<input type="date">` del navegador, que obligan a poner el **año** para agendar mañana. `FechaReunion` ya tiene un calendario propio, y su comentario dice textual: *«el día se elige en un CALENDARIO, no en un `input type=date`»*. Se leyó el comentario y se escribió el input igual |

**De dónde vino.** De escribir el CSS nuevo sin abrir antes el prototipo ni los
tokens. Cada uno funcionaba; el problema es que juntos hacían que el producto
se viera de tres productos distintos.

**La regla que dictó Augusto**, y que quedó en `CLAUDE.md`:

> «Cada funcionalidad que hagas nueva en la UI tiene que respetar la estética
> del producto, no puede desarrollarse nada por fuera de ahí.»

**Cómo se resolvió.** El switch y el idioma pasaron a `.selector-idioma`, el
control segmentado del resto del CRM; los permisos usan el mismo tilde que el
repositorio de mensajes. Y el chequeo **D**, que busca solo los tamaños fuera
de escala, los colores literales y los tokens fantasma. Eran 5, quedaron 0.

---

## 5 · El scope de los handlers de PocketBase

> **2 veces**

**El problema.** Los handlers de PocketBase corren en un runtime JS aislado y
**no ven el scope del archivo**. Una constante declarada arriba existe al
cargar el archivo y desaparece cuando el handler corre.

1. Documentado en `google.js` la primera vez.
2. Repetido en `abrir.pb.js`: la lista `DOMINIOS` estaba al nivel del archivo, y
   **toda llamada moría con un 400 genérico** que no decía por qué.

**De dónde vino.** De que la trampa ya estaba escrita en un comentario del
repositorio y no se leyó antes de escribir el segundo handler. Documentar no
alcanza si nadie vuelve a leerlo.

**Cómo se resolvió.** Todo lo que usa un handler se declara **adentro** o se
`require` adentro. Y el chequeo **E**, que lee cada archivo de `pb_hooks/`,
busca lo declarado al nivel del archivo y avisa si un handler lo usa.

---

## 6 · Programar contra el modelo imaginado, no contra los datos

> **10 veces.** El que más se repite de los que **no** se pueden automatizar —
> y el único que ya se cometió dos veces **con el mismo campo**.

**El problema.** Escribir una regla contra cómo uno cree que son los datos, y
no contra cómo son.

| # | Qué se supuso | Qué eran los datos |
|---|---|---|
| 1 | Que `lead.asignado` tenía el dueño de la reunión | Estaba **vacío en los 242 leads**. Toda reunión nueva moría con «el lead no tiene a nadie asignado» |
| 2 | Que un título de prospección es «Nombre / Cuenta / Augusto» | El calendario usa las dos formas desde antes del CRM, y «Rodrigues **-** Augusto» quedaba afuera: **media agenda** |
| 3 | Que «Manual 35f9q8» eran eventos fantasma | Eran **7 reuniones reales** con fecha, cuenta y correo del invitado. Borrarlas perdía siete reuniones |
| 4 | Que `updated` sirve para ordenar chats por hora | `updated` es cuándo se tocó la fila, y marcar leído la toca: los chats salían 08:12, 11:24, 17:40, 10:45 |
| 5 | Que la × del chip sacaba el chip | Llamaba a `sinCuenta()`, que con un alcance por casa devuelve el alcance **intacto**, a propósito. La × no hacía nada |
| 6 | Que los huecos libres se calculan sobre lo que se ve | Se calculaban sobre los eventos **filtrados**: con el filtro en «BR» aparecía «2 h libre» encima de una reunión de AL |
| 8 | Que `chat_personal.tipo` aceptaba «sin_clasificar» | Es un select de DOS valores: «personal» y «trabajo». PocketBase rechazaba la fila entera, así que **los mensajes de WhatsApp llegaban y la pantalla quedaba vacía**. Lo reportó Augusto tres veces antes de que yo mirara el esquema || 9 | Que un mensaje se guarda como `{quien:'ellos', cuando}` | `MensajeChat` de core dice `{quien:'in'|'out', en}`. Ni el campo de la fecha ni el valor coincidían: la pantalla recibía objetos que no entiende y no dibujaba nada. **El mismo día que el #8, y sin abrir `core/chat.ts` ninguna de las dos veces** || 10 | Que un teléfono de WhatsApp hay que normalizarlo con el país | Un JID **ya viene en E.164**. Un mexicano quedó guardado como `545215523036183`: el 54 de Argentina pegado a un número que ya tenía su 52. Como se prospecta en México y Brasil, **rompía a casi todos** || 7 | Que `lead.updated` sirve para «últimos editados» | **Es `updated` otra vez, el mismo campo del #4.** `updated` es cuándo se tocó la fila, y la toca una importación, la sincronización de Google o cualquier script. El 09/09 la barra de accesos rápidos quedó clavada en «Jorge, Marcelo y Fabio» a las 20:09, 16:54 y 16:53: las tres filas que tocó el importador, no los tres leads que abrió Augusto. Lo reportó él, no un chequeo |

| 8 | Que `chat_personal.tipo` aceptaba «sin_clasificar» | Es un select de DOS valores: «personal» y «trabajo». PocketBase rechazaba la fila entera, así que **los mensajes de WhatsApp llegaban y la pantalla quedaba vacía**. Augusto lo reportó tres veces antes de que yo mirara el esquema |
| 9 | Que un mensaje se guarda como `{quien:'ellos', cuando}` | `MensajeChat` de core dice `{quien:'in'\|'out', en}`. Ni el campo de la fecha ni el valor coincidían: la pantalla recibía objetos que no entiende y no dibujaba nada. **El mismo día que el #8, y sin abrir `core/chat.ts` ninguna de las dos veces** |
| 10 | Que a un teléfono de WhatsApp hay que ponerle el país | Un JID **ya viene en E.164**. Un mexicano quedó guardado como `545215523036183`: el 54 de Argentina pegado a un número que ya tenía su 52. Como se prospecta en México y Brasil, **rompía a casi todos** |

| 11 | Que `google.js` exportaba `accessToken` | **No lo exporta.** `contactos.pb.js` lo llamaba desde el 11/09 y esa línea nunca pudo correr: cada intento moría con «g.accessToken is not a function», adentro de un `try` que lo contaba como si lo hubiera dicho Google. El botón de reintentar los contactos **no pudo funcionar ni una vez**, y el error se mostraba como si fuera de la API |

**De dónde vino.** De implementar sin consultar la base —o el módulo— primero.
Los once se habrían visto con una consulta de treinta segundos: diez con un
`SELECT`, y el once con un `grep "module.exports" google.js`.

**El once tiene una vuelta propia.** No fue suponer cómo son los datos: fue
suponer qué exporta un archivo que está en este mismo repositorio, a cuatro
carpetas de distancia. El módulo tiene **cuatro** `module.exports` sueltos
repartidos en 900 líneas además del objeto grande del medio, así que «está
exportado» no se ve mirando el final. Desde el 11/09 lo mira `revisar-campos`.

**El 11/09 volvió tres veces en dos horas**, las tres en el mismo archivo nuevo
y las tres por no abrir el esquema que ya estaba escrito a dos carpetas de
distancia. La regla que faltaba no es «mirar los datos» —ésa ya estaba— sino
**mirar los datos ANTES de escribir cada campo, no después del primer error**.

**El chequeo que sí se puede automatizar.** `node docs/revisar-campos.mjs`
compara lo que el worker escribe contra el esquema real de PocketBase: campos
que no existen, y valores fuera de un `select`. Es lo único de esta familia que
una máquina puede ver, y cubre los casos 8 y 10.

**Y el 7 agrega algo que el 4 ya había enseñado y no alcanzó.** Las dos veces
fue `updated`, y las dos veces el error fue el mismo: **confundir «cuándo
cambió la fila» con «cuándo lo hizo una persona»**. Documentarlo en el caso de
los chats no impidió repetirlo en el de los leads, porque nadie vuelve a leer
un comentario que está en otro archivo.

> **La regla, corta:** `created` y `updated` son de la fila, no de nadie. Si
> lo que se quiere mostrar es lo que hizo una PERSONA, tiene que salir de una
> tabla que registre personas — acá, `edicion`. Y si esa tabla está vacía, la
> respuesta correcta es no mostrar nada, no caer a `updated`.

**Por qué no se puede automatizar.** Ningún script sabe qué esperabas. La única
defensa es la práctica: **antes de escribir una regla sobre los datos, contarlos
contra la base.** Todos los números de `PENDIENTES.md` salen de consultas por
eso.

---

## 7 · Pedir la misma cosa en dos lugares

> **5 veces**

1. **El teléfono**: un chip vacío para escribirlo a mano **y** un botón aparte
   para conectarlo. Augusto no encontró el botón — estaba debajo del
   desplegable. Ahora **el chip vacío ES el botón**.
2. **El bloque de abajo de la ficha** repetía R0 y R1 con nombre completo y
   tenía su propio botón de destacados.
3. **El triage de números desconocidos** en WA Personal separaba «ya están en la
   base» de «no están» — y la lista de chats ya tenía esos números con un
   filtro que los deja solos.
4. **El «5 de 5»**: cada interruptor ya traía su conteo.
5. **El selector ES/PT/EN** en el encabezado: el idioma ya viaja con el chip
   desde que se destaca, así que era una pregunta ya contestada.

**De dónde vino.** De agregar lo nuevo **al lado** de lo viejo en vez de
reemplazarlo. Es lo más fácil de hacer y lo más difícil de ver después, porque
las dos cosas funcionan.

**La práctica.** Cuando se agrega una forma de hacer algo, se busca si ya
había otra. Si la hay, una de las dos se va en el mismo commit.

---

## 8 · Decidir por el usuario

> **5 veces.** Las dos nuevas son del 09/09 y tienen la misma forma: el código
> explica en un comentario por qué NO deja hacer algo, y Augusto pide
> exactamente eso.

1. **Once chips fijos** R0–R8, «reinvitar» y «gracias» aparecían quisiera uno o
   no. Augusto: *«todo esto se elimina, yo elijo qué es lo que queda
   guardado»*. Los pasos de la cadencia son una regla del sistema; **cuáles
   tener a mano es de quien escribe**.
2. **Diez plantillas destacadas de fábrica**, con alcances que nadie eligió.
   Un destacado es una decisión; precargarlos es adivinarla, y encima mal.
3. **El flujo de destacar al revés**: la lista primero, el alcance al final. Se
   elegía el mensaje a ciegas. Ahora son tres pasos en el orden en que se
   piensan: idioma → dónde vale → cuáles.
4. **Los eventos de Google no se arrastran.** El comentario decía: *«moverlo
   desde el CRM daría a entender que el CRM lo controla, cuando el dueño de
   ese evento es Google»*. Augusto: *«mantengo apretado y quiero mover hacia
   abajo, no me deja. Eso debería ser una funcionalidad»*. Y hoy **casi todo
   lo que se ve en su agenda es un evento de Google**: 1.769 externos contra
   288 reuniones del CRM. Se le bloqueó la mayor parte de la pantalla por una
   distinción que a él no le importa: si está en su calendario, es suyo.
5. **El teléfono sólo se conecta, no se escribe.** El chip vacío dice
   «Conectar un teléfono que ya está en la base», y el comentario lo
   justifica: *«hay 168 teléfonos sueltos esperando dueño y casi ninguno se va
   a tipear a mano»*. Cierto para esos 168 — y **falso justo para el teléfono
   que no está en la base**, que es el caso en que uno lo tiene en la mano y
   quiere escribirlo. Quedó un callejón sin salida.

**De dónde vino.** De confundir «tener un valor por defecto» con «tener la
respuesta». Un default está bien cuando la pregunta tiene una respuesta obvia;
acá no la tenía.

**Y de una versión más fina, que es la de los dos nuevos:** justificar una
restricción con un argumento correcto. «El dueño del evento es Google» es
verdad. «Nadie tipea 168 teléfonos» es verdad. Las dos veces el argumento era
sobre el sistema y la decisión era del usuario. **Un comentario que explica por
qué algo no se puede hacer es una señal de alarma, no una defensa**: si hizo
falta escribirlo, es porque alguien iba a querer hacerlo.

---

## 9 · Trampas de las APIs

> **5 veces.** No son errores de criterio: son cosas que la documentación no
> dice y se aprenden chocando. Quedan acá para no volver a chocar.
>
> El 4 y el 5 son del 11/09 y van juntos: **el mismo 403 leído mal, y el
> arreglo del punto 2 puesto donde sólo pasaba la mitad de los casos.**

1. **`singleEvents=true` sin `timeMax`.** Google expande los eventos
   recurrentes **al infinito**: traía 5.000 eventos cada cinco minutos y el
   `syncToken` no se obtenía nunca. Va con una ventana acotada.
2. **El correo de la cuenta venía vacío.** `userinfo` necesita el scope `email`
   que no pedimos —y pedirlo obligaría a reconectar a todos—. Se resuelve
   leyendo `GET /calendars/{id}`: **el id del calendario ES el correo**.
3. **`UNION` suelto en una vista de PocketBase.** No puede deducir los campos:
   muere con «invalid identifier parts» y **la base no arranca**. Va envuelto
   en una subconsulta. PocketBase estuvo caído un minuto.
4. **Un 403 de Google puede no ser un problema de permisos.** El 11/09
   contestó: *«People API has not been used in project … before or it is
   disabled»*. Es el **proyecto de Google Cloud** el que tiene la API apagada,
   no la cuenta la que no dio permiso. El hook leía «403 ⇒ le falta el
   permiso, desconectala y volvé a conectarla», y Augusto lo hizo — y no podía
   cambiar nada, porque el interruptor está en otra pantalla y es de otra
   persona. **Tres reportes del mismo síntoma salieron de ese diagnóstico.**
   Ahora la distinción vive en `core/agenda.ts porQueFalloLaAgenda`, con siete
   tests que llevan adentro el mensaje textual de Google.
5. **El rescate del correo, puesto donde sólo pasa la mitad.** El punto 2 de
   esta misma lista dice cómo se resuelve, y estaba resuelto — **adentro de
   `traerCambios`**, que corre sólo para la cuenta del calendario. Una cuenta
   conectada «sólo agenda» no pasa por ahí nunca: se quedaba en «sin correo»
   para siempre, y dos cuentas conectadas eran dos renglones idénticos. Escribir
   el aprendizaje no alcanza si el arreglo entra por un solo camino de dos.

**Además, dos que conviene tener presentes:**

- PocketBase devuelve **404 con «sql: no rows in result set»**, no 403, cuando
  una regla de API no coincide. Parece que el registro no existe.
- El SQL plano (`$app.db().newQuery`) **no dispara los hooks**. Es lo que
  evita el eco infinito al sincronizar desde Google, y es a propósito.

---

## 10 · Datos reales en un repo público

> **1 vez**

**El problema.** El repositorio `Augustomu/CRMGlobalita` es **público**, y el
bundle del prototipo tenía **6 teléfonos, 2 nombres y 1 correo** de contactos
de verdad, usados como datos de ejemplo en las maquetas.

**De dónde vino.** Las maquetas se exportan con lo que haya en pantalla, y en
pantalla había datos reales.

**Cómo se resolvió.** Se reemplazaron por inventados y se reescribió el
historial de git: el bundle viejo ya no está en ningún commit del remoto,
verificado después del push. `docs/enmascarar.mjs` lo deja resuelto para la
próxima exportación —**va a volver a pasar**— y compara contra la base en vez
de adivinar: sin base **se niega a correr** antes que dar un falso «está
limpio».

**Lo que sigue siendo cierto.** GitHub puede conservar el objeto viejo un
tiempo aunque ya no lo alcance ninguna rama. Y **lo que estuvo público, estuvo
público**: esto corta hacia adelante, no borra lo que alguien ya haya clonado.

---

## 11 · No había dónde guardarlo

> **1 error · pedido 4 veces**

**El problema.** Augusto pidió cuatro veces poder **conectar un evento del
calendario con un lead**. Las cuatro se respondió sobre la pantalla. Recién a
la cuarta se miró el esquema: `evento_externo` **no tenía campo `lead`**. No
había dónde guardar el vínculo.

**De dónde vino.** De tratar un pedido como un problema de interfaz sin
verificar si el modelo lo soportaba. Es el error 6 con otra cara.

**Cómo se resolvió.** Migración `1788604000_evento_con_lead` y la pantalla
encima. Y **por persona, no por evento**: son 278 eventos sueltos pero 145
personas, y dos de ellas se llevan 83 eventos.

**La lección.** Cuando algo se pide más de una vez, el problema no es el pedido:
es que la respuesta anterior no fue a la causa.

---

## 12 · Aprobar una descripción no es aprobar una pantalla

> **1 vez**

**El problema.** Augusto mandó unos mockups «como propuesta, analizá qué
conviene». Se analizaron y se le ofrecieron tres agregados: los carteles de
rato libre, el contador de reuniones por día y el reloj en la línea de ahora.
Dijo **«vamos con todos esos cambios»** y se construyeron los tres.

Al verlos en pantalla: *«sacá eso de una opción de una hora y media en el medio
libre, sacá esos comentarios, no me sirve, no me sirve y no quiero»*.

**De dónde vino.** De tratar un «dale» sobre un párrafo como un «dale» sobre
una pantalla. En texto, «un cartel que dice cuánto rato libre queda» suena
útil. En pantalla son **catorce carteles en una semana** —uno por hueco, por
día— compitiendo por atención con las reuniones, que es lo único que la agenda
tiene que mostrar. La descripción no lleva el costo; la pantalla sí.

**Lo que agrava el caso.** El pedido original era *«mejorar los colores y el
diseño»*. Los carteles no eran ni una cosa ni la otra: eran contenido nuevo
metido en una revisión de forma.

**Cómo se resuelve.** Para lo que **agrega tinta** a una pantalla densa —un
cartel, un contador, una insignia— el «dale» de una descripción no alcanza. O
se muestra antes, o entra apagado y se prende. Para lo que **cambia lo que ya
está** —un color, un tamaño, una posición— el «dale» sirve, porque no hay nada
nuevo peleando por el lugar.

### El segundo, 11/09 · media función es cero función

El worker de WhatsApp escuchaba los mensajes entrantes y los guardaba bien. La
pantalla los leía **una sola vez**, al abrirse: no había ningún refresco, ni
sondeo ni suscripción. Las dos mitades andaban y el circuito no existía.

Augusto: *«no me muestra cuando me mandan un mensaje, demora en llegar el
mensaje»*. Y desde acá se había dado por hecho, porque las dos piezas estaban
escritas y cada una hacía lo suyo.

**De dónde vino.** De revisar las piezas y no el recorrido. «El worker guarda»
y «la pantalla lee» son dos oraciones verdaderas que juntas no hacen «el
mensaje llega». Lo mismo que el envío: hoy el cuadro de escribir guarda el
mensaje en la base y **no sale a ningún lado** — se ve mandado y no se mandó.
Eso está anotado y a la vista en la pantalla, que es la diferencia entre una
deuda y una mentira.

---

## 13 · Una regla aplicada fuera de donde vale

> **2 veces, las dos el 11/09.** La única familia nueva que un chequeo **sí**
> podía atajar — y de hecho atajó las dos, el mismo día, antes de commitear.

**El problema.** Tomar una regla del sistema de diseño, que es cierta en su
dominio, y aplicarla donde ese dominio no llega.

| # | La regla | Dónde no valía |
|---|---|---|
| 1 | «Los tamaños de letra son 9, 10, 11, 12, 13, 14 y 17» | Sale del prototipo y es para **texto**, que se lee de corrido. Se aplicó a los emojis del selector: quedaron a **13px**, y a 13px no se distingue 😀 de 😃. Augusto lo reportó como «no se ven los emojis», y era literal. Un emoji no es una palabra: es una figura que hay que diferenciar de otra parecida, y un blanco al que hay que apuntar con el mouse |
| 2 | «Ningún color suelto: todo por los tokens» | Cierta. Pero el token elegido fue `--surface`, que **cambia con el tema** — y estaba encima del verde de WhatsApp, que **no cambia**. En tema oscuro daba una flecha casi negra sobre verde. El token correcto es uno que tampoco cambie |

**De dónde vino.** De aplicar la regla sin preguntarse de qué habla. Las dos
reglas son buenas; ninguna de las dos habla de esto. Y las dos veces el error
se ve igual: algo que técnicamente cumple el sistema de diseño y en pantalla
está mal.

**Cómo se resuelve.** La excepción va **por nombre**, no como escape general.
El chequeo D ahora conoce dos reglas —`.emo-tab` y `.emo-uno`— que dibujan
glifos y no texto, y cualquier tercera que se salga de la escala vuelve a
saltar. Un `/* eslint-disable */` de CSS habría cerrado el aviso y abierto la
puerta.

---

## Lo que NO era un error, y por eso hay una herramienta nueva

El 09/09 Augusto dijo que faltaba un contacto —«Erick Márquez»— y agregó:
*«visto que tenemos mucho cuidado con los datos, no puede faltar ningún
dato»*. Tiene razón, y sin embargo no había forma de contestarle sin escribir
un script a medida.

La respuesta fue: **los 248 teléfonos de los dos CSV están en la base, los
248**, y esa persona **no está en ninguno de los dos**. O sea que el dato no se
perdió: **nunca llegó**. Son dos cosas muy distintas y no poder distinguirlas
en un minuto es un problema por sí solo — porque la duda, sin número, se
parece demasiado al recuerdo del formateo.

Queda como herramienta permanente:

```
node packages/db/recuperacion/auditar-importacion.mjs <csv>... [--buscar «apellido»]
```

Compara por los **últimos ocho dígitos** —el mismo número aparece escrito de
tres formas— y busca la columna `Phone 1 - Value` **exacta**, porque
`/phone|tel/i` matchea «Phonetic First Name» y devuelve cero teléfonos con
239 ahí adelante. Las dos trampas ya están en este registro.

**Lo que sí quedó pendiente de eso**: esa persona existe en el CRM partida en
**tres perfiles** —«Herik Pires», «Herik Brasil» y «Erick»—, los tres sin
teléfono, creados el mismo minuto desde títulos del calendario. Es la familia
de los perfiles que se llevan dos personas, y va a Duplicados.

---

## Los cuatro chequeos

`node docs/revisar-aprendizajes.mjs` — sale con código 1 si encuentra algo.

| | Qué busca | Familia |
|---|---|---|
| **B** | Contraste por debajo de 4.5:1 en las parejas fondo/texto que conviven | 2 |
| **C** | El mismo selector declarando la misma propiedad dos veces | 3 |
| **D** | Tamaños fuera de escala, colores literales, tokens que no existen | 4 |
| **E** | Handlers de PocketBase que usan algo del scope del archivo | 5 |

**B se mantiene a mano y es a propósito.** Se intentó primero cruzar fondos y
colores automáticamente: da **83 avisos y casi todos son falsos**, porque sin
un DOM el script no sabe qué elemento está dentro de cuál ni qué regla gana por
especificidad. Un chequeo que grita 83 veces no lo corre nadie, y eso es peor
que no tenerlo. Así que las parejas se declaran: **un bloque de color nuevo
suma una línea a la tabla**, y si un selector deja de existir el chequeo avisa
en vez de callarse — ya pasó una vez, el mismo día que se escribió.

**Lo que ningún chequeo puede ver** son las familias 6, 7, 8 y 12, que son 18
de los 41 incidentes. Ésas no son de código: son de mirar los datos antes de
escribir la regla, buscar si eso ya existía en otro lado, no contestar una
pregunta que le toca al usuario, y no dar por aprobada una pantalla que nadie
vio todavía.

**Y la tercera vuelta agregó un límite que conviene tener escrito.** El chequeo
B aprobó los cuatro colores nuevos —5.80:1, 6.19:1, 6.05:1, 12.83:1— y los
cuatro estaban mal igual. B mide que el texto se lea; no mide que la pantalla
se parezca al resto del producto. Eso lo dice una persona, y por eso el
registro sigue teniendo más valor que el script.
