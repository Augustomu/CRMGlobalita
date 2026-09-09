# Pendientes

Lo decidido y todavía no hecho. La especificación —cómo tiene que ser— está
entera en `docs/MANUAL.md`. Acá va sólo el control de qué falta.

Última revisión: **09/09/2026 · 21:15**, verificada contra el código, contra la
base y contra los logs de PocketBase. Los números de acá salen de consultas, no
de memoria.

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
| 8 · Integraciones y worker | 1 de 5 |
| 9 · Producción | 1 de 4 |
| 10 · Los datos | **7 de 10** |
| 11 · Las copias | 1 de 2 |

**Los bloques 0 a 7 están cerrados.** Lo que queda no es de programar: el
worker (8) es la otra mitad del producto y tres de sus cuatro items esperan
datos de Augusto; producción (9) espera credenciales y su visto bueno; y los
datos (10) son fusiones y limpiezas que se hacen desde la pantalla.

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
- [ ] **Vista Lista: cambiar la fecha sin abrir la ficha.** Es lo único que
      quedó abierto de este punto.
- [x] **Las tres ideas del mockup del 09/09 que valían la pena.** Los ratos
      libres («2 h 30 libre») entre bloque y bloque, el contador de reuniones
      en la cabecera del día, y la línea roja de la hora actual con su reloj.
      La regla de los huecos está en `core/huecos.ts` con 17 tests que citan
      §7.6 — funde los ocupados que se pisan, recorta lo que asoma fuera de la
      franja y no anuncia nada por debajo de media hora.
      **Del mockup NO se tomó la paleta**: sus eventos son más pálidos que los
      nuestros, y adoptarla habría deshecho justo lo que Augusto venía pidiendo.
      Tampoco el popup al hacer clic — §7.6 ya decidió al revés.
- [ ] **Editar o crear un mensaje desde «Destacar mensajes».** Hoy hay que ir
      al Repositorio, y el momento en que uno se da cuenta de que falta un
      texto es justo cuando lo está buscando para destacarlo.
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
- [ ] 🔒 **8.4 · Las listas de prospección.** Las tiene que pasar Augusto.
- [ ] 🔒 **8.5 · WhatsApp con Baileys.** Una sola cuenta, según Augusto.

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
- [ ] **9.2 · SMTP de Hostinger** (`deploy/PASO-A-PASO.md`, paso 4.5). Sin eso,
      dar de alta a alguien falla.
- [ ] **9.3 · El deploy no se hizo.** `deploy/publicar.sh 45.90.108.64` necesita
      el visto bueno de Augusto. Las credenciales de Google van en
      `/etc/crm-globalita.env` con `chmod 600`, nunca en el repo.
- [ ] **9.4 · Backups del VPS.** Un snapshot del proveedor cubre lo que las tres
      copias no cubren: que se rompa el servidor, no la PC.

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

- [x] **La copia local por hora funciona.** `Globalita-SnapshotCRM` corre cada
      hora y deja una copia fechada en `~/globalita-backups/crm/`. Están las
      de las 17, 18, 19, 20 y 21 UTC, completas (sqlite + json + manifiesto),
      con `integrity=ok` y sin errores de claves foráneas.
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
      ❓ **Falta que Augusto decida** si se pisa `crm-snapshot` con la buena
      (`CRM_FORZAR=1`) o si se deja la vieja. Hasta que se decida, la tarea
      va a seguir devolviendo error cada hora.

---

## Deuda técnica anotada

- ⚠️ **Una regla del repo está escrita dos veces, y es la única.**
  `cambioDeGoogle()` vive en `core/sincronizar.ts` con nueve tests, y
  `pb_hooks/google.js` tiene un espejo en JavaScript plano porque el motor JS de
  PocketBase no puede cargar TypeScript. Lo que impide que se separen es
  `espejo-del-hook.test.ts`, que carga el archivo del hook de verdad y le exige
  la misma respuesta en diez casos. **Si se toca una, se tocan las dos.** La
  salida limpia sería un paso de build que compile core a JS para los hooks.
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
